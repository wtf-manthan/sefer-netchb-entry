import { RawExtractedShipment, BrokerDecisions, StructuredFinding } from '@sefer/shared';
import { resolveShipment, summarize } from '../checks';
import { serializeResolvedEntry } from './xml-builder';
import { NetChbXmlValidator } from './xml-validator';
const validator=new NetChbXmlValidator();
export async function generateEntry(shipment:RawExtractedShipment,decisions:BrokerDecisions) {
  const {resolved,findings}=resolveShipment(shipment,decisions);
  let xml:string|null=null, errors:string[]=[];
  try {xml=serializeResolvedEntry(resolved);}catch(e){errors=[(e as Error).message];}
  const validation=xml?await validator.validate(xml):{valid:false,errors:errors.length?errors:['XML cannot be generated until required fields and values are resolved.']};
  if(!validation.valid)findings.push({id:'XML_VALIDATION',code:'XML_VALIDATION',severity:'BLOCKER',status:'open',blocking:true,message:'Resolve XML generation/schema errors.',evidence:validation.errors});
  const blockers=findings.filter(f=>f.blocking&&f.status==='open');
  const values=resolved.invoices.flatMap(i=>i.lines.map(l=>l.valueCents));
  return {
    success:true,correctionAudit:decisions.observationCorrections,xml,schemaValid:validation.valid,schemaErrors:validation.errors,
    readyToTransmit:validation.valid&&blockers.length===0,blockersCount:blockers.length,
    blockers,findings,summary:summarize(findings),resolved,
    totalEnteredValueUsd:values.every(v=>v!==null)?values.reduce<number>((a,v)=>a+v!,0)/100:null,
    totalHeaderChargesUsd:resolved.chargesCents===null?null:Math.round(resolved.chargesCents/100),
    grossWeightKg:resolved.grossWeightKg,
    readinessScope:'Local supported-profile checks only; not proof of NetCHB or CBP acceptance.',
  };
}
