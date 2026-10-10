import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  DatasetManifest,
  DatasetManifestSchema,
  computeSha256,
} from '@sefer/shared';

export interface DatasetVerificationResult {
  valid: boolean;
  expectedChecksum: string;
  actualChecksum: string;
  fileSizeBytes: number;
  reason?: string;
}

/**
 * Loads and validates a dataset manifest file.
 */
export function loadManifest(manifestPath: string): DatasetManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file does not exist: ${manifestPath}`);
  }
  const content = fs.readFileSync(manifestPath, 'utf8');
  const raw = JSON.parse(content);
  return DatasetManifestSchema.parse(raw);
}

/**
 * Verifies that a dataset file on disk matches its manifest's cryptographic checksum.
 */
export function verifyDatasetFile(
  manifest: DatasetManifest,
  dataFilePath: string
): DatasetVerificationResult {
  if (!fs.existsSync(dataFilePath)) {
    return {
      valid: false,
      expectedChecksum: manifest.checksumSha256,
      actualChecksum: '',
      fileSizeBytes: 0,
      reason: `Dataset file does not exist at ${dataFilePath}`,
    };
  }

  const buffer = fs.readFileSync(dataFilePath);
  const actualChecksum = computeSha256(buffer);
  const valid = actualChecksum.toLowerCase() === manifest.checksumSha256.toLowerCase();

  return {
    valid,
    expectedChecksum: manifest.checksumSha256.toLowerCase(),
    actualChecksum,
    fileSizeBytes: buffer.length,
    reason: valid ? undefined : 'Checksum mismatch',
  };
}

export interface CreateManifestOptions {
  id: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  datasetVersion: string;
  retrievedAt?: string;
  effectiveDate?: string;
  license: string;
  redistributable: boolean;
  recordCount: number;
  format: 'json' | 'csv' | 'xml' | 'ts';
  dataContent?: string | Buffer;
  dataFilePath?: string;
  checksumSha256?: string;
}

/**
 * Creates and validates a DatasetManifest, computing the SHA256 checksum if content/filePath is provided.
 */
export function createManifest(options: CreateManifestOptions): DatasetManifest {
  let checksum = options.checksumSha256;

  if (!checksum) {
    if (options.dataContent) {
      checksum = computeSha256(options.dataContent);
    } else if (options.dataFilePath) {
      if (!fs.existsSync(options.dataFilePath)) {
        throw new Error(`Data file not found for checksum calculation: ${options.dataFilePath}`);
      }
      const buf = fs.readFileSync(options.dataFilePath);
      checksum = computeSha256(buf);
    } else {
      throw new Error('Must provide checksumSha256, dataContent, or dataFilePath');
    }
  }

  const manifest: DatasetManifest = {
    id: options.id,
    title: options.title,
    publisher: options.publisher,
    sourceUrl: options.sourceUrl,
    datasetVersion: options.datasetVersion,
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    ...(options.effectiveDate ? { effectiveDate: options.effectiveDate } : {}),
    license: options.license,
    redistributable: options.redistributable,
    recordCount: options.recordCount,
    checksumSha256: checksum.toLowerCase(),
    format: options.format,
  };

  return DatasetManifestSchema.parse(manifest);
}

/**
 * Saves a validated dataset manifest to disk atomically.
 */
export function saveManifest(manifest: DatasetManifest, destinationPath: string): void {
  const validated = DatasetManifestSchema.parse(manifest);
  const dir = path.dirname(destinationPath);
  fs.mkdirSync(dir, { recursive: true });

  const tempFile = path.join(dir, `${path.basename(destinationPath)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tempFile, JSON.stringify(validated, null, 2), 'utf8');
    fs.renameSync(tempFile, destinationPath);
  } finally {
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore unlink error
      }
    }
  }
}
