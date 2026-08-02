import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanDefinition } from "./planCatalog";
import {
  assertWithinLimit,
  serializeBillingError,
} from "./enforcement";
import { normalizeStoredSubscription } from "./entitlements";
import { seekerContentHash, seekerIdempotencyKey } from "./seekerEnforcement";
import type { ResolvedEntitlement } from "../billingTypes";
import type { ISubscription } from "../models/Subscription";
import mongoose from "mongoose";

const USER_ID = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");

function seekerEntitlement(plan: "free" | "pro" = "free"): ResolvedEntitlement {
  return {
    userId: USER_ID.toString(),
    category: "seeker",
    plan,
    interval: "monthly",
    status: plan === "free" ? "free" : "active",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
    cancelAtPeriodEnd: false,
    meteredAccessAllowed: true,
    definition: getPlanDefinition("seeker", plan),
  };
}

describe("seeker Phase 1 enforcement", () => {
  it("blocks a seeker AI operation when the shared AI-unit quota is exhausted", () => {
    assert.throws(
      () => assertWithinLimit(seekerEntitlement(), "ai_units", 1, { used: 10, reserved: 0 }),
      (error: any) => {
        assert.equal(error.code, "PLAN_LIMIT_REACHED");
        assert.equal(error.reasonCode, "AI_UNITS_QUOTA_EXHAUSTED");
        assert.equal(error.category, "seeker");
        return true;
      },
    );

    let caught: unknown;
    try {
      assertWithinLimit(seekerEntitlement(), "ai_units", 1, { used: 10, reserved: 0 });
    } catch (error) {
      caught = error;
    }
    const response = serializeBillingError(caught, seekerEntitlement());
    assert.equal(response.status, 409);
    assert.equal(response.body.error, "PLAN_LIMIT_REACHED");
    assert.equal(response.body.category, "seeker");
    assert.equal(response.body.upgradeRequired, true);
  });

  it("blocks new seeker resources at the resource limit without affecting manual edits", () => {
    assert.throws(
      () => assertWithinLimit(seekerEntitlement(), "workspace_items", 1, { used: 3, reserved: 0 }),
      (error: any) => error.reasonCode === "WORKSPACE_ITEMS_QUOTA_EXHAUSTED",
    );
    assert.doesNotThrow(() =>
      assertWithinLimit(seekerEntitlement(), "active_applications", 1, { used: 9, reserved: 0 }),
    );
  });

  it("preserves seeker data on downgrade while enforcing the Free limits for new work", () => {
    const paid: ISubscription = {
      userId: USER_ID,
      category: "seeker",
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
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    } as ISubscription;
    const downgraded = normalizeStoredSubscription(
      paid,
      "seeker",
      new Date("2026-08-02T00:00:00.000Z"),
    );
    assert.equal(downgraded.plan, "free");
    assert.equal(downgraded.meteredAccessAllowed, true);
    assert.throws(
      () => assertWithinLimit(
        { ...seekerEntitlement("free"), definition: downgraded.definition },
        "workspace_items",
        1,
        { used: 3, reserved: 0 },
      ),
      (error: any) => error.reasonCode === "WORKSPACE_ITEMS_QUOTA_EXHAUSTED",
    );
  });

  it("derives stable idempotency keys so one fallback chain has one logical charge", () => {
    const content = seekerContentHash("same logical seeker request");
    assert.equal(
      seekerIdempotencyKey("seeker-1", ["cover-letter", content]),
      seekerIdempotencyKey("seeker-1", ["cover-letter", content]),
    );
    assert.notEqual(
      seekerIdempotencyKey("seeker-1", ["cover-letter", content]),
      seekerIdempotencyKey("seeker-2", ["cover-letter", content]),
    );
  });
});