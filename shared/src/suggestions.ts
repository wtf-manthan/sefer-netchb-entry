import type {RawExtractedShipment} from './types/shipment';
import type {BrokerDecisions} from './types/decisions';
import type {SourceReference} from './types/field';
import {computeSha256} from './reference/fingerprint';
import {normalizeCountryCode} from './reference/countries';
export interface FilingSuggestion {id:string;target:string;value:string|number;label:string;reason:string;sources:SourceReference[];fingerprint:string}
const RULE_VERSION='prefill-1';
export function filingSuggestions(shipment:RawExtractedShipment):FilingSuggestion[]{
 const out:FilingSuggestion[]=[];
 const add=(id:string,target:string,value:string|number,label:string,reason:string,sources:SourceReference[])=>{
  if(!sources.length||sources.some(s=>!s.doc||!s.snippet))return;
  const payload={id,target,value,label,reason,sources};
  out.push({...payload,fingerprint:computeSha256(JSON.stringify([RULE_VERSION,shipment,payload]))});
 };
 // Explicit role candidates, never assume buyer or warehouse is the filing consignee.
 for(const i of shipment.invoices)for(const [role,p] of [['Buyer',i.buyer],['Delivery party',i.shipTo]] as const){
  if(p.name.value)add(i.id+'-'+role,'customsFiling.ultimateConsignee.name',p.name.value,role+': '+p.name.value,'Verify the ultimate-consignee role. Address: '+(p.address.value??'not supplied'),[p.name.source]);
 }
 for(const b of shipment.bills)if(b.consignee.name.value)add(b.id+'-consignee','customsFiling.ultimateConsignee.name',b.consignee.name.value,'B/L consignee: '+b.consignee.name.value,'Verify the filing role. Address: '+(b.consignee.address.value??'not supplied'),[b.consignee.name.source]);
 const ocean=/\b(ocean|vessel|sea)\b/i.test(shipment.modeOfTransport.value??'')||['10','11'].includes(shipment.modeOfTransport.value??'');
 if(ocean&&shipment.bills.length&&shipment.bills.every(b=>b.containerized.value!==null)&&new Set(shipment.bills.map(b=>b.containerized.value)).size===1){
  const containerized=shipment.bills[0].containerized.value;
  add('transport','customsFiling.modeOfTransport',containerized?'11':'10',containerized?'11 — Vessel, container':'10 — Vessel, non-container','Main transport and explicit containerization observations agree.',[shipment.modeOfTransport.source,...shipment.bills.map(b=>b.containerized.source)]);
 }
 for(const i of shipment.invoices){
  if(i.lineChargesIncluded.value!==null)add(i.id+'-charges','invoiceDecisions.'+i.id+'.valuationBasis',i.lineChargesIncluded.value?'LINE_VALUES_INCLUDE_CHARGES':'LINE_VALUES_EXCLUDE_CHARGES',i.lineChargesIncluded.value?'Line amounts include freight/insurance':'Line amounts exclude freight/insurance','Based on documented itemization, not the incoterm alone.',[i.lineChargesIncluded.source]);
  // An observed export country is already normalized by the resolver; only offer routing-derived fallback.
  if(!normalizeCountryCode(i.countryOfExport.value)&&shipment.bills.length){
   const countries=shipment.bills.map(b=>normalizeCountryCode(b.loadingPort.country.value));
   if(countries.every(Boolean)&&new Set(countries).size===1)add(i.id+'-export','invoiceDecisions.'+i.id+'.countryOfExport',countries[0]!,'Export country: '+countries[0],'All recorded loading countries agree. Verify routing for this invoice.',shipment.bills.map(b=>b.loadingPort.country.source));
  }
  for(const l of i.lines){
   if(l.assistAmount.value!==null&&l.assistAppliesToLine.value===true)add(l.id+'-assist','lineDecisions.'+l.id+'.assistAmount',l.assistAmount.value,'Assist: '+l.assistAmount.value+' '+(i.currency.value??''),'Document explicitly links the assist to this line. Confirm currency and allocation.',[l.assistAmount.source,l.assistAppliesToLine.source]);
   if(l.foc.value===true&&l.customsValue.value!==null)add(l.id+'-sample','lineDecisions.'+l.id+'.sampleValue',l.customsValue.value,'Sample customs value: '+l.customsValue.value+' '+(i.currency.value??''),'Customs-only value stated for this sample line; not its commercial price.',[l.customsValue.source]);
  }
 }
 return out;
}
export function decisionValue(decisions:BrokerDecisions,target:string):unknown{
 let value:any=decisions;for(const key of target.split('.')){if(!value||!Object.hasOwn(value,key))return undefined;value=value[key];}return value;
}
export function acceptFilingSuggestion(decisions:BrokerDecisions,s:FilingSuggestion):BrokerDecisions{
 if(!/^(customsFiling\.(modeOfTransport|ultimateConsignee\.name)|invoiceDecisions\.[A-Za-z0-9_-]+\.(countryOfExport|valuationBasis)|lineDecisions\.[A-Za-z0-9_-]+\.(assistAmount|sampleValue))$/.test(s.target)||s.target.split('.').some(k=>['__proto__','constructor','prototype'].includes(k)))throw new Error('Invalid suggestion target');
 const next=JSON.parse(JSON.stringify(decisions)) as BrokerDecisions;
 let object:any=next;const keys=s.target.split('.');
 for(const key of keys.slice(0,-1)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Invalid suggestion target');object=object[key]??(object[key]={});}
 object[keys.at(-1)!]=s.value;
 next.suggestionSelections[s.target]={id:s.id,fingerprint:s.fingerprint,value:s.value};
 next.customsFiling.referenceDataConfirmed=false;
 return next;
}
