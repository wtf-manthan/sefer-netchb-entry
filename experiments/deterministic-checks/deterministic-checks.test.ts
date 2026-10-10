/**
 * Unit Tests for Deterministic Checks Engine (Task T5)
 * 
 * Tests pure functions and verifies 100% detection of all 21 traps / expected findings
 * against samples/ground-truth.json.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  calculateIso6346CheckDigit,
  validateContainerNumber,
  checkContainerNumber,
} from './iso6346';
import {
  checkInvoiceLineMath,
  checkNonDutiableCharges,
  checkInvoiceNumber,
} from './line-math';
import {
  reconcileQuantities,
  reconcileFiberContent,
  reconcileGrossWeight,
  checkAssistsAndSamples,
} from './reconciliation';
import { checkCountryOfOrigin } from './origin-checks';
import { checkDateAmbiguity } from './date-checks';
import { checkFilingReadiness } from './readiness-checks';
import { runAllDeterministicChecks, ShipmentInputData } from './index';

describe('T5 Deterministic Checks: ISO 6346 Container Algorithm', () => {
  it('correctly calculates check digit for OPLU304172 (expected: 2)', () => {
    const checkDigit = calculateIso6346CheckDigit('OPLU304172');
    assert.strictEqual(checkDigit, 2);
  });

  it('validates corrected container OPLU3041722 as VALID', () => {
    const result = validateContainerNumber('OPLU3041722');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.actualCheckDigit, 2);
    assert.strictEqual(result.expectedCheckDigit, 2);
  });

  it('detects struck-through printed container OPLU3041728 as INVALID', () => {
    const result = validateContainerNumber('OPLU3041728');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.actualCheckDigit, 8);
    assert.strictEqual(result.expectedCheckDigit, 2);
  });

  it('emits Finding F05 for struck-through handwritten correction', () => {
    const finding = checkContainerNumber('OPLU3041722', 'OPLU3041728');
    assert.ok(finding);
    assert.strictEqual(finding?.code, 'F05');
    assert.strictEqual(finding?.severity, 'VERIFY');
  });
});

describe('T5 Deterministic Checks: Line Math & Invoice Normalization', () => {
  it('detects Line 1 math discrepancy (2400 x 2.85 = 6840 vs printed 6480)', () => {
    const lines = [
      {
        lineNo: 1,
        style: 'NB-T101',
        description: "MEN'S CREW NECK T-SHIRT",
        quantity: 2400,
        unit: 'PCS',
        unitPriceUsd: 2.85,
        amountUsdAsPrinted: 6480.00,
      },
    ];

    const result = checkInvoiceLineMath(lines, 21975.00, 23235.00);
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].code, 'F01');
    assert.strictEqual(result.findings[0].severity, 'NEEDS_DECISION');
    assert.strictEqual(result.computedSum, 6840.00);
    assert.strictEqual(result.printedSum, 6480.00);
  });

  it('normalizes invoice number KBAS/NB/26-0912 and emits F11 for slashes', () => {
    const check = checkInvoiceNumber('KBAS/NB/26-0912');
    assert.ok(check.finding);
    assert.strictEqual(check.finding?.code, 'F11');
    assert.strictEqual(check.finding?.severity, 'INFO');
    assert.strictEqual(check.normalized, 'KBAS-NB-26-0912');
  });

  it('identifies CIF non-dutiable freight and insurance charges (F09)', () => {
    const finding = checkNonDutiableCharges('CIF TACOMA, WA', 3850, 185, 23235, 27270);
    assert.ok(finding);
    assert.strictEqual(finding?.code, 'F09');
    assert.strictEqual(finding?.severity, 'VERIFY');
  });
});

describe('T5 Deterministic Checks: Cross-Document Reconciliation', () => {
  it('detects hoodie quantity shortage (Invoice 1200 vs PL 1176)', () => {
    const invLines = [
      {
        lineNo: 2,
        style: 'NB-H205',
        description: 'HOODIE',
        quantity: 1200,
        unit: 'PCS',
        unitPriceUsd: 7.40,
        amountUsdAsPrinted: 8880.00,
      },
    ];
    const plLines = [
      {
        cartonRange: '61-109',
        cartonFirst: 61,
        cartonLast: 109,
        style: 'NB-H205',
        description: 'HOODIE TC 65/35',
        cartons: 49,
        pcsPerCarton: 24,
        totalPcs: 1176,
        totalNwKg: 490,
        totalGwKg: 539,
      },
    ];

    const findings = reconcileQuantities(invLines, plLines);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].code, 'F02');
    assert.strictEqual(findings[0].severity, 'NEEDS_DECISION');
  });

  it('detects hoodie fiber content mismatch (Invoice 60/40 vs PL TC 65/35)', () => {
    const invLines = [
      {
        lineNo: 2,
        style: 'NB-H205',
        description: 'HOODIE',
        material: '60% Cotton 40% Polyester brushed fleece',
        quantity: 1200,
        unit: 'PCS',
        unitPriceUsd: 7.40,
        amountUsdAsPrinted: 8880.00,
      },
    ];
    const plLines = [
      {
        cartonRange: '61-109',
        cartonFirst: 61,
        cartonLast: 109,
        style: 'NB-H205',
        description: "WOMEN'S PULLOVER HOODIE, TC 65/35 FLEECE",
        cartons: 49,
        pcsPerCarton: 24,
        totalPcs: 1176,
        totalNwKg: 490,
        totalGwKg: 539,
      },
    ];

    const findings = reconcileFiberContent(invLines, plLines);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].code, 'F03');
    assert.strictEqual(findings[0].severity, 'VERIFY');
  });

  it('detects gross weight mismatch (BL 1930 kg vs PL 1888 kg)', () => {
    const finding = reconcileGrossWeight(1930.0, 1888.0, false);
    assert.ok(finding);
    assert.strictEqual(finding?.code, 'F04');
    assert.strictEqual(finding?.severity, 'VERIFY');
  });

  it('detects free samples (F07) and buyer assist (F08)', () => {
    const lines = [
      {
        lineNo: 4,
        style: 'W-B220',
        description: 'LADIES WOVEN BLOUSE',
        quantity: 600,
        unit: 'PCS',
        unitPriceUsd: 2.10,
        amountUsdAsPrinted: 1260.00,
      },
      {
        lineNo: 5,
        style: 'NB-P118S',
        description: 'LADIES POLO - SAMPLES (FOC)',
        quantity: 24,
        unit: 'PCS',
        unitPriceUsd: 1.00,
        amountUsdAsPrinted: 24.00,
        foc: true,
      },
    ];
    const invRemarks = ['Style W-B220: CMT price only; buyer-supplied fabric 1450m'];
    const plRemarks = ['Carton 138: FOC samples Produced at SP Garments Dhaka Bangladesh'];

    const findings = checkAssistsAndSamples(lines, invRemarks, plRemarks);
    assert.strictEqual(findings.length, 2);
    assert.ok(findings.some(f => f.code === 'F07' && f.severity === 'NEEDS_DECISION'));
    assert.ok(findings.some(f => f.code === 'F08' && f.severity === 'NEEDS_DECISION'));
  });
});

describe('T5 Deterministic Checks: End-to-End against Ground Truth Fixture', () => {
  it('detects ALL 21 findings (F01 through F21) in the sample shipment', () => {
    const groundTruthPath = path.resolve(__dirname, '../../samples/ground-truth.json');
    const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));

    // Construct shipment input data matching ground truth
    const shipmentData: ShipmentInputData = {
      commercialInvoice: {
        invoiceNo: groundTruth.commercial_invoice.invoice_no,
        invoiceDateRaw: groundTruth.commercial_invoice.invoice_date_raw,
        incoterms: groundTruth.commercial_invoice.incoterms,
        freightChargesUsd: groundTruth.commercial_invoice.freight_usd,
        insuranceChargesUsd: groundTruth.commercial_invoice.insurance_usd,
        countryOfOriginHeader: groundTruth.commercial_invoice.country_of_origin_header,
        lineItems: groundTruth.commercial_invoice.line_items.map((l: any) => ({
          lineNo: l.line_no,
          style: l.style,
          description: l.description,
          material: l.material,
          hsCode: l.hs_code,
          quantity: l.quantity,
          unit: l.unit,
          unitPriceUsd: l.unit_price_usd,
          amountUsdAsPrinted: l.amount_usd_as_printed,
          customsValueOnlyUnitUsd: l.customs_value_only_unit_usd,
          customsValueOnlyTotalUsd: l.customs_value_only_total_usd,
          origin: l.country_of_origin_line,
          foc: l.foc,
        })),
        subtotalPage1: groundTruth.commercial_invoice.subtotal_page_1_as_printed,
        totalAmountUsd: groundTruth.commercial_invoice.total_amount_usd_as_printed,
        remarks: [
          'Style W-B220 sewn from buyer-supplied fabric (Ref. NB-26-0918F).',
          'Carton No. 138: FOC samples produced at sister unit SP Garments Dhaka Ltd., Bangladesh.',
        ],
        buyerSoldTo: { name: groundTruth.commercial_invoice.buyer_sold_to.name, ein: null },
      },
      packingList: {
        lines: groundTruth.packing_list.rows.map((p: any) => ({
          cartonRange: p.carton_range,
          cartonFirst: p.carton_first,
          cartonLast: p.carton_last,
          style: p.style,
          description: p.description,
          cartons: p.cartons,
          pcsPerCarton: p.pcs_per_carton,
          totalPcs: p.total_pcs,
          totalNwKg: p.total_nw_kg,
          totalGwKg: p.total_gw_kg,
        })),
        totalCartons: groundTruth.packing_list.grand_total.cartons,
        totalPcs: groundTruth.packing_list.grand_total.pcs,
        totalGwKg: groundTruth.packing_list.grand_total.total_gw_kg,
        palletized: groundTruth.packing_list.palletized,
        remarks: groundTruth.packing_list.remarks,
      },
      billOfLading: {
        houseBlNo: groundTruth.bill_of_lading.house_bl_no,
        masterBlNo: groundTruth.bill_of_lading.master_bl_no,
        container: {
          numberPrintedStruckThrough: groundTruth.bill_of_lading.container.number_printed_struck_through,
          numberHandwrittenCorrection: groundTruth.bill_of_lading.container.number_handwritten_correction,
          numberFinal: groundTruth.bill_of_lading.container.number_final,
        },
        grossWeightKg: groundTruth.bill_of_lading.gross_weight_kg,
        numberOfPackages: groundTruth.bill_of_lading.number_of_packages,
        originOfGoods: groundTruth.bill_of_lading.origin_of_goods,
        portOfLoading: groundTruth.bill_of_lading.port_of_loading,
        portOfDischarge: groundTruth.bill_of_lading.port_of_discharge,
        consignee: groundTruth.bill_of_lading.consignee,
        notifyParty: groundTruth.bill_of_lading.notify_party,
        isfFiledBy: groundTruth.bill_of_lading.isf_filed_by,
      },
      customsFilingData: {
        importerEin: null,
        bondType: null,
        suretyCode: null,
        bondNumber: null,
        brokerFilerCode: null,
        entryDate: null,
        entryPortCode: null,
        foreignPortCode: null,
        mids: null,
        relatedParty: null,
      },
    };

    const result = runAllDeterministicChecks(shipmentData);

    // Verify finding counts
    console.log(`Detected ${result.findings.length} findings:`);
    console.log(`- BLOCKERS: ${result.blockerCount}`);
    console.log(`- NEEDS_DECISION: ${result.decisionCount}`);
    console.log(`- VERIFY: ${result.verifyCount}`);
    console.log(`- INFO: ${result.infoCount}`);

    // Assert that every expected finding code F01 through F21 is present!
    const expectedFindingCodes = groundTruth.expected_findings.map((f: any) => f.id);
    for (const code of expectedFindingCodes) {
      const found = result.findings.find(f => f.code === code);
      assert.ok(found, `Expected finding ${code} was NOT detected!`);
    }

    assert.strictEqual(result.findings.length, 21);
    assert.strictEqual(result.blockerCount, 3); // F13, F14, F15
    assert.strictEqual(result.decisionCount, 9); // F01, F02, F06, F07, F08, F12, F16, F18, F19
    assert.strictEqual(result.verifyCount, 8); // F03, F04, F05, F09, F10, F17, F20, F21
    assert.strictEqual(result.infoCount, 1); // F11
  });
});
