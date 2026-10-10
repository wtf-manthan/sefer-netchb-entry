import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {resolveScheduleDPort,SCHEDULE_D_METADATA,listAllScheduleDPorts} from '../../src/reference/schedule-d';
import {computeConfirmationFingerprint,computeSha256} from '@sefer/shared';
import {createApp} from '../../src/app';
import {ShipmentExtractorService} from '../../src/extraction/extractor';

test('Schedule D source snapshot and generated data match all 429 records and checksums',()=>{
  const root=resolve(__dirname,'../../..');
  const raw=readFileSync(resolve(root,'server/data/reference/schedule-d/census-rendered-rows.txt'));
  assert.equal(createHash('sha256').update(raw).digest('hex'),SCHEDULE_D_METADATA.sourceSha256);
  const ports=listAllScheduleDPorts();assert.equal(ports.length,429);
  for(const p of ports)assert.ok(raw.toString().includes(`${p.sourceLabel}  | ${p.code}  | Port`));
});
test('previously incorrect mappings match the preserved Census source',()=>{
  for(const [query,code] of [['Limestone','0118'],['Chicago Executive Airport','3983'],['San Francisco Intl Arpt','2801'],['San Francisco','2809'],['San Pablo Bay','2829'],['San Jose Intl Airport','2834'],['Portland Intl Airport','2910'],['Tacoma','3002']]) {
    const r=resolveScheduleDPort(query,{role:'entry-port'});assert.equal(r.outcome,'exact_match',query);assert.equal(r.candidates[0].code,code);
  }
});
test('unverified IATA and terminal aliases never auto-resolve',()=>{
  for(const query of ['ORD','SFO','EWR','SJC','PDX','Cat Lai','Atlantis','300','30020'])assert.equal(resolveScheduleDPort(query).outcome,'no_match',query);
});
test('states disambiguate names; contradictory hints reject names AND codes',()=>{
  assert.equal(resolveScheduleDPort('Portland').outcome,'candidates');
  assert.equal(resolveScheduleDPort('Portland, ME').candidates[0].code,'0101');
  assert.equal(resolveScheduleDPort('Portland',{stateHint:'OR'}).candidates[0].code,'2904');
  for(const query of ['3002','Tacoma','Tacoma, WA'])assert.equal(resolveScheduleDPort(query,{stateHint:'NY'}).outcome,'no_match');
});
test('single partial match remains a candidate; special reporting codes need review',()=>{
  assert.equal(resolveScheduleDPort('Tac').outcome,'no_match');
  assert.equal(resolveScheduleDPort('Tacom').outcome,'candidates');
  assert.equal(resolveScheduleDPort('7000').outcome,'candidates');
  assert.equal(resolveScheduleDPort('St. Louis, MO').candidates[0].code,'4503');
});
test('confirmation binds shipment, evidence, result, role, candidate and dataset',()=>{
  const r=resolveScheduleDPort('Tacoma',{role:'unlading-port'});
  const context={category:r.category,targetField:r.targetField,query:r.query,datasetVersion:r.source.datasetVersion,candidateCode:'3002',shipmentId:'shipment-A',evidenceFingerprint:computeSha256('bill-A:p1:Tacoma'),lookupFingerprint:r.fingerprint};
  const confirmation={...context,confirmedAt:'2026-10-10',fingerprint:computeConfirmationFingerprint(context)};
  const options={role:'unlading-port',shipmentId:context.shipmentId,evidenceFingerprint:context.evidenceFingerprint,userConfirmation:confirmation};
  assert.equal(resolveScheduleDPort('Tacoma',options).userConfirmedForShipment,true);
  for(const change of [{role:'entry-port'},{shipmentId:'shipment-B'},{evidenceFingerprint:computeSha256('changed')},{stateHint:'WA'}])assert.equal(resolveScheduleDPort('Tacoma',{...options,...change}).userConfirmedForShipment,false);
  assert.equal(resolveScheduleDPort('Tacoma',{userConfirmation:confirmation}).userConfirmedForShipment,false);
});
test('unsupported roles and mutation of returned records cannot alter the dataset',()=>{
  assert.equal(resolveScheduleDPort('Tacoma',{role:'foreign-port'}).outcome,'no_match');
  const p=listAllScheduleDPorts().find(p=>p.code==='3002')!;p.name='CHANGED';
  assert.equal(resolveScheduleDPort('Tacoma').outcome,'exact_match');
});
test('domestic port API validates input and returns unconfirmed suggestions',async()=>{
  const server=createApp({extractor:new ShipmentExtractorService({apiKey:''})}).listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port+'/api/ports/resolve';
  try {
    const r=await fetch(base+'?query=Tacoma&role=unlading-port');assert.equal(r.status,200);
    const b=await r.json();assert.equal(b.result.candidates[0].code,'3002');assert.equal(b.result.userConfirmedForShipment,false);
    for(const q of ['?query=Tacoma','?query=Tacoma&role=foreign-port','?query=A&query=B&role=entry-port','?query=Tacoma&role=entry-port&userConfirmedForShipment=true'])assert.equal((await fetch(base+q)).status,400);
  } finally {await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
