import { z } from 'zod';

export const LookupOutcomeSchema = z.enum([
  'exact_match',
  'candidates',
  'no_match',
  'unavailable',
  'stale',
]);

export const MatchingMethodSchema = z.enum([
  'exact_code',
  'normalized_name',
  'alias',
  'hierarchical_search',
  'fallback_format',
]);

export function createReferenceCandidateSchema<T extends z.ZodTypeAny = z.ZodString>(
  codeSchema: T = z.string().min(1) as unknown as T
) {
  return z
    .object({
      code: codeSchema,
      label: z.string().min(1),
      description: z.string().optional(),
      details: z.record(z.unknown()).optional(),
    })
    .strict();
}

export const ReferenceCandidateSchema = createReferenceCandidateSchema(z.string().min(1));

export const IsoDateTimeOrDateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/,
    'Must be a valid ISO 8601 date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:mm:ss.sssZ)'
  )
  .refine((val) => {
    const [year,month,day]=val.slice(0,10).split('-').map(Number);
    const leap=year%4===0&&(year%100!==0||year%400===0);
    const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    if(val.includes('T')) {
      const [h,m,s]=val.slice(11,19).split(':').map(Number);
      if(h>23||m>59||s>59)return false;
    }
    return month>=1&&month<=12&&day>=1&&day<=days[month-1]&&!isNaN(Date.parse(val));
  }, {
    message: 'Must represent a valid calendar date/time',
  });

export const ReferenceSourceMetadataSchema = z
  .object({
    publisher: z.string().min(1),
    url: z.string().min(1),
    datasetVersion: z.string().min(1),
    retrievedAt: IsoDateTimeOrDateSchema,
    effectiveDate: IsoDateTimeOrDateSchema.optional(),
    license: z.string().optional(),
  })
  .strict();

export function createLookupResultSchema<T extends z.ZodTypeAny = z.ZodString>(
  codeSchema: T = z.string().min(1) as unknown as T
) {
  return z
    .object({
      category: z.string().min(1),
      targetField: z.string().min(1),
      query: z.string(),
      outcome: LookupOutcomeSchema,
      candidates: z.array(createReferenceCandidateSchema(codeSchema)),
      source: ReferenceSourceMetadataSchema,
      matchingMethod: MatchingMethodSchema,
      rationale: z.string(),
      missingFactsNeeded: z.array(z.string()),
      codeVerifiedAgainstReference: z.boolean(),
      userConfirmedForShipment: z.boolean(),
      fingerprint: z.string().regex(/^[0-9a-f]{64}$/, 'Fingerprint must be a 64-character lowercase sha256 hex string'),
    })
    .strict();
}

export const LookupResultSchema = createLookupResultSchema(z.string().min(1));

export const ReferenceConfirmationSchema = z
  .object({
    shipmentId: z.string().min(1).optional(),
    evidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    lookupFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    category: z.string().min(1),
    targetField: z.string().min(1).optional(),
    query: z.string(),
    datasetVersion: z.string().min(1),
    candidateCode: z.string().min(1),
    confirmedAt: IsoDateTimeOrDateSchema,
    confirmedBy: z.string().optional(),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/, 'Fingerprint must be a 64-character lowercase sha256 hex string'),
    userNotes: z.string().optional(),
  })
  .strict();
