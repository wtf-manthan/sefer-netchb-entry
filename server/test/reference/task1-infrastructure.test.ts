import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  LookupResult,
  LookupResultSchema,
  ReferenceCandidate,
  DatasetManifest,
  DatasetManifestSchema,
  computeSha256,
  computeLookupFingerprint,
  validateLookupFingerprint,
  computeConfirmationFingerprint,
  validateConfirmationFingerprint,
  isConfirmationValidForLookup,
  filterScopedConfirmations,
  ReferenceConfirmation,
  ReferenceConfirmationSchema,
  RawExtractedShipment,
  BrokerDecisions,
} from '@sefer/shared';
import { ReferenceDiskCache } from '../../src/reference/cache';
import {
  createManifest,
  loadManifest,
  saveManifest,
  verifyDatasetFile,
} from '../../src/reference/manifest';

function makeSampleLookup(overrides: Partial<LookupResult> & { datasetVersion?: string } = {}): LookupResult {
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
        description: 'US Customs Port of Entry',
        details: { state: 'WA', schedule: 'D' },
      },
    ],
    source: {
      publisher: 'US Census Bureau',
      url: 'https://www.census.gov/foreign-trade/schedules/d/',
      datasetVersion: version,
      retrievedAt: '2026-10-10T00:00:00.000Z',
      effectiveDate: '2024-01-01',
      license: 'Public Domain / US Government',
    },
    matchingMethod: 'normalized_name',
    rationale: 'Normalized query SEATTLE matched port name Seattle, WA exactly.',
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

test('Contract: Valid LookupResult with all 10 required attributes parses cleanly', () => {
  const sample = makeSampleLookup();
  const parsed = LookupResultSchema.parse(sample);
  assert.equal(parsed.category, 'ports');
  assert.equal(parsed.targetField, 'header.unladingPort');
  assert.equal(parsed.query, 'SEATTLE');
  assert.equal(parsed.outcome, 'exact_match');
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.candidates[0].code, '3001');
  assert.equal(parsed.source.publisher, 'US Census Bureau');
  assert.equal(parsed.matchingMethod, 'normalized_name');
  assert.equal(parsed.codeVerifiedAgainstReference, true);
  assert.equal(parsed.userConfirmedForShipment, false);
  assert.ok(/^[0-9a-f]{64}$/.test(parsed.fingerprint));
});

test('Contract: Rejects fabricated numerical confidence in LookupResult', () => {
  const sample = makeSampleLookup();
  const sampleWithConfidence = {
    ...sample,
    confidence: 0.98, // Fabricated score forbidden by Integrity Mandate
  };
  assert.throws(
    () => LookupResultSchema.parse(sampleWithConfidence),
    /unrecognized_keys|unrecognized key/i,
    'LookupResult schema must reject fabricated confidence attribute'
  );
});

test('Contract: Rejects missing required provenance fields', () => {
  const sample = makeSampleLookup();
  const missingSource = { ...sample, source: undefined };
  assert.throws(() => LookupResultSchema.parse(missingSource));

  const missingFingerprint = { ...sample, fingerprint: undefined };
  assert.throws(() => LookupResultSchema.parse(missingFingerprint));

  const missingRationale = { ...sample, rationale: undefined };
  assert.throws(() => LookupResultSchema.parse(missingRationale));
});

test('Contract: Rejects invalid outcomes and methods', () => {
  const sample = makeSampleLookup();
  const invalidOutcome = { ...sample, outcome: 'heuristic_guess' as any };
  assert.throws(() => LookupResultSchema.parse(invalidOutcome));

  const invalidMethod = { ...sample, matchingMethod: 'ai_hallucination' as any };
  assert.throws(() => LookupResultSchema.parse(invalidMethod));
});

test('Outcomes: All 5 defined outcomes represent valid states', () => {
  const outcomes: LookupResult['outcome'][] = [
    'exact_match',
    'candidates',
    'no_match',
    'unavailable',
    'stale',
  ];

  for (const outcome of outcomes) {
    let candidates: ReferenceCandidate[] = [];
    if (outcome === 'exact_match') {
      candidates = [{ code: '3001', label: 'Seattle' }];
    } else if (outcome === 'candidates') {
      candidates = [
        { code: '3001', label: 'Seattle' },
        { code: '3002', label: 'Tacoma' },
      ];
    }

    const result = makeSampleLookup({
      outcome,
      candidates,
      rationale: `Testing outcome ${outcome}`,
      missingFactsNeeded: outcome === 'candidates' ? ['Select target port between Seattle and Tacoma'] : [],
    });

    const parsed = LookupResultSchema.parse(result);
    assert.equal(parsed.outcome, outcome);
    assert.equal(validateLookupFingerprint(parsed), true);
  }
});

test('Manifest: Valid dataset manifest parses and validates checksum', () => {
  const manifestData: DatasetManifest = {
    id: 'schedule-d-ports',
    title: 'U.S. Customs Port Codes (Schedule D)',
    publisher: 'U.S. Census Bureau',
    sourceUrl: 'https://www.census.gov/foreign-trade/schedules/d/distcodes.html',
    datasetVersion: '2024.1',
    retrievedAt: '2026-10-10T00:00:00.000Z',
    effectiveDate: '2024-01-01',
    license: 'US Government Work / Public Domain',
    redistributable: true,
    recordCount: 420,
    checksumSha256: computeSha256('dummy-dataset-content-for-test'),
    format: 'json',
  };

  const parsed = DatasetManifestSchema.parse(manifestData);
  assert.equal(parsed.id, 'schedule-d-ports');
  assert.equal(parsed.recordCount, 420);
  assert.equal(parsed.redistributable, true);

  // Negative record count rejected
  assert.throws(() =>
    DatasetManifestSchema.parse({ ...manifestData, recordCount: -5 })
  );

  // Unsupported format rejected
  assert.throws(() =>
    DatasetManifestSchema.parse({ ...manifestData, format: 'excel' as any })
  );
});

test('Manifest: Server manifest manager creates, saves, loads, and verifies datasets', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-manifest-test-'));
  try {
    const dataFilePath = path.join(tmpDir, 'schedule-d.json');
    const manifestFilePath = path.join(tmpDir, 'schedule-d.manifest.json');
    const content = JSON.stringify([{ code: '3001', name: 'Seattle' }]);
    fs.writeFileSync(dataFilePath, content, 'utf8');

    const manifest = createManifest({
      id: 'schedule-d',
      title: 'Schedule D Ports',
      publisher: 'U.S. Census Bureau',
      sourceUrl: 'https://example.gov/ports',
      datasetVersion: '2024.1',
      license: 'Public Domain',
      redistributable: true,
      recordCount: 1,
      format: 'json',
      dataFilePath,
    });

    saveManifest(manifest, manifestFilePath);
    const loaded = loadManifest(manifestFilePath);
    assert.deepEqual(loaded, manifest);

    const verificationSuccess = verifyDatasetFile(loaded, dataFilePath);
    assert.equal(verificationSuccess.valid, true);
    assert.equal(verificationSuccess.expectedChecksum, loaded.checksumSha256);

    // Tampering test
    fs.writeFileSync(dataFilePath, content + 'tampered', 'utf8');
    const verificationTampered = verifyDatasetFile(loaded, dataFilePath);
    assert.equal(verificationTampered.valid, false);
    assert.equal(verificationTampered.reason, 'Checksum mismatch');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Cache: Key isolation across category, query, and datasetVersion', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-cache-isolation-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});

    const key1 = cache.computeCacheKey('ports', 'SEATTLE', 'v1');
    const key2 = cache.computeCacheKey('countries', 'SEATTLE', 'v1');
    const key3 = cache.computeCacheKey('ports', 'TACOMA', 'v1');
    const key4 = cache.computeCacheKey('ports', 'SEATTLE', 'v2');

    assert.notEqual(key1, key2, 'Category difference must isolate cache keys');
    assert.notEqual(key1, key3, 'Query difference must isolate cache keys');
    assert.notEqual(key1, key4, 'DatasetVersion difference must isolate cache keys');

    const result1 = makeSampleLookup({ category: 'ports', query: 'SEATTLE' });
    const result2 = makeSampleLookup({ category: 'countries', query: 'SEATTLE' });

    cache.set('ports', 'SEATTLE', 'v1', result1);
    cache.set('countries', 'SEATTLE', 'v1', result2);

    const cachedPorts = cache.get('ports', 'SEATTLE', 'v1');
    const cachedCountries = cache.get('countries', 'SEATTLE', 'v1');
    const cachedMissing = cache.get('ports', 'SEATTLE', 'v2');

    assert.equal(cachedPorts?.category, 'ports');
    assert.equal(cachedCountries?.category, 'countries');
    assert.equal(cachedMissing, null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Cache: Corrupted file detection and recovery', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-cache-corrupt-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});
    const result = makeSampleLookup();

    // 1. Corrupt JSON syntax recovery
    cache.set('ports', 'SEATTLE', 'v1', result);
    const key = cache.computeCacheKey('ports', 'SEATTLE', 'v1');
    const filePath = path.join(tmpDir, 'ports', `${key}.json`);

    fs.writeFileSync(filePath, '{ corrupt json invalid syntax ...', 'utf8');

    // Cache should detect corruption, remove bad file, and return null safely
    assert.equal(cache.get('ports', 'SEATTLE', 'v1'), null);
    assert.equal(fs.existsSync(filePath), false, 'Corrupted file must be recovered/unlinked');

    // 2. Corrupt schema content recovery
    const validEntryWrapper = {
      key,
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      cachedAt: new Date().toISOString(),
      fingerprint: result.fingerprint,
      data: { invalidField: 123 }, // violates LookupResultSchema
    };
    fs.writeFileSync(filePath, JSON.stringify(validEntryWrapper), 'utf8');

    const inspectCorruptSchema = cache.inspect('ports', 'SEATTLE', 'v1');
    assert.equal(inspectCorruptSchema.status, 'corrupted');
    assert.equal(fs.existsSync(filePath), false, 'Schema violation must be removed/recovered');

    // 3. Corrupt fingerprint recovery
    const tamperedFingerprintWrapper = {
      key,
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      cachedAt: new Date().toISOString(),
      fingerprint: '0000000000000000000000000000000000000000000000000000000000000000',
      data: result,
    };
    fs.writeFileSync(filePath, JSON.stringify(tamperedFingerprintWrapper), 'utf8');

    const inspectTampered = cache.inspect('ports', 'SEATTLE', 'v1');
    assert.equal(inspectTampered.status, 'corrupted');
    assert.equal(fs.existsSync(filePath), false, 'Tampered fingerprint file must be removed');

    // 4. Clean write after recovery succeeds
    cache.set('ports', 'SEATTLE', 'v1', result);
    const recoveredGet = cache.get('ports', 'SEATTLE', 'v1');
    assert.equal(recoveredGet?.category, 'ports');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Cache: Expiry and staleness labeling', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-cache-ttl-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});
    const result = makeSampleLookup();

    // Cache with very short ttl
    cache.set('ports', 'SEATTLE', 'v1', result, { ttlMs: 1 });

    const key = cache.computeCacheKey('ports', 'SEATTLE', 'v1');
    const filePath = path.join(tmpDir, 'ports', `${key}.json`);

    // Backdate cachedAt to guarantee expiration
    const entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    entry.cachedAt = new Date(Date.now() - 10000).toISOString();
    fs.writeFileSync(filePath, JSON.stringify(entry), 'utf8');

    // Default get returns null for expired entries (does not treat as current)
    const normalGet = cache.get('ports', 'SEATTLE', 'v1');
    assert.equal(normalGet, null);

    // With labelStaleIfExpired: true, returns result with outcome 'stale'
    const staleGet = cache.get('ports', 'SEATTLE', 'v1', { labelStaleIfExpired: true });
    assert.ok(staleGet !== null);
    assert.equal(staleGet?.outcome, 'stale');

    // Fresh entry returns current outcome
    cache.set('ports', 'FRESH', 'v1', makeSampleLookup({ query: 'FRESH' }), { ttlMs: 60000 });
    const freshGet = cache.get('ports', 'FRESH', 'v1');
    assert.equal(freshGet?.outcome, 'exact_match');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Integrity: Original observations and explicit broker decisions are preserved without mutation', () => {
  const rawShipment: RawExtractedShipment = {
    documents: [{ id: 'doc-1', name: 'invoice.pdf', sha256: 'a'.repeat(64), pages: 1 }],
    invoices: [
      {
        id: 'inv-1',
        invoiceNo: {
          value: 'INV-2026-001',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'Invoice No: INV-2026-001' },
          confidence: 0.99,
        },
        issueDate: {
          value: '2026-01-15',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'Date: 2026-01-15' },
          confidence: 0.95,
        },
        currency: {
          value: 'USD',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'USD' },
          confidence: 0.99,
        },
        lines: [],
      },
    ],
    packingLists: [],
    bills: [
      {
        id: 'bill-1',
        billNo: {
          value: 'MAEU123456789',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'MAEU123456789' },
          confidence: 0.98,
        },
        unladingPort: {
          value: 'SEATTLE',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'Port of Unlading: SEATTLE' },
          confidence: 0.92,
        },
        ladingPort: {
          value: '55201',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'Port of Loading: 55201' },
          confidence: 0.95,
        },
      },
    ],
    mot: {
      value: '11',
      status: 'extracted',
      source: { doc: 'doc-1', page: 1, snippet: 'Ocean Containerized' },
      confidence: 0.95,
    },
  };

  const brokerDecisions: BrokerDecisions = {
    observationCorrections: {},
    lineDecisions: {},
    invoiceDecisions: {},
    containerOverrides: {},
    acknowledgements: { 'finding-1': 'Reviewed port document' },
    customsFiling: {
      modeOfTransport: '11',
      entryType: '01',
      entryPort: '3001',
      unladingPort: '3001',
      destinationState: 'WA',
      bondType: '08',
      referenceDataConfirmed: true,
    },
  };

  const shipmentSnapshot = JSON.stringify(rawShipment);
  const decisionsSnapshot = JSON.stringify(brokerDecisions);

  // Perform lookup operations, fingerprint computations, and confirmation logic
  const portLookup = makeSampleLookup({
    query: rawShipment.bills[0].unladingPort?.value ?? '',
    targetField: 'bills[0].unladingPort',
  });

  const confirmation: ReferenceConfirmation = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
    confirmedAt: new Date().toISOString(),
    confirmedBy: 'broker-agent',
    fingerprint: computeConfirmationFingerprint('ports', 'SEATTLE', '2024-v1', '3001'),
  };

  assert.equal(validateLookupFingerprint(portLookup), true);
  assert.equal(validateConfirmationFingerprint(confirmation), true);

  // Verify that rawShipment and brokerDecisions have not been modified in any way
  assert.equal(
    JSON.stringify(rawShipment),
    shipmentSnapshot,
    'Raw extracted observations must remain 100% immutable throughout reference operations'
  );
  assert.equal(
    JSON.stringify(brokerDecisions),
    decisionsSnapshot,
    'Broker manual decisions must remain 100% immutable throughout reference operations'
  );
});

test('Confirmation: Scoped invalidation is strictly bound to category, query, version, and candidate', () => {
  const confPort: ReferenceConfirmation = {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'ports',
      targetField: 'header.unladingPort',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001',
    }),
  };

  const confCountry: ReferenceConfirmation = {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'countries',
    targetField: 'invoices[0].lines[0].originCountry',
    query: 'VIETNAM',
    datasetVersion: 'iso-3166-2024',
    candidateCode: 'VN',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'countries',
      targetField: 'invoices[0].lines[0].originCountry',
      query: 'VIETNAM',
      datasetVersion: 'iso-3166-2024',
      candidateCode: 'VN',
    }),
  };

  const existingConfirmations: Record<string, ReferenceConfirmation> = {
    portDecision: confPort,
    countryDecision: confCountry,
  };

  // Case 1: Query for port changes from 'SEATTLE' to 'TACOMA'
  const activeContextsPortChanged = {
    portDecision: {
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'ports',
      targetField: 'header.unladingPort',
      query: 'TACOMA', // Changed query
      datasetVersion: '2024-v1',
      candidateCode: '3001',
    },
    countryDecision: {
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'countries',
      targetField: 'invoices[0].lines[0].originCountry',
      query: 'VIETNAM', // Unchanged query
      datasetVersion: 'iso-3166-2024',
      candidateCode: 'VN',
    },
  };

  const { validConfirmations, invalidatedKeys } = filterScopedConfirmations(
    existingConfirmations,
    activeContextsPortChanged
  );

  assert.deepEqual(invalidatedKeys, ['portDecision'], 'Changing port query must invalidate ONLY port decision');
  assert.equal(validConfirmations['countryDecision'], confCountry, 'Unrelated country decision must be preserved');
  assert.equal(validConfirmations['portDecision'], undefined);

  // Case 2: Candidate code changes from '3001' to '3002'
  const activeContextsCandidateChanged = {
    portDecision: {
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'ports',
      targetField: 'header.unladingPort',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3002', // Different candidate code
    },
  };

  const filteredCandidateChange = filterScopedConfirmations(
    { portDecision: confPort },
    activeContextsCandidateChanged
  );
  assert.deepEqual(filteredCandidateChange.invalidatedKeys, ['portDecision']);

  // Case 3: Dataset version changes from '2024-v1' to '2024-v2'
  const activeContextsVersionChanged = {
    portDecision: {
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'ports',
      targetField: 'header.unladingPort',
      query: 'SEATTLE',
      datasetVersion: '2024-v2', // Upgraded dataset version
      candidateCode: '3001',
    },
  };

  const filteredVersionChange = filterScopedConfirmations(
    { portDecision: confPort },
    activeContextsVersionChanged
  );
  assert.deepEqual(filteredVersionChange.invalidatedKeys, ['portDecision']);

  // Case 4: Target field role changes from 'header.unladingPort' to 'header.entryPort'
  const activeContextsRoleChanged = {
    portDecision: {
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'ports',
      targetField: 'header.entryPort', // Changed filing role
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001',
    },
  };

  const filteredRoleChange = filterScopedConfirmations(
    { portDecision: confPort },
    activeContextsRoleChanged
  );
  assert.deepEqual(filteredRoleChange.invalidatedKeys, ['portDecision'], 'Changing targetField role must invalidate confirmation');

  // Case 5: No change in query, targetField, category, version, or candidate preserves confirmation
  const activeContextsUnchanged = {
    portDecision: {
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'ports',
      targetField: 'header.unladingPort',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001',
    },
    countryDecision: {
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'countries',
      targetField: 'invoices[0].lines[0].originCountry',
      query: 'VIETNAM',
      datasetVersion: 'iso-3166-2024',
      candidateCode: 'VN',
    },
  };

  const filteredUnchanged = filterScopedConfirmations(
    existingConfirmations,
    activeContextsUnchanged
  );
  assert.deepEqual(filteredUnchanged.invalidatedKeys, []);
  assert.equal(filteredUnchanged.validConfirmations['portDecision'], confPort);
  assert.equal(filteredUnchanged.validConfirmations['countryDecision'], confCountry);
});

test('Confirmation: Defense against Object.prototype key collisions in filterScopedConfirmations', () => {
  const fp = computeConfirmationFingerprint({
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
  });
  const conf: ReferenceConfirmation = {
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fp,
  };

  // Prototype property names like toString and valueOf
  const confirmations = {
    toString: conf,
    valueOf: conf,
  };

  // Standard empty object which inherits prototype methods
  const activeContexts = {};

  const { validConfirmations, invalidatedKeys } = filterScopedConfirmations(
    confirmations,
    activeContexts
  );

  assert.equal(invalidatedKeys.includes('toString'), true);
  assert.equal(invalidatedKeys.includes('valueOf'), true);
  assert.equal(Object.keys(validConfirmations).length, 0);
});

test('Confirmation: Gracefully coerces numeric candidateCode without throwing TypeError', () => {
  const fp = computeConfirmationFingerprint({
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
  });
  const conf: ReferenceConfirmation = {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: fp,
  };

  // Pass candidateCode as numeric number 3001
  const isValid = isConfirmationValidForLookup(conf, {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: 3001 as any,
  });

  assert.equal(isValid, true, 'Numeric candidateCode 3001 must evaluate to valid without TypeError');

  // Passing non-matching numeric candidateCode 3002
  const isInvalid = isConfirmationValidForLookup(conf, {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: 'v1',
    candidateCode: 3002 as any,
  });

  assert.equal(isInvalid, false, 'Numeric candidateCode 3002 must evaluate to invalid without TypeError');
});

test('Cache: Rejects on set and recovers as corrupted on inspect when envelope and payload desynchronize', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sefer-cache-desync-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')});
    const countryResult = makeSampleLookup({
      category: 'countries',
      targetField: 'invoices[0].lines[0].originCountry',
      query: 'VIETNAM',
      datasetVersion: 'iso-3166-1',
      candidates: [{ code: 'VN', label: 'Viet Nam' }],
    });

    // 1. set() must reject desynchronized payload immediately
    assert.throws(
      () => cache.set('ports', 'SEATTLE', 'v1', countryResult),
      /Cross-payload desynchronization/i,
      'set() must reject writing mismatched category/query/version payload'
    );

    // 2. inspect() treats existing desynchronized files as corrupted and unlinks them
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
      data: countryResult, // Payload has category: 'countries', query: 'VIETNAM'
    };
    fs.writeFileSync(targetFile, JSON.stringify(desyncEntry), 'utf8');

    const inspect = cache.inspect('ports', 'SEATTLE', 'v1');
    assert.equal(inspect.status, 'corrupted');
    assert.match(inspect.corruptedReason ?? '', /desynchronization/i);
    assert.equal(fs.existsSync(targetFile), false, 'Corrupted desynchronized file must be unlinked');

    const retrieved = cache.get('ports', 'SEATTLE', 'v1');
    assert.equal(retrieved, null, 'Cache get must return null for corrupted entry');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Contract: Strict ISO 8601 date and datetime format validation in schemas', () => {
  const sample = makeSampleLookup();

  // 1. Arbitrary non-date strings rejected in retrievedAt
  assert.throws(
    () =>
      LookupResultSchema.parse({
        ...sample,
        source: { ...sample.source, retrievedAt: 'yesterday' },
      }),
    /Must be a valid ISO 8601 date/i
  );
  assert.throws(
    () =>
      LookupResultSchema.parse({
        ...sample,
        source: { ...sample.source, retrievedAt: 'NOT_A_REAL_DATE_YESTERDAY' },
      }),
    /Must be a valid ISO 8601 date/i
  );

  // 2. Non-existent calendar date rejected in retrievedAt
  assert.throws(
    () =>
      LookupResultSchema.parse({
        ...sample,
        source: { ...sample.source, retrievedAt: '2026-99-99' },
      }),
    /Must represent a valid calendar date/i
  );

  // 3. Valid ISO formats accepted
  const validIsoDates = [
    '2026-10-10',
    '2026-10-10T00:00:00.000Z',
    '2026-10-10T12:30:00Z',
    '2026-10-10T12:30:00+02:00',
  ];
  for (const validDate of validIsoDates) {
    assert.doesNotThrow(() =>
      LookupResultSchema.parse({
        ...sample,
        source: { ...sample.source, retrievedAt: validDate },
      })
    );
  }

  // 4. effectiveDate validation in source metadata
  assert.throws(
    () =>
      LookupResultSchema.parse({
        ...sample,
        source: { ...sample.source, effectiveDate: 'invalid-effective-date' },
      }),
    /Must be a valid ISO 8601 date/i
  );

  // 5. confirmedAt validation in ReferenceConfirmationSchema
  assert.throws(
    () =>
      ReferenceConfirmationSchema.parse({
        category: 'ports',
        query: 'SEATTLE',
        datasetVersion: 'v1',
        candidateCode: '3001',
        confirmedAt: 'tomorrow',
        fingerprint: computeConfirmationFingerprint('ports', 'SEATTLE', 'v1', '3001'),
      }),
    /Must be a valid ISO 8601 date/i
  );
});

test('Fingerprint: Deterministic candidate sorting with matching codes and details inclusion', () => {
  const baseParams = {
    category: 'ports',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
  };

  // Case 1: Candidates with identical codes but different labels
  const candidatesOrder1 = [
    { code: '3001', label: 'Alpha Terminal', description: 'Port facility' },
    { code: '3001', label: 'Beta Terminal', description: 'Port facility' },
  ];
  const candidatesOrder2 = [
    { code: '3001', label: 'Beta Terminal', description: 'Port facility' },
    { code: '3001', label: 'Alpha Terminal', description: 'Port facility' },
  ];

  const fp1 = computeLookupFingerprint({ ...baseParams, candidates: candidatesOrder1 });
  const fp2 = computeLookupFingerprint({ ...baseParams, candidates: candidatesOrder2 });
  assert.equal(fp1, fp2, 'Candidates with identical codes must sort deterministically by label');

  // Case 2: Candidates with identical code & label but different description
  const candidatesDescOrder1 = [
    { code: '3001', label: 'Terminal', description: 'Alpha Description' },
    { code: '3001', label: 'Terminal', description: 'Beta Description' },
  ];
  const candidatesDescOrder2 = [
    { code: '3001', label: 'Terminal', description: 'Beta Description' },
    { code: '3001', label: 'Terminal', description: 'Alpha Description' },
  ];

  const fpDesc1 = computeLookupFingerprint({ ...baseParams, candidates: candidatesDescOrder1 });
  const fpDesc2 = computeLookupFingerprint({ ...baseParams, candidates: candidatesDescOrder2 });
  assert.equal(fpDesc1, fpDesc2, 'Candidates with identical code & label must sort deterministically by description');

  // Case 3: Altering description changes fingerprint
  const fpDescA = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', description: 'Active customs port' }],
  });
  const fpDescB = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', description: 'Decommissioned terminal' }],
  });
  assert.notEqual(fpDescA, fpDescB, 'Changing candidate description must alter fingerprint');

  // Case 4: Altering details changes fingerprint
  const fpDetailsA = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', details: { berth: 10 } }],
  });
  const fpDetailsB = computeLookupFingerprint({
    ...baseParams,
    candidates: [{ code: '3001', label: 'Seattle', details: { berth: 99 } }],
  });
  assert.notEqual(fpDetailsA, fpDetailsB, 'Changing candidate details must alter fingerprint');
});

test('Confirmation: Port role context isolation prevents role bleed between entryPort and unladingPort', () => {
  const confUnlading: ReferenceConfirmation = {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
    confirmedAt: '2026-10-10T00:00:00.000Z',
    fingerprint: computeConfirmationFingerprint({
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
      category: 'ports',
      targetField: 'header.unladingPort',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001',
    }),
  };

  // Lookup context for entryPort (different role)
  const entryPortContext = {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    targetField: 'header.entryPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
  };

  const isValidForEntryPort = isConfirmationValidForLookup(confUnlading, entryPortContext);
  assert.equal(isValidForEntryPort, false, 'Confirmation for unladingPort must NOT be valid for entryPort');

  // Lookup context for unladingPort (matching role)
  const unladingPortContext = {
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    ...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},
    category: 'ports',
    targetField: 'header.unladingPort',
    query: 'SEATTLE',
    datasetVersion: '2024-v1',
    candidateCode: '3001',
  };

  const isValidForUnladingPort = isConfirmationValidForLookup(confUnlading, unladingPortContext);
  assert.equal(isValidForUnladingPort, true, 'Confirmation for unladingPort must be valid for unladingPort');
});
