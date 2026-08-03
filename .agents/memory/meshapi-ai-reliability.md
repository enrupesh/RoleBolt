---
name: Mesh API AI call reliability pattern (Recruit backend)
description: Why AI-powered scoring/JD/brief endpoints intermittently 500'd after switching to Mesh API, and the fix pattern used.
---

The backend calls Mesh API (OpenAI-compatible gateway, meshapi.ai) via a shared `callNvidiaChatCompletions` client (names kept from a prior NVIDIA integration). Confirmed via live curl tests against the production Render backend that the API key/model setup itself was correct and returning real AI output — the actual bug was reliability, not credentials.

**Root cause:** none of the ~8 call sites in `backend/src/recruit.ts` passed `retries` or `fallbackModels` (both supported by the client), so any transient failure (timeout, 429, 5xx, one model unavailable) caused an immediate uncaught throw. In `scoreCandidate`/`generateJobDescription` etc. that throw wasn't locally caught either, so it propagated to the Express route handler as a hard 500 — surfacing to users as "Scoring temporarily unavailable" or a failed job-post, even though the integration was fundamentally healthy.

**Why:** the client supported retry/fallback but no caller opted in, and no caller had a local try/catch around the AI call — only unparseable-JSON was treated as a soft failure, not transport errors.

**How to apply:** any new AI call site in this codebase should (1) pass `retries` + `fallbackModels`, and (2) wrap the call in try/catch that degrades to a deterministic fallback (template text, `scoringFailed: true`, default values) rather than letting the exception bubble to the route handler. Also validate parsed-but-structurally-empty AI JSON (e.g. empty score breakdown) as a failure state, not a legitimate 0 score — parseable is not the same as valid.
