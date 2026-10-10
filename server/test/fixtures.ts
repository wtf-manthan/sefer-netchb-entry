import {RawExtractedShipmentSchema,BrokerDecisionsSchema,createExtractedField} from '@sefer/shared';
// Synthetic values exercise syntax and mechanics, not authoritative customs classification.
export const field=<T>(value:T)=>createExtractedField(value,'extracted',{doc:'doc-a',page:1,snippet:JSON.stringify(value)},0.9);
export function fixture(){
  const shipment=RawExtractedShipmentSchema.parse({
    schemaVersion:'2',documents:[{id:'doc-a',kind:'invoice',name:'synthetic.pdf'}],modeOfTransport:field('10'),
    invoices:[{id:'inv-a',documentId:'doc-a',invoiceNo:field('SYNTHETIC-42'),seller:{},buyer:{},shipTo:{},currency:field('USD'),
      countryOfOrigin:field('US'),countryOfExport:field('US'),exportDate:field('2026-01-02'),freight:field(0),insurance:field(0),totalAmount:field(20),
      lines:[{id:'line-z',lineNo:17,style:field('WIDGET'),description:field('Test widget'),quantity:field(10),unit:field('NO'),
      unitPrice:field(2),amountAsPrinted:field(20),hsCode:field('1234567890'),manufacturerId:field('USTEST123ABC')}]}],
    packingLists:[],bills:[{id:'bill-a',documentId:'doc-a',masterScac:field('AAAA'),masterBill:field('MASTER123'),houseScac:field('BBBB'),houseBill:field('HOUSE456'),
      vessel:field('TEST VESSEL'),voyage:field('V001'),packages:field(1),packageUnit:field('CTN'),grossWeightKg:field(100),containers:[]}],
  });
  const decisions=BrokerDecisionsSchema.parse({
    invoiceDecisions:{'inv-a':{valuationBasis:'LINE_VALUES_EXCLUDE_CHARGES'}},
    lineDecisions:{'line-z':{reportingQuantities:[{quantity:10,unit:'NO'}]}},
    customsFiling:{importerEin:'12-3456789',bondType:'08',suretyCode:'123',entryDate:'2026-01-03',entryType:'01',processingPortCode:'1001',entryPortCode:'1001',
      unladingPortCode:'1001',foreignPortCode:'12345',relatedParty:false,referenceDataConfirmed:true,ultimateConsignee:{name:'Test buyer',taxId:'12-3456789'}},
  });
  return {shipment,decisions};
}
