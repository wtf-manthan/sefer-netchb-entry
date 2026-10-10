import { z } from 'zod';
import { BrokerDecisionsSchema, CustomsFilingCredentialsSchema, LineDiscrepancyChoiceSchema } from '../schemas/decisions.schema';
export type BrokerDecisions = z.infer<typeof BrokerDecisionsSchema>;
export type CustomsFilingCredentials = z.infer<typeof CustomsFilingCredentialsSchema>;
export type LineDiscrepancyChoice = z.infer<typeof LineDiscrepancyChoiceSchema>;
export const emptyDecisions = (): BrokerDecisions => BrokerDecisionsSchema.parse({});
