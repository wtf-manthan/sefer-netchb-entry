# Prefill and submission audit - 2026-10-10

## Decision: hold final submission
[VERIFIED - user step 2] Material changes remain; stop before final packaging/push. Source prefill.md is preserved and is not authoritative. No application code, runtime prompt, extraction cache, Git index or remote was changed.

| Proposed prefill | Audit finding and recommendation |
|---|---|
| Consignee name/address | [VERIFIED - invoice p1; packing p1; bill p1] Buyer is NORTHBOUND OUTFITTERS, INC., 2150 NW Raleigh Street, Suite 300, Portland OR 97210. Delivery party/B/L consignee is CASCADE FULFILLMENT PARTNERS LLC, Kent. Proposed LLC/address is wrong. [INFERRED] Offer role-labelled candidates; require ultimate-consignee selection, not automatic buyer substitution. |
| Consignee address in XML | [VERIFIED - decisions.schema.ts; xml-builder.ts] Current ultimateConsignee carries name/tax ID only. [INFERRED] Show address as evidence; check the relevant XSD branch before adding XML fields. |
| Foreign port 55201 | [VERIFIED - server/data/reference/schedule-k/ports.json] 55201 is Hai Phong; 55224 Saigon has published Ho Chi Minh City aliases. [VERIFIED - bill p1] Loading says CAT LAI, HCMC, VN. [INFERRED] Offer a reviewed city-level candidate, not an invented exact Cat Lai terminal match. |
| Tacoma | [VERIFIED - bill p1; Schedule D dataset] Tacoma maps to 3002. [INFERRED] Structured port observations can feed existing scoped lookup/acceptance; discharge does not automatically determine entry/processing ports. |
| Transport | [VERIFIED - bill p1] Vessel is PACIFIC ARGOS 041E, with explicit one 20-foot GP container, not the proposed vessel. [INFERRED] Supports an unconfirmed mode 11 suggestion; vessel name alone is insufficient. |
| Export country | [VERIFIED - current v2 cache] Missing, despite loading-place evidence on bill. [INFERRED] Derive a reviewed candidate from routing facts, not seller address or origin alone. |
| FOB / valuation | [VERIFIED - invoice pp1-2] Incoterm is CIF Tacoma, with separately listed FOB subtotal, freight and insurance. [VERIFIED - decisions.schema.ts] App valuationBasis concerns whether line values include charges, not legal valuation method. [INFERRED] Itemization supports a reviewed LINE_VALUES_EXCLUDE_CHARGES suggestion, not a generic FOB/transaction-value default. |
| MID | [VERIFIED - https://www.ecfr.gov/current/title-19/chapter-I/part-102/appendix-Appendix%20to%20Part%20102] Textile/apparel MID can be up to 15 characters, includes first two name words and address rules/exceptions. Proposed fixed 13-character algorithm is wrong. [VERIFIED - invoice p2; packing p1] Seller and actual manufacturers differ; samples reference a Bangladesh sister factory. [INFERRED] Capture manufacturer identity per line; never reuse the sourcing-office MID across products. |
| Quantity/math | [VERIFIED - invoice p1; packing p1] Hoodie: 1200 invoiced versus 1176 packed. T-shirt: printed 6480 versus 2400 x 2.85 = 6840. [INFERRED] Show alternatives/difference, leave conflicts for explicit choice. Suggest only when supported. |
| Assist allocation | [VERIFIED - invoice p2 note (*); packing p1 remarks] USD 4180 fabric assist is tied to W-B220. [INFERRED] Suggest for that unambiguously linked line, not pro-rata across all apparel. Preserve amount and allocation evidence. |
| Statistical quantities | [VERIFIED - HtsLookup.tsx; statistical-units.ts] XSD units are validated; full HTS unit inheritance is not established. [INFERRED] Conversion needs a reviewed classification, required unit, quantity and dimensional factor. Pieces cannot establish weight; gross weight is not a substitute for net statistical weight. |
| Entry 01 / bond 08 / related party No | [INFERRED - absent shipment-specific evidence] Keep explicit filing choices. Shipment value or company names do not establish entry profile, bond coverage or relationship. |

## Cause of blanks
[VERIFIED - shipment.schema.ts] Schema v2 has buyer/shipTo data and mode text but no structured bill ports, manufacturer parties, containerization evidence or structured assist-line relationship. A schema-constrained prompt cannot add unsupported fields.
[VERIFIED - extractor.ts; cache.ts] Cache identity uses an explicitly versioned gemini-v2 prefix and schema 2. Changing prompt text alone can still reuse old results. Version prompt/schema/cache together; preserve old responses rather than deleting all caches.
[VERIFIED - experiments/submission-audit/result.json] All three sample hashes match the current v2 cache. With empty broker decisions: 57 blockers, no XML, schema invalid, not ready, zero inference calls. This does not evaluate a saved user review held elsewhere.

## Minimum release gate
1. [INFERRED] Add a deterministic suggestion layer with original evidence, rule/version and explicit acceptance. Suggestions must not silently become broker decisions.
2. [INFERRED] Add structured routing/manufacturer/assist facts and version prompt/schema/cache together. See extraction-prompt-proposal.md. Test non-apparel, ambiguous parties/ports and conflicts.
3. [INFERRED] Wire party candidates, ports, containerized mode, explicit line assists/sample values and charges basis. Defer general MID generation and HTS conversion unless sourced and tested correctly.
4. [INFERRED] Complete sample review; support a clearly labelled incomplete XML draft plus missing-information report, or obtain required reviewed values. Current builder returns null when core data is missing. Do not invent identifiers/classifications.
5. [VERIFIED - README.md; package.json] README overclaims CBP-compliant/statutory readiness and says Node 20/npm 10 versus declared Node 24/npm 12 engines. [INFERRED] Correct claims/setup; complete clean-install and browser/sample walkthrough.
6. [VERIFIED - git ls-files] .agents/, AGENTS.md and GEMINI.md are tracked; .env was not listed. [INFERRED] Ignore AND remove local-only files from index, retaining local copies. Keep source/tests/XSD/reference data/provenance and assignment docs. Ignore rules alone do not untrack files; do not rewrite history by default.

## Final artifacts
[VERIFIED - XSDs; xml-builder.ts] Text such as 'missing due to ...' cannot replace a typed code/date/number. [INFERRED] Explain gaps in a sidecar report and optional draft XML comments. A draft may remain schema-invalid; say so. A comment-only XML file is not a NetCHB entry.
[VERIFIED - user step 2] Final entry.xml, final README/ignore cleanup, one-page writeup and final push are held for these corrections. User will export the full AI history; ai-log.md is only a summary.
