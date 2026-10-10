/**
 * Types for Deterministic Checks Engine (Task T5)
 */

export type FindingSeverity = 'BLOCKER' | 'NEEDS_DECISION' | 'VERIFY' | 'INFO';

export interface Finding {
  code: string; // e.g. 'F01', 'F02', ...
  severity: FindingSeverity;
  topic: string;
  message: string;
  evidence: string;
  documents: string[];
}

export interface InvoiceLineItem {
  lineNo: number;
  style: string;
  description: string;
  material?: string;
  hsCode?: string;
  quantity: number;
  unit: string;
  unitPriceUsd?: number | null;
  amountUsdAsPrinted?: number | null;
  amountUsdComputed?: number | null;
  customsValueOnlyUnitUsd?: number | null;
  customsValueOnlyTotalUsd?: number | null;
  origin?: string;
  foc?: boolean;
  notes?: string | null;
}

export interface PackingListLineItem {
  cartonRange: string;
  cartonFirst: number;
  cartonLast: number;
  style: string;
  description: string;
  cartons: number;
  pcsPerCarton: number;
  totalPcs: number;
  totalNwKg: number;
  totalGwKg: number;
  origin?: string;
}

export interface ShipmentInputData {
  commercialInvoice?: {
    invoiceNo: string;
    invoiceDateRaw?: string;
    incoterms?: string;
    freightChargesUsd?: number;
    insuranceChargesUsd?: number;
    countryOfOriginHeader?: string;
    lineItems: InvoiceLineItem[];
    subtotalPage1?: number;
    totalAmountUsd?: number;
    remarks?: string[];
    buyerSoldTo?: { name: string; ein?: string | null };
    importerOfRecord?: { ein?: string | null };
  };
  packingList?: {
    lines: PackingListLineItem[];
    totalCartons: number;
    totalPcs: number;
    totalGwKg: number;
    palletized: boolean;
    remarks?: string[];
  };
  billOfLading?: {
    houseBlNo: string;
    masterBlNo?: string;
    container?: {
      numberPrintedStruckThrough?: string;
      numberHandwrittenCorrection?: string;
      numberFinal: string;
    };
    grossWeightKg: number;
    numberOfPackages: number;
    originOfGoods?: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    consignee?: string;
    notifyParty?: string;
    isfFiledBy?: string;
  };
  customsFilingData?: {
    importerEin?: string | null;
    bondType?: string | null;
    suretyCode?: string | null;
    bondNumber?: string | null;
    brokerFilerCode?: string | null;
    entryDate?: string | null;
    entryPortCode?: string | null;
    unladingPortCode?: string | null;
    foreignPortCode?: string | null;
    mids?: Record<string, string> | null;
    relatedParty?: boolean | null;
  };
}
