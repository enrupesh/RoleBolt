# Phase 5 — Razorpay Production Lifecycle Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md) §12–13, [`paymentgateway.md`](./paymentgateway.md) Phase 5  
**Result:** Phase 5 review gate **PASSED** (implementation + automated tests). Live Razorpay credential configuration remains an ops go-live step.

---

## 1. Scope

Complete real-user Razorpay lifecycle flows after Phases 1–4 product enforcement:

- Cancel at period end
- Upgrade / downgrade without client-side activation
- Webhook cancel-at-period-end + failed-payment handling
- Reconciliation CLI / self-service repair
- Ops documentation for env, plan sync, webhook registration, and go-live

---

## 2. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Env / plan sync / webhook docs | ✅ | README + paymentgateway Phase 5 |
| `POST /billing/cancel-subscription` | ✅ | Default `cancel_at_cycle_end: true`; local `cancelAtPeriodEnd` |
| `POST /billing/change-plan` | ✅ | Upgrade `now`, downgrade `cycle_end`; `activation: webhook_required` |
| `POST /billing/cancel-pending-plan-change` | ✅ | Cancels Razorpay scheduled update |
| Webhook cancel-at-period-end fix | ✅ | No longer treats `has_scheduled_changes` as cancel |
| Provider plan-id reverse lookup | ✅ | Plan-change webhooks prefer `plan_id` over stale notes |
| Stale / out-of-order webhook guard | ✅ | `lastProviderEventAt` + regressive status check |
| Failed payment / past_due | ✅ | `pending` warning; `past_due`/`halted` metered block |
| Reconciliation CLI | ✅ | `npm run billing:reconcile` + audit log |
| Self-service reconcile API | ✅ | `POST /billing/reconcile-subscription` |
| Billing audit log | ✅ | `BillingAuditLog` model |
| Review-gate unit tests | ✅ | `subscriptionLifecycle.test.ts` + entitlements/razorpay updates |

---

## 3. API surface added

| Method | Path | Activation rule |
|---|---|---|
| POST | `/billing/cancel-subscription` | Keeps paid access until period end when scheduled |
| POST | `/billing/change-plan` | Sets `pending*` only; webhook grants new plan |
| POST | `/billing/cancel-pending-plan-change` | Clears pending local + provider scheduled update |
| POST | `/billing/reconcile-subscription` | Provider fetch is authority |
| CLI | `npm run billing:reconcile` | Batch repair with `--dry-run` |

Existing (unchanged contract):

- `POST /billing/create-checkout` — now returns `CHANGE_PLAN_REQUIRED` when a paid Razorpay sub already exists
- `POST /billing/verify-checkout` — still never mutates `Subscription`
- `POST /billing/webhook` — shared apply path with reconciliation

---

## 4. Security and correctness decisions

1. Checkout redirects, verify-checkout, and change-plan responses never unlock paid entitlements.
2. Upgrades call Razorpay immediately (`schedule_change_at: now`) but local `plan` stays until webhook/reconciliation.
3. Downgrades schedule at `cycle_end` and keep current paid limits until then.
4. Cancel defaults to period-end; immediate cancel requires explicit `immediate: true`.
5. Webhook mapping resolves catalog entries from configured provider plan IDs so upgrades are not ignored due to stale notes.
6. Out-of-order regressive webhooks are ignored when a newer provider event was already applied.
7. `subscription.pending` keeps paid metered access with a non-blocking `payment_pending` warning.
8. `past_due` / `halted` retain plan metadata but block new metered work (`payment.md` §13.7).
9. Reconciliation writes `BillingAuditLog` entries for repair / noop / failure.
10. Razorpay secrets and plan IDs remain server-side only.

---

## 5. Review gate

| Check | Result |
|---|---|
| Forged checkout signature rejected | ✅ |
| Forged webhook signature rejected | ✅ |
| Cancel at period end retains Pro until period end | ✅ |
| Failed renewal pending/past_due behavior | ✅ |
| Upgrade mapping prefers provider `plan_id` | ✅ |
| Unknown provider plan IDs ignored | ✅ |
| Reconciliation CLI present | ✅ |
| `tsc --noEmit` | ✅ |
| `npm test` | ✅ 109/109 pass |

### Ops remaining before live keys

These are environment actions, not missing code:

1. Set `RAZORPAY_*` and 18 plan ID env vars (test mode)
2. Run `npm run billing:sync-razorpay-plans` for any missing plans
3. Register `POST /billing/webhook` in the Razorpay dashboard
4. Execute test-mode E2E: checkout → webhook → entitlement → cancel → reconcile
5. Switch to live keys only after the above passes

---

## 6. Key files

| File | Role |
|---|---|
| `backend/src/billing/razorpay.ts` | Fetch / cancel / update / cancel-scheduled-changes + plan reverse lookup |
| `backend/src/billing/razorpayLifecycle.ts` | Shared webhook + reconciliation apply path |
| `backend/src/billing/subscriptionLifecycle.ts` | Cancel / change-plan / reconcile business logic |
| `backend/src/billing/razorpayApi.ts` | HTTP routes |
| `backend/src/billing/reconcileRazorpaySubscriptions.ts` | CLI |
| `backend/src/models/BillingAuditLog.ts` | Audit trail |
| `backend/src/models/Subscription.ts` | Pending change + `lastProviderEventAt` fields |
| `backend/src/billing/subscriptionLifecycle.test.ts` | Phase 5 review-gate tests |

---

## 7. Verdict

**Phase 5 is complete.** Proceed to **Phase 6 — Frontend billing, pricing, and upgrade UX**. Do not advertise live checkout to customers until ops finishes the test-mode checklist and Phase 6 replaces the legacy Stripe/USD UI.
