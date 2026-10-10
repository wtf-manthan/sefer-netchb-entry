# Project: NetCHB Entry Reference Data, Schemas & Suggestion Workflows

## Architecture
The monorepo consists of three core workspaces plus specification and documentation directories:
- **`@sefer/shared` (`shared/`)**: Shared types, Zod schemas, reference data models, and contracts.
  - `shared/src/types/field.ts`: Existing extraction observation contract (`{ value, status, source, confidence }`). PRESERVED without mutation.
  - `shared/src/types/reference.ts`: New shared `LookupResult<T>` contract with 10 required provenance/review attributes.
  - `shared/src/reference/`: Authoritative reference lists (ports, countries, currencies, transport modes, entry types, bond types, units of measure, states, SPIs).
- **`server` (`server/`)**: Backend API, entry generator, reference loaders, caching layer, and XML validation.
  - `server/src/reference/`: Reference service modules, snapshot loaders, disk caching (`.cache/reference/`), dataset manifests.
  - `server/src/app.ts`: REST endpoints (`/api/reference/*`, `/api/hts/*`).
  - `server/src/checks/`: Deterministic shipment checks and suggestions resolver.
  - `server/src/builder/`: XML serializer and xmllint-wasm validator.
- **`web` (`web/`)**: React frontend. Suggestion endpoints are exposed via API contracts for later UI phases.
- **`spec/`**: Authoritative NetCHB XML schemas (`spec/entry.xsd`, `spec/data_type.xsd`). Work is validated strictly against these schemas without modifying `/spec/original/`.
- **`docs/`**: `docs/ai-log.md` (updated after every task) and `docs/open-questions.md` (ambiguities and decisions).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Shared Lookup Contract | 10-attribute provenance record (`category`, `targetField`, `query`, `outcome`, `candidates`, `source`, `matchingMethod`, `rationale`, `missingFacts`, `reviewState`, `fingerprint`) | M1 | `ORIGINAL_REQUEST.md:32-45` |
| 2 | Reference Data Storage & Manifest | Disk caching in `.cache/reference/`, versioning, dataset manifests with checksums and provenance | M1 | `ORIGINAL_REQUEST.md:64-75` |
| 3 | Schedule D (US Ports) | 4-digit numeric US customs ports (`portType`), role separation (processing, entry, unlading), normalized lookup | M2 | `spec/data_type.xsd:253`, `ORIGINAL_REQUEST.md:89-97` |
| 4 | Schedule K (Foreign Ports) | 5-digit numeric foreign ports (`foreignPortType`), country filter, strict rejection of alphanumeric UN/LOCODE | M3 | `spec/data_type.xsd:166`, `ORIGINAL_REQUEST.md:98-106` |
| 5 | ISO 3166-1 Country Codes | Complete 249-country ISO 3166-1 alpha-2 list, alias normalization, separation of country of origin vs country of export | M4 | `spec/data_type.xsd:66`, `ORIGINAL_REQUEST.md:107-115` |
| 6 | ISO 4217 Currency Codes | Complete currency list, active vs historical, explicit reviewed exchange rates (no fake market rate API) | M5 | `spec/entry.xsd:1037`, `ORIGINAL_REQUEST.md:116-125` |
| 7 | Transport Modes | All 15 schema `modeTransportType` enumerations, container evidence distinction, application profile gate for modes 10/11 | M6 | `spec/data_type.xsd:208`, `ORIGINAL_REQUEST.md:126-134` |
| 8 | Entry Types | All 43 schema `entryType` enumerations, application profile gate for Type 01, no auto-selection solely by value | M7 | `spec/data_type.xsd:100`, `ORIGINAL_REQUEST.md:135-142` |
| 9 | Bond Types | NetCHB bond types `"00"`, `"08"`, `"09"` (`bondType`), waiver reasons, continuous superseded flag, no inference from docs | M8 | `spec/entry.xsd:6134`, `ORIGINAL_REQUEST.md:143-150` |
| 10 | Units of Measure | All 83 schema `unitOfMeasureType` enumerations, separate commercial vs statistical units, no silent quantity conversions | M9 | `spec/data_type.xsd:321`, `ORIGINAL_REQUEST.md:151-161` |
| 11 | US States and Territories | 59 schema `usStateType` enumerations (states, DC, territories), postal normalization, non-US address separation | M10 | `spec/data_type.xsd:414`, `ORIGINAL_REQUEST.md:162-167` |
| 12 | Special Program Indicators | SPI codes (`specialProgramType` <= 2 chars), candidate information, eligibility unconfirmed by origin alone | M11 | `spec/data_type.xsd:266`, `ORIGINAL_REQUEST.md:168-176` |
| 13 | Carrier SCAC | SCAC format validation (`carrierCodeType`), graceful "registry verification unavailable" due to proprietary NMFTA terms | M12 | `spec/data_type.xsd:22`, `ORIGINAL_REQUEST.md:177-185` |
| 14 | USITC HTS Integration | 10-digit candidate tree, disk caching, timeouts, rate limiting, hierarchical descriptions, non-apparel test cases | M13 | `spec/data_type.xsd:314`, `ORIGINAL_REQUEST.md:186-198` |
| 15 | Suggestion Flow & Integration | Integration into `/api/reference/*`, non-blocking `/api/entry`, offline reproducibility, dual validation statuses | M14 | `ORIGINAL_REQUEST.md:199-208` |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Reference Infrastructure | Shared `LookupResult` contract, backend cache storage, dataset manifest format, import/update utility | none | DONE |
| M2 | Schedule D / US Ports | Authoritative US ports lookup, role separation (processing, entry, unlading), ambiguous matches, provenance | M1 | PLANNED |
| M3 | Schedule K / Foreign Ports | Authoritative foreign ports lookup, 5-digit numeric codes strictly, country filtering, no UN/LOCODE substitution | M1 | PLANNED |
| M4 | Country Codes | Authoritative ISO 3166-1 alpha-2 codes, alias normalization, origin vs export separation | M1 | PLANNED |
| M5 | Currency Codes | Authoritative ISO 4217 currencies, current vs historical separation, explicit reviewed exchange rates | M1 | PLANNED |
| M6 | Transport Modes | All 15 schema modes, containerized vs non-containerized evidence, profile gates | M1 | PLANNED |
| M7 | Entry Types | All 43 schema entry types, profile gates (Type 01 supported), no value-based guessing | M1 | PLANNED |
| M8 | Bond Types | Schema values `"00"`, `"08"`, `"09"`, waiver reasons, credentials schema update, explicit broker decisions | M1 | PLANNED |
| M9 | Units of Measure | All 83 schema reporting units, commercial alias normalization, no silent conversion | M1 | PLANNED |
| M10 | US States and Territories | Complete 59 schema state/territory codes, address validation | M1 | PLANNED |
| M11 | Special Program Indicators | SPI lookup, HTS GN 3(c) programs, eligibility unconfirmed by origin | M1 | PLANNED |
| M12 | Carrier SCAC | Format validation, graceful "registry unavailable" handling, role separation (master vs house) | M1 | PLANNED |
| M13 | HTS / USITC | 10-digit candidate expansion, disk cache, timeout/rate-limiting, non-apparel testing | M1 | PLANNED |
| M14 | Integration & Verification | Suggestion API integration, offline reproducibility, full suite test verification, dual validation statuses, docs | M1-M13 | PLANNED |

---

## Interface Contracts

### 1. Shared Lookup Result Contract (`@sefer/shared`)
```typescript
export type LookupOutcome = 'exact_match' | 'candidates' | 'no_match' | 'unavailable' | 'stale';

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
  retrievedAt: string; // ISO 8601
  effectiveDate?: string;
  license?: string;
}

export interface LookupResult<T = string> {
  category: string;
  targetField: string;
  query: string;
  outcome: LookupOutcome;
  candidates: ReferenceCandidate<T>[];
  source: ReferenceSourceMetadata;
  matchingMethod: 'exact_code' | 'normalized_name' | 'alias' | 'hierarchical_search' | 'fallback_format';
  rationale: string;
  missingFactsNeeded: string[];
  codeVerifiedAgainstReference: boolean;
  userConfirmedForShipment: boolean;
  fingerprint: string; // sha256(category + query + datasetVersion + candidates)
}
```

### 2. Dataset Manifest Contract (`@sefer/shared` / `server`)
```typescript
export interface DatasetManifest {
  id: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  datasetVersion: string;
  retrievedAt: string;
  effectiveDate?: string;
  license: string;
  redistributable: boolean;
  recordCount: number;
  checksumSha256: string;
  format: 'json' | 'csv' | 'xml' | 'ts';
}
```

---

## Code Layout
- `shared/src/types/reference.ts`: Lookup result and candidate interfaces.
- `shared/src/schemas/reference.schema.ts`: Zod validation schemas for lookup results and manifests.
- `shared/src/reference/`: Static, deterministically bundled reference datasets (ports, countries, currencies, MOT, entry types, bond types, UOM, states, SPI).
- `server/src/reference/`: Backend reference services, disk cache manager (`.cache/reference/`), offline loaders, API handlers.
- `server/src/app.ts`: Routing for `/api/reference/*` and `/api/hts/*`.
- `server/test/reference/`: Comprehensive unit and integration test suites for each task.
