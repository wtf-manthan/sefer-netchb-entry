import fs from 'fs';
import path from 'path';
import {prepareDocuments,ShipmentExtractorService} from '../../server/src/extraction/extractor';
async function main(){
 const files=fs.readdirSync('samples').filter(n=>n.toLowerCase().endsWith('.pdf')).sort().map(name=>({name,buffer:fs.readFileSync(path.join('samples',name))}));
 if(process.argv.includes('--render-only')){
  const prepared=await prepareDocuments(files);const dir=path.resolve('.cache','render-check');fs.mkdirSync(dir,{recursive:true});let page=0;
  for(const item of prepared.content)if(item.inlineData?.mimeType==='image/png'){fs.writeFileSync(path.join(dir,'page-'+(++page)+'.png'),Buffer.from(item.inlineData.data,'base64'));}
  if(!page)throw new Error('No PDF pages rendered');
  console.log(JSON.stringify({documents:prepared.documents.length,pages:page,renderDirectory:dir}));return;
 }
 const candidate=process.argv.find(a=>a.startsWith('--model='))?.slice(8);
 const service=new ShipmentExtractorService(candidate?{model:candidate}:{});if(!service.available){console.log('LIVE TEST BLOCKED: verify GEMINI_API_KEY, LLM_MODEL, LLM_EFFORT and GEMINI_FREE_TIER_CONFIRMED in .env; no request sent.');process.exitCode=2;return;}
 const result=await service.extractShipment(files);const dir=path.resolve('.cache','gemini-review');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'shipment.json'),JSON.stringify(result.shipment,null,2));
 console.log(JSON.stringify({cacheHit:result.cacheHit,costUsd:result.costUsd,documents:result.shipment.documents.length,invoices:result.shipment.invoices.length,lines:result.shipment.invoices.reduce((n,i)=>n+i.lines.length,0),output:path.join(dir,'shipment.json')}));
 const repeat=await service.extractShipment(files);if(!repeat.cacheHit)throw new Error('Expected cache hit');console.log('Repeat extraction: cache hit, no additional API call.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
