---
name: Form assessment architecture
description: Tokenized Form assessments, asynchronous scoring, retry behavior, and hiring workflow integration.
---

Form Job assessments remain on `RecruitFormResponse` rather than being converted into Standard candidates. Recruiter-only send/retry/analytics routes use both Form ownership and response `uid`; candidates use an unguessable assessment token through separate public Form routes. Submission persists immediately, scoring runs asynchronously, and `assessmentRunKey` makes scoring and downstream stage/rule evaluation idempotent. Failed scoring is explicit and recruiter-retryable.

**Why:** Form responses must retain custom-answer scoring and Form-specific evidence, while candidate-facing submission must never wait on AI or allow replay after completion.

**How to apply:** Preserve the separate `/recruit-public/forms/assessment/:token` lifecycle, keep failed scores out of pass/average metrics, and only trigger `assessment → scored` plus pipeline evaluation after a successful guarded score update.