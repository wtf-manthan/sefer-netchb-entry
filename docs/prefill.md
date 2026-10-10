# Candidate Fields for Automatic Pre-filling and User Suggestions

This document catalogs shipping fields that can be automatically populated, pre-selected, or suggested from commercial documents (Invoice, Packing List, Bill of Lading) and reference lookup tables to reduce manual user entry in the NetCHB Entry XML preparation workspace.

---

## 1. Parties & Entity Names

| Field | Suggested / Pre-fill Value | Source in Documents | Extraction / Derivation Method |
| :--- | :--- | :--- | :--- |
| **`Ultimate Consignee Name`** | `NORTHBOUND OUTFITTERS, LLC` | Commercial Invoice & Packing List | Extracted directly from the `"CONSIGNEE / BUYER"` block. |
| **`Ultimate Consignee Address`** | `1420 NW 14TH AVE, SUITE 300, PORTLAND, OR 97209, USA` | Commercial Invoice & Packing List | Extracted from the address lines below the consignee name. |
| **`Manufacturer ID (MID)`** | `VNSAIPHO1201HO` (or `HKKOWBAY1708HON`) | Commercial Invoice Shipper / Manufacturer block | Generated algorithmically using CBP's official 13-character MID algorithm: **Country (2) + Company (3) + Address (4) + City (3)**. |

---

## 2. Transport & Routing

| Field | Suggested Code | Source in Documents | Reference Table / Logic |
| :--- | :---: | :--- | :--- |
| **`Port of Unlading`** | `3002` (Tacoma, WA) | Bill of Lading: *"Port of Discharge: TACOMA, WA"* & PL Header: *"To: TACOMA, WA"* | Matched against U.S. Census Bureau Schedule D lookup table (`Tacoma` $\to$ `3002`). |
| **`Foreign Port of Lading`** | `55201` (Ho Chi Minh City, Vietnam) | Bill of Lading: *"Port of Loading: HO CHI MINH CITY"* & PL: *"From: CAT LAI, HCMC"* | Matched against U.S. Census Bureau Schedule K lookup table (`Ho Chi Minh City` $\to$ `55201`). |
| **`Mode of Transportation (MOT)`** | `11` (Vessel, Containerized) | Bill of Lading | Ocean vessel name (`ONE COMMITMENT 026E`) with ocean container numbers (`OPLU3041722`) distinguishes containerized vessel (`11`) from non-containerized vessel (`10`). |
| **`Country of Export`** | `VN` (Vietnam) | Commercial Invoice & Bill of Lading | Place of receipt / seller location normalized via ISO 3166-1 country lookup table. |

---

## 3. Financial & Quantity Choices

| Field | Suggested Pre-fill Behavior | Source Evidence | Rationale |
| :--- | :--- | :--- | :--- |
| **`Valuation Basis`** | `FOB` / `Transaction Value` | Commercial Invoice | Invoice explicitly states: `"TERMS: FOB HO CHI MINH PORT"`. |
| **`Quantity Selection`** | Default to `Invoiced` (or `Packed` when identical) | Invoice & Packing List | Where quantities match across both docs, auto-select `Invoiced`. Where a shortage occurs (e.g. 1,176 vs 1,200), default to `Invoiced` with a visible `"Shortage Detected"` tag. |
| **`Amount Selection`** | Default to `Computed` (with badge) | Commercial Invoice | Where line math differs (e.g. \$6,480 vs calculated product), pre-select `Computed` or `Printed` with a discrepancy warning instead of leaving as `Unresolved`. |
| **`Assist Allocation`** | Pro-rata allocation across affected lines | Invoice Remarks: `"$4,180.00 Buyer-Supplied Fabric"` | Pre-distribute the assist amount across applicable apparel lines based on line value. |
| **`Statistical Reporting Quantities`** | Automatic Unit Conversion (e.g., `DOZ` or `KG`) | Invoice Quantity (`PCS`) + HTS Tariff Schedule | When a 10-digit HTS code requires reporting in dozens (`DOZ`), auto-calculate $\frac{\text{Pieces}}{12}$ (e.g., $2,400 \div 12 = 200 \text{ DOZ}$) and prefill Quantity 1. |

---

## 4. Standard Regulatory Defaults

| Field | Suggested Default | Regulatory Basis |
| :--- | :---: | :--- |
| **`Entry Type`** | `01` | Formal Consumption Entry (standard for commercial shipments $> \$2,500$). |
| **`Bond Type`** | `08` | Continuous Customs Bond (standard for regular commercial importers). |
| **`Related Party`** | `No` | Arms-length transaction between independent foreign supplier and U.S. buyer. |

---

## 5. Fields That MUST Remain Manual User Inputs
*(Cannot be legally or reliably derived from commercial shipping documents)*

* **`Importer Tax ID / EIN`**: Must be provided by the U.S. importer/broker account.
* **`Surety Code`**: Specific 3-digit CBP insurance company code on file with the importer's Customs bond.
* **`Entry Date`**: Date of formal presentation to CBP or estimated arrival.
* **`Processing Port` / `Entry Port`**: Filing port choices if using Remote Location Filing (RLF), which can differ from physical unlading.
