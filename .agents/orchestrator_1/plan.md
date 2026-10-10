# Task Checklist & Execution Plan

## Foundational Directives
1. Authoritative data and shipment applicability are separate.
2. Preserve original extracted observations ({value, status, source, confidence}).
3. Shared lookup-result contract: 10 attributes, provenance, fingerprints, clear review state, no fake numerical confidence.
4. Suggestions never silently auto-populate consequential broker decisions.
5. Discover actual XML fields and constraints directly from spec/entry.xsd and spec/data_type.xsd.
6. Use official downloadable datasets where available and permitted.
7. Separate reference data storage from shipment caches; manifests with checksums and provenance.
8. External calls: timeouts, bounded retries, rate limits, disk cache, stale handling.

---

## Detailed Task Checklist

### Task 1 — Reference Infrastructure
- **Sources to investigate**: `@sefer/shared`, backend cache storage, manifest structure in existing codebase.
- **Changes**: Implement shared lookup-result contract, backend reference storage, manifest format, import/update utilities, API conventions.
- **Tests**: Valid/invalid contracts, status outcomes (exact_match, candidates, no_match, unavailable, stale), cache key isolation, corruption handling, scoping of confirmation invalidation.

### Task 2 — Schedule D / US Ports
- **Sources to investigate**: Authoritative US Census / CBP Schedule D datasets, `spec/entry.xsd`, `spec/data_type.xsd`.
- **Changes**: Local lookup by code and normalized name/location, distinguishing processing, entry, and unlading port roles.
- **Tests**: Regional representative records, case/punctuation variants, ambiguous names, unknown ports, invalid formats, provenance return.

### Task 3 — Schedule K / Foreign Ports
- **Sources to investigate**: US Census / CBP Schedule K dataset, `spec/entry.xsd`, `spec/data_type.xsd`.
- **Changes**: Code/name lookup with country context. Numeric Schedule K codes strictly (never UN/LOCODE substitution).
- **Tests**: Multi-country records, name collisions across countries, verified aliases, ambiguous matches, format checks.

### Task 4 — Country Codes
- **Sources to investigate**: ISO 3166-1 alpha-2, NetCHB schema country definitions.
- **Changes**: Complete country lookup, alias normalization, strict separation of country of export vs country of origin.
- **Tests**: Full ISO list coverage beyond current 21-entry subset, historical/territory handling, raw spelling preservation.

### Task 5 — Currency Codes
- **Sources to investigate**: ISO 4217, official exchange-rate handling rules.
- **Changes**: Authoritative ISO 4217 reference data, current vs historical separation, explicit reviewed rate selection (no fake market rate API).
- **Tests**: Full currency coverage beyond current 8-entry subset, symbol disambiguation ($ vs ¥), decimal precision preservation.

### Task 6 — Transport Modes
- **Sources to investigate**: `spec/entry.xsd` mode-transportation enumeration, CBP guidelines.
- **Changes**: Enumeration lookup, containerized vs non-containerized evidence distinction, blocking unsupported profiles.
- **Tests**: Valid mode codes, container evidence verification, no silent auto-confirmation of customsFiling.modeOfTransport.

### Task 7 — Entry Types
- **Sources to investigate**: `spec/entry.xsd`, CBP entry types (e.g. 01, 11).
- **Changes**: Reference lookup and application supported subset. No auto-selection solely from invoice value.
- **Tests**: Supported vs unsupported vs invalid codes, unsupported-profile blockers remain active.

### Task 8 — Bond Types
- **Sources to investigate**: `spec/entry.xsd` bond values (e.g., 00/08/09), NetCHB documentation.
- **Changes**: Verification of XML bond enumeration and documented meanings without conflating other CBP codes.
- **Tests**: Schema-valid vs application-supported distinctions, rejection of incompatible values, missing bond decisions left unresolved.

### Task 9 — Units of Measure
- **Sources to investigate**: `spec/data_type.xsd` reporting-unit enumerations, official CBP/HTS unit tables.
- **Changes**: Reporting unit list from local XSD, separate commercial units vs statistical units, no silent quantity conversions.
- **Tests**: Exact XSD enumeration coverage, case/alias normalization, rejection of unsupported units, tariff link validation.

### Task 10 — US States and Territories
- **Sources to investigate**: USPS / ANSI state and territory codes.
- **Changes**: Postal/state code lookup, validation connected only where address model supports it.
- **Tests**: States, territories, DC, non-US address separation.

### Task 11 — Special Program Indicators
- **Sources to investigate**: General Notes 3(c) HTSUS, `spec/entry.xsd` special-program definitions.
- **Changes**: Schema-supported indicators and definitions/effective status; no automatic eligibility claim from origin alone.
- **Tests**: Valid/invalid indicators, inactive/historical programs, preservation of unresolved eligibility.

### Task 12 — Carrier SCAC
- **Sources to investigate**: NMFTA SCAC licensing/registry availability, schema format requirements.
- **Changes**: Format validation (2-4 alphas), configurable provider adapter or graceful "registry verification unavailable" when proprietary.
- **Tests**: Format checks, rejection of fake carrier dictionaries, separation of master vs house carrier roles.

### Task 13 — HTS / USITC
- **Sources to investigate**: USITC HTS API / official downloadable HTS files, `spec/entry.xsd` tariff length constraints.
- **Changes**: 10-digit candidate lookup, hierarchical descriptions, statistical units and rates, rate-limiting, disk caching, provenance.
- **Tests**: Multi-child 6-digit heading searches, exact 10-digit queries, conditional rates handling, non-apparel domains (furniture, machinery).

### Task 14 — Integration and Handoff
- **Sources to investigate**: Current `/api/entry` endpoint, server and web integration points.
- **Changes**: Connect lookups to backend suggestion flow without repeated external calls; documentation, offline operation, final validation.
- **Tests**: Offline mode, end-to-end regression tests across all workspaces, dual validation status verification.
