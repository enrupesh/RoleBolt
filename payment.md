# Rolebolt Monetization, Entitlements, Usage Limits, and Razorpay

**Status:** Product and implementation specification  
**Provider:** Razorpay  
**Market priority:** India-first, INR billing  
**Scope:** Job Seeker subscriptions, Job Creator Form Jobs, Job Creator Standard Jobs  
**Source of truth:** This document defines the intended pricing, access rules, usage accounting, payment lifecycle, and implementation contract. Code, UI copy, API behavior, tests, and operational tooling must follow this document.

---

## 1. Executive summary

Rolebolt has three separately monetized product categories:

1. **Job Seeker** — tools for finding jobs, preparing applications, managing career workspaces, and presenting a public professional profile.
2. **Job Creator – Form Jobs** — lightweight, form-first hiring for small campaigns and simple intake workflows.
3. **Job Creator – Standard Jobs** — the full ATS and hiring command center, including resume scoring, pipelines, assessments, automation, collaboration, analytics, offers, and AI hiring workflows.

Each category has three tiers:

- **Free** — a permanent product demonstration. It must feel real and useful, but its capacity must be too low for sustained professional use.
- **Pro** — the default recommendation and the best value for an active individual or small team.
- **Ultra Pro** — high-volume, automation-heavy usage for power users, agencies, and growing hiring teams.

Free users may see almost every major feature and may use a small amount of it. Paid users receive materially higher limits, faster processing, more automation, more active resources, more collaborators, and higher operational capacity. Premium functionality must never be protected only by the frontend.

Razorpay is the payment gateway. A successful checkout redirect is not proof of entitlement. Paid access is granted only after the backend verifies the payment/subscription state and processes an authenticated, idempotent Razorpay webhook.

---

## 2. Product and monetization philosophy

### 2.1 Free is a demonstration, not an unlimited starter product

The Free plan is permanent and does not expire. It exists to prove:

- the product works;
- AI output is useful;
- the workflow is faster than manual alternatives;
- the user can complete a small, real task;
- upgrading will remove a clear and recurring bottleneck.

Free must not become a complete replacement for a paid subscription. The correct conversion moment is when the user has experienced value and wants to repeat or scale the workflow.

Free must never be intentionally broken, misleading, or empty. The user should be able to create a real profile, inspect real jobs, run a small real hiring flow, or complete a small real application workflow. The restrictions are capacity restrictions, not fake feature restrictions.

### 2.2 Show capability; meter expensive capacity

The product should expose the major feature surfaces to Free users where practical, including:

- AI scoring previews;
- resume analysis;
- cover letters;
- interview preparation;
- candidate pipelines;
- assessments;
- basic automation;
- recruiter Copilot;
- offer-letter drafting;
- analytics previews.

The expensive or abuse-prone part is metered:

- AI actions;
- parsed/scored documents;
- candidate and response volume;
- active jobs;
- stored records;
- automated emails;
- team seats;
- bulk operations;
- background processing priority;
- advanced automation and reporting.

### 2.3 No surprise overage charges at launch

At launch:

- quota resets at the beginning of each billing period;
- unused quota does not roll over;
- there are no automatic overage charges;
- a blocked operation returns a clear upgrade response;
- the user may continue with non-metered manual workflows where possible;
- optional AI top-ups are deferred until real usage data justifies them.

### 2.4 Plans are category-specific

An account can have:

- a Job Seeker entitlement;
- a Form Jobs creator entitlement;
- a Standard Jobs creator entitlement.

These entitlements are independent. A Standard Jobs subscription must not silently unlock Form Jobs limits, and a Form Jobs subscription must not silently unlock Standard Jobs limits. A user can hold more than one category subscription if the product later supports that use case.

For a creator account, the first paid subscription in a category upgrades only that category. A future bundle may combine creator categories, but bundles are not part of the initial launch contract.

---

## 3. India-first pricing

All prices below are in INR and exclude any taxes that Razorpay or the applicable invoice rules require to be shown separately.

### 3.1 Job Seeker

| Plan | Monthly | Annual | Annual effective monthly price |
|---|---:|---:|---:|
| Free | ₹0 | ₹0 | ₹0 |
| Pro | ₹99/month | ₹999/year | ₹83.25/month |
| Ultra Pro | ₹249/month | ₹2,499/year | ₹208.25/month |

### 3.2 Job Creator – Form Jobs

| Plan | Monthly | Annual | Annual effective monthly price |
|---|---:|---:|---:|
| Free | ₹0 | ₹0 | ₹0 |
| Pro | ₹499/month | ₹4,999/year | ₹416.58/month |
| Ultra Pro | ₹999/month | ₹9,999/year | ₹833.25/month |

### 3.3 Job Creator – Standard Jobs

| Plan | Monthly | Annual | Annual effective monthly price |
|---|---:|---:|---:|
| Free | ₹0 | ₹0 | ₹0 |
| Pro | ₹999/month | ₹9,999/year | ₹833.25/month |
| Ultra Pro | ₹1,999/month | ₹19,999/year | ₹1,666.58/month |

### 3.4 Pricing rules

- Pro is marked **Most popular** in the pricing UI.
- Annual pricing is approximately two months free, but the exact annual amount in the Razorpay plan must be the source of truth.
- Prices are configured server-side and must not be trusted from the browser.
- A plan has a stable internal ID, such as `seeker_pro_monthly` or `standard_ultra_yearly`. Display names and prices are not authorization inputs.
- Pricing changes create a new price/version record. Existing subscriptions retain their agreed price until renewal policy explicitly changes.
- Do not create a free Razorpay subscription. Free is a local entitlement with no payment provider ID.
- Discounts, coupons, referral credits, GST treatment, invoices, and tax registration must be added as explicit capabilities later; they must not be improvised inside checkout code.

---

## 4. Plan definitions and exact limits

The limits in this section are the launch contract. If a limit changes, update this document, the centralized plan catalog, tests, pricing UI, and any customer-facing help text together.

### 4.1 Limit terminology

- **Per billing period:** the counter resets at the UTC period boundary stored on the entitlement. The UI may display the user's India-local date, but backend comparisons use a single unambiguous instant.
- **Active:** a resource currently available for use, normally `status = active` or an equivalent open state.
- **Stored:** an owned record retained in the account, including active and archived records unless explicitly stated otherwise.
- **AI action:** a weighted unit from the AI metering table in Section 5.
- **AI-scored candidate/response:** one candidate or form response sent through an AI scoring operation, regardless of whether the trigger was manual, bulk, rule-based, agent-based, or background.
- **Manual:** a user can view, edit, move, or review the record without consuming an AI unit unless the individual operation explicitly says otherwise.
- **Priority:** queue priority, not a promise of a fixed response time.

### 4.2 Job Seeker plans

#### Free — ₹0

| Capability | Free limit |
|---|---:|
| Active resume versions | 1 |
| Stored resume versions | 2 |
| Saved jobs | 10 |
| Active tracked applications | 10 |
| Stored application history | 25 |
| Job workspace items | 3 |
| Public profile | 1, basic customization |
| Projects | 3 |
| Certifications | 3 |
| AI units | 10 per billing period |
| Cover-letter generations | 2 per billing period |
| Resume analyses | 1 per billing period |
| Job-fit/deep matching analyses | 2 per billing period |
| Interview-preparation sessions | 1 per billing period |
| Copilot turns | Included in AI units; maximum 10 |
| Job alerts | 1 active alert |
| Resume upload/parsing | 1 per billing period |
| Application export | 1 per billing period |
| AI queue | Standard/free priority; may be delayed |

Allowed on Free:

- profile editing;
- public profile sharing;
- searching and viewing public jobs;
- manually saving and tracking within limits;
- manual application status changes;
- manual resume editing;
- one complete demonstration of the main AI workflow.

Blocked after a limit:

- new AI operation of that type;
- new resume version after the active/stored limit;
- new saved job or application after the relevant limit;
- new workspace item after the workspace limit.

#### Pro — ₹99/month or ₹999/year

| Capability | Pro limit |
|---|---:|
| Active resume versions | 5 |
| Stored resume versions | 20 |
| Saved jobs | Unlimited, fair-use protection |
| Active tracked applications | 100 |
| Stored application history | 500 |
| Job workspace items | 25 |
| Public profile | 1, advanced customization |
| Projects | 20 |
| Certifications | 20 |
| AI units | 60 per billing period |
| Cover-letter generations | 20 per billing period |
| Resume analyses | 10 per billing period |
| Job-fit/deep matching analyses | 20 per billing period |
| Interview-preparation sessions | 10 per billing period |
| Copilot turns | Included in AI units; maximum 60 |
| Job alerts | 10 active alerts |
| Resume upload/parsing | 10 per billing period |
| Application export | 10 per billing period |
| AI queue | Normal priority |

#### Ultra Pro — ₹249/month or ₹2,499/year

| Capability | Ultra Pro limit |
|---|---:|
| Active resume versions | 20 |
| Stored resume versions | 100 |
| Saved jobs | Unlimited, fair-use protection |
| Active tracked applications | Unlimited, fair-use protection |
| Stored application history | 2,000 |
| Job workspace items | 100 |
| Public profile | 1, full customization |
| Projects | 100 |
| Certifications | 100 |
| AI units | 200 per billing period |
| Cover-letter generations | 50 per billing period |
| Resume analyses | 30 per billing period |
| Job-fit/deep matching analyses | 50 per billing period |
| Interview-preparation sessions | 30 per billing period |
| Copilot turns | Included in AI units; maximum 200 |
| Job alerts | 50 active alerts |
| Resume upload/parsing | 50 per billing period |
| Application export | 50 per billing period |
| AI queue | Priority |

“Unlimited” on Pro or Ultra Pro means no ordinary product cap, but does not permit scraping, automated account farming, request flooding, storage abuse, or use outside the account's normal human workflow. Fair-use protection is an abuse control, not an unannounced quota.

### 4.3 Form Jobs plans

#### Free — ₹0

| Capability | Free limit |
|---|---:|
| Active Form Jobs | 1 |
| Stored Form Jobs | 3 |
| Form responses per billing period | 25 |
| Stored candidates/responses | 100 |
| AI-scored responses | 10 per billing period |
| AI units | 15 per billing period |
| AI-generated form/job improvements | 3 per billing period |
| Active assessments | 1 |
| Assessment sends | 10 per billing period |
| Pipeline rules | 1 enabled rule |
| Automated candidate emails | 10 per billing period |
| Offer-letter drafts | 1 per billing period |
| Recruiter seats | 1 |
| Bulk actions | 5 candidates per action |
| Exports | 1 per billing period |
| Analytics | Basic; current job only |
| AI hiring summary | 1 per billing period |
| Background processing | Delayed/free priority |

Free Form Jobs supports one real, small hiring campaign. After the response limit is reached, the public form must stop accepting new responses with a clear capacity message; it must not continue accepting data and fail later during scoring.

Allowed on Free:

- create and publish one form;
- receive up to 25 responses;
- manually review and manage responses;
- run a small number of AI scores;
- use one assessment;
- inspect basic analytics.

Restricted on Free:

- new form creation after the active-job limit;
- additional responses after the response limit;
- additional AI scoring after the score/AI limit;
- additional rules, automated emails, exports, or assessments after their limit.

#### Pro — ₹499/month or ₹4,999/year

| Capability | Pro limit |
|---|---:|
| Active Form Jobs | 5 |
| Stored Form Jobs | 50 |
| Form responses per billing period | 1,000 |
| Stored candidates/responses | 3,000 |
| AI-scored responses | 500 per billing period |
| AI units | 750 per billing period |
| AI-generated form/job improvements | 100 per billing period |
| Active assessments | 5 |
| Assessment sends | 500 per billing period |
| Pipeline rules | 10 enabled rules per form |
| Automated candidate emails | 500 per billing period |
| Offer-letter drafts | 20 per billing period |
| Recruiter seats | 3 |
| Bulk actions | 100 candidates per action |
| Exports | 25 per billing period |
| Analytics | Full standard analytics |
| AI hiring summary | 10 per billing period |
| Background processing | Normal priority |

#### Ultra Pro — ₹999/month or ₹9,999/year

| Capability | Ultra Pro limit |
|---|---:|
| Active Form Jobs | 20 |
| Stored Form Jobs | 200 |
| Form responses per billing period | 5,000 |
| Stored candidates/responses | 15,000 |
| AI-scored responses | 2,500 per billing period |
| AI units | 3,500 per billing period |
| AI-generated form/job improvements | 500 per billing period |
| Active assessments | 20 |
| Assessment sends | 2,500 per billing period |
| Pipeline rules | 25 enabled rules per form |
| Automated candidate emails | 2,500 per billing period |
| Offer-letter drafts | 100 per billing period |
| Recruiter seats | 5 |
| Bulk actions | 500 candidates per action |
| Exports | 100 per billing period |
| Analytics | Advanced analytics |
| AI hiring summary | 50 per billing period |
| Background processing | Priority |

### 4.4 Standard Jobs plans

#### Free — ₹0

| Capability | Free limit |
|---|---:|
| Active Standard Jobs | 1 |
| Stored Standard Jobs | 3 |
| New candidates per billing period | 25 |
| Stored candidates | 100 |
| AI-scored candidates | 10 per billing period |
| AI units | 20 per billing period |
| Resume analyses | 5 per billing period |
| Bulk resume import | 3 files per import; 1 import per billing period |
| Active assessments | 1 |
| Assessment invitations | 10 per billing period |
| Pipeline rules | 1 enabled rule |
| Automated candidate emails | 10 per billing period |
| Offer-letter drafts | 1 per billing period |
| Recruiter Copilot turns | Included in AI units; maximum 10 |
| Job health/analysis reports | 1 per billing period |
| Daily briefing | Preview only; maximum 1 per billing period |
| Recruiter seats | 1 |
| Bulk pipeline action | 5 candidates per action |
| Exports | 1 per billing period |
| Background processing | Delayed/free priority |

Free Standard Jobs supports a small demonstration hiring flow. Manual candidate viewing, notes, filtering, and stage changes remain available for existing candidates, but new candidate intake and AI operations stop at the limits.

#### Pro — ₹999/month or ₹9,999/year

| Capability | Pro limit |
|---|---:|
| Active Standard Jobs | 5 |
| Stored Standard Jobs | 50 |
| New candidates per billing period | 500 |
| Stored candidates | 3,000 |
| AI-scored candidates | 300 per billing period |
| AI units | 1,000 per billing period |
| Resume analyses | 100 per billing period |
| Bulk resume import | 50 files per import; 20 imports per billing period |
| Active assessments | 5 |
| Assessment invitations | 300 per billing period |
| Pipeline rules | 10 enabled rules per job |
| Automated candidate emails | 300 per billing period |
| Offer-letter drafts | 10 per billing period |
| Recruiter Copilot turns | Included in AI units; maximum 300 |
| Job health/analysis reports | 20 per billing period |
| Daily briefing | 1 per day per active job |
| Recruiter seats | 3 |
| Bulk pipeline action | 100 candidates per action |
| Exports | 25 per billing period |
| Background processing | Normal priority |

#### Ultra Pro — ₹1,999/month or ₹19,999/year

| Capability | Ultra Pro limit |
|---|---:|
| Active Standard Jobs | 20 |
| Stored Standard Jobs | 500 |
| New candidates per billing period | 2,000 |
| Stored candidates | 25,000 |
| AI-scored candidates | 1,500 per billing period |
| AI units | 5,000 per billing period |
| Resume analyses | 500 per billing period |
| Bulk resume import | 50 files per import; 100 imports per billing period |
| Active assessments | 20 |
| Assessment invitations | 1,500 per billing period |
| Pipeline rules | 25 enabled rules per job |
| Automated candidate emails | 1,500 per billing period |
| Offer-letter drafts | 50 per billing period |
| Recruiter Copilot turns | Included in AI units; maximum 1,500 |
| Job health/analysis reports | 100 per billing period |
| Daily briefing | 1 per day per active job |
| Recruiter seats | 10 |
| Bulk pipeline action | 500 candidates per action |
| Exports | 100 per billing period |
| Background processing | Priority |

---

## 5. AI usage accounting

The backend must use one centralized AI accounting system. Individual routes must not invent their own counters or rely on raw provider token counts as the product quota.

### 5.1 AI unit weights

| Operation | Units |
|---|---:|
| Short rewrite, field suggestion, or simple improvement | 1 |
| Candidate or form-response score | 1 |
| Copilot turn | 1 |
| Cover-letter generation | 2 |
| Resume analysis | 2 |
| Job-fit analysis | 2 |
| Deep candidate analysis | 2 |
| Interview-preparation session | 3 |
| Job health/analysis report | 3 |
| AI hiring summary | 4 |
| Offer-letter draft | 3 |
| Bulk operation | Weight per underlying item; never one unit for an entire batch |

The operation may also have a separate count quota. For example, a Standard Pro user needs both:

- an available AI unit balance; and
- an available `ai_scored_candidates` balance.

The stricter exhausted limit wins.

### 5.2 Metering rules

- Reserve usage before invoking Gemini or any other paid/expensive AI provider.
- The reservation must be atomic and idempotent.
- A retry of the same logical operation must not charge twice.
- A provider failure after reservation must release the reservation only when the operation definitely did not execute. If execution status is ambiguous, retain the charge and log a compensating support event rather than risking unlimited retries.
- A user cannot lower the cost by calling a lower-level route directly.
- Streaming routes reserve quota before opening the stream.
- Background jobs re-check entitlement and reservation ownership before processing.
- AI provider token usage may be recorded for internal cost monitoring, but token usage is not the user-facing quota.

### 5.3 Usage display

The API should expose:

- current plan;
- current billing period start/end;
- used and remaining values for visible counters;
- reset date;
- whether processing is delayed, normal, or priority;
- a stable reason code for a blocked action.

Do not expose internal secrets, provider request IDs that could help abuse, or implementation-only fields.

---

## 6. What is unlimited, limited, or premium-only

### 6.1 Available on every plan, subject to resource limits

- account authentication and security;
- profile editing;
- public profile viewing/sharing;
- public job discovery;
- basic search and filters;
- manual candidate review;
- manual pipeline stage changes;
- candidate notes;
- manual application tracking;
- data export where the plan's export quota allows;
- data deletion and privacy controls;
- viewing historical records owned by the user.

### 6.2 Metered on every plan

- AI generation and analysis;
- AI scoring;
- resume parsing;
- cover letters;
- interview preparation;
- Copilot turns;
- assessment invitations;
- automated emails;
- offer-letter drafts;
- advanced reports;
- bulk operations;
- exports;
- candidate/form-response intake;
- active jobs and stored records;
- recruiter seats.

### 6.3 Premium-only or paid-capacity features

The following may be visible as previews on Free but require Pro or Ultra Pro to use beyond the Free allowance:

- higher-volume AI agent processing;
- higher-volume pipeline rules;
- advanced automation;
- priority background processing;
- advanced analytics;
- advanced branding;
- multiple recruiter seats;
- high-volume bulk import;
- high-volume automated email;
- high-volume offer management.

At launch, do not lock every major feature exclusively behind Ultra Pro. Ultra Pro is primarily a capacity, automation, priority, and team-scale tier.

---

## 7. Subscription and entitlement architecture

### 7.1 Source of truth hierarchy

For access decisions, use this order:

1. verified backend entitlement record;
2. the entitlement's current period, status, and plan version;
3. usage counters and owned resource counts;
4. Razorpay data only after webhook/signature verification or a server-side reconciliation request.

Never use:

- a plan value sent by the browser;
- a success redirect query parameter;
- a client-side local-storage flag;
- an unverified Razorpay webhook;
- a stale JWT claim as the only source of access.

The JWT may identify the user, but plan and quota must be resolved server-side.

### 7.2 Category keys

Use explicit category identifiers:

```text
seeker
creator_form
creator_standard
```

Use explicit plan identifiers:

```text
free
pro
ultra
```

Use explicit billing intervals:

```text
monthly
yearly
```

### 7.3 Target billing records

The current `backend/src/models/Subscription.ts` model contains Stripe-specific fields and plan values. It is not the final contract for this system. The implementation must migrate it to a provider-neutral/Razorpay-aware shape.

At minimum, the target subscription record must include:

```text
userId
category: seeker | creator_form | creator_standard
plan: free | pro | ultra
interval: monthly | yearly
status: free | created | authenticated | active | pending | past_due | halted | cancelled | expired
provider: razorpay
providerCustomerId (if used)
providerSubscriptionId
providerPlanId
providerLatestPaymentId
currentPeriodStart
currentPeriodEnd
cancelAtPeriodEnd
cancelledAt
endedAt
lastWebhookAt
createdAt
updatedAt
```

Important rules:

- Enforce uniqueness for one active category entitlement per user.
- Index `(userId, category)` for fast authorization.
- Index `providerSubscriptionId` uniquely when non-empty.
- Keep provider IDs separate from internal IDs.
- Preserve a status/event history for support and reconciliation.
- Do not delete subscription records when a user cancels.

### 7.4 Usage-period record

Use a separate usage-period record rather than trying to infer quota from an append-only event log on every request:

```text
userId
category
periodKey
periodStart
periodEnd
planSnapshot
limitsSnapshot
usedCounters
reservedCounters
version
createdAt
updatedAt
```

The `limitsSnapshot` is important. A renewal or plan change creates a new period snapshot so historical usage remains explainable even if the catalog later changes.

### 7.5 Usage ledger

Maintain an append-only usage ledger for auditability:

```text
userId
category
periodKey
operation
resourceType
resourceId
units
quantity
reservationId
idempotencyKey
status: reserved | committed | released | reversed
metadata
createdAt
```

The existing `UsageEvent` model is an analytics/event log, not sufficient by itself for quota enforcement. It may continue to record product analytics, but quota enforcement requires a dedicated atomic usage model and indexes.

### 7.6 Plan catalog

Plan definitions must live in one backend-owned catalog containing:

- internal plan ID;
- category;
- interval;
- price in paise;
- Razorpay plan ID;
- limits;
- feature flags;
- processing priority;
- catalog version;
- effective date.

The frontend may receive a sanitized pricing catalog for display, but it must not define authorization limits.

---

## 8. Hard enforcement contract

### 8.1 Every protected request follows the same flow

For every protected route:

1. Authenticate the user.
2. Resolve the resource owner and workspace/category.
3. Resolve the category entitlement from the database.
4. Normalize expired/cancelled states according to the lifecycle rules.
5. Load the plan limits for the current period.
6. Check resource ownership and collaboration access.
7. Check current count quotas.
8. Atomically reserve any usage quota required by the operation.
9. Perform the write or start the AI/background operation.
10. Commit or release the reservation.
11. Write an audit/usage ledger entry.
12. Return current remaining usage where safe and useful.

If any check fails, stop before calling the AI provider or creating the protected resource.

### 8.2 Central service boundary

Implement centralized services rather than scattered route-specific conditionals:

```text
getEntitlement(uid, category)
requireFeature(entitlement, featureKey)
assertWithinLimit(entitlement, counterKey, quantity)
reserveUsage(input)
commitUsage(reservationId)
releaseUsage(reservationId)
countOwnedResources(uid, category, scope)
```

Every route must use these services. A code review rule should reject new AI, bulk, email, import, assessment, offer, or job-creation routes that do not call the central entitlement boundary.

### 8.3 Limit error contract

Blocked operations return a consistent status and body, for example:

```json
{
  "error": "PLAN_LIMIT_REACHED",
  "code": "AI_SCORE_QUOTA_EXHAUSTED",
  "category": "creator_standard",
  "feature": "candidate_scoring",
  "plan": "free",
  "used": 10,
  "limit": 10,
  "resetAt": "2026-08-31T23:59:59.999Z",
  "upgradeRequired": true
}
```

Recommended status codes:

- `401` — unauthenticated;
- `403` — authenticated but not allowed for ownership, role, or feature access;
- `409` — quota/resource conflict caused by a concurrent request;
- `429` — rate limit or abuse protection;
- `402` — reserved for payment-required UI if the API convention requires it; do not use it as the only entitlement signal;
- `422` — invalid request data, not a plan limit.

The frontend must branch on stable `code` values, not on English error strings.

---

## 9. Frontend gating strategy

Frontend gating improves clarity and prevents wasted requests. It is not security.

### 9.1 Entitlement context

Provide a client entitlement context populated from a server response containing:

- current plan by category;
- active/inactive status;
- visible feature flags;
- used/remaining counters;
- reset dates;
- upgrade URL or checkout action;
- processing priority.

Refresh entitlement:

- after login;
- when the user enters a billing page;
- after checkout return;
- after a successful webhook reconciliation poll;
- after any `PLAN_LIMIT_REACHED` response;
- when the app regains focus if the last refresh is stale.

### 9.2 UI behavior

For an available feature:

- render the normal control;
- show remaining quota when it is relevant;
- warn before a costly operation if the user is near the limit.

For an exhausted feature:

- keep the feature visible where it helps discovery;
- disable the action or show a clear upgrade gate;
- display used/limit/reset information;
- provide the correct category's Pro/Ultra comparison;
- preserve manual alternatives where allowed;
- never pretend the action succeeded.

Examples:

- A Free Standard user can open the Copilot drawer, see what it does, and use remaining turns. After the Copilot limit, the input is replaced by an upgrade state.
- A Free Form Job owner can keep reviewing existing responses manually after AI scoring is exhausted, but cannot trigger another AI score.
- A Free user at one active job cannot create a second active job. They can archive/close the first job, subject to the product's data retention rules, or upgrade.

### 9.3 Never trust client values

The browser must not be able to select:

- a higher plan;
- a different category;
- a larger limit;
- a free/paid status;
- a different `uid`;
- an arbitrary `resourceId` for quota ownership.

The server derives all of these from authenticated identity, ownership, and database state.

---

## 10. API, route, and background-worker protection

### 10.1 Route families requiring enforcement

The implementation audit must cover all existing and future route families, including:

- seeker workspace, resume, cover-letter, interview, matching, tracker, and export routes;
- Standard Job creation/editing, candidates, resume uploads, scoring, bulk imports, assessments, pipeline rules, agent mode, analytics, job analysis, daily briefing, offers, and collaboration;
- Form Job creation/editing, public response intake, response scoring, assessments, pipeline rules, summaries, analytics, automated emails, and exports;
- Copilot conversations and streaming endpoints;
- cron and manual trigger endpoints;
- SSE processing endpoints;
- any internal route that queues AI or email work.

Public candidate application routes need a special rule: a creator's plan must be checked before accepting a response, not only when the recruiter later opens it. The response intake transaction must atomically enforce the form/job's response capacity.

### 10.2 Public form response intake

A public form has no authenticated applicant session that can be trusted for creator authorization. On each submission:

1. Load the form and owner.
2. Resolve the owner's `creator_form` entitlement.
3. Verify the form is active.
4. Atomically increment/reserve the response count only if the current period and stored limits allow it.
5. Create the response.
6. Queue scoring only if scoring quota is available.
7. If scoring quota is unavailable, retain the response for manual review and show the recruiter an upgrade state.

The route must not accept unlimited responses and enforce the limit later in a dashboard.

### 10.3 AI and streaming

For streaming:

- authorize and reserve before sending headers;
- use a reservation ID in server memory/queue metadata;
- commit exactly once on completion;
- release only on a known pre-provider failure;
- do not expose internal AI-provider errors as a path to retry without quota;
- stop generation if a live stream is revoked or the reservation is invalid.

### 10.4 Background work

Every queue/cron worker must perform a fresh server-side check immediately before execution. This covers:

- asynchronous form scoring;
- Standard candidate scoring;
- bulk resume extraction;
- Copilot continuation jobs;
- daily briefing generation;
- automated emails;
- pipeline rules;
- agent actions;
- assessment scoring;
- offer reminders.

If the plan changed after enqueueing:

- do not start new paid/AI work without a valid reservation;
- finish only work already durably reserved, according to the reservation policy;
- mark blocked work with a retryable/upgrade-required state;
- notify the owner when appropriate.

### 10.5 Collaboration

A team member's access is the intersection of:

1. the owner's category entitlement;
2. the member's job-scoped collaboration permission;
3. the operation's feature/limit authorization.

A collaborator must not bypass the owner's quota. Usage is charged to the owner/workspace, never to the collaborator's personal Free plan, unless a future workspace-billing model explicitly changes this rule.

---

## 11. Database-level and concurrency enforcement

MongoDB/Mongoose schema validation alone cannot enforce a cross-document rule such as “a user owns no more than five active jobs” under concurrency. The implementation must combine schema constraints, indexes, transactions where available, and atomic conditional updates.

### 11.1 Atomic quota reservation

For a counter quota:

```text
UPDATE usage_period
WHERE userId = ?
  AND category = ?
  AND periodKey = ?
  AND used + reserved + requested <= limit
INCREMENT reserved by requested
```

In MongoDB this should be an atomic `findOneAndUpdate` with a conditional filter. If it returns no document, the quota is exhausted or the period is stale.

Do not:

1. read the counter;
2. compare in JavaScript;
3. increment later.

That pattern is vulnerable to parallel requests.

### 11.2 Resource creation

For active jobs, seats, stored candidates, and form responses:

- use an atomic owner-scoped counter where practical;
- enforce ownership in the same logical transaction as the create;
- use unique indexes for identifiers and idempotency keys;
- re-count/repair counters periodically from source records;
- never let a client submit a trusted `candidateCount`, `responseCount`, or usage value.

### 11.3 Database validation

Schemas should enforce:

- enum category and plan values;
- non-negative numeric counters;
- valid period dates;
- valid provider status values;
- required owner IDs;
- maximum safe string/array sizes;
- unique provider subscription IDs;
- unique webhook event IDs;
- unique operation idempotency keys where appropriate.

Cross-document limits still belong in the entitlement service and atomic database operations.

### 11.4 Data retention and downgrade

Downgrades must not silently delete user data. If the account exceeds the new plan:

- preserve existing records;
- count only allowed active resources toward new creation;
- prevent creation of additional resources over the limit;
- prevent reactivating archived/closed resources if doing so would exceed the limit;
- keep read access to existing records where privacy and retention rules allow;
- block new automation/AI work when the relevant quota is unavailable;
- show a clear “over plan limit” state and upgrade path.

---

## 12. Razorpay integration architecture

### 12.1 Provider boundary

Keep Razorpay-specific code behind a backend provider module. Business logic should operate on provider-neutral concepts:

```text
createCheckout(...)
verifyPayment(...)
verifyWebhook(...)
fetchSubscription(...)
cancelSubscription(...)
pauseOrResumeSubscription(...) // only if supported and approved
```

The rest of the application should not construct Razorpay API payloads directly.

### 12.2 Credentials and configuration

Use Replit Secrets/environment configuration for:

- Razorpay key ID;
- Razorpay key secret;
- Razorpay webhook secret;
- any production/test mode flag;
- provider plan IDs by internal plan version.

Rules:

- never commit secrets;
- never log secrets, authorization headers, webhook bodies containing sensitive data, or full payment payloads;
- never put the key secret in frontend code;
- a key ID may be supplied to the Razorpay checkout script when required, but the backend creates and verifies the server-side order/subscription;
- maintain separate test and live configuration.

### 12.3 Razorpay plans

Create a Razorpay plan for every paid category/interval/version:

```text
seeker_pro_monthly
seeker_pro_yearly
seeker_ultra_monthly
seeker_ultra_yearly
creator_form_pro_monthly
creator_form_pro_yearly
creator_form_ultra_monthly
creator_form_ultra_yearly
creator_standard_pro_monthly
creator_standard_pro_yearly
creator_standard_ultra_monthly
creator_standard_ultra_yearly
```

The internal catalog maps each stable internal plan ID to its Razorpay plan ID and price. The browser submits only the internal plan/interval request. The server validates it against the catalog and creates the appropriate provider object.

Before launch, confirm the current Razorpay account supports the required recurring method for the chosen Indian payment methods. UPI AutoPay, cards, eMandate, regional availability, amount limits, and consent flows can depend on account/provider configuration.

### 12.4 Checkout flow

1. Authenticated user opens the pricing page.
2. Frontend requests the server to start checkout for a category and internal plan ID.
3. Backend validates role/category compatibility and the requested catalog version.
4. Backend verifies that the requested change is legal:
   - free to paid;
   - paid upgrade;
   - paid interval change;
   - no duplicate active subscription for the same category.
5. Backend creates the Razorpay subscription/order using server-side credentials.
6. Backend creates a pending checkout record with an idempotency key.
7. Frontend opens Razorpay Checkout with only the required public values.
8. Frontend sends the completion response to the backend.
9. Backend verifies the Razorpay signature and records the payment attempt.
10. Backend waits for/accepts the verified webhook as the authoritative activation signal.
11. Backend updates the subscription and creates the current usage period.
12. Frontend polls/refetches entitlement and shows the active plan.

A client callback may display “payment submitted” or “verification pending.” It must not directly set `plan = pro`.

### 12.5 Webhook endpoint

The webhook endpoint must:

- use the raw request body required for signature verification;
- verify the Razorpay webhook signature before parsing/acting;
- identify the provider event ID;
- atomically insert a webhook receipt/idempotency record;
- ignore duplicate event IDs after the first successful processing;
- process events in a safe, status-aware order;
- store a redacted audit record;
- return a success response only after the event is durably recorded;
- support replay/reconciliation tooling for failed processing.

Do not use ordinary JSON middleware before the raw-body verification path if that would change the signed payload.

### 12.6 Webhook event families

Implement handlers for the subscription/payment events enabled for the account, including the relevant Razorpay events for:

- subscription creation/authentication;
- subscription activation;
- successful recurring charge;
- pending payment;
- failed/ halted subscription;
- cancellation;
- completion/expiry;
- captured payment;
- failed payment;
- refund/chargeback if enabled.

Exact event names and payload fields must be checked against the current Razorpay API documentation during implementation. The handler must not silently treat an unknown event as a successful subscription state.

---

## 13. Subscription lifecycle

### 13.1 Free

- A user receives a local Free entitlement when the category is first used.
- No Razorpay record is required.
- The entitlement has the category's Free limits.
- A billing period is created for consistent monthly usage resets.
- A newly registered user must not receive paid limits through a missing-subscription fallback.

### 13.2 New paid subscription

- Pending checkout does not grant paid access.
- Verified activation grants the paid plan.
- The current period comes from the verified provider state.
- A usage-period snapshot is created with the paid plan's limits.
- The old Free period is closed or superseded without deleting its history.

### 13.3 Upgrade

The initial implementation should use one explicit policy and apply it consistently. Recommended policy:

- change to the higher plan through a new Razorpay subscription/approved provider flow;
- grant the higher entitlement only after verified provider confirmation;
- preserve already-used counters;
- use the new plan limits for the new entitlement period;
- do not retroactively refund or refill usage unless Razorpay and the product policy explicitly support it;
- if the provider supplies a proration/credit, record it in the billing ledger.

If an immediate upgrade is not supported safely, keep the current plan active and show “upgrade pending” until confirmation. Never create two active category subscriptions accidentally.

### 13.4 Downgrade

Recommended policy:

- schedule downgrade at the end of the current paid period;
- retain the paid plan through `currentPeriodEnd`;
- set `cancelAtPeriodEnd` or the provider equivalent;
- at period end, apply the lower plan and create a new limits snapshot;
- preserve data;
- block new activity that exceeds the lower plan;
- do not auto-delete jobs, candidates, applications, responses, resumes, or conversations.

If an immediate downgrade is later offered, it requires a dedicated policy for refunds, resource overage, and access changes. Do not implement it as a side effect of a button click.

### 13.5 Cancellation

- Cancellation at period end retains access until the paid period ends.
- The user may undo cancellation before the period end if Razorpay supports it and the backend confirms the state.
- At the end date, transition to Free unless the provider reports another valid paid state.
- Cancelled provider records remain in the database for audit.

### 13.6 Renewal

- A successful renewal extends `currentPeriodEnd`.
- Create a fresh usage-period snapshot.
- Do not carry unused quota forward.
- Keep historical usage periods immutable except for audit corrections.

### 13.7 Failed payment

Recommended launch policy:

- on a pending/failed payment, keep the paid entitlement until the current paid period end;
- show a non-blocking billing warning;
- do not start a new period with paid limits unless payment is verified;
- allow the user to update payment/authorize a retry;
- after the current period ends, move to Free or a restricted `past_due` state according to the provider's verified status;
- do not delete data;
- block new paid-capacity operations after paid access ends;
- allow read-only access and allowed Free/manual operations.

Use a short, clearly documented grace period only if Razorpay/account policy and business approval support it. The grace period must have a hard end timestamp and must not become an indefinite free upgrade.

### 13.8 Refunds, chargebacks, and disputes

- A refund does not automatically erase usage already consumed.
- A chargeback or confirmed fraud event can immediately revoke paid entitlement after server-side review/reconciliation.
- Preserve evidence and provider IDs.
- Block reactivation loops for the same disputed payment.
- Add customer-support/admin override tooling only with audited, time-limited grants.

---

## 14. Access after subscription changes

Authorization is evaluated at request time. Do not wait for a user to log out or for a JWT to expire.

Examples:

- A Standard Pro subscription ends while a scoring job is queued. The worker re-checks entitlement and must not start new unreserved scoring.
- A creator downgrades from Ultra to Free while owning 10 active jobs. Existing jobs remain stored; new job creation is blocked, and the dashboard explains which jobs must be archived or which upgrade restores capacity.
- A Seeker Pro user has 5 resume versions and downgrades to Free. Existing versions remain viewable; new versions are blocked until the user removes versions or upgrades. The server must not delete one automatically.
- A Form Job reaches its response cap through public submissions. The form shows a capacity-closed state and does not create more responses.

---

## 15. Security and bypass prevention

### 15.1 Threats to address

- calling backend APIs directly without using the UI;
- changing `plan`, `uid`, `category`, or `resourceId` in request JSON;
- replaying a successful checkout callback;
- replaying a webhook;
- forging a webhook signature;
- racing parallel requests against a quota;
- creating multiple browser sessions;
- using public form submissions to bypass creator quotas;
- triggering a low-level AI endpoint instead of the visible feature;
- retrying a timed-out AI request without an idempotency key;
- using collaborators to multiply quota;
- queuing work before downgrade and processing it after downgrade;
- exploiting archived/closed resources to exceed active limits;
- using unbounded array/file uploads to exhaust storage or AI parsing;
- creating multiple accounts to abuse Free capacity.

### 15.2 Required controls

- authenticate every private route;
- resolve owner from verified auth, never request body;
- enforce job/form/candidate ownership and collaboration boundaries;
- centralize plan checks;
- use atomic counters and idempotency keys;
- verify Razorpay signatures;
- use webhook event deduplication;
- rate-limit login, checkout, webhook, public forms, AI, uploads, and exports;
- cap file size, file count, request body size, and processing time;
- reject unknown plan/category/feature values;
- log blocked attempts and suspicious patterns without logging secrets;
- keep provider secret keys server-side;
- validate all server-side redirect and return URLs;
- use CSRF protection where cookie-authenticated mutations require it;
- prevent SSRF through uploaded URLs or external resume links;
- sanitize generated HTML/email/PDF content;
- keep prompt-injection defenses for candidate resumes, form answers, job descriptions, and Copilot context;
- ensure a user cannot use one category's resource ID in another category's quota path.

### 15.3 Admin/support overrides

Manual grants are dangerous and must be explicit:

- never modify the plan directly in an ad hoc database shell;
- create an audited entitlement override with issuer, reason, start, end, and scope;
- make overrides time-limited;
- require an internal permission;
- show active overrides in support tooling;
- never let a client request an override.

---

## 16. Upgrade experience and pricing UI

### 16.1 Pricing page

The pricing page should let users switch among:

- Job Seeker;
- Form Jobs;
- Standard Jobs.

It should show:

- Free, Pro, Ultra Pro;
- monthly/yearly toggle;
- INR price;
- annual savings;
- exact important limits;
- AI units;
- active jobs/applications/candidates;
- processing priority;
- team seats;
- clear “Most popular” Pro treatment.

Do not advertise “unlimited” without a fair-use explanation.

### 16.2 Limit modal

Every block should identify:

- what limit was reached;
- current usage;
- plan limit;
- reset time;
- the recommended upgrade;
- what the upgrade unlocks;
- whether manual alternatives remain available.

Example:

> You used all 10 Free Standard Job AI scores for this period. Your candidates are still available for manual review. Upgrade to Pro for 300 AI-scored candidates per billing period.

### 16.3 Checkout and pending state

The UI must support:

- checkout opening;
- payment submitted;
- webhook verification pending;
- active subscription;
- payment failed;
- cancellation scheduled;
- subscription expired;
- reconciliation retry.

Never display “Pro active” based only on the checkout modal's success callback.

### 16.4 Account billing page

Show per category:

- plan;
- billing interval;
- next renewal/end date;
- status;
- usage;
- payment action;
- cancellation state;
- upgrade/downgrade action;
- support/reconciliation state.

If a user has no entitlement for a category, display Free rather than an ambiguous blank state.

---

## 17. Observability, reconciliation, and support

### 17.1 Required logs/metrics

Track:

- entitlement resolution failures;
- quota reservations, commits, releases, and reversals;
- blocked operations by category/feature/plan;
- AI units and provider cost;
- payment attempts;
- webhook receipt, verification, duplicate, and processing failures;
- subscription state transitions;
- period creation failures;
- resource count mismatches;
- public form capacity blocks;
- suspicious repeated limit failures;
- checkout-to-webhook conversion.

### 17.2 Reconciliation

Build a protected server/admin job that:

1. fetches current provider state for active/non-terminal subscriptions;
2. compares it with the local record;
3. records mismatches;
4. repairs only through an audited state transition;
5. never blindly overwrites local history;
6. can replay a webhook safely.

Run reconciliation periodically and after provider incidents.

### 17.3 Counter repair

Usage counters are performance/state records, not the only audit source. Provide a repair job that can calculate usage from the ledger/source records and compare it with the period counter. Repair requires an audit log and must not silently grant extra quota.

---

## 18. Testing requirements

Do not ship monetization until all of the following are covered.

### 18.1 Unit tests

- plan catalog returns correct limits;
- category/plan combinations are valid;
- Free is the default;
- AI weights are correct;
- period boundary calculation is correct;
- downgrade over-limit behavior is correct;
- error codes are stable;
- usage reservation rejects the exact boundary correctly;
- reservation release/commit is idempotent.

### 18.2 Integration tests

- direct API calls cannot bypass the UI gate;
- wrong `uid` and wrong `category` are rejected;
- a Free user cannot create a second active job/form;
- public responses stop at the form limit;
- concurrent requests cannot exceed a quota;
- duplicate scoring requests charge once;
- streaming endpoints reserve before starting;
- background jobs re-check after a plan change;
- collaborators consume the owner's quota;
- existing records remain readable after downgrade;
- blocked paid operation does not call the AI provider;
- Razorpay signature verification rejects tampered payloads;
- duplicate webhooks are harmless;
- out-of-order webhooks do not downgrade a newer valid state;
- checkout callback alone does not activate a plan;
- failed renewal removes paid capacity only according to lifecycle policy.

### 18.3 End-to-end tests

For each category:

1. create a new account;
2. use Free limits;
3. hit a limit and confirm the UX;
4. start Razorpay test checkout;
5. process a verified activation webhook;
6. confirm Pro entitlement;
7. use the increased limit;
8. schedule cancellation;
9. confirm access until period end;
10. confirm Free limits after expiry;
11. confirm data retention and blocked over-limit actions.

### 18.4 Abuse tests

- parallel browser tabs;
- repeated retry after timeout;
- duplicate form submission;
- replayed checkout completion;
- replayed webhook;
- forged plan in request body;
- forged resource owner;
- high-rate AI calls;
- oversized bulk uploads;
- account switching in one browser;
- archived/closed resource reactivation at the limit.

---

## 19. Implementation roadmap

### Phase 0 — Freeze the contract

- approve this document and the exact launch limits;
- decide tax/invoice requirements with the business;
- confirm Razorpay recurring capabilities for the production account;
- create test/live provider plan IDs;
- define support and refund policy.

### Phase 1 — Billing domain foundation

- replace Stripe-specific subscription fields and enum values;
- add category-aware plans and intervals;
- add provider-neutral status history;
- add plan catalog;
- add usage-period and usage-ledger models;
- add webhook receipt/idempotency model;
- add indexes and migration/backfill strategy;
- create Free entitlements for existing users without granting paid access.

### Phase 2 — Central entitlement and quota services

- implement entitlement resolution;
- implement period creation/renewal;
- implement atomic quota reservations;
- implement commit/release/idempotency;
- implement resource-count helpers;
- define stable limit error codes;
- add backend tests before wiring individual routes.

### Phase 3 — Razorpay integration

- add provider client boundary;
- create server-side checkout/subscription creation;
- add raw-body webhook route;
- verify signatures and event IDs;
- implement state transitions;
- implement reconciliation;
- add test-mode observability.

### Phase 4 — Protect existing product surfaces

Audit and gate every relevant route:

- seeker AI and workspace routes;
- Form Job CRUD, response intake, scoring, assessments, rules, summaries, email, exports;
- Standard Job CRUD, candidates, parsing, scoring, imports, assessments, rules, agent, analytics, Copilot, offers, emails, collaboration;
- cron/manual jobs;
- SSE and queue workers.

For each route, document:

- category;
- ownership scope;
- feature key;
- resource counter;
- AI units;
- idempotency behavior;
- downgrade behavior.

### Phase 5 — Frontend billing and gates

- add entitlement context;
- add usage summaries;
- add pricing page/category switcher;
- add limit modals and inline gates;
- add billing page;
- add pending/payment-failed/cancelled states;
- preserve manual alternatives.

### Phase 6 — Migration and rollout

- backfill existing accounts to Free category entitlements;
- do not map old Stripe plan names to paid Razorpay access without verified business approval;
- run in shadow mode to compare expected blocks with actual usage;
- enable hard blocks category by category;
- monitor false positives and counter mismatches;
- launch with Razorpay test mode, then live mode.

### Phase 7 — Post-launch hardening

- reconciliation dashboard;
- counter repair tooling;
- abuse detection;
- provider incident runbook;
- subscription support tools;
- pricing/limit analytics;
- review limits after real cost and conversion data.

---

## 20. Migration notes for the current repository

The current repository already contains:

- Express + TypeScript backend;
- MongoDB/Mongoose models;
- authenticated recruiter/seeker profiles;
- `Subscription.ts` with Stripe-specific fields;
- `UsageEvent.ts` for generic usage analytics;
- Standard Job, Form Job, candidate, response, assessment, Copilot, offer, collaboration, and seeker workspace models/routes.

The current `Subscription.ts` must not be treated as the finished Razorpay design because it currently has:

- `stripeCustomerId`;
- `stripeSubscriptionId`;
- Stripe-oriented plan values such as `agency` and `seeker_pro`;
- no monetization category;
- no billing interval;
- no usage period or quota counters.

Implementation must preserve existing authentication and ownership behavior. Do not restructure the app or replace MongoDB. Add the billing domain beside the current models, then update route boundaries incrementally.

The existing `UsageEvent.ts` can remain useful for analytics, but it cannot be the only source of quota enforcement because it does not provide atomic period counters, reservations, or idempotency.

Do not install or configure Razorpay until the implementation phase begins and the production/test provider setup is approved. Payment code must use the package and API version supported by the current Razorpay documentation at implementation time.

---

## 21. Additional rules and edge cases

### 21.1 Account role/category mismatch

- Seeker features require a seeker profile/role.
- Creator Form Jobs require creator access and the `creator_form` entitlement.
- Creator Standard Jobs require creator access and the `creator_standard` entitlement.
- A user must not obtain a creator category subscription merely by changing a client-side role field.

### 21.2 Multiple sessions

All sessions resolve the same database entitlement. Logging in on another device does not reset quota.

### 21.3 Time and period boundaries

- Store timestamps in UTC.
- Use the provider's verified period dates for paid subscriptions.
- Use a documented UTC monthly boundary for Free/local periods.
- Display India-local dates in the UI.
- Test daylight-saving-independent behavior; India has no DST, but server UTC behavior still matters.

### 21.4 Failed AI operation

Do not automatically refund quota repeatedly on ambiguous failures. Use reservation states and a support/audit path. A provider timeout must not create an infinite free retry loop.

### 21.5 Deleted records

Deletion does not automatically refund usage already consumed. A deleted job may free an active-resource slot if the product defines it as no longer active, but it does not retroactively restore AI, email, import, or response quota.

### 21.6 Archived records

Archived/closed records do not count toward active-job limits where stated, but they still count toward stored-record limits unless the plan table explicitly says otherwise. Reactivation requires a fresh active-limit check.

### 21.7 Support grants

Any complimentary Pro/Ultra access must have an expiration and audit trail. It must not modify Razorpay payment records or be represented by a client-side flag.

### 21.8 Provider outage

If Razorpay is unavailable:

- do not grant paid access based on an unverified client callback;
- keep an existing verified entitlement available until its known end state;
- mark new checkout as pending/unavailable;
- provide a retry path;
- reconcile after recovery.

### 21.9 AI provider outage

AI provider failure is not an entitlement failure. Preserve the user's plan and data. Follow the reservation policy and show a retryable error without allowing repeated unmetered retries.

### 21.10 Privacy and candidate data

Billing/usage logs must not include resume text, form answers, phone numbers, email bodies, or unnecessary candidate PII. Store resource IDs and aggregate metadata where possible.

---

## 22. Final acceptance criteria

The monetization implementation is complete only when:

- all three categories have independent Free/Pro/Ultra entitlements;
- all prices and limits come from the backend catalog;
- every listed limit is enforced server-side;
- frontend gates are present but are not relied upon for security;
- direct API calls cannot bypass limits;
- public form intake enforces owner quota before creating responses;
- AI, email, bulk, assessment, offer, export, and background operations are metered;
- usage reservations are atomic and idempotent;
- downgrade preserves data and blocks over-limit new work;
- Razorpay signatures and webhook IDs are verified;
- checkout success alone cannot activate paid access;
- renewal, cancellation, failed payment, expiry, and reconciliation are implemented;
- concurrent and replay attacks are tested;
- existing Stripe-specific model assumptions are removed or isolated;
- pricing, limits, UI copy, API error codes, tests, and this document agree.

This system should optimize for trust and conversion: Free users get a convincing, honest demonstration; paid users get predictable capacity; and no user can accidentally or intentionally receive paid capacity without a verified entitlement.