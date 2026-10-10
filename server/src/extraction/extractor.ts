import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {PDFParse} from 'pdf-parse';
import {RawExtractedShipmentSchema,RawExtractedShipment} from '@sefer/shared';
import {config} from '../config';
import {EXTRACTION_PROMPT} from './prompt';
const responseSchema=zodToJsonSchema(RawExtractedShipmentSchema as unknown as Parameters<typeof zodToJsonSchema>[0]);
const promptDigest=createHash('sha256').update(EXTRACTION_PROMPT+JSON.stringify(responseSchema)).digest('hex');
import {ExtractionDiskCache} from './cache';

export class ExtractionUnavailableError extends Error {
  constructor(message='Set GEMINI_API_KEY in .env, then restart the server.'){super(message);}
}
export interface UploadDocument {name:string;buffer:Buffer}
interface Prepared {documents:{id:string;name:string;sha256:string;pages:number}[];content:any[]}
interface ExtractionResult {shipment:RawExtractedShipment;cacheHit:boolean;costUsd:number|null}
export interface ExtractorOptions {apiKey?:string;model?:string;effort?:string;freeTierConfirmed?:boolean;directory?:string;fetch?:typeof fetch;prepare?:(files:UploadDocument[])=>Promise<Prepared>}

export async function prepareDocuments(files:UploadDocument[]):Promise<Prepared>{
  const documents:Prepared['documents']=[],content:any[]=[];let total=0;
  for(let i=0;i<files.length;i++){
    const file=files[i],id='doc-'+(i+1),parser=new PDFParse({data:new Uint8Array(file.buffer)});
    try {
      const info=await parser.getInfo();total+=info.total;
      if(!info.total||total>config.maxPages)throw new ExtractionUnavailableError('Maximum '+config.maxPages+' PDF pages per shipment; empty documents are unsupported.');
      documents.push({id,name:file.name,sha256:createHash('sha256').update(file.buffer).digest('hex'),pages:info.total});
      for(let page=1;page<=info.total;page++){
        const rendered=await parser.getScreenshot({partial:[page],desiredWidth:1600,imageDataUrl:true,imageBuffer:false});
        if(!rendered.pages[0]?.dataUrl)throw new Error('No rendered page');
        const base64Data=rendered.pages[0].dataUrl.replace(/^data:image\/\w+;base64,/,'');
        content.push(
          {text:`Document ${id} (${file.name}), Page ${page}:`},
          {inlineData:{mimeType:'image/png',data:base64Data}}
        );
      }
    }catch(e){if(e instanceof ExtractionUnavailableError)throw e;throw new ExtractionUnavailableError('Cannot read PDF '+(i+1)+'. Supply an unencrypted, readable PDF.');}
    finally {await parser.destroy();}
  }return {documents,content};
}

const pending=new Map<string,Promise<ExtractionResult>>();

export class ShipmentExtractorService {
  private options:Required<ExtractorOptions>;
  constructor(options:ExtractorOptions={}){
    this.options={
      apiKey:options.apiKey??config.geminiApiKey,
      model:options.model??config.llmModel,
      effort:options.effort??config.llmEffort,
      freeTierConfirmed:options.freeTierConfirmed??config.geminiFreeTierConfirmed,
      directory:options.directory??config.extractionCacheDir,
      fetch:options.fetch??fetch,
      prepare:options.prepare??prepareDocuments,
    };
  }

  private configurationError():string|null {
    if(!/^gemini-3[\w.-]*$/.test(this.options.model))return 'Set LLM_MODEL to an explicit Gemini 3 model ID. No fallback model is selected.';
    if(!['','minimal','low','medium','high'].includes(this.options.effort))return 'Unsupported LLM_EFFORT. Use minimal, low, medium, high, or leave empty.';
    if(!this.options.apiKey)return 'Set GEMINI_API_KEY in .env, then restart the server.';
    if(!this.options.freeTierConfirmed)return 'New inference calls are disabled until GEMINI_FREE_TIER_CONFIRMED=true for a project with billing disabled. Paid inference is unsupported; increasing SPEND_CAP_USD does not enable it.';
    return null;
  }
  get available(){return this.configurationError()===null;}

  async extractShipment(files:UploadDocument[]):Promise<ExtractionResult>{
    if(!files.length)throw new ExtractionUnavailableError('Upload at least one PDF.');
    const o=this.options,cache=new ExtractionDiskCache(o.directory);
    const identity={provider:'gemini',model:o.model,effort:o.effort,promptVersion:'gemini-v3-'+promptDigest+'-'+createHash('sha256').update(JSON.stringify(files.map(f=>[f.name,createHash('sha256').update(f.buffer).digest('hex')]))).digest('hex')};
    const hash=cache.calculateHash(files.map(f=>f.buffer));
    const cached=cache.get(hash,identity);if(cached)return {shipment:cached,cacheHit:true,costUsd:0};
    const configurationError=this.configurationError();
    if(configurationError)throw new ExtractionUnavailableError(configurationError);
    const key=JSON.stringify([o.directory,hash,identity]),existing=pending.get(key);if(existing)return existing;
    const work=this.run(files,cache,hash,identity);pending.set(key,work);
    try{return await work;}finally{pending.delete(key);}
  }

  private async run(files:UploadDocument[],cache:ExtractionDiskCache,hash:string,identity:Parameters<ExtractionDiskCache['get']>[1]):Promise<ExtractionResult>{
    const o=this.options,prepared=await o.prepare(files);
    const prompt=EXTRACTION_PROMPT+'\nDocuments available: '+JSON.stringify(prepared.documents)+'\nJSON Schema: '+JSON.stringify(responseSchema);

    const start=Date.now();let usage:any=null,status='failed';
    try{
      const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(o.model)}:generateContent`;
      const response=await o.fetch(endpoint,{
        method:'POST',
        signal:AbortSignal.timeout(180000),
        headers:{'Content-Type':'application/json','x-goog-api-key':o.apiKey},
        body:JSON.stringify({
          systemInstruction:{parts:[{text:prompt}]},
          contents:[{
            role:'user',
            parts:[
              ...prepared.content,
            ]
          }],
          generationConfig:{
            responseMimeType:'application/json',
            maxOutputTokens:config.maxTokens,
            temperature:0.0,
            ...(o.effort?{thinkingConfig:{thinkingLevel:o.effort.toUpperCase(),includeThoughts:false}}:{}),
          }
        })
      });

      if(!response.ok){
        throw new ExtractionUnavailableError(`Gemini returned HTTP ${response.status}. Check model access, free-tier quota and configuration. No substitute model was used.`);
      }

      const body:any=await response.json();
      usage=body.usageMetadata;
      const candidate=body.candidates?.[0];
      if(body.promptFeedback?.blockReason||candidate?.finishReason!=='STOP'){
        throw new ExtractionUnavailableError('Gemini did not finish successfully (blocked, truncated or incomplete response). No extraction was accepted.');
      }
      const parts=candidate.content?.parts;
      if(!Array.isArray(parts)||parts.some((p:any)=>!p.thought&&typeof p.text!=='string'))throw new ExtractionUnavailableError('Gemini returned an unsupported response.');
      const text=parts.filter((p:any)=>p.thought!==true).map((p:any)=>p.text).join('');
      if(!text.trim())throw new ExtractionUnavailableError('Gemini returned no extraction text.');
      let data:any;
      try{data=JSON.parse(text);}catch{throw new ExtractionUnavailableError('Model returned invalid JSON.');}

      // Representation-only compatibility: never erase contradictory values or confidence.
      function normalizeMissing(obj: any): void {
        if (!obj || typeof obj !== 'object') return;
        if (obj.status === 'missing' && obj.value === null && obj.confidence === 0 && obj.source === null) {
          obj.source = { doc: null, page: null, snippet: null };
        }
        for (const k of Object.keys(obj)) {
          normalizeMissing(obj[k]);
        }
      }
      normalizeMissing(data);

      const parsed=RawExtractedShipmentSchema.safeParse(data);

      if(!parsed.success){
        throw new ExtractionUnavailableError('Extraction failed data validation: '+parsed.error.issues.slice(0,5).map(i=>i.path.join('.')+' '+i.code).join('; '));
      }

      const shipment=parsed.data;
      if(shipment.schemaVersion!=='3')throw new ExtractionUnavailableError('Expected extraction schema version 3. No legacy response accepted as a new extraction.');
      if(shipment.documents.length!==prepared.documents.length)throw new ExtractionUnavailableError('Extraction omitted or invented a document.');
      for(const doc of shipment.documents){
        const original=prepared.documents.find(d=>d.id===doc.id);
        if(!original)throw new ExtractionUnavailableError('Invalid document evidence.');
        doc.name=original.name;doc.sha256=original.sha256;
      }

      function check(value:any):void{
        if(!value||typeof value!=='object')return;
        if(value.status){
          const d=prepared.documents.find(d=>d.id===value.source?.doc);
          if(value.source?.page&&(!d||value.source.page>d.pages))throw new ExtractionUnavailableError('Model cited a page outside the uploaded documents.');
          return;
        }
        Object.values(value).forEach(check);
      }
      check(shipment);

      cache.set(hash,identity,shipment,{
        inputTokens:usage?.promptTokenCount??0,
        outputTokens:usage?.candidatesTokenCount??0,
        costUsd:null,
        latencyMs:Date.now()-start
      });

      status='success';
      return {shipment,cacheHit:false,costUsd:null};
    }catch(e){
      if(e instanceof ExtractionUnavailableError)throw e;
      throw new ExtractionUnavailableError('Extraction failed or timed out. No extraction was accepted. Check connectivity and retry.');
    }finally{
      fs.mkdirSync(o.directory,{recursive:true});
      fs.appendFileSync(path.join(o.directory,'calls.jsonl'),JSON.stringify({
        at:new Date().toISOString(),model:o.model,status,
        inputTokens:usage?.promptTokenCount??null,
        outputTokens:usage?.candidatesTokenCount??null,
        thoughtTokens:usage?.thoughtsTokenCount??null,
        totalTokens:usage?.totalTokenCount??null,
        costUsd:null,billingBasis:'user-confirmed-free-tier; provider billing not measured',latencyMs:Date.now()-start
      })+'\n');
    }
  }
}
