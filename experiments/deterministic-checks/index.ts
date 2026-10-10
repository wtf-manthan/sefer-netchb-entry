/**
 * Deterministic Checks Engine (Task T5)
 * 
 * Aggregates all pure validation rules:
 * - Line math & rollups (F01)
 * - Quantity reconciliation (F02)
 * - Fiber content reconciliation (F03)
 * - Gross weight reconciliation (F04)
 * - ISO 6346 container check digit & strikethrough (F05)
 * - Mixed country of origin (F06)
 * - Free samples valuation (F07)
 * - Buyer assists (F08)
 * - CIF non-dutiable charges (F09)
 * - Date ambiguity (F10)
 * - Invoice number syntax normalization (F11)
 * - Filing readiness & missing fields (F12 - F21)
 */

export * from './types';
export * from './iso6346';
export * from './line-math';
export * from './reconciliation';
export * from './date-checks';
export * from './origin-checks';
export * from './readiness-checks';

import { Finding, ShipmentInputData } from './types';
import { checkContainerNumber } from './iso6346';
import { checkInvoiceLineMath, checkNonDutiableCharges, checkInvoiceNumber } from './line-math';
import { reconcileQuantities, reconcileFiberContent, reconcileGrossWeight, checkAssistsAndSamples } from './reconciliation';
import { checkCountryOfOrigin } from './origin-checks';
import { checkDateAmbiguity } from './date-checks';
import { checkFilingReadiness } from './readiness-checks';

export function runAllDeterministicChecks(data: ShipmentInputData): {
  findings: Finding[];
  blockerCount: number;
  decisionCount: number;
  verifyCount: number;
  infoCount: number;
} {
  const allFindings: Finding[] = [];

  const invoice = data.commercialInvoice;
  const pl = data.packingList;
  const bl = data.billOfLading;

  // 1. Line Math (F01)
  if (invoice?.lineItems) {
    const mathRes = checkInvoiceLineMath(
      invoice.lineItems,
      invoice.subtotalPage1,
      invoice.totalAmountUsd
    );
    allFindings.push(...mathRes.findings);
  }

  // 2. Quantity Reconciliation (F02)
  if (invoice?.lineItems && pl?.lines) {
    const qtyFindings = reconcileQuantities(invoice.lineItems, pl.lines);
    allFindings.push(...qtyFindings);
  }

  // 3. Fiber Content Reconciliation (F03)
  if (invoice?.lineItems && pl?.lines) {
    const fiberFindings = reconcileFiberContent(invoice.lineItems, pl.lines);
    allFindings.push(...fiberFindings);
  }

  // 4. Gross Weight Reconciliation (F04)
  if (bl?.grossWeightKg !== undefined && pl?.totalGwKg !== undefined) {
    const gwFinding = reconcileGrossWeight(
      bl.grossWeightKg,
      pl.totalGwKg,
      pl.palletized
    );
    if (gwFinding) allFindings.push(gwFinding);
  }

  // 5. Container Number & ISO 6346 Check Digit (F05)
  if (bl?.container?.numberFinal) {
    const containerFinding = checkContainerNumber(
      bl.container.numberFinal,
      bl.container.numberPrintedStruckThrough
    );
    if (containerFinding) allFindings.push(containerFinding);
  }

  // 6. Mixed Origin (F06)
  if (invoice?.countryOfOriginHeader && invoice?.lineItems && pl?.lines) {
    const originFinding = checkCountryOfOrigin(
      invoice.countryOfOriginHeader,
      invoice.lineItems,
      pl.lines,
      pl.remarks
    );
    if (originFinding) allFindings.push(originFinding);
  }

  // 7. Free Samples & Assists (F07, F08)
  if (invoice?.lineItems) {
    const assistFindings = checkAssistsAndSamples(
      invoice.lineItems,
      invoice.remarks,
      pl?.remarks
    );
    allFindings.push(...assistFindings);
  }

  // 8. CIF Non-Dutiable Charges (F09)
  if (invoice?.incoterms) {
    const cifFinding = checkNonDutiableCharges(
      invoice.incoterms,
      invoice.freightChargesUsd,
      invoice.insuranceChargesUsd,
      invoice.totalAmountUsd
    );
    if (cifFinding) allFindings.push(cifFinding);
  }

  // 9. Date Ambiguity (F10)
  if (invoice?.invoiceDateRaw) {
    const dateFinding = checkDateAmbiguity(
      invoice.invoiceDateRaw,
      '24-SEP-2026',
      '20-Sep-2026'
    );
    if (dateFinding) allFindings.push(dateFinding);
  }

  // 10. Invoice Number Syntax (F11)
  if (invoice?.invoiceNo) {
    const invCheck = checkInvoiceNumber(invoice.invoiceNo);
    if (invCheck.finding) allFindings.push(invCheck.finding);
  }

  // 11. Filing Readiness & Missing Fields (F12 - F21)
  const readinessFindings = checkFilingReadiness(data);
  allFindings.push(...readinessFindings);

  // Sort findings by code F01..F21
  allFindings.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return {
    findings: allFindings,
    blockerCount: allFindings.filter(f => f.severity === 'BLOCKER').length,
    decisionCount: allFindings.filter(f => f.severity === 'NEEDS_DECISION').length,
    verifyCount: allFindings.filter(f => f.severity === 'VERIFY').length,
    infoCount: allFindings.filter(f => f.severity === 'INFO').length,
  };
}
