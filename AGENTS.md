# Project rules: NetCHB entry XML take-home

Context: TypeScript monorepo (server/, web/, shared/, spec/, samples/, experiments/, docs/). The app turns invoice, packing list and bill of lading PDFs into a NetCHB uploadEntry XML plus an open-items list. It must generalize to unseen shipments; never hardcode anything to the sample shipment.

1. **Evidence labels**: Every claim in docs is tagged VERIFIED (with source URL or file), INFERRED (with reasoning), or UNKNOWN. Never invent codes, port numbers, HTS numbers or schema details. If a source can't be reached or parsed, say so; do not fill gaps from memory.
2. **AI Log**: Keep `/docs/ai-log.md` updated after every task: what was tried, what worked, what failed, what I decided.
3. **Secrets**: Secrets live in `.env` (gitignored). Never print, log or commit them. Keep `.env.example` current.
4. **Open Questions**: Ambiguity goes to `/docs/open-questions.md`. Never choose silently.
5. **Preserve Originals**: Never modify anything in `/spec/original/` or `/samples/original/`. Work on copies.
6. **Deterministic XML**: The LLM never writes XML. XML is built deterministically in code and validated against `entry.xsd` and `data_type.xsd`.
7. **Extraction Structure**: Every extracted field is `{value, status: 'extracted' | 'inferred' | 'missing', source: {doc, page, snippet}, confidence}`. Never turn a missing value into a guess.
8. **Dual Validation Statuses**: Report "Schema valid" and "Ready to transmit (N blockers)" as separate statuses.
9. **Config & Caching**: Model name, effort and spend cap are config (env vars), not hardcoded. Cache every extraction result on disk, keyed by file hash + model + schema version, and never re-call the API when a cache hit exists. Log tokens, cost and latency per call.
10. **Experiments**: Throwaway experiments live only in `/experiments`, each with a README on how to rerun it.
11. **Phase Gates**: Work in phases. Finish the current phase, then STOP and wait for user approval. Do not start the next phase.
12. **Pre-Phase Alignment**: Before each phase, show a short plan and anything needed from the user, then wait for user OK.
13. **Real Command Execution & Verification**: Show real command output (test runs, validator output, cost figures). Never claim something passes without running it.
