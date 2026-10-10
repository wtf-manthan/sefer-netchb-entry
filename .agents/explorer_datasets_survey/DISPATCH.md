## 2026-10-10T06:05:00Z
You are an Explorer subagent focusing on authoritative reference datasets for US Customs / NetCHB.
Your working directory is: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\explorer_datasets_survey
Project root: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern
Original Request file: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\ORIGINAL_REQUEST.md

Task:
Read:
1. c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\ORIGINAL_REQUEST.md
2. c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\AGENTS.md and GEMINI.md
3. Existing reference files in the repo if any.

Investigate the authoritative sources, publishers, coverage, formats, and licensing/redistribution terms for Tasks 1-13:
- Schedule D (US ports): US Census / CBP official files, publisher, format, size.
- Schedule K (Foreign ports): US Census / CBP official files, format (numeric 5-digit), publisher.
- Country codes: ISO 3166-1 alpha-2, official source.
- Currency codes: ISO 4217, official source.
- Transport modes: CBP / NetCHB mode enumerations.
- Entry types: CBP entry types (01, 11, etc.).
- Bond types: NetCHB 00/08/09 meanings and XSD definitions.
- Units of measure: NetCHB XSD units and official CBP/HTS mapping.
- US states/territories: USPS / ANSI standard.
- SPIs: HTSUS General Note 3(c).
- Carrier SCAC: NMFTA status (licensing / availability / whether verification must be "unavailable" format-only).
- HTS / USITC: USITC HTS API / official HTS data, tariff length, 10-digit candidates.

Deliverable:
Write a comprehensive dataset survey report at c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\explorer_datasets_survey\handoff.md with evidence tags (VERIFIED, INFERRED, UNKNOWN) for each dataset, source URL, license, and proposed bundling/snapshot strategy.
When finished, send a brief message to the parent orchestrator with your status and path to handoff.md.
