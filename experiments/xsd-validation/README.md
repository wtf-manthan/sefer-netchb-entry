# Experiment: XSD Validation Harness (Task T2)

## Purpose & Scope
This experiment evaluates Node.js-compatible XML schema validators against Descartes NetCHB's official `entry.xsd` and `data_type.xsd`. It establishes a reproducible validation harness, compares multiple validator options, and verifies that `entry.xsd` catches all real-world data format errors before any XML is transmitted.

---

## Validators Evaluated

| Validator | Engine / Tech | Platform Compatibility | XSD Import Resolution | Result / Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** (v5.3.0) | Pure WebAssembly port of C `libxml2` v2.13 | **Cross-platform** (Windows, macOS, Linux, Node 18, 20, 22, 24) | Preloads local `data_type.xsd` into virtual FS seamlessly | **RECOMMENDED (WINNER)**: 100% test pass rate, exact libxml2 error diagnostics, zero native C++ compiler dependencies. |
| **`libxmljs2`** (v0.37.0) | Native C++ addon bindings for `libxml2` | **Failed on Windows / Node v24** | N/A | **REJECTED**: No prebuilt binary for `node-v137-win32-x64` (Node 24 ABI). Fails at runtime with `Could not locate the bindings file` unless Visual Studio C++ build tools are installed. |
| **`xmllint` CLI** | Native OS binary (`/usr/bin/xmllint` or Windows binary) | System-dependent | Depends on local disk paths | **FALLBACK / OPTIONAL**: Works identically to `xmllint-wasm` when installed on Unix systems, but unavailable by default on standard Windows environments (`where.exe xmllint` returned not found). |

---

## Test Fixtures & Real Execution Results

Test harness command:
```bash
npx tsx experiments/xsd-validation/validate.ts
```

All 7 test cases passed as expected:

```
===============================================================
Task T2: XSD Validation Harness Experiment
Validator: xmllint-wasm (compiled libxml2 v2.13 via WebAssembly)
===============================================================

[PASS] 00-valid-minimal.xml
  Expected: VALID | Result: VALID

[PASS] 01-invalid-invoice-slash.xml
  Expected: INVALID | Result: INVALID
  Errors detected:
    → Schemas validity error : Element '{http://www.netchb.com/xml/entry}invoice-no': [facet 'pattern'] The value 'KBAS/NB/26-0912' is not accepted by the pattern '[A-Za-z\d\-]{1,17}'.

[PASS] 02-invalid-vessel-name-length.xml
  Expected: INVALID | Result: INVALID
  Errors detected:
    → Schemas validity error : Element '{http://www.netchb.com/xml/entry}vessel-name': [facet 'maxLength'] The value has a length of '35'; this exceeds the allowed maximum length of '20'.

[PASS] 03-invalid-header-charges-decimal.xml
  Expected: INVALID | Result: INVALID
  Errors detected:
    → Schemas validity error : Element '{http://www.netchb.com/xml/entry}charges': '4035.00' is not a valid value of the atomic type 'xs:long'.

[PASS] 04-invalid-top-level-sequence-order.xml
  Expected: INVALID | Result: INVALID
  Errors detected:
    → Schemas validity error : Element '{http://www.netchb.com/xml/entry}manifest': This element is not expected. Expected is one of ( {http://www.netchb.com/xml/entry}precalculated, ... ).

[PASS] 05-invalid-missing-required-header-field.xml
  Expected: INVALID | Result: INVALID
  Errors detected:
    → Schemas validity error : Element '{http://www.netchb.com/xml/entry}header': Missing child element(s). Expected is one of ( ... {http://www.netchb.com/xml/entry}entry-port ... ).

[PASS] 06-invalid-dollar-amount-comma.xml
  Expected: INVALID | Result: INVALID
  Errors detected:
    → Schemas validity error : Element '{http://www.netchb.com/xml/entry}value': '23,235.00' is not a valid value of the local atomic type.
```

---

## Detailed Error Analysis

1. **`01-invalid-invoice-slash.xml`**:
   - **Schema Rule**: `data_type.xsd` defines `invoiceNoType` with pattern `[A-Za-z\d\-]{1,17}`.
   - **Error Caught**: `[facet 'pattern'] The value 'KBAS/NB/26-0912' is not accepted by the pattern '[A-Za-z\d\-]{1,17}'`.
   - **System Decision**: In the deterministic XML generator, any invoice number containing slashes (`/`) or invalid symbols must be normalized to hyphens (e.g., `KBAS-NB-26-0912`) before XML generation.

2. **`02-invalid-vessel-name-length.xml`**:
   - **Schema Rule**: `entry.xsd` restricts `<vessel-name>` to `maxLength value="20"`.
   - **Error Caught**: `[facet 'maxLength'] The value has a length of '35'; this exceeds the allowed maximum length of '20'`.
   - **System Decision**: Vessel name must be truncated or sanitized to 20 characters maximum.

3. **`03-invalid-header-charges-decimal.xml`**:
   - **Schema Rule**: `entry.xsd` declares `<charges>` as `type="xsd:long"` (whole dollars/integers, NOT dollarAmountType with decimals).
   - **Error Caught**: `'4035.00' is not a valid value of the atomic type 'xs:long'`.
   - **System Decision**: International freight and insurance charges ($3,850 + $185 = $4,035) must be rounded/truncated to whole integer integers (`4035`) in the entry header.

4. **`04-invalid-top-level-sequence-order.xml`**:
   - **Schema Rule**: Root `<entry>` is an ordered `xsd:sequence`: `<entry-no>`, header, manifest, invoices.
   - **Error Caught**: `'manifest': This element is not expected. Expected is one of ...`.
   - **System Decision**: XML builder must emit top-level elements strictly in sequence.

5. **`05-invalid-missing-required-header-field.xml`**:
   - **Schema Rule**: `headerType` requires `<processing-port>`, `<entry-port>`, `<entry-date>`, and `<entry-type>`.
   - **Error Caught**: `Missing child element(s). Expected is one of ... entry-port ...`.
   - **System Decision**: Missing port or entry date must be flagged as a BLOCKER in the audit report.

6. **`06-invalid-dollar-amount-comma.xml`**:
   - **Schema Rule**: `dollarAmountType` restricts `xsd:decimal` (fraction digits 2, minInclusive 0). Standard XML schema decimals do not permit comma thousands separators.
   - **Error Caught**: `'23,235.00' is not a valid value of the local atomic type`.
   - **System Decision**: Serializer must strip all thousands separators and format numbers as `toFixed(2)` (e.g. `23235.00`).

---

## How to Rerun This Experiment

```bash
# From workspace root:
npx tsx experiments/xsd-validation/validate.ts
```
