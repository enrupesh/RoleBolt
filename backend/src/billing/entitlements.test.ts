import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mongoose from "mongoose";
import { normalizeStoredSubscription } from "./entitlements";
import type { ISubscription } from "../models/Subscription";

const USER_ID = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
const PERIOD_END = new Date("2026-09-01T00:00:00.000Z");
const NOW_INSIDE = new Date("2026-08-15T00:00:00.000Z");
const NOW_AFTER = new Date("2026-09-02T00:00:00.000Z");

function paidSub(overrides: Partial<ISubscription> = {}): ISubscription {
  return {
    userId: USER_ID,
    category: "seeker",
    plan: "pro",
    interval: "monthly",
    status: "active",
    provider: "razorpay",
    providerCustomerId: "cust",
    providerSubscriptionId: "sub",
    providerPlanId: "plan",
    providerLatestPaymentId: "",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ISubscription;
}

describe("normalizeStoredSubscription", () => {
  it("retains Pro access when cancelled at period end and the period is still active", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "cancelled", cancelAtPeriodEnd: true }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.meteredAccessAllowed, true);
    assert.equal(normalized.billingWarning, "cancel_scheduled");
  });

  it("downgrades to Free when cancelled at period end and the period has ended", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "cancelled", cancelAtPeriodEnd: true }),
      "seeker",
      NOW_AFTER,
    );
    assert.equal(normalized.plan, "free");
    assert.equal(normalized.status, "free");
  });

  it("downgrades immediately when cancelled without cancelAtPeriodEnd", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "cancelled", cancelAtPeriodEnd: false }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "free");
  });

  it("retains paid plan metadata for past_due but blocks new metered work", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "past_due" }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.meteredAccessAllowed, false);
    assert.equal(normalized.billingWarning, "past_due");
  });

  it("retains paid plan metadata for halted but blocks new metered work", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "halted", category: "creator_standard" }),
      "creator_standard",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.meteredAccessAllowed, false);
    assert.equal(normalized.billingWarning, "halted");
  });

  it("downgrades past_due to Free after the period ends", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "past_due" }),
      "seeker",
      NOW_AFTER,
    );
    assert.equal(normalized.plan, "free");
    assert.equal(normalized.meteredAccessAllowed, true);
  });

  it("does not treat trialing as paid access", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "trialing" as ISubscription["status"] }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "free");
  });

  it("keeps paid access with payment_pending warning while status is pending", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "pending" }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.meteredAccessAllowed, true);
    assert.equal(normalized.billingWarning, "payment_pending");
  });

  it("surfaces plan_change_pending while retaining the current entitled plan", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({
        plan: "pro",
        pendingPlan: "ultra" as ISubscription["pendingPlan"],
        pendingChangeAt: "now" as ISubscription["pendingChangeAt"],
      }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.billingWarning, "plan_change_pending");
  });
});
