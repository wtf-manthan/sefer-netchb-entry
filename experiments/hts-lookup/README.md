# Experiment: USITC HTS Lookup Service (Task T6)

## Overview
This experiment verifies the end-to-end integration with the official United States International Trade Commission (USITC) Harmonized Tariff Schedule (HTS) REST API.

When commercial documents provide only 6-digit HS headings (e.g. `6109.10`), CBP Form 7501 requires a 10-digit HTS number with statistical suffix, reporting units of measure, and applicable duty rates.

## API Endpoint
- **URL**: `https://hts.usitc.gov/reststop/search?keyword={HS6}` [VERIFIED]
- **Response Format**: Pure JSON array containing heading hierarchy, descriptions, general duty rates (Column 1), special trade agreement rates, and reporting units (`unitsOfQuantity`).
- **License**: Public domain (United States Government work, 17 U.S.C. § 105).

## End-to-End Test Results
Testing 6-digit heading `6109.10` returned:
- **Base Heading**: `6109.10.00` (*"Of cotton"*)
- **General Duty Rate**: `16.5%`
- **10-Digit Candidates**: 14 distinct statistical suffixes, including:
  - `6109.10.00.04`: T-shirts, all white, short hemmed sleeves (Units: `doz.`, `kg`)
  - `6109.10.00.12`: Men's T-shirts (Units: `doz.`, `kg`)
  - `6109.10.00.14`: Boys' T-shirts (Units: `doz.`, `kg`)
  - `6109.10.00.40`: Women's T-shirts (Units: `doz.`, `kg`)

## How to Rerun

```bash
npx tsx --test experiments/hts-lookup/lookup.test.ts
```
