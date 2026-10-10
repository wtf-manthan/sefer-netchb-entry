import fs from 'fs';
import path from 'path';
import { RawExtractedShipmentSchema, normalizeCountryCode } from '@sefer/shared';
import { config } from '../config';
// The answer key is an unverified test/demo source. This module is never called by /extract.
export function loadDemoShipment() {
  const raw=JSON.parse(fs.readFileSync(path.join(config.samplesDir,'ground-truth.json'),'utf8'));
  const inv=raw.commercial_invoice, pl=raw.packing_list, bl=raw.bill_of_lading;
  const f=(value:unknown)=>value==null?undefined:({value,status:'inferred',source:{doc:'demo-json',page:null,snippet:JSON.stringify(value)},confidence:0.5});
  const party=(p:any)=>({name:f(p?.name),address:f(p?.address??p?.address_lines?.join(', ')),country:f(p?.country)});
  const lines=inv.line_items.map((l:any)=>({
    id:'demo-line-'+l.line_no,lineNo:l.line_no,style:f(l.style),description:f(l.description),material:f(l.material),
    hsCode:f(l.hs_code),quantity:f(l.quantity),unit:f(l.unit),unitPrice:f(l.unit_price_usd),amountAsPrinted:f(l.amount_usd_as_printed),
    customsValue:f(l.customs_value_only_total_usd),countryOfOrigin:f(normalizeCountryCode(l.country_of_origin_line)),
    notes:f(l.notes),foc:f(l.notes?.includes('FOC')??false),
    assistAmount:f(inv.assist?.applies_to_line===l.line_no?inv.assist.value_usd:null),
  }));
  return RawExtractedShipmentSchema.parse({
    schemaVersion:'2',documents:[{id:'demo-json',kind:'other',name:'Unverified samples/ground-truth.json'},
      {id:'demo-invoice-doc',kind:'invoice',name:inv.source_file},{id:'demo-packing-doc',kind:'packing_list',name:pl.source_file},{id:'demo-bill-doc',kind:'bill_of_lading',name:bl.source_file}],
    invoices:[{id:'demo-invoice',documentId:'demo-invoice-doc',invoiceNo:f(inv.invoice_no),invoiceDateRaw:f(inv.invoice_date_raw),invoiceDate:f(inv.invoice_date),
      seller:party(inv.seller),buyer:party(inv.buyer_sold_to),shipTo:party(inv.ship_to),currency:f(inv.currency),incoterms:f(inv.incoterms),
      countryOfOrigin:f(normalizeCountryCode(inv.country_of_origin_header)),exportDate:f(inv.etd),
      totalAmount:f(inv.total_cif_tacoma_usd),freight:f(inv.ocean_freight_usd),insurance:f(inv.marine_insurance_usd),
      remarks:f(inv.assist?[inv.assist.description]:[]),lines}],
    packingLists:[{id:'demo-packing',documentId:'demo-packing-doc',rows:pl.rows.map((r:any,n:number)=>({
      id:'demo-row-'+n,invoiceId:'demo-invoice',lineId:lines.find((l:any)=>l.style?.value===r.style)?.id??null,
      style:f(r.style),description:f(r.description),quantity:f(r.total_pcs),unit:f('PCS'),packages:f(r.cartons),grossWeightKg:f(r.total_gw_kg),
    }))}],
    bills:[{id:'demo-bill',documentId:'demo-bill-doc',masterScac:f(bl.master_scac),masterBill:f(bl.master_bl_no),
      houseScac:f(bl.house_scac),houseBill:f(bl.house_bl_no),vessel:f(bl.vessel),voyage:f(bl.voyage),
      packages:f(bl.number_of_packages),packageUnit:f(bl.package_unit),grossWeightKg:f(bl.gross_weight_kg),
      containers:bl.container?[{id:'demo-container',number:f(bl.container.number_final),printedNumber:f(bl.container.number_printed_struck_through),seal:f(bl.container.seal_number)}]:[]}],
  });
}
