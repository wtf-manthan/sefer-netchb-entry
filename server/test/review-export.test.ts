import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {Server} from 'node:http';
import {createApp} from '../src/app';
import {ShipmentExtractorService} from '../src/extraction/extractor';
import {fixture,field} from './fixtures';
import {BrokerDecisionsSchema,RawExtractedShipmentSchema,emptyDecisions,findingTarget} from '@sefer/shared';
import {lookupPortForShipment} from '../src/reference/port-workflow';
import {generateEntry} from '../src/builder/entry-service';
let server:Server,base:string;
before(async()=>{server=createApp({extractor:new ShipmentExtractorService({apiKey:''})}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+(server.address() as any).port;});
after(async()=>{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));});
const post=(path:string,body:unknown)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('non-apparel shipment: verify a port and export deterministic, schema-valid checked XML',async()=>{
  const {shipment,decisions}=fixture();shipment.invoices[0].lines[0].description=field('Synthetic wooden chair');
  const original=JSON.stringify(shipment);
  const response=await post('/api/reference/port',{shipmentData:shipment,brokerDecisions:decisions,request:{target:'unladingPortCode',query:'Tacoma'}});
  assert.equal(response.status,200);const lookup=await response.json();assert.equal(lookup.result.userConfirmedForShipment,false);
  decisions.customsFiling.unladingPortCode='3002';decisions.portSelections.unladingPortCode={request:lookup.request,candidateCode:'3002',lookupFingerprint:lookup.result.fingerprint,evidenceFingerprint:lookup.evidenceFingerprint};
  const body={shipmentData:shipment,brokerDecisions:decisions,kind:'ready'};
  const a=await post('/api/export',body);assert.equal(a.status,200);const first=await a.json();const second=await (await post('/api/export',body)).json();
  assert.equal(first.xml,second.xml);assert.match(first.xml,/<unlading-port>3002<\/unlading-port>/);assert.equal(first.reviewReport.schemaValid,true);assert.equal(first.reviewReport.readyToTransmit,true);assert.equal(first.fileName,'netchb-entry-checked.xml');assert.equal(JSON.stringify(shipment),original);
});
test('editing evidence, code or query invalidates reference selection and checked export',async()=>{
  for(const change of ['evidence','code','query']){
    const {shipment,decisions}=fixture();const lookup=lookupPortForShipment(shipment,decisions,{target:'entryPortCode',query:'Tacoma'});
    decisions.customsFiling.entryPortCode='3002';decisions.portSelections.entryPortCode={request:lookup.request,candidateCode:'3002',lookupFingerprint:lookup.result.fingerprint,evidenceFingerprint:lookup.evidenceFingerprint};
    if(change==='evidence')shipment.invoices[0].lines[0].description=field('Changed goods');
    if(change==='code')decisions.customsFiling.entryPortCode='3001';
    if(change==='query')decisions.portSelections.entryPortCode.request.query='Seattle';
    const result=await generateEntry(shipment,decisions);assert.equal(result.readyToTransmit,false);assert.ok(result.findings.some(f=>f.code==='STALE_PORT_SELECTION'));assert.equal(result.resolved.filing.entryPortCode,undefined);
    assert.equal((await post('/api/export',{shipmentData:shipment,brokerDecisions:decisions,kind:'ready'})).status,409);
  }
});
test('manual override works only after explicitly removing its old lookup selection',async()=>{
  const {shipment,decisions}=fixture(),lookup=lookupPortForShipment(shipment,decisions,{target:'entryPortCode',query:'Tacoma'});
  decisions.portSelections.entryPortCode={request:lookup.request,candidateCode:'3002',lookupFingerprint:lookup.result.fingerprint,evidenceFingerprint:lookup.evidenceFingerprint};
  assert.equal((await generateEntry(shipment,decisions)).readyToTransmit,false);
  delete decisions.portSelections.entryPortCode;assert.equal((await generateEntry(shipment,decisions)).readyToTransmit,true);
});
test('missing decisions still export open items; draft never masquerades as checked export',async()=>{
  const {shipment,decisions}=fixture();const empty=emptyDecisions();
  const report=await post('/api/export',{shipmentData:shipment,brokerDecisions:empty,kind:'review'});assert.equal(report.status,200);assert.equal((await report.json()).reviewReport.readyToTransmit,false);
  assert.equal((await post('/api/export',{shipmentData:shipment,brokerDecisions:empty,kind:'ready'})).status,409);
  assert.equal((await post('/api/export',{shipmentData:shipment,brokerDecisions:empty,kind:'draft'})).status,200);
  decisions.customsFiling.referenceDataConfirmed=false;
  const draft=await (await post('/api/export',{shipmentData:shipment,brokerDecisions:decisions,kind:'draft'})).json();assert.equal(draft.fileName,'netchb-entry-DRAFT.xml');assert.equal(draft.reviewReport.readyToTransmit,false);
});
test('saved review round-trip preserves choices but revalidation detects changed shipment',async()=>{
  const {shipment,decisions}=fixture();const saved=JSON.parse(JSON.stringify({reviewVersion:1,shipmentData:shipment,brokerDecisions:decisions}));
  assert.deepEqual(BrokerDecisionsSchema.parse(saved.brokerDecisions),decisions);assert.deepEqual(RawExtractedShipmentSchema.parse(saved.shipmentData),shipment);
  saved.shipmentData.modeOfTransport=field('air');const result=await generateEntry(saved.shipmentData,saved.brokerDecisions);assert.equal(result.readyToTransmit,false);assert.ok(result.findings.some(f=>f.code==='UNSUPPORTED_MODE'));
});
test('review API rejects invalid context and finding targets locate actionable fields',async()=>{
  const {shipment,decisions}=fixture();assert.equal((await post('/api/reference/port',{shipmentData:shipment,brokerDecisions:decisions,request:{target:'foreignPortCode',query:'Shanghai',stateHint:'WA'}})).status,400);
  const result=await generateEntry(shipment,emptyDecisions());const missing=result.findings.find(f=>f.code==='MISSING_FILING'&&f.entityId==='entryPortCode')!;assert.equal(findingTarget(missing),'customsFiling.entryPortCode');
});
