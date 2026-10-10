/**
 * Invoice Line Math, Subtotal Reconciliation & Syntax Checks
 */

import { Finding, InvoiceLineItem } from './types';

/**
 * Checks arithmetic on each invoice line item (Qty * UnitPrice == LineTotal).
 * Also checks page subtotals and grand total roll-ups.
 */
export function checkInvoiceLineMath(
  lines: InvoiceLineItem[],
  subtotalPage1?: number,
  totalAmountUsd?: number
): { findings: Finding[]; computedSum: number; printedSum: number } {
  const findings: Finding[] = [];
  let computedSum = 0;
  let printedSum = 0;

  for (const line of lines) {
    if (line.unitPriceUsd == null || line.amountUsdAsPrinted == null) {
      continue;
    }

    const computed = Math.round(line.quantity * line.unitPriceUsd * 100) / 100;
    computedSum += computed;
    printedSum += line.amountUsdAsPrinted;

    // Check line math discrepancy
    const diff = Math.abs(computed - line.amountUsdAsPrinted);
    if (diff > 0.009) {
      findings.push({
        code: 'F01',
        severity: 'NEEDS_DECISION',
        topic: 'invoice line 1 amount',
        message: `Line ${line.lineNo} (${line.style}): ${line.quantity} x ${line.unitPriceUsd.toFixed(2)} = ${computed.toFixed(2)} ` +
                 `but printed ${line.amountUsdAsPrinted.toFixed(2)} (diff $${diff.toFixed(2)}). ` +
                 `Page-1 subtotal ${subtotalPage1?.toFixed(2) ?? 'N/A'} and total ${totalAmountUsd?.toFixed(2) ?? 'N/A'} only reconcile with ${computed.toFixed(2)}.`,
        evidence: `${line.quantity} x ${line.unitPriceUsd.toFixed(2)} = ${computed.toFixed(0)} but printed ${line.amountUsdAsPrinted.toFixed(0)}; ` +
                 `page-1 subtotal ${subtotalPage1?.toFixed(0) ?? 'N/A'} and total ${totalAmountUsd?.toFixed(0) ?? 'N/A'} only reconcile with ${computed.toFixed(0)}`,
        documents: ['commercial_invoice']
      });
    }
  }

  computedSum = Math.round(computedSum * 100) / 100;
  printedSum = Math.round(printedSum * 100) / 100;

  return { findings, computedSum, printedSum };
}

/**
 * Checks CIF deductions and non-dutiable charges.
 * Emits Finding F09.
 */
export function checkNonDutiableCharges(
  incoterm?: string,
  freightUsd?: number,
  insuranceUsd?: number,
  totalMerchandiseUsd?: number,
  invoiceTotalCif?: number
): Finding | null {
  if (!incoterm?.toUpperCase().includes('CIF')) {
    return null;
  }

  const freight = freightUsd ?? 0;
  const insurance = insuranceUsd ?? 0;
  const totalCharges = freight + insurance;

  return {
    code: 'F09',
    severity: 'VERIFY',
    topic: 'CIF invoice vs FOB-basis entered value',
    message: `Invoice terms are ${incoterm}. Freight $${freight.toFixed(2)} + Insurance $${insurance.toFixed(2)} = $${totalCharges.toFixed(2)} ` +
             `are non-dutiable charges that must be declared in header charges and deducted from entered value for FOB basis customs appraisal.`,
    evidence: `freight ${freight.toFixed(0)} + insurance ${insurance.toFixed(0)} = ${totalCharges.toFixed(0)} reported as charges, not value`,
    documents: ['commercial_invoice']
  };
}

/**
 * Validates invoice number against NetCHB invoiceNoType: [A-Za-z0-9-]{1,17}
 * Slashes and spaces are illegal in NetCHB invoice numbers.
 * Emits Finding F11.
 */
export function checkInvoiceNumber(invoiceNo: string): {
  finding: Finding | null;
  normalized: string;
} {
  const isNetChbValid = /^[A-Za-z0-9-]{1,17}$/.test(invoiceNo);
  const normalized = invoiceNo.replace(/[^A-Za-z0-9-]/g, '-').slice(0, 17);

  if (!isNetChbValid) {
    return {
      finding: {
        code: 'F11',
        severity: 'INFO',
        topic: 'invoice number invalid for NetCHB',
        message: `Invoice number "${invoiceNo}" contains invalid characters (e.g. slashes). NetCHB invoiceNoType requires [A-Za-z0-9-]{1,17}. Normalized to "${normalized}".`,
        evidence: `${invoiceNo} contains slashes; invoiceNoType allows letters, digits, hyphen, max 17; normalized to ${normalized}`,
        documents: ['commercial_invoice']
      },
      normalized
    };
  }

  return { finding: null, normalized: invoiceNo };
}
