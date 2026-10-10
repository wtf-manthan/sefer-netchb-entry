import fs from 'node:fs';
import {ShipmentExtractorService} from '../../server/src/extraction/extractor';
async function main(){
 const names=['KBAS-NB-26-0912_Commercial_Invoice.pdf','SPG-PL-2609-117_Packing_List.pdf','BMLVHCM26090418_House_BL.pdf'];
 const extractor=new ShipmentExtractorService();
 const result=await extractor.extractShipment(names.map(name=>({name,buffer:fs.readFileSync('samples/'+name)})));
 fs.writeFileSync('experiments/prefill-v3/extracted.json',JSON.stringify(result.shipment,null,2));
 console.log(JSON.stringify({cacheHit:result.cacheHit,costUsd:result.costUsd,schemaVersion:result.shipment.schemaVersion,documents:result.shipment.documents.length,lines:result.shipment.invoices.flatMap(i=>i.lines).length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
