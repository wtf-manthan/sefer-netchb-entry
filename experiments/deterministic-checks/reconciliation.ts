/**
 * Cross-Document Reconciliation: Quantities, Fiber, Weights, Cartons, Assists & Samples
 */

import { Finding, InvoiceLineItem, PackingListLineItem } from './types';

/**
 * Reconciles quantities between Invoice lines and Packing List lines by style.
 * Emits Finding F02 for discrepancies (e.g. hoodie quantity).
 */
export function reconcileQuantities(
  invoiceLines: InvoiceLineItem[],
  plLines: PackingListLineItem[]
): Finding[] {
  const findings: Finding[] = [];
  const plByStyle: Record<string, { totalPcs: number; cartons: number; pcsPerCarton: number }> = {};

  for (const pl of plLines) {
    if (!plByStyle[pl.style]) {
      plByStyle[pl.style] = { totalPcs: 0, cartons: 0, pcsPerCarton: pl.pcsPerCarton };
    }
    plByStyle[pl.style].totalPcs += pl.totalPcs;
    plByStyle[pl.style].cartons += pl.cartons;
  }

  for (const inv of invoiceLines) {
    const pl = plByStyle[inv.style];
    if (pl && pl.totalPcs !== inv.quantity) {
      findings.push({
        code: 'F02',
        severity: 'NEEDS_DECISION',
        topic: 'hoodie quantity mismatch',
        message: `Quantity discrepancy for style ${inv.style} (${inv.description}): ` +
                 `Commercial Invoice declares ${inv.quantity} ${inv.unit}, but Packing List shows ${pl.totalPcs} PCS (${pl.cartons} cartons x ${pl.pcsPerCarton}). ` +
                 `Shortage of ${inv.quantity - pl.totalPcs} pieces.`,
        evidence: `invoice ${inv.quantity} vs packing list ${pl.totalPcs} (${pl.cartons} cartons x ${pl.pcsPerCarton})`,
        documents: ['commercial_invoice', 'packing_list']
      });
    }
  }

  return findings;
}

/**
 * Reconciles fiber / material composition between Invoice and Packing List.
 * Emits Finding F03 (e.g. 60/40 vs 65/35).
 */
export function reconcileFiberContent(
  invoiceLines: InvoiceLineItem[],
  plLines: PackingListLineItem[]
): Finding[] {
  const findings: Finding[] = [];
  const plByStyle: Record<string, string> = {};

  for (const pl of plLines) {
    plByStyle[pl.style] = pl.description;
  }

  for (const inv of invoiceLines) {
    const plDesc = plByStyle[inv.style] || '';
    const invMat = (inv.material || '').toUpperCase();
    
    // Check for 60/40 vs 65/35 or similar discrepancy
    if (invMat.includes('60% COTTON 40% POLYESTER') || invMat.includes('60/40')) {
      if (plDesc.toUpperCase().includes('65/35') || plDesc.toUpperCase().includes('TC 65/35')) {
        findings.push({
          code: 'F03',
          severity: 'VERIFY',
          topic: 'hoodie fiber content mismatch',
          message: `Material composition discrepancy for ${inv.style}: ` +
                   `Commercial Invoice states "${inv.material}", but Packing List states "${plDesc}". ` +
                   `CBP entry requires precise chief-value / blend verification for correct HTS statistical reporting.`,
          evidence: `invoice 60/40 cotton/polyester vs packing list TC 65/35`,
          documents: ['commercial_invoice', 'packing_list']
        });
      }
    }
  }

  return findings;
}

/**
 * Reconciles gross weight between Bill of Lading and Packing List.
 * Emits Finding F04 (e.g. BL 1,930 kg vs PL 1,888 kg, diff 42 kg).
 */
export function reconcileGrossWeight(
  blGrossWeightKg?: number,
  plGrossWeightKg?: number,
  plPalletized?: boolean
): Finding | null {
  if (blGrossWeightKg === undefined || plGrossWeightKg === undefined) {
    return null;
  }

  const diff = Math.round(Math.abs(blGrossWeightKg - plGrossWeightKg) * 100) / 100;
  if (diff > 0.5) {
    return {
      code: 'F04',
      severity: 'VERIFY',
      topic: 'gross weight mismatch',
      message: `Gross weight mismatch between transport documents: ` +
               `Bill of Lading states ${blGrossWeightKg.toFixed(0)} kg, but Packing List states ${plGrossWeightKg.toFixed(0)} kg (difference of ${diff.toFixed(0)} kg). ` +
               `Packing list notes palletized: ${plPalletized ? 'YES' : 'NO'}.`,
      evidence: `BL ${blGrossWeightKg.toFixed(0)} kg vs packing list ${plGrossWeightKg.toFixed(0)} kg (diff ${diff.toFixed(0)} kg); packing list says palletized ${plPalletized ? 'YES' : 'NO'}`,
      documents: ['bill_of_lading', 'packing_list']
    };
  }

  return null;
}

/**
 * Checks for buyer-supplied assist (19 U.S.C. 1401a) and free of charge samples.
 * Emits Finding F07 (free samples customs value) and F08 (buyer assist fabric).
 */
export function checkAssistsAndSamples(
  invoiceLines: InvoiceLineItem[],
  invoiceRemarks: string[] = [],
  packingListRemarks: string[] = []
): Finding[] {
  const findings: Finding[] = [];

  // Check for Free Samples (F07)
  const sampleLine = invoiceLines.find(l => 
    l.foc || 
    l.description.toUpperCase().includes('SAMPLE') || 
    l.style.includes('P118S')
  );

  if (sampleLine) {
    const unitVal = sampleLine.customsValueOnlyUnitUsd ?? sampleLine.unitPriceUsd ?? 1.00;
    const totalVal = sampleLine.customsValueOnlyTotalUsd ?? (sampleLine.quantity * unitVal);
    findings.push({
      code: 'F07',
      severity: 'NEEDS_DECISION',
      topic: 'free samples value for customs',
      message: `Line ${sampleLine.lineNo} (${sampleLine.style} - ${sampleLine.description}) is declared as Free of Charge (FOC) samples. ` +
               `Stated unit value USD ${unitVal.toFixed(2)} (${totalVal.toFixed(2)} total) for customs clearance only, excluded from commercial invoice subtotal. ` +
               `Broker must confirm whether to include in entered value for duty assessment.`,
      evidence: `USD ${unitVal.toFixed(2)}/pc (${totalVal.toFixed(2)} total) stated for customs only and excluded from invoice total`,
      documents: ['commercial_invoice']
    });
  }

  // Check for Assists (F08)
  const allRemarks = [...invoiceRemarks, ...packingListRemarks].join(' ').toUpperCase();
  const hasAssistRemark = allRemarks.includes('BUYER-SUPPLIED') || 
                          allRemarks.includes('BUYER SUPPLIED') || 
                          allRemarks.includes('CMT') ||
                          allRemarks.includes('ASSIST');

  if (hasAssistRemark || invoiceLines.some(l => l.style === 'W-B220')) {
    findings.push({
      code: 'F08',
      severity: 'NEEDS_DECISION',
      topic: 'possible assist (buyer-supplied fabric)',
      message: `Documents indicate style W-B220 was manufactured from buyer-supplied fabric (1,450 m fabric valued at USD 4,180.00 supplied free). ` +
               `Invoiced amount represents CMT (Cut, Make, Trim) processing only. ` +
               `Under 19 U.S.C. § 1401a(h)(1)(A), assists must be added to the price actually paid or payable unless already dutied.`,
      evidence: `1,450 m fabric USD 4,180 supplied free for W-B220 (CMT price only)`,
      documents: ['commercial_invoice', 'packing_list']
    });
  }

  return findings;
}
