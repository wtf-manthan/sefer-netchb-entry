# Reference audit probes

[VERIFIED — audit.ts] From the repository root, run `npm run build -w shared`, then `node --import tsx experiments/reference-audit/audit.ts`. The probe writes only `.cache/reference-audit`. Updated after the repair: it now checks rejection of cross-role writes, impossible dates, conflicting state hints and legacy confirmations. Historical failing output is described in docs/reference-audit.md.

[VERIFIED — migrate-tests.py] One-time migration of legacy test fixtures to scoped APIs. Already executed; do NOT rerun (not idempotent). Current maintained tests are in server/test/reference.

[VERIFIED — fetch.py, discover-usace.py, search-usace.py, download-k.py] These discovery scripts use public HTTP resources and require Python. Run in that order from the repository root. Some Census/CBP downloads returned HTTP 403; the independent public USACE library download succeeded. Results go to `.cache/reference-audit`. Discovery output is not a dataset authority by itself.

[VERIFIED — ../../scripts/import-schedule-k.py] The maintained offline Task 3 importer is `python scripts/import-schedule-k.py` (requires `openpyxl`). It reads the preserved workbook under `server/data/reference/schedule-k`, regenerates JSON and checksums, and performs no network calls. Tests run through `npm test`.
