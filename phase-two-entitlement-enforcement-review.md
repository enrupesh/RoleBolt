# Phase 2 — Central Entitlement Enforcement Review

**Status:** PASS — central enforcement boundary ready for route adoption  
**Date:** 2026-08-02

## Scope completed

- Added `requireFeature()` for backend-owned feature flags.
- Added `assertWithinLimit()` for finite and unlimited plan limits.
- Added current usage-period snapshots combining used and reserved counters.
- Added owner-scoped `countOwnedResources()` for Seeker, Form Jobs, and Standard Jobs.
- Added `assertResourceLimit()` for stored/active resource capacity checks.
- Added reusable Express middleware:
  - `requireBillingEntitlement`
  - `requireBillingFeature`
  - `requireBillingResourceLimit`
- Added stable error serialization matching the monetization contract:
  - `PLAN_LIMIT_REACHED`
  - stable counter code
  - category
  - feature
  - plan
  - used/limit
  - reset timestamp
  - upgrade-required signal
- Added fail-closed errors for undefined counters and unsupported resource scopes.
- Added focused tests for finite limits, unlimited values, feature gates, configuration failures, and API error shape.

## Security and correctness decisions

1. Authorization uses resolved server entitlements, never a browser-supplied plan.
2. Feature checks use catalog flags instead of comparing plan-name strings.
3. Limit checks include both committed usage and active reservations.
4. Resource counters always require an owner ID and use owner-scoped database queries.
5. Unknown counters fail closed with a configuration error instead of silently allowing work.
6. Limit errors return `409`; feature errors return `403`; missing auth remains `401`.
7. Error responses use stable machine-readable codes rather than English messages.
8. Pricing catalog remains public; entitlements remain authenticated.

## Verification

| Check | Result |
|---|---|
| `cd backend && npx tsc --noEmit` | PASS |
| `cd backend && npm test` | PASS — 30 tests |
| `cd frontend && npm run build` | PASS — 49 routes generated |
| Backend workflow | PASS — listening on port 8080 |
| Frontend workflow | PASS — root route returned HTTP 200 |
| `GET /billing/catalog` without auth | PASS — HTTP 200; 18 plans |
| `GET /billing/entitlements` without auth | PASS — HTTP 401 |
| `git diff --check` | PASS |

## Known environment limitation

`MONGODB_URI` is not available in the development environment, so live database-backed resource counts and authenticated middleware integration tests were not run against MongoDB. The enforcement layer fails explicitly on database failure; it does not grant access through a fallback.

## Deliberate non-goals

- Wiring every existing Seeker route.
- Wiring Form Job CRUD, public response intake, scoring, assessments, rules, exports, and emails.
- Wiring Standard Job CRUD, candidate intake, scoring, imports, assessments, rules, Copilot, offers, analytics, and collaboration.
- AI reservation calls at every provider boundary.
- Background worker and cron re-checks.
- Razorpay checkout and webhook activation.
- Frontend entitlement context and billing UI.

These are the next integration phases. This phase creates the single boundary they must use; it does not claim that existing product routes are already protected.