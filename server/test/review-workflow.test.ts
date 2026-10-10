import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app';
import {ShipmentExtractorService} from '../src/extraction/extractor';
import {fixture} from './fixtures';
import {applyObservationCorrections,BrokerDecisionsSchema} from '@sefer/shared';
import {resolveShipment} from '../src/checks';
async function withServer(run:(base:string,getCalls:()=>number)=>Promise<void>,options:{ttl?:number;failFirst?:boolean}={}){
 let calls=0;const extractor=new ShipmentExtractorService({apiKey:''});
 extractor.extractShipment=async()=>{calls++;if(options.failFirst&&calls===1)throw new Error('simulated provider failure');return {shipment:fixture().shipment,cacheHit:false,costUsd:null};};
 const server=createApp({extractor,uploadTtlMs:options.ttl}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{await run('http://127.0.0.1:'+(server.address() as any).port,()=>calls);}finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
}
async function stage(base:string){const fd=new FormData();fd.append('documents',new Blob(['%PDF-test'],{type:'application/pdf'}),'unseen.pdf');return fetch(base+'/api/uploads',{method:'POST',body:fd});}
test('upload stages documents without inference; explicit extraction consumes token',async()=>withServer(async(base,calls)=>{
 const r=await stage(base);assert.equal(r.status,201);const b=await r.json();assert.equal(calls(),0);assert.equal(b.files[0].name,'unseen.pdf');
 const extracted=await fetch(base+'/api/uploads/'+b.uploadId+'/extract',{method:'POST'});assert.equal(extracted.status,200);assert.equal(calls(),1);assert.equal((await extracted.json()).extractedData.invoices[0].invoiceNo.value,'SYNTHETIC-42');
 assert.equal((await fetch(base+'/api/uploads/'+b.uploadId+'/extract',{method:'POST'})).status,410);assert.equal(calls(),1);
}));
test('go back discards documents; stale and unknown tokens cannot extract',async()=>withServer(async(base,calls)=>{
 const b=await (await stage(base)).json();assert.equal((await fetch(base+'/api/uploads/'+b.uploadId,{method:'DELETE'})).status,204);
 assert.equal((await fetch(base+'/api/uploads/'+b.uploadId+'/extract',{method:'POST'})).status,410);
 assert.equal((await fetch(base+'/api/uploads/unknown/extract',{method:'POST'})).status,410);assert.equal(calls(),0);
}));
test('temporary uploads expire without inference',async()=>withServer(async(base,calls)=>{
 const b=await (await stage(base)).json();await new Promise(r=>setTimeout(r,50));assert.equal((await fetch(base+'/api/uploads/'+b.uploadId+'/extract',{method:'POST'})).status,410);assert.equal(calls(),0);
},{ttl:20}));
test('failed extraction retains upload for an explicit retry',async()=>withServer(async(base,calls)=>{
 const b=await (await stage(base)).json();const url=base+'/api/uploads/'+b.uploadId+'/extract';assert.equal((await fetch(url,{method:'POST'})).status,500);assert.equal((await fetch(url,{method:'POST'})).status,200);assert.equal(calls(),2);
},{failFirst:true}));
test('staging rejects invalid documents and missing files before inference',async()=>withServer(async(base,calls)=>{
 assert.equal((await fetch(base+'/api/uploads',{method:'POST'})).status,400);
 const fd=new FormData();fd.append('documents',new Blob(['bad'],{type:'application/pdf'}),'bad.pdf');assert.equal((await fetch(base+'/api/uploads',{method:'POST',body:fd})).status,400);assert.equal(calls(),0);
}));
const correction={value:'CA',source:{doc:'doc-a',page:1,snippet:'Country of export: Canada'},note:'Confirmed against document'};
test('corrections preserve original evidence and feed deterministic resolution',()=>{
 const {shipment,decisions}=fixture();const before=JSON.stringify(shipment);decisions.observationCorrections={'invoices.0.countryOfExport':correction};
 const effective=applyObservationCorrections(shipment,decisions.observationCorrections);assert.equal(effective.invoices[0].countryOfExport.value,'CA');assert.equal(JSON.stringify(shipment),before);
 const result=resolveShipment(shipment,decisions);assert.equal(result.resolved.invoices[0].countryExport,'CA');assert.ok(!result.findings.some(f=>f.code==='EVIDENCE_REVIEW'&&f.entityId?.includes('countryOfExport')));
});
test('corrections reject non-observations, unsafe paths, wrong types, unknown documents and missing reasons',()=>{
 const {shipment}=fixture();
 for(const path of ['__proto__.value','documents.0.name','invoices.42.currency'])assert.throws(()=>applyObservationCorrections(shipment,{[path]:correction}));
 assert.throws(()=>applyObservationCorrections(shipment,{'invoices.0.freight':correction}));
 assert.throws(()=>applyObservationCorrections(shipment,{'invoices.0.countryOfExport':{...correction,source:{...correction.source,doc:'unknown'}}}));
 assert.equal(BrokerDecisionsSchema.safeParse({observationCorrections:{'invoices.0.countryOfExport':{...correction,note:''}}}).success,false);
});
test('entry API applies corrections and rejects unsafe corrections',async()=>withServer(async(base)=>{
 const {shipment,decisions}=fixture();decisions.observationCorrections={'invoices.0.countryOfExport':correction};
 const send=()=>fetch(base+'/api/entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipmentData:shipment,brokerDecisions:decisions})});
 const r=await send();assert.equal(r.status,200);const body=await r.json();assert.equal(body.resolved.invoices[0].countryExport,'CA');assert.equal(body.correctionAudit['invoices.0.countryOfExport'].note,correction.note);
 decisions.observationCorrections={'invoices.0.freight':correction};assert.equal((await send()).status,400);
}));

test('concurrent confirmation cannot launch duplicate extraction for a staged upload',async()=>{
 let calls=0,release!:()=>void;
 const gate=new Promise<void>(r=>{release=r;});const extractor=new ShipmentExtractorService({apiKey:''});
 extractor.extractShipment=async()=>{calls++;await gate;return {shipment:fixture().shipment,cacheHit:false,costUsd:null};};
 const server=createApp({extractor}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+(server.address() as any).port;
 try {
  const b=await (await stage(base)).json(),url=base+'/api/uploads/'+b.uploadId+'/extract';
  const first=fetch(url,{method:'POST'});
  for(let i=0;i<100&&calls===0;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(calls,1);assert.equal((await fetch(url,{method:'POST'})).status,409);
  assert.equal((await fetch(base+'/api/uploads/'+b.uploadId,{method:'DELETE'})).status,409);
  release();assert.equal((await first).status,200);assert.equal(calls,1);
 }finally{release();await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
