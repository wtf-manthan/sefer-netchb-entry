# Experiment: Task 1 Iteration 2 Adversarial Re-challenge

## Purpose
Adversarial test harness executed by Challenger 1 to independently verify:
1. Envelope vs payload desynchronization detection and recovery in `ReferenceDiskCache`.
2. Strict ISO 8601 date and datetime format validation in Zod schemas (`IsoDateTimeOrDateSchema`).
3. Deterministic candidate sorting with matching codes, label/description tie-breaking, permutation invariance, and details inclusion.

## How to Rerun
Execute the test runner via Node.js with tsx loader:
```powershell
node --import tsx --test experiments/task1_iter2_rechallenge/rechallenge.test.ts
```
