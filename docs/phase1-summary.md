# Corrected Phase 1 scope

[VERIFIED — docs/architecture.md, docs/mapping.md] The earlier completion claims are superseded by the corrected implementation and limitations recorded in these documents. Historical AI log entries are preserved; the new log entry records current verification.

[VERIFIED — server/src/app.ts] Uploads cannot yet perform live extraction. Demo data is available only through an explicit demo route, without filing defaults.

[VERIFIED — server/test/core.test.ts, server/test/api.test.ts] Regression coverage exercises production modules with independent synthetic inputs, malformed/missing values, decision binding, XML/readiness separation, upload handling and reference failures. This is distinct from the historical sample-specific experiment suite.

[UNKNOWN] Live extraction quality, PDF evidence accuracy, regulatory completeness, authoritative code datasets and deployed operation require later phases. This is not a production-ready end-to-end service.

[VERIFIED — AGENTS.md rules 11–12] Stop after Phase 1 verification and obtain approval before Phase 2 API integration.
