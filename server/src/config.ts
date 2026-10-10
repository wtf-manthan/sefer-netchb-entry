import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
const root=path.resolve(__dirname,'../..');
dotenv.config({path:path.join(root,'.env')});
const env=z.object({
  PORT:z.coerce.number().int().min(1).max(65535).default(3001),
  OPENROUTER_API_KEY:z.string().default(''),
  GEMINI_API_KEY:z.string().default(''),
  GEMINI_FREE_TIER_CONFIRMED:z.enum(['true','false']).default('false'),
  EXTRACTION_MAX_PAGES:z.coerce.number().int().min(1).max(50).default(20),
  EXTRACTION_MAX_TOKENS:z.coerce.number().int().min(1024).max(64000).default(48000),
  LLM_MODEL:z.string().default(''), LLM_EFFORT:z.enum(['','minimal','low','medium','high']).default(''),
  SPEND_CAP_USD:z.coerce.number().finite().nonnegative().default(0),
  EXTRACTION_CACHE_DIR:z.string().default('.cache/extractions'),
  ENABLE_DEMO:z.enum(['true','false']).default('false'),
  MAX_UPLOAD_BYTES:z.coerce.number().int().positive().max(50*1024*1024).default(10*1024*1024),
}).parse(process.env);
export const config={
  openrouterApiKey:env.OPENROUTER_API_KEY,geminiApiKey:env.GEMINI_API_KEY,
  geminiFreeTierConfirmed:env.GEMINI_FREE_TIER_CONFIRMED==='true',
  maxPages:env.EXTRACTION_MAX_PAGES,maxTokens:env.EXTRACTION_MAX_TOKENS,
  port:env.PORT,llmModel:env.LLM_MODEL,llmEffort:env.LLM_EFFORT,spendCapUsd:env.SPEND_CAP_USD,
  extractionCacheDir:path.resolve(root,env.EXTRACTION_CACHE_DIR),
  specDir:path.join(root,'spec'),samplesDir:path.join(root,'samples'),
  enableDemo:env.ENABLE_DEMO==='true',maxUploadBytes:env.MAX_UPLOAD_BYTES,
};
