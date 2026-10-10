# Architecture and Codebase Survey Report: Reference-Data & Test Setup

## 1. Observation

### 1.1 Repository Structure, Workspaces, and Dependencies
- Workspaces: shared, server, web
- Scripts: build (npm run build --workspaces), test (npm run build -w shared && node --import tsx --test server/test/*.test.ts)
- Engines: Node ^24.0.0 (v24.18.0 LTS), npm ^12.0.0 (v12.2.0)
- TypeScript: tsx ^4.23.15, typescript ^5.5.0, xmllint-wasm ^5.3.0, zod ^3.23.8 / ^4.6.5

### 1.2 Verification of Build & Test Status
- npm run build: exit code 0, 1535 modules transformed in 35.41s across shared, server, web
- npm test: exit code 0, 55 tests pass, 0 fail across api, core, extraction, normalization, review-workflow suites in 7.5s
- xsd-validation: exit code 0, 7/7 XML test fixtures correctly validated using xmllint-wasm
- deterministic-checks: exit code 0, 12/12 tests pass, 100% trap detection on ground truth
- hts-lookup: exit code 0, 1/1 test passes, live USITC REST endpoint expands 6109.10 to 14 10-digit candidates

### 1.3 Exact Locations of Existing Contracts, Schemas, Resolvers
- Extraction Contract: shared/src/types/field.ts & schemas/field.schema.ts (SourceReference, ExtractedField<T>, FieldStatus)
- Shipment Schema: shared/src/schemas/shipment.schema.ts (RawExtractedShipment, documents, invoices, packingLists, bills, mot)
- Broker Decisions Schema: shared/src/schemas/decisions.schema.ts (BrokerDecisions, observationCorrections, lineDecisions, invoiceDecisions, containerOverrides, acknowledgements, customsFiling)
- Findings Contract: shared/src/types/findings.ts (StructuredFinding)
- Review Corrections: shared/src/review.ts (applyObservationCorrections)
- Reference Data in @sefer/shared: shared/src/reference/ (bond-types: 00/08/09; countries: 21 entries; currencies: 8 entries + US_STATES; entry-types: 01; mot: 11 modes; uom: 10 units)
- Resolvers & Checks: server/src/checks/index.ts (resolveShipment, fingerprinted findings code:entity:sha256(evidence)); money.ts; iso6346.ts
- XML Builder & Validator: server/src/builder/xml-builder.ts (serializeResolvedEntry), entry-service.ts (generateEntry, dual validation statuses), xml-validator.ts (NetChbXmlValidator using xmllint-wasm)
- Stubs: server/src/reference/schedule-d.ts (null), schedule-k.ts (null), mid.ts (error), hts.ts (memory Map cache)

### 1.4 XML Schema Constraints Discovered from Local Schemas (spec/)
- Port Types: data:portType (pattern \\d{4}) for processing-port, entry-port, unlading-port; data:foreignPortType (pattern \\d{5}) for lading-port (Schedule K foreign port strictly 5 numeric digits; UN/LOCODE alphanumeric codes invalid).
- Transport Mode: data:modeTransportType in spec/data_type.xsd has 15 enumerations (10, 11, 12, 20, 21, 30, 31, 32, 33, 34, 40, 41, 50, 60, 70). Missing in mot.ts: 12, 32, 33, 34. Element name in entry.xsd is mode-transportation.
- Entry Type: data:entryType has 43 enumerations (01 through 86). Supported profile is strictly 01 (Formal Consumption).
- Bond Type: entry:bondType in spec/entry.xsd has 00, 08, 09 (00 waiver, 08 continuous, 09 single). CustomsFilingCredentialsSchema currently restricts bondType to 08/09, omitting valid 00.
- Unit of Measure: data:unitOfMeasureType has 82 enumerations from CBP CATAIR Appendix C. uom.ts has only 10.
- Tariff Number: data:tariffNoType pattern \\d{5,10}; entry summary profile requires 10-digit HTS.
- Carrier Code: data:carrierCodeType pattern \\w{2}|\\w{4}|\\*{1}[\\*\\w]{1}.
- Special Program: data:specialProgramType maxLength 2; secondarySpecialProgramType maxLength 1.
- US States: data:usStateType has 53 enumerations (50 states + DC + PR + VI).

## 2. Logic Chain

### 2.1 Preserving Extraction Observations While Integrating Reference Data
- Observation: shared/src/types/field.ts defines ExtractedField<T> with {value, status, source, confidence}. Tests in server/test/normalization.test.ts (lines 10, 16) assert JSON.stringify(shipment) is unchanged before and after resolution.
- Inference: Reference lookups must NOT mutate RawExtractedShipment or fabricate PDF page references for web/DB data.
- Deduction: Reference results must live in a separate LookupResult<T> contract in @sefer/shared, feeding suggestions to the broker without altering raw document observations.

### 2.2 Keeping XML Generation Deterministic & Network-Independent
- Observation: web/src/App.tsx triggers POST /api/entry on every change with a 200ms debounce. xml-builder.ts is a synchronous pure serialization function.
- Inference: Running external lookups on /api/entry would create latency, rate-limit failures, and non-deterministic behavior.
- Deduction: All reference data must be local or disk-cached; external lookups run on-demand via dedicated endpoints (/api/hts/lookup, /api/reference/*) and never in the /api/entry hot path.

### 2.3 Scoped Invalidation of Confirmations
- Observation: Finding IDs are fingerprinted with code:entity:sha256(evidence). Changing evidence invalidates acknowledgements automatically without resetting unrelated findings.
- Inference: Reference confirmation must use identical scoped invalidation.
- Deduction: Reference confirmations bind to sha256(query + datasetVersion + candidateCode). Changing evidence or query invalidates only the affected confirmation.

## 3. Detailed Gaps & Integration Touchpoints for Tasks 1-14

- Task 1 (Reference Infrastructure): Create shared LookupResult contract in @sefer/shared with 10 required attributes (category, targetField, query, outcome, candidateCode/description, source URL/publisher/version, dates, matching method, missing facts, review state, fingerprint). Create disk cache in .cache/reference/ and dataset manifests.
- Task 2 (Schedule D / US Ports): Bundle Census Schedule D (4-digit code); implement normalized lookup by code/name/region; support processing vs entry vs unlading port roles; return candidates for ambiguous ports; expose via /api/reference/ports.
- Task 3 (Schedule K / Foreign Ports): Bundle Census Schedule K (5-digit code); implement lookup with country filter; reject alphanumeric UN/LOCODE; expose via /api/reference/ports.
- Task 4 (Country Codes): Expand COUNTRIES in shared/src/reference/countries.ts from 21 to full ISO 3166-1 alpha-2 list with aliases; preserve document text in extraction.
- Task 5 (Currency Codes): Expand CURRENCIES to full ISO 4217 list; separate active vs historical; separate US_STATES into dedicated module; preserve explicit broker conversion decision without fake market rates.
- Task 6 (Transport Modes): Add missing codes 12, 32, 33, 34 to MODES_OF_TRANSPORT; suggest mode with evidence; block unsupported profiles.
- Task 7 (Entry Types): Populate all 43 schema entry types in entry-types.ts; mark 01 as supported profile and others as blocked.
- Task 8 (Bond Types): Update CustomsFilingCredentialsSchema to permit 00, 08, 09; document meanings (00 waiver, 08 continuous, 09 single); prevent document inference.
- Task 9 (Units of Measure): Populate all 82 schema units in UNITS_OF_MEASURE from spec/data_type.xsd with CATAIR descriptions; distinguish commercial units from tariff reporting units.
- Task 10 (US States): Create shared/src/reference/states.ts with all 53 schema states/territories; add name/code normalization.
- Task 11 (Special Program Indicators): Create shared/src/reference/spi.ts with official CATAIR/HTS GN 3(c) programs (max 2 chars); expose candidates; label claims as requiring broker evidence.
- Task 12 (Carrier SCAC): Implement carrierCodeType format validation; return registry verification unavailable (NMFTA proprietary) without guessing carriers.
- Task 13 (HTS / USITC): Upgrade server/src/reference/hts.ts with disk caching (.cache/reference/hts/), rate limiting, timeout, hierarchical breadcrumbs, and provenance metadata.
- Task 14 (Integration & Handoff): Expose /api/reference/* endpoints; integrate suggestions without slowing /api/entry; verify 100% test pass and schema validity.

## 4. Caveats
- Read-only survey: no source files were modified.
- Remote service availability: live NetCHB upload endpoint was not tested (historical 403 logged); validation relies on local xmllint-wasm with spec/entry.xsd.
- SCAC proprietary registry: NMFTA registry is copyrighted/subscription-only; registry lookup will remain unavailable per Task 12.
- USITC live dependency: while static code lists are local/bundled, live HTS lookups rely on USITC REST API, requiring disk caching and timeouts.

## 5. Conclusion
- The repository is healthy, modular, and well-structured across shared, server, web.
- Build succeeds cleanly (35.41s); all 55 tests pass in 7.5s; XSD validator passes 7/7 fixtures; deterministic checks pass 12/12 with 100% trap detection; USITC test passes 1/1.
- Reference data is currently minimal/stubbed (Schedule D, K, MID are stubs; countries, currencies, MOT, entry types, UOM are partial subsets; bond type 00 is omitted from credentials schema).
- Tasks 1-14 have clear integration touchpoints that can be executed sequentially without breaking existing extraction contracts (ExtractedField<T>) or deterministic XML generation.

## 6. Verification Method
1. Build: run npm run build -> exit code 0 across all workspaces.
2. Server tests: run npm test -> exit code 0, 55 passing tests.
3. XSD validation: run npx tsx experiments/xsd-validation/validate.ts -> exit code 0, 7/7 fixtures pass.
4. Deterministic checks: run npx tsx --test experiments/deterministic-checks/deterministic-checks.test.ts -> exit code 0, 12/12 pass.
5. Inspect spec/data_type.xsd and spec/entry.xsd to verify element names, lengths, patterns, and enumerations.
