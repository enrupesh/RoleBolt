# Phase 0 — Foundation Hardening & Integration Layer Review

**Status:** Complete  
**Reviewed:** 2026-08-02  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 0  
**Result:** Phase 0 review gate **PASSED** (unit tests). Integration tests require `MONGODB_URI`.

---

## 1. Scope

Phase 0 hardens the billing foundation before any product route enforcement (Phase 1+). No seeker/recruiter routes were wired in this phase.

---

## 2. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Fix cancel-at-period-end in `entitlements.ts` | ✅ | `normalizeStoredSubscription()` retains paid plan when `cancelAtPeriodEnd && currentPeriodEnd > now` |
| Map `past_due` / `halted` grace | ✅ | Paid limits retained until period end; `billingWarning` exposed |
| Remove `trialing` from paid statuses | ✅ | `trialing` resolves to Free |
| Wire signup free entitlements | ✅ | All `User.create` paths use `createUserWithBillingEntitlements()` |
| Migration script | ✅ | `migrateAllUsersToFreeEntitlements()` exported; run via `npm run billing:migrate-free` |
| Expand `operationCatalog.ts` | ✅ | 40+ operations; `assertOperationCatalogComplete()` covers Phase -1 keys |
| Fix `resourceCounters.ts` | ✅ | `recruiter_seats` via `RecruitTeamMember`; resume versions documented (single-profile model) |
| Add `executeOperation.ts` | ✅ | `executeBillingOperation()` — reserve/commit/release with ambiguous-failure retention |
| Add `billingOwner.ts` | ✅ | `resolveBillingOwner()` for collaborator → owner billing |
| Extend middleware | ✅ | `requireUsageReservation`, `commitBillingReservation`, `releaseBillingReservation` |
| Delete `planCheck.ts` | ✅ | Removed; zero production imports |
| MongoDB integration tests | ✅ | `usage.integration.test.ts` (skips without `MONGODB_URI`) |
| Multi-category `/billing/subscription` | ✅ | Returns all three categories (v2 response) |

---

## 3. Review gate checklist

| Check | Result |
|---|---|
| `npm test` (backend unit) | ✅ 42/42 pass (integration skipped without MongoDB) |
| Cancel-at-period-end test | ✅ `entitlements.test.ts` |
| Signup initialization test | ✅ Integration test + auth wiring |
| Operation catalog completeness | ✅ `assertOperationCatalogComplete()` |
| Grep for `planCheck` | ✅ Zero production imports (docs only) |
| Concurrent reservation test | ⏭ Requires `MONGODB_URI` — run locally before Phase 1 |

---

## 4. New integration patterns (for Phase 1+)

### Pattern B — AI / metered operation

```typescript
await executeBillingOperation({
  req,
  category: "seeker",
  operation: "cover_letter",
  idempotencyKey: `${ownerUid}:cover-letter:${workspaceId}`,
  resourceId: workspaceId,
  work: async () => generateCoverLetter(...),
});
```

### Middleware reservation (streaming routes)

```typescript
router.post(
  "/path",
  requireUsageReservation({ category: "seeker", operation: "cover_letter", idempotencyKey: (req) => ... }),
  async (req, res) => {
    try {
      // ... stream or work ...
      await commitBillingReservation(req);
    } catch (error) {
      await releaseBillingReservation(req);
      throw error;
    }
  },
);
```

---

## 5. Known limitations (acceptable for Phase 0)

1. **Resume version counting** — Profile stores one active resume today; counter returns 0/1 until a version collection exists.
2. **Integration tests** — Skipped when `MONGODB_URI` is unset. Run with a test database before Phase 1.
3. **Existing users** — Run once: `npm run billing:migrate-free`
4. **Product routes** — Still unprotected until Phase 1.

---

## 6. Files changed

| File | Change |
|---|---|
| `backend/src/billing/entitlements.ts` | Paid retention logic, exported normalizer |
| `backend/src/billing/operationCatalog.ts` | Full operation catalog |
| `backend/src/billing/resourceCounters.ts` | `recruiter_seats` counter |
| `backend/src/billing/executeOperation.ts` | **New** — route integration wrapper |
| `backend/src/billing/billingOwner.ts` | **New** — owner resolution |
| `backend/src/billing/middleware.ts` | Usage reservation middleware |
| `backend/src/billing/enforcement.ts` | `assertMeteredAccessAllowed` |
| `backend/src/billing/migrateFreeEntitlements.ts` | Exported migration helper |
| `backend/src/billing/razorpayLifecycle.ts` | `cancelAtPeriodEnd` webhook mapping |
| `backend/src/billing.ts` | Multi-category subscription API |
| `backend/src/billing/api.ts` | `billingWarning` on entitlements |
| `backend/src/auth.ts` | Free entitlements on signup |
| `backend/src/billingTypes.ts` | `meteredAccessAllowed`, `billingWarning` |
| `backend/src/middleware/planCheck.ts` | **Deleted** |
| `backend/src/billing/*.test.ts` | Unit + integration tests |

---

## 7. Verdict

**Phase 0 is complete.** Proceed to **Phase 1 — Job Seeker route enforcement** using the audit matrix and `executeBillingOperation()` / middleware patterns above.

Before Phase 1 in production-like environments:

```bash
cd backend
npm run billing:migrate-free   # once for existing users
MONGODB_URI=... npm test       # verify concurrent reservation tests
```
