# NetCHB shipment entry preparation

[VERIFIED - server/src, web/src, shared/src] A locally runnable TypeScript app that turns commercial invoice, packing list and bill of lading PDFs into source-linked observations, reviewed filing decisions and deterministic NetCHB entry XML. It handles arbitrary product descriptions; it does not automatically classify every commodity or support every customs procedure.

[VERIFIED - server/src/checks/index.ts] The implemented filing profile is ocean transport (10/11), entry type 01. Unsupported profiles remain blocked. **Schema valid** and **Ready to transmit** are separate results. Readiness means the implemented local checks passed, not NetCHB/CBP acceptance or comprehensive regulatory compliance.

## Run locally

[VERIFIED - package.json, .env.example, workspace package.json files] Use Node 24.x and npm 12.x. From the repository root:

```sh
npm ci
npm run build
npm test
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell; `cp .env.example .env` elsewhere). Set `GEMINI_API_KEY` and set `GEMINI_FREE_TIER_CONFIRMED=true` only for your own billing-disabled project. The configured model is `gemini-3.8-flash`; access and free-tier quota depend on your project. Paid inference is not supported. Keep `SPEND_CAP_USD=0`. Never commit `.env`.

Start these in separate terminals, from the repository root:

```sh
npm run dev -w server
npm run dev -w web
```

Open http://localhost:5173. The frontend proxies `/api` to port 3001; health is http://localhost:3001/api/health.

[VERIFIED - extractor.ts, cache.ts] PDFs are sent to Gemini only after explicit extraction confirmation. Results are cached under `.cache/extractions/live-v3` using document hashes, model, configuration and prompt/schema identity. Repeat identical requests reuse the cache. Old v2 reviews remain readable, but newly added observations are missing until re-extraction or a source-backed correction. Incomplete responses are rejected. Metrics record tokens and latency; `costUsd: null` means billing was not independently measured. A 429/503 may require retrying later; there is no silent substitute model.

## Review workflow

[VERIFIED - web/src/components] Select PDFs, upload with progress, then choose **Extract** or **Go back**. Review the Shipment, Parties, Invoices, Goods and Transport sections alongside source snippets/PDF pages. Inferred values are marked for verification. Correct misread observations with a source and reason; original extraction remains unchanged.

[VERIFIED - shared/src/suggestions.ts, PortLookup.tsx] The app offers unconfirmed party-role, vessel-containerization, charge-basis, explicitly linked assist and sample-value suggestions. Port observations trigger official-table lookups. Click **Verify and use** to accept a candidate. Entry/processing ports are separate filing decisions. Changed evidence invalidates prior lookup/suggestion acceptance. Country and unit normalization never creates an unknown code.

[VERIFIED - HtsLookup.tsx, server/src/checks] A six-digit HS code is a classification starting point, not enough for the supported ten-digit US tariff field. Search official HTS candidates and supply reviewed classification/reporting quantities. Missing importer IDs, bond information, manufacturer IDs, relationship declarations and statistical quantities stay unresolved. Invoice-versus-packing and price-versus-total conflicts require explicit choices.

[VERIFIED - entry-service.ts, app.ts] Export a checked XML only when schema validation and local checks pass. **Draft XML may omit required elements and fail XSD validation**; its XML comment explains outstanding items, with details in the report. Placeholder prose is never inserted into typed code/date/number elements. Save review JSON to resume; attach local PDFs again for the viewer.

## Submission artifacts

[VERIFIED - submission/] `submission/entry.xml` is the sample **incomplete draft**, with `open-items.json`, `review.json` and `README.md` documenting gaps and reproduction. `docs/approach.md` is the editable one-page writeup; `output/pdf/approach.pdf` is its rendered copy. The user supplies complete AI chat exports separately; `docs/ai-log.md` is only a work summary.

## Design and sources

[VERIFIED - repository files] `shared/` defines evidence, decisions and reference contracts; `server/` extracts, resolves, looks up and validates; `web/` provides review and export. The model emits JSON observations, never XML. Integer-cent calculations and an explicit resolved model feed the XML serializer. Tests include synthetic non-apparel shipments, multiple invoices, conflicts, caching, stale decisions, API boundaries and UI rendering.

[VERIFIED - spec/, docs/research.md] The checked-in NetCHB schemas in `spec/entry.xsd` and `spec/data_type.xsd` define the serialized entry vocabulary; source discovery/provenance is recorded in `docs/`. No live uploadEntry transmission is implemented. [UNKNOWN] NetCHB account-level acceptance has not been tested.

[VERIFIED - server/data/reference/, shared/src/reference/] Bundled Schedule D, Schedule K, country and unit snapshots support offline resolution, with manifests and source attribution. Live USITC lookup is optional and cached; unavailable results do not produce fabricated codes. For this sample, Schedule K maps Saigon / Ho Chi Minh City to **55224**; **55201 is Hai Phong**. Cat Lai requires review of the city-level match, not an asserted exact terminal alias.

## Limits and future work

[INFERRED - current implementation scope] Before broader use, add independent real shipments and labelled extraction evaluations, regulated-commodity and additional entry/mode profiles, complete HTS statistical-unit inheritance, sourced MID construction, dated reference refresh, and carrier/SPI/state validation. These improve coverage and prevent plausible but incorrect filing decisions. Add authenticated encrypted persistence, deployment hardening, observability and a NetCHB test-account integration before production use. See `docs/submission-priorities.md` and `docs/approach.md` for deferred work. Local disk caches/review files contain shipment data and need appropriate access controls.
