# Approach and Future Work: NetCHB Entry XML Preparation

**Candidate:** Manthan Khetade &bull; **Position:** Software Engineering Intern &bull; **Project:** Customs Document Extraction & NetCHB Entry XML

---

## 1. System Architecture & End-to-End Workflow

We designed a deterministic, TypeScript-native document-to-entry review workflow that converts commercial shipping documents (Commercial Invoices, Packing Lists, Bills of Lading) into CBP-compliant NetCHB `uploadEntry` XML:
- **Multimodal Document Transcription**: We leverage Gemini 3.8 Flash (`v1beta` native JSON mode) to extract verbatim shipping observations. Every field adheres to an immutable contract: `{ value, status, source: { doc, page, snippet }, confidence }`. File hashes, prompt version, and model parameters key an on-disk cache to guarantee reproducible, zero-cost cache hits on repeated runs.
- **Deterministic XML Engine**: In strict adherence to project rules, the LLM **never** writes XML directly. Instead, verified observations and broker choices feed a deterministic TypeScript builder validated against official NetCHB schemas (`spec/entry.xsd` and `data_type.xsd`) via WebAssembly `xmllint-wasm`. Integer-cents arithmetic prevents floating-point inaccuracies.
- **Dual Validation Status**: The system cleanly decouples structural schema compliance (`Schema Valid: PASS`) from statutory filing completeness (`Ready to Transmit: N Blockers`).

---

## 2. Generalization & Reference Data Integration

To ensure the system generalizes to unseen commercial shipments without hardcoding:
- **Authoritative Reference Data**: Integrated official datasets including Census Schedule D (429 U.S. ports with strict role isolation between unlading, entry, and processing ports), Schedule K (2,191 foreign ports), ISO 3166-1 (249 countries), and 82 statistical units derived directly from `data_type.xsd`.
- **Handling Real-World Discrepancies**: Rather than silently resolving discrepancies, the resolver surfaces invoice math discrepancies (e.g. \$6,480 printed vs computed), packing shortages (1,176 packed vs 1,200 invoiced), assist allocations (\$4,180 buyer-supplied fabric), and handwritten container strike-throughs (`OPLU3041728` $\to$ `OPLU3041722`) as actionable broker decision cards.
- **Scoped Invalidation**: Cryptographic fingerprinting binds reference lookups to underlying document evidence. If an observation or port query is edited, its specific confirmation invalidates without resetting unrelated broker decisions.

---

## 3. Interactive Review Workspace

We built a responsive React 18 / Vite review workspace:
- **Split-Pane Layout**: Displays form fields alongside verified PDF snippets and a local PDF viewer with hash-matched re-attachment.
- **Inline Field Checks**: Actionable blockers and verification notices appear directly next to relevant inputs across 6 structured filing sections.
- **Session Persistence**: Brokers can export a local `session.json` checkpoint to resume reviews later without re-running document extraction.

---

## 4. What I Would Do With More Time

1. **Broader Benchmark & Unseen Commodity Evaluation**: Collect diverse shipments across commodities (e.g. footwear, electronics, chemicals, bulk liquids) to benchmark OCR extraction accuracy and table extraction resilience across different languages and layouts.
2. **Autonomous Customs Classification (HTS & MID)**: Connect official 10-digit tariff hierarchies with duty rate inheritance, Partner Government Agency (PGA) flags (FDA, EPA, DOT), Section 301/232 trade remedies, and automated Manufacturer Identification (MID) derivation.
3. **Multi-Modal Transport & Filing Profiles**: Expand beyond ocean formal consumption (Entry Type 01, Modes 10/11) to support air (`40`), truck (`30`), rail (`20`), bonded warehouse (`11`), foreign trade zones (`21`), and informal entries.
4. **Production Multi-Tenant Storage & Direct EDI**: Implement secure, role-based cloud storage with document retention policies, team audit logs, and direct SFTP/API transmission to NetCHB and CBP ACE test environments.
