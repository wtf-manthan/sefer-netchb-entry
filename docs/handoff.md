# Latest checkpoint: frontend implemented; browser walkthrough pending (2026-10-10)

[VERIFIED - user approval; web/src] Implemented Upload / Review & resolve / XML export navigation, six review sections, split fields/evidence pane with mobile switching, human labels, source correction/verification, field-local checks, expandable goods decisions, local PDF attachment/preview, save/resume, retry checks and export feedback. PDF match prefers hash; legacy unique-name matches are labelled. No backend filing expansion or extraction configuration change.

[VERIFIED - execution] Full npm test: 123/123 passed, 9491.843 ms. After final UI edits, focused frontend/review UI tests: 9/9 passed, 1505.6946 ms. Final npm run build: exit 0; 1549 modules, JS 508.85 KB (140.48 KB gzip), Vite size warning. No live inference/HTS calls.

[VERIFIED - browser/network attempts] Initial browser restored a synthetic review and switched sections; API was unavailable then. Started frontend/backend and verified both return HTTP 200. Subsequent in-app browser navigation timed out, preventing the complete interactive walkthrough. [UNKNOWN] Final PDF rendering, narrow-screen behavior, upload/go-back and export interactions in browser remain unverified. Do not claim these passed.

[INFERRED - immediate continuation] First finish browser verification using the running app. Reproduce synthetic session with `node --import tsx experiments/frontend-review/prepare.ts`, then Resume review using its session.json. Check Transport inferred verification, Goods HTS/reporting reset, port acceptance, save/resume, invalid fields, checked/draft/report export and mobile evidence switching. Stage supplied sample PDFs to test upload/go-back without inference; reuse existing extraction cache for sample review where possible. Then finish submission artifacts. No additional redesign is pre-approved.

[VERIFIED - key files] web/src/App.tsx; review-workspace.ts; components/EvidencePanel.tsx, ExtractedFieldsView.tsx, OpenItemsDrawer.tsx, UploadSection.tsx, XmlPreviewPanel.tsx; styles.css. Tests: server/test/frontend-workspace.test.ts plus existing review-ui tests. Local dev sessions started by this phase: frontend 75889, backend 99188 (may expire). `npm run dev -w web` and `npm run dev -w server` restart them.

---

 Latest checkpoint: country/unit phase complete, 2026-10-10

[VERIFIED - approved scope; country-units.test.ts] Tasks 4/9 complete: 249 sourced country records, 82 XSD units, origin/export selectors, validated overrides and unit selectors. Original observations preserved; ambiguous names unresolved and quantities manual.

[VERIFIED - execution] npm test: 117 passed, zero failed/skipped, 5921.9633 ms. npm run build: exit 0, shared/server/web, 1547 modules. Offline importer reproduced checksum 9639332ebaf1ddba9e7dd948dedd288f649e9d693fe37d951b79b1380f13662c. No live inference/HTS calls.

[VERIFIED - user scope] STOP here; major frontend phase needs approval. Earlier checkpoints below are historical. Keep manual mode/entry/bond/currency and existing HTS search. Defer SPI/states/SCAC expansion. docs/submission-priorities.md lists future-work benefits. Next: navigation/source review, sample walkthrough and submission artifacts. Do not redo lookup work.

[UNKNOWN - untested this phase] Interactive browser workflow and unseen-document extraction quality.

---

# Resume here — Review/resolve/export implemented, 2026-10-10

## Latest checkpoint (supersedes the earlier phase boundary below)

[VERIFIED — latest user authorization] User approved the review → resolve → XML export workflow and requested prioritization of Tasks 4–14 while reserving a later session for frontend polish. Read docs/submission-priorities.md for task-by-task decisions; country completeness and narrow XSD unit validation are the remaining high-value small backend items.

[VERIFIED — server/src/reference/port-workflow.ts; shared/src/schemas/workflow.schema.ts] POST /api/reference/port accepts shipmentData, brokerDecisions and request {target,query,stateHint? or country?}. Returns request, result and evidenceFingerprint. Clicking Verify and use writes customsFiling[target] and portSelections[target] {request,candidateCode,evidenceFingerprint,lookupFingerprint}. Generation/export recomputes reference and evidence; stale/mismatched selection removes its effective code and blocks readiness. Manual edits delete that selection. Never apply lookup results directly to original observations.

[VERIFIED — server/src/app.ts; web/src/App.tsx] POST /api/export accepts shipmentData, brokerDecisions and kind ready/draft/review. Ready requires current local readiness; drafts require generated XML; reports work with unresolved inputs. All exports rerun server validation. Browser rejects an export response if edits changed during the request. Saved review files {reviewVersion:1,shipmentData,brokerDecisions} restore through schema validation and rechecking; no PDFs included.

[VERIFIED — web/src/components] Functional UI now offers port lookup, manual transport selection, HTS candidate selection, source verification, highlighted inferences, field-local issues and distinct checked/draft/report export. HTS selection clears previously applied reporting quantities. Visual redesign and a full interactive browser walkthrough remain for the next session. Initial localhost page was inspected and exposes upload and resume controls.

[VERIFIED — executed commands] Final npm test: **111/111 passed**, zero failed/skipped, duration **8724.2105 ms**. Full npm run build exited 0 (shared/server/web; 1544 frontend modules transformed). New tests: review-export.test.ts (six workflow/API tests) and review-ui.test.ts (three static UI rendering tests). Synthetic furniture test checks mechanics only; its synthetic tariff is not a real classification. No live model or external lookup calls.

[VERIFIED — scope] STOP at this checkpoint. Next frontend phase needs user approval. Do not redo Tasks 1–3 audits or consume inference quota on unrelated retests. Known limitations and prioritized remaining work are in docs/submission-priorities.md.

## Earlier completed phase: Tasks 1/2 repair history

[VERIFIED — earlier user request] Earlier scope was repair Tasks 1 and 2 only. The latest workflow checkpoint above supersedes that phase boundary.

## Implemented in this phase

- [VERIFIED — shared/src/reference/schedule-d.ts; scripts/import-schedule-d.py] Replaced the old manually assembled Schedule D list with 429 records from preserved Census table rows. Snapshot source: https://www.census.gov/foreign-trade/schedules/d/distcode.html . Source/JSON hashes and record count are in shared/src/reference/data/schedule-d-manifest.json. Import with `python scripts/import-schedule-d.py`; standard-library Python only. Snapshot means retrieved-on date, not a claimed effective date. Unverified IATA/terminal aliases removed entirely.
- [VERIFIED — shared/src/reference/ports.ts; server/src/reference/schedule-d.ts] Exact names/codes, conservative name normalization, state disambiguation/conflict checks, partial matches as candidates, special reporting codes requiring review. Unknown states stay unknown. Immutable dataset access. Invalid generated checksum means unavailable.
- [VERIFIED — server/src/app.ts] Domestic endpoint: `GET /api/ports/resolve?query=Tacoma&role=unlading-port&stateHint=WA`. Require query and supported role; reject extra/repeated parameters. No confirmation input over HTTP. Foreign endpoint from Task 3 remains `GET /api/ports/foreign/resolve?query=Shanghai&country=China`.
- [VERIFIED — server/src/reference/cache.ts] New cache constructor requires `{targetField,contextFingerprint}` after directory. Context fingerprint must cover ALL query hints/context. v2 keys isolate scope; old cache is not reused. Confirmations are always stripped on write/read. Wrong scope, malformed TTL, bad data fingerprints and invalid timestamps fail closed. Port resolvers use bundled data directly, not this result cache.
- [VERIFIED — shared/src/reference/fingerprint.ts] Confirmation checks now require shipmentId, evidenceFingerprint, lookupFingerprint, target field, query, version and candidate. Legacy records parse for migration but cannot authorize anything. Fingerprints are consistency checks, not authentication. Callers must compute the current context from actual shipment evidence; never trust a client's supplied digest alone.
- [VERIFIED — shared/src/schemas/reference.schema.ts; manifest.schema.ts] Calendar/day/time validation applies to reference dates and manifest dates.

## Verification checkpoint

[VERIFIED — repair test execution] Initial updated suite: 97/99 passed. Two failures were expected-error-message ordering; validation order was corrected. Final `npm test`: **102 tests, 102 pass, 0 fail, 0 skipped**, duration **50965.6116 ms**. Includes 3 repair regressions, 8 corrected Schedule D tests, Task 1 infrastructure and Task 3 tests, plus application regressions. No live model inference.

[VERIFIED — command execution] Full `npm run build` exited 0 (shared/server/web). Final shared code was also compiled by the passing `npm test`. Reimport of Schedule D produced identical bytes: `Deterministic Schedule D import: True`, SHA-256 `cc2fce15b800def0c51271f04377000c945eba33311d70670c0408e538fb99be`.

## Next phase priorities (proposal, needs approval)

1. [INFERRED — assignment deliverables] Finish the useful end-to-end path before expanding every reference table: show extracted values, offer lookup suggestions, explicitly verify inferred suggestions, show field-level issues once, preserve manual edits and export deterministic XML.
2. [INFERRED — existing scope and validation] Add verified common country/UOM/MOT normalizations first. A table entry must not choose an entry type, bond arrangement, preference eligibility or commodity classification without supporting facts.
3. [INFERRED — HTS uncertainty] Offer 10-digit HTS candidates with missing-fact questions and manual classification. Do not expand a six-digit heading by choosing the first result. Treat duty/rate inheritance and applicable date as separate validation work.
4. [INFERRED — submission requirements] Validate the sample XML, exercise synthetic non-apparel and ambiguous shipments, finish README/local setup, one-page approach/writeup, AI history and limitations. The AI answer key is not independently verified ground truth.

## Future work / deliberate compromises

- [VERIFIED — this phase] Offline pinned reference snapshots; no automatic refresh or historical effective-date selection. [UNKNOWN] Applicability to every filing date requires later source/version work.
- [VERIFIED — this phase] No unverified airport or terminal aliases. Cat Lai remains unresolved in the Q2 2026 Schedule K source. [INFERRED] A sourced alias registry is preferable to guessing a parent port.
- [VERIFIED — this phase] Unknown/multi-state source labels are preserved; no additional geography enrichment. Exact source codes/names remain available.
- [VERIFIED — task boundary] Lookup endpoints do not populate UI, change extraction or create broker decisions. Task 14/UI integration must explicitly create inferred suggestions and preserve original evidence; do not treat exact reference membership as automatic shipment verification.
- [VERIFIED — previous scope, docs/open-questions.md] Current filing profile is limited; broader transport modes, multiple tariff/regulatory programs, agency requirements and production authentication/deployment remain future work. [INFERRED] Honest blocked outputs for unsupported cases are a better submission than claiming universal regulatory readiness.

## Continuation instructions

[VERIFIED — project workflow] Read this file, docs/reference-audit.md's latest addendum, docs/ai-log.md's latest entry and AGENTS.md. Do not repeat the historical audit or live inference unless new changes require it. Run `npm test` and `npm run build` after relevant edits. Tests use mocks for provider calls; local HTTP tests need localhost permissions in the Codex sandbox. Never print .env. Preserve samples/original and spec/original. Ask for approval before starting the next phase.

[VERIFIED — experiments/reference-audit] `migrate-tests.py` was a one-time fixture migration and must NOT be rerun. Earlier experimental task1 stress scripts target the old cache API and are historical, not current verification gates. Standard tests under server/test/reference are maintained.
