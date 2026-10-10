# Phase 1 corrected core

## Current Gemini correction — 2026-10-10

[VERIFIED — server/src/extraction/extractor.ts; server/test/extraction.test.ts] This section supersedes historical OpenRouter/free-routing and extraction-unavailable descriptions below. The adapter uses explicit Gemini 3 configuration, header authentication, sanitized errors, STOP-only completion handling, and concatenated non-thought answer parts. JSON MIME mode plus local Zod validation is used; API-enforced JSON Schema is not claimed. Missing source:null is normalized only for an otherwise consistent missing observation; contradictory values/confidence are rejected.

[VERIFIED — server/src/config.ts, .env.example] Only user-confirmed Gemini free-tier projects are supported. GEMINI_FREE_TIER_CONFIRMED defaults false. Paid inference is not enabled by a positive SPEND_CAP_USD. Model and effort are explicit environment configuration; supported effort values map to thinkingConfig.thinkingLevel. [UNKNOWN] The application cannot verify the account's billing configuration; users must keep billing disabled. Live cost is null, and cache reuse is zero incremental inference cost. Logs include available prompt, answer, thought and total token counts.

[VERIFIED — server/src/extraction/extractor.ts, experiments/gemini-audit/audit.ts] Corrected requests use the gemini-v2 prompt/cache identity because instructions and reasoning behavior changed. Historical gemini-v1 files are preserved for audit but not automatically accepted by the corrected adapter. Tests validate current cache reuse and same-process deduplication; the historical quality audit reads old observations directly without making a new inference call.

[VERIFIED — server/src/checks/index.ts; server/test/normalization.test.ts] Recognized commercial unit aliases/case are normalized before quantity comparisons; no quantity conversion is inferred. Known country aliases normalize for origin/export fields without altering document observations. Unknown export countries remain blockers. The reference dictionaries are limited and are not claimed to cover every country/unit or regulatory requirement.

## OpenRouter integration update

[VERIFIED — server/src/extraction/extractor.ts, server/src/app.ts] The historical Phase 1 extraction-unavailable statements below are superseded by this integration. PDFs are rendered locally to page images and submitted to the explicitly configured free OpenRouter model. JSON-mode output is validated with the existing Zod schema; JSON mode is not strict schema-constrained decoding. Evidence document/page references are checked, but snippet truth and transcription accuracy require source review.

[VERIFIED — server/src/extraction/cache.ts, server/test/extraction.test.ts] Validated results are disk-cached by content, filenames/order, model, effort and prompt/schema version. Concurrent identical calls share a promise within one server process. Token/cost/latency metadata is written without keys or document text. Unknown cost remains null. No automatic retries or cross-process deduplication is implemented.

[VERIFIED — server/src/extraction/extractor.ts] This integration permits free model IDs only and restricts prompt/completion routing prices to zero. Paid PDF parser plugins are not used. A positive provider-reported charge rejects the result; provider billing remains external. Paid model budget accounting is not implemented, and paid models are blocked regardless of SPEND_CAP_USD.

[UNKNOWN] Regulatory coverage, live model availability, incomplete-document workflows and source-editing UI remain separate work. The existing ocean/type-01 XML limitations remain in place.

[VERIFIED — server/src/app.ts] The production upload endpoint validates upload count, byte limits, media type, extension and PDF signature, then returns HTTP 503 because live extraction is not integrated. A signature check alone is not full PDF validation.

[VERIFIED — server/src/extraction/demo.ts, server/src/app.ts] Demo mode is explicit and disabled by default. It reads the unverified JSON fixture on /api/demo, marks its observations inferred, and starts with empty decisions. /api/extract never reads the fixture.

[VERIFIED — shared/src/schemas/shipment.schema.ts] The version-2 contract supports document, invoice, packing-list and bill collections; bill containers; globally unique entity IDs; document evidence; nullable missing observations; and currency-labelled invoice amounts. Runtime validation rejects unknown fields, invalid references, invalid status/value combinations and duplicate IDs.

[VERIFIED — server/src/checks/index.ts] A single resolver applies decisions, aggregates uniquely matched packing rows, preserves conflicts, calculates amounts and emits structured findings. Findings carry entity references, evidence, stable IDs and open/resolved state. Evidence-review acknowledgements are invalidated when their evidence changes.

[VERIFIED — server/src/checks/money.ts] Decimal products are converted to integer cents with half-up rounding. Included charges are allocated deterministically to commercial base amounts, excluding assists and customs-only samples. This is an application calculation policy, not an assertion of universally applicable customs valuation law.

[VERIFIED — server/src/builder/xml-builder.ts, server/src/builder/entry-service.ts] XML serialization consumes only the resolved model, escapes text and validates against both local XSD files. Missing schema-required values prevent XML generation. Optional omissions can produce schema-valid drafts that remain blocked. All open blocking findings and schema errors prevent local readiness.

[VERIFIED — server/src/checks/index.ts] Supported generation profile: ocean modes 10/11 and entry type 01. Other modes/types remain blocked. Multiple bills require a reviewed aggregate weight; conflicting vessels/voyages and duplicate containers remain blocked. Statistical units and quantities require explicit broker input. Non-USD values require an explicit reviewed USD conversion rate; already-converted values are emitted without a foreign-currency element to avoid double conversion.

[UNKNOWN] Whether a specific shipment is legally ready, whether the chosen classification is correct, and whether NetCHB/CBP will accept the output require authoritative reference review and broker/system verification. The application's readiness status covers its implemented profile checks only.

[VERIFIED — server/src/extraction/cache.ts] Future live extraction cache uses a separate live-v2 namespace, validated contents, file-boundary-aware hashes, model/provider/effort/prompt/schema identity and atomic writes. Old fixture-populated caches are never read. The upload endpoint does not currently use this cache.

[UNKNOWN] Provider calls, concurrent request deduplication, cumulative budget enforcement and real token/cost measurements are deferred to Phase 2. No claim of live extraction accuracy or cost is established by fixture tests.

[VERIFIED — web/src/App.tsx] The UI uses relative API URLs, resets decisions on shipment changes, clears stale XML and aborts obsolete rebuilds. It provides arbitrary-line decisions and evidence inspection. Full PDF evidence editing is deferred to the review-workflow phase.
