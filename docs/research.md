# Reference verification status

[VERIFIED — spec/entry.xsd, spec/data_type.xsd] Local copies provide the implemented XML syntax constraints. The working entry schema imports local data_type.xsd. These files alone do not establish legal filing completeness or whether a code is active.

[UNKNOWN] Previous research claims about port mappings, HTS selections, duty rates, MID construction, trade programs and regulatory applicability are not independently established in this phase and must not be treated as authoritative defaults.

[VERIFIED — server/src/reference/hts.ts] The lookup client requests https://hts.usitc.gov/reststop/search?keyword=... with a timeout and bounded TTL cache. It returns source URL and retrieval time, preserves absent rates as null, and fails without generated alternatives. Tests use synthetic responses; they do not verify the live endpoint or any actual tariff.

[VERIFIED — server/src/reference/schedule-d.ts, server/src/reference/schedule-k.ts, server/data/reference/] Schedule D and K port lookups now use sourced, versioned snapshots and require shipment-specific acceptance. MID construction remains unavailable; provide a reviewed identifier. Unknown normalization returns null rather than guessing.

[UNKNOWN] Current remote NetCHB service accessibility and acceptance have not been established. The preceding audit's web fetch of https://www.netchb.com/main/services/entry/EntryUploadService?wsdl returned 403. No transmission was attempted.

[UNKNOWN] The three local PDFs are primary sample evidence. samples/ground-truth.json identifies itself as an AI transcription with verified_by_human=false. This phase validates its demo adapter, not its transcription accuracy; PDF comparison remains required before scoring extraction.

[VERIFIED — experiments/prefill-v3/extracted.json; docs/prefill-audit.md] Schema v3 extraction captures structured routing, party/manufacturer roles and line assist evidence. The sample was compared with its PDFs; it retains commercial discrepancies. Model confidence is not measured accuracy. General unseen-shipment extraction quality remains UNKNOWN beyond synthetic contract tests.
