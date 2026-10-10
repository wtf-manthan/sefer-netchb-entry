import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {RawExtractedShipmentSchema,emptyDecisions,filingSuggestions,acceptFilingSuggestion,applyObservationCorrections} from '@sefer/shared';
import {generateEntry} from '../../server/src/builder/entry-service';
import {lookupPortForShipment} from '../../server/src/reference/port-workflow';

// Sample-only artifact preparation. Never imported by application code.
async function main(){
 const shipment=RawExtractedShipmentSchema.parse(JSON.parse(fs.readFileSync('experiments/prefill-v3/extracted.json','utf8')));
 for(const d of shipment.documents){if(createHash('sha256').update(fs.readFileSync('samples/'+d.name)).digest('hex')!==d.sha256)throw new Error('Sample hash mismatch');}
 let decisions=emptyDecisions();
 shipment.invoices.forEach((invoice,i)=>invoice.lines.forEach((line,j)=>{
  if(line.manufacturerId.value&&/^\d+$/.test(line.manufacturerId.value))decisions.observationCorrections[`invoices.${i}.lines.${j}.manufacturerId`]={value:null,source:line.manufacturerId.source as {doc:string;page:number;snippet:string},note:'The cited factory local tax/registration number does not establish a customs MID. Obtain a reviewed MID.'};
 }));
 decisions.observationCorrections['bills.0.masterBill']={value:'OPLUSGN260917735',source:{doc:'doc-3',page:1,snippet:'MBL: OPLUSGN260917735'},note:'Compared against the original B/L master-number box; OCR dropped/misread digits.'};
 decisions.observationCorrections['bills.0.containers.0.number']={value:'OPLU3041722',source:{doc:'doc-3',page:1,snippet:'OPLU 304172 2'},note:'Visual reading of handwritten replacement for crossed-out OPLU3041728; check digit agrees. Carrier confirmation remains a review item.'};
 decisions.observationCorrections['bills.0.loadingPort.country']={value:'Vietnam',source:{doc:'doc-1',page:1,snippet:'Port of Loading: CAT LAI, HO CHI MINH CITY, VN'},note:'Use routing evidence for loading country; country-of-origin box alone does not establish loading country.'};
 const effective=applyObservationCorrections(shipment,decisions.observationCorrections);
 // These specific source-backed suggestions were reviewed against the supplied PDFs.
 // No broker identifiers, classifications, consignee role or discrepancy choices are invented.
 for(const s of filingSuggestions(effective))if(s.target!=='customsFiling.ultimateConsignee.name')decisions=acceptFilingSuggestion(decisions,s);
 for(const [target,query,code] of [['unladingPortCode','Tacoma','3002'],['foreignPortCode','Ho Chi Minh City','55224']] as const){
  const lookup=lookupPortForShipment(shipment,decisions,{target,query});
  if(!lookup.result.candidates.some(c=>c.code===code))throw new Error('Reviewed sample port absent from reference');
  decisions.customsFiling[target]=code;
  decisions.portSelections[target]={request:lookup.request,candidateCode:code,lookupFingerprint:lookup.result.fingerprint,evidenceFingerprint:lookup.evidenceFingerprint};
 }
 const result=await generateEntry(shipment,decisions);
 if(!result.draftXml)throw new Error('No draft produced');
 fs.mkdirSync('submission',{recursive:true});
 fs.writeFileSync('submission/entry.xml',result.draftXml);
 fs.writeFileSync('submission/review.json',JSON.stringify({reviewVersion:1,shipmentData:shipment,brokerDecisions:decisions},null,2));
 fs.writeFileSync('submission/open-items.json',JSON.stringify({artifact:'Incomplete sample draft; do not transmit',sampleHashesVerified:true,schemaValid:result.draftSchemaValid,readyToTransmit:result.readyToTransmit,blockersCount:result.blockersCount,schemaErrors:result.draftSchemaErrors,findings:result.findings,correctionAudit:result.correctionAudit,portSelections:decisions.portSelections,suggestionSelections:decisions.suggestionSelections},null,2));
 console.log(JSON.stringify({sampleHashesVerified:true,draftWritten:true,schemaValid:result.draftSchemaValid,readyToTransmit:result.readyToTransmit,blockers:result.blockersCount,openCodes:[...new Set(result.findings.filter(f=>f.status==='open').map(f=>f.code))]},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
