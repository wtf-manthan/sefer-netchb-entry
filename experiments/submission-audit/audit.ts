import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {RawExtractedShipmentSchema,emptyDecisions} from '../../shared/src';
import {generateEntry} from '../../server/src/builder/entry-service';
async function main(){
const paths=fs.readdirSync('.cache/extractions/live-v2').map(n=>'.cache/extractions/live-v2/'+n);
const cached=paths.map(p=>({path:p,...JSON.parse(fs.readFileSync(p,'utf8'))})).filter(x=>x.identity?.promptVersion?.startsWith('gemini-v2-'));
if(cached.length!==1)throw new Error('Select a single audited v2 cache explicitly; no cache guessed.');
const entry=cached[0],shipment=RawExtractedShipmentSchema.parse(entry.data);
for(const d of shipment.documents){const actual=createHash('sha256').update(fs.readFileSync('samples/'+d.name)).digest('hex');if(actual!==d.sha256)throw new Error('Sample hash mismatch: '+d.name);}
const result=await generateEntry(shipment,emptyDecisions());
const report={cacheFile:entry.path,identity:entry.identity,sampleHashesVerified:true,liveInferenceCalls:0,xmlGenerated:!!result.xml,schemaValid:result.schemaValid,readyToTransmit:result.readyToTransmit,blockers:result.blockersCount,findings:result.findings.map(f=>({code:f.code,entity:f.entityId,status:f.status,message:f.message})),schemaErrors:result.schemaErrors};
fs.writeFileSync('experiments/submission-audit/result.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({sampleHashesVerified:true,liveInferenceCalls:0,xmlGenerated:!!result.xml,schemaValid:result.schemaValid,readyToTransmit:result.readyToTransmit,blockers:result.blockersCount,openCodes:[...new Set(result.findings.filter(f=>f.status==='open').map(f=>f.code))]},null,2));

}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
