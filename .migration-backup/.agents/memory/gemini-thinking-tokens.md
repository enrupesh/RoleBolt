---
name: Gemini 2.5 Flash thinking tokens vs max_tokens
description: Gemini 2.5 Flash uses internal reasoning tokens that count against max_tokens, causing JSON truncation and scoringFailed:true when limits are too low.
---

## The Rule
Gemini 2.5 Flash uses ~1900–2000 "thinking/reasoning" tokens internally on complex prompts. These count against `max_tokens`. If `max_tokens` is ≤ 2000, the model may exhaust its budget on reasoning before writing any output — causing `finish_reason: "length"`, truncated/incomplete JSON, and parse failure.

**Why:** Observed in production: `scoreCandidate` with `max_tokens: 2000` produced `reasoning_tokens: 1916`, leaving only 84 tokens for actual output. JSON was cut mid-way, `safeJson` returned null, `scoringFailed: true` on every candidate.

## How to Apply
- Any Mesh API call to `google/gemini-2.5-flash` that produces structured JSON or prose > 100 words needs `max_tokens` well above 2000.
- Safe minimums by output type:
  - Large JSON (scoring rubric, 5+ criteria): 8000
  - Medium JSON (5 questions, analysis): 4000–5000
  - Small JSON (3-field result): 3000
  - Short prose (email, brief): 2000–3000
- Use `finish_reason: "stop"` vs `"length"` in API response to detect truncation.

## Also Fixed Alongside
- `anthropic/claude-3-haiku` returns consistent 503 on this key's tier → replaced with `openai/gpt-4o-mini` in all 10 fallback chains across `recruit.ts` and `recruitForms.ts`.
