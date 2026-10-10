# OpenRouter extraction check

[VERIFIED — run.ts, 2026-10-10] Current runner update: despite this historical directory name, run.ts now uses the configured Gemini adapter. Configure GEMINI_API_KEY, LLM_MODEL and GEMINI_FREE_TIER_CONFIRMED. The render-only path understands Gemini inlineData; successful extraction is written to `.cache/gemini-review`. The older OpenRouter-specific instructions and diagnostic files below are historical, not the app's active provider.

[VERIFIED — availability.ts] Run `node --import tsx experiments/openrouter-extraction/availability.ts` to inspect the public live model catalog without transmitting documents or credentials. To evaluate an explicitly approved candidate without changing .env, append `--model=MODEL_ID` to run.ts. Each model has a separate cache identity.

[VERIFIED — run.ts] From the repository root, run `node --import tsx experiments/openrouter-extraction/run.ts --render-only` to render the sample PDFs without an API call. Images are written under `.cache/render-check` for visual inspection.

[VERIFIED — run.ts] After setting `OPENROUTER_API_KEY` in the gitignored `.env`, run `node --import tsx experiments/openrouter-extraction/run.ts`. The script uses the actual configured extraction service, saves validated observations under `.cache/openrouter-review`, prints counts/cost/cache status without credentials, then verifies cache reuse.

[UNKNOWN] A successful response and valid data shape do not prove transcription accuracy; compare observations and evidence against the PDF pages. No ground-truth fixture is used as model input.

[VERIFIED — transcription.ts] `node --import tsx experiments/openrouter-extraction/transcription.ts` runs the separately approved Dots candidate diagnostic: compact transcription, reasoning disabled, 4,000 output-token limit, two-minute timeout, zero-priced routing. It writes the response under `.cache/openrouter-review`. This diagnostic does not generate application-ready shipment JSON or change the default model.
