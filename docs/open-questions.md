# Open Questions & Ambiguities



## Current review-workflow limits (2026-10-10)



- [VERIFIED — shared/src/review.ts; web/src/components/ExtractedFieldsView.tsx] Corrections require evidence from an uploaded document and a reason; raw model observations remain unchanged. External broker facts belong in filing decision controls. Corrections cannot add/remove invoices or lines, or upload a new supporting document into an existing review.

- [VERIFIED — shared/src/schemas/shipment.schema.ts] Document metadata does not retain page counts; manual correction validation checks positive page numbers and known document IDs, but cannot independently verify the cited page exists or the snippet supports the correction. [UNKNOWN] A future document viewer and richer document metadata are needed for that verification.

- [VERIFIED — server/src/app.ts] Temporary uploads use expiring opaque tokens in one process, with no multi-user authentication or durable storage. [INFERRED — local submission scope] This is appropriate for the local demo workflow; deployment needs authenticated ownership, stronger resource controls, and persistent job handling before public use.

- [VERIFIED — web/src/App.tsx] Review decisions and correction history are not persisted across browser reloads. [UNKNOWN] Durable review sessions, actor identity and a full change-history export remain future work.

- [VERIFIED — server/src/checks/index.ts] Mode description "ocean" does not automatically become a numeric filing mode; missing EIN/bond/classification information remains unresolved. Material descriptions that differ in wording still receive conservative review. [UNKNOWN] Broker choices and regulatory completeness remain outside this UI phase.



[UNKNOWN] The original sample-specific entries below are historical AI-generated interpretations, not independently verified PDF or regulatory findings. Current scope and unresolved verification requirements are in the Phase 1 correction section at the end of this file.



This document tracks unresolved ambiguities and required decisions across documents, schema, and customs compliance rules. As mandated by Rule 4, ambiguities must be explicitly tracked here and never silently resolved.



---



## 1. Discrepancies & Ambiguities in Sample Shipment



### OQ-01: Commercial Invoice Line 1 Clerical Math Transposition

- **Documents involved**: Commercial Invoice (KBAS/NB/26-0912, Page 1)

- **Status**: [VERIFIED] Transposition typo on Line 1.

- **Evidence**:

  - Line 1 printed: 2,400 PCS @ \$2.85 = USD 6,480.00.

  - Computed: $2,400 \times 2.85 = 6,840.00$.

  - Page 1 subtotal carried forward is printed as \$21,975.00: $6,840 + 8,880 + 6,255 = 21,975$.

  - Total FOB printed is \$23,235.00: $21,975 + 1,260 = 23,235$.

- **Decision Needed**: When generating the entry, should line 1 entered value use the arithmetic truth (\$6,840.00) or as-printed (\$6,480.00) with a flagged reconciliation warning?



### OQ-02: Item 2 Quantity Discrepancy (Physical vs. Invoiced Short-Shipment)

- **Documents involved**: Commercial Invoice (Page 1) vs. Packing List (Page 1)

- **Status**: [VERIFIED] Physical quantity is 24 pieces less than invoiced.

- **Evidence**:

  - Commercial Invoice: Style NB-H205 lists 1,200 PCS @ \$7.40 = \$8,880.00.

  - Packing List: Cartons 49–97 = 49 cartons $\times$ 24 pcs/ctn = 1,176 PCS.

- **Decision Needed**: Customs entry summary (CBP 7501) requires declaring the entered quantity arriving in the US. Should the line item enter 1,176 PCS at \$8,702.40 ($1,176 \times 7.40$), or 1,200 PCS with an unmanifested shortage notice to CBP?



### OQ-03: Statutory Assist on Item 4 (Style W-B220)

- **Documents involved**: Commercial Invoice (Page 2, Note *) & Packing List (Remarks 2)

- **Status**: [VERIFIED] Buyer supplied fabric worth \$4,180.00 under PO NB-26-0918F for CMT manufacture.

- **Evidence**:

  - Commercial invoice line 4 lists CMT unit price \$2.10 = \$1,260.00.

  - Note (*): "Main fabric (100% polyester crepe de chine, 1,450 m) supplied free of charge by buyer under buyer's fabric P.O. NB-26-0918F, value USD 4,180.00, not included in this invoice."

  - 19 U.S.C. § 1401a defines buyer-supplied fabric as a statutory assist.

- **Decision Needed**: The assist value (\$4,180.00) must be apportioned to Item 4, yielding entered dutiable value of \$5,440.00 (\$1,260 + \$4,180). Both the invoice price and the assist addition must be surfaced clearly in the UI.



### OQ-04: Item 5 Origin & Valuation

- **Documents involved**: Commercial Invoice (Page 2, Line 5) & Packing List (Carton 138)

- **Status**: [VERIFIED] Multi-country origin.

- **Evidence**:

  - Line 5 is marked FOC samples, origin Bangladesh (BD), produced by SP Garments Dhaka Ltd.

  - Commercial value declared for customs only: \$1.00/pc $\times$ 24 pcs = \$24.00.

- **Decision Needed**: Whether entered under standard HTS 6106.10.0010 (dutiable at \$24.00, origin BD) or under duty-free Chapter 98 sample provisions (HTS 9811.00.60, requiring mutilated samples).



### OQ-05: Missing Importer Tax ID, Bond, and Broker Identifiers

- **Documents involved**: None (Missing from all shipping documents)

- **Status**: [UNKNOWN] Must be provided by user/broker.

- **Required Fields**:

  - Importer IRS EIN (Northbound Outfitters)

  - Ultimate Consignee Tax ID (Cascade Fulfillment Partners)

  - Bond Type (e.g., 8/9 continuous), Surety Code, Bond Account Number

  - Broker Filer Code and assigned Entry Number

  - Port FIRMS Code for Tacoma terminal





## Phase 1 correction and scope decisions (2026-10-09)



- [VERIFIED — server/src/checks/index.ts] Implementation scope is ocean modes 10/11 and entry type 01. Other profiles block readiness rather than use the sample's assumptions. This scope is not a claim to handle all unseen shipment types.

- [UNKNOWN] Authoritative Schedule D/K datasets and MID construction rules must be verified before automatic resolution is enabled. Previously asserted sample port/MID values are not endorsed by this implementation.

- [UNKNOWN] Tariff selection, statistical reporting units, specialized duties/fees/PGA requirements and legal filing completeness require qualified review. A broker confirmation is an assertion, not independent government validation.

- [VERIFIED — server/src/checks/money.ts, server/src/checks/index.ts] The implemented valuation policy uses explicit inclusion/exclusion of freight and insurance, reviewed USD conversion rates, integer cents, proportional allocation over commercial base amounts, and explicit sample/assist amounts. [UNKNOWN] Applicability of these choices to a particular shipment requires broker confirmation; no universal customs-law claim is made.

- [UNKNOWN] Distinct bills may describe overlapping cargo. Multiple bills therefore need a reviewed aggregate weight; duplicate containers and conflicting vessels remain blockers until shipment grouping is clarified.

- [VERIFIED — server/src/extraction/demo.ts] The AI answer key remains an unverified fixture. [UNKNOWN] Its field-level accuracy against the three PDFs has not been independently checked in this phase.

- [UNKNOWN] Live provider/model/effort, permitted spend, prompt design, budget enforcement and extraction evaluation are Phase 2 alignment items. No paid API calls were made in Phase 1.

- [VERIFIED — web/src/components/OpenItemsDrawer.tsx] Phase 1 exposes generic decisions and evidence inspection. [UNKNOWN] Full source correction/PDF review UX and deployed security/retention requirements are later-phase work.

## Commodity scope follow-up — 2026-10-09



- [VERIFIED — 2026-10-10 user confirmation; .env.example; server/src/extraction/extractor.ts] User selected Gemini free-tier use only. GEMINI_FREE_TIER_CONFIRMED was set true in the local environment without exposing or changing keys. Paid support and paid-budget estimation are outside this implementation; raising SPEND_CAP_USD does not enable paid calls. [UNKNOWN] Account billing status is user-confirmed rather than programmatically verified.

- [VERIFIED — docs/gemini-audit.md correction verification] The previously recorded Gemini integration regressions are fixed and covered by 46 passing automated tests. [UNKNOWN] Fresh live behavior of the revised prompt/effort settings and unseen-shipment extraction quality remain unmeasured. Historical cache is preserved but isolated by the new prompt version.



- [VERIFIED — docs/gemini-audit.md, 2026-10-10] Gemini sample observations pass 81 selected checks, but migration has completion-status, error-redaction, unit/country-normalization, budget/metrics and test regressions. [UNKNOWN] Actual free-tier eligibility and cost are not established by hardcoded zero metrics. Resolve these before further live evaluation.



- [VERIFIED — experiments/openrouter-extraction/availability.ts execution, https://openrouter.ai/api/v1/models] The requested qwen/qwen3.8-27b:free was absent from the live API catalog and returned HTTP 404. Its public model page did not establish API availability. The default remains unchanged pending an approved replacement.

- [VERIFIED — experiments/openrouter-extraction/run.ts execution] The user approved a Dots candidate evaluation without changing the default. The full extraction attempt reached the 180-second timeout without a usable result. [UNKNOWN] There is no Qwen baseline; no relative OCR-quality claim can be made.



- [VERIFIED — shared/src/schemas/shipment.schema.ts; server/src/builder/xml-builder.ts] Structured furniture/wood or other commodity-specific attributes and associated agency messages are not implemented; the builder emits a single tariff per line.

- [UNKNOWN] Which commodity profiles and conditional agency/trade-remedy requirements should be supported first? Generic shipment representation must not be presented as verified regulatory coverage.

- [INFERRED — server/src/builder/entry-service.ts and missing applicability rules] A future readiness gate should distinguish completed local checks from unresolved regulatory applicability; broker reference confirmation alone does not evaluate agency obligations.



## Reference audit and Task 3 — 2026-10-10



- [VERIFIED — docs/reference-audit.md] Tasks 1/2 have unresolved cache scope, confirmation evidence-binding, date validation and Schedule D data defects. [UNKNOWN] When should repairs be scheduled? Current authorization was audit plus Task 3 only; do not treat the earlier completion claims as source verification.

- [VERIFIED — server/data/reference/schedule-k/manifest.json] Task 3 pins the official Q2 2026 release, with release/upload dates but no established effective date or explicit license in the metadata. [UNKNOWN] Which historical releases and refresh policy should be supported before date-sensitive filing?

- [VERIFIED — server/src/reference/schedule-k.ts] Country hints accept source names, not ISO country codes. Cat Lai is not a published alias in the pinned workbook. [UNKNOWN] A verified terminal/parent-port source is needed before resolving that terminal automatically.

- [VERIFIED — current task boundary] Tasks 4–14 and UI integration remain deferred. [INFERRED — confirmation gaps in docs/reference-audit.md] Repair Task 1 evidence binding before allowing reference confirmations to affect readiness.



## Superseding reference repair status — 2026-10-10



- [VERIFIED — docs/handoff.md; server/test/reference/repair-regressions.test.ts] Tasks 1/2 audit defects have now been repaired and regression-tested. The preceding requests to schedule those repairs are resolved. Confirmation binding is implemented, but no HTTP confirmation-writing workflow or UI lookup application was added.

- [VERIFIED — shared/src/reference/data/schedule-d-manifest.json] Schedule D uses 429 Census snapshot records and no unverified alias mappings; effective-date selection and future source refresh remain open.

- [INFERRED — assignment/time constraints] Prioritize a complete review-to-XML demonstration, useful common normalization, ambiguous/non-apparel test cases and submission artifacts before expanding the entire table catalog or deployment. See the ordered proposal and future-work section in docs/handoff.md. Next phase requires approval.



## Review/export checkpoint — superseding integration status



- [VERIFIED — server/src/reference/port-workflow.ts; web/src/components/PortLookup.tsx] Port suggestions now apply through explicit user verification and are revalidated on generation/export. Historical statements above that lookup integration is absent are superseded. No persistent multi-user confirmation service was added.

- [VERIFIED — shared/src/schemas/shipment.schema.ts] Port names are not extracted as structured fields. [INFERRED] Manual document-name search is the bounded submission compromise; changing extraction schema/prompt/cache requires a separate quality check.

- [VERIFIED — docs/submission-priorities.md] Country completeness and XSD statistical-unit selection remain the highest-value small lookup improvements. SPI automation, full SCAC registry, live FX and broad transport/entry support are deferred proposals, not completed tasks.

- [UNKNOWN] Real-document walkthrough, interactive browser testing beyond the initial page, unseen-shipment OCR quality and final submission artifacts remain outstanding. Current 111 passing tests cover deterministic logic, API workflow and static UI rendering, not those measurements.





## Country and unit phase, 2026-10-10

- [VERIFIED — shared/src/reference/data/countries-manifest.json] Replaced the limited country table with 249 source-backed records. Generic Korea, Congo and Virgin Islands remain unresolved; select the specific territory after review. UNSD supplies 248 records; IANA supplies the additional TW region record and descriptions.

- [UNKNOWN — source snapshot] Historical applicability and CBP special country codes are not established. Broader aliases and refresh automation remain future work.

- [VERIFIED — statistical-units.ts] All 82 XSD statistical-unit codes are selectable and validated. [UNKNOWN] Which units and quantities apply to a selected HTS classification still requires external review. No automatic conversion is performed.



## Frontend phase verification limits
- [VERIFIED - EvidencePanel.tsx] PDF page navigation uses the browser viewer and a page fragment; saved reviews omit original PDFs. Hash matching is required when the document carries a hash; legacy records use unique filename matching with a notice.
- [UNKNOWN - browser walkthrough] Final desktop/mobile interactions, PDF rendering and complete sample walkthrough remain unverified. Local frontend/backend returned HTTP 200, but the in-app browser timed out after an initial saved-review restore/navigation. No live extraction was used to test the UI.
- [VERIFIED - build output] Frontend bundle exceeds Vite's 500 KB warning threshold. [INFERRED] Lazy loading reference-heavy review screens would improve first-load performance; it is deferred from this phase.
