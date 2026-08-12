import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMeteredAccessAllowed,
  BillingAccessRestrictedError,
} from "../billingTypes";
import { getPlanDefinition } from "./planCatalog";
import { assertWithinLimit, serializeBillingError } from "./enforcement";
import { normalizeStoredSubscription } from "./entitlements";
import {
  backgroundIdempotencyKey,
  canRunMeteredBackgroundWork,
  isBackgroundBillingBlock,
} from "./backgroundEnforcement";
import { UsageLimitError } from "./usage";
import type { ResolvedEntitlement } from "../billingTypes";
import type { ISubscription } from "../models/Subscription";
import mongoose from "mongoose";

const USER_ID = new mongoose.Types.ObjectId("507f1f77bcf86cd799439044");

function standardEntitlement(overrides: Partial<ResolvedEntitlement> = {}): ResolvedEntitlement {
  return {
    userId: USER_ID.toString(),
    category: "creator_standard",
    plan: "pro",
    interval: "monthly",
    status: "active",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
    cancelAtPeriodEnd: false,
    meteredAccessAllowed: true,
    definition: getPlanDefinition("creator_standard", "pro"),
    ...overrides,
  };
}

describe("Phase 4 background / async enforcement", () => {
  it("builds stable background idempotency keys for cron retries", () => {
    assert.equal(
      backgroundIdempotencyKey("owner-1", ["daily-briefing", "2026-08-03"]),
      backgroundIdempotencyKey("owner-1", ["daily-briefing", "2026-08-03"]),
    );
    assert.notEqual(
      backgroundIdempotencyKey("owner-1", ["daily-briefing", "2026-08-03"]),
      backgroundIdempotencyKey("owner-1", ["daily-briefing", "2026-08-04"]),
    );
    assert.equal(
      backgroundIdempotencyKey("owner-1", ["offer-reminder", "cand-1", "2"]),
      "bg:owner-1:offer-reminder:cand-1:2",
    );
  });

  it("fail-closes background work when owner uid is missing", async () => {
    const result = await canRunMeteredBackgroundWork("", "creator_standard");
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "missing_owner");
  });

  it("fail-closes when entitlement cannot be resolved for an invalid owner id", async () => {
    const result = await canRunMeteredBackgroundWork("not-a-valid-object-id", "creator_standard");
    assert.equal(result.allowed, false);
    assert.ok(result.reason === "entitlement_unavailable" || result.reason === "billing_access_restricted");
  });

  it("blocks new metered work when past_due retains plan but meteredAccessAllowed is false (cancel/cron gate)", () => {
    const restricted = standardEntitlement({
      status: "past_due",
      meteredAccessAllowed: false,
      billingWarning: "past_due",
    });
    assert.throws(
      () => assertMeteredAccessAllowed(restricted),
      BillingAccessRestrictedError,
    );
    const response = serializeBillingError(
      new BillingAccessRestrictedError("creator_standard"),
      restricted,
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.error, "BILLING_ACCESS_RESTRICTED");
  });

  it("blocks queued AI/email after downgrade to Free when quota is already exhausted", () => {
    const free = standardEntitlement({
      plan: "free",
      status: "free",
      definition: getPlanDefinition("creator_standard", "free"),
    });
    assert.throws(
      () => assertWithinLimit(free, "ai_units", 1, { used: 20, reserved: 0 }),
      (error: any) => {
        assert.equal(error.code, "PLAN_LIMIT_REACHED");
        assert.equal(isBackgroundBillingBlock(error), true);
        return true;
      },
    );
  });

  it("classifies billing limit / access errors as background blocks (cron should skip)", () => {
    assert.equal(
      isBackgroundBillingBlock(
        new UsageLimitError({
          reasonCode: "AI_UNITS_QUOTA_EXHAUSTED",
          category: "creator_standard",
          feature: "ai_units",
          used: 20,
          limit: 20,
        }),
      ),
      true,
    );
    assert.equal(
      isBackgroundBillingBlock(new BillingAccessRestrictedError("creator_standard")),
      true,
    );
    assert.equal(isBackgroundBillingBlock(new Error("network timeout")), false);
  });

  it("normalizes cancelled-at-period-end after period expiry to Free (cron must see Free limits)", () => {
    const paid: ISubscription = {
      userId: USER_ID,
      category: "creator_standard",
      plan: "pro",
      interval: "monthly",
      status: "cancelled",
      provider: "razorpay",
      providerCustomerId: "customer",
      providerSubscriptionId: "subscription",
      providerPlanId: "plan",
      providerLatestPaymentId: "",
      currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-31T23:59:59.999Z"),
      cancelAtPeriodEnd: true,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    } as ISubscription;
    const afterPeriod = normalizeStoredSubscription(
      paid,
      "creator_standard",
      new Date("2026-08-02T00:00:00.000Z"),
    );
    assert.equal(afterPeriod.plan, "free");
    assert.equal(afterPeriod.meteredAccessAllowed, true);
    assert.equal(afterPeriod.definition.limits.daily_briefings, 1);
    assert.equal(afterPeriod.definition.limits.ai_units, 20);
  });

  it("keeps paid access until period end when cancelAtPeriodEnd is scheduled", () => {
    const paid: ISubscription = {
      userId: USER_ID,
      category: "creator_standard",
      plan: "pro",
      interval: "monthly",
      status: "cancelled",
      provider: "razorpay",
      providerCustomerId: "customer",
      providerSubscriptionId: "subscription",
      providerPlanId: "plan",
      providerLatestPaymentId: "",
      currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
      cancelAtPeriodEnd: true,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    } as ISubscription;
    const midPeriod = normalizeStoredSubscription(
      paid,
      "creator_standard",
      new Date("2026-08-15T00:00:00.000Z"),
    );
    assert.equal(midPeriod.plan, "pro");
    assert.equal(midPeriod.meteredAccessAllowed, true);
  });
});
