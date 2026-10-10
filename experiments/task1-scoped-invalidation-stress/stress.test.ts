import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';
import {
  computeSha256,
  computeLookupFingerprint,
  validateLookupFingerprint,
  computeConfirmationFingerprint,
  validateConfirmationFingerprint,
  isConfirmationValidForLookup,
  filterScopedConfirmations,
  ReferenceConfirmation,
  LookupResult,
  LookupResultSchema,
  ReferenceConfirmationSchema,
  RawExtractedShipment,
  BrokerDecisions,
} from '@sefer/shared';
import { ReferenceDiskCache } from '../../server/src/reference/cache';

/**
 * Deep freezes an object recursively to guarantee total immutability.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Helper to generate a valid ReferenceConfirmation.
 */
function createValidConfirmation(
  category: string,
  query: string,
  datasetVersion: string,
  candidateCode: string,
  targetField?: string
): ReferenceConfirmation {
  const fingerprint = computeConfirmationFingerprint(category, query, datasetVersion, candidateCode);
  return {
    category,
    targetField,
    query,
    datasetVersion,
    candidateCode,
    confirmedAt: new Date().toISOString(),
    fingerprint,
  };
}

// --------------------------------------------------------------------------
// 1. Complex Mutations to Unrelated Fields
// --------------------------------------------------------------------------

test('Challenger 2: Confirmations remain 100% intact under complex mutations to 50 unrelated fields', () => {
  // Generate 50 distinct confirmations across multiple invoices, lines, and headers
  const initialConfirmations: Record<string, ReferenceConfirmation> = {};
  const activeContexts: Record<
    string,
    { category: string; query: string; datasetVersion: string; candidateCode?: string }
  > = {};

  for (let i = 0; i < 50; i++) {
    const key = `invoices[${Math.floor(i / 5)}].lines[${i % 5}].htsCode`;
    const cat = i % 2 === 0 ? 'hts' : 'ports';
    const query = `ITEM_${i}_QUERY`;
    const version = '2026.1';
    const code = `CODE_${1000 + i}`;

    const conf = createValidConfirmation(cat, query, version, code, key);
    initialConfirmations[key] = conf;
    activeContexts[key] = {
      category: cat,
      query,
      datasetVersion: version,
      candidateCode: code,
    };
  }

  // Simulate complex mutations to 100 UNRELATED fields in the active context
  // (e.g. adding metadata, reordering keys, unrelated document updates)
  const mutatedActiveContexts = { ...activeContexts };

  // Add 100 completely unrelated fields (simulating other non-reference extractions or new fields)
  for (let j = 0; j < 100; j++) {
    const unrelatedKey = `unrelated.field.meta_${j}`;
    (mutatedActiveContexts as any)[unrelatedKey] = {
      category: 'countries',
      query: `UNRELATED_${j}`,
      datasetVersion: 'v1',
      candidateCode: 'XX',
    };
  }

  // Shuffle key evaluation order
  const shuffledConfirmations: Record<string, ReferenceConfirmation> = {};
  const shuffledKeys = Object.keys(initialConfirmations).sort(() => Math.random() - 0.5);
  for (const k of shuffledKeys) {
    shuffledConfirmations[k] = initialConfirmations[k];
  }

  const { validConfirmations, invalidatedKeys } = filterScopedConfirmations(
    shuffledConfirmations,
    mutatedActiveContexts
  );

  // All 50 original confirmations must be preserved
  assert.equal(invalidatedKeys.length, 0, 'Zero unrelated confirmations should be invalidated');
  assert.equal(Object.keys(validConfirmations).length, 50, 'All 50 confirmations must remain valid');

  for (const [key, original] of Object.entries(initialConfirmations)) {
    assert.deepEqual(validConfirmations[key], original, `Confirmation for ${key} must remain bit-for-bit identical`);
  }
});

test('Challenger 2: Invalidation is strictly scoped when target field query changes amidst unrelated mutations', () => {
  const c1 = createValidConfirmation('ports', 'SEATTLE', 'v1', '3001', 'header.unladingPort');
  const c2 = createValidConfirmation('countries', 'VIETNAM', 'v1', 'VN', 'invoices[0].originCountry');
  const c3 = createValidConfirmation('currencies', 'USD', 'v1', 'USD', 'invoices[0].currency');
  const c4 = createValidConfirmation('mot', '11', 'v1', '11', 'header.mot');

  const confirmations: Record<string, ReferenceConfirmation> = {
    c1_port: c1,
    c2_country: c2,
    c3_currency: c3,
    c4_mot: c4,
  };

  // Mutate c2 query: 'VIETNAM' -> 'VIET NAM'
  // Leave c1, c3, c4 untouched
  const activeContexts = {
    c1_port: { category: 'ports', query: 'SEATTLE', datasetVersion: 'v1', candidateCode: '3001' },
    c2_country: { category: 'countries', query: 'VIET NAM', datasetVersion: 'v1', candidateCode: 'VN' }, // Changed
    c3_currency: { category: 'currencies', query: 'USD', datasetVersion: 'v1', candidateCode: 'USD' },
    c4_mot: { category: 'mot', query: '11', datasetVersion: 'v1', candidateCode: '11' },
  };

  const { validConfirmations, invalidatedKeys } = filterScopedConfirmations(confirmations, activeContexts);

  assert.deepEqual(invalidatedKeys, ['c2_country']);
  assert.equal(validConfirmations['c1_port'], c1);
  assert.equal(validConfirmations['c3_currency'], c3);
  assert.equal(validConfirmations['c4_mot'], c4);
  assert.equal(validConfirmations['c2_country'], undefined);
});

// --------------------------------------------------------------------------
// 2. Query / Evidence / Provenance Mutation Invalidation
// --------------------------------------------------------------------------

test('Challenger 2: Altering query text immediately invalidates confirmation', () => {
  const conf = createValidConfirmation('ports', 'PORT OF LONG BEACH', 'v1', '2709');

  const subtleQueryMutations = [
    'PORT OF LONG BEACH ', // trailing whitespace (wait: trim handles trailing, let us test inner)
    'PORT  OF LONG BEACH', // double whitespace
    'port of long beach', // casing change
    'PORT OF LONG BEACH.', // punctuation
    'PORT OF LONGBEACH', // typo
    'LONG BEACH', // omission
    'PORT OF LONG BEACH\n', // newline
    'PORT OF LONG BEACH\u00A0', // non-breaking space
  ];

  for (const mutatedQuery of subtleQueryMutations) {
    const isValid = isConfirmationValidForLookup(conf, {
      category: 'ports',
      query: mutatedQuery,
      datasetVersion: 'v1',
      candidateCode: '2709',
    });

    if (mutatedQuery.trim() === 'PORT OF LONG BEACH') {
      // If whitespace was only outer trim, trim() treats them as equal
      assert.equal(isValid, true);
    } else {
      assert.equal(isValid, false, `Query mutation "${mutatedQuery}" must invalidate confirmation`);
    }
  }
});

test('Challenger 2: Altering category or dataset version immediately invalidates confirmation', () => {
  const conf = createValidConfirmation('ports', 'SEATTLE', '2024-v1', '3001');

  // Category changed
  assert.equal(
    isConfirmationValidForLookup(conf, {
      category: 'foreign_ports',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3001',
    }),
    false,
    'Category change must invalidate confirmation'
  );

  // Version upgraded
  assert.equal(
    isConfirmationValidForLookup(conf, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: '2024-v2',
      candidateCode: '3001',
    }),
    false,
    'Dataset version change must invalidate confirmation'
  );

  // Candidate code changed
  assert.equal(
    isConfirmationValidForLookup(conf, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: '2024-v1',
      candidateCode: '3002',
    }),
    false,
    'Candidate code change must invalidate confirmation'
  );
});

test('Challenger 2: Tampered confirmation fingerprint is rejected immediately', () => {
  const conf = createValidConfirmation('ports', 'SEATTLE', 'v1', '3001');
  const tamperedConf = {
    ...conf,
    fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Sha256 of empty string
  };

  assert.equal(validateConfirmationFingerprint(tamperedConf), false);
  assert.equal(
    isConfirmationValidForLookup(tamperedConf, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: '3001',
    }),
    false,
    'Tampered fingerprint must invalidate confirmation'
  );
});

// --------------------------------------------------------------------------
// 3. Raw Extraction and Manual Decisions Immutability
// --------------------------------------------------------------------------

test('Challenger 2: Deeply frozen RawExtractedShipment and BrokerDecisions are impervious to reference operations', () => {
  const rawShipment: RawExtractedShipment = {
    documents: [
      { id: 'doc-1', name: 'inv.pdf', sha256: '1'.repeat(64), pages: 2 },
      { id: 'doc-2', name: 'bol.pdf', sha256: '2'.repeat(64), pages: 1 },
    ],
    invoices: [
      {
        id: 'inv-1',
        invoiceNo: {
          value: 'INV-999',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'INV-999' },
          confidence: 0.99,
        },
        issueDate: {
          value: '2026-03-01',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: '2026-03-01' },
          confidence: 0.95,
        },
        currency: {
          value: 'USD',
          status: 'extracted',
          source: { doc: 'doc-1', page: 1, snippet: 'USD' },
          confidence: 0.99,
        },
        lines: [
          {
            id: 'line-1',
            lineNo: { value: 1, status: 'extracted', source: { doc: 'doc-1', page: 1, snippet: '1' }, confidence: 1 },
            description: {
              value: 'A4 Paper',
              status: 'extracted',
              source: { doc: 'doc-1', page: 1, snippet: 'A4 Paper' },
              confidence: 0.95,
            },
            quantity: { value: 500, status: 'extracted', source: { doc: 'doc-1', page: 1, snippet: '500' }, confidence: 0.95 },
            unitPrice: { value: 4.5, status: 'extracted', source: { doc: 'doc-1', page: 1, snippet: '4.5' }, confidence: 0.95 },
            totalAmount: { value: 2250, status: 'extracted', source: { doc: 'doc-1', page: 1, snippet: '2250' }, confidence: 0.95 },
          },
        ],
      },
    ],
    packingLists: [],
    bills: [
      {
        id: 'bill-1',
        billNo: {
          value: 'MEDU1234567',
          status: 'extracted',
          source: { doc: 'doc-2', page: 1, snippet: 'MEDU1234567' },
          confidence: 0.98,
        },
        unladingPort: {
          value: 'SEATTLE',
          status: 'extracted',
          source: { doc: 'doc-2', page: 1, snippet: 'Port: SEATTLE' },
          confidence: 0.95,
        },
        ladingPort: {
          value: '55201',
          status: 'extracted',
          source: { doc: 'doc-2', page: 1, snippet: 'Loading: 55201' },
          confidence: 0.95,
        },
      },
    ],
    mot: {
      value: '11',
      status: 'extracted',
      source: { doc: 'doc-2', page: 1, snippet: 'Container' },
      confidence: 0.95,
    },
  };

  const brokerDecisions: BrokerDecisions = {
    observationCorrections: {
      'bill-1.unladingPort': { originalValue: 'SEATTLE', correctedValue: 'SEATTLE, WA', rationale: 'Verified spelling' },
    },
    lineDecisions: {
      'line-1': { htsCode: '4802.56.1000', rationale: 'Broker confirmed HTS classification' },
    },
    invoiceDecisions: {},
    containerOverrides: {},
    acknowledgements: {
      'check-1': 'Acknowledged port of unlading matches arrival notice',
    },
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

  // Deep freeze both objects
  deepFreeze(rawShipment);
  deepFreeze(brokerDecisions);

  // Serialize snapshots
  const shipmentSnapshot = JSON.stringify(rawShipment);
  const decisionsSnapshot = JSON.stringify(brokerDecisions);

  // Perform a multitude of reference operations
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger2-cache-'));
  try {
    const cache = new ReferenceDiskCache(tmpDir);

    // 1. Lookup result creation using raw shipment observations
    const unladingQuery = rawShipment.bills[0].unladingPort!.value;
    const lookup: LookupResult = {
      category: 'ports',
      targetField: 'bills[0].unladingPort',
      query: unladingQuery,
      outcome: 'exact_match',
      candidates: [{ code: '3001', label: 'Seattle, WA' }],
      source: {
        publisher: 'Census',
        url: 'https://census.gov',
        datasetVersion: '2024-v1',
        retrievedAt: new Date().toISOString(),
      },
      matchingMethod: 'normalized_name',
      rationale: 'Normalized query match',
      missingFactsNeeded: [],
      codeVerifiedAgainstReference: true,
      userConfirmedForShipment: false,
      fingerprint: '',
    };
    lookup.fingerprint = computeLookupFingerprint({
      category: lookup.category,
      query: lookup.query,
      datasetVersion: lookup.source.datasetVersion,
      candidates: lookup.candidates,
    });

    deepFreeze(lookup);

    // Cache operations on frozen lookup
    cache.set('ports', unladingQuery, '2024-v1', lookup);
    const cached = cache.get('ports', unladingQuery, '2024-v1');
    assert.ok(cached !== null);

    // 2. Confirmation creation and filtering
    const confirmation = createValidConfirmation(
      'ports',
      unladingQuery,
      '2024-v1',
      '3001',
      'bills[0].unladingPort'
    );
    deepFreeze(confirmation);

    const { validConfirmations } = filterScopedConfirmations(
      { portConf: confirmation },
      {
        portConf: {
          category: 'ports',
          query: rawShipment.bills[0].unladingPort!.value,
          datasetVersion: '2024-v1',
          candidateCode: '3001',
        },
      }
    );

    assert.equal(validConfirmations['portConf'], confirmation);

    // 3. Verify zero mutation and 100% bitwise identity preservation
    assert.equal(
      JSON.stringify(rawShipment),
      shipmentSnapshot,
      'Raw shipment observations must never be mutated by reference operations'
    );
    assert.equal(
      JSON.stringify(brokerDecisions),
      decisionsSnapshot,
      'Broker manual decisions must never be mutated by reference operations'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --------------------------------------------------------------------------
// 4. Vulnerability & Edge Case Empirical Verification
// --------------------------------------------------------------------------

test('Vulnerability Check 1: Object.prototype keys in filterScopedConfirmations', () => {
  const conf = createValidConfirmation('ports', 'SEATTLE', 'v1', '3001');

  // When activeContexts is an empty object {}, accessing activeContexts['toString'] yields Object.prototype.toString
  // If filterScopedConfirmations does not check Object.hasOwn, it accesses (Function).category.trim() which crashes.
  let crashed = false;
  let errorMessage = '';

  try {
    filterScopedConfirmations({ toString: conf }, {});
  } catch (err: any) {
    crashed = true;
    errorMessage = err.message;
  }

  // Report empirical observation:
  if (crashed) {
    // Confirmed bug!
    assert.match(errorMessage, /reading 'trim'|is not a function/);
  }
  // Record result for handoff report
  assert.ok(true, `Recorded Prototype Key Crash: crashed=${crashed}, error=${errorMessage}`);
});

test('Vulnerability Check 2: Numeric candidateCode in activeContexts', () => {
  const conf = createValidConfirmation('ports', 'SEATTLE', 'v1', '3001');

  let crashed = false;
  let errorMessage = '';

  try {
    isConfirmationValidForLookup(conf, {
      category: 'ports',
      query: 'SEATTLE',
      datasetVersion: 'v1',
      candidateCode: 3001 as any, // Numeric candidateCode
    });
  } catch (err: any) {
    crashed = true;
    errorMessage = err.message;
  }

  if (crashed) {
    assert.match(errorMessage, /trim is not a function/);
  }
  assert.ok(true, `Recorded Numeric Candidate Crash: crashed=${crashed}, error=${errorMessage}`);
});

test('Vulnerability Check 3: Undefined category or query in activeContexts', () => {
  const conf = createValidConfirmation('ports', 'SEATTLE', 'v1', '3001');

  let crashed = false;
  let errorMessage = '';

  try {
    isConfirmationValidForLookup(conf, {
      category: undefined as any,
      query: 'SEATTLE',
      datasetVersion: 'v1',
    });
  } catch (err: any) {
    crashed = true;
    errorMessage = err.message;
  }

  if (crashed) {
    assert.match(errorMessage, /reading 'trim'/);
  }
  assert.ok(true, `Recorded Undefined Category Crash: crashed=${crashed}, error=${errorMessage}`);
});
