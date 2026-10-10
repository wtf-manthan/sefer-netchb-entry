import {RawExtractedShipment,BrokerDecisions,PortLookupRequest,PortLookupRequestSchema,applyObservationCorrections,computeSha256,StructuredFinding} from '@sefer/shared';
import {resolveScheduleDPort} from './schedule-d';
import {resolveScheduleKPort} from './schedule-k';
const roles={processingPortCode:'processing-port',entryPortCode:'entry-port',unladingPortCode:'unlading-port'};
export function lookupPortForShipment(shipment:RawExtractedShipment,decisions:BrokerDecisions,input:PortLookupRequest){
  const request=PortLookupRequestSchema.parse(input);
  const effective=applyObservationCorrections(shipment,decisions.observationCorrections);
  const result=request.target==='foreignPortCode'?resolveScheduleKPort({query:request.query,country:request.country}):resolveScheduleDPort(request.query,{role:roles[request.target],stateHint:request.stateHint});
  return {request,result,evidenceFingerprint:computeSha256(JSON.stringify(effective))};
}
/** Recompute on every generation; the browser's fingerprint never establishes validity itself. */
export function validatePortSelections(shipment:RawExtractedShipment,decisions:BrokerDecisions):StructuredFinding[]{
  const findings:StructuredFinding[]=[];
  for(const [target,selection] of Object.entries(decisions.portSelections)){
    if(!selection)continue;
    const field=target as keyof typeof decisions.portSelections;
    const lookup=lookupPortForShipment(shipment,decisions,selection.request);
    const valid=selection.request.target===target&&selection.evidenceFingerprint===lookup.evidenceFingerprint&&selection.lookupFingerprint===lookup.result.fingerprint&&
      !['no_match','unavailable','stale'].includes(lookup.result.outcome)&&lookup.result.candidates.some(c=>c.code===selection.candidateCode)&&decisions.customsFiling[field]===selection.candidateCode;
    if(!valid){
      delete decisions.customsFiling[field];decisions.customsFiling.referenceDataConfirmed=false;
      findings.push({id:'STALE_PORT_SELECTION:'+target,code:'STALE_PORT_SELECTION',entityId:target,severity:'BLOCKER',status:'open',blocking:true,message:'This port selection no longer matches the shipment, reference data, or field value. Look up and verify it again, or remove it and enter a reviewed code.',evidence:[]});
    }
  }
  return findings;
}
