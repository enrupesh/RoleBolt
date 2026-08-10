import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanDefinition } from "./planCatalog";
import {
  assertWithinLimit,
  assertMeteredAccessAllowed,
  requireFeature,
  serializeBillingError,
  FeatureNotAvailableError,
  BillingConfigurationError,
  BillingAccessRestrictedError,
} from "./enforcement";
import type { ResolvedEntitlement } from "../billingTypes";

function entitlement(plan: "free" | "pro" = "free"): ResolvedEntitlement {
  return {
    userId: "507f1f77bcf86cd799439011",
    category: "creator_standard",
    plan,
    interval: "monthly",
    status: plan === "free" ? "free" : "active",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
    cancelAtPeriodEnd: false,
    meteredAccessAllowed: true,
    definition: getPlanDefinition("creator_standard", plan),
  };
}

describe("central billing enforcement", () => {
  it("allows a quantity within a finite limit", () => {
    assert.doesNotThrow(() =>
      assertWithinLimit(entitlement(), "active_jobs", 1, { used: 0, reserved: 0 }),
    );
  });

  it("blocks a finite limit using both used and reserved values", () => {
    assert.throws(
      () => assertWithinLimit(entitlement(), "active_jobs", 1, { used: 1, reserved: 0 }),
      (error: any) => error.code === "PLAN_LIMIT_REACHED" && error.reasonCode === "ACTIVE_JOBS_QUOTA_EXHAUSTED",
    );
  });

  it("does not block an unlimited catalog value", () => {
    assert.doesNotThrow(() =>
      assertWithinLimit(entitlement("pro"), "daily_briefings", 1000, { used: 0, reserved: 0 }),
    );
  });

  it("fails closed for an undefined counter", () => {
    assert.throws(
      () => assertWithinLimit(entitlement(), "not_a_counter"),
      BillingConfigurationError,
    );
  });

  it("requires a feature flag instead of trusting plan names", () => {
    const free = entitlement();
    assert.throws(
      () => requireFeature(free, "advancedAnalytics"),
      (error: any) => error instanceof FeatureNotAvailableError && error.code === "FEATURE_NOT_AVAILABLE",
    );
  });

  it("serializes a stable client-facing limit response", () => {
    let error: unknown;
    try {
      assertWithinLimit(entitlement(), "active_jobs", 1, { used: 1, reserved: 0 });
    } catch (caught) {
      error = caught;
    }
    const response = serializeBillingError(error, entitlement());
    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      error: "PLAN_LIMIT_REACHED",
      code: "ACTIVE_JOBS_QUOTA_EXHAUSTED",
      category: "creator_standard",
      feature: "active_jobs",
      plan: "free",
      used: 1,
      limit: 1,
      resetAt: "2026-08-31T23:59:59.999Z",
      upgradeRequired: true,
    });
  });

  it("serializes a stable restricted-access response for past_due/halted", () => {
    const restricted = entitlement("pro");
    restricted.meteredAccessAllowed = false;
    restricted.billingWarning = "past_due";
    assert.throws(
      () => assertMeteredAccessAllowed(restricted),
      BillingAccessRestrictedError,
    );
    try {
      assertMeteredAccessAllowed(restricted);
    } catch (error) {
      const response = serializeBillingError(error, restricted);
      assert.equal(response.status, 403);
      assert.equal(response.body.error, "BILLING_ACCESS_RESTRICTED");
      assert.equal(response.body.code, "BILLING_ACCESS_RESTRICTED");
    }
  });
});