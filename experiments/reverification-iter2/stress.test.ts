import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeConfirmationFingerprint,
  validateConfirmationFingerprint,
  isConfirmationValidForLookup,
  filterScopedConfirmations,
  ReferenceConfirmation
} from '@sefer/shared';

// ============================================================================
// SUITE 1: PROTOTYPE KEY COLLISION DEFENSE IN filterScopedConfirmations
// ============================================================================

test('Prototype Collision: Built-in Object.prototype keys are safely invalidated without exceptions', () => {
  const protoKeys = [
    'toString',
    'valueOf',
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    '__proto__',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__'
  ];

  for (const key of protoKeys) {
    const fp = computeConfirmationFingerprint({
      category: 'ports',
      targetField: key,
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: '3001'
    });
    const conf: ReferenceConfirmation = {
      category: 'ports',
      targetField: key,
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: '3001',
      confirmedAt: '2026-10-10T00:00:00.000Z',
      fingerprint: fp
    };

    // 1. Empty object activeContexts (inherits prototype properties)
    const resEmpty = filterScopedConfirmations({ [key]: conf }, {});
    assert.equal(
      resEmpty.invalidatedKeys.includes(key),
      true,
      `Key "${key}" must be invalidated when not present in activeContexts`
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(resEmpty.validConfirmations, key),
      false,
      `Key "${key}" must NOT be in validConfirmations own properties`
    );
    assert.equal(Object.keys(resEmpty.validConfirmations).length, 0);

    // 2. Object.create(null) as activeContexts
    const nullContexts = Object.create(null);
    const resNull = filterScopedConfirmations({ [key]: conf }, nullContexts);
    assert.equal(
      resNull.invalidatedKeys.includes(key),
      true,
      `Key "${key}" must be invalidated when activeContexts has null prototype`
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(resNull.validConfirmations, key),
      false,
      `Key "${key}" must NOT be in validConfirmations own properties`
    );
    assert.equal(Object.keys(resNull.validConfirmations).length, 0);

    // 3. activeContexts HAS own property for this key matching the confirmation
    const activeWithOwn = {
      [key]: {
        category: 'ports',
        targetField: key,
        query: 'SEATTLE',
        datasetVersion: 'v1',
        candidateCode: '3001'
      }
    };
    const resOwn = filterScopedConfirmations({ [key]: conf }, activeWithOwn);
    assert.equal(
      resOwn.invalidatedKeys.includes(key),
      false,
      `Key "${key}" must NOT be invalidated when own property matches context`
    );
    assert.equal(
      resOwn.validConfirmations[key],
      conf,
      `Valid confirmation for "${key}" must be preserved`
    );
  }
});

test('Prototype Collision: Inherited prototype properties cannot satisfy activeContext lookups', () => {
  const proto = {
    poisonedField: {
      category: 'ports',
      targetField: 'poisonedField',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: '3001'
    }
  };
  const poisonedContexts = Object.create(proto);
  const fp = computeConfirmationFingerprint({
    category: 'ports',
    targetField: 'poisonedField',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001'
  });
  const confPoison: ReferenceConfirmation = {
    category: 'ports',
    targetField: 'poisonedField',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fp
  };

  const resPoison = filterScopedConfirmations({ poisonedField: confPoison }, poisonedContexts);
  assert.equal(
    resPoison.invalidatedKeys.includes('poisonedField'),
    true,
    'Inherited prototype property must NOT satisfy hasOwnProperty check'
  );
  assert.equal(resPoison.validConfirmations['poisonedField'], undefined);
});

test('Prototype Collision: Malformed, null, or primitive values in activeContexts are safely invalidated', () => {
  const corruptContexts = {
    kNull: null as any,
    kUndefined: undefined as any,
    kNumber: 12345 as any,
    kString: 'malicious' as any,
    kEmptyObj: {} as any
  };

  const fp = computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001');
  const confSimple: ReferenceConfirmation = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fp
  };

  const resCorrupt = filterScopedConfirmations(
    {
      kNull: confSimple,
      kUndefined: confSimple,
      kNumber: confSimple,
      kString: confSimple,
      kEmptyObj: confSimple
    },
    corruptContexts
  );

  assert.equal(resCorrupt.invalidatedKeys.length, 5, 'All corrupt activeContext entries must be invalidated');
  assert.equal(Object.keys(resCorrupt.validConfirmations).length, 0);
});

// ============================================================================
// SUITE 2: NUMERIC CANDIDATECODE COERCION IN isConfirmationValidForLookup
// ============================================================================

test('Numeric CandidateCode: Safe coercion and matching across numbers, strings, and zero', () => {
  const fp3001 = computeConfirmationFingerprint({
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: 3001
  });

  const conf3001String: ReferenceConfirmation = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fp3001
  };

  // 1. Number candidateCode in current context matches string in confirmation
  assert.equal(
    isConfirmationValidForLookup(conf3001String, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: 3001 as any
    }),
    true,
    'Numeric candidateCode 3001 in current context must match string "3001" in confirmation'
  );

  // 2. Mismatched numeric candidateCode returns false without throwing
  assert.equal(
    isConfirmationValidForLookup(conf3001String, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: 3002 as any
    }),
    false,
    'Mismatched numeric candidateCode 3002 must return false'
  );

  // 3. Numeric zero (0) candidateCode
  const fpZero = computeConfirmationFingerprint('categories', 'GENERAL', 'v1', 0);
  const confZero: ReferenceConfirmation = {
    category: 'categories',
    query: 'GENERAL',
    datasetVersion: 'v1',
    candidateCode: '0',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fpZero
  };

  assert.equal(
    isConfirmationValidForLookup(confZero, {
      category: 'categories',
      query: 'GENERAL',
      datasetVersion: 'v1',
      candidateCode: 0 as any
    }),
    true,
    'Numeric candidateCode 0 in current context must match "0" in confirmation'
  );

  assert.equal(
    isConfirmationValidForLookup(confZero, {
      category: 'categories',
      query: 'GENERAL',
      datasetVersion: 'v1',
      candidateCode: 1 as any
    }),
    false,
    'Numeric candidateCode 1 must NOT match "0"'
  );

  // 4. Whitespace trimming around numbers
  assert.equal(
    isConfirmationValidForLookup(conf3001String, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: '  3001  ' as any
    }),
    true,
    'Padded candidateCode "  3001  " must trim and match'
  );

  // 5. Negative number candidateCode
  const fpNeg = computeConfirmationFingerprint('adjustments', 'DISCOUNT', 'v1', -5);
  const confNeg: ReferenceConfirmation = {
    category: 'adjustments',
    query: 'DISCOUNT',
    datasetVersion: 'v1',
    candidateCode: '-5',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fpNeg
  };

  assert.equal(
    isConfirmationValidForLookup(confNeg, {
      category: 'adjustments',
      query: 'DISCOUNT',
      datasetVersion: 'v1',
      candidateCode: -5 as any
    }),
    true,
    'Negative numeric candidateCode -5 must match "-5"'
  );

  // 6. Leading zeros are preserved: "0101" vs 101 must NOT match
  const fpPort0101 = computeConfirmationFingerprint('ports', 'PORTLAND', 'v1', '0101');
  const confPort0101: ReferenceConfirmation = {
    category: 'ports',
    query: 'PORTLAND',
    datasetVersion: 'v1',
    candidateCode: '0101',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fpPort0101
  };

  assert.equal(
    isConfirmationValidForLookup(confPort0101, {
      category: 'ports',
      query: 'PORTLAND',
      datasetVersion: 'v1',
      candidateCode: 101 as any
    }),
    false,
    'String "0101" must NOT match numeric 101 (preserves CBP leading zero distinction)'
  );

  assert.equal(
    isConfirmationValidForLookup(confPort0101, {
      category: 'ports',
      query: 'PORTLAND',
      datasetVersion: 'v1',
      candidateCode: '0101'
    }),
    true,
    'String "0101" matches "0101"'
  );

  // 7. Non-number / boundary values do not crash
  assert.equal(
    isConfirmationValidForLookup(conf3001String, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: NaN as any
    }),
    false,
    'NaN candidateCode safely evaluates to false without throwing'
  );

  assert.equal(
    isConfirmationValidForLookup(conf3001String, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: null as any
    }),
    false,
    'null candidateCode safely evaluates to false without throwing'
  );
});

// ============================================================================
// SUITE 3: PORT ROLE CONTEXT ISOLATION (entryPort vs unladingPort)
// ============================================================================

test('Role Context Isolation: header.entryPort and header.unladingPort are strictly isolated', () => {
  const confUnlading: ReferenceConfirmation = {
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      category: 'ports',
      targetField: 'header.unladingPort',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001'
    })
  };

  const confEntry: ReferenceConfirmation = {
    category: 'ports',
    targetField: 'header.entryPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      category: 'ports',
      targetField: 'header.entryPort',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001'
    })
  };

  // 1. Cross-role fingerprint separation: fingerprints must be distinct
  assert.notEqual(
    confUnlading.fingerprint,
    confEntry.fingerprint,
    'Fingerprints for unladingPort and entryPort must be distinct even with identical query & candidate'
  );

  // 2. isConfirmationValidForLookup cross-role rejection
  const activeEntryContext = {
    category: 'ports',
    targetField: 'header.entryPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001'
  };

  const activeUnladingContext = {
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001'
  };

  assert.equal(
    isConfirmationValidForLookup(confUnlading, activeEntryContext),
    false,
    'Unlading port confirmation must NOT validate against active entryPort context'
  );

  assert.equal(
    isConfirmationValidForLookup(confEntry, activeUnladingContext),
    false,
    'Entry port confirmation must NOT validate against active unladingPort context'
  );

  assert.equal(
    isConfirmationValidForLookup(confUnlading, activeUnladingContext),
    true,
    'Unlading port confirmation MUST validate against matching active unladingPort context'
  );

  assert.equal(
    isConfirmationValidForLookup(confEntry, activeEntryContext),
    true,
    'Entry port confirmation MUST validate against matching active entryPort context'
  );

  // 3. Omitting targetField vs specified targetField
  assert.equal(
    isConfirmationValidForLookup(confUnlading, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001'
    }),
    false,
    'Confirmation bound to targetField must NOT validate when targetField is omitted in lookup context'
  );

  const confNoTarget: ReferenceConfirmation = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001'
    })
  };

  assert.equal(
    isConfirmationValidForLookup(confNoTarget, activeEntryContext),
    false,
    'Confirmation with no targetField must NOT validate against targetField-bound lookup context'
  );

  // 4. White space normalization on targetField
  assert.equal(
    isConfirmationValidForLookup(confEntry, {
      ...activeEntryContext,
      targetField: '  header.entryPort  '
    }),
    true,
    'Whitespace around targetField must be trimmed and matched'
  );

  // 5. Tampered targetField without fingerprint recalculation is rejected
  const tamperedConf: ReferenceConfirmation = {
    ...confEntry,
    targetField: 'header.unladingPort'
  };
  assert.equal(
    validateConfirmationFingerprint(tamperedConf),
    false,
    'Tampered targetField must fail validateConfirmationFingerprint'
  );
  assert.equal(
    isConfirmationValidForLookup(tamperedConf, activeUnladingContext),
    false,
    'Tampered targetField must be rejected by isConfirmationValidForLookup'
  );

  // 6. Dual-port scoped filtering: one updated, one preserved
  const dualConfirmations = {
    'header.entryPort': confEntry,
    'header.unladingPort': confUnlading
  };

  const dualActiveContextsOneChanged = {
    'header.entryPort': {
      ...activeEntryContext,
      query: 'TACOMA'
    },
    'header.unladingPort': activeUnladingContext
  };

  const { validConfirmations, invalidatedKeys } = filterScopedConfirmations(
    dualConfirmations,
    dualActiveContextsOneChanged
  );

  assert.deepEqual(
    invalidatedKeys,
    ['header.entryPort'],
    'Only header.entryPort must be invalidated when its query changes'
  );
  assert.equal(
    validConfirmations['header.unladingPort'],
    confUnlading,
    'header.unladingPort must remain valid when header.entryPort query changes'
  );
  assert.equal(validConfirmations['header.entryPort'], undefined);

  // 7. Swapped ports in active contexts invalidates both due to query or role mismatch
  const dualActiveContextsSwapped = {
    'header.entryPort': {
      ...activeUnladingContext,
      targetField: 'header.unladingPort'
    },
    'header.unladingPort': {
      ...activeEntryContext,
      targetField: 'header.entryPort'
    }
  };

  const swappedResult = filterScopedConfirmations(dualConfirmations, dualActiveContextsSwapped);
  assert.equal(swappedResult.invalidatedKeys.length, 2, 'Both confirmations must be invalidated when roles are swapped');
  assert.equal(Object.keys(swappedResult.validConfirmations).length, 0);
});

// ============================================================================
// SUITE 4: MULTI-INVOICE LINE ITEM SCOPE ISOLATION
// ============================================================================

test('Role Context Isolation: Multi-invoice line item scopes prevent cross-line bleed', () => {
  const line0Key = 'invoices[0].lines[0].originCountry';
  const line1Key = 'invoices[0].lines[1].originCountry';

  const confLine0: ReferenceConfirmation = {
    category: 'countries',
    targetField: line0Key,
    query: 'VIETNAM',
    datasetVersion: 'iso-3166-1',
    candidateCode: 'VN',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      category: 'countries',
      targetField: line0Key,
      query: 'VIETNAM',
      datasetVersion: 'iso-3166-1',
      candidateCode: 'VN'
    })
  };

  const confLine1: ReferenceConfirmation = {
    category: 'countries',
    targetField: line1Key,
    query: 'VIETNAM',
    datasetVersion: 'iso-3166-1',
    candidateCode: 'VN',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      category: 'countries',
      targetField: line1Key,
      query: 'VIETNAM',
      datasetVersion: 'iso-3166-1',
      candidateCode: 'VN'
    })
  };

  assert.notEqual(
    confLine0.fingerprint,
    confLine1.fingerprint,
    'Different line item target fields must produce distinct fingerprints'
  );

  assert.equal(
    isConfirmationValidForLookup(confLine0, {
      category: 'countries',
      targetField: line1Key,
      query: 'VIETNAM',
      datasetVersion: 'iso-3166-1',
      candidateCode: 'VN'
    }),
    false,
    'Line 0 confirmation must NOT validate against Line 1 target field'
  );
});
