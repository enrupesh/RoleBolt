---
name: Form Jobs feature parity
description: Three features added to Form Jobs (recruitForms.ts + forms/[id]/page.tsx) — scoring transparency, per-answer signals, retry scoring.
---

## answerSignals schema

`IAnswerSignal { questionId: string; signal: "strong"|"ok"|"thin"; note: string }` added to `RecruitFormResponse` model with a Mongoose sub-schema and `default: []`. Old documents without the field are safe — UI uses `(r.answerSignals || [])`.

## AI idx → questionId mapping

`scoreFormResponse()` builds `indexedAnswers` (filtered, non-empty answers) and numbers them `[1]…[N]` in the prompt. The AI returns `{ idx, signal, note }` objects. Server maps `idx - 1` → `indexedAnswers[idx-1].questionId`, drops out-of-range or unknown signal values. This is more reliable than asking the AI to reproduce opaque questionId strings.

**Why:** LLMs are unreliable at faithfully reproducing arbitrary opaque IDs; 1-based indices are trivial for the model and unambiguous to map back.

## Retry scoring endpoint

`POST /recruit/forms/:formId/responses/:responseId/retry-score` — auth via uid, ownership verified by finding form AND response scoped to `{ formId, uid }`. Does not enforce `scoringFailed` precondition (allows re-scoring any response).

**How to apply:** If product decision changes to "only allow retry when scoringFailed", add `if (!response.scoringFailed) return res.status(400)...` check.

## ScoringCriteriaCard

Purely client-side — derives score dimensions from `form.questions` (labels + types). Contact questions (email/phone/name keywords + structural types) are excluded. Shows score tier guide (80-100 / 60-79 / 40-59 / 0-39). No backend endpoint needed.

**Why:** The form questions are already loaded on the page; generating criteria from them avoids a round-trip and is always in sync with the form definition.

## Interview Questions endpoint

`POST /recruit/forms/:formId/responses/:responseId/interview-questions` — auth + uid ownership on both form and response. Returns cached `interviewQuestions[]` if already non-empty (no re-call). AI empty-list is treated as a hard error (500), so we never cache `[]`. Frontend guards: only sets `showQuestions(true)` after confirming length > 0; error surfaces inline.

**Why:** Caching via DB field means repeated clicks are instant; rejecting empty lists prevents the silent no-op UX trap where the panel renders nothing but shows no error.

## SignalBadge behavior

`signal === "ok"` renders `null` (no badge) to keep the UI uncluttered. Only "strong" (green) and "thin" (amber) show visible badges. Tooltip shows the AI's `note`. The note is also shown as italic text below the answer in the card view for "strong" and "thin" (not "ok").
