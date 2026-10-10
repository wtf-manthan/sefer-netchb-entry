import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {Server} from 'http';
import {createApp} from '../src/app';
import {fixture} from './fixtures';
import {ShipmentExtractorService} from '../src/extraction/extractor';
let server:Server,base:string;
before(async()=>{server=createApp({enableDemo:false,maxUploadBytes:1024,extractor:new ShipmentExtractorService({apiKey:''})}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+(server.address() as any).port;});
after(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
async function post(path:string,body:unknown){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('health reports provider unavailable; demo is disabled',async()=>{assert.equal((await (await fetch(base+'/api/health')).json()).liveExtractionAvailable,false);assert.equal((await post('/api/demo',{})).status,404);});
test('no files and unrelated text uploads rejected',async()=>{
 assert.equal((await post('/api/extract',{})).status,400);
 const fd=new FormData();fd.append('documents',new Blob(['unrelated'],{type:'text/plain'}),'other.txt');
 assert.equal((await fetch(base+'/api/extract',{method:'POST',body:fd})).status,400);
});
test('PDF upload returns unavailable, never a sample shipment',async()=>{
 const fd=new FormData();fd.append('documents',new Blob(['%PDF-1.7\n%%EOF'],{type:'application/pdf'}),'synthetic.pdf');
 const r=await fetch(base+'/api/extract',{method:'POST',body:fd});assert.equal(r.status,503);const b=await r.json();assert.equal(b.extractedData,undefined);
});
test('oversized upload is rejected',async()=>{const fd=new FormData();fd.append('documents',new Blob(['%PDF-'+ 'X'.repeat(2048)],{type:'application/pdf'}),'large.pdf');assert.equal((await fetch(base+'/api/extract',{method:'POST',body:fd})).status,413);});
test('entry API validates inputs and rejects invalid dates and legacy defaults',async()=>{
 const {shipment,decisions}=fixture();
 assert.equal((await post('/api/entry',{shipmentData:{}})).status,400);
 assert.equal((await post('/api/entry',{shipmentData:shipment,brokerDecisions:{...decisions,mathResolution:'USE_PRINTED_6480'}})).status,400);
 assert.equal((await post('/api/entry',{shipmentData:shipment,brokerDecisions:{...decisions,customsFiling:{...decisions.customsFiling,entryDate:'bad'}}})).status,400);
});
test('entry API returns separate statuses and does not apply default credentials',async()=>{
 const {shipment,decisions}=fixture();
 let r=await post('/api/entry',{shipmentData:shipment}),b=await r.json();assert.equal(r.status,200);assert.equal(b.readyToTransmit,false);
 r=await post('/api/entry',{shipmentData:shipment,brokerDecisions:decisions});b=await r.json();assert.equal(b.schemaValid,true);assert.equal(b.readyToTransmit,true);
 shipment.bills[0].vessel.value='X'.repeat(21);
 b=await (await post('/api/entry',{shipmentData:shipment,brokerDecisions:decisions})).json();assert.equal(b.schemaValid,false);assert.equal(b.readyToTransmit,false);
});
test('unknown decision IDs and empty lookup requests are rejected',async()=>{
 const {shipment,decisions}=fixture();decisions.lineDecisions['other']={};
 assert.equal((await post('/api/entry',{shipmentData:shipment,brokerDecisions:decisions})).status,422);
 assert.equal((await fetch(base+'/api/hts/lookup')).status,400);
 const r=await fetch(base+'/api/ports/resolve?text=unknown');assert.equal(r.status,400);
});

test('explicit demo route is labelled and starts blocked',async()=>{
 const demoServer=createApp({enableDemo:true}).listen(0,'127.0.0.1');await new Promise<void>(r=>demoServer.once('listening',r));
 try {const r=await fetch('http://127.0.0.1:'+(demoServer.address() as any).port+'/api/demo',{method:'POST'});const b=await r.json();assert.equal(r.status,200);assert.equal(b.demo,true);assert.equal(b.readyToTransmit,false);assert.deepEqual(b.brokerDecisions.customsFiling,{});assert.equal(b.spendUsd,0);}
 finally{await new Promise<void>((resolve,reject)=>demoServer.close(e=>e?reject(e):resolve()));}
});

test('successful extraction route returns observed shipment and unresolved filing decisions',async()=>{
 const {shipment}=fixture();
 const extractor=new ShipmentExtractorService({apiKey:''});
 extractor.extractShipment=async()=>({shipment,cacheHit:false,costUsd:0});
 const live=createApp({extractor}).listen(0,'127.0.0.1');await new Promise<void>(r=>live.once('listening',r));
 try {
  const fd=new FormData();fd.append('documents',new Blob(['%PDF-test'],{type:'application/pdf'}),'unseen.pdf');
  const r=await fetch('http://127.0.0.1:'+(live.address() as any).port+'/api/extract',{method:'POST',body:fd});
  const body=await r.json();assert.equal(r.status,200);assert.equal(body.extractedData.invoices[0].invoiceNo.value,'SYNTHETIC-42');assert.deepEqual(body.brokerDecisions.customsFiling,{});assert.equal(body.readyToTransmit,false);assert.equal(body.spendUsd,0);
 }finally{await new Promise<void>((resolve,reject)=>live.close(e=>e?reject(e):resolve()));}
});
