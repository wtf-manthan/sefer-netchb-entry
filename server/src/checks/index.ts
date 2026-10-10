import { createHash } from 'crypto';
import { RawExtractedShipment, BrokerDecisions, BrokerDecisionsSchema, RawExtractedShipmentSchema, StructuredFinding, normalizeUom, normalizeCountryCode, applyObservationCorrections } from '@sefer/shared';
import { validateContainerNumber } from './iso6346';
import { cents, allocateCents } from './money';
import {validatePortSelections} from '../reference/port-workflow';
export interface ResolvedLine {id:string; quantity:number|null; origin:string|null; mid:string|null; hts:string|null; valueCents:number|null; reporting:{quantity:number;unit:string}[]}
export interface ResolvedInvoice {id:string; invoiceNo:string|null; currency:string|null; lines:ResolvedLine[]; countryExport:string|null; exportDate:string|null}
export interface ResolvedEntry {
  filing:BrokerDecisions['customsFiling']; mode:string|null; grossWeightKg:number|null; chargesCents:number|null;
  invoices:ResolvedInvoice[];
  bills:{id:string;masterScac:string|null;masterBill:string|null;houseScac:string|null;houseBill:string|null;packages:number|null;unit:string|null;vessel:string|null;voyage:string|null}[];
  containers:{id:string;number:string|null;seal:string|null}[];
}
export function resolveShipment(input:RawExtractedShipment, choices:BrokerDecisions) {
  const decisions=BrokerDecisionsSchema.parse(choices);
  const shipment=applyObservationCorrections(RawExtractedShipmentSchema.parse(input),decisions.observationCorrections);
  const findings:StructuredFinding[]=validatePortSelections(input,decisions);
  const add=(code:string,entity:string,message:string,severity:StructuredFinding['severity']='BLOCKER',resolved=false,evidence:string[]=[],refs:Partial<StructuredFinding>={})=>{
    const fingerprint=createHash('sha256').update(JSON.stringify(evidence)).digest('hex').slice(0,12);
    const id=code+':'+entity+':'+fingerprint;
    const acknowledgement=severity==='VERIFY'?decisions.acknowledgements[id]:undefined;
    findings.push({id,code,severity,message,status:resolved||acknowledgement?'resolved':'open',blocking:severity!=='INFO',evidence,entityId:entity,...refs,...(acknowledgement?{resolution:acknowledgement}:{})});
  };
  // Inferences and uncertain observations require evidence review, not automatic promotion to facts.
  const reviewEvidence=(value:unknown,location:string):void=>{
    if(!value||typeof value!=='object')return;
    const f=value as {status?:string;confidence?:number;value?:unknown;source?:unknown};
    if(f.status){
      if(decisions.observationCorrections[location.replace(/^shipment\./,'')])return;
      if(f.status==='inferred'||(f.status==='extracted'&&(f.confidence??0)<0.8))
        add('EVIDENCE_REVIEW',location,'Review '+location.replace(/^shipment\./,'')+' against its source.','VERIFY',false,[JSON.stringify(f.value),JSON.stringify(f.source)]);
      return;
    }
    Object.entries(value).forEach(([key,child])=>reviewEvidence(child,location+'.'+key));
  };
  reviewEvidence(shipment,'shipment');
  const lineIds=new Set(shipment.invoices.flatMap(i=>i.lines.map(l=>l.id)));
  const invoiceIds=new Set(shipment.invoices.map(i=>i.id));
  const containerIds=new Set(shipment.bills.flatMap(b=>b.containers.map(c=>c.id)));
  for(const [map,ids] of [[decisions.lineDecisions,lineIds],[decisions.invoiceDecisions,invoiceIds],[decisions.containerOverrides,containerIds]] as const)
    for(const id of Object.keys(map))if(!ids.has(id))throw new Error('Decision references unknown entity: '+id);
  const filing=decisions.customsFiling;
  for(const key of ['importerEin','bondType','suretyCode','entryDate','entryType','processingPortCode','entryPortCode','unladingPortCode','foreignPortCode','ultimateConsignee'] as const)
    if(filing[key]===undefined&&!findings.some(f=>f.code==='STALE_PORT_SELECTION'&&f.entityId===key))add('MISSING_FILING',key,'Provide '+key+'.');
  if(filing.relatedParty===undefined)add('RELATED_PARTY','shipment','Confirm related-party status.');
  if(!filing.referenceDataConfirmed)add('REFERENCE_REVIEW','shipment','Broker must confirm selected classifications, reporting units, ports and manufacturer identifiers against authoritative references.');
  const mode=filing.modeOfTransport??shipment.modeOfTransport.value;
  // Phase 1 emits an ocean formal-consumption entry only. Other modes/types remain explicit blockers.
  if(!mode || !['10','11'].includes(mode))add('UNSUPPORTED_MODE','shipment','Only ocean modes 10 and 11 are implemented; select or review transport mode.');
  if(filing.entryType && filing.entryType!=='01')add('UNSUPPORTED_ENTRY','shipment','Only entry type 01 is implemented.');
  if(shipment.bills.length===0)add('MISSING_BILL','shipment','Provide transport document data.');
  const rows=shipment.packingLists.flatMap(p=>p.rows), usedRows=new Set<string>();
  const invoices:ResolvedInvoice[]=[];
  let chargesCents:number|null=0;
  for(const invoice of shipment.invoices) {
    const invoiceChoice=decisions.invoiceDecisions[invoice.id]??{};
    const currency=invoice.currency.value?.toUpperCase()??null;
    let rate:number|null=currency==='USD'?1:invoiceChoice.exchangeRateToUsd??null;
    if(!currency){add('MISSING_CURRENCY',invoice.id,'Invoice currency is missing.');rate=null;}
    if(currency && currency!=='USD' && !/^[A-Z]{3}$/.test(currency)) {add('INVALID_CURRENCY',invoice.id,'Resolve the currency to an authoritative three-letter code.');rate=null;}
    if(rate===null)add('CURRENCY_CONVERSION',invoice.id,'Provide a reviewed conversion rate to USD.', 'BLOCKER',false,[String(currency)],{invoiceId:invoice.id});
    const freight=invoice.freight.value, insurance=invoice.insurance.value;
    const invoiceCharges=freight!==null&&insurance!==null&&rate!==null?cents(freight,rate)+cents(insurance,rate):null;
    if(invoiceCharges===null){chargesCents=null;add('MISSING_CHARGES',invoice.id,'Confirm freight and insurance, including explicit zero when applicable.');}
    else if(chargesCents!==null)chargesCents+=invoiceCharges;
    const basis=invoiceChoice.valuationBasis;
    if(!basis)add('VALUATION_BASIS',invoice.id,'Confirm whether line amounts already include freight and insurance.','NEEDS_DECISION',false,[],{invoiceId:invoice.id});
    let invoiceNo=invoice.invoiceNo.value;
    if(invoiceNo) {
      const normalized=invoiceNo.replace(/[^A-Za-z0-9-]/g,'-').slice(0,17);
      if(normalized!==invoiceNo)add('INVOICE_NORMALIZATION',invoice.id,'Review the normalized invoice number.','VERIFY',false,[invoiceNo,normalized],{invoiceId:invoice.id});
      invoiceNo=normalized;
    } else add('MISSING_INVOICE_NUMBER',invoice.id,'Provide invoice number.');
    if(invoice.invoiceDateRaw.value && /^(\d{1,2})\/(\d{1,2})\/\d{4}$/.test(invoice.invoiceDateRaw.value)) {
      const [a,b]=invoice.invoiceDateRaw.value.split('/').map(Number);
      if(a!==b&&a>=1&&a<=12&&b>=1&&b<=12)add('AMBIGUOUS_DATE',invoice.id,'Confirm the document date interpretation; no date convention is assumed.','VERIFY',false,[invoice.invoiceDateRaw.value,invoice.invoiceDate.value??'missing']);
    }
    const remarks=(invoice.remarks.value??[]).join(' ');
    const assistSignal=/buyer[\s-]supplied|customer[\s-]furnished|free[\s-]issue|\bCMT\b|\bassist\b/i;
    if(assistSignal.test(remarks)) {
      if(!invoice.lines.some(l=>decisions.lineDecisions[l.id]?.assistAmount!==undefined))
        add('ASSIST_ALLOCATION_REQUIRED',invoice.id,'Assign a reviewed assist amount to the affected line(s); no amount or allocation is assumed.');
      add('ASSIST_ALLOCATION',invoice.id,'Review invoice-level assist evidence and confirm allocation to affected lines.','VERIFY',false,[remarks,JSON.stringify(invoice.lines.map(l=>[l.id,decisions.lineDecisions[l.id]?.assistAmount??l.assistAmount.value]))],{invoiceId:invoice.id});
    }
    const resolvedLines:ResolvedLine[]=[];
    const chargeWeights:number[]=[];
    for(const line of invoice.lines) {
      const d=decisions.lineDecisions[line.id]??{}, refs={invoiceId:invoice.id,lineId:line.id};
      const candidates=rows.filter(r=>{
        if(r.lineId)return r.lineId===line.id;
        if(r.invoiceId && r.invoiceId!==invoice.id)return false;
        if(!line.style.value||r.style.value!==line.style.value)return false;
        const peers=shipment.invoices.filter(i=>!r.invoiceId||i.id===r.invoiceId).flatMap(i=>i.lines).filter(l=>l.style.value===r.style.value);
        return peers.length===1;
      });
      candidates.forEach(r=>usedRows.add(r.id));
      // Compare commercial units only; no piece/dozen/weight conversions are inferred.
      const invoiceUnit=normalizeUom(line.unit.value);
      const sameUnit=invoiceUnit!==null&&candidates.every(r=>normalizeUom(r.unit.value)===invoiceUnit);
      const packed=candidates.length&&sameUnit&&candidates.every(r=>r.quantity.value!==null)?candidates.reduce((a,r)=>a+r.quantity.value!,0):null;
      if(candidates.length&&!sameUnit)add('UNIT_CONFLICT',line.id,'Packing and invoice quantities use missing or different units; reconcile manually.','BLOCKER',false,candidates.map(r=>String(r.unit.value)),refs);
      let quantity=line.quantity.value;
      if(d.quantityChoice==='CUSTOM')quantity=d.customQuantity??null;
      if(d.quantityChoice==='PACKED')quantity=packed;
      if(quantity===null)add('MISSING_QUANTITY',line.id,'Resolve the quantity.','BLOCKER',false,[],refs);
      if(packed!==null&&line.quantity.value!==null&&packed!==line.quantity.value)add('QUANTITY_CONFLICT',line.id,'Choose packed, invoiced, or a documented custom quantity.','NEEDS_DECISION',!!d.quantityChoice,[String(line.quantity.value),String(packed)],{...refs,candidates:{invoiced:line.quantity.value,packed}});
      const computed=quantity!==null&&line.unitPrice.value!==null?cents(quantity,line.unitPrice.value):null;
      const printed=line.amountAsPrinted.value!==null?cents(line.amountAsPrinted.value):null;
      const originalComputed=line.quantity.value!==null&&line.unitPrice.value!==null?cents(line.quantity.value,line.unitPrice.value):null;
      const mismatch=originalComputed!==null&&printed!==null&&originalComputed!==printed;
      const changedQuantity=quantity!==line.quantity.value;
      if(mismatch||changedQuantity)add('VALUE_CHOICE',line.id,'Choose the printed value or value computed from the selected quantity.','NEEDS_DECISION',!!d.mathChoice,[String(computed),String(printed)],{...refs,candidates:{computed:(computed??0)/100,printed:(printed??0)/100}});
      let amount=d.mathChoice==='PRINTED'?printed:d.mathChoice==='COMPUTED'?computed:mismatch||changedQuantity?null:printed??computed;
      const sample=line.foc.value===true||/\b(sample|samples|FOC)\b/i.test([line.description.value,line.notes.value].join(' '))||line.unitPrice.value===0||line.amountAsPrinted.value===0;
      if(sample) {
        add('SAMPLE_VALUE',line.id,'Confirm the customs value of this free/sample line; no nominal value is assumed.','NEEDS_DECISION',d.sampleValue!==undefined,[String(line.customsValue.value)],refs);
        amount=d.sampleValue===undefined?null:cents(d.sampleValue);
        if(d.sampleValue===0)add('ZERO_SAMPLE_VALUE',line.id,'Document the basis for declaring zero customs value.','VERIFY',false,[JSON.stringify(line),String(d.sampleValue)],refs);
      }
      // Only commercial base values absorb charges. Assists and customs-only sample values do not.
      chargeWeights.push(!sample&&amount!==null&&rate!==null?cents(amount/100,rate):0);
      const hasAssist=assistSignal.test(line.notes.value??'')||line.assistAmount.value!==null;
      if(hasAssist)add('ASSIST_VALUE',line.id,'Confirm the assist amount, including zero only with a documented basis.','NEEDS_DECISION',d.assistAmount!==undefined,[line.notes.value??'',String(line.assistAmount.value)],refs);
      if(d.assistAmount!==undefined&&amount!==null)amount+=cents(d.assistAmount);
      if(amount===null&&!(sample&&d.sampleValue===undefined)&&!((mismatch||changedQuantity)&&!d.mathChoice))add('MISSING_VALUE',line.id,'Resolve the line value before generating XML.','BLOCKER',false,[],refs);
      const rawOrigin=line.countryOfOrigin.value??invoice.countryOfOrigin.value;
      const origin=d.countryOfOrigin??normalizeCountryCode(rawOrigin);
      if(!origin||!/^[A-Z]{2}$/.test(origin))add('MISSING_ORIGIN',line.id,'Provide a reviewed two-letter country of origin.','BLOCKER',false,[String(rawOrigin)],refs);
      if(line.countryOfOrigin.value&&invoice.countryOfOrigin.value&&
        (normalizeCountryCode(line.countryOfOrigin.value)??line.countryOfOrigin.value.trim().toUpperCase())!==
        (normalizeCountryCode(invoice.countryOfOrigin.value)??invoice.countryOfOrigin.value.trim().toUpperCase()))
        add('ORIGIN_CONFLICT',line.id,'Confirm this line origin differs from the invoice header.','NEEDS_DECISION',d.countryOfOrigin!==undefined,[line.countryOfOrigin.value,invoice.countryOfOrigin.value],refs);
      const mid=d.manufacturerId??line.manufacturerId.value;
      if(!mid)add('MISSING_MID',line.id,'Provide the reviewed manufacturer identifier.','BLOCKER',false,[],refs);
      const hts=d.htsCode??line.hsCode.value?.replace(/[.\s]/g,'')??null;
      if(!hts||!/^\d{10}$/.test(hts))add('MISSING_HTS',line.id,'Select and confirm a complete ten-digit classification.','BLOCKER',false,[String(hts)],refs);
      if(!d.reportingQuantities)add('REPORTING_QUANTITIES',line.id,'Provide the statistical quantities and units required by the selected classification.','BLOCKER',false,[],refs);
      for(const row of candidates)if(line.material.value&&row.description.value&&/\d/.test(line.material.value)&&/\d/.test(row.description.value))
        if(line.material.value.trim().toUpperCase()!==row.description.value.trim().toUpperCase())
          add('MATERIAL_REVIEW',line.id+'-'+row.id,'Invoice material and packing description use different text. Compare composition; wording differences alone do not prove a conflict.','VERIFY',false,[line.material.value,row.description.value],refs);
      resolvedLines.push({id:line.id,quantity,origin,mid,hts,valueCents:amount!==null&&rate!==null?cents(amount/100,rate):null,reporting:d.reportingQuantities??[]});
    }
    if(basis==='LINE_VALUES_INCLUDE_CHARGES'&&invoiceCharges!==null&&resolvedLines.every(l=>l.valueCents!==null)) {
      const sum=chargeWeights.reduce((a,w)=>a+w,0);
      if(sum<invoiceCharges||sum===0&&invoiceCharges>0)add('CHARGES_EXCEED_VALUE',invoice.id,'Charges exceed the merchandise amounts; resolve the valuation basis.');
      else if(invoiceCharges>0) {
        const allocations=allocateCents(invoiceCharges,chargeWeights);
        resolvedLines.forEach((l,i)=>l.valueCents!-=allocations[i]);
      }
    }
    const commercialLines=invoice.lines.filter(l=>l.foc.value!==true&&l.amountAsPrinted.value!==null);
    if(invoice.totalAmount.value!==null&&freight!==null&&insurance!==null&&basis&&commercialLines.length) {
      const sum=commercialLines.reduce((a,l)=>a+cents(l.amountAsPrinted.value!),0)+(basis==='LINE_VALUES_EXCLUDE_CHARGES'?cents(freight)+cents(insurance):0);
      if(sum!==cents(invoice.totalAmount.value))add('INVOICE_TOTAL',invoice.id,'Printed line totals do not reconcile to the invoice total under the selected valuation basis.','VERIFY',false,[String(sum/100),String(invoice.totalAmount.value)]);
    }
    const exportCountry=invoiceChoice.countryOfExport??normalizeCountryCode(invoice.countryOfExport.value);
    if(!exportCountry)add('MISSING_EXPORT_COUNTRY',invoice.id,'Provide a recognized country of export separately from origin.','BLOCKER',false,[String(invoice.countryOfExport.value)]);
    if(!invoice.exportDate.value)add('MISSING_EXPORT_DATE',invoice.id,'Provide export date.');
    invoices.push({id:invoice.id,invoiceNo,currency,lines:resolvedLines,countryExport:exportCountry,exportDate:invoice.exportDate.value});
  }
  for(const row of rows)if(!usedRows.has(row.id))add('UNMATCHED_PACKING_ROW',row.id,'Packing row could not be uniquely matched to an invoice line. Supply explicit invoice/line IDs.','BLOCKER',false,[row.style.value??'missing']);
  const numbers=invoices.map(i=>i.invoiceNo);
  if(new Set(numbers).size!==numbers.length)add('INVOICE_COLLISION','shipment','Invoice numbers collide after normalization.');
  const bills=shipment.bills.map(b=>{
    if(b.packages.value===null||!Number.isInteger(b.packages.value)||!b.packageUnit.value)add('MANIFEST_PACKAGES',b.id,'Resolve manifest package count and unit.');
    if(!b.masterBill.value||!b.masterScac.value)add('MASTER_BILL',b.id,'Provide master bill and its carrier SCAC.');
    if(b.houseBill.value&&!b.houseScac.value)add('HOUSE_SCAC',b.id,'Provide the house carrier SCAC separately.');
    return {id:b.id,masterScac:b.masterScac.value,masterBill:b.masterBill.value,houseScac:b.houseScac.value,houseBill:b.houseBill.value,packages:b.packages.value,unit:b.packageUnit.value,vessel:b.vessel.value,voyage:b.voyage.value};
  });
  const containers=shipment.bills.flatMap(b=>b.containers.map(c=>{
    const number=decisions.containerOverrides[c.id]??c.number.value;
    if(!number||!validateContainerNumber(number).isValid)add('INVALID_CONTAINER',c.id,'Resolve the invalid or missing container number.','BLOCKER',false,[String(number)]);
    if(c.printedNumber.value&&c.printedNumber.value!==number)add('CONTAINER_CORRECTION',c.id,'Verify the corrected container against the document.','VERIFY',!!decisions.containerOverrides[c.id],[c.printedNumber.value,String(number)]);
    return {id:c.id,number:number?validateContainerNumber(number).normalized:null,seal:c.seal.value};
  }));
  const containerNumbers=containers.map(c=>c.number).filter(n=>n!==null);
  if(new Set(containerNumbers).size!==containerNumbers.length)add('DUPLICATE_CONTAINER','shipment','Container numbers repeat across bills; reconcile their grouping before export.');
  if(mode==='11'&&!containers.length)add('MISSING_CONTAINER','shipment','Containerized ocean transport requires container data.');
  const weights=shipment.bills.map(b=>b.grossWeightKg.value);
  // Bill weights can overlap in consolidations. Multiple bills require a reviewed aggregate.
  const grossWeightKg=filing.grossWeightKg??(weights.length===1?weights[0]:null);
  if(grossWeightKg===null)add('GROSS_WEIGHT','shipment','Provide the reviewed aggregate gross weight.');
  const plWeights=rows.map(r=>r.grossWeightKg.value);
  if(plWeights.length&&plWeights.every(w=>w!==null)&&grossWeightKg!==null) {
    const packedWeight=plWeights.reduce<number>((a,w)=>a+w!,0);
    if(Math.abs(packedWeight-grossWeightKg)>0.5)add('WEIGHT_CONFLICT','shipment','Verify the manifest versus packing gross weight.','VERIFY',false,[String(packedWeight),String(grossWeightKg)]);
  }
  if(new Set(bills.map(b=>b.vessel)).size>1||new Set(bills.map(b=>b.voyage)).size>1)add('TRANSPORT_CONFLICT','shipment','Multiple vessels or voyages require separate entries or further review.');
  if(bills.some(b=>!b.vessel||!b.voyage))add('MISSING_VESSEL','shipment','Provide the ocean vessel and voyage.');
  const resolved:ResolvedEntry={filing,mode,grossWeightKg,chargesCents,invoices,bills,containers};
  return {resolved,findings};
}
export function summarize(findings:StructuredFinding[]) {
  const open=findings.filter(f=>f.status==='open');
  return {total:findings.length,blockers:open.filter(f=>f.blocking).length,needsDecision:open.filter(f=>f.severity==='NEEDS_DECISION').length,verify:open.filter(f=>f.severity==='VERIFY').length,info:open.filter(f=>f.severity==='INFO').length};
}
