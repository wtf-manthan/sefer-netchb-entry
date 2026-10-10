import { z } from 'zod';
import {IsoDateTimeOrDateSchema} from './reference.schema';

export const DatasetFormatSchema = z.enum(['json', 'csv', 'xml', 'ts']);

export const DatasetManifestSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    publisher: z.string().min(1),
    sourceUrl: z.string().min(1),
    datasetVersion: z.string().min(1),
    retrievedAt: IsoDateTimeOrDateSchema,
    effectiveDate: IsoDateTimeOrDateSchema.optional(),
    license: z.string().min(1),
    redistributable: z.boolean(),
    recordCount: z.number().int().nonnegative(),
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/, 'checksumSha256 must be a 64-character lowercase sha256 hex string'),
    format: DatasetFormatSchema,
  })
  .strict();
