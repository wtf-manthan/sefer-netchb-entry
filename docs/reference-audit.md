# Tasks 1–3 audit — 2026-10-10

## Latest status: Tasks 1/2 repaired

[VERIFIED — shared/src/reference/schedule-d.ts; scripts/import-schedule-d.py; server/src/reference/cache.ts; shared/src/reference/fingerprint.ts] The findings below describe the pre-repair state. The subsequent authorized repair replaces Schedule D with 429 source-backed records, removes unverified aliases, enforces state conflicts/partial-match review, exposes the domestic lookup endpoint, isolates cache scope, strips cached confirmations, binds confirmations to shipment/evidence/result, and validates calendar dates. See docs/handoff.md for current interfaces, deliberate compromises and continuation priorities. Tasks 4–14 remain deferred.

[VERIFIED — final repair test execution] `npm test`: 102 tests, 102 pass, 0 fail, 0 skipped; duration 50965.6116 ms. Replaced 11 self-consistent Schedule D tests with 8 source/behavior tests and added 3 repair regressions; retained Task 1 coverage with scoped fixtures. No live inference calls.

## Tasks 1 and 2: not fully correct

- [VERIFIED — server/src/reference/cache.ts; experiments/reference-audit/audit.ts] Task 1 caches complete results using category/query/version only. Writing Tacoma for entry-port and then unlading-port makes the entry lookup return the unlading target. Role, country/state context and shipment confirmation must not share result-cache entries.
- [VERIFIED — shared/src/reference/fingerprint.ts] Confirmation fingerprints include category, target field, query, version and code but no shipment/evidence identity. The helper cannot establish evidence-scoped confirmation. It must not be used as a readiness authorization before this is repaired.
- [VERIFIED — shared/src/schemas/reference.schema.ts; experiments/reference-audit/audit.ts] `2026-02-30` passes the reference date schema because Date.parse normalizes impossible calendar dates.
- [VERIFIED — shared/src/reference/schedule-d.ts; https://www.census.gov/foreign-trade/schedules/d/distcode.html] Task 2 contradicts its cited official source: Limestone is 0118, not local 0181; local ORD/O'Hare maps to 3983, which the source labels Chicago Executive Airport; local SFO maps to 2829, which the source labels San Pablo Bay, while San Francisco International Airport is 2801; local SJC maps to 2809 (San Francisco city), while San Jose International Airport is 2834. These are substantive filing risks, not presentation defects.
- [VERIFIED — shared/src/reference/schedule-d.ts] Schedule D has no preserved raw source, checksum manifest or reproducible import. Its claimed version/effective date cannot be established from the bundled constants alone. [UNKNOWN] Accuracy of the remaining records and aliases is not established by this spot check.
- [VERIFIED — server/src/reference/schedule-d.ts; experiments/reference-audit/audit.ts] Exact code 3002 is accepted despite contradictory stateHint NY. A sole partial-name candidate can also be promoted to exact_match.
- [VERIFIED — server/src/app.ts] `/api/ports/resolve` still returns 503; the Schedule D helper is not connected there.
- [VERIFIED — baseline test execution] All 37 existing reference tests passed, despite these defects. Their assertions do not establish authoritative data accuracy. The original root test script skipped the nested reference tests; this task adds them to `npm test`.

[VERIFIED — current task scope and changed files] Tasks 1/2 were audited, not repaired. Their earlier AI-log completion claims are superseded by these findings. Tasks 4–14 and UI integration were not performed.

## Task 3 implementation

[VERIFIED — server/data/reference/schedule-k/manifest.json; https://ndclibrary.sec.usace.army.mil/resource/8c90a43a-eaa8-4e2c-ad13-13a9f3ed2b92] Pinned USACE Schedule K, second quarter 2026, document identifier 07312026. The active sheet contains 4,083 rows: 2,191 official port records and 1,892 alias rows. The source workbook is preserved and both source and generated JSON have SHA-256 checksums. Metadata says June 2026 release and July 31 upload; neither is represented as an effective date.

[VERIFIED — scripts/import-schedule-k.py] Import only the active sheet, not the separate deleted/changed-code worksheets. Codes remain strings with leading zeros. Aliases come only from published alias rows. Import asserts expected columns, code formats, consistent countries, one official name per code and valid row labels. It is offline and repeatable; requires Python with openpyxl for refresh, not for normal app use.

[VERIFIED — server/src/reference/schedule-k.ts] The lookup reads and verifies the local JSON checksum/schema/count; missing or corrupt data returns unavailable with no candidates. It does not use Task 1's unsafe full-result cache. Every lookup returns fresh, unconfirmed results. Exact name/code/alias matches can identify a reference record; partial, ambiguous and aggregate geographic results remain candidates. Country contradictions eliminate candidates, including exact numeric-code matches.

[VERIFIED — server/src/app.ts] API: `GET /api/ports/foreign/resolve?query=Shanghai&country=China`. `country` is optional and accepts the source country NAME. USACE numeric country codes are not ISO codes; ISO conversion is deferred. Unknown parameters, repeated parameters and empty queries are rejected. Results target `header.foreign-port`; they do not overwrite extraction, broker decisions or XML.

[VERIFIED — source workbook; server/test/reference/task3-schedule-k.test.ts] Ho Chi Minh City is a published alias for 55224. Cat Lai is absent from this release and returns no_match; no terminal-to-parent-port inference is invented. London and Shanghai are examples of other supported countries. Synthetic fixtures test duplicated names across countries independently of the clothing shipment.

[UNKNOWN] The pinned release's applicability to a specific entry date, later revisions and explicit dataset redistribution license are not established. No claim of current-for-every-date coverage is made. [INFERRED — official source release metadata] A future refresh should review new source revisions and retain historical versions before selecting by filing date.

[VERIFIED — task boundary] Suggestions are designed for later inferred-value UI review. No Task 3 confirmation endpoint exists, and reference membership alone never marks shipment applicability confirmed. Fix Task 1 confirmation binding before integrating readiness.

## Verification

[VERIFIED — executed commands, 2026-10-10] `npm test`: 102 tests, 102 passed, zero failed/skipped, duration 7918.3387 ms. This includes 10 new Task 3 tests and the 37 prior reference tests. Existing tests passing does not invalidate the independent audit findings above.

[VERIFIED — executed commands] `npm run build` exited 0 for shared, server and web. Re-running `scripts/import-schedule-k.py` reported `Deterministic import: True`; generated SHA-256 was `aab682a76ab9fa53e497ce4ab64d13c96c1007c635d4ff5b01adb1aca1a8e9ff`.

[VERIFIED — command failures and subsequent reruns] Initial build exposed a missing datasetVersion argument to the fingerprint helper; corrected before the successful build/tests. The sandboxed full test run failed on localhost EACCES and earlier reference tests hit temporary-file permissions; the successful full run used approved execution permissions. No live model inference was called.
