# Current status 2026-10-11

[VERIFIED - schema v3, submission/, docs/approach.md] Structured ports and source-backed suggestions, reviewed corrections, incomplete-draft export, sample artifacts and the one-page writeup are now implemented. Earlier phase plans below are historical. Deferred work remains: wider entry/commodity profiles, full HTS/MID/statistical-unit logic, SPI/state/SCAC expansion, production storage/security and broader real-document evaluation. These improve coverage, classification context and operational reliability.

# Remaining budget: submission scope and task priorities

[INFERRED — user's original table order] Numbering below treats infrastructure as Task 1, Schedule D as Task 2, Schedule K as Task 3, and integration as Task 14. The original external Antigravity checklist is not stored in this repository; use the task NAME if its numbering differs.

| Task | Recommendation | Submission-sized deliverable / current state | Defer |
|---|---|---|---|
| 4 Countries | Completed narrowly | [VERIFIED - countries.ts; countries-manifest.json; OpenItemsDrawer.tsx] 249 sourced country/area records, conservative normalization, origin/export selectors and reviewed overrides. | Broader aliases and historical applicability. |
| 5 — Transport modes | Keep minimal version | [VERIFIED — web/src/components/OpenItemsDrawer.tsx; server/src/checks/index.ts] Explicit 10/11 choice is connected; unsupported modes remain blocked. No assumption from the word ocean alone. | Implementing air/truck/rail XML profiles or guessing containerization. |
| 6 — Entry types | Keep manual | [VERIFIED — checks/index.ts] Only 01 is supported. [INFERRED] User selects it after review; value alone must not choose the entry type. | General entry-type determination engine. |
| 7 — Bonds | Keep manual | [VERIFIED — decisions.schema.ts] Existing schema-specific 08/09 inputs and surety validation remain. [UNKNOWN] Actual bond arrangement is external broker information. | Inferring coverage or translating unrelated numbering schemes from memory. |
| 8 — SPI | Leave off | [VERIFIED — current builder] No preference eligibility engine. [INFERRED] State this limitation in writeup and review special-program applicability externally. | Automatically claiming preferential treatment. |
| 9 Units | Completed narrowly | [VERIFIED - statistical-units.ts; decisions.schema.ts; OpenItemsDrawer.tsx] 82 XSD codes, API membership validation and selectors. Quantities remain reviewed. | Automatic conversions and alias expansion. |
| 10 — US states | Leave separate table work off | [VERIFIED — port lookup] State hints filter the sourced port records. [INFERRED] This is sufficient for the present port workflow; no new address-normalization system is needed for this demo. | Address validation/geocoding. |
| 11 — Currency | Keep manual conversion | [VERIFIED — checks/index.ts] Non-USD invoices need an explicit reviewed USD conversion rate. [INFERRED] Complete currency-code validation is useful after country/unit work, but live rates are unnecessary for submission. | Live FX or assuming a market rate is the correct filing rate. |
| 12 — SCAC | Leave registry acquisition off | [VERIFIED — current checks and XSD] Existing carrier fields and syntax validation remain. [INFERRED] Require external review of identity; do not label format validation as registry verification. | A comprehensive registry and invented carrier aliases. |
| 13 — HTS | Keep minimal candidate search | [VERIFIED — HtsLookup.tsx; hts.ts] Search existing USITC endpoint, display ten-digit candidates, require deliberate selection, keep quantity decisions separate. [UNKNOWN] Search result completeness and inherited duty/unit details are not independently established. | Automatic classification, tariff/rate inheritance, trade-remedy and agency engines. |
| 14 — Integration | Essential path implemented | [VERIFIED — port-workflow.ts; app.ts; App.tsx] Look up, verify, apply, revalidate, resolve, export, save/resume. [INFERRED] Next frontend session should improve this path instead of adding disconnected tables. | Full production multi-user audit/storage service. |

## Use the remaining frontend session for

1. [INFERRED — assignment demonstration] A clear progress/navigation layout: source observations, filing/line decisions, remaining checks, XML/export. Keep existing server validation and decision contracts.
2. [INFERRED — current UX] Source PDF navigation, human field labels, shorter field groups, sticky unresolved counts, keyboard/accessibility and loading/error states. Validate the real sample through the browser.
3. [INFERRED — submission requirements] Finish README/local setup, one-page approach, generated sample XML plus its open-items report, AI history export and an honest supported-scope statement. Review synthetic furniture and incomplete/ambiguous examples. Do not invent sample filing credentials or HTS codes just to obtain a green result.

## Deliberate compromises / future work

- [VERIFIED — shipment.schema.ts; PortLookup.tsx] Port names are not part of the current extraction contract. User enters the port name from documents in the lookup panel. [INFERRED] Adding structured port observations requires extraction-schema/cache-version changes and separate quality evaluation; defer to avoid destabilizing working extraction under the deadline.
- [VERIFIED — port-workflow.ts] A port selection binds to the entire effective shipment. Any observation change invalidates all port selections conservatively. [INFERRED] Later narrow binding to relevant evidence, with document hashes and server-owned persistent shipment IDs.
- [VERIFIED — App.tsx] Save/resume uses a local JSON file containing extracted data and decisions, not original PDFs. It is not automatic persistence or encrypted/multi-user storage.
- [VERIFIED — export API] Draft export is labelled DRAFT; checked export requires both schema validity and zero local blockers. [UNKNOWN] Neither establishes external regulatory acceptance or completeness for arbitrary goods.
- [VERIFIED — test execution] Current validation uses mocked inference, synthetic payloads and UI rendering tests. No live Gemini/USITC call or fresh OCR evaluation was performed in this phase. [UNKNOWN] Real-browser interactive behavior beyond the initial page and unseen-document extraction quality need the next frontend/sample walkthrough.

## Future work: expected improvements

[INFERRED — scope and implementation limitations listed above] These are deferred improvements, not implemented capabilities:

| Deferred work | What it would improve |
|---|---|
| Full interactive/browser-accessibility validation of the new frontend | [VERIFIED - web/src] Navigation, labels, split PDF evidence, responsive controls and loading/error states are implemented. [INFERRED] A complete browser walkthrough would verify their usability and uncover interaction defects; the current browser connection prevented completion. |
| Structured port extraction and extraction schema/cache migration | Reduces manual port-name entry while preserving document evidence. |
| Broader transport and entry profiles; reviewed bond workflow | Supports air/road/rail and more entry scenarios; obtains actual bond facts rather than guessing from documents. |
| SPI eligibility and supporting-document workflow | Helps reviewers identify and substantiate preferential-treatment claims. |
| State/address validation and normalization | Improves party-address consistency and detects invalid locations. |
| Licensed/authoritative SCAC registry integration | Verifies carrier identity rather than only code syntax. |
| Full currency vocabulary and date-appropriate, reviewed conversion sources | Reduces manual rate entry and improves reproducibility without assuming spot rates are filing rates. |
| HTS hierarchy, inherited units/rates, effective dates, trade remedies and agency review | Gives reviewers fuller classification context and exposes commodity-specific requirements; candidate search alone cannot provide this. |
| Reviewed statistical-unit conversions with explicit dimensional factors | Reduces arithmetic work while avoiding unsupported conversions from pieces to weight or volume. |
| Versioned reference refresh, historical applicability and sourced aliases | Keeps codes current and supports shipment-date review; reduces unresolved spelling variants. |
| Evidence-scoped confirmations and persistent audit history | Avoids unnecessary re-verification while retaining who approved which evidence/version. |
| Authenticated storage, retention controls and recovery | Enables safer multi-user operation beyond local review JSON files. |
| Unseen-document OCR evaluation and full browser workflow tests | Measures real extraction/navigation reliability beyond synthetic and static-rendering tests. |
| Final sample artifacts, one-page writeup, complete chat export and optional deployment | Completes the assignment package and makes evaluation easier; deployment remains optional. |

[UNKNOWN — countries-manifest.json] Country snapshot retrieval date is not a historical effective date, and ISO-style territory coverage is not proof of all CBP-specific special codes. Unrecognized values remain unresolved. Common aliases absent from the preserved sources (for example UK) are not silently invented.
