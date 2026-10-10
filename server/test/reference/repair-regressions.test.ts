import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ReferenceDiskCache} from '../../src/reference/cache';
import {resolveScheduleDPort} from '../../src/reference/schedule-d';
import {computeSha256,IsoDateTimeOrDateSchema,DatasetManifestSchema,computeConfirmationFingerprint,isConfirmationValidForLookup,filterScopedConfirmations} from '@sefer/shared';

test('cache isolates roles and hints, rejects unscoped access, never persists confirmations',()=>{
  const dir=mkdtempSync(join(tmpdir(),'reference-repair-'));
  try {
    assert.throws(()=>new ReferenceDiskCache(dir),/requires/);
    const a=new ReferenceDiskCache(dir,{targetField:'header.entry-port',contextFingerprint:computeSha256('state=WA')});
    const b=new ReferenceDiskCache(dir,{targetField:'header.unlading-port',contextFingerprint:computeSha256('state=WA')});
    const c=new ReferenceDiskCache(dir,{targetField:'header.entry-port',contextFingerprint:computeSha256('state=NY')});
    const entry=resolveScheduleDPort('Tacoma',{role:'entry-port'}),unlading=resolveScheduleDPort('Tacoma',{role:'unlading-port'}),v=entry.source.datasetVersion;
    entry.userConfirmedForShipment=true;
    a.set('ports','Tacoma',v,entry,{ttlMs:60000});b.set('ports','Tacoma',v,unlading);
    assert.equal(a.get('ports','Tacoma',v)?.targetField,'header.entry-port');
    assert.equal(b.get('ports','Tacoma',v)?.targetField,'header.unlading-port');
    assert.equal(c.get('ports','Tacoma',v),null);
    assert.equal(a.get('ports','Tacoma',v)?.userConfirmedForShipment,false);
    assert.equal(entry.userConfirmedForShipment,true);
    assert.throws(()=>a.set('ports','Tacoma',v,unlading),/target field/);
    const file=join(dir,'ports',a.computeCacheKey('ports','Tacoma',v)+'.json');
    const stored=JSON.parse(readFileSync(file,'utf8'));assert.equal(stored.data.userConfirmedForShipment,false);
    stored.cachedAt='2000-01-01T00:00:00Z';stored.data.userConfirmedForShipment=true;writeFileSync(file,JSON.stringify(stored));
    assert.equal(a.get('ports','Tacoma',v,{labelStaleIfExpired:true})?.userConfirmedForShipment,false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('reference calendar dates reject impossible days including timestamp forms',()=>{
  for(const date of ['2026-02-30','2025-02-29','2026-04-31T00:00:00Z','2026-00-01','2026-13-01'])assert.equal(IsoDateTimeOrDateSchema.safeParse(date).success,false,date);
  for(const date of ['2024-02-29','2026-10-10T23:59:59+05:30'])assert.equal(IsoDateTimeOrDateSchema.safeParse(date).success,true,date);
});
test('legacy confirmations fail closed; evidence changes invalidate only their own field',()=>{
  const context={category:'ports',targetField:'header.entry-port',query:'Tacoma',datasetVersion:'v1',candidateCode:'3002',shipmentId:'s1',evidenceFingerprint:computeSha256('e1'),lookupFingerprint:computeSha256('l1')};
  const confirmation={...context,confirmedAt:'2026-10-10',fingerprint:computeConfirmationFingerprint(context)};
  assert.equal(isConfirmationValidForLookup(confirmation,context),true);
  for(const change of [{shipmentId:'s2'},{evidenceFingerprint:computeSha256('e2')},{lookupFingerprint:computeSha256('l2')},{targetField:'header.unlading-port'},{datasetVersion:'v2'},{candidateCode:'3001'}])assert.equal(isConfirmationValidForLookup(confirmation,{...context,...change}),false);
  assert.equal(isConfirmationValidForLookup({...confirmation,shipmentId:undefined},context),false);
  assert.deepEqual(filterScopedConfirmations({a:confirmation,b:confirmation},{a:{...context,evidenceFingerprint:computeSha256('changed')},b:context}).invalidatedKeys,['a']);
});
