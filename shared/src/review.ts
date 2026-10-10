import {RawExtractedShipmentSchema} from './schemas/shipment.schema';
import {RawExtractedShipment} from './types/shipment';
import {BrokerDecisions} from './types/decisions';

/** Corrections are separate from immutable model observations and require cited evidence. */
export function applyObservationCorrections(original:RawExtractedShipment, corrections:BrokerDecisions['observationCorrections']) {
  const shipment=RawExtractedShipmentSchema.parse(original);
  for(const [path,correction] of Object.entries(corrections)) {
    const keys=path.split('.');
    if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw new Error('Invalid correction path');
    let parent:any=shipment;
    for(const key of keys.slice(0,-1)) {
      if(!parent||!Object.prototype.hasOwnProperty.call(parent,key))throw new Error('Unknown correction path: '+path);
      parent=parent[key];
    }
    const key=keys[keys.length-1],field=parent?.[key];
    if(!field||typeof field!=='object'||!('status' in field)||!('source' in field))throw new Error('Correction must target an observation: '+path);
    parent[key]=correction.value===null?{value:null,status:'missing',source:correction.source,confidence:0}:{value:correction.value,status:'inferred',source:correction.source,confidence:1};
  }
  return RawExtractedShipmentSchema.parse(shipment);
}
