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
  let draftXml:string|null=null,draftSchemaValid=false,draftSchemaErrors:string[]=[];
  try{
    const partial=serializeResolvedEntry(resolved,true);
    const note=('DRAFT - NOT READY TO TRANSMIT. Missing/unresolved due to: '+blockers.map(f=>f.code+': '+f.message).join(' | ')).replace(/--/g,'—').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ');
    draftXml=partial?.replace('?>','?>\n<!-- '+note+' -->')??null;
    const checked=draftXml?await validator.validate(draftXml):null;
    draftSchemaValid=checked?.valid??false;draftSchemaErrors=checked?.errors??[];
  }catch{draftSchemaErrors=['Draft could not be serialized; review invalid XML characters.'];}
  const values=resolved.invoices.flatMap(i=>i.lines.map(l=>l.valueCents));
  return {
    draftXml,draftSchemaValid,draftSchemaErrors,
    success:true,correctionAudit:decisions.observationCorrections,xml,schemaValid:validation.valid,schemaErrors:validation.errors,
    readyToTransmit:validation.valid&&blockers.length===0,blockersCount:blockers.length,
    blockers,findings,summary:summarize(findings),resolved,
    totalEnteredValueUsd:values.every(v=>v!==null)?values.reduce<number>((a,v)=>a+v!,0)/100:null,
    totalHeaderChargesUsd:resolved.chargesCents===null?null:Math.round(resolved.chargesCents/100),
    grossWeightKg:resolved.grossWeightKg,
    readinessScope:'Local supported-profile checks only; not proof of NetCHB or CBP acceptance.',
  };
}
