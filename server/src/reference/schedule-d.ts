import {LookupResult,LookupResultSchema,ReferenceConfirmation,computeLookupFingerprint,isConfirmationValidForLookup} from '@sefer/shared';
import {SCHEDULE_D_METADATA,SCHEDULE_D_VALID} from '@sefer/shared/dist/reference/schedule-d.js';
import {PortRole,SUPPORTED_PORT_ROLES,normalizePortRole,getPortTargetField,searchScheduleDPorts,formatPortLabel} from '@sefer/shared/dist/reference/ports.js';
export * from '@sefer/shared/dist/reference/schedule-d.js';
export {PortRole,SUPPORTED_PORT_ROLES,normalizePortRole,isPortRoleSupported} from '@sefer/shared/dist/reference/ports.js';
export interface ScheduleDLookupOptions {role?:PortRole|string;stateHint?:string;userConfirmation?:ReferenceConfirmation;shipmentId?:string;evidenceFingerprint?:string}
export interface ScheduleDLookupRequest {query:string;role?:PortRole|string;stateHint?:string}
export function resolveScheduleDPort(input?:string|null|ScheduleDLookupRequest,options:ScheduleDLookupOptions={}):LookupResult {
  const request=typeof input==='object'&&input!==null?input:{query:input??''};
  const query=request.query,roleArg=request.role??options.role,role=normalizePortRole(roleArg);
  const hint=request.stateHint??options.stateHint;
  const result:LookupResult={category:'ports',targetField:getPortTargetField(role),query,outcome:'no_match',candidates:[],
    source:{publisher:SCHEDULE_D_METADATA.publisher,url:SCHEDULE_D_METADATA.sourceUrl,datasetVersion:SCHEDULE_D_METADATA.datasetVersion,retrievedAt:SCHEDULE_D_METADATA.retrievedAt},
    matchingMethod:'fallback_format',rationale:'Provide a supported port role and official port name or code.',missingFactsNeeded:['Specify a supported port role and official name or code.'],codeVerifiedAgainstReference:false,userConfirmedForShipment:false,fingerprint:''};
  if(!SCHEDULE_D_VALID){result.outcome='unavailable';result.rationale='Schedule D bundle checksum failed.';}
  else if(roleArg&&!role){result.rationale=`Port role ${roleArg} is not supported.`;}
  else {
    const found=searchScheduleDPorts(query,{stateHint:hint});
    result.matchingMethod=found.matchingMethod;
    result.candidates=found.candidates.map(p=>({code:p.code,label:formatPortLabel(p),details:{state:p.state||null,districtCode:p.districtCode,role:role??null,stateHint:hint??null,datasetChecksum:SCHEDULE_D_METADATA.checksumSha256}}));
    const special=found.candidates.some(p=>Number(p.districtCode)>=59);
    result.outcome=result.candidates.length===0?'no_match':found.isAmbiguous||special?'candidates':'exact_match';
    result.codeVerifiedAgainstReference=result.candidates.length>0;
    result.rationale=result.outcome==='no_match'?'No match in the supplied state context; no alias or code invented.':result.outcome==='candidates'?'Select a specific port; partial, ambiguous or special reporting codes require review.':'Matched the pinned Census reference. Verify shipment applicability.';
    result.missingFactsNeeded=result.outcome==='exact_match'?[]:['Provide the full official port name, state, or four-digit code; review special reporting codes.'];
  }
  result.fingerprint=computeLookupFingerprint({category:result.category,query,datasetVersion:result.source.datasetVersion,candidates:result.candidates});
  if(options.userConfirmation&&role&&result.outcome==='exact_match')result.userConfirmedForShipment=isConfirmationValidForLookup(options.userConfirmation,{category:result.category,targetField:result.targetField,query,datasetVersion:result.source.datasetVersion,candidateCode:result.candidates[0].code,shipmentId:options.shipmentId,evidenceFingerprint:options.evidenceFingerprint,lookupFingerprint:result.fingerprint});
  return LookupResultSchema.parse(result);
}
