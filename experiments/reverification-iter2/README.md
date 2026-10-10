# Experiment: Task 1 Iteration 2 Adversarial Re-verification Stress Tests

This experiment executes empirical stress tests and edge case harnesses specifically evaluating the Iteration 2 fixes for Task 1 Reference Infrastructure.

## Tested Areas
1. Prototype collision defense in ilterScopedConfirmations across all built-in Object.prototype properties (	oString, alueOf, constructor, hasOwnProperty, etc.), null-prototype objects, and prototype poisoning.
2. Numeric candidateCode coercion across positive/negative numbers, zero, floats, string vs number matching, and BigInt/NaN/Infinity edge cases in isConfirmationValidForLookup and computeConfirmationFingerprint.
3. Port role context isolation between header.entryPort and header.unladingPort, preventing cross-role confirmation reuse while preserving valid scoped confirmations.

## How to rerun

`ash
node --import tsx experiments/reverification-iter2/stress.test.ts
`
