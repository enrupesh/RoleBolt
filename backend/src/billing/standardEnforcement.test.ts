import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanDefinition } from "./planCatalog";
import {
  assertWithinLimit,
  serializeBillingError,
} from "./enforcement";
import { normalizeStoredSubscription } from "./entitlements";
import {
  assertStandardBulkActionSize,
  standardBillingOwnerUid,
  standardContentHash,
  standardIdempotencyKey,
  standardRequestIdempotencyKey,
  isStandardBillingError,
} from "./standardEnforcement";
import { UsageLimitError } from "./usage";
import type { ResolvedEntitlement } from "../billingTypes";
import type { ISubscription } from "../models/Subscription";
import mongoose from "mongoose";

const USER_ID = new mongoose.Types.ObjectId("507f1f77bcf86cd799439033");

function standardEntitlement(plan: "free" | "pro" | "ultra" = "free"): ResolvedEntitlement {
  return {
    userId: USER_ID.toString(),
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

describe("standard Phase 3 enforcement", () => {
  it("enforces Free / Pro / Ultra spot-check limits for review-gate routes", () => {
    const free = standardEntitlement("free").definition.limits;
    assert.equal(free.active_jobs, 1);
    assert.equal(free.stored_jobs, 3);
    assert.equal(free.bulk_import_files, 3);
    assert.equal(free.bulk_imports, 1);
    assert.equal(free.recruiter_seats, 1);
    assert.equal(free.ai_units, 20);
    assert.equal(free.copilot_turns, 10);
    assert.equal(free.pipeline_rules, 1);
    assert.equal(free.new_candidates, 25);

    const pro = standardEntitlement("pro").definition.limits;
    assert.equal(pro.active_jobs, 5);
    assert.equal(pro.bulk_import_files, 50);
    assert.equal(pro.bulk_imports, 20);
    assert.equal(pro.recruiter_seats, 3);
    assert.equal(pro.ai_units, 1000);

    const ultra = standardEntitlement("ultra").definition.limits;
    assert.equal(ultra.active_jobs, 20);
    assert.equal(ultra.recruiter_seats, 10);
    assert.equal(ultra.bulk_action_size, 500);
  });

  it("blocks the 2nd active job on Free (review gate)", () => {
    assert.doesNotThrow(() =>
      assertWithinLimit(standardEntitlement(), "active_jobs", 1, { used: 0, reserved: 0 }),
    );
    assert.throws(
      () => assertWithinLimit(standardEntitlement(), "active_jobs", 1, { used: 1, reserved: 0 }),
      (error: any) => {
        assert.equal(error.code, "PLAN_LIMIT_REACHED");
        assert.equal(error.reasonCode, "ACTIVE_JOBS_QUOTA_EXHAUSTED");
        assert.equal(error.category, "creator_standard");
        assert.equal(error.feature, "active_jobs");
        assert.equal(error.limit, 1);
        return true;
      },
    );
  });

  it("enforces Free bulk import ceilings (3 files / 1 import)", () => {
    assert.throws(
      () => assertWithinLimit(standardEntitlement(), "bulk_import_files", 4, { used: 0, reserved: 0 }),
      (error: any) => error.reasonCode === "BULK_IMPORT_FILES_QUOTA_EXHAUSTED",
    );
    assert.doesNotThrow(() =>
      assertWithinLimit(standardEntitlement(), "bulk_import_files", 3, { used: 0, reserved: 0 }),
    );
    assert.throws(
      () => assertWithinLimit(standardEntitlement(), "bulk_imports", 1, { used: 1, reserved: 0 }),
      (error: any) => error.reasonCode === "BULK_IMPORTS_QUOTA_EXHAUSTED",
    );
  });

  it("blocks agent / AI work when AI units are exhausted", () => {
    assert.throws(
      () => assertWithinLimit(standardEntitlement(), "ai_units", 1, { used: 20, reserved: 0 }),
      (error: any) => {
        assert.equal(error.reasonCode, "AI_UNITS_QUOTA_EXHAUSTED");
        assert.equal(isStandardBillingError(error), true);
        return true;
      },
    );
    const response = serializeBillingError(
      new UsageLimitError({
        reasonCode: "AI_UNITS_QUOTA_EXHAUSTED",
        category: "creator_standard",
        feature: "ai_units",
        used: 20,
        limit: 20,
      }),
      standardEntitlement(),
    );
    assert.equal(response.status, 409);
    assert.equal(response.body.error, "PLAN_LIMIT_REACHED");
    assert.equal(response.body.category, "creator_standard");
  });

  it("blocks the 2nd collaborator seat on Free (review gate)", () => {
    assert.throws(
      () => assertWithinLimit(standardEntitlement(), "recruiter_seats", 1, { used: 1, reserved: 0 }),
      (error: any) => {
        assert.equal(error.reasonCode, "RECRUITER_SEATS_QUOTA_EXHAUSTED");
        assert.equal(error.limit, 1);
        return true;
      },
    );
    assert.doesNotThrow(() =>
      assertWithinLimit(standardEntitlement("pro"), "recruiter_seats", 1, { used: 1, reserved: 0 }),
    );
  });

  it("always bills the job owner uid, never a collaborator stand-in", () => {
    assert.equal(standardBillingOwnerUid({ uid: "owner-1" }), "owner-1");
    assert.equal(standardBillingOwnerUid({ ownerUid: "owner-2", uid: "other" }), "owner-2");
    assert.equal(standardBillingOwnerUid(null), "");
  });

  it("derives stable Standard Jobs idempotency keys", () => {
    const content = standardContentHash("same resume text");
    assert.equal(
      standardIdempotencyKey("owner-1", ["candidate-score", "job-a", content]),
      standardIdempotencyKey("owner-1", ["candidate-score", "job-a", content]),
    );
    const first = standardRequestIdempotencyKey("owner-1", "copilot-stream");
    const second = standardRequestIdempotencyKey("owner-1", "copilot-stream");
    assert.notEqual(first, second);
    assert.equal(
      standardRequestIdempotencyKey("owner-1", "copilot-stream", "client-key"),
      standardRequestIdempotencyKey("owner-1", "copilot-stream", "client-key"),
    );
  });

  it("exports assertStandardBulkActionSize for bulk pipeline / import batches", () => {
    assert.equal(typeof assertStandardBulkActionSize, "function");
    const free = standardEntitlement("free").definition.limits.bulk_action_size;
    assert.equal(free, 5);
  });

  it("preserves Standard Job data on downgrade while enforcing Free limits for new work", () => {
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
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    } as ISubscription;
    const downgraded = normalizeStoredSubscription(
      paid,
      "creator_standard",
      new Date("2026-08-02T00:00:00.000Z"),
    );
    assert.equal(downgraded.plan, "free");
    assert.throws(
      () => assertWithinLimit(
        { ...standardEntitlement("free"), definition: downgraded.definition },
        "active_jobs",
        1,
        { used: 1, reserved: 0 },
      ),
      (error: any) => error.reasonCode === "ACTIVE_JOBS_QUOTA_EXHAUSTED",
    );
  });
});
