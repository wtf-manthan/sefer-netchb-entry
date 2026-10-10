import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  LookupResult,
  LookupResultSchema,
  ReferenceConfirmation,
  ReferenceConfirmationSchema,
  ReferenceCandidate,
  computeSha256,
  computeLookupFingerprint,
  validateLookupFingerprint,
  computeConfirmationFingerprint,
  validateConfirmationFingerprint,
  isConfirmationValidForLookup,
  filterScopedConfirmations,
  IsoDateTimeOrDateSchema,
} from '../../shared/src/index';
import { ReferenceDiskCache } from '../../server/src/reference/cache';

function makeTestLookup(overrides: Partial<LookupResult> & { datasetVersion?: string } = {}): LookupResult {
  const version = overrides.datasetVersion ?? overrides.source?.datasetVersion ?? 'v1';
  const { datasetVersion: _omitted, ...cleanOverrides } = overrides;
  const base: Omit<LookupResult, 'fingerprint'> = {
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    outcome: 'exact_match',
    candidates: [
      {
        code: '3001',
        label: 'Seattle, WA',
        description: 'US Customs Port',
        details: { state: 'WA' },
      },
    ],
    source: {
      publisher: 'US Census Bureau',
      url: 'https://www.census.gov/foreign-trade/schedules/d/',
      datasetVersion: version,
      retrievedAt: '2026-10-10T00:00:00.000Z',
      effectiveDate: '2024-01-01',
      license: 'Public Domain',
    },
    matchingMethod: 'normalized_name',
    rationale: 'Normalized query SEATTLE matched Seattle, WA',
    missingFactsNeeded: [],
    codeVerifiedAgainstReference: true,
    userConfirmedForShipment: false,
  };

  const merged = { ...base, ...cleanOverrides };
  if (cleanOverrides.source) {
    merged.source = { ...base.source, ...cleanOverrides.source };
  } else if (overrides.datasetVersion) {
    merged.source = { ...base.source, datasetVersion: overrides.datasetVersion };
  }
  const fingerprint = computeLookupFingerprint({
    category: merged.category,
    query: merged.query,
    datasetVersion: merged.source.datasetVersion,
    candidates: merged.candidates,
  });

  return { ...merged, fingerprint };
}

// ============================================================================
// SUITE 1: Envelope vs Payload Desynchronization Recovery in ReferenceDiskCache
// ============================================================================
test('Adversarial Challenge: Envelope vs Payload Desynchronization Recovery in ReferenceDiskCache', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-challenger-desync-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir);
    const validPortLookup = makeTestLookup();
    const validCountryLookup = makeTestLookup({
      category: 'countries',
      targetField: 'invoices[0].lines[0].originCountry',
      query: 'VIETNAM',
      datasetVersion: 'iso-3166-1',
      candidates: [{ code: 'VN', label: 'Viet Nam' }],
      source: {
        publisher: 'ISO',
        url: 'https://iso.org',
        datasetVersion: 'iso-3166-1',
        retrievedAt: '2026-10-10T00:00:00.000Z',
      },
    });

    // Subtest 1.1: set() rejects category desynchronization
    assert.throws(
      () => cache.set('ports', 'SEATTLE', 'v1', validCountryLookup),
      /Cross-payload desynchronization/i,
      'set() must reject writing country result into port cache envelope'
    );

    // Subtest 1.2: set() rejects query desynchronization
    assert.throws(
      () => cache.set('ports', 'SEATTLE', 'v1', makeTestLookup({ query: 'TACOMA' })),
      /Cross-payload desynchronization/i,
      'set() must reject writing query TACOMA into query SEATTLE cache envelope'
    );

    // Subtest 1.3: set() rejects datasetVersion desynchronization
    assert.throws(
      () => cache.set('ports', 'SEATTLE', 'v1', makeTestLookup({ source: { ...validPortLookup.source, datasetVersion: 'v2' } })),
      /Cross-payload desynchronization/i,
      'set() must reject writing datasetVersion v2 into datasetVersion v1 cache envelope'
    );

    // Subtest 1.4: on-disk corruption - Category Desynchronization recovery
    const key = cache.computeCacheKey('ports', 'SEATTLE', 'v1');
    const portDir = path.join(tmpDir, 'ports');
    fs.mkdirSync(portDir, { recursive: true });
    const targetFile = path.join(portDir, `${key}.json`);

    const diskEntryCatDesync = {
      key,
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      cachedAt: new Date().toISOString(),
      fingerprint: validCountryLookup.fingerprint,
      data: validCountryLookup,
    };
    fs.writeFileSync(targetFile, JSON.stringify(diskEntryCatDesync), 'utf8');

    // inspect() must flag corruption and unlink file
    let inspect = cache.inspect('ports', 'SEATTLE', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.match(inspect.corruptedReason ?? '', /desynchronization/i);
    assert.equal(fs.existsSync(targetFile), false, 'Corrupted cache file must be unlinked from disk');

    // Subsequent inspect() reports miss
    assert.equal(cache.inspect('ports', 'SEATTLE', 'v1').status, 'miss');

    // Subtest 1.5: on-disk corruption - Query Desynchronization recovery
    const diskEntryQueryDesync = {
      key,
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      cachedAt: new Date().toISOString(),
      fingerprint: validPortLookup.fingerprint,
      data: makeTestLookup({ query: 'TACOMA' }),
    };
    fs.writeFileSync(targetFile, JSON.stringify(diskEntryQueryDesync), 'utf8');

    inspect = cache.inspect('ports', 'SEATTLE', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.match(inspect.corruptedReason ?? '', /desynchronization/i);
    assert.equal(fs.existsSync(targetFile), false);

    // Subtest 1.6: on-disk corruption - DatasetVersion Desynchronization recovery
    const diskEntryVerDesync = {
      key,
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      cachedAt: new Date().toISOString(),
      fingerprint: validPortLookup.fingerprint,
      data: makeTestLookup({ source: { ...validPortLookup.source, datasetVersion: 'v2' } }),
    };
    fs.writeFileSync(targetFile, JSON.stringify(diskEntryVerDesync), 'utf8');

    inspect = cache.inspect('ports', 'SEATTLE', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.match(inspect.corruptedReason ?? '', /desynchronization/i);
    assert.equal(fs.existsSync(targetFile), false);

    // Subtest 1.7: get() safely returns null and cleans up on desynchronization
    fs.writeFileSync(targetFile, JSON.stringify(diskEntryCatDesync), 'utf8');
    const getResult = cache.get('ports', 'SEATTLE', 'v1');
    assert.equal(getResult, null, 'cache.get() must return null for corrupted entry');
    assert.equal(fs.existsSync(targetFile), false, 'cache.get() must unlink corrupted entry');

    // Subtest 1.8: Clean set() and get() succeeds after recovery
    cache.set('ports', 'SEATTLE', 'v1', validPortLookup);
    const recoveredGet = cache.get('ports', 'SEATTLE', 'v1');
    assert.ok(recoveredGet !== null);
    assert.equal(recoveredGet.category, 'ports');
    assert.equal(recoveredGet.query, 'SEATTLE');
    assert.equal(recoveredGet.source.datasetVersion, 'v1');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================================
// SUITE 2: Strict ISO 8601 Date and Datetime Validation in Zod Schemas
// ============================================================================
test('Adversarial Challenge: ISO 8601 Strict Validation in Zod Schemas', () => {
  // Subtest 2.1: Valid ISO calendar dates (YYYY-MM-DD)
  const validCalendarDates = [
    '2026-10-10',
    '2024-02-29', // Valid leap year
    '1999-12-31',
    '2000-01-01',
    '2025-06-15',
  ];
  for (const dateStr of validCalendarDates) {
    const res = IsoDateTimeOrDateSchema.safeParse(dateStr);
    assert.equal(res.success, true, `Expected valid calendar date: ${dateStr}`);
  }

  // Subtest 2.2: Valid ISO datetimes (UTC and timezones)
  const validIsoDateTimes = [
    '2026-10-10T00:00:00Z',
    '2026-10-10T12:30:45.123Z',
    '2026-10-10T15:00:00+02:00',
    '2026-10-10T08:30:00-05:00',
    '2026-10-10T12:30:00+05:30',
  ];
  for (const dtStr of validIsoDateTimes) {
    const res = IsoDateTimeOrDateSchema.safeParse(dtStr);
    assert.equal(res.success, true, `Expected valid datetime: ${dtStr}`);
  }

  // Subtest 2.3: Rejection of invalid formatting
  const invalidFormatStrings = [
    'yesterday',
    'today',
    'tomorrow',
    'NOT_A_REAL_DATE_YESTERDAY',
    'NOT_AN_ISO_DATE',
    '2026/10/10',             // Slash separator rejected
    '10-10-2026',             // US format rejected
    '10/10/2026',             // US slash format rejected
    '2026-10-10 12:00:00',    // Space instead of T rejected
    '2026-1-1',               // Unpadded rejected
    '2026-10-10T12:00',       // Incomplete time rejected
    '',                       // Empty string rejected
    '2026-10-10T',            // Incomplete ISO datetime rejected
  ];
  for (const inv of invalidFormatStrings) {
    const res = IsoDateTimeOrDateSchema.safeParse(inv);
    assert.equal(res.success, false, `Expected rejected format: "${inv}"`);
  }

  // Subtest 2.4: Impossible calendar dates rejected by refine()
  const impossibleCalendarDates = [
    '2026-99-99',
    '2026-00-10',
    '2026-13-10',
  ];
  for (const imp of impossibleCalendarDates) {
    const res = IsoDateTimeOrDateSchema.safeParse(imp);
    assert.equal(res.success, false, `Expected impossible calendar date to fail: "${imp}"`);
  }

  // Subtest 2.5: LookupResultSchema integration test
  const sample = makeTestLookup();
  assert.throws(
    () => LookupResultSchema.parse({ ...sample, source: { ...sample.source, retrievedAt: 'invalid-date' } }),
    /Must be a valid ISO 8601 date/i
  );
  assert.throws(
    () => LookupResultSchema.parse({ ...sample, source: { ...sample.source, effectiveDate: 'invalid-date' } }),
    /Must be a valid ISO 8601 date/i
  );

  // Subtest 2.6: ReferenceConfirmationSchema integration test
  const validConf: ReferenceConfirmation = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001'),
  };
  assert.doesNotThrow(() => ReferenceConfirmationSchema.parse(validConf));

  assert.throws(
    () => ReferenceConfirmationSchema.parse({ ...validConf, confirmedAt: 'yesterday' }),
    /Must be a valid ISO 8601 date/i
  );
});

// ============================================================================
// SUITE 3: Deterministic Candidate Sorting and Details Inclusion
// ============================================================================
test('Adversarial Challenge: Deterministic Candidate Sorting and Details Inclusion', () => {
  const baseParams = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
  };

  // Subtest 3.1: Candidates with identical codes sort deterministically by label
  const candidatesIdenticalCodes = [
    { code: '3001', label: 'Beta Pier 66', description: 'Port terminal' },
    { code: '3001', label: 'Alpha Pier 91', description: 'Port terminal' },
  ];
  const fpOrderA = computeLookupFingerprint({ ...baseParams, candidates: candidatesIdenticalCodes });
  const fpOrderB = computeLookupFingerprint({
    ...baseParams,
    candidates: [candidatesIdenticalCodes[1], candidatesIdenticalCodes[0]],
  });
  assert.equal(fpOrderA, fpOrderB, 'Identical codes must tie-break deterministically by label');

  // Subtest 3.2: Candidates with identical code and label tie-break deterministically by description
  const candidatesIdenticalCodeAndLabel = [
    { code: '3001', label: 'Seattle Terminal', description: 'Zulu Facility' },
    { code: '3001', label: 'Seattle Terminal', description: 'Alpha Facility' },
  ];
  const fpDescOrderA = computeLookupFingerprint({ ...baseParams, candidates: candidatesIdenticalCodeAndLabel });
  const fpDescOrderB = computeLookupFingerprint({
    ...baseParams,
    candidates: [candidatesIdenticalCodeAndLabel[1], candidatesIdenticalCodeAndLabel[0]],
  });
  assert.equal(fpDescOrderA, fpDescOrderB, 'Identical code & label must tie-break deterministically by description');

  // Subtest 3.3: Permutation stress test across 10 distinct candidate orderings
  const candidateList = [
    { code: '3001', label: 'Terminal Beta', description: 'Facility 2' },
    { code: '3001', label: 'Terminal Alpha', description: 'Facility 1' },
    { code: '3002', label: 'Tacoma Dock', description: 'Facility 3' },
    { code: '1001', label: 'Bellingham Pier', description: 'Facility 4' },
    { code: '3002', label: 'Tacoma Anchorage', description: 'Facility 5' },
  ];

  const referenceFp = computeLookupFingerprint({ ...baseParams, candidates: candidateList });

  for (let i = 0; i < 10; i++) {
    // Deterministic pseudorandom shuffle
    const shuffled = [...candidateList].sort((a, b) => {
      const hashA = (a.code + a.label).length * (i + 1);
      const hashB = (b.code + b.label).length * (i + 1);
      return hashA - hashB || a.label.localeCompare(b.label);
    });
    const shuffledFp = computeLookupFingerprint({ ...baseParams, candidates: shuffled });
    assert.equal(shuffledFp, referenceFp, `Permutation iteration ${i} must match reference fingerprint`);
  }

  // Subtest 3.4: Description alteration sensitivity
  const fpActiveDesc = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', description: 'Active customs port' }],
  });
  const fpClosedDesc = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', description: 'Permanently closed' }],
  });
  assert.notEqual(fpActiveDesc, fpClosedDesc, 'Candidate description change must alter fingerprint');

  // Subtest 3.5: Details mutation sensitivity
  const fpDetails1 = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', details: { berthNumber: 5, status: 'operational' } }],
  });
  const fpDetails2 = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', details: { berthNumber: 6, status: 'operational' } }],
  });
  assert.notEqual(fpDetails1, fpDetails2, 'Candidate details change must alter fingerprint');

  // Subtest 3.6: Details key order invariance (canonicalizeDetails sorts keys)
  const fpDetailsKeysOrderA = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', details: { z_key: 'last', a_key: 'first' } }],
  });
  const fpDetailsKeysOrderB = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', details: { a_key: 'first', z_key: 'last' } }],
  });
  assert.equal(fpDetailsKeysOrderA, fpDetailsKeysOrderB, 'Details key order must be canonicalized and invariant');
});

// ============================================================================
// SUITE 4: Role Context Isolation and Confirmation Robustness
// ============================================================================
test('Adversarial Challenge: Role Context Isolation and Confirmation Robustness', () => {
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
      candidateCode: '3001',
    }),
  };

  // Subtest 4.1: Confirmation cannot bleed to header.entryPort
  const isEntryPortValid = isConfirmationValidForLookup(confUnlading, {
    category: 'ports',
    targetField: 'header.entryPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
  });
  assert.equal(isEntryPortValid, false, 'Confirmation for unladingPort must NOT validate for entryPort');

  // Subtest 4.2: Confirmation cannot bleed to bills[0].unladingPort
  const isBillPortValid = isConfirmationValidForLookup(confUnlading, {
    category: 'ports',
    targetField: 'bills[0].unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
  });
  assert.equal(isBillPortValid, false, 'Confirmation for header.unladingPort must NOT validate for bills[0].unladingPort');

  // Subtest 4.3: Confirmation matches exact role
  const isMatchingRoleValid = isConfirmationValidForLookup(confUnlading, {
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
  });
  assert.equal(isMatchingRoleValid, true, 'Confirmation for header.unladingPort must validate for header.unladingPort');

  // Subtest 4.4: Numeric candidateCode coercion
  const isNumericCodeValid = isConfirmationValidForLookup(confUnlading, {
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: 3001 as any,
  });
  assert.equal(isNumericCodeValid, true, 'Numeric candidate code 3001 must evaluate valid without TypeError');

  // Subtest 4.5: Object prototype collision resistance in filterScopedConfirmations
  const prototypeAttackMap = {
    toString: confUnlading,
    hasOwnProperty: confUnlading,
  };
  const activeEmptyContexts = {};
  const { validConfirmations, invalidatedKeys } = filterScopedConfirmations(prototypeAttackMap, activeEmptyContexts);
  assert.equal(invalidatedKeys.includes('toString'), true);
  assert.equal(invalidatedKeys.includes('hasOwnProperty'), true);
  assert.equal(Object.keys(validConfirmations).length, 0);
});
