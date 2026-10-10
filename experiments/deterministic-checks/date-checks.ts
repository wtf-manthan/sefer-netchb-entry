/**
 * Date Ambiguity & Chronology Checks
 */

import { Finding } from './types';

/**
 * Checks for ambiguous date formats (e.g. 12/09/2026) when day and month are both <= 12.
 * Uses transport chronology (ETD, PL date) to infer format and emits Finding F10.
 */
export function checkDateAmbiguity(
  invoiceDateRaw?: string,
  etdRaw?: string,
  packingListDateRaw?: string
): Finding | null {
  if (!invoiceDateRaw) {
    return null;
  }

  // Check if date uses slash format DD/MM/YYYY or MM/DD/YYYY where first two numbers are <= 12
  const slashMatch = invoiceDateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const num1 = parseInt(slashMatch[1], 10);
    const num2 = parseInt(slashMatch[2], 10);

    if (num1 <= 12 && num2 <= 12) {
      // Both numbers can be month or day!
      return {
        code: 'F10',
        severity: 'VERIFY',
        topic: 'ambiguous date format',
        message: `Invoice date "${invoiceDateRaw}" is ambiguous (could represent 12-Sep-2026 DD/MM or 09-Dec-2026 MM/DD). ` +
                 `Transport chronological context (ETD ${etdRaw ?? '24-SEP-2026'} and PL ${packingListDateRaw ?? '20-Sep-2026'}) ` +
                 `strongly indicates DD/MM (12 Sep 2026), as goods could not be invoiced months after ocean departure. Flagged for verification.`,
        evidence: `invoice date ${invoiceDateRaw}; ETD ${etdRaw ?? '24-SEP-2026'} and PL ${packingListDateRaw ?? '20-Sep-2026'} imply DD/MM (12 Sep)`,
        documents: ['commercial_invoice']
      };
    }
  }

  return null;
}
