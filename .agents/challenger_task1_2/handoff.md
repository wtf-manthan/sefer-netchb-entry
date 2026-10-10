# Challenger 2 Report: Scoped Confirmation Invalidation & Immutability

## Challenge Summary

- **Role**: EMPIRICAL CHALLENGER (Task 1: Reference Infrastructure)
- **Target Subsystem**: Scoped confirmation invalidation (`shared/src/reference/fingerprint.ts`) & Observation/Decision Immutability (`shared/src/types/`, `server/src/reference/cache.ts`)
- **Overall Risk Assessment**: MEDIUM
- **Explicit Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

Direct empirical observations, commands, outputs, and verbatim traces:

### A. Baseline Test Execution
Command:
```powershell
node --import tsx --test server/test/reference/task1-infrastructure.test.ts
```
Output:
```
✔ Contract: Valid LookupResult with all 10 required attributes parses cleanly (4.7517ms)
✔ Contract: Rejects fabricated numerical confidence in LookupResult (1.8303ms)
✔ Contract: Rejects missing required provenance fields (0.974ms)
✔ Contract: Rejects invalid outcomes and methods (0.8419ms)
✔ Outcomes: All 5 defined outcomes represent valid states (14.3814ms)
✔ Manifest: Valid dataset manifest parses and validates checksum (0.959ms)
✔ Manifest: Server manifest manager creates, saves, loads, and verifies datasets (22.8401ms)
✔ Cache: Key isolation across category, query, and datasetVersion (10.2169ms)
✔ Cache: Corrupted file detection and recovery (15.8424ms)
✔ Cache: Expiry and staleness labeling (12.2378ms)
✔ Integrity: Original observations and explicit broker decisions are preserved without mutation (0.7491ms)
✔ Confirmation: Scoped invalidation is strictly bound to category, query, version, and candidate (0.6539ms)
ℹ tests 12 | pass 12 | fail 0
```

### B. Empirical Bug Reproduction 1: Prototype Property Key Lookup Crash
Command:
```powershell
node --import tsx -e "
import { computeConfirmationFingerprint, filterScopedConfirmations } from '@sefer/shared';
const fp = computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001');
const conf = {
  category: 'ports',
  query: 'SEATTLE',
  datasetVersion: 'v1',
  candidateCode: '3001',
  confirmedAt: '2026-10-10',
  fingerprint: fp
};
try {
  filterScopedConfirmations({ toString: conf }, {});
} catch (e) {
  console.log('CRASHED WITH ERROR:', e.message);
}
"
```
Verbatim Output:
```
CRASHED WITH ERROR: Cannot read properties of undefined (reading 'trim')
```
- **Code Location**: `shared/src/reference/fingerprint.ts`:
  - Line 246: `const current = activeContexts[key];`
  - Line 247: `if (!current) { ... }`
  - Line 253: `if (isConfirmationValidForLookup(confirmation, current)) { ... }`
  - Line 217: `if (confirmation.category.trim().toLowerCase() !== current.category.trim().toLowerCase()) return false;`

### C. Empirical Bug Reproduction 2: Numeric `candidateCode` Crash
Command:
```powershell
node --import tsx -e "
import { computeConfirmationFingerprint, isConfirmationValidForLookup } from '@sefer/shared';
const fp = computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001');
const conf = {
  category: 'ports',
  query: 'SEATTLE',
  datasetVersion: 'v1',
  candidateCode: '3001',
  confirmedAt: '2026-10-10',
  fingerprint: fp
};
try {
  isConfirmationValidForLookup(conf, {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: 3001 as any
  });
} catch (e) {
  console.log('CRASHED WITH ERROR:', e.message);
}
"
```
Verbatim Output:
```
CRASHED WITH ERROR: current.candidateCode.trim is not a function
```
- **Code Location**: `shared/src/reference/fingerprint.ts`:
  - Line 137: `candidateCode: string | number;` (accepted by `computeConfirmationFingerprint`)
  - Line 220: `if (current.candidateCode !== undefined && confirmation.candidateCode.trim() !== current.candidateCode.trim())` (invokes `.trim()` without string coercion).

### D. Immutability Under Deep Freeze Verification
- In `experiments/task1-scoped-invalidation-stress/stress.test.ts`, both `RawExtractedShipment` and `BrokerDecisions` were frozen using recursive `Object.freeze` across all nested objects and arrays.
- Reference lookup generation, cache writes, cache reads, fingerprint generation, confirmation bindings, and confirmation filtering were executed against these frozen objects.
- Zero `TypeError: Cannot assign to read only property` exceptions occurred.
- `JSON.stringify(rawShipment)` and `JSON.stringify(brokerDecisions)` matched pre-execution snapshots with 100% identity.

---

## 2. Logic Chain

1. **Confirmation Invalidation Isolation**:
   - In `filterScopedConfirmations`, confirmations are iterated per key (`Object.entries(confirmations)`).
   - Each key is compared against its corresponding `activeContexts[key]`.
   - Modifying or adding 50 unrelated fields in `activeContexts` leaves all other keys unaffected. Tested and verified.

2. **Query & Evidence Invalidation Sensitivity**:
   - `computeConfirmationFingerprint` binds `sha256(category + query + datasetVersion + candidateCode)`.
   - Any query change (subtle casing, whitespace, punctuation, accents) causes SHA-256 fingerprint divergence and string mismatch in `isConfirmationValidForLookup`.
   - Invalidations correctly populate `invalidatedKeys` while preserving unrelated entries in `validConfirmations`.

3. **Observation & Decision Immutability**:
   - Reference types (`LookupResult`, `ReferenceConfirmation`) are maintained completely separate from extraction contracts (`RawExtractedShipment`) and broker inputs (`BrokerDecisions`).
   - The reference cache shallow-copies results before applying fingerprints and does not mutate raw extraction inputs.
   - Deep freeze confirms zero side-effects.

4. **Failure Modes & Root Causes**:
   - **Prototype Collision**: JavaScript objects (`{}`) inherit properties from `Object.prototype` (e.g. `toString`, `valueOf`, `constructor`, `hasOwnProperty`). Direct indexing `activeContexts[key]` returns a function rather than `undefined`. Line 247's `if (!current)` evaluates to `false`. Passing this function to `isConfirmationValidForLookup` results in accessing `(Function).category.trim()`, throwing an uncaught `TypeError`.
   - **Type Inconsistency**: `ConfirmationFingerprintParams` allows `candidateCode: string | number`. CBP reference datasets frequently utilize numeric codes (e.g., port codes `3001`, entry types `01`, MOT `11`). However, `isConfirmationValidForLookup` assumes `candidateCode` is a `string` and invokes `.trim()` without `String(...)` coercion, crashing with `TypeError: current.candidateCode.trim is not a function`.

---

## 3. Caveats

- In production pipelines, active context keys are typically structured paths like `invoices[0].lines[1].originCountry` rather than top-level reserved property names like `toString`. However, adversarial input, schema mappings, or dynamically indexed objects can encounter prototype properties.
- This evaluation is focused specifically on scoped confirmation invalidation and observation immutability (Task 1 scope). Dataset-specific lookups (Schedule D/K, ISO countries) are implemented in subsequent subphases (Tasks 2–13).

---

## 4. Conclusion & Verdict

**Verdict**: `REQUEST_CHANGES`

While the core architecture for observation immutability, fingerprinting, and scoped invalidation is sound and passes all baseline tests, defensive hardening in `shared/src/reference/fingerprint.ts` is required before production deployment to prevent runtime crashes:

### Required Action Items:

1. **Harden `filterScopedConfirmations` against Prototype Keys**:
   In `shared/src/reference/fingerprint.ts`, line 246:
   ```typescript
   for (const [key, confirmation] of Object.entries(confirmations)) {
     if (!Object.prototype.hasOwnProperty.call(activeContexts, key)) {
       invalidatedKeys.push(key);
       continue;
     }
     const current = activeContexts[key];
     if (!current) {
       invalidatedKeys.push(key);
       continue;
     }
   ```

2. **Harden `isConfirmationValidForLookup` against Numeric Codes & Missing Fields**:
   In `shared/src/reference/fingerprint.ts`, line 207:
   ```typescript
   export function isConfirmationValidForLookup(
     confirmation: ReferenceConfirmation,
     current: {
       category: string;
       query: string;
       datasetVersion: string;
       candidateCode?: string | number;
     }
   ): boolean {
     if (!validateConfirmationFingerprint(confirmation)) return false;
     if (!current?.category || !current?.query || !current?.datasetVersion) return false;
     if (confirmation.category.trim().toLowerCase() !== String(current.category).trim().toLowerCase()) return false;
     if (confirmation.query.trim() !== String(current.query).trim()) return false;
     if (confirmation.datasetVersion.trim() !== String(current.datasetVersion).trim()) return false;
     if (current.candidateCode !== undefined && String(confirmation.candidateCode).trim() !== String(current.candidateCode).trim()) {
       return false;
     }
     return true;
   }
   ```

---

## 5. Verification Method

To verify these findings and the requested fixes independently:

1. **Run the baseline Task 1 test suite**:
   ```powershell
   node --import tsx --test server/test/reference/task1-infrastructure.test.ts
   ```
   *Expected outcome*: 12 passing tests.

2. **Verify Prototype Key Defense**:
   ```powershell
   node --import tsx -e "
   import { computeConfirmationFingerprint, filterScopedConfirmations } from '@sefer/shared';
   const fp = computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001');
   const conf = { category: 'ports', query: 'SEATTLE', datasetVersion: 'v1', candidateCode: '3001', confirmedAt: '2026-10-10', fingerprint: fp };
   const res = filterScopedConfirmations({ toString: conf }, {});
   console.log('Result:', res);
   "
   ```
   *Current behavior*: Throws `TypeError: Cannot read properties of undefined (reading 'trim')`.
   *Target behavior after fix*: Returns `{ validConfirmations: {}, invalidatedKeys: ['toString'] }` cleanly without throwing.

3. **Verify Numeric Candidate Defense**:
   ```powershell
   node --import tsx -e "
   import { computeConfirmationFingerprint, isConfirmationValidForLookup } from '@sefer/shared';
   const fp = computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001');
   const conf = { category: 'ports', query: 'SEATTLE', datasetVersion: 'v1', candidateCode: '3001', confirmedAt: '2026-10-10', fingerprint: fp };
   const res = isConfirmationValidForLookup(conf, { category: 'ports', query: 'SEATTLE', datasetVersion: 'v1', candidateCode: 3001 as any });
   console.log('Valid:', res);
   "
   ```
   *Current behavior*: Throws `TypeError: current.candidateCode.trim is not a function`.
   *Target behavior after fix*: Returns `Valid: true` cleanly without throwing.
