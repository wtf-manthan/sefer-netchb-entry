import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  LookupResult,
  LookupResultSchema,
  computeLookupFingerprint,
  validateLookupFingerprint,
  computeSha256,
  IsoDateTimeOrDateSchema,
} from '@sefer/shared';

export interface ReferenceCacheEntry<T = unknown> {
  key: string;
  category: string;
  query: string;
  datasetVersion: string;
  cachedAt: string; // ISO 8601 string
  ttlMs?: number;
  fingerprint: string;
  data: LookupResult<T>;
}

export interface CacheGetOptions {
  maxAgeMs?: number;
  labelStaleIfExpired?: boolean;
}

export interface CacheInspectResult<T = unknown> {
  status: 'hit' | 'miss' | 'stale' | 'corrupted';
  result: LookupResult<T> | null;
  cachedAt?: string;
  ageMs?: number;
  ttlMs?: number;
  corruptedReason?: string;
}

export class ReferenceDiskCache {
  constructor(
    private directory: string = path.resolve(process.cwd(), '.cache/reference'),
    private scope?: {targetField:string;contextFingerprint:string}
  ) {
    if(!scope?.targetField || !/^[a-f0-9]{64}$/.test(scope.contextFingerprint))throw new Error('Reference cache requires targetField and a fingerprint of all lookup hints/context');
    this.scope={...scope};
  }

  /**
   * Deterministically computes cache key isolating category, query, and datasetVersion.
   */
  computeCacheKey(category: string, query: string, datasetVersion: string): string {
    const payload = [
      'reference-cache-v2', this.scope!.targetField, this.scope!.contextFingerprint,
      category.trim().toLowerCase(),
      query.trim(),
      datasetVersion.trim(),
    ];
    return computeSha256(JSON.stringify(payload));
  }

  private sanitizeCategory(category: string): string {
    return category.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'default';
  }

  private getFilePath(category: string, query: string, datasetVersion: string): string {
    const safeCat = this.sanitizeCategory(category);
    const key = this.computeCacheKey(category, query, datasetVersion);
    return path.join(this.directory, safeCat, `${key}.json`);
  }

  /**
   * Writes a LookupResult to the isolated disk cache atomically.
   */
  set<T>(
    category: string,
    query: string,
    datasetVersion: string,
    result: LookupResult<T>,
    options?: { ttlMs?: number }
  ): void {
    // Cross-payload synchronization check: prevent writing desynchronized payload
    if (
      result.category.trim().toLowerCase() !== category.trim().toLowerCase() ||
      result.query.trim() !== query.trim() ||
      (result.source?.datasetVersion ?? '').trim() !== datasetVersion.trim()
    ) {
      throw new Error(
        `Cross-payload desynchronization: payload (${result.category}, ${result.query}, ${result.source?.datasetVersion}) does not match cache envelope (${category}, ${query}, ${datasetVersion})`
      );
    }

    if(result.targetField!==this.scope!.targetField)throw new Error('Cache target field does not match scope');
    if(options?.ttlMs!==undefined&&(!Number.isFinite(options.ttlMs)||options.ttlMs<0))throw new Error('Invalid cache TTL');
    // Never repair a mismatched fingerprint into trusted cache data.
    const verifiedResult: LookupResult<T> = { ...result, userConfirmedForShipment:false };
    if (!validateLookupFingerprint(verifiedResult)) {
      throw new Error('Fingerprint validation failed');
    }

    const validatedData = LookupResultSchema.parse(verifiedResult) as LookupResult<T>;
    const key = this.computeCacheKey(category, query, datasetVersion);
    const targetFile = this.getFilePath(category, query, datasetVersion);
    const targetDir = path.dirname(targetFile);

    fs.mkdirSync(targetDir, { recursive: true });

    const entry: ReferenceCacheEntry<T> = {
      key,
      category: category.trim().toLowerCase(),
      query: query.trim(),
      datasetVersion: datasetVersion.trim(),
      cachedAt: new Date().toISOString(),
      ...(options?.ttlMs !== undefined ? { ttlMs: options.ttlMs } : {}),
      fingerprint: validatedData.fingerprint,
      data: validatedData,
    };

    const tempFile = path.join(targetDir, `${key}.${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(tempFile, JSON.stringify(entry, null, 2), 'utf8');
      fs.renameSync(tempFile, targetFile);
    } finally {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Ignore temp file cleanup errors
        }
      }
    }
  }

  /**
   * Recovers from corrupted cache file by safely removing it.
   */
  private recoverCorrupted(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore unlink errors during recovery
    }
  }

  /**
   * Inspects cache state with detailed status (hit, miss, stale, corrupted).
   */
  inspect<T>(
    category: string,
    query: string,
    datasetVersion: string,
    options?: CacheGetOptions
  ): CacheInspectResult<T> {
    const targetFile = this.getFilePath(category, query, datasetVersion);
    const expectedKey = this.computeCacheKey(category, query, datasetVersion);

    if (!fs.existsSync(targetFile)) {
      return { status: 'miss', result: null };
    }

    let raw: string;
    try {
      raw = fs.readFileSync(targetFile, 'utf8');
    } catch (err) {
      this.recoverCorrupted(targetFile);
      return {
        status: 'corrupted',
        result: null,
        corruptedReason: `Read error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    let entry: ReferenceCacheEntry<T>;
    try {
      entry = JSON.parse(raw);
    } catch {
      this.recoverCorrupted(targetFile);
      return { status: 'corrupted', result: null, corruptedReason: 'Malformed JSON' };
    }

    if (!entry || typeof entry !== 'object') {
      this.recoverCorrupted(targetFile);
      return { status: 'corrupted', result: null, corruptedReason: 'Not an object entry' };
    }

    if (
      entry.key !== expectedKey ||
      entry.category !== category.trim().toLowerCase() ||
      entry.query !== query.trim() ||
      entry.datasetVersion !== datasetVersion.trim()
    ) {
      this.recoverCorrupted(targetFile);
      return { status: 'corrupted', result: null, corruptedReason: 'Cache key / metadata mismatch' };
    }

    const parsedData = LookupResultSchema.safeParse(entry.data);
    if (!parsedData.success) {
      this.recoverCorrupted(targetFile);
      return {
        status: 'corrupted',
        result: null,
        corruptedReason: `Schema validation failed: ${parsedData.error.message}`,
      };
    }

    const typedResult = parsedData.data as LookupResult<T>;
    // A reference cache is never storage for a shipment authorization.
    typedResult.userConfirmedForShipment=false;

    // Cross-payload synchronization check: inner payload must match envelope
    if (
      typedResult.category.trim().toLowerCase() !== entry.category ||
      typedResult.query.trim() !== entry.query ||
      (typedResult.source?.datasetVersion ?? '').trim() !== entry.datasetVersion
    ) {
      this.recoverCorrupted(targetFile);
      return {
        status: 'corrupted',
        result: null,
        corruptedReason: 'Cross-payload desynchronization: payload category/query/version does not match cache envelope',
      };
    }

    if(typedResult.targetField!==this.scope!.targetField)return {status:'corrupted',result:null,corruptedReason:'Target field mismatch'};
    if (!validateLookupFingerprint(typedResult) || typedResult.fingerprint !== entry.fingerprint) {
      this.recoverCorrupted(targetFile);
      return { status: 'corrupted', result: null, corruptedReason: 'Fingerprint validation failed' };
    }

    const cachedTime = new Date(entry.cachedAt).getTime();
    if (!IsoDateTimeOrDateSchema.safeParse(entry.cachedAt).success || isNaN(cachedTime) || cachedTime>Date.now() || (entry.ttlMs!==undefined&&(!Number.isFinite(entry.ttlMs)||entry.ttlMs<0))) {
      this.recoverCorrupted(targetFile);
      return { status: 'corrupted', result: null, corruptedReason: 'Invalid cachedAt timestamp' };
    }
    const ageMs = Date.now() - cachedTime;
    const effectiveTtl = options?.maxAgeMs ?? entry.ttlMs;
    const isExpired = effectiveTtl !== undefined && (!Number.isFinite(effectiveTtl) || effectiveTtl<0 || isNaN(ageMs) || ageMs >= effectiveTtl);

    if (isExpired) {
      return {
        status: 'stale',
        result: typedResult,
        cachedAt: entry.cachedAt,
        ageMs,
        ttlMs: entry.ttlMs,
      };
    }

    return {
      status: 'hit',
      result: typedResult,
      cachedAt: entry.cachedAt,
      ageMs,
      ttlMs: entry.ttlMs,
    };
  }

  /**
   * Retrieves a cached result, returning null on miss or unhandled expiration,
   * recovering cleanly from corruption, and optionally labeling stale entries.
   */
  get<T>(
    category: string,
    query: string,
    datasetVersion: string,
    options?: CacheGetOptions
  ): LookupResult<T> | null {
    const inspect = this.inspect<T>(category, query, datasetVersion, options);

    if (inspect.status === 'hit') {
      return inspect.result;
    }

    if (inspect.status === 'stale') {
      if (options?.labelStaleIfExpired && inspect.result) {
        return {
          ...inspect.result,
          outcome: 'stale',
        };
      }
      return null;
    }

    // miss or corrupted
    return null;
  }

  /**
   * Removes a specific cache entry.
   */
  delete(category: string, query: string, datasetVersion: string): boolean {
    const targetFile = this.getFilePath(category, query, datasetVersion);
    if (fs.existsSync(targetFile)) {
      try {
        fs.unlinkSync(targetFile);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Clears the reference cache, optionally restricted to a specific category.
   */
  clear(category?: string): void {
    if (category) {
      const targetDir = path.join(this.directory, this.sanitizeCategory(category));
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    } else {
      if (fs.existsSync(this.directory)) {
        fs.rmSync(this.directory, { recursive: true, force: true });
      }
    }
  }
}
