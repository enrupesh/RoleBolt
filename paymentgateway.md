# Rolebolt Payment Gateway & Billing — End-to-End Implementation Plan

**Status:** Authoritative implementation roadmap (single source of truth for execution)  
**Created:** 2026-08-02  
**Product contract:** [`payment.md`](./payment.md) — pricing, limits, philosophy, and customer-facing rules  
**This document:** Independent audit, architecture, phased execution, review gates, and completion criteria  

---

## How to use this document

If you are an AI or developer starting a **new chat with only this file**, read it in this order:

1. **Section 1–2** — What Rolebolt is and what the owner wants.
2. **Section 3** — What already exists in the repo and whether it is correct.
3. **Section 4** — Architecture you must follow.
4. **Section 5** — The phased roadmap (execute in order; do not skip review gates).
5. **Section 6–8** — Enforcement rules, Razorpay lifecycle, and frontend UX requirements.
6. **Section 9** — Final acceptance checklist (101% complete definition).

Do **not** treat the previous developer's phase review markdown files as authoritative. They are reference only. This document reflects an **independent verification** of the codebase as of 2026-08-02.

---

## 1. Project context

**Rolebolt** is a two-part application:

| Part | Stack | Role |
|---|---|---|
| `backend/` | Express, TypeScript, MongoDB/Mongoose, JWT auth, Gemini/Mesh/NVIDIA AI | APIs, billing, enforcement, webhooks, background jobs |
| `frontend/` | Next.js App Router, React, Tailwind | Recruiter dashboard, seeker workspace, pricing/billing UI |

Protected route families (all require JWT except where noted):

```text
/recruit/seeker          — Job Seeker (requireSeekerRole)
/recruit                 — Standard Jobs (creator)
/recruit/forms           — Form Jobs (creator)
/recruit/copilot         — Recruiter Copilot
/recruit/collaboration   — Team collaboration
/billing                 — Catalog (public), entitlements & checkout (auth)
/recruit-public/forms    — PUBLIC form submission (critical bypass surface)
```

---

## 2. Owner vision (non-negotiable)

### 2.1 Three independent monetization categories

Each account may hold **three separate entitlements**:

| Category key | Product |
|---|---|
| `seeker` | Job Seeker — resumes, applications, interview prep, workspace |
| `creator_form` | Job Creator — Form Jobs |
| `creator_standard` | Job Creator — Standard Jobs (full ATS) |

Categories are **independent**. A Standard Jobs Pro subscription must not unlock Form Jobs limits.

### 2.2 Three tiers per category

| Tier | Purpose |
|---|---|
| **Free** | Permanent demonstration — real product, **very strict limits**, not a trial |
| **Pro** | Default recommended plan — best value for active users |
| **Ultra Pro** | High volume, automation-heavy, team-scale usage |

### 2.3 Free plan philosophy

Free users must:

- See and touch almost every major feature
- Complete a small, real workflow (one hiring campaign, one application flow, etc.)
- Feel the product is excellent and worth paying for

Free users must **not**:

- Use the platform as their primary professional tool
- Bypass limits through API calls, public forms, background jobs, retries, or concurrent requests
- Receive paid access because a subscription record is missing, a legacy Stripe field exists, or the client sends a plan value

**Conversion goal:** User experiences value → hits a recurring bottleneck → upgrades.

### 2.4 Enforcement philosophy

| Rule | Detail |
|---|---|
| Backend is authoritative | Frontend gates are UX only |
| Atomic quotas | Reserve → execute → commit/release; never read-then-increment |
| Fail closed | Unknown counters, config errors, and auth failures must not grant paid capacity |
| Stable error codes | e.g. `PLAN_LIMIT_REACHED`, `AI_SCORE_QUOTA_EXHAUSTED` — never match English text |
| Public forms | Creator quota reserved **before** response record is created |
| Background jobs | Fresh entitlement check immediately before processing |
| One logical AI charge | Provider fallback chains (Gemini → Mesh → NVIDIA) charge once per user operation |
| Downgrade | Preserve data; block new over-limit work only |
| Payments | Razorpay, INR, India-first pricing |

### 2.5 Payment security rule

**Checkout success, redirect query params, and client callbacks never activate paid access.**

Paid access is granted only after:

1. Server-side Razorpay subscription/payment verification
2. Valid webhook HMAC signature
3. Idempotent webhook processing
4. Auditable local subscription state transition

### 2.6 Pricing (INR, from `payment.md`)

| Category | Pro (monthly) | Ultra Pro (monthly) |
|---|---:|---:|
| Job Seeker | ₹99 | ₹249 |
| Form Jobs | ₹499 | ₹999 |
| Standard Jobs | ₹999 | ₹1,999 |

Annual ≈ two months free. Exact paise amounts live in the backend catalog (`planCatalog.ts`).

---

## 3. Independent audit — what exists today

### 3.1 Completion estimate

| Layer | Status | ~Complete |
|---|---|---:|
| Product spec (`payment.md`) | ✅ Done | 100% |
| Billing data models | ✅ Done | ~90% |
| Plan catalog & limits | ✅ Done | ~95% |
| Entitlement resolver | ⚠️ Done with bugs | ~80% |
| Atomic usage reservation engine | ✅ Done | ~85% |
| Enforcement middleware (library) | ⚠️ Partial | ~50% |
| Razorpay provider integration | ⚠️ Partial | ~60% |
| **Product route enforcement** | ❌ **Not started** | **0%** |
| Public form quota protection | ❌ Not started | 0% |
| Background job enforcement | ❌ Not started | 0% |
| Frontend billing/pricing UX | ❌ Legacy Stripe/USD | 0% |
| Security hardening & production review | ❌ Not started | 0% |

**Overall billing system completion: ~30–35%.** The foundation is real but the product is completely unmonetized.

---

### 3.2 What was built (keep and build on)

#### Billing models (`backend/src/models/`)

| Model | Purpose | Verdict |
|---|---|---|
| `Subscription.ts` | Category-aware, provider-neutral subscription | ✅ Keep — correct shape |
| `UsagePeriod.ts` | Per-period counter snapshots | ✅ Keep |
| `UsageLedger.ts` | Reservation/commit/release audit trail | ✅ Keep |
| `BillingCheckout.ts` | Checkout idempotency | ✅ Keep |
| `BillingEvent.ts` | Webhook idempotency | ✅ Keep |

#### Billing services (`backend/src/billing/`)

| File | Purpose | Verdict |
|---|---|---|
| `planCatalog.ts` | Backend-owned INR catalog; limits match `payment.md` | ✅ Keep — verified aligned |
| `entitlements.ts` | Resolve plan; default to Free safely; ignore legacy Stripe plans | ⚠️ Keep — fix cancellation-at-period-end bug |
| `usage.ts` | Atomic `reserveUsage` / `commitUsage` / `releaseUsage` with Mongo transactions | ✅ Keep — core security primitive |
| `enforcement.ts` | Feature flags, limit checks, stable error serialization | ✅ Keep |
| `middleware.ts` | Express middleware for entitlement/feature/resource limits | ⚠️ Keep — extend for usage reservations |
| `operationCatalog.ts` | AI operation weights | ⚠️ Keep — **incomplete**; must expand |
| `resourceCounters.ts` | Owner-scoped DB counts for active/stored resources | ⚠️ Keep — **inaccurate for some counters** |
| `periods.ts` | UTC billing period windows | ✅ Keep |
| `api.ts` | Public catalog + authenticated entitlements endpoint | ✅ Keep |
| `razorpayApi.ts` | Checkout, verify-checkout, webhook route | ✅ Keep |
| `razorpayLifecycle.ts` | Webhook reconciliation | ⚠️ Keep — fix cancel-at-period-end handling |
| `migrateFreeEntitlements.ts` | One-time backfill script | ✅ Keep — must also wire signup |

#### Tests

| File | Coverage | Verdict |
|---|---|---|
| `planCatalog.test.ts` | Catalog completeness | ✅ Keep |
| `enforcement.test.ts` | Limit/error shape unit tests | ✅ Keep |
| `razorpay.test.ts` | Signature + lifecycle mapping | ✅ Keep |
| MongoDB integration tests for concurrent reservation | ❌ Missing | Must add in Phase 0 |

#### Route registration (`backend/src/index.ts`)

- Razorpay webhook registered **before** `express.json()` — ✅ correct
- `razorpayBillingRouter` mounted **before** legacy `billingRouter` — ✅ correct (Razorpay checkout wins over retired Stripe 410)

---

### 3.3 Verified gaps and bugs (must fix)

#### Critical — product is unprotected

1. **Zero route wiring.** `seeker.ts`, `recruit.ts`, `recruitForms.ts`, `recruitCopilot.ts`, `collaboration.ts` have **no billing imports**. Any authenticated user has unlimited AI and hiring capacity.

2. **Public form intake unprotected.** `formPublicRouter` does not reserve creator `form_responses` quota before creating a response. Concurrent submissions can exceed limits.

3. **Background jobs unprotected.** `pipelineRulesCron.ts`, `dailyBriefing.ts`, `offerManagement.ts`, and async scoring paths do not re-check entitlement before work.

#### Foundation bugs

4. **Cancellation at period end broken.** `entitlements.ts` only treats `active | authenticated | trialing` as paid. When Razorpay sends `subscription.cancelled` with `cancelAtPeriodEnd`, user **immediately loses paid access** even though `payment.md` §11.4 requires access until period end. Fix: if `cancelAtPeriodEnd === true` and `currentPeriodEnd > now`, retain paid plan limits.

5. **`initializeFreeEntitlements()` not called on signup.** `auth.ts` signup creates a User but no Subscription records. Entitlement resolver falls back to in-memory Free (works) but usage periods and explicit records are inconsistent until migration runs.

6. **Operation catalog incomplete.** Only ~17 operations defined. Missing at minimum: `agent_action`, `daily_briefing`, `assessment_generate`, `assessment_score`, `automated_email`, `bulk_import_item`, `resume_parse`, `seeker_copilot_turn`, `pipeline_rule_execution`, `export`, and others mapped in `payment.md` §5.

7. **Resource counter inaccuracies:**
   - `active_resume_versions` / `stored_resume_versions` return 0 or 1 based on single profile resume fields — not actual version history
   - `recruiter_seats` counter not implemented in `resourceCounters.ts`
   - `new_candidates` (Standard Jobs period counter) has no enforcement path yet

8. **No route integration helper.** Middleware checks resource limits and feature flags but **does not call `reserveUsage()`**. AI routes need a standard `executeBillingOperation()` wrapper: reserve → run → commit/release.

9. **`planCheck.ts` still exists** with fail-open behavior (`next()` on error) and old plan names (`agency`, `seeker_pro`). Must be deleted after all routes use the new system.

#### Razorpay gaps

10. **No cancel subscription API.** Users cannot schedule cancellation through the app.

11. **No upgrade/downgrade flow.** Checkout creates new subscriptions but plan changes mid-cycle are not handled.

12. **No reconciliation tooling.** Missed webhooks cannot be repaired from admin/CLI.

13. **Not live-configured.** `RAZORPAY_*` env vars and MongoDB URI absent in dev — expected, but production setup is a deliverable.

14. **`trialing` in `PAID_STATUSES`.** `payment.md` says no trials at launch. Remove or gate explicitly.

#### Frontend gaps

15. **`pricing/page.tsx` and `billing/page.tsx` are 100% legacy:**
    - USD prices ($49, $149)
    - Old plans (`agency`, `seeker_pro`)
    - Stripe checkout and portal
    - `?success=1` treated as "Subscription activated!" — **violates security rule**

16. **No entitlement context**, usage dashboard, limit modals, category switcher, or INR display.

17. **`GET /billing/subscription`** returns one category (defaults `creator_standard`); frontend does not show all three category entitlements.

---

### 3.4 What the previous developer got right

Credit where due — these decisions align with the vision and should not be reimplemented:

- Category-isolated subscription model with unique `(userId, category)` index
- Backend-owned plan catalog; public catalog omits Razorpay plan IDs
- Atomic conditional `$expr` reservation in `usage.ts`
- Idempotency keys on reservations and checkouts
- Webhook-only paid activation (`verify-checkout` does not mutate Subscription)
- Legacy Stripe paths retired with explicit 410 responses
- Fail-closed entitlement resolver for missing/legacy records
- Stable `PLAN_LIMIT_REACHED` error shape with `upgradeRequired`

---

## 4. Target architecture

### 4.1 Source of truth hierarchy

For every access decision:

```text
1. Verified backend Subscription record (category + status + period)
2. Plan catalog limits for resolved plan
3. UsagePeriod counters (used + reserved)
4. Owner-scoped resource counts (active/stored records)
5. Razorpay provider state (only after verified webhook or reconciliation)
```

Never trust: browser plan, redirect params, localStorage, unverified webhooks, JWT plan claims.

### 4.2 Core services (existing — use these, do not duplicate)

```text
getEntitlement(userId, category)           → ResolvedEntitlement
ensureUsagePeriod(entitlement)             → UsagePeriod document
reserveUsage({ operation, idempotencyKey }) → UsageReservation
commitUsage(reservationId)                 → after successful work
releaseUsage(reservationId)                → after definite failure
assertResourceLimit(uid, category, counter) → before creating records
requireFeature(entitlement, featureKey)    → premium-only gates
serializeBillingError(error)               → stable API response
```

### 4.3 Route integration pattern (must add in Phase 0)

Every protected handler follows one of two patterns:

**Pattern A — Resource creation (jobs, forms, candidates, workspace items):**

```text
1. Authenticate + resolve owner uid (collaborators bill the resource owner)
2. assertResourceLimit(ownerUid, category, counterKey, quantity)
3. Create record
4. (No AI reservation needed)
```

**Pattern B — AI or metered operation:**

```text
1. Authenticate + resolve owner uid
2. Build idempotencyKey from (ownerUid, operation, resourceId, logicalActionId)
3. reservation = reserveUsage({ userId: ownerUid, category, operation, idempotencyKey })
4. try:
     result = await executeProviderWork()
     commitUsage(reservation.reservationId)
     return result
   catch (providerError):
     if (definitelyDidNotExecute): releaseUsage(reservation.reservationId)
     else: keep reservation + log for support audit
     throw providerError
```

**Pattern C — Public form submission (creator billed, applicant unauthenticated):**

```text
1. Resolve form → owner uid + category creator_form
2. reserveUsage({ userId: ownerUid, operation: "form_response_intake", ... })
3. Create RecruitFormResponse
4. commitUsage(...)
5. If limit exhausted: return 503/409 with capacity message BEFORE creating record
```

**Pattern D — Background worker:**

```text
1. Load job/form/candidate record → resolve owner uid
2. getEntitlement(ownerUid, category) — if not entitled for this operation, skip/log
3. reserveUsage(...) — if limit hit, skip (do not process queued free work after downgrade)
4. Execute work
5. commitUsage(...) or releaseUsage(...)
```

### 4.4 Collaboration billing rule

- Collaborators act on behalf of the **resource owner**
- Collaborator's personal Free entitlement must not apply to shared jobs/forms
- Seat limits (`recruiter_seats`) count `RecruitTeamMember` records per owner
- Collaborator cannot multiply owner quota via parallel sessions

### 4.5 Document hierarchy going forward

| Document | Role |
|---|---|
| `payment.md` | Product contract — prices, limits, philosophy, customer rules |
| **`paymentgateway.md`** | **Implementation roadmap — phases, tasks, review gates, audit findings** |
| Code in `backend/src/billing/` | Implementation |
| `phase-*-review.md` files | Historical reference only — do not follow blindly |

---

## 5. Phased implementation roadmap

Execute phases **in order**. Do not enable live Razorpay payments until **Phase 5** is complete and tested. Do not consider the project done until **Phase 9** passes.

```text
Phase 0  — Foundation hardening & integration layer
Phase 1  — Job Seeker enforcement
Phase 2  — Form Jobs enforcement (including public intake)
Phase 3  — Standard Jobs enforcement
Phase 4  — Background jobs, SSE, and async paths
Phase 5  — Razorpay production lifecycle (cancel, upgrade, reconciliation, go-live)
Phase 6  — Frontend billing, pricing, and upgrade UX
Phase 7  — Security hardening and abuse prevention
Phase 8  — Production readiness review (101% checklist)
```

Estimated relative effort:

| Phase | Effort | Risk |
|---|---|---|
| 0 | Medium | Low — fixes foundation before wiring |
| 1 | Medium | Medium — first real enforcement proof |
| 2 | Medium-High | **High** — public form concurrent intake |
| 3 | High | High — largest route surface |
| 4 | Medium | High — bypass via async if missed |
| 5 | Medium | High — real money |
| 6 | Medium | Medium — UX must match backend |
| 7 | Medium | High — security |
| 8 | Low-Medium | — final gate |

---

## Phase 0 — Foundation hardening & integration layer

**Goal:** Fix known bugs, complete the operation catalog, add route integration helpers, and prove atomic reservations work with MongoDB before touching product routes.

### 0.1 Tasks

- [ ] **Fix cancellation-at-period-end** in `entitlements.ts`:
  - Retain paid plan if `cancelAtPeriodEnd && currentPeriodEnd > now`
  - Map `past_due` / `halted` per `payment.md` §11.5 (restrict new metered work; keep read access)

- [ ] **Remove `trialing` from paid statuses** unless explicitly re-approved in `payment.md`

- [ ] **Wire `initializeFreeEntitlements(userId)` on signup** in `auth.ts` (after User.create)

- [ ] **Run and document** `migrateFreeEntitlements` for all existing users

- [ ] **Expand `operationCatalog.ts`** to cover every AI/metered operation in `payment.md` §5.1 and the Phase -1 audit inventory

- [ ] **Fix `resourceCounters.ts`:**
  - Implement accurate resume version counting (or add `RecruitSeekerResumeVersion` model if versions are stored separately)
  - Add `recruiter_seats` counter via `RecruitTeamMember`
  - Verify `uid` field usage on `RecruitCandidate`, `RecruitFormResponse`, `RecruitJob`, `RecruitForm`

- [ ] **Add `backend/src/billing/executeOperation.ts`** — standard wrapper:
  - `executeBillingOperation(req, { category, operation, ownerUid, idempotencyKey, work })`
  - Handles reserve/commit/release + error serialization

- [ ] **Add `resolveBillingOwner(req, resource)`** helper for collaboration routes

- [ ] **Extend middleware** or add composable guards:
  - `requireUsageReservation(operation)` for AI routes
  - Attach `req.billingReservation` for handler use

- [ ] **Delete `middleware/planCheck.ts`** (or mark deprecated and grep-verify zero imports)

- [ ] **Add MongoDB integration tests** (`billing/usage.integration.test.ts`):
  - Exact limit boundary
  - One request beyond limit fails
  - Concurrent requests cannot exceed limit
  - Duplicate idempotency key returns same reservation
  - Commit/release transitions are idempotent

- [ ] **Add `GET /billing/subscription` multi-category response** or document that frontend must use `/billing/entitlements`

### 0.2 Review gate

| Check | Pass criteria |
|---|---|
| `npm test` (backend) | All unit + integration tests pass |
| `npx tsc --noEmit` | No type errors |
| Concurrent reservation test | 10 parallel requests at limit N → exactly N succeed |
| Cancel-at-period-end test | Cancelled sub with future `currentPeriodEnd` → still Pro |
| Signup test | New user has 3 Free Subscription records |
| Operation catalog | Every AI route in audit has a catalog entry |
| Grep for `planCheck` | Zero production imports |

**Do not proceed to Phase 1 until Phase 0 passes.**

---

## Phase 1 — Job Seeker enforcement

**Goal:** Every seeker route in the Phase -1 audit matrix is protected. Smallest surface — proves the integration pattern.

### 1.1 Route inventory (from audit)

Primary file: `backend/src/seeker.ts`, `seekerCore.ts`, `resumeExport.ts`

| Route / action | Counter / operation | Pattern |
|---|---|---|
| Save workspace item | `workspace_items` resource | A |
| Analyze job fit | `job_fit_analysis` + AI units | B |
| Add tracker entry | `active_applications` resource | A |
| Save/unsave job | `saved_jobs` resource | A |
| Resume build | `resume_build` + AI units | B |
| Resume improve | `resume_improve` + AI units | B |
| Resume export | `exports` period counter | B or A |
| Cover letter generate | `cover_letter` + AI units | B |
| Interview prep questions/evaluate | `interview_session` + AI units | B |
| Profile optimize | `profile_optimization` + AI units | B |
| Email parse | `email_intelligence` + AI units | B |
| Extension analyze/save | workspace + AI units | B/A |

### 1.2 Tasks

- [ ] Add billing owner resolution to all seeker routes (`category: seeker`)
- [ ] Wire resource limits before create operations
- [ ] Wire `reserveUsage` before every AI provider call
- [ ] Ensure provider fallback chain commits **once**
- [ ] Return stable error codes; seeker frontend hooks (minimal) for limit display
- [ ] Verify manual operations (profile edit, manual status change) remain free within resource limits
- [ ] Add seeker route tests or integration tests for at least: AI exhaustion, resource limit, downgrade

### 1.3 Free plan spot-check (`payment.md` §4.2)

Verify Free limits are enforced:

| Limit | Value |
|---|---:|
| AI units | 10 |
| Cover letters | 2 |
| Resume analyses | 1 |
| Job-fit analyses | 2 |
| Interview sessions | 1 |
| Workspace items | 3 |
| Saved jobs | 10 |

When Free AI exhausted: another AI request **must fail**; manual resume editing **must still work**.

### 1.4 Review gate

| Check | Pass criteria |
|---|---|
| Direct API test | Free user at AI limit → 409 with `PLAN_LIMIT_REACHED` |
| Resource test | Free user with 3 workspace items → 4th blocked |
| Bypass test | curl with forged plan header → still Free |
| Audit matrix | Every seeker row marked ✅ |
| Manual fallback | Profile edit works when AI exhausted |

---

## Phase 2 — Form Jobs enforcement

**Goal:** Protect recruiter form routes **and** public applicant intake. Highest-risk bypass surface.

### 2.1 Route inventory

Primary files: `recruitForms.ts`, `recruitCopilot.ts` (form copilot)

| Route / action | Counter / operation | Pattern |
|---|---|---|
| Create form | `active_forms` / `stored_forms` | A |
| Public response submit | `form_responses` | **C (critical)** |
| AI response scoring | `form_response_score` + AI units | B |
| Hiring summary | `form_hiring_summary` + AI units | B |
| Form copilot | `copilot_turn_form` + AI units | B |
| Assessments | `assessment_sends` + feature flag | B |
| Pipeline rules | `pipeline_rules` resource | A |
| Automated emails | `automated_emails` | B |
| Offer drafts | `offer_letter_form` + AI units | B |
| Exports | `exports` | B |
| Team seats | `recruiter_seats` | A |
| Bulk actions | `bulk_action_size` per batch | B (per item) |

### 2.2 Critical public form rule

```text
PUBLIC POST /recruit-public/forms/:slug/submit (or equivalent):

  WRONG: create response → score later → discover limit exceeded
  RIGHT: reserveUsage(form_response_intake) → if ok → create response → commit
```

When response limit exhausted:

- Public form returns clear capacity message
- Form does **not** accept more responses
- Existing responses remain for manual review
- AI scoring exhaustion does **not** delete responses — manual review still works

### 2.3 Tasks

- [ ] Wire all authenticated form routes
- [ ] Implement public intake Pattern C with concurrent submission protection
- [ ] Wire form copilot and scoring
- [ ] Enforce `bulk_action_size` per batch, not just per request
- [ ] Add tests: simultaneous public submissions, capacity exhaustion, AI scoring exhaustion

### 2.4 Review gate

| Check | Pass criteria |
|---|---|
| Concurrent public POST | 30 parallel submissions on Free (limit 25) → exactly 25 responses created |
| Capacity message | 26th submission gets stable error, no orphan records |
| AI exhausted | Responses exist; manual review works; new AI score blocked |
| Collaborator | Uses owner quota, not collaborator's |
| Audit matrix | Every form row marked ✅ |

---

## Phase 3 — Standard Jobs enforcement

**Goal:** Protect the largest surface — jobs, candidates, scoring, imports, agent, copilot, offers, collaboration.

### 3.1 Route inventory

Primary files: `recruit.ts`, `recruitCopilot.ts`, `collaboration.ts`

| Route / action | Counter / operation | Pattern |
|---|---|---|
| Create job | `active_jobs` / `stored_jobs` | A |
| Add candidate | `new_candidates` + `stored_candidates` | A |
| Resume upload/parse | `resume_analyses` + AI units | B |
| Candidate scoring | `candidate_score` + AI units | B |
| Bulk resume import | `bulk_import` per file + candidate limits | B (per item) |
| Assessments | `assessment_invitations` | B |
| Pipeline rules | `pipeline_rules` | A |
| Agent mode actions | `agent_action` + AI + email | B |
| Job analysis/health | `job_analysis` + AI units | B |
| Copilot (stream + non-stream) | `copilot_turn_standard` + AI units | B |
| Offers | `offer_letter_standard` + email | B |
| Automated emails | `automated_emails` | B |
| Exports | `exports` | B |
| Collaboration seats | `recruiter_seats` | A |
| Bulk pipeline actions | `bulk_action_size` per candidate | B |

### 3.2 Tasks

- [ ] Wire all Standard Job CRUD and candidate routes
- [ ] Wire copilot streaming: reserve **before** SSE headers sent
- [ ] Wire bulk import: reserve per file/candidate, not per batch
- [ ] Wire agent mode: re-check at execution time
- [ ] Wire collaboration invites with seat limits
- [ ] Add tests for all three plan tiers on representative routes

### 3.3 Review gate

| Check | Pass criteria |
|---|---|
| Free job limit | 2nd active job blocked on Free |
| Bulk import | Free limit 3 files/import, 1 import/period enforced |
| Copilot stream | Limit checked before stream opens |
| Agent mode | Blocked when AI units exhausted |
| Collaborator seats | 2nd seat blocked on Free |
| Audit matrix | Every standard job row marked ✅ |

---

## Phase 4 — Background jobs, SSE, and async paths

**Goal:** Close bypass paths that skip HTTP middleware.

### 4.1 Files to protect

| File / path | Operations |
|---|---|
| `jobs/pipelineRulesCron.ts` | Rule execution, automated emails, stage changes |
| `jobs/dailyBriefing.ts` | AI briefing + email |
| `jobs/offerManagement.ts` | Offer reminders, expiry emails |
| `setImmediate` / async in recruit routes | Delayed scoring, retries |
| Copilot SSE streams | Already partially in Phase 3 — verify |
| Bulk import SSE | Per-item reservation |

### 4.2 Policy for queued work

| Scenario | Policy |
|---|---|
| Work queued while Pro, processed after downgrade to Free | **Block** unless reservation was durably committed before downgrade |
| Work queued while Pro, processed after upgrade to Ultra | Allow — higher limits apply at execution time |
| Retry after provider failure | Same idempotency key → no double charge |
| Ambiguous provider timeout | Keep reservation; support audit path |

### 4.3 Tasks

- [ ] Add entitlement check at start of every cron job iteration
- [ ] Add reservation before AI/email in background paths
- [ ] Verify retry-score routes use idempotency keys
- [ ] Test plan change while work is queued/running

### 4.4 Review gate

| Check | Pass criteria |
|---|---|
| Cancel subscription → cron runs | No new AI/email work executed |
| Downgrade while job queued | Queued AI work blocked at execution |
| Retry same idempotency key | Single charge only |
| All async paths from audit | Marked ✅ |

---

## Phase 5 — Razorpay production lifecycle

**Goal:** Complete payment flows for real users. **Only enable live payments after Phases 1–4 pass.**

Existing code provides: checkout creation, verify-checkout, webhook processing, plan sync command.

### 5.1 Tasks

- [ ] Configure environment variables:
  ```text
  RAZORPAY_KEY_ID
  RAZORPAY_KEY_SECRET
  RAZORPAY_WEBHOOK_SECRET
  RAZORPAY_PLAN_<CATEGORY>_<PLAN>_<INTERVAL>  (18 plans)
  ```
- [ ] Run `npm run billing:sync-razorpay-plans` in test mode
- [ ] Register webhook URL in Razorpay dashboard (raw body endpoint)
- [ ] **Add cancel subscription endpoint:** `POST /billing/cancel-subscription`
  - Schedule cancel at period end via Razorpay API
  - Set local `cancelAtPeriodEnd`
- [ ] **Add upgrade/downgrade flow:**
  - Validate target plan against catalog
  - Create new Razorpay subscription or use Razorpay plan change API
  - Never grant access from client callback
- [ ] **Fix webhook lifecycle** for cancel-at-period-end (Phase 0 fix + webhook reconciliation)
- [ ] **Add reconciliation CLI/admin:**
  - Fetch Razorpay subscription state
  - Compare to local Subscription
  - Repair mismatches with audit log
- [ ] **Handle failed payment / past_due** per `payment.md` §11.5
- [ ] Test in Razorpay test mode:
  - Forged checkout signatures → rejected
  - Forged webhook signatures → rejected
  - Duplicate webhooks → idempotent
  - Out-of-order webhooks → correct final state
  - Missed webhook → reconciliation repairs

### 5.2 Review gate

| Check | Pass criteria |
|---|---|
| Test mode E2E | Checkout → webhook → entitlement active |
| Forged signature | Rejected, no entitlement change |
| Cancel at period end | Access retained until period end, then Free |
| Failed renewal | past_due behavior matches payment.md |
| Reconciliation | Repairs missed webhook correctly |
| Live keys | Not enabled until all above pass in test mode |

---

## Phase 6 — Frontend billing, pricing, and upgrade UX

**Goal:** Replace legacy Stripe/USD UI. Display must come from backend catalog; activation must never happen client-side.

### 6.1 Tasks

- [ ] **Replace `pricing/page.tsx`:**
  - Fetch `GET /billing/catalog`
  - Category switcher: Seeker / Form Jobs / Standard Jobs
  - Free / Pro / Ultra Pro cards with INR prices
  - Monthly/yearly toggle
  - "Most popular" badge on Pro
  - Razorpay checkout flow with `Idempotency-Key`
  - Remove `agency`, `seeker_pro`, USD

- [ ] **Replace `billing/page.tsx`:**
  - Fetch `GET /billing/entitlements` (all categories)
  - Show plan, status, period dates, cancel-at-period-end
  - Usage bars for visible counters (used/limit/reset)
  - Cancel subscription action
  - Remove Stripe portal; remove `?success=1` activation message
  - Show "Pending webhook verification" after checkout, not "Activated"

- [ ] **Add `BillingEntitlementContext`** (or extend auth context):
  - Poll entitlements on load
  - Expose helpers: `canUse(feature)`, `remaining(counter)`, `isUpgradeRequired(error)`

- [ ] **Add limit modals and inline gates:**
  - Catch `PLAN_LIMIT_REACHED` / stable codes from API
  - Show: used, limit, reset date, upgrade path, manual alternative if available

- [ ] **Seeker billing page** (if separate route needed)

- [ ] **Processing priority indicators** (free/normal/priority queue)

### 6.2 UX rules (from vision)

Users always see:

- What they used
- Their current limit
- When it resets
- What upgrade unlocks
- Whether manual alternative is still available

Frontend **never** relies on matching error text — only stable codes.

### 6.3 Review gate

| Check | Pass criteria |
|---|---|
| Visual review | All 9 plan states render correctly (Free/Pro/Ultra × 3 categories) |
| Checkout flow | Redirect → pending state → webhook → active (no client activation) |
| Limit modal | API 409 → correct modal with upgrade CTA |
| Production build | `npm run build` passes |
| No USD/Stripe | Grep frontend for stripe/agency/seeker_pro → zero in billing UI |

---

## Phase 7 — Security hardening and abuse prevention

**Goal:** Prove bypass paths are closed.

### 7.1 Attack scenarios to test

| Attack | Expected result |
|---|---|
| Modified plan in request body | Ignored — server entitlement used |
| Modified uid in request | 401/403 — ownership check fails |
| Modified category | Ignored — derived from route/resource |
| Direct API call bypassing UI | Blocked at same limit |
| Replayed webhook | Idempotent — no double activation |
| Forged webhook signature | 400 — no entitlement change |
| Duplicate AI request (same idempotency key) | Single charge |
| Concurrent requests at limit | Exactly N succeed |
| Public form flooding | Blocked at response limit |
| Collaborator quota multiplication | Owner quota only |
| Archived job reactivation over active limit | Blocked |
| Queued work after downgrade | Blocked at execution |
| Multiple browser tabs | Same quota — no multiplication |
| Oversized bulk import | File count + import period limits enforced |
| Account farming | Fair-use / rate limits on expensive ops |

### 7.2 Security controls checklist

- [ ] Razorpay secrets server-side only
- [ ] Webhook raw-body HMAC verified
- [ ] No PII in billing logs (resume text, form answers, emails)
- [ ] Rate limits on expensive operations (public forms, bulk import, AI)
- [ ] Ownership check before every quota operation
- [ ] All internal/cron triggers use same entitlement service
- [ ] Support overrides (if any) are audited and time-limited

### 7.3 Review gate

Document test results for every row above. No known bypass paths remain.

---

## Phase 8 — Production readiness review (101% complete)

**Goal:** Final verification against `payment.md` and this document.

### 8.1 Final acceptance checklist

- [ ] All three categories have independent Free/Pro/Ultra entitlements
- [ ] All prices and limits from backend catalog
- [ ] Every limit in `payment.md` enforced server-side
- [ ] Every frontend gate backed by API check
- [ ] Every AI call site metered
- [ ] Every public form submission quota-protected before create
- [ ] Every background worker re-checks entitlement
- [ ] Every collaboration route charges correct owner
- [ ] Every Razorpay webhook verified and idempotent
- [ ] Checkout success alone cannot grant access
- [ ] Downgrades preserve data; block over-limit new work
- [ ] Expired subscriptions lose paid capacity correctly
- [ ] Usage counters cannot go negative or exceed limits
- [ ] Duplicate requests do not double-charge
- [ ] Concurrent requests cannot bypass quotas
- [ ] Legacy Stripe assumptions removed or isolated
- [ ] Billing state correct after server restart
- [ ] Reconciliation repairs missed provider events
- [ ] Logs and metrics sufficient for support
- [ ] Pricing UI and backend limits match `payment.md`
- [ ] Free plan feels like real product with strict limits
- [ ] Pro and Ultra feel meaningfully different

### 8.2 Final test run

```bash
cd backend && npx tsc --noEmit && npm test
cd frontend && npm run build
# Route smoke tests on all billing states
# MongoDB index verification
# Razorpay test mode E2E
# Browser console review — no errors on pricing/billing pages
```

### 8.3 Definition of done

The payment gateway and billing system is **101% complete** when:

1. A Free user can demo every major feature within strict limits
2. A paid user receives exactly the capacity defined in `payment.md`
3. No known API, public, async, or concurrent bypass exists
4. Razorpay test mode E2E passes including failure scenarios
5. Frontend displays accurate INR pricing and usage for all categories
6. This checklist is fully checked with evidence (test output, not assertions)

---

## 6. Enforcement reference

### 6.1 Stable error codes (API contract)

| Code | HTTP | Meaning |
|---|---:|---|
| `PLAN_LIMIT_REACHED` | 409 | Quota or resource limit hit |
| `{COUNTER}_QUOTA_EXHAUSTED` | 409 | Specific counter exhausted (e.g. `AI_UNITS_QUOTA_EXHAUSTED`) |
| `FEATURE_NOT_AVAILABLE` | 403 | Feature flag not on plan |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Same key, different operation |
| `RAZORPAY_NOT_CONFIGURED` | 503 | Provider not set up |
| `INVALID_BILLING_PLAN` | 422 | Bad plan/category/interval from client |

### 6.2 AI operation weights (`payment.md` §5.1)

| Operation | Units |
|---|---:|
| Short rewrite / field suggestion | 1 |
| Candidate or form-response score | 1 |
| Copilot turn | 1 |
| Cover letter | 2 |
| Resume analysis | 2 |
| Job-fit analysis | 2 |
| Deep candidate analysis | 2 |
| Interview prep session | 3 |
| Job health/analysis report | 3 |
| Offer letter draft | 3 |
| AI hiring summary | 4 |
| Bulk operation | Weight × underlying items |

Both AI units **and** feature-specific counters must be available (stricter limit wins).

### 6.3 Coverage matrix template

For each feature, track:

| Category | Feature | Backend route | Worker | Counter | Plan rule | Frontend gate | Tests |
|---|---|---|---|---|---|---|---|

No feature is complete until **all columns** are filled. The Phase -1 audit (`phase-minus-one-audit.md`) is the starting inventory — update it as phases complete.

---

## 7. Environment and operations

### 7.1 Required environment variables

```text
MONGODB_URI                          — required for all billing
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
RAZORPAY_PLAN_SEEKER_PRO_MONTHLY     — (18 total, one per paid catalog entry)
RAZORPAY_PLAN_SEEKER_PRO_YEARLY
... etc for all categories/plans/intervals
```

### 7.2 Commands

```bash
# Sync Razorpay plans from catalog
cd backend && npm run billing:sync-razorpay-plans

# Backfill Free entitlements for existing users
cd backend && npx tsx src/billing/migrateFreeEntitlements.ts

# Run tests
cd backend && npm test
cd frontend && npm run build
```

### 7.3 Deployment sequence

1. Deploy backend with enforcement (Phases 1–4) — Razorpay still in test mode
2. Run Free entitlement migration on production DB
3. Deploy frontend (Phase 6)
4. Configure Razorpay test mode webhook → run E2E
5. Switch to live Razorpay keys (Phase 5)
6. Monitor webhook processing and counter accuracy for 48 hours

---

## 8. What NOT to do

| Anti-pattern | Why |
|---|---|
| Add isolated `if (plan === 'pro')` checks in routes | Bypass-prone; use central service |
| Grant paid access on checkout redirect | Security violation |
| Use `UsageEvent.ts` for quota enforcement | Analytics only — no atomic reservations |
| Use `planCheck.ts` | Fail-open legacy middleware |
| Trust frontend plan selection | Server catalog only |
| Enable live Razorpay before route enforcement | Users pay for unenforced limits |
| Delete user data on downgrade | Violates vision — preserve data |
| Charge once per provider fallback | One logical operation = one charge |
| Skip public form reservation | Critical bypass |
| Mark phase complete based on UI only | API must enforce |

---

## 9. Summary

| Item | Detail |
|---|---|
| **Vision** | Three category-independent plans; Free = strict demo; backend-enforced limits; Razorpay INR |
| **Current state** | ~30–35% complete — foundation built, product unprotected |
| **Keep** | planCatalog, usage.ts reservations, Razorpay webhook model, entitlement resolver (with fixes) |
| **Fix first (Phase 0)** | Cancel-at-period-end, operation catalog, resource counters, signup init, integration helper |
| **Main work (Phases 1–4)** | Wire every route, public form, and background job |
| **Payments (Phase 5)** | Cancel, upgrade, reconciliation, go-live — after enforcement |
| **UX (Phase 6)** | Replace legacy Stripe/USD frontend |
| **Done (Phase 8)** | 101% checklist passes with test evidence |

**Follow this document (`paymentgateway.md`) as the execution source of truth. Use `payment.md` as the product contract for prices, limits, and customer-facing rules.**

When all 8 phases pass their review gates, the payment gateway and billing system will be fully implemented, production-ready, secure, and aligned with the owner's vision.
