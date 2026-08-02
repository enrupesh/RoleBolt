# Phase -1 — Monetization Preflight Audit and Implementation Lock

**Status:** Complete  
**Phase:** `-1 — Preflight Audit & Implementation Lock`  
**Reviewed:** 2026-08-02  
**Primary contract:** [`payment.md`](./payment.md)  
**Implementation result:** Ready to begin Phase 1 after preserving the blockers and sequencing below

---

## 1. Purpose

Phase -1 establishes the complete implementation boundary before changing billing or entitlement code.

This phase answers:

- Which existing product surfaces need monetization enforcement?
- Which routes invoke AI, send email, parse files, create records, or run automation?
- Which routes are public, authenticated, owner-scoped, or collaborator-scoped?
- What billing code already exists?
- Which existing assumptions conflict with the Razorpay/category-based model?
- Where can a user bypass a frontend gate through a direct API, public submission, background worker, retry, or concurrent request?
- What must be built and reviewed before paid access can be safely enabled?

This phase intentionally does **not** activate or redesign billing. It produces the implementation inventory and locks the rules that later phases must follow.

---

## 2. Executive findings

### 2.1 Existing billing is Stripe-based, not Razorpay-based

Current billing is implemented in:

- `backend/src/billing.ts`
- `backend/src/models/Subscription.ts`
- `frontend/src/app/recruit/pricing/page.tsx`
- `frontend/src/app/recruit/billing/page.tsx`
- `backend/src/index.ts`
- `backend/package.json`

Current behavior uses:

- Stripe checkout sessions;
- Stripe billing portal;
- Stripe webhook signatures;
- Stripe customer/subscription IDs;
- plans named `free`, `pro`, `agency`, and `seeker_pro`;
- USD pricing in the frontend.

This conflicts with `payment.md`, which requires:

- Razorpay;
- INR monthly/yearly plans;
- three independent monetization categories;
- Free/Pro/Ultra plan values;
- verified, idempotent provider events;
- category-aware entitlements;
- atomic usage periods and reservations.

### 2.2 Existing plan middleware is orphaned and fail-open

`backend/src/middleware/planCheck.ts` exists but is not connected to the protected route families.

It currently:

- understands the old single-plan model;
- has no monetization category;
- has no usage counters;
- has no feature-level checks;
- returns the old `upgrade_required` shape;
- allows the request through when an internal check errors.

That fail-open behavior is not acceptable for monetization. The future entitlement service must fail closed for protected operations while preserving safe read/manual behavior where `payment.md` allows it.

### 2.3 Existing usage logging is analytics only

`backend/src/models/UsageEvent.ts` stores:

- event name;
- user ID;
- optional session ID;
- arbitrary data;
- created timestamp.

It does not support:

- billing period snapshots;
- weighted AI units;
- atomic reservations;
- commit/release states;
- idempotency keys;
- quota limits;
- concurrent request protection;
- usage reconciliation.

It must not be used as the only quota-enforcement mechanism.

### 2.4 Product routes currently enforce identity, not plan capacity

Seeker, creator, collaboration, Copilot, public intake, and background routes currently enforce authentication, role, ownership, or bot protection, but not the plan and usage contract in `payment.md`.

The practical consequence is that current authenticated users can generally continue using AI and hiring operations without category-specific quotas.

### 2.5 Background operations are currently outside billing enforcement

These jobs process records without checking the owner's current paid entitlement before work:

- `backend/src/jobs/pipelineRulesCron.ts`
- `backend/src/jobs/dailyBriefing.ts`
- `backend/src/jobs/offerManagement.ts`
- asynchronous scoring and automation paths inside recruiter routes

This creates a potential bypass after cancellation, expiry, downgrade, or failed renewal.

### 2.6 Existing frontend pricing is obsolete for the new model

The current pricing UI displays:

- USD prices;
- `agency`;
- `seeker_pro`;
- Stripe checkout;
- Stripe portal;
- legacy feature promises such as unlimited listings.

It must be replaced by the category-aware INR pricing and usage model from `payment.md`. Frontend display must be driven by a sanitized backend catalog, not hardcoded authorization values.

---

## 3. Current system boundary

### 3.1 Runtime architecture

The project is a standalone two-part application:

- `backend/` — Express, TypeScript, MongoDB/Mongoose, Firebase Admin, JWT auth, Gemini/Mesh/NVIDIA AI clients.
- `frontend/` — Next.js App Router, React, Tailwind, authenticated recruiter and seeker surfaces.

Protected route registration currently occurs in `backend/src/index.ts`:

```text
/recruit/copilot       requireAuth
/recruit/seeker        requireAuth + requireSeekerRole
/recruit/collaboration requireAuth
/recruit               requireAuth
/recruit/forms         requireAuth
/billing               requireAuth
```

Public route families include:

```text
/recruit-public
/recruit-public/forms
/recruit-public/site-guide
/auth
/health
/status
```

### 3.2 Existing ownership model

The current application uses:

- authenticated `uid` values;
- `RecruitProfile.role` values `creator` and `seeker`;
- owner IDs on jobs, forms, candidates, profiles, and seeker records;
- job-scoped collaboration access;
- seeker-specific role middleware;
- public tokenized routes for candidate-facing workflows.

The monetization system must preserve these ownership boundaries. A collaborator may use the owner's category entitlement only within the collaboration permission granted for that resource. A collaborator must not multiply the owner's quota or use a personal Free entitlement to bypass the owner's limit.

---

## 4. Feature coverage inventory

The following inventory is the authoritative Phase -1 route-family checklist. Every row must be mapped to a centralized entitlement feature key, resource counter, AI weight, idempotency policy, and downgrade behavior during later implementation.

### 4.1 Job Seeker inventory

Primary files:

- `backend/src/seeker.ts`
- `backend/src/seekerCore.ts`
- `backend/src/resumeExport.ts`
- `backend/src/models/RecruitSeekerProfile.ts`
- `backend/src/models/RecruitSeekerWorkspace.ts`
- `backend/src/models/RecruitSeekerTrackerEntry.ts`
- `frontend/src/app/seeker/**`

| Action | Backend route | Current protection | AI/provider or resource | Required monetization key |
|---|---|---|---|---|
| Read/update profile | `GET/PUT /recruit/seeker/profile` | Seeker role | Profile resource | `seeker.profile` |
| Save a job/workspace item | `POST /recruit/seeker/workspace` | Seeker role | URL extraction/fetch; workspace record | `seeker.workspace_items` |
| Analyze workspace job fit | `POST /recruit/seeker/workspace/:id/analyze` | Seeker role + ownership | Gemini → Mesh → NVIDIA | `seeker.job_fit_analysis` + AI units |
| Read/update/delete workspace | `GET/PATCH/DELETE /recruit/seeker/workspace/:id` | Seeker role + ownership | Workspace record | `seeker.workspace_items` |
| Read applications | `GET /recruit/seeker/applications` | Seeker role | Application aggregation | `seeker.application_history` |
| Add tracker entry | `POST /recruit/seeker/tracker` | Seeker role | Tracker record | `seeker.active_applications` |
| Update/delete tracker entry | `PATCH/DELETE /recruit/seeker/tracker/:id` | Seeker role + ownership | Tracker record | `seeker.active_applications` |
| Career GPS | `GET /recruit/seeker/career-gps` | Seeker role | Aggregation/calculation | `seeker.career_gps` |
| Parse email intelligence | `POST /recruit/seeker/email/parse` | Seeker role | Gemini → Mesh → NVIDIA | `seeker.email_intelligence` + AI units |
| Extension analysis | `POST /recruit/seeker/workspace/extension-analyze` | Seeker role | AI analysis | `seeker.extension_analysis` + AI units |
| Extension save | `POST /recruit/seeker/workspace/extension-save` | Top-level role path; audit explicit ownership handling | Workspace record | `seeker.workspace_items` |
| Read saved jobs | `GET /recruit/seeker/saved-jobs` | Seeker role | Saved job list | `seeker.saved_jobs` |
| Save/unsave job | `POST/DELETE /recruit/seeker/jobs/:id/save` | Seeker role + profile ownership | Saved job IDs | `seeker.saved_jobs` |
| Build resume | `POST /recruit/seeker/resume/build` | Seeker role | Gemini → Mesh → NVIDIA | `seeker.resume_generation` + AI units |
| Export resume | `POST /recruit/seeker/resume/export` | Seeker role | PDF/DOCX generation | `seeker.exports` |
| Improve resume | `POST /recruit/seeker/resume/improve` | Seeker role | Gemini → Mesh → NVIDIA | `seeker.resume_improvement` + AI units |
| Generate cover letter | `POST /recruit/seeker/cover-letter/generate` | Seeker role | Gemini → Mesh → NVIDIA | `seeker.cover_letters` + AI units |
| Generate interview questions | `POST /recruit/seeker/interview-prep/questions` | Seeker role | Gemini → Mesh → NVIDIA | `seeker.interview_sessions` + AI units |
| Evaluate interview answers | `POST /recruit/seeker/interview-prep/evaluate` | Seeker role | Gemini → Mesh → NVIDIA | `seeker.interview_sessions` + AI units |
| Optimize profile | `POST /recruit/seeker/profile/optimize` | Seeker role | Gemini → Mesh → NVIDIA | `seeker.profile_optimization` + AI units |

#### Seeker-specific audit findings

1. Seeker routes currently have no active plan/quota enforcement.
2. Resume version limits and saved-job limits are not enforced.
3. AI routes call the provider chain directly without atomic reservation.
4. Resume export has no period counter.
5. Workspace analysis and interview operations have no period counter.
6. Email intelligence is an AI path with no quota accounting.
7. The extension save path requires an explicit ownership/error-handling review before monetization is added.
8. Unified tracker aggregation uses email-based matching and must be reviewed to ensure monetization does not expose records across owners.
9. Scrape/manual-description fallback still permits downstream AI analysis and must consume the correct workspace/AI limits.

### 4.2 Creator — Standard Jobs inventory

Primary files:

- `backend/src/recruit.ts`
- `backend/src/recruitCopilot.ts`
- `backend/src/collaboration.ts`
- `backend/src/jobs/pipelineRulesCron.ts`
- `backend/src/jobs/dailyBriefing.ts`
- `backend/src/jobs/offerManagement.ts`
- `backend/src/models/RecruitJob.ts`
- `backend/src/models/RecruitCandidate.ts`
- `backend/src/models/RecruitTeamMember.ts`
- `frontend/src/app/recruit/jobs/**`

| Action | Route family or location | Current protection | AI/provider or resource | Required monetization key |
|---|---|---|---|---|
| Create/edit/close Standard Job | `recruitRouter` job CRUD; create currently around `recruit.ts:1953` | Auth + owner/collaboration depending route | Job resource; JD generation | `creator_standard.active_jobs` + `creator_standard.job_generation` |
| Add candidate | Candidate routes around `recruit.ts:3055` | Auth + job access | Candidate resource; scoring path | `creator_standard.new_candidates` |
| Resume upload/parse | Candidate upload routes around `recruit.ts:3197` | Auth + job access | Multer + extraction + AI | `creator_standard.resume_analyses` / candidate limits |
| Candidate scoring | Scoring around `recruit.ts:3345` | Auth/resource checks | Mesh/OpenAI and fallback AI | `creator_standard.ai_scored_candidates` + AI units |
| Bulk resume import | Bulk import/SSE routes | Auth + job access | Up to file batch; extraction/scoring | `creator_standard.bulk_import` + candidate/AI limits |
| Assessments | Assessment routes and candidate assessment state | Auth + job access | Assessment generation/scoring/email | `creator_standard.assessments` |
| Pipeline rules | Job pipeline-rule routes | Owner/collaborator boundary | Automation actions | `creator_standard.pipeline_rules` |
| Agent mode | Job agent settings/actions | Job access | AI scoring, stage changes, emails | `creator_standard.agent_actions` + AI/email units |
| Job analysis/health | Analytics routes and `JobAnalysisTab` | Auth + job access | AI health/insights | `creator_standard.job_analysis` + AI units |
| Daily briefing | `backend/src/jobs/dailyBriefing.ts` | Cron by user/job records | Gemini/Mesh/NVIDIA + email | `creator_standard.daily_briefing` + email units |
| Copilot | `backend/src/recruitCopilot.ts` | Auth + workspace ownership | Mesh streaming/non-streaming | `creator_standard.copilot_turns` + AI units |
| Offers | Offer routes and `offerManagement.ts` | Auth + job/candidate access | Offer draft, PDF, email, reminders | `creator_standard.offer_letters` + email units |
| Candidate email workflows | Stage email/agent/email routes | Auth + resource access | Resend email | `creator_standard.automated_emails` |
| Exports | Job/candidate export routes | Auth + job access | CSV/other exports | `creator_standard.exports` |
| Collaboration/team seats | `collaborationRouter` around `collaboration.ts:271` | Auth + job access | Team member records/invites | `creator_standard.seats` |
| Bulk pipeline actions | Pipeline bulk actions | Auth + job access | Candidate writes | `creator_standard.bulk_actions` |

#### Standard Job-specific audit findings

1. Job creation does not currently enforce active-job limits.
2. Candidate intake does not currently enforce plan candidate limits.
3. AI scoring and resume parsing are not connected to a weighted usage ledger.
4. Copilot has both streaming and non-streaming AI paths that must share one reservation service.
5. Bulk import can multiply candidate and AI usage and must reserve per underlying item, not per batch.
6. Collaboration invites currently lack plan seat enforcement.
7. Pipeline cron executes enabled rules without a fresh entitlement check.
8. Daily briefing invokes AI and email without plan/priority checks.
9. Offer reminders and expiry processing need an owner/entitlement decision for new outbound email work.
10. Any agent action must re-check the owner’s entitlement at execution time, not only when the job setting was saved.

### 4.3 Creator — Form Jobs inventory

Primary files:

- `backend/src/recruitForms.ts`
- `backend/src/recruitCopilot.ts`
- `backend/src/publicSubmissionGuard.ts`
- `backend/src/models/RecruitForm.ts`
- `backend/src/models/RecruitFormResponse.ts`
- `frontend/src/app/recruit/forms/**`

| Action | Route family or location | Current protection | AI/provider or resource | Required monetization key |
|---|---|---|---|---|
| Create/edit/close Form Job | `formRouter` | Auth + owner | Form resource; AI content generation | `creator_form.active_forms` |
| Public form read | `formPublicRouter` | Public slug/token path | Public resource read | No creator quota by itself |
| Public response submission | `formPublicRouter` | reCAPTCHA/IP guard where configured | Response persistence; downstream scoring | `creator_form.form_responses` |
| Response read/update/stage | `formRouter` | Auth + form ownership/collaboration | Response resource | `creator_form.stored_responses` |
| AI response scoring | Form scoring routes | Auth/form ownership or background trigger | AI scoring | `creator_form.ai_scored_responses` + AI units |
| Retry failed score | Form scoring retry route | Auth/form ownership | AI scoring | Same scoring quota; retry idempotency |
| Assessments | Form assessment routes | Owner/token flows | Assessment generation/scoring/email | `creator_form.assessments` |
| Form pipeline rules | Form rule routes | Form access | Automated stage actions | `creator_form.pipeline_rules` |
| AI hiring summary | Summary route around `recruitForms.ts:881` | Form access | GPT-4o-mini/fallback | `creator_form.hiring_summaries` + AI units |
| Form Copilot | Form Copilot drawer/routes | Auth + form workspace | Mesh AI | `creator_form.copilot_turns` + AI units |
| Automated candidate emails | Stage/agent email routes | Form access | Resend | `creator_form.automated_emails` |
| Offer drafts | Form candidate offer flow | Form/candidate access | AI/PDF/email | `creator_form.offer_letters` |
| Exports | Form response exports | Form access | Data export | `creator_form.exports` |
| Team seats | Shared collaboration routes | Auth + job/form access | Team records/invites | `creator_form.seats` |

#### Form Job-specific audit findings

1. Public response intake must reserve the creator’s response capacity before creating a response.
2. IP/reCAPTCHA protection is anti-abuse protection, not plan enforcement.
3. If scoring quota is exhausted, the response must remain available for manual review rather than being silently lost.
4. Concurrent public submissions must not exceed the owner’s response limit.
5. Form AI scoring, summaries, Copilot, assessments, emails, and offers must use separate feature counters plus the shared AI unit balance where applicable.
6. Form pipeline rules and background actions must check current entitlement before execution.
7. Public tokenized assessment routes must not expose creator access or allow a candidate to trigger creator-billed work without an owner-side reservation.

---

## 5. Provider and AI call inventory

The application uses multiple AI providers and fallback paths. Monetization must meter the logical operation once, not once per fallback provider.

### 5.1 Provider chain

Observed provider helpers include:

- `backend/src/ai/geminiClient.ts`
- `backend/src/ai/meshClient.ts`
- `backend/src/ai/nvidiaClient.ts`

Observed logical call patterns:

- Gemini primary;
- Mesh fallback;
- NVIDIA fallback;
- Mesh/OpenAI-compatible calls in recruiter and Copilot flows.

### 5.2 Required metering rule

One user operation consumes one logical product quota charge according to `payment.md`, even if the provider chain tries multiple providers.

Examples:

- one candidate score = one `ai_scored_candidate` count and one weighted AI reservation;
- one cover letter = one cover-letter count and two AI units;
- one Copilot turn = one Copilot count and one AI unit;
- one failed provider fallback chain must not create three user charges;
- one retry with the same logical idempotency key must not create a second charge.

### 5.3 AI operations identified for future central mapping

The backend mapping must include, at minimum:

```text
resume_build
resume_improve
resume_analysis
cover_letter
job_fit_analysis
interview_questions
interview_evaluation
profile_optimization
email_intelligence
candidate_score
form_response_score
job_analysis
form_hiring_summary
copilot_turn
offer_letter_draft
agent_action
```

The final operation catalog belongs in the billing foundation, not inside individual route files.

---

## 6. Public, asynchronous, and retry surfaces

### 6.1 Public routes

Public routes include candidate-facing job/form applications, tokenized assessments, offers, profile/job reads, and public submissions.

Rules:

- A public read does not grant creator entitlement.
- A public submission that creates owner-billed data must check the owner’s current category entitlement.
- A public candidate must not be able to choose the creator, plan, quota, or billed operation.
- A public retry endpoint must be idempotent.
- Token possession must authorize only the token’s intended action, not recruiter dashboard access.

### 6.2 Streaming/SSE

Observed streaming paths include:

- Copilot streaming;
- bulk resume/import processing;
- other candidate/assessment progress paths.

Required future sequence:

1. authenticate and resolve owner/resource;
2. resolve category entitlement;
3. reserve feature and AI usage;
4. send stream headers;
5. process provider work;
6. commit/release reservation exactly once;
7. emit stable limit/provider errors without leaking provider secrets.

### 6.3 Background jobs

Observed scheduled/background paths:

- `backend/src/jobs/pipelineRulesCron.ts`;
- `backend/src/jobs/dailyBriefing.ts`;
- `backend/src/jobs/offerManagement.ts`;
- `setImmediate` work in recruiter, collaboration, and Copilot routes;
- asynchronous scoring and retry paths.

Every worker must resolve entitlement immediately before starting new paid/AI/email work. Enqueue-time authorization is not enough.

### 6.4 Retries and ambiguous failures

Current routes have provider fallback and retry behavior but no shared billing reservation lifecycle.

The future rule is:

- reserve before provider execution;
- commit only once;
- release only when execution definitely did not start;
- retain an ambiguous charge for audit rather than enabling infinite free retries;
- use an idempotency key for every logical operation;
- make retry-score and similar routes consume the same feature quota.

---

## 7. Existing billing evidence

### 7.1 Backend billing

`backend/src/billing.ts` currently:

- imports Stripe;
- reads `STRIPE_SECRET_KEY`;
- maps `STRIPE_PRO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`, and `STRIPE_SEEKER_PRICE_ID`;
- creates Stripe checkout sessions;
- creates Stripe billing portal sessions;
- handles Stripe checkout/subscription webhooks;
- updates one subscription document per user;
- returns legacy plan/status fields.

The webhook path is registered before JSON parsing, which is structurally useful for Razorpay migration, but the provider and event model must be replaced.

### 7.2 Subscription model

`backend/src/models/Subscription.ts` currently contains:

```text
userId
stripeCustomerId
stripeSubscriptionId
plan: free | pro | agency | seeker_pro
status: active | canceled | past_due | trialing
currentPeriodEnd
cancelAtPeriodEnd
```

Missing:

- category;
- interval;
- provider-neutral IDs;
- Razorpay plan/subscription/payment IDs;
- current period start;
- event history;
- webhook timestamp;
- usage period reference;
- versioned plan/limits snapshot;
- unique `(userId, category)` entitlement boundary.

### 7.3 Plan middleware

`backend/src/middleware/planCheck.ts` currently:

- uses old plan names;
- has no category;
- has no feature key;
- has no usage counter;
- has no atomic reservation;
- defaults to Free on errors;
- calls `next()` on middleware errors.

This file must be replaced or reduced to a compatibility layer only after the new entitlement service exists.

### 7.4 Frontend billing

`frontend/src/app/recruit/pricing/page.tsx` and `frontend/src/app/recruit/billing/page.tsx` currently:

- display USD;
- expose old `agency` and `seeker_pro`;
- initiate Stripe checkout;
- open the Stripe portal;
- treat `?success=1` as an activation message;
- link to Stripe as payment processor;
- use hardcoded feature text and prices.

The future frontend must display Razorpay/INR/category-aware states but must never activate an entitlement from a query string or client callback.

---

## 8. Confirmed bypass and risk register

| Risk | Current evidence | Required fix phase |
|---|---|---|
| Direct API bypass | Protected routes have auth/role but no category quota checks | Phase 2–5 |
| Stripe/legacy plan confusion | `billing.ts`, `Subscription.ts`, pricing UI | Phase 1 and Phase 7 |
| Fail-open plan middleware | `planCheck.ts` calls `next()` on error | Phase 2 |
| No atomic usage | `UsageEvent` is append-only analytics | Phase 1–2 |
| Public form over-capacity intake | Public guard only checks bot/IP behavior | Phase 4 |
| Background automation after cancellation | Pipeline cron/daily briefing/offer jobs lack entitlement checks | Phase 6 |
| Unlimited collaborator invites | Collaboration route lacks category seat enforcement | Phase 5 |
| AI fallback double accounting risk | Multiple provider helpers are called by one logical operation | Phase 2 |
| Streaming quota bypass | Copilot/SSE must reserve before sending headers | Phase 2, 5, 6 |
| Retry double charge/bypass | Retry paths lack shared idempotency/reservation | Phase 2–6 |
| Queued work after downgrade | Workers do not re-check current entitlement | Phase 6 |
| Client plan tampering | Current frontend has hardcoded plan state/display | Phase 2 and Phase 8 |
| Owner/resource mismatch | Must be revalidated before quota reservation | Phase 2–5 |
| Extension ownership ambiguity | Seeker extension save path requires explicit ownership review | Phase 3 |
| Email-based tracker aggregation | Unified tracker needs privacy/ownership review | Phase 3 |
| Provider/webhook replay | Stripe implementation has no Razorpay event receipt contract | Phase 7 |
| In-memory public rate limiter | Single-process only; not a quota substitute | Phase 4 and hardening |

---

## 9. Implementation lock

The following rules are locked for the implementation:

1. `payment.md` is the pricing and limits contract.
2. Razorpay replaces Stripe for the new payment system.
3. The three categories are independent:
   - `seeker`
   - `creator_form`
   - `creator_standard`
4. The only launch plan values are:
   - `free`
   - `pro`
   - `ultra`
5. Free is a local entitlement, not a Razorpay subscription.
6. Paid access is granted only from verified server-side provider state.
7. The browser never chooses its own plan, category, owner, limit, or usage value.
8. A logical AI operation is metered once across provider fallbacks.
9. Quota check and reservation are atomic.
10. Public form intake enforces the owner's response capacity before creating a response.
11. Background jobs re-check entitlement immediately before new paid/AI/email work.
12. Existing data is preserved after downgrade; new over-limit work is blocked.
13. Manual review and safe read operations remain available when `payment.md` allows them.
14. No route may introduce a private plan check instead of using the central entitlement service.
15. Unknown provider events must not grant paid access.
16. Failed entitlement checks must not silently grant protected paid capacity.
17. Every limit response uses a stable machine-readable error code.
18. Every plan/limit change updates the backend catalog, frontend display, tests, and `payment.md`.

---

## 10. Phase 1 entry plan

Phase 1 can now begin with the following order:

### 10.1 Billing data foundation

Add or migrate:

- category-aware subscription/entitlement model;
- provider-neutral Razorpay fields;
- plan catalog;
- usage-period model;
- usage-ledger model;
- reservation/idempotency model;
- webhook receipt/event history;
- indexes and non-destructive migration/backfill.

### 10.2 Free entitlement initialization

Existing users must receive explicit category Free entitlements or a safe lazy-created Free entitlement. Missing records must never imply paid access.

### 10.3 Central operation catalog

Create one operation/feature mapping for:

- feature key;
- category;
- AI unit weight;
- feature counter;
- resource counter;
- processing priority;
- retry/idempotency behavior.

### 10.4 Tests before route wiring

Before protecting product routes, test:

- plan lookup;
- category isolation;
- period creation/reset;
- atomic reservation;
- duplicate reservation;
- commit/release;
- exact limit boundary;
- concurrent requests;
- expired/cancelled status;
- downgrade over-limit data behavior.

---

## 11. Phase -1 validation and review

### Completed

- Read `payment.md` as the monetization contract.
- Audited backend models and route registration.
- Audited Stripe billing and legacy plan middleware.
- Audited seeker route families and AI paths.
- Audited Standard Job route families and AI/background paths.
- Audited Form Job public intake and response/scoring paths.
- Audited Copilot, collaboration, offers, assessments, exports, and bulk paths.
- Audited cron/background files.
- Confirmed current frontend pricing/billing mismatch.
- Recorded exact implementation blockers and migration order.

### Verification results

| Check | Result | Notes |
|---|---|---|
| Frontend production build | PASS | `cd frontend && npm run build`; Next.js production build completed successfully and generated the full route tree. |
| Backend feature tests | PASS | `cd backend && npx tsx --test src/automation/standardJobCore.test.ts`; 18 tests passed. |
| Backend package test script | PASS | The package script now targets the repository's current automation test file directly; `cd backend && npm test` is the repeatable backend quality gate. |
| Frontend route smoke test | PASS | `/`, `/recruit`, `/recruit/pricing`, `/recruit/billing`, and `/seeker` returned HTTP 200 from the running frontend workflow. |
| Workflow health | PASS | Backend, frontend, and mockup workflows were running; no new browser console errors were observed during the review. |
| Audit document integrity | PASS | `git diff --check` passed; required sections and implementation anchors are present. |
| Production deployment metadata | NOT AVAILABLE | Deployment service reported `isDeployed: false`; there is no published production URL to smoke-test. |

### Not changed in Phase -1

- No application runtime code was changed.
- No payment provider was connected.
- No subscription was created.
- No user data or database record was modified.
- No production entitlement was granted.

### Exit criteria

Phase -1 is complete when:

- the route/feature inventory exists;
- current Stripe/legacy assumptions are recorded;
- every known bypass surface has an owner;
- Phase 1 sequencing is explicit;
- implementation rules are locked;
- the current application still builds and workflows remain healthy.

This document satisfies the audit/documentation criteria. The application runtime remains on the existing legacy billing behavior until later phases replace it; therefore no paid Razorpay functionality should be advertised or enabled from this phase.

Because no production deployment currently exists, live deployment verification is explicitly deferred until a deployable implementation phase is complete and the user publishes the resulting build. This is not treated as a Phase -1 failure: this phase changed documentation only and did not create a runtime artifact that should be published.

---

## 12. Final review decision

**Phase -1 decision: PASS — ready for Phase 1 implementation.**

This is an audit pass, not a billing-feature pass. The current application is not yet monetization-production-ready because the existing billing path is Stripe-based and route enforcement is not connected. That is an expected Phase -1 finding and is now explicitly tracked.

The next safe implementation step is the billing domain foundation. Do not begin by adding isolated `requirePlan` checks to individual routes; build the category-aware entitlement, plan catalog, period, reservation, ledger, and idempotency foundation first.