import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {randomUUID} from 'crypto';
import {ShipmentExtractorService,prepareDocuments,ExtractorOptions} from '../src/extraction/extractor';
import {fixture} from './fixtures';
const files=[{name:'independent.pdf',buffer:Buffer.from('%PDF synthetic')}];
const fakeKey='synthetic-not-a-key';
function response(shipment=fixture().shipment,finishReason='STOP'){
 return {candidates:[{finishReason,content:{parts:[{text:JSON.stringify(shipment)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:200,thoughtsTokenCount:50,totalTokenCount:350}};
}
function setup(body:any=response(),options:Partial<ExtractorOptions>={}){
 const directory=path.resolve('.cache','test-extraction-'+randomUUID());let calls=0;let request:any;
 const service=new ShipmentExtractorService({apiKey:fakeKey,model:'gemini-3-test',effort:'low',freeTierConfirmed:true,directory,
 prepare:async()=>({documents:[{id:'doc-a',name:files[0].name,sha256:'a'.repeat(64),pages:1}],content:[{text:'synthetic page'}]}),
 fetch:(async(url,init)=>{
  calls++;assert.equal(String(url).includes(fakeKey),false);assert.equal(String(url).includes('?'),false);
  assert.equal(new Headers(init!.headers).get('x-goog-api-key'),fakeKey);
  request=JSON.parse(init!.body as string);
  assert.equal(request.generationConfig.responseMimeType,'application/json');
  assert.ok(request.systemInstruction.parts[0].text.includes('untrusted'));
  return new Response(JSON.stringify(body));
 }) as typeof fetch,...options});
 return {service,directory,calls:()=>calls,request:()=>request};
}
test('Gemini extraction validates, deduplicates and caches; usage is not claimed as verified zero cost',async()=>{
 const s=setup();const [a,b]=await Promise.all([s.service.extractShipment(files),s.service.extractShipment(files)]);
 assert.equal(a.shipment.documents[0].name,'independent.pdf');assert.deepEqual(a,b);assert.equal(s.calls(),1);assert.equal(a.costUsd,null);
 assert.equal(s.request().generationConfig.thinkingConfig.thinkingLevel,'LOW');
 const cached=await s.service.extractShipment(files);assert.equal(cached.cacheHit,true);assert.equal(cached.costUsd,0);assert.equal(s.calls(),1);
 const metrics=fs.readFileSync(path.join(s.directory,'calls.jsonl'),'utf8');assert.equal(metrics.includes(fakeKey),false);
 assert.equal(JSON.parse(metrics).costUsd,null);assert.equal(JSON.parse(metrics).thoughtTokens,50);
});
test('valid JSON with an unsuccessful or absent completion status is rejected and never cached',async()=>{
 for(const reason of ['MAX_TOKENS','SAFETY','RECITATION',undefined]){
  const body:any=response();body.candidates[0].finishReason=reason;
  const s=setup(body);await assert.rejects(s.service.extractShipment(files),/did not finish/);await assert.rejects(s.service.extractShipment(files),/did not finish/);assert.equal(s.calls(),2);
 }
});
test('multipart output concatenates answer text and excludes thought parts',async()=>{
 const body:any=response(),text=body.candidates[0].content.parts[0].text;
 body.candidates[0].content.parts=[{thought:true,text:'not JSON'},{text:text.slice(0,100)},{text:text.slice(100)}];
 const s=setup(body);assert.equal((await s.service.extractShipment(files)).shipment.invoices.length,1);
});
test('blocked, empty, malformed and wrong-schema responses are rejected explicitly',async()=>{
 const bodies:any[]=[{...response(),promptFeedback:{blockReason:'SAFETY'}},{candidates:[]},{candidates:[{finishReason:'STOP',content:{parts:[]}}]},
  {candidates:[{finishReason:'STOP',content:{parts:[{text:'not-json'}]}}]},
  {candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}];
 for(const body of bodies){const s=setup(body);await assert.rejects(s.service.extractShipment(files));assert.equal(s.calls(),1);}
});
test('contradictory missing observations are rejected, not silently erased',async()=>{
 for(const change of [(s:any)=>s.invoices[0].invoiceNo.status='missing',(s:any)=>{s.invoices[0].invoiceNo={status:'missing',value:null,source:null,confidence:0.9};}]){
  const shipment=fixture().shipment;change(shipment);const s=setup(response(shipment));await assert.rejects(s.service.extractShipment(files),/data validation/);
 }
 const shipment:any=fixture().shipment;shipment.invoices[0].invoiceNo={status:'missing',value:null,source:null,confidence:0};
 assert.deepEqual((await setup(response(shipment)).service.extractShipment(files)).shipment.invoices[0].invoiceNo.source,{doc:null,page:null,snippet:null});
});
test('wrong document IDs and out-of-range page references cannot enter the cache',async()=>{
 for(const change of [(s:any)=>s.invoices[0].invoiceNo.source.page=999,(s:any)=>s.documents.push({id:'extra',name:'invented.pdf',kind:'other'})]){
  const shipment=fixture().shipment;change(shipment);await assert.rejects(setup(response(shipment)).service.extractShipment(files),/page outside|invented a document/);
 }
});
test('transport and provider errors never expose credentials or arbitrary messages',async()=>{
 for(const fail of [true,false]){
  const s=setup(undefined,{fetch:(async()=>{if(fail)throw new Error('private '+fakeKey);return new Response('private '+fakeKey,{status:429});}) as typeof fetch});
  await assert.rejects(s.service.extractShipment(files),(e:Error)=>!e.message.includes(fakeKey)&&!e.message.includes('private'));
  assert.equal(fs.readFileSync(path.join(s.directory,'calls.jsonl'),'utf8').includes(fakeKey),false);
 }
});
test('missing key, unconfirmed free tier, incompatible model or effort cannot send requests',async()=>{
 for(const options of [{apiKey:''},{freeTierConfirmed:false},{model:'qwen/test:free'},{model:''},{effort:'xhigh'},{model:'gemini-2.5-flash',effort:'medium'}]){
  const s=setup(undefined,options);assert.equal(s.service.available,false);await assert.rejects(s.service.extractShipment(files));assert.equal(s.calls(),0);
 }
});
test('model and effort changes isolate cached extraction results',async()=>{
 const s=setup();await s.service.extractShipment(files);
 const other=setup(undefined,{directory:s.directory,effort:'high'});await other.service.extractShipment(files);assert.equal(other.calls(),1);assert.equal(other.request().generationConfig.thinkingConfig.thinkingLevel,'HIGH');
 const third=setup(undefined,{directory:s.directory,model:'gemini-3-other'});await third.service.extractShipment(files);assert.equal(third.calls(),1);
});
test('PDF renderer rejects corrupt input before model calls',async()=>{await assert.rejects(prepareDocuments(files),/Cannot read PDF/);});
