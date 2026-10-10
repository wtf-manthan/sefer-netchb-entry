import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {resolveScheduleKPort,createScheduleKResolver} from '../../src/reference/schedule-k';
import {createApp} from '../../src/app';
import {ShipmentExtractorService} from '../../src/extraction/extractor';

test('official names and published aliases return the same code; remain unconfirmed',()=>{
  const r=resolveScheduleKPort({query:'  ho chi minh city  ',country:'Vietnam'});
  assert.equal(r.outcome,'exact_match');assert.equal(r.candidates[0].code,'55224');
  assert.equal(r.matchingMethod,'alias');assert.equal(r.userConfirmedForShipment,false);
  assert.equal(r.codeVerifiedAgainstReference,true);
  assert.equal(resolveScheduleKPort({query:'Shanghai',country:'China'}).candidates[0].code,'57035');
});
test('preserves leading zeros and refuses arbitrary code padding',()=>{
  assert.equal(resolveScheduleKPort({query:'01520'}).candidates[0].label,'Hamilton, ONT, Canada');
  assert.equal(resolveScheduleKPort({query:'1520'}).outcome,'no_match');
});
test('country mismatch rejects even an exact code; ISO aliases are not invented',()=>{
  assert.equal(resolveScheduleKPort({query:'55224',country:'China'}).outcome,'no_match');
  assert.equal(resolveScheduleKPort({query:'55224',country:'VN'}).outcome,'no_match');
});
test('unknown terminals are unresolved; partial matches cannot become exact matches',()=>{
  assert.equal(resolveScheduleKPort({query:'Cat Lai'}).outcome,'no_match');
  assert.equal(resolveScheduleKPort({query:'Shangh',country:'China'}).outcome,'candidates');
  assert.equal(resolveScheduleKPort({query:'nonexistent-terminal-123'}).outcome,'no_match');
});
test('aggregate codes require selection and cannot auto-resolve a specific port',()=>{
  const r=resolveScheduleKPort({query:'09000'});
  assert.equal(r.outcome,'candidates');assert.equal(r.candidates[0].details?.isAggregate,true);
});
test('hints affect fingerprint and independent results never share mutable confirmation',()=>{
  const a=resolveScheduleKPort({query:'55224'}),b=resolveScheduleKPort({query:'55224',country:'Vietnam'});
  assert.notEqual(a.fingerprint,b.fingerprint);a.userConfirmedForShipment=true;
  assert.equal(resolveScheduleKPort({query:'55224'}).userConfirmedForShipment,false);
});
test('invalid requests reject roles, empty queries and confirmation injection',()=>{
  for(const request of [{query:''},{query:'a'.repeat(151)},{query:'London',role:'entry-port'},{query:'London',userConfirmedForShipment:true}])
    assert.throws(()=>resolveScheduleKPort(request as any));
});
test('duplicate names need country disambiguation; corrupt or missing dataset fails closed',()=>{
  const dir=mkdtempSync(join(tmpdir(),'schedule-k-'));
  try {
    const lookup=createScheduleKResolver(dir);assert.equal(lookup({query:'Example'}).outcome,'unavailable');
    const ports=[{code:'00001',name:'Example',countryCode:'0001',country:'Country A',aliases:[]},{code:'00002',name:'Example',countryCode:'0002',country:'Country B',aliases:[]}];
    const bytes=JSON.stringify(ports);
    const manifest={publisher:'Synthetic test fixture',url:'https://example.org',datasetVersion:'test-only',retrievedAt:'2026-10-10',recordCount:2,checksumSha256:createHash('sha256').update(bytes).digest('hex')};
    writeFileSync(join(dir,'ports.json'),bytes);writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest));
    assert.equal(lookup({query:'Example'}).outcome,'candidates');
    assert.equal(lookup({query:'Example',country:'Country B'}).candidates[0].code,'00002');
    writeFileSync(join(dir,'ports.json'),'[]');
    const result=lookup({query:'Example'});assert.equal(result.outcome,'unavailable');assert.deepEqual(result.candidates,[]);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('source workbook checksum and all imported port counts match pinned provenance',()=>{
  const dir=resolve(__dirname,'../../data/reference/schedule-k');
  const m=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  assert.equal(createHash('sha256').update(readFileSync(join(dir,'schedule-k-2026-q2.xlsx'))).digest('hex'),m.sourceSha256);
  assert.equal(m.recordCount,2191);assert.equal(m.sourceRowCount,4083);
});
test('HTTP endpoint returns reviewable suggestions and validates repeated/foreign-role parameters',async()=>{
  const server=createApp({extractor:new ShipmentExtractorService({apiKey:''})}).listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+(server.address() as any).port+'/api/ports/foreign/resolve';
  try {
    const response=await fetch(base+'?query=Shanghai&country=China');assert.equal(response.status,200);
    assert.equal((await response.json()).result.userConfirmedForShipment,false);
    for(const query of ['','?query=London&query=Shanghai','?query=London&role=entry-port'])assert.equal((await fetch(base+query)).status,400);
  } finally {await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
