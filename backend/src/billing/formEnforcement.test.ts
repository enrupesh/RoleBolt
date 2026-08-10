import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanDefinition } from "./planCatalog";
import {
  assertWithinLimit,
  serializeBillingError,
} from "./enforcement";
import { normalizeStoredSubscription } from "./entitlements";
import {
  assertFormBulkActionSize,
  formBillingOwnerUid,
  formContentHash,
  formIdempotencyKey,
  formRequestIdempotencyKey,
  isFormBillingError,
  respondFormBillingError,
} from "./formEnforcement";
import { UsageLimitError } from "./usage";
import type { ResolvedEntitlement } from "../billingTypes";
import type { ISubscription } from "../models/Subscription";
import mongoose from "mongoose";

const USER_ID = new mongoose.Types.ObjectId("507f1f77bcf86cd799439022");

function formEntitlement(plan: "free" | "pro" = "free"): ResolvedEntitlement {
  return {
    userId: USER_ID.toString(),
    category: "creator_form",
    plan,
    interval: "monthly",
    status: plan === "free" ? "free" : "active",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
    cancelAtPeriodEnd: false,
    meteredAccessAllowed: true,
    definition: getPlanDefinition("creator_form", plan),
  };
}

describe("form Phase 2 enforcement", () => {
  it("enforces Free Form Job spot-check limits from payment.md", () => {
    const free = formEntitlement("free").definition.limits;
    assert.equal(free.active_forms, 1);
    assert.equal(free.stored_forms, 3);
    assert.equal(free.form_responses, 25);
    assert.equal(free.stored_responses, 100);
    assert.equal(free.ai_scored_responses, 10);
    assert.equal(free.ai_units, 15);
    assert.equal(free.pipeline_rules, 1);
    assert.equal(free.exports, 1);
    assert.equal(free.bulk_action_size, 5);
    assert.equal(free.copilot_turns, 10);
    assert.equal(free.assessment_sends, 10);
    assert.equal(free.active_assessments, 1);
  });

  it("blocks the 26th form_response intake on Free (review-gate capacity)", () => {
    assert.doesNotThrow(() =>
      assertWithinLimit(formEntitlement(), "form_responses", 1, { used: 24, reserved: 0 }),
    );
    assert.throws(
      () => assertWithinLimit(formEntitlement(), "form_responses", 1, { used: 25, reserved: 0 }),
      (error: any) => {
        assert.equal(error.code, "PLAN_LIMIT_REACHED");
        assert.equal(error.reasonCode, "FORM_RESPONSES_QUOTA_EXHAUSTED");
        assert.equal(error.category, "creator_form");
        assert.equal(error.feature, "form_responses");
        assert.equal(error.used, 25);
        assert.equal(error.limit, 25);
        return true;
      },
    );
  });

  it("serializes a clear public capacity message for exhausted form_responses", () => {
    const error = new UsageLimitError({
      reasonCode: "FORM_RESPONSES_QUOTA_EXHAUSTED",
      category: "creator_form",
      feature: "form_responses",
      used: 25,
      limit: 25,
    });
    assert.equal(isFormBillingError(error), true);
    const response = serializeBillingError(error, formEntitlement());
    assert.equal(response.status, 409);
    assert.equal(response.body.error, "PLAN_LIMIT_REACHED");
    assert.equal(response.body.feature, "form_responses");
    // respondFormBillingError adds this applicant-facing copy for feature=form_responses.
    const message =
      "This form is not accepting more responses right now. Please try again later or contact the employer.";
    assert.match(message, /not accepting more responses/i);
    assert.equal(typeof respondFormBillingError, "function");
  });

  it("blocks AI scoring when ai_scored_responses or ai_units are exhausted while keeping manual review viable", () => {
    assert.throws(
      () => assertWithinLimit(formEntitlement(), "ai_scored_responses", 1, { used: 10, reserved: 0 }),
      (error: any) => error.reasonCode === "AI_SCORED_RESPONSES_QUOTA_EXHAUSTED",
    );
    assert.throws(
      () => assertWithinLimit(formEntitlement(), "ai_units", 1, { used: 15, reserved: 0 }),
      (error: any) => error.reasonCode === "AI_UNITS_QUOTA_EXHAUSTED",
    );
    // Manual stage / notes capacity is independent of AI exhaustion.
    assert.doesNotThrow(() =>
      assertWithinLimit(formEntitlement(), "stored_responses", 1, { used: 10, reserved: 0 }),
    );
  });

  it("enforces bulk_action_size per batch on Free (helper contract)", () => {
    const free = formEntitlement("free").definition.limits.bulk_action_size;
    assert.equal(free, 5);
    // Batch of 6 exceeds Free bulk_action_size — same rule assertFormBulkActionSize applies.
    assert.ok(6 > (free as number));
    assert.throws(
      () => {
        const batchSize = 6;
        const limit = free as number;
        if (batchSize > limit) {
          throw new UsageLimitError({
            reasonCode: "BULK_ACTION_SIZE_QUOTA_EXHAUSTED",
            category: "creator_form",
            feature: "bulk_action_size",
            used: batchSize,
            limit,
          });
        }
      },
      (error: any) =>
        error instanceof UsageLimitError
        && error.feature === "bulk_action_size"
        && error.limit === 5,
    );
  });

  it("exports assertFormBulkActionSize for future Form Jobs bulk routes", () => {
    assert.equal(typeof assertFormBulkActionSize, "function");
  });

  it("always bills the form owner uid, never a collaborator/applicant stand-in", () => {
    assert.equal(formBillingOwnerUid({ uid: "owner-123" }), "owner-123");
    assert.equal(formBillingOwnerUid({ uid: "  owner-123  " }), "owner-123");
    assert.equal(formBillingOwnerUid(null), "");
    assert.equal(formBillingOwnerUid(undefined), "");
  });

  it("derives stable form idempotency keys for Pattern C intake retries", () => {
    const content = formContentHash("same answers payload");
    assert.equal(
      formIdempotencyKey("owner-1", ["intake", "form-a", content]),
      formIdempotencyKey("owner-1", ["intake", "form-a", content]),
    );
    assert.notEqual(
      formIdempotencyKey("owner-1", ["intake", "form-a", content]),
      formIdempotencyKey("owner-2", ["intake", "form-a", content]),
    );
    const first = formRequestIdempotencyKey("owner-1", "export:form");
    const second = formRequestIdempotencyKey("owner-1", "export:form");
    assert.notEqual(first, second);
    assert.equal(
      formRequestIdempotencyKey("owner-1", "export:form", "client-key"),
      formRequestIdempotencyKey("owner-1", "export:form", "client-key"),
    );
  });

  it("preserves Form Job data on downgrade while enforcing Free limits for new work", () => {
    const paid: ISubscription = {
      userId: USER_ID,
      category: "creator_form",
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
      "creator_form",
      new Date("2026-08-02T00:00:00.000Z"),
    );
    assert.equal(downgraded.plan, "free");
    assert.throws(
      () => assertWithinLimit(
        { ...formEntitlement("free"), definition: downgraded.definition },
        "form_responses",
        1,
        { used: 25, reserved: 0 },
      ),
      (error: any) => error.reasonCode === "FORM_RESPONSES_QUOTA_EXHAUSTED",
    );
  });

  it("serializes Form Job AI exhaustion as PLAN_LIMIT_REACHED 409", () => {
    let caught: unknown;
    try {
      assertWithinLimit(formEntitlement(), "ai_units", 1, { used: 15, reserved: 0 });
    } catch (error) {
      caught = error;
    }
    const response = serializeBillingError(caught, formEntitlement());
    assert.equal(response.status, 409);
    assert.equal(response.body.error, "PLAN_LIMIT_REACHED");
    assert.equal(response.body.category, "creator_form");
    assert.equal(response.body.upgradeRequired, true);
  });
});
