import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {LookupResult, LookupResultSchema, computeLookupFingerprint} from '@sefer/shared';

const portSchema=z.object({code:z.string().regex(/^\d{5}$/),name:z.string().min(1),countryCode:z.string().regex(/^\d{4}$/),country:z.string().min(1),aliases:z.array(z.string().min(1))}).strict();
const manifestSchema=z.object({publisher:z.string(),url:z.string().url(),datasetVersion:z.string(),retrievedAt:z.string(),checksumSha256:z.string().regex(/^[a-f0-9]{64}$/),recordCount:z.number().int().positive()});
export const ScheduleKRequestSchema=z.object({query:z.string().trim().min(1).max(150),country:z.string().trim().min(1).max(100).optional()}).strict();
export type ScheduleKRequest=z.infer<typeof ScheduleKRequestSchema>;
const normalize=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const dataDirectory=resolve(__dirname,'../../data/reference/schedule-k');

/** Pinned, offline dataset; never reuse the task-1 full-result cache across shipment contexts. */
export function createScheduleKResolver(directory=dataDirectory) {
  return (input:ScheduleKRequest):LookupResult => {
    const request=ScheduleKRequestSchema.parse(input);
    const result:LookupResult={category:'schedule-k',targetField:'header.foreign-port',query:request.query,
      outcome:'unavailable',candidates:[],source:{publisher:'US Army Corps of Engineers',url:'https://ndclibrary.sec.usace.army.mil/',datasetVersion:'unavailable',retrievedAt:'2026-10-10'},
      matchingMethod:'normalized_name',rationale:'Reference dataset could not be verified.',missingFactsNeeded:['Restore a verified Schedule K dataset.'],codeVerifiedAgainstReference:false,userConfirmedForShipment:false,fingerprint:''};
    try {
      const manifest=manifestSchema.parse(JSON.parse(readFileSync(resolve(directory,'manifest.json'),'utf8')));
      const bytes=readFileSync(resolve(directory,'ports.json'));
      if(createHash('sha256').update(bytes).digest('hex')!==manifest.checksumSha256)throw new Error('Checksum mismatch');
      const ports=z.array(portSchema).parse(JSON.parse(bytes.toString('utf8')));
      if(ports.length!==manifest.recordCount || new Set(ports.map(p=>p.code)).size!==ports.length)throw new Error('Invalid record count');
      result.source={publisher:manifest.publisher,url:manifest.url,datasetVersion:manifest.datasetVersion,retrievedAt:manifest.retrievedAt};
      // Country hints are source country names, never presumed ISO mappings.
      const eligible=ports.filter(p=>!request.country||normalize(p.country)===normalize(request.country));
      const query=normalize(request.query);
      const numeric=/^\d+$/.test(query);
      let matches=eligible.filter(p=>numeric?p.code===query:normalize(p.name)===query||p.aliases.some(a=>normalize(a)===query));
      const exact=matches.length>0;
      result.matchingMethod=numeric?'exact_code':'normalized_name';
      if(!exact&&!numeric&&query.length>=3) {
        matches=eligible.filter(p=>[p.name,...p.aliases].some(n=>normalize(n).includes(query)));
        result.matchingMethod='hierarchical_search';
      } else if(matches.length===1&&normalize(matches[0].name)!==query&&!numeric)result.matchingMethod='alias';
      result.candidates=matches.map(p=>({code:p.code,label:`${p.name}, ${p.country}`,details:{
        country:p.country,sourceCountryCode:p.countryCode,aliases:p.aliases,
        countryHint:request.country??null,targetField:result.targetField,datasetChecksum:manifest.checksumSha256,
        isAggregate:/\ball other\b/i.test(p.name),
      }}));
      const aggregate=matches.some(p=>/\ball other\b/i.test(p.name));
      result.outcome=matches.length===0?'no_match':exact&&matches.length===1&&!aggregate?'exact_match':'candidates';
      result.codeVerifiedAgainstReference=matches.length>0;
      result.rationale=matches.length===0?'No match within the supplied country context; no code inferred.':
        aggregate?'Aggregate geographic code: review whether a specific port code applies.':
        result.outcome==='exact_match'?'Matched the pinned official list. Shipment applicability still needs user verification.':
        'Candidate matches only; select and verify the shipment port.';
      result.missingFactsNeeded=matches.length===0?['Provide the official foreign port name or five-digit Schedule K code; check the country name.']:
        result.outcome==='candidates'?['Verify the specific port and country against shipment evidence.']:[];
    } catch {
      // Fail closed on absent, corrupt, or incompatible reference data; no substitute mapping.
    }
    result.fingerprint=computeLookupFingerprint({category:result.category,query:result.query,datasetVersion:result.source.datasetVersion,candidates:result.candidates});
    return LookupResultSchema.parse(result);
  };
}
export const resolveScheduleKPort=createScheduleKResolver();
