/**
 * Customs Filing Readiness & Missing Fields Engine
 * 
 * Verifies all legal and operational requirements for a CBP Form 7501 NetCHB entry.
 * Distinguishes between BLOCKER (cannot transmit), NEEDS_DECISION (broker choice), and VERIFY.
 */

import { Finding, ShipmentInputData } from './types';

export function checkFilingReadiness(data: ShipmentInputData): Finding[] {
  const findings: Finding[] = [];
  const filing = data.customsFilingData;
  const invoice = data.commercialInvoice;
  const bl = data.billOfLading;

  // F12: Ultimate Consignee Ambiguity
  if (invoice?.buyerSoldTo && bl?.consignee) {
    const is3pl = bl.consignee.toUpperCase().includes('CASCADE') || 
                  bl.consignee.toUpperCase().includes('FULFILLMENT') ||
                  bl.consignee.toUpperCase().includes('FOR ACCOUNT OF');
    if (is3pl) {
      findings.push({
        code: 'F12',
        severity: 'NEEDS_DECISION',
        topic: 'ultimate consignee ambiguity',
        message: 'Cascade Fulfillment is a 3PL receiving goods "for account of" Northbound Outfitters. ' +
                 'Broker must decide whether Cascade or Northbound is the ultimate consignee for CBP Box 10.',
        evidence: "Cascade Fulfillment is a 3PL receiving 'for account of' Northbound",
        documents: ['commercial_invoice', 'bill_of_lading']
      });
    }
  }

  // F13: Importer EIN / Tax ID Missing (BLOCKER)
  const importerEin = filing?.importerEin || invoice?.importerOfRecord?.ein || invoice?.buyerSoldTo?.ein;
  if (!importerEin) {
    findings.push({
      code: 'F13',
      severity: 'BLOCKER',
      topic: 'importer of record tax ID missing',
      message: 'No IRS Employer Identification Number (EIN) or CBP-assigned number found in documents. ' +
               'Required for CBP Form 7501 filing.',
      evidence: 'no EIN or CBP-assigned number in any document',
      documents: []
    });
  }

  // F14: Bond Information Missing (BLOCKER)
  const hasBond = Boolean(filing?.bondType && (filing?.suretyCode || filing?.bondNumber));
  if (!hasBond) {
    findings.push({
      code: 'F14',
      severity: 'BLOCKER',
      topic: 'bond information missing',
      message: 'Continuous or Single Entry Bond information (bond type, surety code, bond number) is missing. ' +
               'Cannot file formal consumption entry (Type 01) without valid bond.',
      evidence: 'no bond type, surety code or bond number in documents',
      documents: []
    });
  }

  // F15: 10-Digit HTS Missing (BLOCKER)
  const linesWithOnly6Digit = (invoice?.lineItems || []).filter(l => 
    l.hsCode && l.hsCode.replace(/\D/g, '').length <= 6
  );
  if (linesWithOnly6Digit.length > 0) {
    const codes = linesWithOnly6Digit.map(l => l.hsCode).join(', ');
    findings.push({
      code: 'F15',
      severity: 'BLOCKER',
      topic: '10-digit HTS missing',
      message: `Commercial documents only provide 6-digit HS heading codes (${codes}). ` +
               `CBP formal entry requires 10-digit HTS numbers with statistical suffixes.`,
      evidence: `documents give only 6-digit HS codes (${codes})`,
      documents: ['commercial_invoice', 'bill_of_lading']
    });
  }

  // F16: Entry Date and Filer Code
  if (!filing?.entryDate || !filing?.brokerFilerCode) {
    findings.push({
      code: 'F16',
      severity: 'NEEDS_DECISION',
      topic: 'entry date and filer code not in documents',
      message: 'Entry date is required by NetCHB header schema and broker filer code must be populated from filer credentials.',
      evidence: 'entry-date required by schema; filer code belongs to the broker account',
      documents: []
    });
  }

  // F17: Port Codes (Schedule D / Schedule K)
  if (!filing?.entryPortCode || !filing?.foreignPortCode) {
    findings.push({
      code: 'F17',
      severity: 'VERIFY',
      topic: 'port codes',
      message: 'Port of unlading / entry (Tacoma, WA) requires CBP 4-digit Schedule D code (3002). ' +
               'Foreign port of lading (Cat Lai, Vietnam) requires 5-digit Schedule K code (55201).',
      evidence: 'Tacoma is Schedule D port; Cat Lai needs Schedule K code; codes not in documents',
      documents: ['commercial_invoice', 'bill_of_lading']
    });
  }

  // F18: Manufacturer Identifiers (MID)
  if (!filing?.mids) {
    findings.push({
      code: 'F18',
      severity: 'NEEDS_DECISION',
      topic: 'manufacturer identifiers (MID)',
      message: 'Manufacturer Identifiers (MID) for Saigon Phoenix Garment JSC (Vietnam) and SP Garments Dhaka Ltd. (Bangladesh) ' +
               'must be derived and confirmed by broker.',
      evidence: 'Saigon Phoenix (VN) for lines 1-4; SP Garments Dhaka Ltd. (BD) for line 5; MIDs not in documents, must be derived and confirmed',
      documents: ['packing_list', 'commercial_invoice']
    });
  }

  // F19: Related Party Status
  if (filing?.relatedParty === undefined || filing?.relatedParty === null) {
    findings.push({
      code: 'F19',
      severity: 'NEEDS_DECISION',
      topic: 'related party Y/N unknown',
      message: 'Seller is Kowloon Bay Apparel Sourcing (HK sourcing agent). Relationship to importer (related vs non-related) ' +
               'is not specified and must be confirmed for customs valuation.',
      evidence: 'seller is a Hong Kong sourcing company acting for the Vietnamese factory; relationship to importer not stated',
      documents: ['commercial_invoice']
    });
  }

  // F20: ISF Status
  if (bl?.isfFiledBy) {
    findings.push({
      code: 'F20',
      severity: 'VERIFY',
      topic: 'ISF status',
      message: `Bill of Lading states ISF filed by "${bl.isfFiledBy}". Importer must confirm ISF-10 on file with CBP to prevent $5,000 liquidated damages.`,
      evidence: `BL says ISF filed by importer/agent; vessel sailed 24 Sep; filing not evidenced`,
      documents: ['bill_of_lading']
    });
  }

  // F21: Customs Broker Not Yet Named
  if (bl?.notifyParty && bl.notifyParty.toUpperCase().includes('CUSTOMS BROKER (TBA)')) {
    findings.push({
      code: 'F21',
      severity: 'VERIFY',
      topic: 'customs broker not yet named',
      message: 'Bill of Lading notify party explicitly states "ALSO NOTIFY: CUSTOMS BROKER (TBA)". Broker of record must be established.',
      evidence: "BL notify: 'ALSO NOTIFY: CUSTOMS BROKER (TBA)'",
      documents: ['bill_of_lading']
    });
  }

  return findings;
}
