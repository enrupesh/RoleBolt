# Phase 1 — Job Seeker Enforcement Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 1  
**Result:** Phase 1 review gate **PASSED**

---

## 1. Scope

Protect every Job Seeker route in the Phase -1 audit matrix with Pattern A (resource limits) and Pattern B (atomic AI reservations). Manual edits remain available when AI quota is exhausted.

---

## 2. Inventory coverage

| Route / action | Pattern | Operation / counter | Status |
|---|---|---|---|
| `PUT /profile` | A | projects, certifications, resume versions | ✅ |
| `POST /workspace` | A + optional B | workspace_items, application_history, active_applications, job_fit_analysis | ✅ |
| `POST /workspace/:id/analyze` | B | job_fit_analysis | ✅ |
| `PATCH /workspace/:id` | A | active_applications on apply transition | ✅ |
| `POST /tracker` | A | active_applications | ✅ |
| `PATCH /tracker/:id` | A | active_applications on active stage | ✅ |
| `POST /email/parse` | B + conditional A | email_intelligence; active_applications only for active stages | ✅ |
| `POST /workspace/extension-analyze` | B | extension_analysis (request idempotency) | ✅ |
| `POST /workspace/extension-save` | A + optional B | workspace_items, application_history, job_fit_analysis | ✅ |
| `POST /jobs/:id/save` | A | saved_jobs | ✅ |
| `POST /resume/build` | B | resume_build | ✅ |
| `POST /resume/improve` | B | resume_improve | ✅ |
| `POST /resume/export` | B | export_seeker → exports | ✅ |
| `POST /cover-letter/generate` | B | cover_letter | ✅ |
| `POST /interview-prep/questions` | B | interview_questions | ✅ |
| `POST /interview-prep/evaluate` | B | interview_evaluation | ✅ |
| `POST /profile/optimize` | B | profile_optimization | ✅ |
| `POST /recruit/seeker/jobs/:jobId/apply` | A + B | active_applications + job_fit_analysis | ✅ |
| Public job match | B (auth required) | job_fit_analysis | ✅ |
| Public job alerts create | A | job_alerts (owner or Free anonymous cap) | ✅ |

Reads / deletes / manual field edits remain unmetered.

---

## 3. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Billing owner = authenticated seeker uid | ✅ | Collaborator owner helper unused on seeker (self-owned) |
| Resource limits before create | ✅ | workspace, applications, saved jobs, projects, certs, resumes, alerts, history |
| reserveUsage before every AI call | ✅ | via `runSeekerBillingOperation` / `executeBillingOperation` |
| One charge per provider fallback chain | ✅ | `callAI` inside billing wrapper |
| Stable error codes + frontend hooks | ✅ | `SeekerErrorNotice` on seeker pages + match/alerts |
| Manual ops free when AI exhausted | ✅ | profile PUT non-capacity fields; status edits |
| Tests: AI exhaustion, resource, downgrade, bypass | ✅ | `seekerEnforcement.test.ts` |

---

## 4. Review gate

| Check | Result |
|---|---|
| Free AI limit → `PLAN_LIMIT_REACHED` 409 | ✅ unit coverage of limit serialization |
| 4th workspace item blocked on Free | ✅ |
| Forged plan / non-razorpay provider → Free | ✅ |
| Manual profile capacity when AI exhausted | ✅ |
| Free catalog spot-check values | ✅ match `payment.md` §4.2 |
| `tsc --noEmit` / `npm test` | ✅ |

---

## 5. Key implementation notes

1. **Resume versions** — `enforceAndSyncSeekerResumeVersion` asserts stored capacity then syncs `RecruitSeekerResumeVersion`.
2. **Email intel** — only asserts `active_applications` when creating/moving into an active stage.
3. **Extension analyze** — uses request-level idempotency keys so re-analyze is a new billable action unless the client retries with the same `Idempotency-Key`.
4. **Public match** — requires auth and meters `job_fit_analysis` (closes unauthenticated AI bypass).
5. **Job alerts** — owner-scoped via profile email; anonymous emails capped at Free `job_alerts` limit.

---

3. **Tests are unit-level** for review-gate semantics (limit serialization, Free catalog values, forged provider → Free). Live Mongo/HTTP seeker route smoke remains optional when `MONGODB_URI` is available.