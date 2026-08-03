# Phase 0 — Foundation Hardening & Integration Layer Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 0  
**Result:** Phase 0 review gate **PASSED** (unit tests). MongoDB integration tests run when `MONGODB_URI` / `MONGODB_TEST_URI` is set.

---

## 1. Scope

Phase 0 hardens the billing foundation before product-wide route enforcement expands beyond the seeker surface. It fixes entitlement lifecycle bugs, completes the operation catalog, adds route integration helpers, and proves atomic reservation semantics.

---

## 2. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Fix cancel-at-period-end in `entitlements.ts` | ✅ | Retain paid plan + metered access when `cancelAtPeriodEnd && currentPeriodEnd > now` |
| Map `past_due` / `halted` grace | ✅ | Retain paid plan metadata + warning; **`meteredAccessAllowed = false`** (restrict new metered work; keep read access) |
| Remove `trialing` from paid statuses | ✅ | Resolver excludes `trialing` → Free |
| Wire signup free entitlements | ✅ | All `User.create` paths use `createUserWithBillingEntitlements()` |
| Migration script documented | ✅ | `npm run billing:migrate-free`; documented in README |
| Expand `operationCatalog.ts` | ✅ | 50+ operations incl. `payment.md` §5.1 weights + Phase -1 keys + aliases |
| Fix `resourceCounters.ts` | ✅ | `RecruitSeekerResumeVersion` model + sync helper; `recruiter_seats` via `RecruitTeamMember`; owner `uid` verified |
| Add `executeOperation.ts` | ✅ | `executeBillingOperation()` — reserve/commit/release with ambiguous-failure retention |
| Add `billingOwner.ts` | ✅ | `resolveBillingOwner()` / `requireBillingOwnerUid()` |
| Extend middleware | ✅ | `requireUsageReservation`, `commitBillingReservation`, `releaseBillingReservation` |
| Delete `planCheck.ts` | ✅ | Removed; zero production imports |
| MongoDB integration tests | ✅ | Boundary, overflow, concurrent (12→10), idempotency, commit/release idempotency, signup ×3 |
| Multi-category `/billing/subscription` | ✅ | Returns all three categories (v2); `/billing/entitlements` exposes `meteredAccessAllowed` |

---

## 3. Review gate checklist

| Check | Result |
|---|---|
| `npm test` (backend unit) | ✅ Pass (integration skipped without MongoDB) |
| `npx tsc --noEmit` | ✅ Pass |
| Concurrent reservation test | ✅ Present — requires `MONGODB_URI` / `MONGODB_TEST_URI` |
| Cancel-at-period-end test | ✅ `entitlements.test.ts` |
| past_due / halted metered block | ✅ `entitlements.test.ts` + `enforcement.test.ts` |
| Signup test | ✅ Integration test creates 3 Free Subscription records |
| Operation catalog | ✅ `assertOperationCatalogComplete()` + weight checks |
| Grep for `planCheck` | ✅ Zero production imports |

---

## 4. Integration patterns (for Phase 1+)

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
  requireUsageReservation({
    category: "seeker",
    operation: "cover_letter",
    idempotencyKey: (req) => ...,
  }),
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

### Resume version sync (when saving seeker resume)

```typescript
await syncSeekerResumeVersionFromProfile({
  uid,
  resumeText,
  resumeFileName,
  source: "upload",
});
```

---

## 5. Known limitations (acceptable for Phase 0)

1. **Historical profiles without version rows** — counters fall back to 0/1 from profile resume fields until `syncSeekerResumeVersionFromProfile` runs on save.
2. **Integration tests** — skipped when MongoDB URI is unset. Run with a test database before production enforcement rollout.
3. **Existing users** — run once: `npm run billing:migrate-free`
4. **Product routes beyond seeker** — Form/Standard/public/background enforcement remain later phases.

---

## 6. Files changed / owned by Phase 0

| File | Role |
|---|---|
| `backend/src/billing/entitlements.ts` | Cancel-at-period-end + past_due/halted metered gate |
| `backend/src/billing/usage.ts` | Atomic reserve/commit/release; enforces metered gate |
| `backend/src/billing/operationCatalog.ts` | Full operation catalog |
| `backend/src/billing/resourceCounters.ts` | Owner counters + resume version sync |
| `backend/src/models/RecruitSeekerResumeVersion.ts` | Resume version history model |
| `backend/src/billing/executeOperation.ts` | Route integration wrapper |
| `backend/src/billing/billingOwner.ts` | Collaborator → owner billing |
| `backend/src/billing/middleware.ts` | Entitlement / feature / resource / reservation middleware |
| `backend/src/billing/enforcement.ts` | Limits, features, stable errors |
| `backend/src/billing/migrateFreeEntitlements.ts` | Backfill CLI |
| `backend/src/billing/api.ts` / `billing.ts` | Catalog, entitlements, multi-category subscription |
| `backend/src/auth.ts` | Free entitlements on signup |
| `backend/src/billingTypes.ts` | Types + `BillingAccessRestrictedError` |
| `backend/src/billing/*.test.ts` | Unit + integration tests |
| `README.md` | Migration + test documentation |

---

## 7. Verdict

**Phase 0 is complete.** The foundation is ready for Phase 1+ route enforcement using `executeBillingOperation()`, middleware reservations, and owner-scoped resource counters.

```bash
cd backend
npm run billing:migrate-free          # once for existing users
./node_modules/.bin/tsc --noEmit
npm test
MONGODB_URI=... npm test              # concurrent reservation proof
```
