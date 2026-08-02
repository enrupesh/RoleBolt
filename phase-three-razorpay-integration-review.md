# Phase 3 — Verified Razorpay Integration Review

**Status:** PASS — provider boundary implemented; paid activation remains configuration-controlled  
**Date:** 2026-08-02

## Scope completed

- Added a provider-neutral Razorpay HTTP client using server-only credentials.
- Added server-owned plan ID resolution:
  - `RAZORPAY_PLAN_<CATEGORY>_<PLAN>_<INTERVAL>`
- Added Razorpay subscription creation from the backend catalog.
- Added Razorpay plan synchronization command:

```bash
cd backend
npm run billing:sync-razorpay-plans
```

- Added `BillingCheckout` records with owner/category/plan/interval/idempotency protection.
- Added authenticated checkout route:

```text
POST /billing/create-checkout
```

- Added authenticated checkout signature acknowledgement:

```text
POST /billing/verify-checkout
```

- Added raw-body Razorpay webhook route:

```text
POST /billing/webhook
```

- Added webhook HMAC verification with `RAZORPAY_WEBHOOK_SECRET`.
- Added checkout signature verification with `RAZORPAY_KEY_SECRET`.
- Added event ID and payload-hash idempotency.
- Added duplicate event race handling and retry of non-terminal `received` events.
- Added subscription lifecycle reconciliation for:
  - authenticated
  - activated
  - charged
  - pending
  - halted
  - paused
  - resumed
  - cancelled
  - completed
- Added provider-plan matching against the server-owned catalog before entitlement mutation.
- Added subscription period and provider payment/customer field reconciliation.
- Kept legacy Stripe mutation paths disabled and mounted after active Razorpay routes.

## Security and correctness decisions

1. Frontend plan, redirect, local state, and checkout success cannot activate paid access.
2. `verify-checkout` only records a verified checkout attempt; it never mutates `Subscription`.
3. Only a verified Razorpay webhook can reconcile a paid subscription.
4. Webhooks require both a valid raw-body HMAC and `x-razorpay-event-id`.
5. Replayed event IDs with a different payload hash are rejected.
6. Unknown or mismatched provider plan IDs are ignored and cannot grant access.
7. Missing Razorpay configuration returns an explicit `503`; it never falls back to Free-as-paid or silently activates access.
8. Checkout idempotency keys are owner-scoped and cannot be reused for another category, plan, or interval.
9. Provider lifecycle states that are not paid-eligible remain non-entitled through the existing resolver.
10. Razorpay secrets and plan IDs are never exposed through the public catalog or API response.

## Verification

| Check | Result |
|---|---|
| `cd backend && npx tsc --noEmit` | PASS |
| `cd backend && npm test` | PASS — 35 tests |
| `cd frontend && npm run build` | PASS — 49 routes generated |
| Backend workflow after restart | PASS — listening on port 8080 |
| Frontend workflow | PASS — root returned HTTP 200 |
| `GET /health` | PASS — HTTP 200 |
| `GET /billing/catalog` without auth | PASS — HTTP 200; 18 plans |
| Checkout without auth | PASS — HTTP 401 |
| Checkout verification without auth | PASS — HTTP 401 |
| Malformed webhook body | PASS — HTTP 400 before provider configuration lookup |
| Legacy portal without auth | PASS — HTTP 401 |
| `git diff --check` | PASS |

## Environment limitation

No Razorpay credentials or MongoDB URI are configured in this development environment:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- server-side Razorpay plan ID variables
- `MONGODB_URI`

Therefore, live Razorpay API calls, authenticated database-backed checkout records, and end-to-end webhook reconciliation could not run here. The implementation fails explicitly until these values are configured. No paid access was enabled.

## Deliberate non-goals

- Live Razorpay credential setup.
- Production webhook registration.
- Paid activation before Phase 4 route enforcement and integration tests.
- Route-by-route Seeker, Form Job, and Standard Job quota wiring.
- Frontend pricing and billing UI replacement.
- Production deployment or live payment verification.

The next roadmap phase is **Phase 4 — Protect existing product surfaces**. Phase 3 is provider-ready but not live-enabled.