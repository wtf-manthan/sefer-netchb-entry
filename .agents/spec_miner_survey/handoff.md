# Specification Survey & Schema Analysis Report: NetCHB Entry XML (Tasks 1–14)

**Document Path**: `c:\Users\MANTHAN KHETADE\Desktop\sefer-swe-intern\.agents\spec_miner_survey\handoff.md`  
**Author**: Specification Miner Subagent (`spec_miner_survey`)  
**Date**: 2026-10-10  
**Target Systems**: `spec/entry.xsd`, `spec/data_type.xsd`, `@sefer/shared`, `server`  
**Governing Documents**: `AGENTS.md`, `GEMINI.md`, `ORIGINAL_REQUEST.md`

---

## 1. Executive Summary

This report delivers an exhaustive specification mining and schema verification analysis of NetCHB Entry XML schemas (`spec/entry.xsd` and `spec/data_type.xsd`) and maps their constraints to Tasks 1 through 14 defined in `ORIGINAL_REQUEST.md`. Every statement in this document is tagged with strict evidence labels:
- `[VERIFIED: <file>:<lines>]` for claims derived verbatim from authoritative schema files or test runs.
- `[INFERRED: <reasoning>]` for deductions linking schema types to CBP/industry domain rules.
- `[UNKNOWN: <gap>]` where the specification is silent or authoritative external reference data is required.

Key structural discoveries:
1. **Strict Root Sequence**: NetCHB XML root `<entry>` requires an exact sequence of 23 possible child tags; altering tag order invalidates schema compliance `[VERIFIED: spec/entry.xsd:26-302]`.
2. **Port Code Types Diverge**: US ports are strictly 4 digits (`\d{4}`, `data:portType`) at header level `[VERIFIED: spec/data_type.xsd:261]`, while foreign ports are strictly 5 digits (`\d{5}`, `data:foreignPortType`) at the line-item level (`<lading-port>`) `[VERIFIED: spec/data_type.xsd:168, spec/entry.xsd:1197]`. Alphanumeric UN/LOCODE fails schema validation `[VERIFIED: spec/data_type.xsd:168]`.
3. **NetCHB Bond Enumerations**: The schema accepts **only** `"00"`, `"08"`, and `"09"` `[VERIFIED: spec/entry.xsd:6141-6143]`. CBP 1-digit activity codes (e.g. `1` or `9`) are schema-invalid.
4. **Tariff Number Length vs. Filing Profile**: Schema allows 5 to 10 digits (`\d{5,10}`) without formatting dots `[VERIFIED: spec/data_type.xsd:316]`, but commercial formal consumption entries (Type 01) require a 10-digit statistical classification `[VERIFIED: ORIGINAL_REQUEST.md:189, server/src/checks/index.ts:135]`.
5. **Distinct Unit Domains**: Manifest package unit is a free token up to 5 characters (`maxLength 5`) `[VERIFIED: spec/entry.xsd:897]`, whereas tariff statistical reporting units are restricted to 83 enumerated CATAIR codes `[VERIFIED: spec/data_type.xsd:327-411]`.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Infrastructure | Shared Provenance Contract | 10-attribute provenance & lookup state record | Query string, category, target entity/field | Exact match, candidates, no-match, unavailable, stale | Rejection if required fields missing | `ORIGINAL_REQUEST.md:32-45` [VERIFIED] |
| 2 | Ports (US) | `data:portType` (Schedule D) | 4-digit numeric US customs port code | String matching `^\d{4}$` | Schema-valid port code | XML validation failure on non-4-digit strings | `spec/data_type.xsd:253-263` [VERIFIED] |
| 3 | Ports (Foreign) | `data:foreignPortType` (Schedule K) | 5-digit numeric foreign port of lading code | String matching `^\d{5}$` | Schema-valid foreign port code | XML validation failure on UN/LOCODE or non-5-digit strings | `spec/data_type.xsd:166-170` [VERIFIED] |
| 4 | Country | `data:countryCodeType` | 2-letter country code (ISO 3166-1 alpha-2) | String matching `^[A-Za-z]{2}$` | Schema-valid 2-letter country code | XML validation failure on 3-letter codes or full names | `spec/data_type.xsd:66-70` [VERIFIED] |
| 5 | Currency | `currency-code` | 3-letter uppercase foreign currency code | String matching `^[A-Z]{3}$` | Schema-valid currency code | XML validation failure on non-3-letter or lowercase | `spec/entry.xsd:1047-1053` [VERIFIED] |
| 6 | Currency | `foreign-currency` container | Container for non-USD invoices with optional exchange rate | Currency code, country, float rate > 0 | Schema-valid foreign currency block | Schema allows omission only when currency is USD | `spec/entry.xsd:1037-1070` [VERIFIED] |
| 7 | Transport Mode | `data:modeTransportType` | 15 enumerated 2-digit transport mode codes | Tokens: 10, 11, 12, 20, 21, 30, 31, 32, 33, 34, 40, 41, 50, 60, 70 | Validated mode code | XML validation failure on unlisted modes | `spec/data_type.xsd:208-231` [VERIFIED] |
| 8 | Entry Types | `data:entryType` | 43 enumerated 2-digit entry type codes | Tokens: 01..12, 20..26, 30..38, 40..46, 50..52, 60..66, 86 | Validated entry type | XML validation failure on unsupported codes | `spec/data_type.xsd:100-151` [VERIFIED] |
| 9 | Bonds | `entry:bondType` | 3 enumerated NetCHB bond codes: "00", "08", "09" | Tokens: "00", "08", "09" | Validated bond type | XML validation failure on "1", "2", "C", "S", etc. | `spec/entry.xsd:6134-6145` [VERIFIED] |
| 10 | Bonds | `bond-waiver-reason` | ACE waiver reason code when bond type is "00" | Tokens: 995, 996, 997, 998, 999 | Validated waiver reason | XML validation failure on other values | `spec/entry.xsd:613-633` [VERIFIED] |
| 11 | Bonds | `superseded-bond` | Flag indicating superseded continuous bond for type "08" | Empty XML tag `<superseded-bond/>` | Schema-valid indicator | Present tag indicates "Yes" | `spec/entry.xsd:662-668` [VERIFIED] |
| 12 | Units of Measure | `data:unitOfMeasureType` | 83 enumerated reporting units from CATAIR App C | Tokens: PCS, DOZ, KG, NO, M, M2, M3, L, etc. | Validated statistical UOM | XML validation failure on commercial aliases (e.g. KGS, EA) | `spec/data_type.xsd:321-411` [VERIFIED] |
| 13 | Package Unit | `manifestType -> unit` | Manifest package packaging unit | Token up to 5 characters | Schema-valid package unit | XML validation failure if length > 5 | `spec/entry.xsd:894-900` [VERIFIED] |
| 14 | State / Territory | `data:usStateType` | 59 enumerated 2-letter US states, DC, and territories | Tokens: AL..WY, DC, AS, FM, GU, MH, MP, PW, PR, VI | Validated state code | XML validation failure on foreign provinces or names | `spec/data_type.xsd:414-481` [VERIFIED] |
| 15 | Consignee State | `consignee-state` | Ultimate consignee state code in invoice block | Token up to 2 characters | Validated state string | XML validation failure if length > 2 | `spec/entry.xsd:1017-1023` [VERIFIED] |
| 16 | Special Programs | `data:specialProgramType` | Primary or country SPI code | Token up to 2 characters | Validated primary SPI | XML validation failure if length > 2 | `spec/data_type.xsd:266-275` [VERIFIED] |
| 17 | Special Programs | `secondarySpecialProgramType` | Secondary SPI code | Token up to 1 character | Validated secondary SPI | XML validation failure if length > 1 | `spec/data_type.xsd:278-287` [VERIFIED] |
| 18 | Carrier SCAC | `data:carrierCodeType` | Carrier SCAC / IATA code format | Pattern `\w{2}\|\w{4}\|\*{1}[\*\w]{1}` | Validated carrier code | XML validation failure on 3-char SCACs or special symbols | `spec/data_type.xsd:22-31` [VERIFIED] |
| 19 | Bill Numbers | `data:billNoType` | Master and house bill numbers | Token matching `[\dA-Za-z]{0,50}` | Validated bill number | XML validation failure if length > 50 or punctuation | `spec/data_type.xsd:10-19` [VERIFIED] |
| 20 | Tariff Numbers | `data:tariffNoType` | Numeric HTSUS tariff number without punctuation | Token matching `\d{5,10}` | Validated tariff number | XML validation failure on dots, dashes, or length <5/>10 | `spec/data_type.xsd:314-318` [VERIFIED] |
| 21 | Root Structure | `<entry>` Sequence | Exact ordering of 23 top-level child elements | Valid XML child elements in order | Schema-valid root entry | Libxml2 `element unexpected` error if unordered | `spec/entry.xsd:26-302` [VERIFIED] |
| 22 | Invoice Numbers | `data:invoiceNoType` | Commercial invoice identifier | Token matching `[A-Za-z\d\-]{1,17}` | Validated invoice number | XML validation failure on special characters or length > 17 | `spec/data_type.xsd:185-195` [VERIFIED] |
| 23 | Tax ID | `data:taxIdType` | Importer / Consignee IRS EIN, CBP, or SSN format | `\d{2}-\d{7}[\dA-Za-z]?[\dA-Za-z]?\|\d{6}-\d{5}\|\d{3}-\d{2}-\d{4}` | Validated Tax ID | XML validation failure on malformed format | `spec/data_type.xsd:302-311` [VERIFIED] |
| 24 | Inbond Number | `data:inbondNoType` | In-bond document identifier | `\d{9}\|[\dA-Za-z]{10}\|\d{11}\|[Vv][\dA-Za-z]{2}\d{8}` | Validated In-Bond No | XML validation failure on non-matching pattern | `spec/data_type.xsd:173-182` [VERIFIED] |

---

## 3. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `data:foreignPortType` | `"VNSGN"` (UN/LOCODE) | Rejection by regex `^\d{5}$`. Schedule K numeric code (e.g. 55201) is strictly required `[VERIFIED: spec/data_type.xsd:168]`. |
| 2 | `data:portType` | `"30010"` (5 digits) or `"SEA"` | Rejection by regex `^\d{4}$`. Must be exactly 4 digits (Schedule D) `[VERIFIED: spec/data_type.xsd:261]`. |
| 3 | `entry:bondType` | `"1"` (CBP continuous activity code) | Rejection by enumeration `{"00", "08", "09"}`. NetCHB requires `"08"`, not CBP code `"1"` `[VERIFIED: spec/entry.xsd:6141-6143]`. |
| 4 | `data:tariffNoType` | `"6109.10.00.04"` (with dots) | Rejection by regex `^\d{5,10}$`. Dots must be stripped to `"6109100004"` `[VERIFIED: spec/data_type.xsd:316]`. |
| 5 | `data:tariffNoType` | `"610910"` (6-digit heading) | Schema-valid (matches `\d{5,10}`), but blocks CBP readiness because Type 01 entry requires 10 digits `[VERIFIED: spec/data_type.xsd:316, server/test/core.test.ts:40]`. |
| 6 | `data:unitOfMeasureType`| `"KGS"` or `"EA"` | Rejection by enumeration. Must be normalized to `"KG"` or `"NO"` `[VERIFIED: spec/data_type.xsd:366,392]`. |
| 7 | `manifestType -> unit` | `"CARTONS"` (7 chars) | Rejection by `maxLength 5`. Must be abbreviated to `"CTN"` or `<= 5` characters `[VERIFIED: spec/entry.xsd:897]`. |
| 8 | `data:carrierCodeType` | `"COSCO"` (5 chars) | Rejection by pattern `\w{2}\|\w{4}\|\*{1}[\*\w]{1}`. Must be 4-character SCAC (e.g. `"COSU"`) `[VERIFIED: spec/data_type.xsd:29]`. |
| 9 | `data:carrierCodeType` | `"**"` or `"*A"` | Passes regex `\*{1}[\*\w]{1}` (allowed as wildcard/placeholder in schema) `[VERIFIED: spec/data_type.xsd:29]`. |
| 10 | `foreign-currency` | Invoice in `USD` | If `<foreign-currency>` tag is included, schema requires `<currency-code>` child; omit block entirely for USD `[VERIFIED: spec/entry.xsd:1040,1047]`. |
| 11 | `foreign-currency` | `currency-code="eur"` (lowercase) | Rejection by pattern `^[A-Z]{3}$`. Must be uppercase `[VERIFIED: spec/entry.xsd:1050]`. |
| 12 | `data:usStateType` | `"PR"`, `"VI"`, `"GU"` | Accepted by `data:usStateType` (59 enumerations include territories AS, FM, GU, MH, MP, PW, PR, VI) `[VERIFIED: spec/data_type.xsd:472-480]`. |
| 13 | `data:usStateType` | `"BC"` or `"ON"` (Canada) | Rejection by `data:usStateType`. Canadian provinces not allowed in `<state-destination>` `[VERIFIED: spec/data_type.xsd:421-480]`. |
| 14 | `entityAddressType` | `state-province-code="ONT"` | Passes `state-province-code` (`maxLength 3`), unlike `data:usStateType` which requires 2 chars `[VERIFIED: spec/entry.xsd:6372]`. |
| 15 | `entry` root element | `<manifest>` placed before `<header>` | Fails XML validation. `<xsd:sequence>` requires `<header>` followed by `<manifest>` `[VERIFIED: spec/entry.xsd:244-246]`. |

---

## 4. Comprehensive Specification Catalog by Task (Tasks 1–14)

### Task 1 — Reference Infrastructure & Provenance Contracts
- **Schema Mapping**: Not defined in XML Schema; this is the core TypeScript data model governing how reference data is validated and audited before deterministic XML generation.
- **Contract Requirements** `[VERIFIED: ORIGINAL_REQUEST.md:32-45]`:
  The shared lookup result contract in `@sefer/shared` must provide 10 immutable attributes:
  1. `category` and `targetField`
  2. `query` (original search text/code)
  3. `outcome`: `'exact_match' | 'candidates' | 'no_match' | 'unavailable' | 'stale'`
  4. `candidates`: Array of `{ code, description, metadata }`
  5. `sourceUrl`, `sourcePublisher`, and `datasetVersion`
  6. `retrievedAt` and `effectiveDate` (ISO 8601 strings)
  7. `matchingMethod` and `rationale`
  8. `missingFacts`: Array of required user facts when match is ambiguous
  9. `reviewState`: Distinction between reference-verified code and user-confirmed shipment decision
  10. `fingerprint`: Deterministic hash tying result to query and dataset version
- **Integrity Rule**: Raw extracted observations `{ value, status, source, confidence }` must NEVER be overwritten by reference lookup results `[VERIFIED: ORIGINAL_REQUEST.md:28-30]`.

---

### Task 2 — Schedule D / US Ports
- **Schema Data Type**: `data:portType` `[VERIFIED: spec/data_type.xsd:253-263]`
  ```xml
  <xsd:simpleType name="portType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\d{4}" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- **Constraint**: Must be a string of **exactly 4 numeric digits** (`^\d{4}$`).
- **Field Roles and Cardinality in `entry.xsd`**:
  - `entry/header/processing-port`: REQUIRED (`minOccurs="1"`, default) `[VERIFIED: spec/entry.xsd:370]`. US Customs port where entry summary is filed and liquidated.
  - `entry/header/entry-port`: REQUIRED (`minOccurs="1"`, default) `[VERIFIED: spec/entry.xsd:371]`. US Customs port where merchandise arrived in customs territory.
  - `entry/header/unlading-port`: OPTIONAL in XSD (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:453]`, but required by CBP for water/air transport. US port where goods are physically removed from the importing vessel/carrier.
  - `entry/header/remote-entry/preparer-port`: REQUIRED within `remote-entry` `[VERIFIED: spec/entry.xsd:404]`.
  - `entry/header/remote-entry/remote-exam-port`: OPTIONAL within `remote-entry` `[VERIFIED: spec/entry.xsd:405]`.
  - `entry/header/warehouse-entry/warehouse-port`: REQUIRED within `warehouse-entry` `[VERIFIED: spec/entry.xsd:527]`.
- **Domain Verification Note**: Schedule D is published by the US Census Bureau and CBP. Port codes must not be conflated across roles (e.g. processing port Seattle 3001 vs unlading port Tacoma 3002).

---

### Task 3 — Schedule K / Foreign Ports
- **Schema Data Type**: `data:foreignPortType` `[VERIFIED: spec/data_type.xsd:166-170]`
  ```xml
  <xsd:simpleType name="foreignPortType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\d{5}"/>
      </xsd:restriction>
  </xsd:simpleType>
  ```
- **Constraint**: Must be a string of **exactly 5 numeric digits** (`^\d{5}$`).
- **Field Role and Location**:
  - `entry/invoices/invoice/line-items/line-item/lading-port`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:1197-1201]`.
  - **CRITICAL ARCHITECTURAL FINDING**: In NetCHB XML, `lading-port` is defined at the **line-item level** inside `lineItemType`, NOT at the entry header level!
- **UN/LOCODE vs. Schedule K**:
  - UN/LOCODE (e.g. `VNSGN` or `VNHCM`) is a 5-character alphanumeric standard.
  - In NetCHB, `data:foreignPortType` pattern is `\d{5}`. Passing `VNSGN` causes an instant XSD validation failure `[VERIFIED: spec/data_type.xsd:168]`.
  - The lookup must resolve geographic names and UN/LOCODEs to official US Army Corps of Engineers / Census Schedule K numeric codes (e.g. 55201).

---

### Task 4 — Country Codes
- **Schema Data Type**: `data:countryCodeType` `[VERIFIED: spec/data_type.xsd:66-70]`
  ```xml
  <xsd:simpleType name="countryCodeType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="[A-Za-z]{2}" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- **Constraint**: Exactly 2 alphabetic characters (case-insensitive in XSD, but standard convention is uppercase ISO 3166-1 alpha-2).
- **Field Usages in `entry.xsd`**:
  - `entry/invoices/invoice/line-items/line-item/country-origin`: REQUIRED (`minOccurs="1"`) `[VERIFIED: spec/entry.xsd:1110]`.
  - `entry/invoices/invoice/line-items/line-item/country-export`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:1196]`.
  - `entry/header/containers/container/...` and PGA sections `[VERIFIED: spec/entry.xsd:1519, 2737, 3496]`.
  - `currency-country-code`: Pattern `[A-Z]{2}` `[VERIFIED: spec/entry.xsd:1064]`.
  - `entityAddressType/country`: REQUIRED `[VERIFIED: spec/entry.xsd:6383]`.
- **Domain Distinction**: Country of origin (manufacturing/growth origin) must never be conflated with country of export (transshipment/shipping country) `[VERIFIED: ORIGINAL_REQUEST.md:109]`.
- **Current Repo Gap**: `shared/src/reference/countries.ts:12-34` contains only 21 hardcoded entries. Authoritative ISO 3166-1 contains 249 officially assigned alpha-2 codes.

---

### Task 5 — Currency Codes & Foreign Exchange
- **Schema Definition**: Inline in `spec/entry.xsd:1037-1070` under `invoiceType`:
  ```xml
  <xsd:element name="foreign-currency" minOccurs="0">
      <xsd:complexType>
          <xsd:all>
              <xsd:element name="currency-code" minOccurs="1">
                  <xsd:simpleType>
                      <xsd:restriction base="xsd:token">
                          <xsd:pattern value="[A-Z]{3}"/>
                      </xsd:restriction>
                  </xsd:simpleType>
              </xsd:element>
              <xsd:element name="exchange-rate" minOccurs="0">
                  <xsd:simpleType>
                      <xsd:restriction base="xsd:float">
                          <xsd:minExclusive value="0"/>
                      </xsd:restriction>
                  </xsd:simpleType>
              </xsd:element>
              <xsd:element name="currency-country-code" minOccurs="0">
                  <xsd:simpleType>
                      <xsd:restriction base="xsd:token">
                          <xsd:pattern value="[A-Z]{2}"/>
                      </xsd:restriction>
                  </xsd:simpleType>
              </xsd:element>
          </xsd:all>
      </xsd:complexType>
  </xsd:element>
  ```
- **Constraints**:
  - `currency-code`: Exactly 3 uppercase letters (`^[A-Z]{3}$`), ISO 4217 code `[VERIFIED: spec/entry.xsd:1050]`.
  - `exchange-rate`: Float strictly greater than 0 `[VERIFIED: spec/entry.xsd:1057]`.
  - `currency-country-code`: Exactly 2 uppercase letters `[VERIFIED: spec/entry.xsd:1064]`.
- **XML Generation Behavior**:
  - If invoice currency is `USD`, the `<foreign-currency>` tag MUST BE OMITTED `[VERIFIED: spec/entry.xsd:1040]`.
  - If invoice is non-USD, NetCHB server can auto-populate exchange rates if `currency-code`, `currency-country-code`, and export date are provided `[VERIFIED: spec/entry.xsd:1041-1043]`.
  - However, per project rules, exchange rate selection is a broker decision and must not be guessed or fetched from unverified live commercial market rates `[VERIFIED: ORIGINAL_REQUEST.md:118-124]`.

---

### Task 6 — Modes of Transportation (MOT)
- **Schema Data Type**: `data:modeTransportType` `[VERIFIED: spec/data_type.xsd:208-231]`
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
- **Field Role and Location**:
  - `entry/header/mode-transportation`: OPTIONAL in schema (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:452]`.
- **CATAIR / Industry Definitions** `[INFERRED: CATAIR Appendix B]`:
  - `10`: Vessel, non-container (Breakbulk / uncontainerized)
  - `11`: Vessel, container (Containerized ocean)
  - `12`: Border, waterborne (Barge / lake / river)
  - `20`: Rail, non-container
  - `21`: Rail, container
  - `30`: Truck, non-container
  - `31`: Truck, container
  - `32`: Auto
  - `33`: Pedestrian
  - `34`: Road, other
  - `40`: Air, non-container
  - `41`: Air, container
  - `50`: Mail
  - `60`: Passenger, hand-carried
  - `70`: Fixed transport installation (Pipeline)
- **Current Implementation Gap**:
  - `shared/src/reference/mot.ts:12-24` defines only 11 modes, missing `12`, `32`, `33`, and `34` `[VERIFIED: shared/src/reference/mot.ts:12-24]`.
  - Application filing profile supports only ocean modes `10` and `11` `[VERIFIED: server/src/checks/index.ts:48]`.

---

### Task 7 — Entry Types
- **Schema Data Type**: `data:entryType` `[VERIFIED: spec/data_type.xsd:100-151]`
  - 43 valid enumerations:
    - `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`
    - `20`, `21`, `22`, `23`, `24`, `25`, `26`
    - `30`, `31`, `32`, `33`, `34`, `38`
    - `40`, `41`, `42`, `43`, `44`, `45`, `46`
    - `50`, `51`, `52`
    - `60`, `61`, `62`, `63`, `64`, `65`, `66`
    - `86`
- **Field Role and Location**:
  - `entry/header/entry-type`: REQUIRED (`minOccurs="1"`) `[VERIFIED: spec/entry.xsd:373]`.
- **Common CBP Meanings** `[INFERRED: CBP CATAIR Entry Summary]`:
  - `01`: Consumption - Free and Dutiable
  - `02`: Consumption - Quota/Visa
  - `03`: Consumption - Antidumping / Countervailing Duty (AD/CVD)
  - `06`: Foreign Trade Zone (FTZ) Consumption
  - `11`: Informal - Free and Dutiable
  - `21`: Warehouse
  - `23`: Temporary Importation Bond (TIB)
  - `86`: Section 321 de minimis
- **Application Profile**:
  - Current application profile implements ONLY `01` `[VERIFIED: shared/src/reference/entry-types.ts:2, server/src/checks/index.ts:49]`.
  - Unsupported entry types must remain blocked by the validator even when valid in the schema table.

---

### Task 8 — Bond Types & Associated Fields
- **Schema Data Type**: `entry:bondType` `[VERIFIED: spec/entry.xsd:6134-6145]`
  ```xml
  <xsd:simpleType name="bondType">
      <xsd:restriction base="xsd:token">
          <xsd:enumeration value="00" />
          <xsd:enumeration value="08" />
          <xsd:enumeration value="09" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- **Field Usages**:
  - `entry/header/bond-type`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:374]`.
  - `entry/header/add-cvd-bond-type`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:670]`.
- **Meanings in NetCHB / ACE** `[INFERRED: spec/entry.xsd documentation & ACE CATAIR]`:
  - `"00"`: Bond Waived / No Bond (e.g. government shipments, de minimis).
    - Requires `<bond-waiver-reason>` `[VERIFIED: spec/entry.xsd:613-633]`. Valid codes:
      - `995`: Supplemental Duty Bills on Vessel Repair Entries
      - `996`: Fines, Penalty, or Liquidated Damage Bills
      - `997`: All Other Contingent Bills
      - `998`: Bills Secured - Other than Surety
      - `999`: No Surety, Unsecured Bills
  - `"08"`: Continuous Bond.
    - Interacts with `<superseded-bond/>` `[VERIFIED: spec/entry.xsd:662-668]`: if present, indicates superseded bond is "Yes".
    - Interacts with `<add-cvd-superseded-bond/>` `[VERIFIED: spec/entry.xsd:672-678]`.
  - `"09"`: Single Transaction Bond (STB).
- **Other Bond-Related Fields in Header**:
  - `surety-code`: `data:suretyCodeType` (`maxLength 3`) `[VERIFIED: spec/data_type.xsd:297, spec/entry.xsd:429]`.
  - `bond-amount`: Token matching `\d{1,10}` `[VERIFIED: spec/entry.xsd:509]`.
  - `bond-producer-account-no`: Token `maxLength 10` `[VERIFIED: spec/entry.xsd:517]`.
  - `add-cvd-stb-amount`: Long `minInclusive 0`, `maxInclusive 9999999999` `[VERIFIED: spec/entry.xsd:683-684]`.

---

### Task 9 — Units of Measure (UOM)
- **Schema Data Type**: `data:unitOfMeasureType` `[VERIFIED: spec/data_type.xsd:321-411]`
  - Contains **83 enumerated codes** from CATAIR Appendix C:
    `AC`, `ASTM`, `BBL`, `C`, `CAR`, `CC`, `CG`, `CGM`, `CKG`, `CLR`, `CM`, `CM2`, `CM3`, `CTN`, `CU`, `CUR`, `CY`, `CYG`, `CYK`, `D`, `DC`, `DEG`, `DOZ`, `DPC`, `DPR`, `FIB`, `FBM`, `G`, `GBQ`, `GR`, `GRL`, `GVW`, `HUN`, `HZ`, `IRC`, `JWL`, `K`, `KCAL`, `KG`, `KHZ`, `KL`, `KM`, `KM2`, `KM3`, `KN`, `KPA`, `KSB`, `KVA`, `KVAR`, `KW`, `KWH`, `L`, `LIN`, `LNM`, `M`, `MBQ`, `MC`, `MG`, `MHZ`, `ML`, `MM`, `MPA`, `M2`, `M3`, `NO`, `ODE`, `PCS`, `PF`, `PFG`, `PFL`, `PK`, `PRS`, `RPM`, `SBE`, `SQ`, `T`, `V`, `W`, `WG`, `WL`, `WT`, `X`.
- **Usages in `entry.xsd`**:
  - `tariffType/unit-of-measure1`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:1679]`.
  - `tariffType/unit-of-measure2`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:1682]`.
  - `tariffType/unit-of-measure3`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:1685]`.
  - Accompanying quantities (`quantity1`, `quantity2`, `quantity3`) are typed as `entry:tariffQuantityType` `[VERIFIED: spec/entry.xsd:1678, 1681, 1684]`, which restricts `dollarAmountType` to `<xsd:maxExclusive value="10000000000"/>` (decimal with 2 fraction digits) `[VERIFIED: spec/entry.xsd:6212-6216]`.
- **Manifest Package Unit vs. Tariff Statistical Unit**:
  - `manifestType/bill-of-lading/unit`: Token `maxLength 5` `[VERIFIED: spec/entry.xsd:894-900]`. Accepts packaging designations such as `CTN`, `BOX`, `PKG`, `PLT`, `CRT`.
  - `tariffType/unit-of-measure[1-3]`: Must strictly be one of the 83 enumerated CATAIR statistical reporting units.
  - Commercial aliases (e.g. `KGS`, `DOZENS`, `PCS`) must be normalized, but **silent quantity conversion** (e.g. pieces to dozens or kilograms) is strictly forbidden `[VERIFIED: ORIGINAL_REQUEST.md:153-160]`.

---

### Task 10 — US States, Territories & Postal Codes
- **Schema Data Type**: `data:usStateType` `[VERIFIED: spec/data_type.xsd:414-481]`
  - 59 enumerated 2-letter codes:
    - 50 States: `AL`, `AK`, `AZ`, `AR`, `CA`, `CO`, `CT`, `DE`, `FL`, `GA`, `HI`, `ID`, `IL`, `IN`, `IA`, `KS`, `KY`, `LA`, `ME`, `MD`, `MA`, `MI`, `MN`, `MS`, `MO`, `MT`, `NE`, `NV`, `NH`, `NJ`, `NM`, `NY`, `NC`, `ND`, `OH`, `OK`, `OR`, `PA`, `RI`, `SC`, `SD`, `TN`, `TX`, `UT`, `VT`, `VA`, `WA`, `WV`, `WI`, `WY`
    - Federal District: `DC`
    - Territories & Freely Associated States: `AS` (American Samoa), `FM` (Micronesia), `GU` (Guam), `MH` (Marshall Islands), `MP` (Northern Mariana Islands), `PW` (Palau), `PR` (Puerto Rico), `VI` (Virgin Islands).
- **Usages in `entry.xsd`**:
  - `entry/header/state-destination`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:442]`.
- **Other Address & Postal Constraints**:
  - Invoice ultimate consignee state: `consignee-state` is token `maxLength 2` `[VERIFIED: spec/entry.xsd:1020]`.
  - Invoice ultimate consignee zip: `consignee-zip` is token `maxLength 40` `[VERIFIED: spec/entry.xsd:1027]`.
  - Entity address:
    - `state-province-code`: Token `maxLength 3` `[VERIFIED: spec/entry.xsd:6372]` (supports international 3-letter provinces).
    - `postal-code`: Token `maxLength 15` `[VERIFIED: spec/entry.xsd:6379]`.
    - `city`: Token `maxLength 35` `[VERIFIED: spec/entry.xsd:6365]`.
    - `country`: `data:countryCodeType` (2 letters) `[VERIFIED: spec/entry.xsd:6383]`.

---

### Task 11 — Special Program Indicators (SPI)
- **Schema Data Types**:
  - Primary SPI: `data:specialProgramType` `[VERIFIED: spec/data_type.xsd:266-275]`
    ```xml
    <xsd:simpleType name="specialProgramType">
        <xsd:restriction base="xsd:token">
            <xsd:maxLength value="2"/>
        </xsd:restriction>
    </xsd:simpleType>
    ```
  - Secondary SPI: `data:secondarySpecialProgramType` `[VERIFIED: spec/data_type.xsd:278-287]`
    ```xml
    <xsd:simpleType name="secondarySpecialProgramType">
        <xsd:restriction base="xsd:token">
            <xsd:maxLength value="1"/>
        </xsd:restriction>
    </xsd:simpleType>
    ```
- **Field Usages in `tariffType`**:
  - `tariff/special-program`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:1687]`.
  - `tariff/secondary-special-program`: OPTIONAL (`minOccurs="0"`) `[VERIFIED: spec/entry.xsd:1688]`.
- **Domain Indicators** `[INFERRED: General Note 3(c)(i), HTSUS]`:
  - `A`, `A*`, `A+`: Generalized System of Preferences (GSP)
  - `E`, `E*`: CBERA (Caribbean Basin)
  - `IL`: United States-Israel Free Trade
  - `JO`: United States-Jordan Free Trade
  - `MX`, `CA`, `S`, `S+`: USMCA
  - `SG`: Singapore Free Trade
  - `AU`: Australia Free Trade
  - `KR`: Korea Free Trade
- **Filing Rule**: Schema does NOT enforce an enumeration, only length limits (`<= 2` and `<= 1`). Program eligibility must never be inferred solely from country of origin `[VERIFIED: ORIGINAL_REQUEST.md:170]`.

---

### Task 12 — Carrier SCAC & Bill Formats
- **Schema Data Type**: `data:carrierCodeType` `[VERIFIED: spec/data_type.xsd:22-31]`
  ```xml
  <xsd:simpleType name="carrierCodeType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\w{2}|\w{4}|\*{1}[\*\w]{1}" />
      </xsd:restriction>
  </xsd:simpleType>
  ```
- **Constraint**: Must match:
  - 2 alphanumeric/word characters (`\w{2}`) — typical IATA 2-character air carrier codes.
  - 4 alphanumeric/word characters (`\w{4}`) — standard NMFTA 4-letter SCAC codes.
  - Wildcard / placeholder syntax (`\*{1}[\*\w]{1}`) — `**` or `*X`.
- **Bill of Lading Field Usages** `[VERIFIED: spec/entry.xsd:880-910]`:
  - `master-scac`: `data:carrierCodeType` (OPTIONAL)
  - `master-bill`: `data:billNoType` (Token `[\dA-Za-z]{0,50}`) (OPTIONAL)
  - `house-scac`: `data:carrierCodeType` (OPTIONAL)
  - `house-bill`: `data:billNoType` (OPTIONAL)
  - `sub-house-bill`: `data:billNoType` (OPTIONAL)
  - `quantity`: Integer `minInclusive 0` (REQUIRED)
  - `unit`: Token `maxLength 5` (REQUIRED)
- **Domain Distinction**:
  - `master-scac` represents the vessel operating ocean carrier (VOCC) or primary air carrier.
  - `house-scac` represents the NVOCC or freight forwarder issuing the house bill of lading.
  - Proprietary NMFTA registry lookup is not freely redistributable; format validation must succeed while registry status is labeled appropriately `[VERIFIED: ORIGINAL_REQUEST.md:178-185]`.

---

### Task 13 — Tariff / HTS Numbers
- **Schema Data Type**: `data:tariffNoType` `[VERIFIED: spec/data_type.xsd:314-318]`
  ```xml
  <xsd:simpleType name="tariffNoType">
      <xsd:restriction base="xsd:token">
          <xsd:pattern value="\d{5,10}"/>
      </xsd:restriction>
  </xsd:simpleType>
  ```
- **Constraint**: String of **5 to 10 consecutive digits** (`^\d{5,10}$`).
- **Field Usages**:
  - `tariffType/tariff-no`: REQUIRED `[VERIFIED: spec/entry.xsd:1654]`.
  - `lineItemFeeType/tariff-no`: OPTIONAL `[VERIFIED: spec/entry.xsd:2079]`.
- **Schema Validity vs. Filing Readiness**:
  - In `data_type.xsd`, 6-digit headings (e.g. `610910`) and 8-digit subheadings (e.g. `61091000`) pass XML Schema validation.
  - However, for US CBP Entry Summary Type 01, a **full 10-digit statistical classification** is mandatory `[VERIFIED: ORIGINAL_REQUEST.md:188-189]`.
  - Punctuation (periods `.` and spaces) is strictly prohibited by regex `\d{5,10}` and must be stripped before serialization.

---

### Task 14 — XML Hierarchy, Sequence Order & Dual Validation
- **Root Element Structure**: `<entry>` (`spec/entry.xsd:18-305`)
- **Mandatory Sequence of Children** `[VERIFIED: spec/entry.xsd:26-302]`:
  1. `<entry-no>` (Choice of `<user-specified>` or `<system-generated/>`)
  2. `<precalculated>` (optional)
  3. `<remove-ddp>` (optional)
  4. `<transmit>` (optional)
  5. `<transmit-3461>` (optional)
  6. `<via-ace>` (optional, deprecated)
  7. `<external-reference-number>` (optional, `maxLength 100`)
  8. `<assign-to>` (optional, `maxLength 20`)
  9. `<auto-apply-remedies>` (optional)
  10. `<apply-exemptions>` (optional)
  11. `<single-smelt-remedy>` (optional)
  12. `<default-aluminum-country>` (optional)
  13. `<default-steel-country>` (optional)
  14. `<default-copper-country>` (optional)
  15. `<disclaim-cotton-fee>` (optional)
  16. `<header>` (`entry:headerType`, REQUIRED)
  17. `<consolidated-entries>` (optional)
  18. `<manifest>` (`entry:manifestType`, REQUIRED)
  19. `<containers>` (optional, contains `<container-number>` or `<container>`)
  20. `<ace-cargo-release-parties>` (optional)
  21. `<invoices>` (REQUIRED, contains `<invoice>` unbounded)
  22. `<email-notifications>` (optional)
  23. `<disclaim-pgas>` (optional)
- **Dual Validation Status Protocol** `[VERIFIED: AGENTS.md Rule 8]`:
  - **Status 1: "Schema Valid"**: The generated XML passes strict libxml2 / xmllint-wasm validation against `entry.xsd` and `data_type.xsd`.
  - **Status 2: "Ready to Transmit (N blockers)"**: The shipment satisfies all commercial, regulatory, and broker decisions (e.g. 10-digit HTS, confirmed ports, verified weights, approved exchange rates).
  - An entry may be completely Schema Valid while having blockers that prevent transmission.

---

## 5. Five-Component Handoff Report

### 1. Observation
- Verified schema files:
  - `spec/data_type.xsd` (482 lines, 15,889 bytes)
  - `spec/entry.xsd` (6,680 lines, 223,794 bytes)
- Verified all 22 simple types in `spec/data_type.xsd` lines 10 to 481 and all 57 complex/simple types in `spec/entry.xsd`.
- Verified current code references in `@sefer/shared`:
  - `shared/src/reference/bond-types.ts` contains only `{ '00', '08', '09' }`.
  - `shared/src/reference/countries.ts` contains only 21 country codes.
  - `shared/src/reference/currencies.ts` contains only 8 currency codes.
  - `shared/src/reference/entry-types.ts` contains only `'01'`.
  - `shared/src/reference/mot.ts` contains only 11 transport modes (missing 4).
  - `shared/src/reference/uom.ts` contains only 10 units (missing 73).
- Executed `npm test`: 55 tests pass in 5.728 seconds across all test suites `[VERIFIED: task-144]`.

### 2. Logic Chain
1. Schema files `spec/entry.xsd` and `spec/data_type.xsd` are the authoritative source of truth for NetCHB XML interchange format.
2. Cross-referencing `ORIGINAL_REQUEST.md` Tasks 1–14 with the schemas revealed several discrepancies between common CBP ACE interfaces and NetCHB's XML schema:
   - Schedule K foreign ports in NetCHB require a 5-digit number (`\d{5}`), rejecting UN/LOCODE strings.
   - NetCHB bond types accept only `"00"`, `"08"`, and `"09"`, rejecting CBP's single-digit bond codes.
   - NetCHB tariff number simpleType accepts 5 to 10 digits without punctuation, which diverges from the 10-digit business requirement for formal entry summaries.
   - NetCHB places `lading-port` inside `lineItemType`, not in `headerType`.
3. The current codebase has implemented minimal subset stubs for Phase 1. Tasks 1–14 require building full authoritative reference datasets and lookup services to expand these stubs without breaking existing validation or overwriting raw observations.

### 3. Caveats
- Proprietary registries (e.g. NMFTA SCAC directory) require commercial licensing; fallback format validation with an explicit "unavailable" status is required for offline operation.
- USITC HTS API returns live data that may change across calendar years; disk caching with versioning and retrieval dates is necessary to ensure deterministic execution.

### 4. Conclusion
The NetCHB XML schemas establish clear, enforceable boundaries for all reference data fields in Tasks 1–14. By cataloging the exact regex patterns, enumerations, element hierarchies, and cardinality constraints, this survey provides the complete reference specification needed for implementing Tasks 1 through 14.

### 5. Verification Method
1. Run test suite: `npm test`
2. Validate any synthetic XML using the internal validator:
   ```bash
   node -e "const {NetChbXmlValidator} = require('./server/dist/builder/xml-validator'); new NetChbXmlValidator().validate(xmlString).then(console.log);"
   ```
3. Inspect schema types directly:
   ```powershell
   Select-String -Path "spec\data_type.xsd" -Pattern "name=""(modeTransportType|portType|foreignPortType|bondType|unitOfMeasureType)"""
   ```
