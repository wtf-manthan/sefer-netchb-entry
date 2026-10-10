/**
 * Authoritative dataset manifest specification.
 * Captures provenance, licensing, redistribution terms, and cryptographic checksums
 * for offline reproducibility and schema validation.
 */

export type DatasetFormat = 'json' | 'csv' | 'xml' | 'ts';

export interface DatasetManifest {
  id: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  datasetVersion: string;
  retrievedAt: string; // ISO 8601 string
  effectiveDate?: string;
  license: string;
  redistributable: boolean;
  recordCount: number;
  checksumSha256: string;
  format: DatasetFormat;
}
