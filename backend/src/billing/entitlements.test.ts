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

  it("retains paid limits for past_due until the period ends", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "past_due" }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.billingWarning, "past_due");
  });

  it("retains paid limits for halted until the period ends", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "halted", category: "creator_standard" }),
      "creator_standard",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.billingWarning, "halted");
  });

  it("does not treat trialing as paid access", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "trialing" as ISubscription["status"] }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "free");
  });

  it("ignores legacy Stripe plan names", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ plan: "agency" as ISubscription["plan"] }),
      "creator_standard",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "free");
  });
});
