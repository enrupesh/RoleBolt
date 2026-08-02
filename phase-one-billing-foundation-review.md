# Phase 1 — Billing Domain Foundation Review

**Status:** PASS — foundation ready for Phase 2 entitlement enforcement  
**Date:** 2026-08-02

## Scope completed

- Replaced the legacy subscription shape with category-aware, provider-neutral records:
  - `seeker`
  - `creator_form`
  - `creator_standard`
- Added explicit `free`, `pro`, and `ultra` plans with monthly/yearly intervals.
- Added the backend-owned INR plan catalog and sanitized public catalog endpoint.
- Added usage-period snapshots with plan limits and billing-period boundaries.
- Added append-only usage ledger records with reservation, commit, release, and idempotency fields.
- Added Razorpay webhook receipt/event storage model.
- Added entitlement resolution that defaults safely to Free.
- Added idempotent Free-entitlement migration command for existing users.
- Added atomic Mongo transaction boundaries for usage reservation and transitions.
- Retired Stripe checkout, portal, and webhook mutation behavior with explicit `410` responses.

## Security and correctness decisions

1. A browser plan, success redirect, local-storage flag, or legacy Stripe record cannot grant a Razorpay paid entitlement.
2. Paid access requires a `razorpay` subscription, a paid catalog plan, an allowed active status, and a non-expired period.
3. Legacy subscription fields remain read-compatible but are not used by the new entitlement resolver.
4. The public catalog omits Razorpay plan IDs and customer/provider identifiers.
5. Entitlement reads are authenticated; pricing metadata is public and read-only.
6. Usage reservations require an idempotency key and reject reuse for a different user, category, operation, or quantity.
7. Reservation, quota counter increment, and ledger creation share a Mongo transaction.
8. Commit/release transitions are idempotent and update the ledger and usage period in one transaction.
9. Free migration is an explicit command and does not mutate data during server startup.

## Verification

| Check | Result |
|---|---|
| `cd backend && npx tsc --noEmit` | PASS |
| `cd backend && npm test` | PASS — 24 tests |
| `cd frontend && npm run build` | PASS — 49 routes generated |
| Backend workflow | PASS — listening on port 8080 |
| Frontend workflow | PASS — root route returned HTTP 200 |
| `GET /billing/catalog` without auth | PASS — HTTP 200; 18 plans; no Razorpay IDs |
| `GET /billing/entitlements` without auth | PASS — HTTP 401 |
| `POST /billing/create-checkout` without auth | PASS — HTTP 401 |
| `git diff --check` | PASS |

## Known environment limitation

The development backend reports `MONGODB_URI` is missing, so database-backed reservation, migration, and authenticated entitlement integration tests could not run against a live MongoDB instance. The code fails explicitly rather than granting access or silently falling back.

## Deliberate non-goals

- Razorpay SDK, checkout creation, signature verification, and webhook processing.
- Route-by-route quota enforcement.
- Public Form Job intake enforcement.
- AI provider reservation wiring.
- Frontend pricing/billing replacement.
- Background worker and collaboration seat enforcement.

These are Phase 2+ work. No paid Razorpay access should be enabled until those controls are implemented and integration-tested.