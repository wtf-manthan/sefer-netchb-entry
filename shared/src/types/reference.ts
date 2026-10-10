/**
 * Reference data lookup and suggestion contracts.
 * Authoritative reference lists and shipment applicability are strictly separate.
 * Raw extracted observations ({value, status, source, confidence}) are never mutated.
 */

export type LookupOutcome = 'exact_match' | 'candidates' | 'no_match' | 'unavailable' | 'stale';

export type MatchingMethod =
  | 'exact_code'
  | 'normalized_name'
  | 'alias'
  | 'hierarchical_search'
  | 'fallback_format';

export interface ReferenceCandidate<T = string> {
  code: T;
  label: string;
  description?: string;
  details?: Record<string, unknown>;
}

export interface ReferenceSourceMetadata {
  publisher: string;
  url: string;
  datasetVersion: string;
  retrievedAt: string; // ISO 8601 string
  effectiveDate?: string;
  license?: string;
}

/**
 * Shared LookupResult contract containing all 10 required provenance/status attributes.
 * Note: Numerical confidence is intentionally excluded to prevent fabricated scores.
 */
export interface LookupResult<T = string> {
  category: string;
  targetField: string;
  query: string;
  outcome: LookupOutcome;
  candidates: ReferenceCandidate<T>[];
  source: ReferenceSourceMetadata;
  matchingMethod: MatchingMethod;
  rationale: string;
  missingFactsNeeded: string[];
  codeVerifiedAgainstReference: boolean;
  userConfirmedForShipment: boolean;
  fingerprint: string; // sha256 hex string tying result to query and dataset version
}

/**
 * Scoped confirmation binding record.
 * New authorizations require shipment/evidence/lookup binding in addition to field and candidate.
 * Optional scope fields allow legacy records to parse, but unscoped records never validate.
 */
export interface ReferenceConfirmation {
  shipmentId?: string;
  evidenceFingerprint?: string;
  lookupFingerprint?: string;
  category: string;
  targetField?: string;
  query: string;
  datasetVersion: string;
  candidateCode: string;
  confirmedAt: string; // ISO 8601 string
  confirmedBy?: string;
  fingerprint: string; // sha256 hex string
  userNotes?: string;
}
