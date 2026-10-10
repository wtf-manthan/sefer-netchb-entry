# Experiment: Task 1 Scoped Invalidation & Immutability Adversarial Stress Test

## Purpose
Adversarially challenge the scoped confirmation invalidation and observation immutability implemented in Task 1:
1. Verify confirmation preservation under complex mutations to unrelated fields.
2. Verify immediate invalidation upon altering query, evidence, category, dataset version, or candidate code.
3. Verify strict immutability of `RawExtractedShipment` and `BrokerDecisions` using recursive deep freeze.
4. Expose failure modes, edge cases, prototype pollution vulnerabilities, and runtime crashes.

## How to Rerun
Run from the monorepo root:
```powershell
node --import tsx --test experiments/task1-scoped-invalidation-stress/stress.test.ts
```
