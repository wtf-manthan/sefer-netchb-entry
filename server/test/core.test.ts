import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {RawExtractedShipmentSchema,BrokerDecisionsSchema,emptyDecisions,missingField,normalizeCountryCode,normalizeCurrency,normalizeUom} from '@sefer/shared';
import {fixture,field} from './fixtures';
import {generateEntry} from '../src/builder/entry-service';
import {resolveShipment} from '../src/checks';
import {validateContainerNumber,calculateIso6346CheckDigit} from '../src/checks/iso6346';
import {cents,allocateCents} from '../src/checks/money';
import {loadDemoShipment} from '../src/extraction/demo';
import {ExtractionDiskCache} from '../src/extraction/cache';
import {lookupHtsCode} from '../src/reference/hts';
test('independent synthetic shipment produces schema-valid XML with zero charges',async()=>{
 const {shipment,decisions}=fixture(),r=await generateEntry(shipment,decisions);
 assert.equal(r.schemaValid,true,JSON.stringify(r.schemaErrors));assert.equal(r.readyToTransmit,true);assert.equal(r.totalHeaderChargesUsd,0);assert.equal(r.totalEnteredValueUsd,20);
 assert.match(r.xml!,/<master-scac>AAAA/);assert.match(r.xml!,/<house-scac>BBBB/);assert.match(r.xml!,/<invoice-quantity>10/);assert.match(r.xml!,/<unit-of-measure1>NO/);
 assert.match(r.xml!,/<mode-transportation>10/);assert.match(r.xml!,/<vessel-name>TEST VESSEL/);assert.match(r.xml!,/<lading-port>12345/);
 console.log('Synthetic entry: schemaValid='+r.schemaValid+', readyToTransmit='+r.readyToTransmit+', charges='+r.totalHeaderChargesUsd);
});
test('empty decisions stay unresolved; no demo credentials or missing-value substitution',async()=>{
 const {shipment}=fixture();shipment.invoices[0].freight=missingField();shipment.bills[0].grossWeightKg=missingField();
 const r=await generateEntry(shipment,emptyDecisions());assert.equal(r.xml,null);assert.equal(r.readyToTransmit,false);assert.equal(r.totalHeaderChargesUsd,null);assert.equal(r.grossWeightKg,null);
 assert.ok(r.findings.some(f=>f.code==='MISSING_FILING'));
});
test('missing fields are null with zero confidence; invalid provenance/status combinations rejected',()=>{
 const {shipment}=fixture();assert.equal(shipment.invoices[0].seller.name.value,null);
 assert.equal(RawExtractedShipmentSchema.safeParse({...shipment,modeOfTransport:{...field('11'),status:'missing'}}).success,false);
 const invalid=structuredClone(shipment);invalid.invoices[0].invoiceNo.source.doc='unknown';assert.equal(RawExtractedShipmentSchema.safeParse(invalid).success,false);
});
test('invalid and duplicate IDs and calendar dates are rejected',()=>{
 const {shipment}=fixture();shipment.invoices[0].lines.push({...shipment.invoices[0].lines[0]});
 assert.equal(RawExtractedShipmentSchema.safeParse(shipment).success,false);
 for(const entryDate of ['NOT-A-DATE','2026-02-30'])assert.equal(BrokerDecisionsSchema.safeParse({customsFiling:{entryDate}}).success,false);
 assert.equal(BrokerDecisionsSchema.safeParse({lineDecisions:{constructor:{}}}).success,false);
});
test('math decision binds to an arbitrary line, not line 1',async()=>{
 const {shipment,decisions}=fixture();shipment.invoices[0].lines[0].amountAsPrinted=field(19);
 let r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,false);assert.ok(r.findings.some(f=>f.lineId==='line-z'&&f.code==='VALUE_CHOICE'));
 decisions.lineDecisions['line-z'].mathChoice='PRINTED';r=await generateEntry(shipment,decisions);assert.equal(r.totalEnteredValueUsd,19);
 decisions.lineDecisions['line-z'].mathChoice='COMPUTED';r=await generateEntry(shipment,decisions);assert.equal(r.totalEnteredValueUsd,20);
});
test('packing rows aggregate; custom quantity zero is respected',async()=>{
 const {shipment,decisions}=fixture();
 shipment.packingLists=[{id:'pl-a',documentId:'doc-a',rows:[3,4].map((n,i)=>RawExtractedShipmentSchema.parse({...shipment,packingLists:[{id:'pl-temp',documentId:'doc-a',rows:[{id:'row-'+i,invoiceId:'inv-a',lineId:'line-z',style:field('WIDGET'),quantity:field(n),unit:field('NO')}]}]}).packingLists[0].rows[0])}];
 decisions.lineDecisions['line-z']={...decisions.lineDecisions['line-z'],quantityChoice:'PACKED',mathChoice:'COMPUTED'};
 let r=await generateEntry(shipment,decisions);assert.equal(r.totalEnteredValueUsd,14);assert.match(r.xml!,/<invoice-quantity>7/);
 decisions.lineDecisions['line-z'].quantityChoice='CUSTOM';decisions.lineDecisions['line-z'].customQuantity=0;
 r=await generateEntry(shipment,decisions);assert.equal(r.totalEnteredValueUsd,0);
});
test('repeated styles are not silently joined to the wrong invoice line',()=>{
 const {shipment,decisions}=fixture();
 shipment.invoices[0].lines.push({...shipment.invoices[0].lines[0],id:'line-other',lineNo:18});
 const s=RawExtractedShipmentSchema.parse({...shipment,packingLists:[{id:'pl-a',documentId:'doc-a',rows:[{id:'row-a',invoiceId:null,lineId:null,style:field('WIDGET'),quantity:field(10),unit:field('NO')}]}]});
 assert.ok(resolveShipment(s,decisions).findings.some(f=>f.code==='UNMATCHED_PACKING_ROW'));
});
test('6, 7, 8, 9, 11 digit classifications all block readiness',async()=>{
 for(const n of [6,7,8,9,11]){
  const {shipment,decisions}=fixture();shipment.invoices[0].lines[0].hsCode=field('1'.repeat(n));
  const r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,false);assert.ok(r.findings.some(f=>f.code==='MISSING_HTS'));
 }
});
test('unknown assist and sample values never get nominal/sample amounts',async()=>{
 const {shipment,decisions}=fixture(),line=shipment.invoices[0].lines[0];
 line.notes=field('Buyer-supplied tooling; value not stated.');line.foc=field(true);line.unitPrice=field(0);line.amountAsPrinted=field(0);
 const r=await generateEntry(shipment,decisions);assert.equal(r.totalEnteredValueUsd,null);
 assert.ok(r.findings.some(f=>f.code==='ASSIST_VALUE'&&f.status==='open'));assert.ok(r.findings.some(f=>f.code==='SAMPLE_VALUE'&&f.status==='open'));
 decisions.lineDecisions[line.id].sampleValue=12;decisions.lineDecisions[line.id].assistAmount=3;
 assert.equal((await generateEntry(shipment,decisions)).totalEnteredValueUsd,15);
});
test('invalid corrected container remains a blocker; malformed owner/serial rejected',async()=>{
 const {shipment,decisions}=fixture();shipment.modeOfTransport=field('11');
 const prefix='TSTU123456',good=prefix+calculateIso6346CheckDigit(prefix),bad=prefix+((Number(good.at(-1))+1)%10);
 shipment.bills[0].containers=[{id:'container-a',number:field(bad),printedNumber:field(good),seal:field('SEAL')}];
 let r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,false);assert.ok(r.findings.some(f=>f.code==='INVALID_CONTAINER'));
 decisions.containerOverrides['container-a']=good;r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,true);assert.match(r.xml!,new RegExp(good));
 assert.equal(validateContainerNumber('123UABCDEF1').isValid,false);
});
test('multiple invoices and containers preserve independent IDs and values',async()=>{
 const {shipment,decisions}=fixture();const inv=structuredClone(shipment.invoices[0]);inv.id='inv-b';inv.invoiceNo=field('SECOND');inv.lines[0].id='line-b';shipment.invoices.push(inv);
 decisions.invoiceDecisions[inv.id]={valuationBasis:'LINE_VALUES_EXCLUDE_CHARGES'};decisions.lineDecisions['line-b']={reportingQuantities:[{quantity:10,unit:'NO'}]};
 shipment.modeOfTransport=field('11');
 shipment.bills[0].containers=['ABCU123456','XYZU654321'].map((prefix,i)=>({id:'multi-container-'+i,number:field(prefix+calculateIso6346CheckDigit(prefix)),printedNumber:missingField(),seal:field('TESTSEAL'+i)}));
 const r=await generateEntry(shipment,decisions);assert.equal(r.schemaValid,true);assert.equal(r.totalEnteredValueUsd,40);assert.equal(r.xml!.match(/<invoice>/g)?.length,2);assert.equal(r.xml!.match(/<container>/g)?.length,2);
});
test('non-USD currency requires explicit rate; charges included in line values are removed once',async()=>{
 const {shipment,decisions}=fixture();const inv=shipment.invoices[0];inv.currency=field('EUR');inv.freight=field(2);inv.insurance=field(1);
 let r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,false);assert.equal(r.totalEnteredValueUsd,null);
 decisions.invoiceDecisions[inv.id]={exchangeRateToUsd:2,valuationBasis:'LINE_VALUES_INCLUDE_CHARGES'};
 r=await generateEntry(shipment,decisions);assert.equal(r.totalEnteredValueUsd,34);assert.equal(r.totalHeaderChargesUsd,6);assert.doesNotMatch(r.xml!,/foreign-currency/);
});
test('schema errors cannot yield readiness; text is XML escaped and consignee decision is emitted',async()=>{
 const {shipment,decisions}=fixture();decisions.customsFiling.ultimateConsignee={name:'Other & Co <Warehouse>',taxId:'98-7654321'};
 let r=await generateEntry(shipment,decisions);assert.equal(r.schemaValid,true);assert.match(r.xml!,/Other &amp; Co &lt;Warehouse&gt;/);assert.match(r.xml!,/<tax-id>98-7654321/);
 shipment.bills[0].vessel=field('X'.repeat(21));r=await generateEntry(shipment,decisions);assert.equal(r.schemaValid,false);assert.equal(r.readyToTransmit,false);assert.ok(r.blockers.some(b=>b.code==='XML_VALIDATION'));
});
test('verification is scoped to the observed evidence and changes invalidate acknowledgement',async()=>{
 const {shipment,decisions}=fixture();shipment.invoices[0].invoiceNo=field('A/B');
 let r=await generateEntry(shipment,decisions);const f=r.findings.find(f=>f.code==='INVOICE_NORMALIZATION')!;
 assert.equal(r.schemaValid,true);assert.equal(r.readyToTransmit,false);decisions.acknowledgements[f.id]='Reviewed against source';
 r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,true);
 shipment.invoices[0].invoiceNo=field('C/D');r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,false);
});
test('decision references to other shipments rejected',()=>{const {shipment,decisions}=fixture();decisions.lineDecisions['not-present']={mathChoice:'COMPUTED'};assert.throws(()=>resolveShipment(shipment,decisions),/unknown entity/);});
test('unsupported transport/entry profiles never become ready',async()=>{const {shipment,decisions}=fixture();decisions.customsFiling.modeOfTransport='40';decisions.customsFiling.entryType='03';assert.equal((await generateEntry(shipment,decisions)).readyToTransmit,false);});
test('decimal accounting and allocation preserve cents',()=>{assert.equal(cents(1.005),101);assert.equal(cents(3,0.1),30);assert.deepEqual(allocateCents(5,[1,1,1]),[2,2,1]);});
test('unknown normalizations return null',()=>{assert.equal(normalizeCountryCode('Atlantis'),null);assert.equal(normalizeCountryCode(null),null);assert.equal(normalizeCurrency('$'),null);assert.equal(normalizeUom('mystery'),null);});
test('demo fixture passes schema, has no default decisions, and reports unverified provenance',()=>{const s=loadDemoShipment();assert.ok(RawExtractedShipmentSchema.safeParse(s).success);assert.equal(s.invoices[0].invoiceNo.status,'inferred');assert.equal(s.invoices[0].invoiceNo.source.doc,'demo-json');});
test('cache boundaries, ordering, version isolation, validation and corrupt data',()=>{
 const root=path.resolve('.cache');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'phase1-test-'));
 try {
  const cache=new ExtractionDiskCache(dir),id={model:'test',effort:'low',promptVersion:'1',provider:'synthetic'};
  assert.notEqual(cache.calculateHash([Buffer.from('a'),Buffer.from('bc')]),cache.calculateHash([Buffer.from('ab'),Buffer.from('c')]));
  assert.equal(cache.calculateHash([Buffer.from('a'),Buffer.from('b')]),cache.calculateHash([Buffer.from('b'),Buffer.from('a')]));
  const hash=cache.calculateHash([Buffer.from('a')]);assert.equal(cache.get(hash,id),null);
  cache.set(hash,id,fixture().shipment,{inputTokens:0,outputTokens:0,costUsd:0,latencyMs:0});
  assert.ok(cache.get(hash,id));assert.equal(cache.get(hash,{...id,effort:'high'}),null);
  fs.writeFileSync(path.join(dir,'live-v2',fs.readdirSync(path.join(dir,'live-v2'))[0]),'bad json');assert.equal(cache.get(hash,id),null);
 }finally{assert.ok(path.resolve(dir).startsWith(root+path.sep+'phase1-test-'));fs.rmSync(dir,{recursive:true});}
});
test('HTS failure never fabricates codes; absent rates remain null',async()=>{
 const original=global.fetch;
 try {
  global.fetch=async()=>{throw new Error('offline');};await assert.rejects(()=>lookupHtsCode('offline-test'));
  global.fetch=async()=>new Response(JSON.stringify([{htsno:'1234.56.78.90',description:'Synthetic',units:['NO']}]),{status:200,headers:{'Content-Type':'application/json'}});
  const r=await lookupHtsCode('synthetic-success');assert.equal(r.candidates[0].rawHtsNo,'1234567890');assert.equal(r.candidates[0].generalDutyRate,null);
 }finally{global.fetch=original;}
});

test('invoice-level unknown assists require allocation even if a review note is supplied',async()=>{
 const {shipment,decisions}=fixture();shipment.invoices[0].remarks=field(['Buyer-supplied molds; amount not stated.']);
 let r=await generateEntry(shipment,decisions);for(const f of r.findings)decisions.acknowledgements[f.id]='Reviewed';
 r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,false);assert.ok(r.blockers.some(f=>f.code==='ASSIST_ALLOCATION_REQUIRED'));
});
test('charge allocation excludes assists and customs-only samples',async()=>{
 const {shipment,decisions}=fixture(),inv=shipment.invoices[0];inv.freight=field(5);inv.totalAmount=field(20);
 const second=structuredClone(inv.lines[0]);second.id='free-line';second.lineNo=18;second.foc=field(true);second.amountAsPrinted=field(0);second.unitPrice=field(0);inv.lines.push(second);
 decisions.invoiceDecisions[inv.id].valuationBasis='LINE_VALUES_INCLUDE_CHARGES';
 decisions.lineDecisions['line-z'].assistAmount=10;
 decisions.lineDecisions['free-line']={sampleValue:3,reportingQuantities:[{quantity:10,unit:'NO'}]};
 const r=await generateEntry(shipment,decisions);assert.equal(r.resolved.invoices[0].lines[0].valueCents,2500);assert.equal(r.resolved.invoices[0].lines[1].valueCents,300);
});
test('multiple bill weights need reviewed aggregation; observations remain unchanged',async()=>{
 const {shipment,decisions}=fixture();const second=structuredClone(shipment.bills[0]);second.id='second-bill';second.masterBill=field('SECONDMASTER');shipment.bills.push(second);
 const before=JSON.stringify(shipment);let r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,false);assert.equal(r.grossWeightKg,null);
 decisions.customsFiling.grossWeightKg=100;r=await generateEntry(shipment,decisions);assert.equal(r.readyToTransmit,true);assert.equal(JSON.stringify(shipment),before);
});
test('inferred evidence requires explicit review',async()=>{
 const {shipment,decisions}=fixture();shipment.invoices[0].countryOfOrigin.status='inferred';
 const r=await generateEntry(shipment,decisions);assert.equal(r.schemaValid,true);assert.equal(r.readyToTransmit,false);assert.ok(r.blockers.some(f=>f.code==='EVIDENCE_REVIEW'));
});
