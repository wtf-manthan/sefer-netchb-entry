import fs from 'node:fs';
import path from 'node:path';
import {IsoDateTimeOrDateSchema,computeSha256,computeConfirmationFingerprint,isConfirmationValidForLookup} from '../../shared/src';
import {resolveScheduleDPort} from '../../server/src/reference/schedule-d';
import {ReferenceDiskCache} from '../../server/src/reference/cache';
const cache=new ReferenceDiskCache(path.resolve('.cache/reference-audit/probe'),{targetField:'header.entry-port',contextFingerprint:computeSha256('audit-no-hints')});
const entry=resolveScheduleDPort('Tacoma',{role:'entry-port'}),unlading=resolveScheduleDPort('Tacoma',{role:'unlading-port'});
cache.set(entry.category,entry.query,entry.source.datasetVersion,entry);
let crossRoleWriteRejected=false;
try {cache.set(unlading.category,unlading.query,unlading.source.datasetVersion,unlading);}catch{crossRoleWriteRejected=true;}
const context={category:'ports',targetField:'header.entry-port',query:'Tacoma',datasetVersion:'v1',candidateCode:'3002'};
const confirmation={...context,confirmedAt:'2026-10-10',fingerprint:computeConfirmationFingerprint(context)};
const report={invalidCalendarDateAccepted:IsoDateTimeOrDateSchema.safeParse('2026-02-30').success,crossRoleWriteRejected,cacheRoleAfterSecondWrite:cache.get(entry.category,entry.query,entry.source.datasetVersion)?.targetField,exactCodeWithConflictingState:resolveScheduleDPort('3002',{stateHint:'NY'}).outcome,legacyConfirmationAccepted:isConfirmationValidForLookup(confirmation,context),limestone:resolveScheduleDPort('Limestone').candidates.map(c=>c.code),ohare:resolveScheduleDPort('ORD').candidates.map(c=>c.code)};
console.log(JSON.stringify(report,null,2));fs.mkdirSync('.cache/reference-audit',{recursive:true});fs.writeFileSync('.cache/reference-audit/findings.json',JSON.stringify(report,null,2));
