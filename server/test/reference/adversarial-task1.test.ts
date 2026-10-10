import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
  DatasetManifestSchema,
} from '@sefer/shared';
import { ReferenceDiskCache } from '../../src/reference/cache';

function makeBaseLookup(overrides: Partial<LookupResult> & { datasetVersion?: string } = {}): LookupResult {
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
    rationale: 'Exact normalized match',
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

// ---------------------------------------------------------------------------
// SUITE 1: SHA-256 Oracle Verification (TS vs node:crypto)
// ---------------------------------------------------------------------------
test('Oracle: computeSha256 strictly matches node:crypto across boundary lengths and UTF-8', () => {
  const testLengths = [0, 1, 2, 10, 55, 56, 63, 64, 65, 119, 120, 127, 128, 129, 255, 256, 511, 512, 1024, 4096, 65536];

  for (const len of testLengths) {
    const text = 'A'.repeat(len);
    const expected = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    const actual = computeSha256(text);
    assert.equal(actual, expected, `SHA256 mismatch for ASCII text length ${len}`);
  }

  // Multibyte UTF-8 characters (emojis, CJK, accents)
  const unicodeSamples = [
    '🚢 Shipping Container Port 上海',
    'São Paulo - Câmbio 100€',
    '日本語のテストデータ - Schedule D 港湾コード',
    '🔥💥🚀 Standard SHA-256 FIPS 180-4 📦',
    'Mixed ASCII and symbols: \u0000\u0001\u0002\t\r\n\\"/@#$',
  ];

  for (const sample of unicodeSamples) {
    const expected = crypto.createHash('sha256').update(sample, 'utf8').digest('hex');
    const actual = computeSha256(sample);
    assert.equal(actual, expected, `SHA256 mismatch for Unicode sample: "${sample}"`);
  }

  // Uint8Array input vs Buffer
  const randomBytes = crypto.randomBytes(256);
  const expectedBytes = crypto.createHash('sha256').update(randomBytes).digest('hex');
  const actualBytes = computeSha256(new Uint8Array(randomBytes));
  assert.equal(actualBytes, expectedBytes, 'SHA256 mismatch for raw Uint8Array bytes');
});

// ---------------------------------------------------------------------------
// SUITE 2: Cache Key Collisions & Delimiter Attacks
// ---------------------------------------------------------------------------
test('Adversarial Cache: Delimiter and injection collision resistance', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-stress-keys-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});

    // Attempt delimiter injection attack
    // Can category="a", query="b", version="c" collide with query containing JSON delimiters?
    const keyNormal = cache.computeCacheKey('ports', 'SEATTLE', 'v1');
    const keyInjected = cache.computeCacheKey('ports', 'SEATTLE", "v1"] //', 'v1');
    assert.notEqual(keyNormal, keyInjected, 'JSON delimiter injection must not collide');

    // Case sensitivity: category is lowercased, but query is not
    const keyCatUpper = cache.computeCacheKey('PORTS', 'SEATTLE', 'v1');
    assert.equal(keyCatUpper, keyNormal, 'Category case variation should normalize');

    const keyQueryLower = cache.computeCacheKey('ports', 'seattle', 'v1');
    assert.notEqual(keyQueryLower, keyNormal, 'Query case difference must isolate keys');

    // Leading/trailing whitespace: category, query, and datasetVersion are trimmed
    const keyQuerySpaced = cache.computeCacheKey('ports', '  SEATTLE  ', 'v1');
    assert.equal(keyQuerySpaced, keyNormal, 'Query whitespace should trim to same key');

    // Empty strings vs whitespace-only
    const keyEmpty = cache.computeCacheKey('ports', '', 'v1');
    const keyWhitespace = cache.computeCacheKey('ports', '   ', 'v1');
    assert.equal(keyEmpty, keyWhitespace, 'Whitespace-only query trims to empty string');

    const keyVersion1 = cache.computeCacheKey('ports', 'Q', '2024.1');
    const keyVersion2 = cache.computeCacheKey('ports', 'Q', '2024.2');
    assert.notEqual(keyVersion1, keyVersion2, 'Different dataset versions must isolate keys');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// SUITE 3: Path Traversal & OS Security
// ---------------------------------------------------------------------------
test('Adversarial Cache: Path traversal sanitization prevents escaping directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-stress-traversal-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});
    const lookup = makeBaseLookup();

    const attackCategories = [
      '../../etc',
      '..\\..\\windows\\system32',
      '....//....//escape',
      '/',
      '\\',
      '.',
      '..',
      'ports/../../secret',
      'cat\x00nullbyte',
      '   ',
      '--weird-cat--',
      'con',
      'aux',
      'prn',
      'nul',
    ];

    for (const cat of attackCategories) {
      const lookup = makeBaseLookup({ category: cat, query: 'QUERY', datasetVersion: 'v1' });
      // Should not throw and must stay safely inside tmpDir
      cache.set(cat, 'QUERY', 'v1', lookup);

      // Verify no files were created outside tmpDir
      const parentDir = path.dirname(tmpDir);
      assert.equal(fs.existsSync(path.join(parentDir, 'secret')), false);
      assert.equal(fs.existsSync(path.join(parentDir, 'etc')), false);

      const inspect = cache.inspect(cat, 'QUERY', 'v1');
      assert.equal(inspect.status, 'hit');
      assert.ok(inspect.result !== null);

      // Clean up via clear(cat)
      cache.clear(cat);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// SUITE 4: Malformed Injections & Cache Corruption Stress
// ---------------------------------------------------------------------------
test('Adversarial Cache: Zero-byte file, truncated JSON, array, and schema tampering', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-stress-corrupt-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});
    const valid = makeBaseLookup({ query: 'TEST', datasetVersion: 'v1' });
    cache.set('ports', 'TEST', 'v1', valid);

    const key = cache.computeCacheKey('ports', 'TEST', 'v1');
    const filePath = path.join(tmpDir, 'ports', `${key}.json`);

    // 1. Zero-byte empty file
    fs.writeFileSync(filePath, '', 'utf8');
    let inspect = cache.inspect('ports', 'TEST', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.equal(inspect.result, null);
    assert.equal(fs.existsSync(filePath), false, 'Zero-byte file must be safely unlinked');

    // 2. Truncated JSON
    fs.writeFileSync(filePath, '{"key": "abc', 'utf8');
    inspect = cache.inspect('ports', 'TEST', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.equal(fs.existsSync(filePath), false);

    // 3. Valid JSON but wrong primitive types (array, number, boolean, null)
    const malformedEntries = [
      '[]',
      '12345',
      '"just a string"',
      'true',
      'null',
      '{}', // empty object missing required properties
      JSON.stringify({ key, category: 'ports' }), // missing query, datasetVersion, data
    ];

    for (const malformed of malformedEntries) {
      fs.writeFileSync(filePath, malformed, 'utf8');
      inspect = cache.inspect('ports', 'TEST', 'v1');
      assert.equal(inspect.status, 'corrupted');
      assert.equal(fs.existsSync(filePath), false);
    }

    // 4. Valid wrapper object but data missing required fields
    const invalidDataEntry = {
      key,
      category: 'ports',
      query: 'TEST',
      datasetVersion: 'v1',
      cachedAt: new Date().toISOString(),
      fingerprint: valid.fingerprint,
      data: {
        category: 'ports',
        // targetField missing!
        query: 'TEST',
        outcome: 'exact_match',
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(invalidDataEntry), 'utf8');
    inspect = cache.inspect('ports', 'TEST', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.match(inspect.corruptedReason ?? '', /Schema validation failed/);
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// SUITE 5: Cross-Payload Desynchronization Prevention
// ---------------------------------------------------------------------------
test('Adversarial Cache Vulnerability: Cross-Payload Desynchronization between outer cache key and encapsulated LookupResult', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-stress-desync-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});

    // Construct a Country lookup result
    const countryResult = makeBaseLookup({
      category: 'countries',
      targetField: 'invoices[0].lines[0].originCountry',
      query: 'VIETNAM',
      outcome: 'exact_match',
      candidates: [{ code: 'VN', label: 'Viet Nam' }],
      source: {
        publisher: 'ISO',
        url: 'https://iso.org',
        datasetVersion: 'iso-3166-1',
        retrievedAt: '2026-10-10T00:00:00.000Z',
      },
    });

    // 1. set() must immediately reject desynchronized payload write
    assert.throws(
      () => cache.set('ports', 'SEATTLE', 'v1', countryResult),
      /Cross-payload desynchronization/i,
      'Cache set must reject desynchronized payload'
    );

    // 2. An adversarial disk entry with desynchronized payload is detected as corrupted and unlinked
    const key = cache.computeCacheKey('ports', 'SEATTLE', 'v1');
    const portDir = path.join(tmpDir, 'ports');
    fs.mkdirSync(portDir, { recursive: true });
    const targetFile = path.join(portDir, `${key}.json`);

    const desyncEntry = {
      key,
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      cachedAt: new Date().toISOString(),
      fingerprint: countryResult.fingerprint,
      data: countryResult,
    };
    fs.writeFileSync(targetFile, JSON.stringify(desyncEntry), 'utf8');

    const inspect = cache.inspect('ports', 'SEATTLE', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.match(inspect.corruptedReason ?? '', /desynchronization/i);
    assert.equal(fs.existsSync(targetFile), false, 'Corrupted desynchronized file must be unlinked');

    const retrieved = cache.get<string>('ports', 'SEATTLE', 'v1');
    assert.equal(retrieved, null, 'Cache get must return null for desynchronized corrupted file');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// SUITE 6: Fingerprint Sensitivity, Dropped Fields & Duplicate Candidates
// ---------------------------------------------------------------------------
test('Fingerprint: Sensitivity to query, version, candidates, and candidate order invariance', () => {
  const baseParams = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidates: [
      { code: '3001', label: 'Seattle, WA' },
      { code: '3002', label: 'Tacoma, WA' },
    ],
  };

  const fpBase = computeLookupFingerprint(baseParams);

  // 1. Query change
  const fpDiffQuery = computeLookupFingerprint({ ...baseParams, query: 'TACOMA' });
  assert.notEqual(fpBase, fpDiffQuery, 'Query change must alter fingerprint');

  // 2. Query case sensitivity
  const fpQueryLower = computeLookupFingerprint({ ...baseParams, query: 'seattle' });
  assert.notEqual(fpBase, fpQueryLower, 'Query casing must alter fingerprint');

  // 3. Dataset version change
  const fpDiffVersion = computeLookupFingerprint({ ...baseParams, datasetVersion: '2024-v2' });
  assert.notEqual(fpBase, fpDiffVersion, 'Dataset version change must alter fingerprint');

  // 4. Candidate list reordering: [c1, c2] vs [c2, c1]
  const fpReordered = computeLookupFingerprint({
    ...baseParams,
    candidates: [
      { code: '3002', label: 'Tacoma, WA' },
      { code: '3001', label: 'Seattle, WA' },
    ],
  });
  assert.equal(fpBase, fpReordered, 'Candidates order must be invariant (canonicalized sort)');

  // 5. Candidate description and details: Included in fingerprint
  const fpWithDesc1 = computeLookupFingerprint({
    ...baseParams,
    candidates: [
      { code: '3001', label: 'Seattle, WA', description: 'Active Port' },
      { code: '3002', label: 'Tacoma, WA', details: { berth: 4 } },
    ],
  });
  const fpWithDesc2 = computeLookupFingerprint({
    ...baseParams,
    candidates: [
      { code: '3001', label: 'Seattle, WA', description: 'CLOSED PORT - CONTAMINATED' },
      { code: '3002', label: 'Tacoma, WA', details: { berth: 999 } },
    ],
  });
  assert.notEqual(fpWithDesc1, fpWithDesc2, 'Description/details differences must change lookup fingerprint');

  // 6. Duplicate candidate codes with different labels: Deterministically sorted
  const fpDup1 = computeLookupFingerprint({
    ...baseParams,
    candidates: [
      { code: '3001', label: 'Alpha' },
      { code: '3001', label: 'Beta' },
    ],
  });
  const fpDup2 = computeLookupFingerprint({
    ...baseParams,
    candidates: [
      { code: '3001', label: 'Beta' },
      { code: '3001', label: 'Alpha' },
    ],
  });
  assert.equal(
    fpDup1,
    fpDup2,
    'computeLookupFingerprint must be order-invariant for candidates with same code'
  );
});

// ---------------------------------------------------------------------------
// SUITE 7: LookupResult Zod Validation Edge Cases (Invalid Timestamps, Unknown Fields)
// ---------------------------------------------------------------------------
test('Zod Validation: Unknown fields, numerical confidence rejection, and timestamp format checks', () => {
  const base = makeBaseLookup();

  // 1. Unknown top-level fields must throw
  assert.throws(
    () => LookupResultSchema.parse({ ...base, extraAttribute: 'malicious' }),
    /unrecognized_keys|unrecognized key/i,
    'LookupResultSchema must reject unknown top-level attributes'
  );

  // 2. Numerical confidence must throw
  assert.throws(
    () => LookupResultSchema.parse({ ...base, confidence: 0.99 }),
    /unrecognized_keys|unrecognized key/i,
    'LookupResultSchema must reject confidence attribute'
  );

  // 3. Unknown field inside candidates must throw
  const baseWithBadCandidate = {
    ...base,
    candidates: [{ code: '3001', label: 'Seattle', rogueField: true }],
  };
  assert.throws(
    () => LookupResultSchema.parse(baseWithBadCandidate),
    /unrecognized_keys|unrecognized key/i,
    'Candidate schema must reject unknown candidate attributes'
  );

  // 4. Unknown field inside source metadata must throw
  const baseWithBadSource = {
    ...base,
    source: { ...base.source, rogueProvenance: 'fake' },
  };
  assert.throws(
    () => LookupResultSchema.parse(baseWithBadSource),
    /unrecognized_keys|unrecognized key/i,
    'Source schema must reject unknown source attributes'
  );

  // 5. Invalid ISO timestamps: Schema enforces ISO 8601 and rejects arbitrary non-ISO strings
  const baseWithNonIsoDate = {
    ...base,
    source: { ...base.source, retrievedAt: 'NOT_A_REAL_DATE_YESTERDAY' },
  };

  assert.throws(
    () => LookupResultSchema.parse(baseWithNonIsoDate),
    /Must be a valid ISO 8601 date/i,
    'retrievedAt must reject arbitrary non-ISO string'
  );

  // Also check ReferenceConfirmationSchema for confirmedAt
  assert.throws(
    () =>
      ReferenceConfirmationSchema.parse({
        category: 'ports',
        query: 'SEATTLE',
        datasetVersion: 'v1',
        candidateCode: '3001',
        confirmedAt: 'NOT_AN_ISO_DATE',
        fingerprint: computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001'),
      }),
    /Must be a valid ISO 8601 date/i,
    'confirmedAt must reject arbitrary non-ISO string'
  );

  // 6. Fingerprint regex validation
  assert.throws(() => LookupResultSchema.parse({ ...base, fingerprint: 'A'.repeat(64) }));
  assert.throws(() => LookupResultSchema.parse({ ...base, fingerprint: 'a'.repeat(63) }));
  assert.throws(() => LookupResultSchema.parse({ ...base, fingerprint: 'a'.repeat(65) }));
  assert.throws(() => LookupResultSchema.parse({ ...base, fingerprint: 'g'.repeat(64) }));
});

// ---------------------------------------------------------------------------
// SUITE 8: Scoped Invalidation & Role Context Isolation
// ---------------------------------------------------------------------------
test('Confirmation: Role context isolation between entry port vs unlading port', () => {
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

  // If another port role (entryPort) has the same category, query, version, and candidate:
  const activeEntryPortContext = {
    category: 'ports',
    targetField: 'header.entryPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
  };

  // Check if isConfirmationValidForLookup binds targetField:
  const isValidAcrossRoles = isConfirmationValidForLookup(confUnlading, activeEntryPortContext);
  assert.equal(isValidAcrossRoles, false, 'Confirmation for unladingPort must NOT be valid for entryPort');

  // In filterScopedConfirmations:
  const map: Record<string, ReferenceConfirmation> = {
    'header.unladingPort': confUnlading,
  };

  // When active contexts only includes entryPort:
  const activeContexts = {
    'header.entryPort': activeEntryPortContext,
  };

  const { validConfirmations, invalidatedKeys } = filterScopedConfirmations(map, activeContexts);
  assert.deepEqual(invalidatedKeys, ['header.unladingPort'], 'Unmatched field key must be invalidated');
  assert.equal(Object.keys(validConfirmations).length, 0);
});
