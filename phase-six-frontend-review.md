# Phase 6 — Frontend Billing, Pricing & Upgrade UX Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 6  
**Result:** Phase 6 review gate **PASSED** (unit tests + code audit). Visual checkout E2E with live Razorpay test keys remains an ops checklist item.

---

## 1. Scope

Replace legacy Stripe/USD billing UI with backend-driven INR catalog, entitlement context, limit modals, and webhook-safe checkout UX.

---

## 2. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Replace `pricing/page.tsx` | ✅ | `GET /billing/catalog`, category switcher, INR cards, monthly/yearly, Pro badge, Razorpay + `Idempotency-Key` |
| Replace `billing/page.tsx` | ✅ | `GET /billing/entitlements`, usage bars, cancel, pending webhook state, upgrade-unlocks panel |
| `BillingEntitlementContext` | ✅ | Polls on load + while checkout/pending; `canUse`, `remaining`, `processingPriority` |
| Limit modals + inline gates | ✅ | `BillingLimitNotice` wired into seeker/form/standard error notices |
| Seeker billing route | ✅ | `/seeker/billing` → shared `/recruit/billing?category=seeker`; nav link in `SeekerHeader` |
| Processing priority indicators | ✅ | Pricing + billing pages show queue priority |
| Legacy route aliases | ✅ | `/billing` redirects to recruit billing |
| SEO / FAQ alignment | ✅ | Recruit FAQ + JSON-LD use INR free-tier framing |
| Frontend billing tests | ✅ | `frontend/src/lib/billing.test.ts` |

---

## 3. Security rules verified

| Rule | Implementation |
|---|---|
| No client-side paid activation | Billing page ignores `?success=1`; shows webhook-pending copy |
| Checkout verify does not unlock | Post-checkout redirects to `?checkout=pending` after `verify-checkout` |
| Stable error codes only | `isUpgradeRequiredError` checks API payload codes, not English text |
| Server catalog is source of truth | Pricing page never hardcodes plan prices or limits |
| Idempotency on checkout | `createCheckout` sends `Idempotency-Key` header |

---

## 4. Review gate

| Check | Result |
|---|---|
| All 9 plan states (3 categories × 3 tiers) | ✅ Catalog-driven cards render per category + interval |
| Checkout flow | ✅ Code path: checkout → verify → pending → poll entitlements (no client activation) |
| Limit modal | ✅ `BillingLimitNotice` opens modal with used/limit/reset + upgrade CTA |
| No USD/Stripe in billing UI | ✅ Grep clean (`agency` only in unrelated recruiter-profile copy) |
| Frontend unit tests | ✅ `npm test` includes `billing.test.ts` |
| Production build | Run `cd frontend && npm run build` before deploy |

---

## 5. Files owned by Phase 6

| File | Role |
|---|---|
| `frontend/src/lib/billing.ts` | Catalog, entitlements, checkout, Razorpay helpers |
| `frontend/src/lib/billing.test.ts` | Phase 6 unit tests |
| `frontend/src/contexts/BillingEntitlementContext.tsx` | Entitlement provider + polling |
| `frontend/src/components/PlanLimitModal.tsx` | Modal, inline notice, `BillingLimitNotice` |
| `frontend/src/components/*ErrorNotice.tsx` | Stable billing error surfaces |
| `frontend/src/app/recruit/pricing/page.tsx` | INR pricing page |
| `frontend/src/app/recruit/billing/page.tsx` | Usage + lifecycle management |
| `frontend/src/app/seeker/billing/page.tsx` | Seeker shortcut |
| `frontend/src/app/billing/page.tsx` | Legacy alias redirect |
| `frontend/src/components/SeekerHeader.tsx` | Billing nav link |

---

## 6. Verdict

**Phase 6 is complete.** Proceed to **Phase 7 — Security hardening and abuse prevention**.

```bash
cd frontend
npm test
npm run build
```
