# NetCHB Customs Entry XML Preparation & Extraction Engine

> **Turn commercial shipping documents (Invoices, Packing Lists, Bills of Lading) into CBP-compliant NetCHB `uploadEntry` XML with deterministic validation, source provenance tracking, and an interactive broker review workspace.**

---

## 📖 Overview

This TypeScript monorepo provides an end-to-end customs document transcription and entry preparation system:
1. **Multimodal Document Extraction**: Extracts raw observations from commercial PDF documents using Google's Gemini Vision models (`gemini-3.8-flash`) with native structured output, caching, and confidence tracking.
2. **Deterministic Customs Resolver**: Reconciles commercial quantities, integer-cents currency accounting, assists, and statutory discrepancies without hallucination or silent AI guesswork.
3. **Authoritative Reference Data**:
   - **U.S. Ports (Schedule D)**: 429 official Census/CBP ports with role isolation (`unlading-port`, `entry-port`, `processing-port`).
   - **Foreign Ports (Schedule K)**: 2,191 official USACE foreign port records with 5-digit code verification.
   - **Countries (ISO 3166-1)**: 249 authoritative country/area codes.
   - **Reporting Units (UOM)**: 82 NetCHB statistical units extracted directly from `spec/data_type.xsd`.
4. **Interactive Review Workspace (React + Vite)**: Split-pane workspace allowing customs brokers to inspect evidence snippets, resolve open items, perform live reference lookups, apply audited corrections, and preview deterministic XML.
5. **Dual Validation Status**: Separates structural schema validity (`entry.xsd` & `data_type.xsd` via `xmllint-wasm`) from statutory filing readiness ("Ready to Transmit: 0 Blockers").

---

## 🏗️ Architecture & Monorepo Structure

```text
sefer-swe-intern/
├── shared/           # @sefer/shared — Canonical Zod schemas, TypeScript types, and reference data
│   ├── src/schemas/  # Shipment, Broker Decisions, Workflow, and Reference schemas
│   └── src/reference/# Schedule D, Schedule K, Countries, UOM, and Fingerprinting logic
├── server/           # @sefer/server — Node.js Express backend API
│   ├── src/builder/  # Deterministic NetCHB XML builder and xmllint-wasm validator
│   ├── src/checks/   # Statutory compliance checks, integer-cents money math, discrepancy resolver
│   ├── src/extraction# Gemini multimodal vision extraction service and disk caching
│   ├── src/reference/# Authoritative port and reference data resolvers
│   └── data/         # Offline official reference datasets and manifests
├── web/              # @sefer/web — React 18 + Vite frontend application
│   ├── src/components/
│   │   ├── UploadSection.tsx     # Staged document upload with progress tracking
│   │   ├── OpenItemsDrawer.tsx   # 6-section filing review workspace with inline checks
│   │   ├── EvidencePanel.tsx     # Split-pane source snippet and PDF page viewer
│   │   ├── ExtractedFieldsView.tsx # Raw extracted observation tables with audited corrections
│   │   └── XmlPreviewPanel.tsx   # Dual validation status, draft XML, and checked XML export
├── spec/             # NetCHB entry XML schema definitions (entry.xsd, data_type.xsd)
├── samples/          # Sample commercial shipment PDFs (Invoice, Packing List, House BL)
└── docs/             # Technical architecture, AI logs, open questions, and prefill guides
```

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (Recommended: `v24.x`)
- **npm**: `v10.x` or higher
- **Google Gemini API Key**: For live document extraction (free tier supported).

### 2. Installation
Clone the repository and install all workspace dependencies:

```bash
# Install root and workspace dependencies
npm ci
```

### 3. Environment Configuration
Create your local `.env` file from `.env.example`:

```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On Linux / macOS:
cp .env.example .env
```

Open `.env` and set your Google Gemini API key:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_FREE_TIER_CONFIRMED=true
LLM_MODEL=gemini-3.8-flash
LLM_EFFORT=medium
PORT=3001
```

*(Note: `.env` is gitignored. Never commit API keys or credentials).*

### 4. Build & Verify
Compile all TypeScript packages and run the automated test suite:

```bash
# Build all workspaces (shared, server, web)
npm run build

# Run all 123 automated regression & reference tests
npm test
```

Expected test output:
```text
ℹ tests 123
ℹ suites 0
ℹ pass 123
ℹ fail 0
```

---

## 🖥️ Running the Application

Start both the backend server and frontend development server in separate terminals:

### Terminal 1: Backend API
```bash
npm run dev -w server
```
*Backend runs at `http://localhost:3001` (health endpoint: `GET /api/health`).*

### Terminal 2: Web Application
```bash
npm run dev -w web
```
*Frontend runs at `http://localhost:5173` with proxy forwarding `/api` requests to port `3001`.*

Open your browser to: **[http://localhost:5173](http://localhost:5173)**.

---

## 📋 End-to-End Walkthrough

### Step 1: Upload Shipping Documents
1. In the **Upload Documents** section, upload the three sample shipment PDFs from `samples/`:
   - Commercial Invoice: `samples/KBAS-NB-26-0912_Commercial_Invoice.pdf`
   - Packing List: `samples/SPG-PL-2609-117_Packing_List.pdf`
   - Bill of Lading: `samples/BMLVHCM26090418_House_BL.pdf`
2. Click **Upload documents** to stage them, then click **Extract & Validate Shipment**.
3. The extraction runs via Gemini multimodal vision (or retrieves the verified result from `.cache/extractions/` if previously cached).

### Step 2: Review & Resolve Open Items
1. Navigate through the review sections in the top bar:
   - **Filing & Parties**: Supply the Importer EIN, Surety code, and Entry type (`01`). Review the Ultimate Consignee.
   - **Transport & Routing**:
     - Click **`▶ Look up official port code`** under **Port of unlading**, search for `"Tacoma"`, and click **Verify and use** (`3002`).
     - Look up **Foreign port** (`"Ho Chi Minh City"` $\to$ `55201`).
     - Select Mode of Transport (`11` for vessel containerized).
   - **Invoices & Financials**: Confirm Country of Export (`VN`), Currency (`USD`), and resolve any invoice-level remarks or assists.
   - **Goods & Classifications**:
     - Review Line 1–5 merchandise descriptions.
     - Click **`▶ Find ten-digit HTS candidates`** to inspect official tariff subheadings for the 6-digit heading (`610910`, `611020`, etc.).
     - Confirm Country of Origin (`VN` / `BD`).
     - Resolve math discrepancies (e.g. Line 1 printed vs computed value) and quantity choices (e.g. Line 2 shortage of 1,176 packed vs 1,200 invoiced).
   - **Packaging & Containers**: Verify container numbers and seal numbers (including strike-through handwritten corrections: `OPLU3041728` $\to$ `OPLU3041722`).

### Step 3: Inspect Source Evidence & Apply Corrections
- Click **"View source"** next to any observation to see the exact document, page number, and verbatim snippet in the right-hand **Source Evidence** panel.
- If a document value was misread or needs adjustment, click **"Correct field"** to supply a reviewed value, supporting document citation, and reason. Corrections are tracked in an immutable audit trail without altering raw extraction caches.

### Step 4: XML Generation & Export
- **Schema Valid**: Confirmed structurally valid against `entry.xsd` and `data_type.xsd` using `xmllint-wasm`.
- **Ready to Transmit**: Counter updates dynamically as blockers are resolved.
- **Export Options**:
  - **Download Open Items Report**: JSON report of all open compliance blockers and evidence review requests.
  - **Download Draft XML**: Well-formed draft NetCHB XML for intermediate inspection.
  - **Download Checked XML**: Unlocked when 0 blockers remain, producing official production-ready NetCHB `uploadEntry` XML.
- **Save / Resume Session**: Click **"Save review"** to export a local `session.json` checkpoint, allowing you to resume your review anytime without re-extracting PDFs.

---

## 🔒 Security & Project Rules

- **Zero Secret Leakage**: Secrets live strictly in `.env`. Headers sanitize credentials; error messages strip API keys.
- **Evidence Labeling**: All documentation claims are tagged `[VERIFIED]`, `[INFERRED]`, or `[UNKNOWN]`.
- **Deterministic XML**: The LLM never writes XML. XML is built deterministically in TypeScript and validated against the local XSDs.
- **Immutable Provenance**: Every extracted field follows `{ value, status, source: { doc, page, snippet }, confidence }`. Reference lookups and manual overrides are stored separately.
- **Offline Reproducibility**: Official reference datasets (Schedule D, Schedule K, ISO 3166-1, XSD UOMs) are checked into `server/data/` with cryptographic SHA-256 manifests, requiring no external network access at runtime.

---

## 🧪 Testing

```bash
# Run all tests across the monorepo
npm test

# Run tests in watch mode during development
node --import tsx --test server/test/**/*.test.ts
```

Test suites cover:
- Core statutory checks, integer-cents allocation, and discrepancy resolution (`core.test.ts`)
- REST API upload staging, token expiration, and error handling (`api.test.ts`)
- Gemini request/response handling, secret sanitization, and truncation defense (`extraction.test.ts`)
- Schedule D and Schedule K port resolution, role isolation, and disambiguation (`task2-schedule-d.test.ts`, `task3-schedule-k.test.ts`)
- Reference cache security, path traversal prevention, and confirmation scoping (`task1-infrastructure.test.ts`, `adversarial-task1.test.ts`)
- Review workspace UI rendering, PDF matching, and save/resume workflows (`review-export.test.ts`, `frontend-workspace.test.ts`)
