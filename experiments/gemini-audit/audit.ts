import fs from 'fs';
import path from 'path';
import {createHash,randomUUID} from 'crypto';
import {ShipmentExtractorService} from '../../server/src/extraction/extractor';
import {resolveShipment} from '../../server/src/checks';
import {emptyDecisions} from '@sefer/shared';
import {ExtractionDiskCache} from '../../server/src/extraction/cache';
import {fixture} from '../../server/test/fixtures';

async function main(){
 const cacheDir=path.resolve('.cache/extractions/live-v2');
 const entries=fs.readdirSync(cacheDir).map(n=>JSON.parse(fs.readFileSync(path.join(cacheDir,n),'utf8'))).filter(c=>c.identity?.provider==='gemini');
 if(entries.length!==1)throw new Error('Select an explicit Gemini cache record before auditing multiple records.');
 const record=entries[0],s=record.data;
 const files=s.documents.map((d:any)=>({name:d.name,buffer:fs.readFileSync(path.join('samples',d.name))}));
 for(let i=0;i<files.length;i++)if(createHash('sha256').update(files[i].buffer).digest('hex')!==s.documents[i].sha256)throw new Error('Cached source does not match current PDF');
 // Inspect the historical cache directly. The corrected adapter intentionally uses a new prompt version.
 const historical=new ExtractionDiskCache().get(record.fileHash,record.identity);
 if(!historical)throw new Error('Historical cache failed validation');
 const cached={cacheHit:true};
 const checks:{name:string;actual:unknown;expected:unknown;pass:boolean}[]=[];
 const eq=(name:string,actual:unknown,expected:unknown)=>checks.push({name,actual,expected,pass:JSON.stringify(actual)===JSON.stringify(expected)});
 const inv=s.invoices[0],rows=s.packingLists[0].rows,bill=s.bills[0];
 eq('invoice count',s.invoices.length,1);eq('invoice lines',inv.lines.length,5);eq('packing rows',rows.length,5);eq('bill count',s.bills.length,1);
 for(const [key,value] of Object.entries({invoiceNo:'KBAS/NB/26-0912',invoiceDateRaw:'12/09/2026',currency:'USD',totalAmount:27270,freight:3850,insurance:185}))eq('invoice '+key,inv[key].value,value);
 eq('ambiguous date remains inferred',inv.invoiceDate.status,'inferred');
 const expected=[['NB-T101',2400,2.85,6480,'6109.10',1,2400,48,480],['NB-H205',1200,7.4,8880,'6110.20',1,1176,49,774.2],['NB-C330',900,6.95,6255,'6203.42',1,900,30,522],['W-B220',600,2.1,1260,'6206.40',2,600,10,106],['NB-P118S',24,1,24,'6106.10',2,24,1,5.8]];
 for(const [sku,qty,price,amount,hs,page,packed,packages,weight] of expected){
  const l=inv.lines.find((x:any)=>x.style.value===sku),r=rows.find((x:any)=>x.style.value===sku);
  eq(String(sku)+' exists',!!l&&!!r,true);if(!l||!r)continue;
  for(const [key,value] of Object.entries({quantity:qty,unitPrice:price,amountAsPrinted:amount,hsCode:hs}))eq(sku+' '+key,l[key].value,value);
  eq(sku+' invoice page',l.quantity.source.page,page);eq(sku+' manufacturer not invented',l.manufacturerId.value,null);
  eq(sku+' packed quantity',r.quantity.value,packed);eq(sku+' cartons',r.packages.value,packages);eq(sku+' gross kg',r.grossWeightKg.value,weight);eq(sku+' linkage',r.lineId,l.id);
 }
 const blouse=inv.lines.find((l:any)=>l.style.value==='W-B220'),sample=inv.lines.find((l:any)=>l.style.value==='NB-P118S');
 eq('fabric assist',blouse.assistAmount.value,4180);eq('sample FOC',sample.foc.value,true);eq('sample origin',String(sample.countryOfOrigin.value).toUpperCase(),'BANGLADESH');
 eq('invoice composition preserved',inv.lines[1].material.value.includes('60% Cotton 40% Polyester'),true);eq('packing composition preserved',rows[1].description.value.includes('65/35'),true);
 for(const [key,value] of Object.entries({masterScac:'OPLU',masterBill:'OPLUSGN260917735',houseScac:'BMLV',houseBill:'BMLVHCM26090418',vessel:'PACIFIC ARGOS',voyage:'041E',packages:138,grossWeightKg:1930}))eq('bill '+key,bill[key].value,value);
 eq('printed container retained',bill.containers[0].printedNumber.value,'OPLU3041728');eq('seal',bill.containers[0].seal.value,'OPL7731482');
 const {findings,resolved}=resolveShipment(s,emptyDecisions());
 const probes:any={};
 async function probe(finishReason:string,alter?:(s:any)=>void,throwTransport=false){
  const shipment=fixture().shipment;alter?.(shipment);let captured:any;
  const fakeKey='AUDIT_FAKE_KEY_NOT_SECRET';
  const service=new ShipmentExtractorService({apiKey:fakeKey,model:'gemini-3-audit',effort:'low',freeTierConfirmed:true,directory:path.resolve('.cache','gemini-audit',randomUUID()),prepare:async()=>({documents:[{id:'doc-a',name:'synthetic.pdf',sha256:'a'.repeat(64),pages:1}],content:[]}),fetch:(async(url,init)=>{
   captured={urlContainsFakeKey:String(url).includes(fakeKey),body:JSON.parse(init!.body as string)};
   if(throwTransport)throw new Error('Failed request '+String(url));
   return new Response(JSON.stringify({candidates:[{finishReason,content:{parts:[{text:JSON.stringify(shipment)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:200,thoughtsTokenCount:50}}));
  }) as typeof fetch});
  try{const result=await service.extractShipment([{name:'synthetic.pdf',buffer:Buffer.from(randomUUID())}]);return {accepted:true,costUsd:result.costUsd,missingValue:result.shipment.invoices[0].invoiceNo.value,thinkingConfig:captured.body.generationConfig.thinkingConfig??null,schemaEnforced:!!captured.body.generationConfig.responseJsonSchema||!!captured.body.generationConfig.responseSchema};}
  catch(e){return {accepted:false,errorWouldExposeKey:(e as Error).message.includes(fakeKey)};}
 }
 probes.maxTokens=await probe('MAX_TOKENS');
 probes.missingWithValue=await probe('STOP',s=>{s.invoices[0].invoiceNo.status='missing';});
 probes.transportError=await probe('STOP',undefined,true);
 probes.successfulResponse=await probe('STOP');
 const report={cacheHit:cached.cacheHit,sourceHashesVerified:true,metricsReportedByExistingCache:record.metrics,selectedChecks:{passed:checks.filter(c=>c.pass).length,total:checks.length,failures:checks.filter(c=>!c.pass)},checks,
  findings:findings.map(f=>({code:f.code,entity:f.lineId??f.invoiceId??null,evidence:f.evidence})),
  integration:{quantityConflictCount:findings.filter(f=>f.code==='QUANTITY_CONFLICT').length,unitConflictCount:findings.filter(f=>f.code==='UNIT_CONFLICT').length,invoiceUnit:inv.lines[1].unit.value,packingUnit:rows[1].unit.value,exportCountryPassedToXml:resolved.invoices[0].countryExport,containerObservation:bill.containers[0].number},probes};
 const out=path.resolve('.cache/gemini-audit/report.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
 console.log(JSON.stringify({cacheHit:report.cacheHit,sourceHashesVerified:true,selectedChecks:report.selectedChecks,integration:report.integration,probes,report:out},null,2));
 if(checks.some(c=>!c.pass)||report.integration.unitConflictCount!==0||report.integration.quantityConflictCount!==1||report.integration.exportCountryPassedToXml!=='VN'||probes.maxTokens.accepted||probes.missingWithValue.accepted||probes.transportError.errorWouldExposeKey||!probes.successfulResponse.accepted)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
