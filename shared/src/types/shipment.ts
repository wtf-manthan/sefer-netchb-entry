import { z } from 'zod';
import { RawExtractedShipmentSchema, ExtractedInvoiceLineSchema, ExtractedPackingListRowSchema } from '../schemas/shipment.schema';
export type RawExtractedShipment = z.infer<typeof RawExtractedShipmentSchema>;
export type ExtractedInvoiceLine = z.infer<typeof ExtractedInvoiceLineSchema>;
export type ExtractedPackingListRow = z.infer<typeof ExtractedPackingListRowSchema>;
