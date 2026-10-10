# Adversarial Challenge Report: Task 1 (Reference Infrastructure)

**Verdict**: `REQUEST_CHANGES`  
**Overall Risk Assessment**: `HIGH`  
**Challenger**: Challenger 1 (Empirical Challenger: critic, specialist)  
**Target Milestone**: Task 1 — Reference Infrastructure  

---

## 1. Observation

### 1.1 Implementation & Test Files Inspected
- `shared/src/types/reference.ts`: Defines `LookupOutcome`, `MatchingMethod`, `ReferenceCandidate<T>`, `ReferenceSourceMetadata`, `LookupResult<T>`, and `ReferenceConfirmation`.
- `shared/src/schemas/reference.schema.ts`: Implements Zod validation schemas with `.strict()` for `LookupResult` and `ReferenceConfirmation`.
- `shared/src/reference/fingerprint.ts`: Standard SHA-256 implementation, `computeLookupFingerprint`, `validateLookupFingerprint`, `computeConfirmationFingerprint`, `validateConfirmationFingerprint`, `isConfirmationValidForLookup`, and `filterScopedConfirmations`.
- `server/src/reference/cache.ts`: `ReferenceDiskCache` managing disk files under `.cache/reference/`.
- `server/test/reference/task1-infrastructure.test.ts`: Worker unit tests (12 tests passing).
- `server/test/reference/adversarial-task1.test.ts`: Adversarial stress harness created by Challenger 1 (8 suites, 8 passing tests confirming empirical attack vectors and behavior).

### 1.2 Verbatim Command & Test Execution Results [VERIFIED]

**Command**:
```powershell
node --import tsx --test server/test/reference/adversarial-task1.test.ts
```

**Real Execution Output**:
```
Empirical Check - retrieved category: countries query: VIETNAM
Is cache vulnerable to Cross-Payload Desynchronization? true
Duplicate code sort sensitivity: Order sensitive
Empirical Check - Does LookupResultSchema allow invalid ISO timestamp "NOT_A_REAL_DATE_YESTERDAY"? true
Empirical Check - Does ReferenceConfirmationSchema allow invalid ISO timestamp "NOT_AN_ISO_DATE"? true
Empirical Check - Is confirmation for unladingPort accepted for entryPort context? true
✔ Oracle: computeSha256 strictly matches node:crypto across boundary lengths and UTF-8 (11.8309ms)
✔ Adversarial Cache: Delimiter and injection collision resistance (1.6528ms)
✔ Adversarial Cache: Path traversal sanitization prevents escaping directory (91.5404ms)
✔ Adversarial Cache: Zero-byte file, truncated JSON, array, and schema tampering (29.6983ms)
✔ Adversarial Cache Vulnerability: Cross-Payload Desynchronization between outer cache key and encapsulated LookupResult (6.6537ms)
✔ Fingerprint: Sensitivity to query, version, candidates, and candidate order invariance (25.9154ms)
✔ Zod Validation: Unknown fields, numerical confidence rejection, and timestamp format checks (3.0563ms)
✔ Confirmation: Role context isolation between entry port vs unlading port (2.3184ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 636.0328
```

### 1.3 Exact Code Observations

1. **Cross-Payload Desynchronization in `server/src/reference/cache.ts:74-101, 172-196` [VERIFIED]**:
   - In `set()`:
     ```typescript
     const key = this.computeCacheKey(category, query, datasetVersion);
     const targetFile = this.getFilePath(category, query, datasetVersion);
     ...
     const entry: ReferenceCacheEntry<T> = {
       key,
       category: category.trim().toLowerCase(),
       query: query.trim(),
       datasetVersion: datasetVersion.trim(),
       cachedAt: new Date().toISOString(),
       ...(options?.ttlMs !== undefined ? { ttlMs: options.ttlMs } : {}),
       fingerprint: validatedData.fingerprint,
       data: validatedData,
     };
     ```
     Neither `set()` nor `inspect()` verifies that `validatedData.category.toLowerCase() === category.toLowerCase()` or that `validatedData.query === query` or that `validatedData.source.datasetVersion === datasetVersion`.
   - In `inspect()`:
     ```typescript
     if (
       entry.key !== expectedKey ||
       entry.category !== category.trim().toLowerCase() ||
       entry.query !== query.trim() ||
       entry.datasetVersion !== datasetVersion.trim()
     ) {
       this.recoverCorrupted(targetFile);
       return { status: 'corrupted', result: null, corruptedReason: 'Cache key / metadata mismatch' };
     }
     ...
     const typedResult = parsedData.data as LookupResult<T>;
     if (!validateLookupFingerprint(typedResult) || typedResult.fingerprint !== entry.fingerprint) {
       this.recoverCorrupted(targetFile);
       return { status: 'corrupted', result: null, corruptedReason: 'Fingerprint validation failed' };
     }
     ```
     `validateLookupFingerprint(typedResult)` verifies `typedResult.fingerprint` against `typedResult`'s own content (`typedResult.category`, `typedResult.query`, `typedResult.source.datasetVersion`). It does NOT check against `entry.category` or the requested cache key `category`/`query`.

2. **Missing ISO 8601 Timestamp Validation in `shared/src/schemas/reference.schema.ts:39, 75` and `shared/src/schemas/manifest.schema.ts:12` [VERIFIED]**:
   - `ReferenceSourceMetadataSchema`:
     ```typescript
     retrievedAt: z.string().min(1),
     effectiveDate: z.string().optional(),
     ```
   - `ReferenceConfirmationSchema`:
     ```typescript
     confirmedAt: z.string().min(1),
     ```
   - `DatasetManifestSchema`:
     ```typescript
     retrievedAt: z.string().min(1),
     effectiveDate: z.string().optional(),
     ```
   - In `shared/src/types/reference.ts:27, 61`, the interface comments specify `// ISO 8601 string`, but the schema only validates that the string is non-empty (`.min(1)`).

3. **Sort Instability in `shared/src/reference/fingerprint.ts:102-110` [VERIFIED]**:
   ```typescript
   function canonicalizeCandidates(candidates: unknown): Array<{ code: string; label: string }> {
     if (!Array.isArray(candidates)) return [];
     return candidates
       .map((c) => ({
         code: String(c?.code ?? '').trim(),
         label: String(c?.label ?? '').trim(),
       }))
       .sort((a, b) => a.code.localeCompare(b.code));
   }
   ```
   When two candidates share the same `code`, `a.code.localeCompare(b.code)` returns `0`. JavaScript's Array.prototype.sort preserves relative insertion order for identical keys, making `canonicalizeCandidates` sensitive to array order.

4. **Candidate Description and Details Omission in `shared/src/reference/fingerprint.ts:102-110` [VERIFIED]**:
   `canonicalizeCandidates` only retains `{ code, label }`. `description` and `details` are discarded from the computed fingerprint.

5. **Role-Context Scope Bleed in `shared/src/reference/fingerprint.ts:207-224` [VERIFIED]**:
   ```typescript
   export function isConfirmationValidForLookup(
     confirmation: ReferenceConfirmation,
     current: {
       category: string;
       query: string;
       datasetVersion: string;
       candidateCode?: string;
     }
   ): boolean
   ```
   `isConfirmationValidForLookup` does not take or check `targetField`. If a user confirmed candidate `3001` for `header.unladingPort`, testing the same confirmation against `header.entryPort` (with identical port query) returns `true`.

---

## 2. Logic Chain

1. **Vulnerability 1: Cross-Payload Desynchronization**:
   - Observation: `ReferenceDiskCache.set` takes `(category, query, datasetVersion, result)`. It computes the cache key from `(category, query, datasetVersion)` and writes `entry = { key, category, query, datasetVersion, fingerprint, data: result }`.
   - Observation: `result` contains its own `category`, `query`, and `source.datasetVersion`.
   - Observation: When `cache.set('ports', 'SEATTLE', 'v1', countryResult)` is executed, the outer cache metadata records `category: 'ports', query: 'SEATTLE'`, while `entry.data` contains `category: 'countries', query: 'VIETNAM'`.
   - Observation: During `cache.inspect('ports', 'SEATTLE', 'v1')`, the method checks that `entry.key === expectedKey` and `entry.category === 'ports'`. It then parses `entry.data` and validates `validateLookupFingerprint(typedResult)`. Because `typedResult.fingerprint` was computed from `typedResult`'s own fields (`'countries'`, `'VIETNAM'`), fingerprint validation passes.
   - Observation: `cache.get('ports', 'SEATTLE', 'v1')` returns `status: 'hit'` with the country result object.
   - Conclusion: The cache is vulnerable to Cross-Payload Desynchronization. A caller requesting a port lookup receives a country result. Cache integrity across categories and queries is not enforced between outer storage keys and inner payload data.

2. **Vulnerability 2: Permissive Date/Timestamp Validation**:
   - Observation: `ORIGINAL_REQUEST.md` and the prompt explicitly require: "Test edge cases of LookupResult Zod validation (e.g. unknown fields, invalid ISO timestamps)."
   - Observation: In `ReferenceSourceMetadataSchema`, `retrievedAt` is `z.string().min(1)`. In `ReferenceConfirmationSchema`, `confirmedAt` is `z.string().min(1)`.
   - Observation: Strings like `"NOT_A_REAL_DATE_YESTERDAY"` and `"NOT_AN_ISO_DATE"` successfully pass Zod parsing.
   - Observation: `ReferenceDiskCache.inspect()` relies on `new Date(entry.cachedAt).getTime()`. When no TTL is provided, an unparseable timestamp returns `{ status: 'hit', ageMs: NaN }` without being flagged as corrupted.
   - Conclusion: The Zod schemas fail to enforce ISO 8601 timestamps, allowing malformed or corrupted date strings to enter the system and persist in disk caches.

3. **Vulnerability 3: Fingerprint Sort Instability for Duplicate Candidate Codes**:
   - Observation: In reference datasets like ports (Schedule D / K), multiple terminals or facilities can share the same code with distinct labels.
   - Observation: `canonicalizeCandidates` sorts solely by `a.code.localeCompare(b.code)`. When `a.code === b.code`, comparison is `0`.
   - Observation: `[{ code: '3001', label: 'Alpha' }, { code: '3001', label: 'Beta' }]` and `[{ code: '3001', label: 'Beta' }, { code: '3001', label: 'Alpha' }]` generate two distinct SHA-256 fingerprints (`fpDup1 !== fpDup2`).
   - Conclusion: Canonicalization fails to guarantee candidate set order-invariance when candidate codes match.

4. **Vulnerability 4: Candidate Description & Details Exclusion**:
   - Observation: `ReferenceCandidate<T>` defines `description?: string` and `details?: Record<string, unknown>`.
   - Observation: `canonicalizeCandidates` extracts only `{ code, label }`.
   - Observation: Modifying a candidate's description or details (such as active vs inactive status, or state mappings) does not change the computed fingerprint.
   - Conclusion: Fingerprints cannot detect changes to candidate descriptions or details.

5. **Vulnerability 5: Port Role Scope Bleed**:
   - Observation: Foundational Rule 5 and Task 2 require distinguishing processing port, entry port, and unlading port, without copying one matched code into all roles.
   - Observation: `isConfirmationValidForLookup` ignores `targetField`.
   - Conclusion: While `filterScopedConfirmations` keys by context dictionary keys, the underlying validation function `isConfirmationValidForLookup` allows a confirmation bound to `unladingPort` to evaluate as valid for `entryPort`.

---

## 3. Caveats

- **Pure-TS SHA-256**: The pure TypeScript implementation of FIPS 180-4 SHA-256 in `shared/src/reference/fingerprint.ts` was rigorously tested against Node.js `crypto.createHash('sha256')` across boundary message lengths (0 to 65,536 bytes) and multibyte Unicode strings. It produced 100% identical outputs. This component is robust and approved.
- **Path Traversal Resistance**: `ReferenceDiskCache.sanitizeCategory` safely replaces path separators (`/`, `\`, `.`) with underscores (`_`), effectively neutralizing directory traversal attempts (`../../etc`, `..\\windows\\system32`, etc.).
- **Corrupted Syntax Recovery**: Zero-byte files, truncated JSON, array entries, and schema-violating entries are detected and safely unlinked.
- **Scope**: External HTTP API failure modes (timeouts, HTTP 429 backoff) are part of Task 13 (HTS/USITC) and were not evaluated in Task 1.

---

## 4. Conclusion

**Verdict**: `REQUEST_CHANGES`

While the core SHA-256 implementation, basic schema definitions, and path traversal defenses are solid, the implementation contains critical flaws that must be fixed before dependent tasks (Tasks 2–13) build upon this infrastructure:

1. **[CRITICAL] Cache Cross-Payload Desynchronization**: `ReferenceDiskCache.set()` and `inspect()` must enforce that `data.category.toLowerCase() === category.toLowerCase()`, `data.query === query`, and `data.source.datasetVersion === datasetVersion`. Mismatched entries must be rejected on write and flagged as `'corrupted'` on read.
2. **[HIGH] Missing ISO 8601 Timestamp Validation**: `retrievedAt` and `confirmedAt` in `LookupResultSchema`, `ReferenceConfirmationSchema`, and `DatasetManifestSchema` must use ISO 8601 validation (e.g., `z.string().datetime()` or ISO regex) rather than accepting arbitrary non-empty strings.
3. **[MEDIUM] Candidate Sort Tie-Breaking**: `canonicalizeCandidates` must use `.sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label))` to guarantee order invariance when candidates share identical codes.
4. **[MEDIUM] Candidate Description/Details Binding**: Include `description` and normalized `details` in `canonicalizeCandidates` so fingerprinting reflects candidate changes.
5. **[MEDIUM] Target Field Role Validation**: Add `targetField` checking to `isConfirmationValidForLookup` to prevent confirmation bleed across filing roles (e.g., entry port vs unlading port).

---

## 5. Verification Method

To independently verify these findings:

1. **Execute the Empirical Adversarial Test Suite**:
   ```powershell
   node --import tsx --test server/test/reference/adversarial-task1.test.ts
   ```
   *Expected outcome*: 8/8 suites run and confirm the exact behaviors documented above:
   - `Cross-Payload Desynchronization: true`
   - `Duplicate code sort sensitivity: Order sensitive`
   - `LookupResultSchema allows invalid ISO timestamp: true`
   - `ReferenceConfirmationSchema allows invalid ISO timestamp: true`
   - `Confirmation for unladingPort accepted for entryPort: true`

2. **Inspect Files**:
   - `server/src/reference/cache.ts`: Lines 74–101 and 172–196 (lack of payload vs key cross-check).
   - `shared/src/schemas/reference.schema.ts`: Lines 39, 75 (`retrievedAt`, `confirmedAt` `.min(1)`).
   - `shared/src/reference/fingerprint.ts`: Lines 102–110 (unstable candidate sorting).
