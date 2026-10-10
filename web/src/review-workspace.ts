import {RawExtractedShipment,StructuredFinding,findingTarget} from '@sefer/shared';
export const REVIEW_SECTIONS=['Shipment','Parties','Invoices','Goods','Transport','Other checks'] as const;
export type ReviewSection=typeof REVIEW_SECTIONS[number];
export const fieldLabel=(key:string)=>({hsCode:'Document HS code',htsCode:'US HTS classification',foc:'Free of charge',manufacturerId:'Manufacturer ID',importerEin:'Importer tax ID',suretyCode:'Surety code',entryDate:'Entry date',entryType:'Entry type',processingPortCode:'Processing port',entryPortCode:'Entry port',unladingPortCode:'Port of unlading',foreignPortCode:'Foreign port',assistAmount:'Assist value',sampleValue:'Sample customs value',countryOfOrigin:'Country of origin',invoiceNo:'Invoice number',masterScac:'Master carrier SCAC',houseScac:'House carrier SCAC'}[key]??key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase()));
export function observationSection(path:string):ReviewSection {
 if(/\.(seller|buyer|shipTo)\./.test(path))return 'Parties';
 if(path.startsWith('bills.')||path==='modeOfTransport')return 'Transport';
 if(path.includes('.lines.')||path.startsWith('packingLists.'))return 'Goods';
 if(path.startsWith('invoices.'))return 'Invoices';
 return 'Shipment';
}
export function observationLabel(path:string,s:RawExtractedShipment):string {
 const parts=path.split('.');let context='';
 if(parts[0]==='invoices'){const inv=s.invoices[Number(parts[1])];context='Invoice '+(inv?.invoiceNo.value??Number(parts[1])+1);if(parts[2]==='lines')context+=' · Line '+inv?.lines[Number(parts[3])]?.lineNo;else if(['seller','buyer','shipTo'].includes(parts[2]))context+=' · '+fieldLabel(parts[2]);}
 if(parts[0]==='bills')context='Bill '+(Number(parts[1])+1);
 if(parts[0]==='packingLists')context='Packing list '+(Number(parts[1])+1)+' · Row '+(Number(parts[3])+1);
 return (context?context+' · ':'')+fieldLabel(parts.at(-1)!);
}
export function findingSection(f:StructuredFinding,shipment?:RawExtractedShipment):ReviewSection {
 const target=shipment?reviewFindingTarget(f,shipment):findingTarget(f);
 if(!target)return 'Other checks';
 if(target.startsWith('containerOverrides.'))return 'Transport';
 if(target.startsWith('lineDecisions.'))return 'Goods';
 if(target.startsWith('invoiceDecisions.'))return 'Invoices';
 if(target.startsWith('customsFiling.'))return (target.endsWith('modeOfTransport')||target.endsWith('grossWeightKg'))?'Transport':(target.endsWith('ultimateConsignee')||target.endsWith('relatedParty'))?'Parties':'Shipment';
 return observationSection(target);
}
export const uniqueFindings=(findings:StructuredFinding[])=>[...new Map(findings.map(f=>[f.id,f])).values()];
export interface EvidenceSelection {label:string;source:{doc:string|null;page:number|null;snippet:string|null}}
export interface LocalDocument {name:string;url:string;sha256:string}
export function matchDocument(doc:RawExtractedShipment['documents'][number],files:LocalDocument[]):LocalDocument|undefined {
 const matches=files.filter(f=>doc.sha256?f.sha256===doc.sha256:f.name===doc.name);
 return matches.length===1?matches[0]:undefined;
}

/** UI routing only; does not alter server findings or allow blockers to be acknowledged. */
export function reviewFindingTarget(f:StructuredFinding,s:RawExtractedShipment):string|undefined {
 const existing=findingTarget(f);if(existing)return existing;
 const invoice=s.invoices.findIndex(i=>i.id===(f.invoiceId??f.entityId));
 const fields:Record<string,string>={MISSING_CURRENCY:'currency',INVALID_CURRENCY:'currency',MISSING_INVOICE_NUMBER:'invoiceNo',INVOICE_NORMALIZATION:'invoiceNo',AMBIGUOUS_DATE:'invoiceDate',MISSING_EXPORT_DATE:'exportDate',INVOICE_TOTAL:'totalAmount',MISSING_CHARGES:'freight'};
 if(invoice>=0&&fields[f.code])return `invoices.${invoice}.${fields[f.code]}`;
 if(f.code==='CURRENCY_CONVERSION')return `invoiceDecisions.${f.invoiceId??f.entityId}.exchangeRateToUsd`;
 if(f.code==='GROSS_WEIGHT'||f.code==='WEIGHT_CONFLICT')return 'customsFiling.grossWeightKg';
 if(f.code==='INVALID_CONTAINER'||f.code==='CONTAINER_CORRECTION')return `containerOverrides.${f.entityId}`;
 return undefined;
}
