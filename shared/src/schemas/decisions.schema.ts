import { z } from 'zod';
import {isCountryCode} from '../reference/countries';
import {isStatisticalUnit} from '../reference/statistical-units';
const countryCode=z.string().refine(isCountryCode,'Select a supported country code');
import { SourceReferenceSchema } from './field.schema';
import { EntityIdSchema } from './shipment.schema';
import {PortTargetSchema,PortSelectionSchema} from './workflow.schema';
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=> {
  const d = new Date(v); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===v;
}, 'Invalid calendar date');
const money = z.number().finite().nonnegative().max(9999999999.99);
const taxId = z.string().regex(/^(\d{2}-\d{7}[\dA-Za-z]{0,2}|\d{6}-\d{5}|\d{3}-\d{2}-\d{4})$/);
export const CustomsFilingCredentialsSchema = z.object({
  importerEin: taxId.optional(), bondType: z.enum(['08','09']).optional(), suretyCode: z.string().regex(/^\d{3}$/).optional(),
  entryDate: IsoDateSchema.optional(), entryType: z.string().regex(/^\d{2}$/).optional(),
  entryPortCode: z.string().regex(/^\d{4}$/).optional(), processingPortCode: z.string().regex(/^\d{4}$/).optional(),
  unladingPortCode: z.string().regex(/^\d{4}$/).optional(), foreignPortCode: z.string().regex(/^\d{5}$/).optional(),
  modeOfTransport: z.string().regex(/^\d{2}$/).optional(),
  ultimateConsignee: z.object({ name: z.string().min(1).optional(), taxId:taxId.optional() }).strict().optional(),
  relatedParty: z.boolean().optional(), grossWeightKg: money.optional(),
  referenceDataConfirmed: z.boolean().optional(),
}).strict();
export const LineDiscrepancyChoiceSchema = z.object({
  mathChoice: z.enum(['COMPUTED','PRINTED']).optional(), quantityChoice: z.enum(['PACKED','INVOICED','CUSTOM']).optional(),
  customQuantity: money.optional(), assistAmount: money.optional(), sampleValue: money.optional(),
  countryOfOrigin: countryCode.optional(), manufacturerId: z.string().regex(/^[A-Z0-9]{1,15}$/).optional(),
  htsCode: z.string().regex(/^\d{10}$/).optional(),
  reportingQuantities: z.array(z.object({quantity: money, unit: z.string().refine(isStatisticalUnit,'Select a schema-supported statistical unit')}).strict()).min(1).max(3).optional(),
}).strict().superRefine((d,ctx)=> {if(d.quantityChoice==='CUSTOM' && d.customQuantity===undefined)ctx.addIssue({code:'custom',message:'Custom quantity is required'});});
export const BrokerDecisionsSchema = z.object({
  suggestionSelections:z.record(z.string().regex(/^(customsFiling\.(modeOfTransport|ultimateConsignee\.name)|invoiceDecisions\.[A-Za-z0-9_-]+\.(countryOfExport|valuationBasis)|lineDecisions\.[A-Za-z0-9_-]+\.(assistAmount|sampleValue))$/),z.object({id:z.string(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),value:z.union([z.string(),z.number()])}).strict()).default({}),
  portSelections:z.record(PortTargetSchema,PortSelectionSchema).default({}),
  observationCorrections: z.record(z.string(),z.object({value:z.union([z.null(),z.string(),z.number().finite(),z.boolean(),z.array(z.string())]),source:SourceReferenceSchema.extend({doc:z.string().min(1),page:z.number().int().positive(),snippet:z.string().min(1)}),note:z.string().trim().min(3).max(1000)}).strict()).default({}),
  lineDecisions: z.record(EntityIdSchema,LineDiscrepancyChoiceSchema).default({}),
  invoiceDecisions: z.record(EntityIdSchema,z.object({
    countryOfExport: countryCode.optional(),
    exchangeRateToUsd: z.number().finite().positive().max(1e8).optional(),
    valuationBasis: z.enum(['LINE_VALUES_EXCLUDE_CHARGES','LINE_VALUES_INCLUDE_CHARGES']).optional(),
  }).strict()).default({}),
  containerOverrides: z.record(EntityIdSchema,z.string().regex(/^[A-Z]{3}[UJZ]\d{7}$/)).default({}),
  acknowledgements: z.record(z.string(),z.string().trim().min(3).max(1000)).default({}),
  customsFiling: CustomsFilingCredentialsSchema.default({}),
}).strict();
