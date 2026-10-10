import { z } from 'zod';
import { createExtractedFieldSchema as field } from './field.schema';
export const EntityIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/).refine(v => !['constructor','prototype','__proto__'].includes(v));
const text = () => field(z.string().trim().min(1));
const number = () => field(z.number().finite().nonnegative().max(1e10));
const party = z.object({ name: text(), address: text(), country: text() }).strict();
export const ExtractedInvoiceLineSchema = z.object({
  id: EntityIdSchema, lineNo: z.number().int().positive(), style: text(), description: text(), material: text(),
  hsCode: text(), quantity: number(), unit: text(), unitPrice: number(), amountAsPrinted: number(),
  customsValue: number(), countryOfOrigin: text(), manufacturerId: text(),
  foc: field(z.boolean()), notes: text(), assistAmount: number(),
}).strict();
export const InvoiceSchema = z.object({
  id: EntityIdSchema, documentId: EntityIdSchema, invoiceNo: text(), invoiceDateRaw: text(), invoiceDate: text(),
  seller: party, buyer: party, shipTo: party, currency: text(), incoterms: text(), countryOfOrigin: text(),
  countryOfExport: text(), exportDate: text(), totalAmount: number(), freight: number(), insurance: number(),
  remarks: field(z.array(z.string())), lines: z.array(ExtractedInvoiceLineSchema).min(1).max(1000),
}).strict();
export const ExtractedPackingListRowSchema = z.object({
  id: EntityIdSchema, invoiceId: EntityIdSchema.nullable(), lineId: EntityIdSchema.nullable(),
  style: text(), description: text(), quantity: number(), unit: text(), packages: number(), grossWeightKg: number(),
}).strict();
export const BillSchema = z.object({
  id: EntityIdSchema, documentId: EntityIdSchema, masterScac: text(), masterBill: text(), houseScac: text(), houseBill: text(),
  vessel: text(), voyage: text(), packages: number(), packageUnit: text(), grossWeightKg: number(),
  containers: z.array(z.object({ id: EntityIdSchema, number: text(), printedNumber: text(), seal: text() }).strict()).max(200),
}).strict();
const ShipmentBase = z.object({
  schemaVersion: z.literal('2'),
  documents: z.array(z.object({ id: EntityIdSchema, name: z.string().min(1), kind: z.enum(['invoice','packing_list','bill_of_lading','other']), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()).min(1).max(50),
  invoices: z.array(InvoiceSchema).min(1).max(50),
  packingLists: z.array(z.object({ id: EntityIdSchema, documentId: EntityIdSchema, rows: z.array(ExtractedPackingListRowSchema).max(2000) }).strict()).max(50),
  bills: z.array(BillSchema).max(50), modeOfTransport: text(),
}).strict();
export const RawExtractedShipmentSchema = ShipmentBase.superRefine((s, ctx) => {
  const ids = new Set<string>();
  const register = (id: string) => { if(ids.has(id)) ctx.addIssue({code:'custom', message:'Duplicate entity ID: '+id}); ids.add(id); };
  [...s.documents,...s.invoices,...s.packingLists,...s.bills,...s.invoices.flatMap(i=>i.lines),...s.packingLists.flatMap(p=>p.rows),...s.bills.flatMap(b=>b.containers)].forEach(e=>register(e.id));
  const docs = new Set(s.documents.map(d=>d.id));
  [...s.invoices,...s.packingLists,...s.bills].forEach(e=> {if(!docs.has(e.documentId))ctx.addIssue({code:'custom',message:'Unknown document: '+e.documentId});});
  const lines = new Map(s.invoices.flatMap(i=>i.lines.map(l=>[l.id,i.id] as const)));
  for(const p of s.packingLists) for(const row of p.rows) {
    if(row.invoiceId && !s.invoices.some(i=>i.id===row.invoiceId))ctx.addIssue({code:'custom',message:'Unknown packing invoice reference'});
    if(row.lineId && (!lines.has(row.lineId) || (row.invoiceId && lines.get(row.lineId)!==row.invoiceId)))ctx.addIssue({code:'custom',message:'Invalid packing line reference'});
  }
  const walk = (v: unknown): void => {
    if(!v || typeof v !== 'object')return;
    const f = v as {status?:string;source?:{doc:string|null}};
    if(f.status && f.source?.doc && !docs.has(f.source.doc))ctx.addIssue({code:'custom',message:'Unknown evidence document: '+f.source.doc});
    Object.values(v).forEach(walk);
  }; walk(s);
});
