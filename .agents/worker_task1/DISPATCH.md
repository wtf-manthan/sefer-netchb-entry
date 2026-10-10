## 2026-10-10T06:32:02Z

You are a Worker subagent implementing Task 1: Reference Infrastructure.
Your working directory is: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\worker_task1
Project root: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern
Original Request file: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\ORIGINAL_REQUEST.md

Read:
1. c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\ORIGINAL_REQUEST.md (Foundational Rules & Task 1 Requirements)
2. c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\AGENTS.md and GEMINI.md
3. Survey reports:
   - c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\orchestrator_1\PROJECT.md
   - c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\explorer_codebase_survey\handoff.md
   - c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\spec_miner_survey\handoff.md

Your exclusive write ownership for Task 1:
- shared/src/types/reference.ts
- shared/src/schemas/reference.schema.ts
- shared/src/types/manifest.ts
- shared/src/schemas/manifest.schema.ts
- shared/src/reference/fingerprint.ts
- shared/src/index.ts (re-export new modules)
- server/src/reference/cache.ts
- server/src/reference/manifest.ts
- server/test/reference/task1-infrastructure.test.ts
- docs/ai-log.md (append entry for Task 1)

Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Detailed Requirements:
1. Implement shared LookupResult<T> type and Zod schema in @sefer/shared containing all required attributes:
   - category, targetField, query, outcome ('exact_match' | 'candidates' | 'no_match' | 'unavailable' | 'stale')
   - candidates ({ code, label, description?, details? })
   - source ({ publisher, url, datasetVersion, retrievedAt, effectiveDate?, license? })
   - matchingMethod ('exact_code' | 'normalized_name' | 'alias' | 'hierarchical_search' | 'fallback_format')
   - rationale
   - missingFactsNeeded (string[])
   - codeVerifiedAgainstReference (boolean) vs userConfirmedForShipment (boolean)
   - fingerprint (deterministic sha256)
   - DO NOT fabricate numerical confidence.
2. Implement dataset manifest type and schema (id, title, publisher, sourceUrl, datasetVersion, retrievedAt, effectiveDate, license, redistributable, recordCount, checksumSha256, format).
3. Implement backend reference cache manager in server/src/reference/cache.ts:
   - Disk caching under .cache/reference/ (configurable path)
   - Cache key isolation (category + query + datasetVersion)
   - Corrupted file detection and recovery
   - TTL/staleness checking
   - Fingerprint generation and validation
4. Implement scoped confirmation invalidation logic:
   - Ensure confirming a candidate binds to fingerprint sha256(category + query + datasetVersion + candidateCode).
   - Changing evidence or query invalidates only that specific confirmation without resetting unrelated decisions.
   - Original observations ({value, status, source, confidence}) and explicit broker decisions are preserved and not mutated.
5. Create comprehensive tests in server/test/reference/task1-infrastructure.test.ts testing:
   - Valid and invalid result contracts (Zod parsing).
   - All outcomes (exact_match, candidates, no_match, unavailable, stale).
   - Cache key isolation, corrupted data recovery, expiry/staleness labeling.
   - Original observations and explicit decisions remain unchanged before and after resolution.
   - Confirmation invalidation is strictly scoped to supporting data.
6. Run `npm run build` and `npm test` to verify all tests pass.
7. Update `docs/ai-log.md` with what was tried, what worked, what failed, what was decided.

Deliverable:
Write a completion report at c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\worker_task1\handoff.md with test execution output. Send a brief message to parent orchestrator when done.
