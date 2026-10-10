# Reference verification status

[VERIFIED — spec/entry.xsd, spec/data_type.xsd] Local copies provide the implemented XML syntax constraints. The working entry schema imports local data_type.xsd. These files alone do not establish legal filing completeness or whether a code is active.

[UNKNOWN] Previous research claims about port mappings, HTS selections, duty rates, MID construction, trade programs and regulatory applicability are not independently established in this phase and must not be treated as authoritative defaults.

[VERIFIED — server/src/reference/hts.ts] The lookup client requests https://hts.usitc.gov/reststop/search?keyword=... with a timeout and bounded TTL cache. It returns source URL and retrieval time, preserves absent rates as null, and fails without generated alternatives. Tests use synthetic responses; they do not verify the live endpoint or any actual tariff.

[VERIFIED — server/src/reference/schedule-d.ts, server/src/reference/schedule-k.ts, server/src/reference/mid.ts] Port resolution and MID generation are unavailable pending authoritative verification. Reviewed user inputs may be supplied explicitly. Unsupported country/currency/unit normalization returns null instead of a guess.

[UNKNOWN] Current remote NetCHB service accessibility and acceptance have not been established. The preceding audit's web fetch of https://www.netchb.com/main/services/entry/EntryUploadService?wsdl returned 403. No transmission was attempted.

[UNKNOWN] The three local PDFs are primary sample evidence. samples/ground-truth.json identifies itself as an AI transcription with verified_by_human=false. This phase validates its demo adapter, not its transcription accuracy; PDF comparison remains required before scoring extraction.
