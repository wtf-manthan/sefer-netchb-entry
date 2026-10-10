# Sample entry and remaining information

[VERIFIED - entry.xml, open-items.json] `entry.xml` is the app-generated **incomplete draft** for the three supplied PDFs. It is not schema valid and must not be transmitted. There are 58 open checks, including evidence reviews; this is not a count of 58 absent fields. Missing values are omitted from typed XML elements. The top XML comment and `open-items.json` explain the reasons.

[VERIFIED - review.json] Resume this file in the app to inspect the original extraction, corrections and reviewed suggestions. Attach the PDFs from `samples/` again for the evidence viewer. Accepted suggestions cover vessel containerization, line charge basis, the explicitly linked assist and sample customs value, plus reviewed unloading/loading city port matches. Buyer versus ultimate consignee remains a decision.

## What is missing and how to complete it

| Item | Reason and next step |
|---|---|
| Importer tax ID, consignee tax ID and role | [UNKNOWN - supplied PDFs] Brokerage/party identity information is absent or the filing role is not established. Obtain it from importer/broker. |
| Bond, surety, entry type/date, processing and entry ports, related-party status | [UNKNOWN - supplied PDFs] Routing and invoice value do not establish these filing decisions. Have the broker supply/review them. |
| Manufacturer IDs | [VERIFIED - packing list p1; review.json] Factory local tax code was mislabelled by OCR. Corrected to missing, retaining evidence. Construct/verify appropriate customs identifiers from actual manufacturer identities, including the Bangladesh sample factory. |
| Full HTS classifications and statistical quantities | [VERIFIED - source PDFs; open-items.json] Documents give six-digit headings and commercial quantities, insufficient for reviewed ten-digit classification and statistical reporting. Use HTS candidate lookup and a broker's commodity-specific review. |
| Commercial value and shipment quantity | [VERIFIED - invoice/packing list] T-shirt 2400 x 2.85 gives 6840 versus printed 6480. Hoodies are 1200 invoiced versus 1176 packed. Get corrected documents or choose and document a defensible treatment; do not silently repair totals. |
| Assist and sample treatment | [VERIFIED - invoice p2] USD 4180 assist is linked to W-B220; sample customs-only value is USD 24. Suggestions are accepted in this review; remaining allocation/evidence checks still require review. |
| Container and gross weight | [VERIFIED - bill p1; packing p1] Handwritten container replacement is visually read as OPLU3041722 and passes the check digit, but carrier confirmation remains open. Gross weight is 1930 kg on B/L versus 1888 kg packed. |
| Dates, materials and source interpretation | [VERIFIED - open-items.json] Remaining evidence/date/composition findings explain exactly what needs review. An acknowledgement records review, not outside regulatory acceptance. |

## Extraction quality and reproduction

[VERIFIED - experiments/prefill-v3/extracted.json; review.json] The response preserved all five lines, the printed price/quantity conflicts, separate freight/insurance, line-specific assist, differing sample origin, and party/manufacturer roles. Audit caught a factory-tax-code/MID error, misread master B/L digits and ambiguous handwritten container lettering. Corrections are separate from immutable raw observations. Confidence scores are model estimates, not accuracy measurements.

[VERIFIED - experiments/prefill-v3/prepare-submission.ts] After `npm run build -w shared`, reproduce these artifacts with `node --import tsx experiments/prefill-v3/prepare-submission.ts` (no API call). `node --import tsx experiments/prefill-v3/run.ts` evaluates the configured model and reuses an identical local cache when available; a fresh clone requires API access. The sample-only artifact script is never imported by application code. It contains explicit reviewed sample decisions, not rules for unseen shipments.

[UNKNOWN] Broad unseen-document accuracy, comprehensive commodity regulation coverage and NetCHB acceptance are not established. Complete AI chat history will be submitted separately by the applicant.
