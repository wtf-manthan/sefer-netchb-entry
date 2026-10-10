import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {randomUUID} from 'crypto';
import { RawExtractedShipmentSchema, BrokerDecisionsSchema, emptyDecisions } from '@sefer/shared';
import { generateEntry } from './builder/entry-service';
import { ShipmentExtractorService, ExtractionUnavailableError } from './extraction/extractor';
import { loadDemoShipment } from './extraction/demo';
import { lookupHtsCode } from './reference/hts';
import { config } from './config';
import {resolveScheduleKPort,ScheduleKRequestSchema} from './reference/schedule-k';
import {resolveScheduleDPort,normalizePortRole} from './reference/schedule-d';
import {PortLookupRequestSchema} from '@sefer/shared';
import {lookupPortForShipment} from './reference/port-workflow';
export function createApp(options:{enableDemo?:boolean;maxUploadBytes?:number;extractor?:ShipmentExtractorService;uploadTtlMs?:number}={}) {
  const app=express();
  const extractor=options.extractor??new ShipmentExtractorService();
  app.disable('x-powered-by');
  app.use(express.json({limit:'5mb'}));
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:options.maxUploadBytes??config.maxUploadBytes,files:10,fields:0,parts:10}});
  app.get('/api/health',(_req,res)=>res.json({status:'ok',liveExtractionAvailable:extractor.available,demoEnabled:options.enableDemo??config.enableDemo}));
  // Opaque upload tokens are short-lived capabilities. Documents stay in memory only.
  const staged=new Map<string,{files:{name:string;buffer:Buffer}[];bytes:number;expires:number;busy:boolean;timer:ReturnType<typeof setTimeout>}>();
  const ttl=options.uploadTtlMs??15*60*1000;
  const discard=(id:string)=>{const item=staged.get(id);if(item){clearTimeout(item.timer);staged.delete(id);}};
  const pdfUpload=upload.array('documents',10);
  app.post('/api/uploads',pdfUpload,(req,res)=>{
    const files=(req.files??[]) as Express.Multer.File[];
    if(!files.length)return res.status(400).json({error:'Upload at least one PDF.'});
    if(files.some(f=>f.mimetype!=='application/pdf'||!f.originalname.toLowerCase().endsWith('.pdf')||f.buffer.subarray(0,5).toString()!=='%PDF-'))
      return res.status(400).json({error:'Only PDF uploads with a PDF signature are accepted.'});
    const bytes=files.reduce((n,f)=>n+f.size,0);
    if(bytes>25*1024*1024)return res.status(413).json({error:'Maximum total upload size is 25 MB.'});
    if([...staged.values()].reduce((n,x)=>n+x.bytes,0)+bytes>100*1024*1024||staged.size>=20)
      return res.status(503).json({error:'Temporary upload storage is full. Go back to discard unused uploads or try later.'});
    const id=randomUUID(),expires=Date.now()+ttl;
    const timer=setTimeout(()=>discard(id),ttl);timer.unref();
    staged.set(id,{files:files.map(f=>({name:f.originalname,buffer:f.buffer})),bytes,expires,busy:false,timer});
    res.status(201).json({uploadId:id,expiresAt:new Date(expires).toISOString(),files:files.map(f=>({name:f.originalname,size:f.size}))});
  });
  app.delete('/api/uploads/:id',(req,res)=>{
    const item=staged.get(req.params.id);
    if(item?.busy)return res.status(409).json({error:'Extraction is already running.'});
    discard(req.params.id);res.sendStatus(204);
  });
  app.post('/api/uploads/:id/extract',async(req,res,next)=>{
    const item=staged.get(req.params.id);
    if(!item||item.expires<=Date.now()){discard(req.params.id);return res.status(410).json({error:'Upload expired or was discarded. Go back and upload the documents again.'});}
    if(item.busy)return res.status(409).json({error:'Extraction is already running.'});
    item.busy=true;
    try {
      const extraction=await extractor.extractShipment(item.files),decisions=emptyDecisions();
      const result=await generateEntry(extraction.shipment,decisions);
      discard(req.params.id);
      res.json({...result,extractedData:extraction.shipment,brokerDecisions:decisions,cacheHit:extraction.cacheHit,spendUsd:extraction.costUsd,notice:'AI extraction requires source review. Local filing checks do not establish regulatory completeness.'});
    }catch(e){item.busy=false;next(e);}
  });
  app.post('/api/extract',upload.fields([{name:'documents',maxCount:10},{name:'commercialInvoice',maxCount:1},{name:'packingList',maxCount:1},{name:'billOfLading',maxCount:1}]),async(req,res,next)=>{
    try {
      const files=Object.values((req.files??{}) as Record<string,Express.Multer.File[]>).flat();
      if(!files.length)return res.status(400).json({error:'Upload at least one PDF.'});
      if(files.some(f=>f.mimetype!=='application/pdf'||!f.originalname.toLowerCase().endsWith('.pdf')||f.buffer.subarray(0,5).toString()!=='%PDF-'))
        return res.status(400).json({error:'Only PDF uploads with a PDF signature are accepted.'});
      if(files.reduce((sum,f)=>sum+f.size,0)>25*1024*1024)return res.status(413).json({error:'Maximum total upload size is 25 MB.'});
      const extraction=await extractor.extractShipment(files.map(f=>({name:f.originalname,buffer:f.buffer})));
      const decisions=emptyDecisions();
      const result=await generateEntry(extraction.shipment,decisions);
      res.json({...result,extractedData:extraction.shipment,brokerDecisions:decisions,cacheHit:extraction.cacheHit,spendUsd:extraction.costUsd,notice:'AI extraction requires source review. Local filing checks do not establish regulatory completeness.'});
    } catch(e){next(e);}
  });
  app.post('/api/demo',async(_req,res,next)=>{
    if(!(options.enableDemo??config.enableDemo))return res.status(404).json({error:'Demo mode is disabled.'});
    try {
      const shipment=loadDemoShipment(), decisions=emptyDecisions();
      const result=await generateEntry(shipment,decisions);
      res.json({...result,extractedData:shipment,brokerDecisions:decisions,demo:true,notice:'Unverified JSON fixture. No PDF extraction was performed.',spendUsd:0});
    }catch(e){next(e);}
  });
  app.post('/api/entry',async(req,res,next)=>{
    const shipment=RawExtractedShipmentSchema.safeParse(req.body?.shipmentData);
    const decisions=BrokerDecisionsSchema.safeParse(req.body?.brokerDecisions??{});
    if(!shipment.success||!decisions.success)return res.status(400).json({error:'Invalid entry request',issues:[
      ...(!shipment.success?shipment.error.issues:[]),...(!decisions.success?decisions.error.issues:[]),
    ].map(i=>({path:i.path,message:i.message}))});
    try {res.json(await generateEntry(shipment.data,decisions.data));}
    catch(e){if((e as Error).name==='ZodError'||/correction/i.test((e as Error).message))return res.status(400).json({error:'Invalid observation correction. Check field type, path and document evidence.'});if((e as Error).message.startsWith('Decision references'))return res.status(422).json({error:(e as Error).message});next(e);}
  });
  app.post('/api/reference/port',(req,res)=>{
    const s=RawExtractedShipmentSchema.safeParse(req.body?.shipmentData),d=BrokerDecisionsSchema.safeParse(req.body?.brokerDecisions??{}),q=PortLookupRequestSchema.safeParse(req.body?.request);
    if(!s.success||!d.success||!q.success)return res.status(400).json({error:'Invalid port review request.'});
    try {const lookup=lookupPortForShipment(s.data,d.data,q.data);return res.status(lookup.result.outcome==='unavailable'?503:200).json(lookup);}
    catch{return res.status(400).json({error:'Invalid shipment corrections.'});}
  });
  app.post('/api/export',async(req,res,next)=>{
    const s=RawExtractedShipmentSchema.safeParse(req.body?.shipmentData),d=BrokerDecisionsSchema.safeParse(req.body?.brokerDecisions??{}),kind=req.body?.kind;
    if(!s.success||!d.success||!['ready','draft','review'].includes(kind))return res.status(400).json({error:'Invalid export request.'});
    try {
      const result=await generateEntry(s.data,d.data);
      if(kind==='ready'&&!result.readyToTransmit)return res.status(409).json({error:'Resolve open blockers and schema errors before checked XML export.',blockersCount:result.blockersCount});
      if((kind==='ready'&&!result.xml)||(kind==='draft'&&!result.draftXml))return res.status(409).json({error:'Required values are missing; download the review report first.'});
      return res.json({xml:kind==='draft'?result.draftXml:result.xml,fileName:kind==='ready'?'netchb-entry-checked.xml':'netchb-entry-DRAFT.xml',reviewReport:{draftSchemaValid:result.draftSchemaValid,draftSchemaErrors:result.draftSchemaErrors,suggestionSelections:d.data.suggestionSelections,schemaValid:result.schemaValid,schemaErrors:result.schemaErrors,readyToTransmit:result.readyToTransmit,readinessScope:result.readinessScope,findings:result.findings,portSelections:d.data.portSelections,corrections:d.data.observationCorrections}});
    } catch(e){if((e as Error).name==='ZodError'||/correction|Decision references/i.test((e as Error).message))return res.status(400).json({error:'Invalid review decisions.'});next(e);}
  });
  app.get('/api/hts/lookup',async(req,res)=>{
    const query=typeof req.query.query==='string'?req.query.query.trim():'';
    if(!query||query.length>100)return res.status(400).json({error:'Provide a query of 1 to 100 characters.'});
    try {res.json(await lookupHtsCode(query));}catch {res.status(503).json({error:'Authoritative classification lookup is unavailable. No substitute codes or rates were generated.',candidates:[]});}
  });
  app.get('/api/ports/foreign/resolve',(req,res)=>{
    const parsed=ScheduleKRequestSchema.safeParse(req.query);
    if(!parsed.success)return res.status(400).json({error:'Provide query and optionally country (official country name); no other parameters supported.'});
    const result=resolveScheduleKPort(parsed.data);
    return res.status(result.outcome==='unavailable'?503:200).json({result});
  });
  app.get('/api/ports/resolve',(req,res)=>{
    const {query,role,stateHint}=req.query;
    if(Object.keys(req.query).some(k=>!['query','role','stateHint'].includes(k)) || typeof query!=='string'||!query.trim()||query.length>150||typeof role!=='string'||!normalizePortRole(role)||(stateHint!==undefined&&(typeof stateHint!=='string'||! /^[A-Za-z]{2}$/.test(stateHint))))return res.status(400).json({error:'Provide query, a supported US port role, and optional two-letter stateHint.'});
    const result=resolveScheduleDPort(query,{role,stateHint:stateHint as string|undefined});
    return res.status(result.outcome==='unavailable'?503:200).json({result});
  });
  app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(err instanceof ExtractionUnavailableError)return res.status(503).json({error:err.message});
    if(err instanceof multer.MulterError)return res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({error:'Upload rejected: '+err.code});
    if((err as {type?:string}).type==='entity.too.large')return res.status(413).json({error:'Request exceeds size limit.'});
    if(err instanceof SyntaxError)return res.status(400).json({error:'Malformed JSON request.'});
    res.status(500).json({error:'Request could not be completed.'});
  });
  return app;
}
export const app=createApp();
