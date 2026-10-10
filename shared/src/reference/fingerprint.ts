import { LookupResult, ReferenceConfirmation } from '../types/reference';
import {ReferenceConfirmationSchema} from '../schemas/reference.schema';

/**
 * Standard SHA-256 implementation (FIPS 180-4).
 * Pure TypeScript with zero external dependencies to ensure identical deterministic execution
 * across Node.js runtime, browser bundle (Vite), and web workers.
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function computeSha256(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const bitLength = bytes.length * 8;

  // Pre-processing: pad with 0x80, zeros, then 64-bit big-endian length
  const newByteLength = ((bytes.length + 8) >> 6 << 6) + 64;
  const buffer = new Uint8Array(newByteLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;

  const view = new DataView(buffer.buffer);
  // Upper 32 bits of bitLength (standard JS safe integers limit)
  view.setUint32(newByteLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(newByteLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let i = 0; i < newByteLength; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      const s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      const s1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[j] + w[j]) >>> 0;
      const s0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hexParts = [h0, h1, h2, h3, h4, h5, h6, h7].map((num) =>
    num.toString(16).padStart(8, '0')
  );
  return hexParts.join('');
}

function canonicalizeDetails(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return null;
  }
  const keys = Object.keys(details as Record<string, unknown>).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) {
    sorted[k] = (details as Record<string, unknown>)[k];
  }
  return sorted;
}

function canonicalizeCandidates(candidates: unknown): Array<{
  code: string;
  label: string;
  description: string;
  details: Record<string, unknown> | null;
}> {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((c) => ({
      code: String(c?.code ?? '').trim(),
      label: String(c?.label ?? '').trim(),
      description: String(c?.description ?? '').trim(),
      details: canonicalizeDetails(c?.details),
    }))
    .sort(
      (a, b) =>
        a.code.localeCompare(b.code) ||
        a.label.localeCompare(b.label) ||
        a.description.localeCompare(b.description)
    );
}

export interface LookupFingerprintParams {
  category: string;
  query: string;
  datasetVersion: string;
  candidates?: unknown;
}

/**
 * Deterministically computes sha256 fingerprint for a lookup result.
 * Binds category + query + datasetVersion + candidates (code, label, description, details).
 */
export function computeLookupFingerprint(params: LookupFingerprintParams): string {
  const payload = [
    params.category.trim().toLowerCase(),
    params.query.trim(),
    params.datasetVersion.trim(),
    canonicalizeCandidates(params.candidates),
  ];
  return computeSha256(JSON.stringify(payload));
}

export interface ConfirmationFingerprintParams {
  shipmentId?: string;
  evidenceFingerprint?: string;
  lookupFingerprint?: string;
  category: string;
  targetField?: string;
  query: string;
  datasetVersion: string;
  candidateCode: string | number;
}

/**
 * Deterministically computes sha256 fingerprint for a candidate confirmation.
 * Binds sha256(category + targetField + query + datasetVersion + candidateCode).
 */
export function computeConfirmationFingerprint(
  paramsOrCategory: ConfirmationFingerprintParams | string,
  query?: string,
  datasetVersion?: string,
  candidateCode?: string | number,
  targetField?: string
): string {
  let cat: string;
  let tf: string;
  let q: string;
  let ver: string;
  let code: string;

  if (typeof paramsOrCategory === 'object') {
    cat = paramsOrCategory.category;
    tf = paramsOrCategory.targetField ?? '';
    q = paramsOrCategory.query;
    ver = paramsOrCategory.datasetVersion;
    code = String(paramsOrCategory.candidateCode);
  } else {
    cat = paramsOrCategory;
    q = query ?? '';
    ver = datasetVersion ?? '';
    code = String(candidateCode ?? '');
    tf = targetField ?? '';
  }

  const payload = [
    cat.trim().toLowerCase(),
    tf.trim(),
    q.trim(),
    ver.trim(),
    code.trim(),
    typeof paramsOrCategory==='object'?paramsOrCategory.shipmentId??'':'',
    typeof paramsOrCategory==='object'?paramsOrCategory.evidenceFingerprint??'':'',
    typeof paramsOrCategory==='object'?paramsOrCategory.lookupFingerprint??'':'',
  ];
  return computeSha256(JSON.stringify(payload));
}

/**
 * Validates that a LookupResult's fingerprint matches its content.
 */
export function validateLookupFingerprint(result: LookupResult<unknown>): boolean {
  if (!result || typeof result.fingerprint !== 'string') return false;
  const expected = computeLookupFingerprint({
    category: result.category,
    query: result.query,
    datasetVersion: result.source?.datasetVersion ?? '',
    candidates: result.candidates,
  });
  return result.fingerprint === expected;
}

/**
 * Validates that a ReferenceConfirmation's fingerprint matches its binding parameters.
 */
export function validateConfirmationFingerprint(confirmation: ReferenceConfirmation): boolean {
  if (!confirmation || typeof confirmation.fingerprint !== 'string') return false;
  const expected = computeConfirmationFingerprint({
    shipmentId:confirmation.shipmentId,
    evidenceFingerprint:confirmation.evidenceFingerprint,
    lookupFingerprint:confirmation.lookupFingerprint,
    category: confirmation.category,
    targetField: confirmation.targetField,
    query: confirmation.query,
    datasetVersion: confirmation.datasetVersion,
    candidateCode: confirmation.candidateCode,
  });
  return confirmation.fingerprint === expected;
}

/**
 * Checks whether an existing confirmation remains valid for a specific query context.
 */
export function isConfirmationValidForLookup(
  confirmation: ReferenceConfirmation,
  current: {
    shipmentId?: string;
    evidenceFingerprint?: string;
    lookupFingerprint?: string;
    category: string;
    targetField?: string;
    query: string;
    datasetVersion: string;
    candidateCode?: string | number;
  }
): boolean {
  if(!ReferenceConfirmationSchema.safeParse(confirmation).success)return false;
  if(!current?.shipmentId || !current.targetField || current.candidateCode===undefined ||
    !/^[a-f0-9]{64}$/.test(current.evidenceFingerprint??'') || !/^[a-f0-9]{64}$/.test(current.lookupFingerprint??''))return false;
  if(confirmation.shipmentId!==current.shipmentId || confirmation.evidenceFingerprint!==current.evidenceFingerprint || confirmation.lookupFingerprint!==current.lookupFingerprint)return false;
  if (!validateConfirmationFingerprint(confirmation)) return false;
  if (!current?.category || !current?.query || !current?.datasetVersion) return false;
  if (confirmation.category.trim().toLowerCase() !== String(current.category).trim().toLowerCase()) return false;
  if (confirmation.query.trim() !== String(current.query).trim()) return false;
  if (confirmation.datasetVersion.trim() !== String(current.datasetVersion).trim()) return false;

  // Prevent role bleed between distinct target fields
  const confTarget = confirmation.targetField?.trim() ?? '';
  const currentTarget = current.targetField?.trim() ?? '';
  if (confTarget !== currentTarget) {
    return false;
  }

  // Safely coerce candidateCode to string to handle numeric codes gracefully
  if (current.candidateCode !== undefined) {
    if (String(confirmation.candidateCode).trim() !== String(current.candidateCode).trim()) {
      return false;
    }
  }
  return true;
}

/**
 * Scoped confirmation invalidation.
 * Filters confirmations map against active lookups.
 * If query, evidence, or dataset version changes for a given key, ONLY that key is invalidated.
 * Unrelated confirmations remain completely intact.
 */
export function filterScopedConfirmations<T extends ReferenceConfirmation>(
  confirmations: Record<string, T>,
  activeContexts: Record<
    string,
    {
      shipmentId?: string;
      evidenceFingerprint?: string;
      lookupFingerprint?: string;
      category: string;
      targetField?: string;
      query: string;
      datasetVersion: string;
      candidateCode?: string | number;
    }
  >
): {
  validConfirmations: Record<string, T>;
  invalidatedKeys: string[];
} {
  const validConfirmations: Record<string, T> = {};
  const invalidatedKeys: string[] = [];

  for (const [key, confirmation] of Object.entries(confirmations)) {
    // Defend against Object.prototype key collisions (e.g. 'toString', 'valueOf')
    if (!Object.prototype.hasOwnProperty.call(activeContexts, key)) {
      invalidatedKeys.push(key);
      continue;
    }

    const current = activeContexts[key];
    if (!current) {
      // If the field is no longer present in active contexts, it is invalidated
      invalidatedKeys.push(key);
      continue;
    }

    if (isConfirmationValidForLookup(confirmation, current)) {
      validConfirmations[key] = confirmation;
    } else {
      invalidatedKeys.push(key);
    }
  }

  return { validConfirmations, invalidatedKeys };
}
