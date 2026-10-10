# Original User Request

## 2026-10-10T06:00:50Z

Implement authoritative reference-data lookups, datasets, schemas, and suggestion workflows for this TypeScript NetCHB entry-preparation project.

Working directory: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern
Integrity mode: development

Read AGENTS.md, the current source, spec/entry.xsd and spec/data_type.xsd before making changes. Follow project evidence-label, AI-log, preservation and verification rules.

This is a backend/reference-data phase. Do not redesign the UI. Do not alter .env credentials, enable paid services, transmit entries or hardcode sample-shipment values.

The user authorizes the individual tasks below as sequential subphases. Complete and test each task before starting the next. If a source is unavailable, licensing prevents bundling, or a mapping is ambiguous, document the limitation and continue with independent tasks. Never substitute fabricated data.

Before implementation, write a short task checklist describing sources to investigate, changes and tests. Keep it updated.

---

## FOUNDATIONAL RULES

1. Authoritative data and shipment applicability are separate.
   - A table may establish that a code exists.
   - Matching document text to that code can still be inferred.
   - Classification, filing choices and preference eligibility may require additional facts.
   - Never describe a suggested match as confirmed merely because its source is official.

2. Preserve original extracted observations and their existing {value, status, source, confidence} contract.
   - Store reference lookup results separately.
   - Do not invent PDF page references for web data or overwrite raw extraction.

3. Design and validate a shared lookup-result contract containing:
   - Lookup category and target entity/field
   - Original query
   - Outcome: exact_match, candidates, no_match, unavailable or stale
   - Candidate code and description
   - Source URL, source publisher and dataset/version information
   - Retrieval date and effective date when provided
   - Matching method and rationale
   - Any missing facts needed to choose
   - Explicit review/confirmation state
   - A fingerprint tying the result to the query and dataset version
   - Use a clear distinction between  code verified against reference and user confirmed this code for this shipment.
   - Do not fabricate numerical confidence.

4. Successful lookup must not silently populate consequential broker decisions.
   - Expose suggestions through an API/response contract for the later UI phase.
   - Preserve existing manual decisions and overrides.
   - Changes to the relevant evidence, query or selected candidate must invalidate the applicable confirmation without unnecessarily resetting unrelated work.

5. Discover the actual XML fields and constraints from the local schemas.
   - Do not implement the previously proposed table literally.
   - Known examples to recheck:
     - mode-transportation, unlading-port, lading-port, special-program
     - Local bond values 00/08/09
     - Schema tariff length versus the application's supported filing profile

6. Use official downloadable datasets where available and permitted.
   - Prefer deterministic local lookups for stable code lists.
   - Use documented official APIs where appropriate.
   - Do not invent endpoints or bypass access restrictions.
   - Do not add unofficial packages as an unexplained source of truth.

7. Store reference data separately from shipment extraction caches.
   - Include an import/update script and dataset manifest with source URL, retrieval/effective dates, checksum, licence/redistribution notes and coverage.
   - Preserve original source files when redistribution is permitted.
   - Otherwise document how the user obtains them; do not bundle restricted data.
   - Commit appropriately sized redistributable snapshots needed for local use.

8. External calls need timeouts, bounded retries for transient failures, request deduplication, rate-limit handling and validated responses.
   - Respect Retry-After where supplied.
   - No secret-bearing logs, silent paid fallback or sample-specific fallback.
   - Cache successful API results on disk using query + source/version identity.
   - Clearly label stale results and do not treat them as current automatically.

---

## Requirements & Tasks

### Task 1 — Reference infrastructure
Create the shared result/provenance contract, backend reference storage, manifest format, import/update utilities and API conventions. Keep this small and appropriate for a locally runnable take-home submission.
Tests:
- Valid/invalid result contracts.
- Exact/candidate/no-match/unavailable states.
- Cache key isolation, corrupted data, expiry/staleness.
- Original observations and explicit decisions remain unchanged.
- Confirmation invalidation is scoped to its supporting data.

### Task 2 — Schedule D / US ports
Find an authoritative US port-code dataset applicable to the filing fields. Verify its publisher, coverage, version and applicability. Implement local lookup by code and normalized name/location.
Distinguish processing port, entry port and unlading port. Do not copy one matched code into all roles. Ambiguous names must return candidates. Do not assume the previously suggested Tacoma code is correct.
Tests:
- Representative source-verified records from different regions.
- Case/punctuation variants, duplicate/ambiguous names and unknown ports.
- Invalid code formats and unsupported roles.
- Dataset provenance is returned with matches.

### Task 3 — Schedule K / foreign ports
Find the authoritative foreign-port dataset required by the actual schema. Implement code/name lookup with country context.
Do not substitute UN/LOCODE for a numeric Schedule K code. Do not invent terminal-to-port or city-to-port aliases. Only add aliases supported by a cited source. Do not assume the previously suggested Cat Lai code is correct.
Tests:
- Verified records from several countries.
- Same/similar port names in different countries.
- Terminal aliases, ambiguous matches, missing country and no match.
- Required code format and provenance.

### Task 4 — Country codes
Obtain a complete, appropriately licensed authoritative country-code list. Check compatibility with the NetCHB schema and filing context. Implement exact code lookup and documented name/alias normalization.
Do not infer country of export from country of origin. Treat historical codes, territories and ambiguous names explicitly. Preserve the raw document spelling.
Tests:
- Countries outside the current 21-entry subset.
- Names, codes, documented aliases and unknown inputs.
- Distinct origin/export values.
- Unsupported or historical values do not silently pass as current.

### Task 5 — Currency codes
Obtain authoritative ISO 4217 reference data, subject to redistribution terms. Connect currency normalization to the resolver. Separate current and historical currencies.
Currency validation is not exchange-rate selection. Do not add a market-rate API and claim its result is a valid filing rate. Investigate the applicable official conversion source/rules separately; if not verified, retain explicit reviewed exchange-rate input.
Tests:
- Currencies outside the current eight-entry list.
- Ambiguous symbols such as $ and ¥.
- Unknown/historical codes.
- Non-USD invoices still require the appropriate conversion decision.
- Decimal calculations remain correct.

### Task 6 — Transport modes
Verify the local mode enumeration against applicable authoritative documentation. Expose code/label lookup.
Document language may produce a suggested mode, with cited supporting evidence. Ocean alone must not silently decide containerized versus non-containerized. Keep unsupported transport profiles blocked even if their codes exist in a table.
Tests:
- Existing numeric codes, generic ocean text and explicit container evidence.
- Contradictory/insufficient evidence.
- Code validity is separate from application support.
- Suggestions do not auto-confirm customsFiling.modeOfTransport.

### Task 7 — Entry types
Verify supported entry-type codes and descriptions. Expose reference lookup and the application's supported subset.
Do not select entry type solely from invoice value. Do not expand the implemented filing profiles simply by adding codes.
Tests:
- Valid supported, valid unsupported and invalid codes.
- No automatic entry-type choice from shipment value.
- Existing unsupported-profile blockers remain effective.

### Task 8 — Bond types
Verify the XML bond enumeration and documented meanings. Do not conflate CBP codes from another interface with NetCHB XML values. If meanings cannot be verified, expose the known schema values with that limitation.
Do not infer the importer's bond arrangement from shipping documents.
Tests:
- Allowed XML values and rejected incompatible values.
- Schema-valid versus application-supported distinctions.
- Missing bond decisions remain unresolved.

### Task 9 — Units of measure
Build the NetCHB reporting-unit list from the local XSD and verify descriptions against the applicable official reference.
Keep commercial units, manifest package units and tariff statistical units separate. An alias normalization is not a quantity conversion. Do not automatically turn PCS into DOZ or KG without a verified conversion basis. Do not claim every commercial alias is an accepted statistical unit.
Tests:
- Exact XSD enumeration coverage.
- Case/alias normalization.
- Unsupported units.
- Commercial quantity reconciliation.
- Reporting units remain linked to the selected tariff requirements.
- No silent quantity conversion.

### Task 10 — US states and territories
Obtain authoritative postal/state codes with clear coverage. Connect validation where the current address model actually supports it. Document model gaps rather than inventing structured addresses.
Tests:
- States, territories, DC, names/codes and invalid values.
- Non-US addresses are not forced into a US-state model.

### Task 11 — Special Program Indicators
Verify schema-supported indicators and authoritative definitions/effective status. Expose a reference list or candidate information.
Never infer preference eligibility from origin alone. Do not enable claims that the current XML/decision flow cannot represent safely. If implementing the claim workflow would exceed this phase, provide the lookup and clearly label claim support as unavailable.
Tests:
- Valid/invalid indicators.
- Inactive or dated programs.
- Code existence does not establish eligibility.
- Missing eligibility evidence never becomes an automatic claim.

### Task 12 — Carrier SCAC
Investigate the authoritative SCAC registry and its licensing/access terms. Do not assume a freely redistributable complete registry exists.
If authorized access is available, implement a configurable provider adapter. Otherwise return registry verification unavailable while preserving the document-extracted SCAC and schema-format checks.
Do not fabricate a carrier-name dictionary or treat fictional sample carriers as verified registry entries. Do not conflate SCAC with airline IATA/ICAO codes.
Tests:
- Format validation versus registry verification.
- Unknown codes, mismatched names and unavailable registry.
- Master and house carrier roles remain separate.

### Task 13 — HTS / USITC
Verify the existing USITC endpoint against official documentation or actual validated responses. Use an official downloadable dataset if more suitable. Implement disk caching and version/effective-date provenance.
Return ten-digit candidates with enough hierarchical description to understand them, statistical units and rates only where explicitly supported by the source.
A six-digit heading is a search key, not a uniquely expandable code. Never pad zeros, select the first result, invent rates, or flatten conditional duties into a misleading numeric rate. Expose missing product attributes needed to distinguish candidates.
Do not claim a base classification lookup covers all additional tariffs, trade remedies or agency requirements.
Tests:
- Multiple children of a six-digit heading.
- An exact ten-digit result.
- Hierarchical descriptions and units.
- Missing/conditional rates, unknown codes and effective dates.
- Timeout, malformed response, rate limit and stale cache.
- Non-apparel cases such as furniture and machinery, without hardcoded answers.

### Task 14 — Integration and handoff
Connect implemented lookups to a documented backend suggestion flow. Avoid triggering repeated external lookups on every /api/entry recalculation. Keep deterministic XML generation independent of network calls.
Document:
- Each lookup's actual coverage and source.
- Which values are normalized versus merely suggested.
- Which choices require confirmation.
- Unsupported/unavailable integrations.
- How to refresh data and run offline.
- Exact response and confirmation contracts for the future UI.

---

## Acceptance Criteria & Final Verification

- [ ] Complete task checklist maintained and updated throughout execution.
- [ ] Shared lookup-result contract implemented in @sefer/shared containing all 10 required provenance/status attributes.
- [ ] No raw extracted observations or manual decisions overwritten by reference results.
- [ ] Invalidation of confirmation is strictly scoped to supporting evidence.
- [ ] Schedule D & Schedule K port lookups operate with verified official codes; UN/LOCODE is never substituted for Schedule K.
- [ ] ISO 3166-1 country lookup covers full official list, normalizes documented aliases, and separates export from origin.
- [ ] ISO 4217 currency list distinguishes current from historical; no fake market rates or automatic exchange rate selection.
- [ ] Transport modes, entry types, bond types, and UOM lists strictly conform to local XML schemas (spec/entry.xsd, spec/data_type.xsd).
- [ ] SCAC handling gracefully returns registry verification unavailable when proprietary NMFTA registry is unaccessible, without guessing carriers.
- [ ] USITC HTS integration returns hierarchical 10-digit candidates, never truncating or guessing rates from 6-digit headings.
- [ ] External calls implement bounded retries, timeouts, rate-limit backoff, deduplication, and separate disk caching.
- [ ] Dataset manifests and update scripts committed for offline reproducibility.
- [ ] npm run build succeeds across all workspaces (shared, server, web).
- [ ] npm test passes 100% of tests with real command verification.
- [ ] Local XML validator (xmllint-wasm) runs on representative complete synthetic entries against entry.xsd and data_type.xsd.
- [ ] Representative tests cover unseen synthetic non-apparel inputs (e.g. furniture, machinery) and missing/ambiguous cases without hardcoded values.
- [ ] docs/ai-log.md and docs/open-questions.md updated with real execution outputs and licensing notes.
- [ ] Concise change summary and per-table status matrix produced at completion.
