import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { RawExtractedShipmentSchema, RawExtractedShipment } from '@sefer/shared';
import { config } from '../config';
export interface CacheIdentity { model:string; effort:string; promptVersion:string; provider:string }
export class ExtractionDiskCache {
  constructor(private directory=config.extractionCacheDir){}
  calculateHash(buffers:Buffer[]):string {
    // Sorted individual hashes preserve duplicate count and file boundaries; upload order is irrelevant.
    return createHash('sha256').update(JSON.stringify(buffers.map(b=>createHash('sha256').update(b).digest('hex')).sort())).digest('hex');
  }
  private key(hash:string,identity:CacheIdentity) {
    return createHash('sha256').update(JSON.stringify([hash,identity.provider,identity.model,identity.effort,identity.promptVersion,'2'])).digest('hex');
  }
  get(hash:string,identity:CacheIdentity):RawExtractedShipment|null {
    try {
      const entry=JSON.parse(fs.readFileSync(path.join(this.directory,'live-v2',this.key(hash,identity)+'.json'),'utf8'));
      if(entry.schemaVersion!=='2'||entry.fileHash!==hash||entry.key!==this.key(hash,identity))return null;
      const parsed=RawExtractedShipmentSchema.safeParse(entry.data);
      return parsed.success?parsed.data:null;
    } catch {return null;}
  }
  set(hash:string,identity:CacheIdentity,data:RawExtractedShipment,metrics:{inputTokens:number;outputTokens:number;costUsd:number|null;latencyMs:number}) {
    const parsed=RawExtractedShipmentSchema.parse(data), key=this.key(hash,identity);
    const dir=path.join(this.directory,'live-v2');fs.mkdirSync(dir,{recursive:true});
    const target=path.join(dir,key+'.json'), temp=path.join(dir,key+'.'+randomUUID()+'.tmp');
    try {fs.writeFileSync(temp,JSON.stringify({key,fileHash:hash,schemaVersion:'2',identity,metrics,data:parsed}));fs.renameSync(temp,target);}
    finally {if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
}
