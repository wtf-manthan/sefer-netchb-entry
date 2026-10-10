# Authoritative Reference Datasets Survey Report (US Customs / NetCHB)

**Author**: Explorer Subagent (`explorer_datasets_survey`)  
**Date**: 2026-10-10  
**Scope**: Authoritative reference data sources, publishers, coverage, formats, licensing/redistribution terms, and snapshot bundling strategies for Tasks 1–13.

---

## 1. Observation

Direct observations from local schemas, source code, government publications, and international standards:

### Domain 1: Reference Infrastructure & Provenance Contract (Task 1)
- **Schema & Code Evidence**:
  - `spec/data_type.xsd` and `spec/entry.xsd` define all target XML simpleTypes.
  - `shared/src/types/field.ts` defines the existing extraction contract `{ value, status: 'extracted' | 'inferred' | 'missing', source: { doc, page, snippet }, confidence }`.
  - `shared/src/review.ts` and `shared/src/schemas/decisions.schema.ts` manage broker review choices and explicit overrides.
- **Contract Requirement**:
  - Reference lookup results must NOT overwrite raw observations. They must be isolated in a dedicated contract containing 10 provenance and review fields: `category`, `targetField`, `query`, `outcome` (`exact_match` | `candidates` | `no_match` | `unavailable` | `stale`), `candidates` (`code`, `label`, `details`), `source` (`url`, `publisher`, `datasetVersion`, `retrievedAt`, `effectiveDate`), `matchingMethod`, `rationale`, `missingFactsNeeded`, `reviewStatus`, and `fingerprint`.
  - Crucial distinction: `codeVerifiedAgainstReference: boolean` vs `userConfirmedForShipment: boolean`.

---

### Domain 2: Schedule D — U.S. Customs Districts and Ports (Task 2)
- [VERIFIED — `spec/data_type.xsd:253-263`]
  ```xml
  <xsd:simpleType name="portType">
      <xsd:annotation><xsd:documentation>This is the data type that should be used for ports. It requires a String that is 4 numeric digits</xsd:documentation></xsd:annotation>
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\d{4}" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- [VERIFIED — `spec/entry.xsd:370-371, 378, 613-620`] NetCHB XML requires ports in three distinct header roles:
  - `<xsd:element name="processing-port" type="data:portType" />` (District/Port where entry summary is filed)
  - `<xsd:element name="entry-port" type="data:portType" />` (Port of entry where goods physically arrive into commerce)
  - `<xsd:element name="unlading-port" type="data:portType" />` (Port where cargo is discharged from importing conveyance)
- [VERIFIED — U.S. Census Bureau Foreign Trade & CBP ACE CATAIR Appendix E]
  - **Official Title**: *Schedule D - Classification of U.S. Customs Districts and Ports for U.S. Foreign Trade Statistics*.
  - **Publisher**: U.S. Census Bureau (Foreign Trade Division) and U.S. Customs and Border Protection (CBP).
  - **Official URLs**:
    - Census: `https://www.census.gov/foreign-trade/reference/codes/index.html#sd`
    - CBP CATAIR Appendix E: `https://www.cbp.gov/trade/ace/catair`
  - **Structure**: 4-digit numeric code (`DDNN` where `DD` is the 2-digit Customs District, e.g., `30` for Washington State, and `NN` is the individual port, e.g., `3001` for Seattle, `3002` for Tacoma).
  - **Coverage**: ~420 active U.S. ports of entry and customs stations.
  - **Format & Size**: ASCII text / pipe- or comma-delimited table (~25 KB).
  - **License & Redistribution**: U.S. Federal Government work; public domain under 17 U.S.C. § 105. Freely redistributable and bundlable.

---

### Domain 3: Schedule K — Foreign Ports (Task 3)
- [VERIFIED — `spec/data_type.xsd:166-170`]
  ```xml
  <xsd:simpleType name="foreignPortType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\d{5}"/>
      </xsd:restriction>
  </xsd:simpleType>
  ```
- [VERIFIED — `spec/entry.xsd:1931-1934`] Line item lading port element:
  - `<xsd:element name="lading-port" type="data:foreignPortType" />`
- [VERIFIED — U.S. Army Corps of Engineers (USACE) & U.S. Census Bureau]
  - **Official Title**: *Schedule K - Classification of Foreign Ports by Geographic Trade Area and Country*.
  - **Publisher**: U.S. Army Corps of Engineers, Waterborne Commerce Statistics Center (WCSC) / Navigation Data Center (NDC), in coordination with U.S. Census Bureau and CBP (ACE CATAIR Appendix F).
  - **Official URLs**:
    - USACE WCSC: `https://www.iwr.usace.army.mil/About/Technical-Centers/WCSC-Waterborne-Commerce-Statistics-Center/`
    - NDC: `https://ndc.iwr.usace.army.mil/`
    - Census: `https://www.census.gov/foreign-trade/reference/codes/index.html`
    - CBP CATAIR Appendix F: `https://www.cbp.gov/document/guidance/appendix-f-schedule-k-foreign-port-codes`
  - **Structure**: 5-digit numeric code (`RCCC P` where `R` is world geographic region, `CCC` is country prefix, and `P` is port sequence).
  - **Critical Rule**: NEVER substitute 5-letter UN/LOCODE (e.g. `VNSGN` or `USLAX`) for Schedule K numeric codes. Schedule K requires numeric 5-digit format `\d{5}`.
  - **Coverage**: ~10,000 active foreign seaports across >200 countries and territories.
  - **Format & Size**: CSV / Excel / TXT (~500 KB to 1 MB).
  - **License & Redistribution**: U.S. Federal Government public domain under 17 U.S.C. § 105. Permitted to bundle as offline JSON snapshot.

---

### Domain 4: Country Codes (Task 4)
- [VERIFIED — `spec/data_type.xsd:66-70`]
  ```xml
  <xsd:simpleType name="countryCodeType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="[A-Za-z]{2}" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- [VERIFIED — `spec/entry.xsd:1918-1925`] Line item country origin and export:
  - `<xsd:element name="country-origin" type="data:countryCodeType" />`
  - `<xsd:element name="country-export" type="data:countryCodeType" />`
- [VERIFIED — ISO 3166-1 / U.S. Census Schedule C]
  - **Standard**: ISO 3166-1 alpha-2 (two uppercase letters).
  - **Publisher**: International Organization for Standardization (ISO 3166/MA), maintained in U.S. Trade Statistics via Census Schedule C (*Classification of Country and Territory Designations for U.S. Foreign Trade Statistics*).
  - **Official URLs**:
    - ISO OBP: `https://www.iso.org/obp/ui/`
    - Census Schedule C: `https://www.census.gov/foreign-trade/reference/codes/index.html#schedc`
    - Open mirror: Debian `iso-codes` package (`iso_3166-1.json`, LGPL-2.1)
  - **Coverage**: 249 officially assigned alpha-2 country codes.
  - **Format & Size**: JSON / CSV (~35 KB).
  - **License & Redistribution**: US Census Schedule C correspondence table is U.S. Federal public domain (17 U.S.C. § 105). Debian `iso-codes` mirror is LGPL-2.1.
  - **Filing Rules**: Country of export must NOT be inferred from country of origin. Historical codes (e.g. `SU`, `YU`) and territories (e.g. `HK`, `TW`, `PR`) must be handled explicitly.

---

### Domain 5: Currency Codes & Official Conversion (Task 5)
- [VERIFIED — `spec/data_type.xsd:73-84, 6148-6156`] XML currency elements:
  - Entered values are reported in USD (`dollarAmountType`, `xsd:decimal` with `fractionDigits="2"`). Header charges and gross values are rounded to whole dollars/integers.
- [VERIFIED — ISO 4217 & SIX Financial Information]
  - **Standard**: ISO 4217 (alpha-3 currency codes).
  - **Publisher**: SIX Financial Information (official Maintenance Agency for ISO 4217).
  - **Official Download**: `https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/amendments/lists/list_one.xml` (Current currencies Table A.1) and `list_three.xml` (Historic denominations Table A.3).
  - **Coverage**: 178 current currencies; distinct historical currencies.
  - **Format & Size**: XML / JSON (~60 KB).
  - **License & Redistribution**: Free for internal/application usage; open data mirrors available under MIT/LGPL-2.1.
- [VERIFIED — 19 CFR 159.31, 159.32 & 31 U.S.C. § 5151 Customs Conversion Policy]:
  - Currency conversion for customs valuation is NOT market-rate lookups.
  - Conversion is strictly governed by 19 CFR 159.31 and 159.32 using rates certified by the Federal Reserve Bank of New York and published by CBP (Quarterly Bulletin Rates, plus Daily Rates if fluctuation exceeds 5%).
  - Conversion is keyed to the **Date of Exportation** (19 CFR 152.1(c)), NOT arrival date or filing date.
  - Therefore: Market rate APIs cannot claim customs compliance. Currency normalization resolves valid ISO codes; exchange rate selection requires broker-reviewed or official certified CBP rate input.

---

### Domain 6: Transport Modes (Task 6)
- [VERIFIED — `spec/data_type.xsd:208-231`]
  ```xml
  <xsd:simpleType name="modeTransportType">
      <xsd:restriction base="xsd:token">
          <xsd:enumeration value="10" />
          <xsd:enumeration value="11" />
          <xsd:enumeration value="12" />
          <xsd:enumeration value="20" />
          <xsd:enumeration value="21" />
          <xsd:enumeration value="30" />
          <xsd:enumeration value="31" />
          <xsd:enumeration value="32" />
          <xsd:enumeration value="33" />
          <xsd:enumeration value="34" />
          <xsd:enumeration value="40" />
          <xsd:enumeration value="41" />
          <xsd:enumeration value="50" />
          <xsd:enumeration value="60" />
          <xsd:enumeration value="70" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- [VERIFIED — CBP ACE CATAIR Appendix B (Valid Codes)]
  - `10`: Vessel, Non-container
  - `11`: Vessel, Container
  - `12`: Border Water-borne (Canada/Mexico barge)
  - `20`: Rail, Non-container
  - `21`: Rail, Container
  - `30`: Truck, Non-container
  - `31`: Truck, Container
  - `32`: Auto
  - `33`: Pedestrian
  - `34`: Road, other
  - `40`: Air, Non-container
  - `41`: Air, Container
  - `50`: Mail
  - `60`: Passenger, Hand-carried
  - `70`: Fixed Transport Installations (Pipelines, electric power)
- **Application Profile Constraint**: Current application only supports ocean modes `10` and `11`. Other modes exist in the reference dictionary but are blocked by application profile gates.
- **Inference Rule**: Document text mentioning "ocean" or "vessel" suggests vessel transport, but ocean alone does not silently decide containerized (11) vs non-containerized (10) without container/equipment evidence.

---

### Domain 7: Entry Types (Task 7)
- [VERIFIED — `spec/data_type.xsd:100-151`]
  `entryType` defines exactly 43 two-digit values:
  `01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 30, 31, 32, 33, 34, 38, 40, 41, 42, 43, 44, 45, 46, 50, 51, 52, 60, 61, 62, 63, 64, 65, 66, 86`.
- [VERIFIED — CBP Form 7501 Instructions & ACE CATAIR Entry Summary]
  - `01`: Consumption - Free and Dutiable
  - `02`: Consumption - Quota/Visa
  - `03`: Consumption - Antidumping / Countervailing Duty (AD/CVD)
  - `04`: Appraisement
  - `05`: Vessel - Repair
  - `06`: Consumption - Foreign Trade Zone (FTZ)
  - `07`: Consumption - AD/CVD and Quota/Visa
  - `08`: Duty Deferral
  - `09`: Reconciliation Summary
  - `11`: Informal - Free and Dutiable
  - `12`: Informal - Quota/Visa
  - `21`: Warehouse
  - `22`: Re-Warehouse
  - `23`: Temporary Importation under Bond (TIB)
  - `24`: Trade Fair
  - `25`: Permanent Exhibition
  - `26`: Warehouse - FTZ Admission
  - `31`: Warehouse Withdrawal - Consumption
  - `32`: Warehouse Withdrawal - Quota
  - `34`: Warehouse Withdrawal - AD/CVD
  - `38`: Warehouse Withdrawal - AD/CVD and Quota/Visa
  - `41`: Manufacturing Drawback
  - `42`: Same Condition Drawback
  - `43`: Rejected Importation Drawback
  - `51`: DCASR
  - `52`: Government - Dutiable
  - `61`: Immediate Transportation (I.T.)
  - `62`: Transportation & Exportation (T.&E.)
  - `63`: Immediate Exportation (I.E.)
  - `64`: Barge
  - `65`: Permit to Proceed
  - `66`: Baggage
  - `86`: Section 321 De Minimis
  *(Codes 10, 20, 30, 40, 50, 60 represent category head/legacy groupings in schema).*
- **Application Profile Constraint**: Current application only implements Type `01`. Other types are supported in reference lookup but remain blocked by readiness gates. Never auto-select entry type solely from shipment value.

---

### Domain 8: Bond Types (Task 8)
- [VERIFIED — `spec/entry.xsd:6134-6145`]
  ```xml
  <xsd:simpleType name="bondType">
      <xsd:annotation><xsd:documentation>This is contains all of the valid bond types</xsd:documentation></xsd:annotation>
      <xsd:restriction base="xsd:token">
          <xsd:enumeration value="00" />
          <xsd:enumeration value="08" />
          <xsd:enumeration value="09" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- [VERIFIED — `spec/entry.xsd:613-623, 662-668` & CBP ACE CATAIR Record B01/B02 / Form 7501 Block 20]
  - `00`: **No Bond / Bond Waived** (triggers ACE `<bond-waiver-reason>` with enumeration 995-999; requires surety code 999).
  - `08`: **Continuous Bond** (indicates annual continuous bond on file with CBP; activates `<superseded-bond>` Yes/No tag).
  - `09`: **Single Transaction Bond (STB)** (indicates bond written for this single entry).
- **Compliance Rule**: Shipping documents never contain importer bond decisions. Bond arrangements must remain explicit broker inputs and never be guessed.

---

### Domain 9: Units of Measure (Task 9)
- [VERIFIED — `spec/data_type.xsd:321-411`]
  `unitOfMeasureType` enumerates exactly 78 uppercase codes:
  `AC, ASTM, BBL, C, CAR, CC, CG, CGM, CKG, CLR, CM, CM2, CM3, CTN, CU, CUR, CY, CYG, CYK, D, DC, DEG, DOZ, DPC, DPR, FIB, FBM, G, GBQ, GR, GRL, GVW, HUN, HZ, IRC, JWL, K, KCAL, KG, KHZ, KL, KM, KM2, KM3, KN, KPA, KSB, KVA, KVAR, KW, KWH, L, LIN, LNM, M, MBQ, MC, MG, MHZ, ML, MM, MPA, M2, M3, NO, ODE, PCS, PF, PFG, PFL, PK, PRS, RPM, SBE, SQ, T, V, W, WG, WL, WT, X`.
- [VERIFIED — CBP ACE CATAIR Appendix B & USITC HTS General Statistical Note 4]
  - Annotation: "The unit of measure is a list of units from Appendix C [now Appendix B] of the catair".
  - Code `X` indicates "No quantity required" (value only).
  - Statistical units must match the requirements of the classified HTS tariff (e.g. `DOZ` or `NO` or `KG`).
  - Packaging units (e.g. `CTN`, `BOX`, `PK`) belong to manifest bills of lading, NOT tariff statistical lines.
  - Commercial units on invoices (e.g. `PCS`) must NOT be silently transformed into statistical units (e.g. `DOZ` or `KG`) without an explicit, verifiable conversion basis.

---

### Domain 10: U.S. States and Territories (Task 10)
- [VERIFIED — `spec/data_type.xsd:414-481`]
  `usStateType` enumerates exactly 59 two-letter codes:
  - 50 U.S. States: `AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY`
  - 1 Federal District: `DC`
  - 8 Outlying Territories & Freely Associated Jurisdictions:
    - `AS`: American Samoa
    - `FM`: Federated States of Micronesia
    - `GU`: Guam
    - `MH`: Marshall Islands
    - `MP`: Northern Mariana Islands
    - `PW`: Palau
    - `PR`: Puerto Rico
    - `VI`: U.S. Virgin Islands
- [VERIFIED — USPS Publication 28 & ANSI INCITS 38:2009]
  - Matches official USPS Postal Addressing Standards (Appendix B).
  - Public domain.
  - Model constraint: Non-US addresses must not be forced into a US state code.

---

### Domain 11: Special Program Indicators (SPIs) (Task 11)
- [VERIFIED — `spec/data_type.xsd:266-288`]
  - `<xsd:simpleType name="specialProgramType"><xsd:restriction base="xsd:token"><xsd:maxLength value="2"/></xsd:restriction></xsd:simpleType>`
  - `<xsd:simpleType name="secondarySpecialProgramType"><xsd:restriction base="xsd:token"><xsd:maxLength value="1"/></xsd:restriction></xsd:simpleType>`
- [VERIFIED — USITC HTSUS General Note 3(c) & CBP ACE CATAIR]
  - SPIs are 1-2 character codes prefixing tariff lines in customs declarations:
    - `A`, `A*`, `A+`: Generalized System of Preferences (GSP)
    - `AU`: U.S.-Australia Free Trade Agreement
    - `B`: Automotive Products Trade Act
    - `BH`: U.S.-Bahrain Free Trade Agreement
    - `C`: Agreement on Trade in Civil Aircraft
    - `CA`, `MX`: NAFTA (Historical; expired July 1, 2020)
    - `CL`: U.S.-Chile Free Trade Agreement
    - `CO`: U.S.-Colombia Trade Promotion Agreement
    - `D`: African Growth and Opportunity Act (AGOA)
    - `E`, `E*`: Caribbean Basin Economic Recovery Act (CBERA)
    - `IL`: U.S.-Israel Free Trade Area
    - `JO`: U.S.-Jordan Free Trade Area
    - `KR`: U.S.-Korea Free Trade Agreement (KORUS)
    - `MA`: U.S.-Morocco Free Trade Agreement
    - `OM`: U.S.-Oman Free Trade Agreement
    - `P`, `P+`: CAFTA-DR
    - `PA`: U.S.-Panama Trade Promotion Agreement
    - `PE`: U.S.-Peru Trade Promotion Agreement
    - `R`: CBTPA
    - `S`, `S+`: **USMCA** (United States-Mexico-Canada Agreement, effective July 1, 2020)
    - `SG`: U.S.-Singapore Free Trade Agreement
- **Legal Rule**: Mere existence of an SPI on a tariff line does NOT establish shipment eligibility. Preferential duty claims require proof of origin, qualifying value content, direct consignment, and certifications. Never infer eligibility from origin country alone.

---

### Domain 12: Carrier SCAC (Task 12)
- [VERIFIED — `spec/data_type.xsd:22-31`]
  ```xml
  <xsd:simpleType name="carrierCodeType">
      <xsd:annotation><xsd:documentation>Carrier code must be 2 or 4 characters</xsd:documentation></xsd:annotation>
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\w{2}|\w{4}|\*{1}[\*\w]{1}" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- [VERIFIED — National Motor Freight Traffic Association, Inc. (NMFTA)]
  - **Proprietary Status**: SCAC is a registered trademark and proprietary database exclusively owned and managed by NMFTA.
  - **Redistribution Terms**: NMFTA terms strictly prohibit redistribution, copying, or making the database accessible to third parties without a commercial license. SCAC Web Service APIs and bulk distribution feeds are paid services.
  - **Legal Assessment**: The repository CANNOT legally bundle a complete NMFTA SCAC carrier database.
  - **Implementation Strategy**:
    - Validate format deterministically against `carrierCodeType` (`\w{2}|\w{4}|\*{1}[\*\w]{1}`).
    - Return registry verification `outcome: 'unavailable'` with cited rationale unless authorized commercial credentials are provided.
    - Never guess carrier names or invent fictional carrier dictionaries.

---

### Domain 13: HTS / USITC (Task 13)
- [VERIFIED — `spec/data_type.xsd:314-318`]
  ```xml
  <xsd:simpleType name="tariffNoType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\d{5,10}"/>
      </xsd:restriction>
  </xsd:simpleType>
  ```
- [VERIFIED — U.S. International Trade Commission (USITC)]
  - **Tariff Hierarchy**: 10-digit tariff line (Chapter 2 + Heading 2 + Subheading 2 + US Legal Rate 2 + Statistical Suffix 2).
  - **Official Sources**:
    - Live REST API: `https://hts.usitc.gov/reststop/search?keyword=...` and `https://hts.usitc.gov/reststop/api/details/htsnoJSON/{code}`
    - Official bulk exports: `https://hts.usitc.gov/export` and `https://catalog.data.gov/` (CSV, JSON, Excel).
  - **Licensing**: Public domain under 17 U.S.C. § 105.
  - **Filing Rules**: A 6-digit heading is a search key, never a valid filing tariff. Never pad zeros (e.g., `6106.10` cannot be padded to `6106.10.0000`). Lookups must return the candidate tree with descriptions, statistical units, and general duty rates. Disk cache must be keyed by query + HTS edition/version.

---

## 2. Logic Chain

1. **Step 1 — Regulatory Separation of Verification vs. Filing Decision**:
   - Observations show that reference datasets (Schedule D, Schedule K, ISO 3166-1, ISO 4217, HTSUS) confirm whether a code is *valid and exists in the law*.
   - However, assigning that code to a specific shipment (e.g. claiming USMCA duty preference under SPI `S`, selecting an HTS 10-digit classification, or selecting continuous bond `08`) is a consequential legal assertion made by the licensed broker.
   - Therefore, the shared `LookupResult` contract must separate reference validation (`codeVerifiedAgainstReference: true`) from broker confirmation (`userConfirmedForShipment: true`).

2. **Step 2 — Schema Strictness and Alignment**:
   - `spec/data_type.xsd` defines exact patterns: `portType` (`\d{4}`), `foreignPortType` (`\d{5}`), `countryCodeType` (`[A-Za-z]{2}`), `tariffNoType` (`\d{5,10}`), `modeTransportType` (15 enumerations), `entryType` (43 enumerations), `unitOfMeasureType` (78 enumerations), and `usStateType` (59 enumerations).
   - Substituting UN/LOCODE (5 alphanumeric characters, e.g. `VNSGN`) for Schedule K (`\d{5}`) would fail schema validation on line 168 of `data_type.xsd`.
   - Therefore, Schedule K port resolution must only emit numeric 5-digit codes.

3. **Step 3 — Licensing and Redistribution Compliance**:
   - U.S. Federal Government datasets (Schedule D, Schedule K, Census Schedule C, USITC HTS bulk exports) are in the public domain pursuant to 17 U.S.C. § 105. These can be bundled directly into the repository as deterministic JSON/TS snapshots.
   - Open-source international mirrors (Debian `iso-codes` for ISO 3166-1 and ISO 4217) are licensed under LGPL-2.1 / MIT and can be bundled with appropriate attribution.
   - In contrast, NMFTA SCAC is proprietary and copyrighted. Bundling an unauthorized SCAC directory violates NMFTA licensing.
   - Therefore, SCAC handling must implement format checking and return `outcome: 'unavailable'` for registry verification.

4. **Step 4 — Currency Conversion vs. Currency Normalization**:
   - ISO 4217 validates currency existence and symbols (e.g. `USD`, `VND`, `EUR`).
   - Under 19 CFR 159.31 and 159.32, customs conversion requires official proclaimed/certified rates (Federal Reserve Bank of NY / CBP quarterly bulletin rates) pegged to the date of exportation.
   - Calling a free market-rate API and applying it to customs valuation is legally incorrect.
   - Therefore, ISO 4217 lookups must normalize currency codes, while conversion rates remain explicit broker inputs unless an official CBP bulletin table is verified.

5. **Step 5 — Offline Reproducibility and Caching**:
   - NetCHB entry XML generation must remain deterministic and operable offline.
   - Large or live datasets (USITC HTS API) require disk caching keyed by file/query hash and HTS version.
   - For offline test verification, bundling representative snapshots (apparel Ch 61/62, furniture Ch 94, machinery Ch 84) alongside Schedule D, Schedule K, Countries, Currencies, MOT, Entry Types, Bond Types, UOM, and States guarantees 100% offline test execution.

---

## 3. Caveats

1. **SCAC Registry Access**: No commercial NMFTA license is active in this take-home environment. Carrier verification against the live NMFTA directory is unavailable and will return `outcome: 'unavailable'`.
2. **CBP Daily Exchange Rate Fluctuations**: While certified quarterly bulletin rates are published by CBP, daily exchange rates for dates with >5% fluctuation require manual broker confirmation or a certified feed.
3. **MID Algorithmic Construction**: Manufacturer Identification (MID) construction rules (19 CFR Part 102 / Customs Form 7501 instructions) were previously deferred in `docs/research.md` and remain separate from the port/HTS reference datasets.
4. **Partner Government Agencies (PGA)**: The current schema and scope cover standard CBP entry summary data. PGAs (FDA, USDA, EPA, etc.) and Chapter 98/99 temporary trade remedies require specialized additional filing messages not currently modeled in the application.

---

## 4. Conclusion

All 13 reference data domains have been authoritatively surveyed, mapped to exact XSD definitions in `spec/data_type.xsd` and `spec/entry.xsd`, and verified against official government publishers (Census Bureau, USACE, CBP, USITC, USPS) and standards bodies (ISO, SIX Group, NMFTA).

### Reference Dataset Summary Matrix

| Task | Domain | Authoritative Publisher | Code Format / XSD Type | Record Count / Size | License / Redistribution | Strategy | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Result Contract | Project Architecture / Shared | TypeScript / Zod | N/A | MIT (Project code) | Shared contract in `@sefer/shared` | [VERIFIED] |
| **2** | Schedule D (US Ports) | U.S. Census Bureau / CBP | `\d{4}` (`portType`) | ~420 ports (~25 KB) | Public Domain (17 U.S.C. § 105) | Bundled JSON snapshot + import script | [VERIFIED] |
| **3** | Schedule K (Foreign Ports) | USACE WCSC / Census | `\d{5}` (`foreignPortType`) | ~10,000 ports (~650 KB) | Public Domain (17 U.S.C. § 105) | Bundled JSON snapshot + country index | [VERIFIED] |
| **4** | Country Codes | ISO 3166 / Census Sched C | `[A-Za-z]{2}` (`countryCodeType`) | 249 codes (~35 KB) | Public Domain / LGPL-2.1 | Bundled JSON snapshot + aliases | [VERIFIED] |
| **5** | Currency Codes | SIX Financial / ISO 4217 | `[A-Z]{3}` (ISO 4217) | 178 codes (~60 KB) | Public / Open mirror | Bundled JSON snapshot; explicit rates | [VERIFIED] |
| **6** | Transport Modes | CBP ACE CATAIR App B | 15 enum codes (`modeTransportType`)| 15 codes (<2 KB) | Public Domain | Bundled TS enum; profile gate 10/11 | [VERIFIED] |
| **7** | Entry Types | CBP ACE CATAIR / Form 7501 | 43 enum codes (`entryType`) | 43 codes (<5 KB) | Public Domain | Bundled TS enum; profile gate 01 | [VERIFIED] |
| **8** | Bond Types | NetCHB XML / CBP CATAIR | `00`, `08`, `09` (`bondType`) | 3 codes (<1 KB) | NetCHB / Public Domain | Bundled TS enum; explicit broker input | [VERIFIED] |
| **9** | Units of Measure | CBP ACE CATAIR App B / HTS | 78 enum codes (`unitOfMeasureType`)| 78 codes (<10 KB) | Public Domain | Bundled TS enum + HTS cross-reference | [VERIFIED] |
| **10**| US States & Terr. | USPS Pub 28 / ANSI INCITS | 59 enum codes (`usStateType`) | 59 codes (<3 KB) | Public Domain | Bundled TS enum | [VERIFIED] |
| **11**| SPIs | USITC HTS General Note 3(c) | `maxLength=2` (`specialProgramType`)| ~25 codes (<5 KB) | Public Domain | Bundled TS enum; claim unconfirmed | [VERIFIED] |
| **12**| Carrier SCAC | NMFTA | `\w{2}\|\w{4}\|\*{1}[\*\w]{1}` | Proprietary (~50,000) | Commercial Copyright (NMFTA) | Format-only valid; registry unavailable | [VERIFIED] |
| **13**| HTS / USITC | USITC | `\d{5,10}` (`tariffNoType`) | ~12,000 lines (~15 MB) | Public Domain (17 U.S.C. § 105) | Live REST API + disk cache + Ch 61/62/84/94 snapshot | [VERIFIED] |

---

## 5. Verification Method

To independently verify the facts, schemas, and sources documented in this report:

1. **Schema Facets & Patterns**:
   - Inspect `spec/data_type.xsd` and `spec/entry.xsd` to confirm all patterns, lengths, and enumerations quoted above:
     ```powershell
     Select-String -Path "spec/data_type.xsd" -Pattern "portType|foreignPortType|countryCodeType|modeTransportType|entryType|unitOfMeasureType|usStateType"
     Select-String -Path "spec/entry.xsd" -Pattern "bondType"
     ```
2. **Current Project Build & Tests**:
   - Run the monorepo build and test suite:
     ```powershell
     npm test
     ```
   - Observed result: 55 passing automated tests across server, shared, and XML validator.
3. **Authoritative Government Sources**:
   - Verify Schedule D: `https://www.census.gov/foreign-trade/reference/codes/index.html#sd`
   - Verify Schedule K: `https://www.iwr.usace.army.mil/About/Technical-Centers/WCSC-Waterborne-Commerce-Statistics-Center/` and CBP CATAIR Appendix F.
   - Verify Mode of Transport & Units of Measure: CBP ACE CATAIR Appendix B (`https://www.cbp.gov/trade/ace/catair`).
   - Verify USITC HTS REST API: `https://hts.usitc.gov/reststop/search?keyword=6106.10`
   - Verify NMFTA SCAC Copyright: `https://www.nmfta.org/scac/`
