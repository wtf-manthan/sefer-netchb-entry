import {z} from 'zod';
export const PortTargetSchema=z.enum(['processingPortCode','entryPortCode','unladingPortCode','foreignPortCode']);
export const PortLookupRequestSchema=z.object({target:PortTargetSchema,query:z.string().trim().min(1).max(150),stateHint:z.string().regex(/^[A-Za-z]{2}$/).optional(),country:z.string().trim().min(1).max(100).optional()}).strict().superRefine((r,c)=>{
  if(r.target==='foreignPortCode'?r.stateHint!==undefined:r.country!==undefined)c.addIssue({code:'custom',message:'Use country for foreign ports or stateHint for US ports.'});
});
export const PortSelectionSchema=z.object({request:PortLookupRequestSchema,candidateCode:z.string().regex(/^\d{4,5}$/),evidenceFingerprint:z.string().regex(/^[a-f0-9]{64}$/),lookupFingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type PortLookupRequest=z.infer<typeof PortLookupRequestSchema>;
export type PortSelection=z.infer<typeof PortSelectionSchema>;
export type PortTarget=z.infer<typeof PortTargetSchema>;
