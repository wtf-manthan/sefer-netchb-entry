# Experiment: Deterministic Checks Engine (Task T5)

## Overview
This experiment implements the pure TypeScript deterministic validation and cross-document reconciliation engine for commercial customs shipments.

Under the project architecture, **the LLM is never trusted to do arithmetic, cross-document reconciliation, or container check digit validation**. Instead, pure deterministic functions inspect extracted data, cross-reference documents, apply statutory rules (e.g. 19 U.S.C. § 1401a for assists), and emit structured findings.

## Ground Truth Reconciliation
Tested against `/samples/ground-truth.json`, the engine achieves **100% detection (21 out of 21 findings)**:

- **BLOCKERS (3)**:
  - `F13`: Importer EIN / tax ID missing from all documents.
  - `F14`: Continuous/Single Entry Bond info missing.
  - `F15`: 10-digit HTS missing (only 6-digit HS headings provided: 6109.10, 6110.20, 6203.42, 6206.40, 6106.10).
- **NEEDS_DECISION (9)**:
  - `F01`: Invoice line 1 math typo ($2,400 \times \$2.85 = \$6,840$ computed vs $\$6,480$ printed; page 1 subtotal only reconciles with \$6,840).
  - `F02`: Hoodie quantity mismatch (Invoice 1,200 vs Packing List 1,176 / 49 ctns x 24).
  - `F06`: Mixed country of origin (Line 5 / Carton 138 made in Bangladesh; BL and header say Vietnam).
  - `F07`: Free samples valuation for customs (\$1.00/pc, \$24.00 total excluded from invoice total).
  - `F08`: Possible assist (1,450 m fabric USD \$4,180 supplied free for style W-B220 CMT price).
  - `F12`: Ultimate consignee ambiguity (Cascade Fulfillment is 3PL receiving "for account of" Northbound Outfitters).
  - `F16`: Entry date and broker filer code not in commercial documents.
  - `F18`: Manufacturer identifiers (MID) missing (Saigon Phoenix VN vs SP Garments BD).
  - `F19`: Related party status Y/N unknown for HK sourcing agent.
- **VERIFY (8)**:
  - `F03`: Hoodie fiber content mismatch (Invoice 60/40 cotton/poly vs Packing List TC 65/35).
  - `F04`: Gross weight mismatch (BL 1,930 kg vs Packing List 1,888 kg; diff 42 kg; unpalletized).
  - `F05`: Container number handwritten correction (`OPLU3041728` struck through $\to$ `OPLU3041722`; ISO 6346 check digit confirms 2 is valid, 8 is invalid).
  - `F09`: CIF non-dutiable charges (\$3,850 freight + \$185 insurance = \$4,035 header charges).
  - `F10`: Ambiguous date format (`12/09/2026`; chronology with ETD 24-Sep-2026 infers DD/MM 12-Sep-2026).
  - `F17`: Port codes (Schedule D for Tacoma: 3002, Schedule K for Cat Lai: 55201).
  - `F20`: ISF status (BL says filed by importer/agent, but filing not evidenced).
  - `F21`: Customs broker not yet named (BL notify: "ALSO NOTIFY: CUSTOMS BROKER (TBA)").
- **INFO (1)**:
  - `F11`: Invoice number syntax normalization (`KBAS/NB/26-0912` contains slashes; normalized to `KBAS-NB-26-0912` for NetCHB `[A-Za-z0-9-]{1,17}`).

## How to Rerun the Experiment

```bash
npx tsx --test experiments/deterministic-checks/deterministic-checks.test.ts
```

All 12 unit tests and the end-to-end ground truth assertion pass in under 500ms without any network or API dependencies.
