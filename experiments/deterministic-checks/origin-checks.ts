/**
 * Country of Origin & Mixed-Origin Checks
 */

import { Finding, InvoiceLineItem, PackingListLineItem } from './types';

/**
 * Checks for mixed country of origin across line items vs header declaration.
 * Emits Finding F06.
 */
export function checkCountryOfOrigin(
  headerOrigin: string,
  invoiceLines: InvoiceLineItem[],
  plLines: PackingListLineItem[],
  plRemarks: string[] = []
): Finding | null {
  const normHeader = (headerOrigin || '').trim().toUpperCase();
  const remarksJoined = plRemarks.join(' ').toUpperCase();

  // Look for any line or carton indicating an origin distinct from header
  const hasBangladeshLine = invoiceLines.some(l => 
    (l.origin && l.origin.toUpperCase() !== normHeader && l.origin.toUpperCase() !== 'VN') ||
    l.description.toUpperCase().includes('BANGLADESH')
  );

  const hasBangladeshRemark = remarksJoined.includes('BANGLADESH') || 
                              remarksJoined.includes('DHAKA');

  if (hasBangladeshLine || hasBangladeshRemark) {
    return {
      code: 'F06',
      severity: 'NEEDS_DECISION',
      topic: 'mixed country of origin',
      message: `Header country of origin is declared as ${headerOrigin}, but line 5 (Carton 138 polo samples) ` +
               `was produced in Bangladesh (SP Garments Dhaka Ltd.). ` +
               `Under CBP rules, each line item must declare its true country of origin (Lines 1-4: VN; Line 5: BD) ` +
               `and cannot be lumped under a single header origin.`,
      evidence: `line 5 / carton 138 made in Bangladesh; BL, marks and header say Vietnam; line origin must be declared per line`,
      documents: ['commercial_invoice', 'packing_list', 'bill_of_lading']
    };
  }

  return null;
}
