import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanDefinition } from "./planCatalog";
import {
  assertWithinLimit,
  serializeBillingError,
} from "./enforcement";
import { normalizeStoredSubscription } from "./entitlements";
import {
  seekerContentHash,
  seekerIdempotencyKey,
  seekerRequestIdempotencyKey,
  isActiveSeekerTrackerStage,
} from "./seekerEnforcement";
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

  it("enforces Free plan spot-check limits from payment.md §4.2", () => {
    const free = seekerEntitlement("free").definition.limits;
    assert.equal(free.ai_units, 10);
    assert.equal(free.cover_letters, 2);
    assert.equal(free.resume_analyses, 1);
    assert.equal(free.job_fit_analyses, 2);
    assert.equal(free.interview_sessions, 1);
    assert.equal(free.workspace_items, 3);
    assert.equal(free.saved_jobs, 10);
    assert.equal(free.projects, 3);
    assert.equal(free.certifications, 3);
    assert.equal(free.job_alerts, 1);
    assert.equal(free.exports, 1);
    assert.equal(free.active_resume_versions, 1);
    assert.equal(free.stored_resume_versions, 2);
  });

  it("blocks the 4th workspace item on Free while allowing lower counts", () => {
    assert.doesNotThrow(() =>
      assertWithinLimit(seekerEntitlement(), "workspace_items", 1, { used: 2, reserved: 0 }),
    );
    assert.throws(
      () => assertWithinLimit(seekerEntitlement(), "workspace_items", 1, { used: 3, reserved: 0 }),
      (error: any) => error.reasonCode === "WORKSPACE_ITEMS_QUOTA_EXHAUSTED",
    );
  });

  it("blocks projects and certifications above Free absolute limits", async () => {
    // assertSeekerProposedResourceCount hits the live entitlement resolver; for unit
    // coverage we validate the same absolute limit rule via assertWithinLimit.
    assert.throws(
      () => assertWithinLimit(seekerEntitlement(), "projects", 4, { used: 0, reserved: 0 }),
      (error: any) => error.reasonCode === "PROJECTS_QUOTA_EXHAUSTED",
    );
    assert.throws(
      () => assertWithinLimit(seekerEntitlement(), "certifications", 4, { used: 0, reserved: 0 }),
      (error: any) => error.reasonCode === "CERTIFICATIONS_QUOTA_EXHAUSTED",
    );
    assert.doesNotThrow(() =>
      assertWithinLimit(seekerEntitlement(), "projects", 3, { used: 0, reserved: 0 }),
    );
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

  it("ignores forged client plan values and still resolves Free for unpaid records", () => {
    const forged: ISubscription = {
      userId: USER_ID,
      category: "seeker",
      plan: "ultra",
      interval: "monthly",
      status: "active",
      provider: "stripe" as ISubscription["provider"],
      providerCustomerId: "customer",
      providerSubscriptionId: "subscription",
      providerPlanId: "plan",
      providerLatestPaymentId: "",
      currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ISubscription;
    const normalized = normalizeStoredSubscription(
      forged,
      "seeker",
      new Date("2026-08-15T00:00:00.000Z"),
    );
    assert.equal(normalized.plan, "free");
  });

  it("classifies active tracker stages for application capacity gates", () => {
    assert.equal(isActiveSeekerTrackerStage("applied"), true);
    assert.equal(isActiveSeekerTrackerStage("interview"), true);
    assert.equal(isActiveSeekerTrackerStage("rejected"), false);
    assert.equal(isActiveSeekerTrackerStage("ghosted"), false);
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

  it("uses fresh request idempotency keys when no client key is supplied", () => {
    const first = seekerRequestIdempotencyKey("seeker-1", "extension-analysis");
    const second = seekerRequestIdempotencyKey("seeker-1", "extension-analysis");
    assert.notEqual(first, second);
    const reused = seekerRequestIdempotencyKey("seeker-1", "extension-analysis", "client-key-1");
    assert.equal(
      reused,
      seekerRequestIdempotencyKey("seeker-1", "extension-analysis", "client-key-1"),
    );
  });

  it("keeps manual profile capacity separate from exhausted AI units", () => {
    // AI exhausted
    assert.throws(
      () => assertWithinLimit(seekerEntitlement(), "ai_units", 1, { used: 10, reserved: 0 }),
      (error: any) => error.reasonCode === "AI_UNITS_QUOTA_EXHAUSTED",
    );
    // Manual profile resource edits remain allowed within Free resource limits
    assert.doesNotThrow(() =>
      assertWithinLimit(seekerEntitlement(), "projects", 2, { used: 0, reserved: 0 }),
    );
    assert.doesNotThrow(() =>
      assertWithinLimit(seekerEntitlement(), "certifications", 1, { used: 0, reserved: 0 }),
    );
  });
});
