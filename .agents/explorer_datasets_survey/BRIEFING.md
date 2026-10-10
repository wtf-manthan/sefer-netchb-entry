# BRIEFING — 2026-10-10T06:14:00Z

## Mission
Comprehensive authoritative reference dataset survey for US Customs / NetCHB across 13 domains with verified sources, formats, licenses, and bundling strategies.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\explorer_datasets_survey
- Original parent: 6f311ec1-ed1b-4285-9539-4a423e43c977
- Milestone: Reference Datasets Survey for US Customs / NetCHB

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Evidence labels: Every claim tagged VERIFIED (with source URL/file), INFERRED (with reasoning), or UNKNOWN. Never invent codes or schemas.
- Preserve originals: Never modify /spec/original/ or /samples/original/.
- Write only to own directory: .agents/explorer_datasets_survey/

## Current Parent
- Conversation ID: 6f311ec1-ed1b-4285-9539-4a423e43c977
- Updated: not yet

## Investigation State
- **Explored paths**: spec/data_type.xsd, spec/entry.xsd, shared/src/reference/*, server/src/reference/*, docs/*, US Census Bureau Foreign Trade, USACE Navigation Data Center, CBP ACE CATAIR, USITC HTS, SIX Group ISO 4217, NMFTA SCAC terms, USPS Pub 28.
- **Key findings**:
  1. Schedule D (US ports): 4-digit code (`\d{4}` in data_type.xsd), US Census / CBP official files, ~400+ ports, public domain (17 U.S.C. § 105).
  2. Schedule K (Foreign ports): 5-digit numeric code (`\d{5}` in data_type.xsd), USACE WCSC / Census, ~10,000 ports, public domain. UN/LOCODE (5-letter) must NOT be substituted.
  3. ISO 3166-1 alpha-2: 249 codes, US Census Schedule C correspondence, public domain / LGPL-2.1.
  4. ISO 4217: SIX Group list_one.xml and list_three.xml; currency conversion strictly governed by 19 CFR 159.31/159.32 (proclaimed/certified Federal Reserve / CBP bulletin rates by export date, not market-rate APIs).
  5. Transport modes: CBP ACE CATAIR Appendix B defines 15 modes (10, 11, 12, 20, 21, 30, 31, 32, 33, 34, 40, 41, 50, 60, 70), matching data_type.xsd. Current app scope is ocean 10/11.
  6. Entry types: CBP ACE CATAIR / Form 7501 defines 43 entry types matching data_type.xsd. App profile is 01 only.
  7. Bond types: NetCHB entry.xsd defines 00 (No bond / waived), 08 (Continuous), 09 (Single Transaction Bond).
  8. Units of measure: data_type.xsd enumerates 78 codes from CATAIR Appendix C / Appendix B; commercial units separate from statistical units; code X = no quantity required.
  9. US states/territories: 59 codes (50 states + DC + 8 outlying/associated jurisdictions) from USPS Pub 28 / ANSI INCITS 38:2009.
  10. SPIs: HTSUS General Note 3(c); specialProgramType (maxLength 2). USMCA uses S/S+ (replaces NAFTA CA/MX).
  11. Carrier SCAC: NMFTA proprietary database, strict copyright/terms prohibiting unauthorized bundling; must return registry verification "unavailable" while validating format locally.
  12. USITC HTS: 10-digit tariff line (\d{5,10} in XSD); USITC REST API and bulk JSON/CSV exports; hierarchical candidate tree required.
- **Unexplored areas**: None. All 13 target domains and infrastructure requirements fully surveyed.

## Key Decisions Made
- All reference data claims mapped to exact schema types, legal regulations (19 CFR, HTSUS General Notes, 17 U.S.C. § 105), and authoritative publisher sources.
- Established bundling vs runtime API strategy for offline reproducibility and licensing compliance.

## Artifact Index
- DISPATCH.md — Parent instruction log
- BRIEFING.md — Working context and memory
- progress.md — Activity and heartbeat
- handoff.md — 5-Component dataset survey report
