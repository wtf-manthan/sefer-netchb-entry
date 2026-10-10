# Gemini integration audit — 2026-10-10

## Correction verification

[VERIFIED — server/test/extraction.test.ts, server/test/normalization.test.ts, experiments/gemini-audit/audit.ts; executed 2026-10-10] The findings below describe the pre-fix implementation. Corrections now reject MAX_TOKENS and contradictory missing values, prevent the reproduced credential error leak, send configured thinking effort, use explicit models, report unverified cost as null, gate new calls on user-confirmed free-tier configuration, normalize recognized units/countries, and migrate the provider tests/UI. Paid inference remains unsupported. The current full build passes and npm test reports 46 passed / 0 failed.

[VERIFIED — .cache/gemini-audit/report.json; current audit execution] All 81 selected historical extraction checks still pass. The resolver now emits one quantity conflict and zero unit conflicts; export country is VN. All negative regression probes are rejected and the valid simulated Gemini response is accepted. No new live inference request was made; changed request behavior is verified by simulated provider tests and official API documentation, not a fresh live round trip.

## Result

[VERIFIED — experiments/gemini-audit/audit.ts; .cache/gemini-audit/report.json] The existing Gemini extraction passed 81 selected source-based checks, and its document hashes match the current PDFs. The production extraction service returned a validated cache hit with a transport stub that forbids network calls. These are checks on one cached sample, not an overall accuracy percentage or unseen-shipment evaluation.

[VERIFIED — current command output] npm run build passed all workspaces. npm test, rerun with localhost permissions after sandbox EACCES, produced 39 tests: 36 passed and 3 failed. All 25 core tests and all 9 API tests passed. Three extraction tests fail because their requests/responses/assertions still target OpenRouter. A broad assert.rejects test also passes for the wrong reason: its outdated mock throws before Gemini response handling is reached.

## Findings

1. [VERIFIED — server/src/extraction/extractor.ts:89,111,181; audit.ts transportError probe] P1: the API key is included in the request URL and arbitrary transport/provider errors reach the user-facing error message. A simulated transport exception containing the URL reproduces key disclosure. No real credential was printed during the audit. Use header authentication and sanitized errors; never forward raw provider error text.
2. [VERIFIED — server/src/extraction/extractor.ts:116; audit.ts maxTokens probe] P1: finishReason is not checked. A Gemini candidate marked MAX_TOKENS containing structurally valid JSON is accepted and cached. A partial list may satisfy the schema, so require successful completion before accepting an extraction and inspect returned text parts appropriately.
3. [VERIFIED — server/src/checks/index.ts:94; cached sample; audit.ts] P1: literal unit comparison treats PCS and Pcs as different. The actual sample generates five UNIT_CONFLICT findings and zero QUANTITY_CONFLICT findings, hiding the useful 1200 versus 1176 choice. This is an existing resolver weakness exposed by valid Gemini transcription, not an OCR failure. Normalize recognized units while retaining original evidence.
4. [VERIFIED — server/src/checks/index.ts:151; server/src/builder/xml-builder.ts:29; cached sample] P1: extracted country names such as VIETNAM pass through to country-export XML without code normalization. The source observation is correct; the filing mapping is incomplete. Source editing is not available through the current UI. Resolve recognized names to verified codes outside the extraction layer; preserve unknowns as blockers.
5. [VERIFIED — server/src/extraction/extractor.ts:173,178,188; server/src/config.ts] P1: every call is labelled costUsd=0 without establishing free-tier eligibility or calculating cost. SPEND_CAP_USD is never enforced by the Gemini implementation. LLM_EFFORT is part of cache identity but is absent from generationConfig. Cost must remain unknown unless established, and configured effort/budget must control execution.
6. [VERIFIED — server/src/extraction/extractor.ts:47] P2: a configured non-Gemini model silently becomes gemini-3.8-flash. This repeats the configuration ambiguity that complicated the OpenRouter tests. Reject incompatible configuration explicitly instead of substituting a model.
7. [VERIFIED — server/src/extraction/extractor.ts:126; audit.ts missingWithValue probe] P2: missing-field normalization discards non-null values and overwrites confidence. A contradictory observation marked missing with an actual invoice number is silently accepted after losing its value. Limit normalization to representation-only fixes and reject semantic contradictions.
8. [VERIFIED — server/test/extraction.test.ts; README.md; web/src/components/UploadSection.tsx; experiments/openrouter-extraction] P2: tests, UI/provider descriptions and older experiments still assume OpenRouter. The old render-only runner looks for image_url parts, but prepareDocuments now returns Gemini inlineData. Update the Gemini tests and provider-neutral tooling before treating the migration as complete.

## Quality findings

[VERIFIED — invoice pages 1–2; packing list page 1; bill page 1; audit.ts] The selected checks cover all five invoice lines, their quantities/prices/amounts/printed HS codes and source pages, packing counts/weights/linkage, freight 3850, insurance 185, total 27270, assist 4180, FOC and Bangladesh origin, material-conflict text, bill identifiers and gross weight. The invoice arithmetic discrepancy and packing shortage were preserved rather than silently corrected. The ambiguous 12/09/2026 date is appropriately labelled inferred in the cached result.

[UNKNOWN] The handwritten container's certainty is not established by the model's 0.95 confidence. The printed value is preserved and a correction-review finding is raised. Full word-by-word evidence accuracy, consistency across reruns and performance on furniture or other unseen layouts were not measured.

[VERIFIED — existing cache metrics] The existing cache reports 23,949 input tokens, 12,240 output tokens and 92,294 ms latency. Its zero cost field is hardcoded by the current implementation, not verified billing evidence. No new inference request was made for this audit.

[VERIFIED — https://ai.google.dev/api/generate-content; https://ai.google.dev/gemini-api/docs/structured-output; https://ai.google.dev/gemini-api/docs/thinking] Official documentation distinguishes finishReason, schema-constrained output configuration and thinking configuration. The implementation sends JSON MIME mode and a schema in prompt text; it does not send an API response schema. Entry 12's statement that native JSON schema mode is used is therefore inaccurate.

[INFERRED — findings above] Keep Gemini as a promising extraction candidate, but fix these integration issues before describing the end-to-end workflow as correct. This audit added reproducible probes and documentation only; no production code or environment values were modified.
