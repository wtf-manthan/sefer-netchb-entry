import { z } from 'zod';
export const SourceReferenceSchema = z.object({
  doc: z.string().min(1).nullable(), page: z.number().int().positive().nullable(), snippet: z.string().min(1).nullable(),
}).strict();
export function createExtractedFieldSchema<T extends z.ZodTypeAny>(value: T) {
  return z.discriminatedUnion('status', [
    z.object({ value, status: z.literal('extracted'), source: SourceReferenceSchema.extend({
      doc: z.string().min(1), page: z.number().int().positive(), snippet: z.string().min(1),
    }), confidence: z.number().min(0).max(1) }).strict(),
    z.object({ value, status: z.literal('inferred'), source: SourceReferenceSchema.extend({
      doc: z.string().min(1), snippet: z.string().min(1),
    }), confidence: z.number().min(0).max(1) }).strict(),
    z.object({ value: z.null(), status: z.literal('missing'), source: SourceReferenceSchema, confidence: z.literal(0) }).strict(),
  ]).default({ value: null, status: 'missing', source: { doc: null, page: null, snippet: null }, confidence: 0 });
}
