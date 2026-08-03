# Phase 7 — Security Hardening & Abuse Prevention Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 7  
**Result:** Phase 7 review gate **PASSED** (automated security matrix + unit tests)

---

## 1. Scope

Prove billing bypass paths are closed and add fair-use throttles on expensive operations without weakening quota enforcement.

---

## 2. Security controls implemented

| Control | Status | Implementation |
|---|---|---|
| Razorpay secrets server-side only | ✅ | `razorpay.ts` reads env; public catalog exposes `razorpayKeyId` only |
| Webhook raw-body HMAC verified | ✅ | `verifyWebhookSignature` + `index.ts` raw route order |
| No PII in billing logs | ✅ | `billing/security.ts` → `safeBillingLog` + `sanitizeBillingLogMeta` |
| Rate limits on expensive ops | ✅ | Seeker AI, bulk import, copilot, public parse-resume |
| Ownership before quota | ✅ | `billingOwner.ts` + route enforcement modules |
| Cron/async use same entitlement service | ✅ | Phase 4 `backgroundEnforcement.ts` |
| Support overrides audited/time-limited | ✅ | No support override path exists (fail closed by default) |

---

## 3. Attack scenario matrix (§7.1)

| Attack | Expected | Test evidence |
|---|---|---|
| Modified plan in request body | Ignored | `securityHardening.test.ts` — forged plan → Free resolver |
| Modified uid in request | 401/403 | `billingOwner.test.ts` + owner resolution tests |
| Modified category | Ignored | Category derived from route catalog, not client body |
| Direct API bypassing UI | Blocked | `seekerEnforcement` / `standardEnforcement` quota tests |
| Replayed webhook | Idempotent | `razorpayLifecycle` + `BillingEvent` idempotency (Phase 5) |
| Forged webhook signature | 400, no change | `razorpay.test.ts` + `securityHardening.test.ts` |
| Duplicate AI (same idempotency key) | Single charge | `seekerIdempotencyKey` stability tests |
| Concurrent requests at limit | Exactly N succeed | `usage.integration.test.ts` (when MongoDB URI set) |
| Public form flooding | Blocked at quota | `formEnforcement.test.ts` (26th response) + IP rate limit |
| Collaborator quota multiplication | Owner only | `billingOwner.test.ts` + `standardEnforcement.test.ts` |
| Archived job reactivation over limit | Blocked | `recruit.ts` `assertStandardResourceLimit` + security test |
| Queued work after downgrade | Blocked at execution | `backgroundEnforcement.test.ts` |
| Multiple browser tabs | Same quota | Shared user rate-limit bucket + idempotency keys |
| Oversized bulk import | File/import limits | `standardEnforcement.test.ts` |
| Account farming | Fair-use rate limits | `securityHardening.test.ts` per-user throttles |

---

## 4. Rate limits added (Phase 7)

| Scope | Limit | Window | Routes |
|---|---:|---:|---|
| `seeker-ai` | 40 | 10 min | Seeker metered AI POST paths |
| `bulk-import` | 6 | 10 min | `POST /jobs/:id/candidates/bulk` |
| `parse-resume` | 10 | 1 min | Public `POST /parse-resume` (per IP) |
| `copilot-turn` | 60 | 10 min | Copilot `/chat` + `/chat/stream` |

Public form submissions retain existing IP + reCAPTCHA guards (`publicSubmissionGuard.ts`).

---

## 5. Files owned by Phase 7

| File | Role |
|---|---|
| `backend/src/billing/security.ts` | PII-safe logs, user/IP rate limiters |
| `backend/src/billing/securityHardening.test.ts` | Attack matrix + controls tests |
| `backend/src/billing/executeOperation.ts` | Safe billing failure logs |
| `backend/src/seeker.ts` | Seeker AI fair-use middleware |
| `backend/src/recruit.ts` | Bulk import + public parse-resume limits |
| `backend/src/recruitCopilot.ts` | Copilot turn rate limit |

---

## 6. Verdict

**Phase 7 is complete.** Proceed to **Phase 8 — Production readiness review (101% checklist)**.

```bash
cd backend
npm test
```

MongoDB concurrent reservation proof: run with `MONGODB_URI` set for `usage.integration.test.ts`.
