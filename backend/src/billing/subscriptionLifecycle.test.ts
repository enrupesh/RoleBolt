import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import mongoose from "mongoose";
import {
  getConfiguredRazorpayPlanId,
  resolveCatalogEntryByRazorpayPlanId,
  verifySubscriptionCheckoutSignature,
  verifyWebhookSignature,
  RazorpaySignatureError,
} from "./razorpay";
import {
  lifecycleStatus,
  resolveCancelAtPeriodEnd,
  resolveSubscriptionMapping,
} from "./razorpayLifecycle";
import { classifyPlanChange } from "./subscriptionLifecycle";
import { normalizeStoredSubscription } from "./entitlements";
import type { ISubscription } from "../models/Subscription";

const USER_ID = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
const PERIOD_END = new Date("2026-09-01T00:00:00.000Z");
const NOW_INSIDE = new Date("2026-08-15T00:00:00.000Z");

function withPlanEnv(run: () => void): void {
  const keys = {
    RAZORPAY_PLAN_SEEKER_PRO_MONTHLY: "plan_seeker_pro_m",
    RAZORPAY_PLAN_SEEKER_ULTRA_MONTHLY: "plan_seeker_ultra_m",
    RAZORPAY_PLAN_SEEKER_PRO_YEARLY: "plan_seeker_pro_y",
    RAZORPAY_PLAN_CREATOR_STANDARD_PRO_MONTHLY: "plan_std_pro_m",
  } as const;
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(keys)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function paidSub(overrides: Partial<ISubscription> = {}): ISubscription {
  return {
    userId: USER_ID,
    category: "seeker",
    plan: "pro",
    interval: "monthly",
    status: "active",
    provider: "razorpay",
    providerCustomerId: "cust",
    providerSubscriptionId: "sub_test",
    providerPlanId: "plan_seeker_pro_m",
    providerLatestPaymentId: "",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    pendingPlan: "",
    pendingInterval: "",
    pendingProviderPlanId: "",
    pendingChangeAt: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ISubscription;
}

describe("Phase 5 — plan change classification", () => {
  it("classifies Pro→Ultra as upgrade and Ultra→Pro as downgrade", () => {
    assert.equal(
      classifyPlanChange({
        category: "seeker",
        fromPlan: "pro",
        fromInterval: "monthly",
        toPlan: "ultra",
        toInterval: "monthly",
      }),
      "upgrade",
    );
    assert.equal(
      classifyPlanChange({
        category: "seeker",
        fromPlan: "ultra",
        fromInterval: "monthly",
        toPlan: "pro",
        toInterval: "monthly",
      }),
      "downgrade",
    );
  });

  it("classifies monthly→yearly on the same tier as upgrade by price", () => {
    assert.equal(
      classifyPlanChange({
        category: "seeker",
        fromPlan: "pro",
        fromInterval: "monthly",
        toPlan: "pro",
        toInterval: "yearly",
      }),
      "upgrade",
    );
  });

  it("treats identical plan+interval as same", () => {
    assert.equal(
      classifyPlanChange({
        category: "creator_form",
        fromPlan: "pro",
        fromInterval: "monthly",
        toPlan: "pro",
        toInterval: "monthly",
      }),
      "same",
    );
  });
});

describe("Phase 5 — cancel-at-period-end lifecycle", () => {
  it("sets cancelAtPeriodEnd when Razorpay reports cancel_at_cycle_end", () => {
    assert.equal(
      resolveCancelAtPeriodEnd({
        status: "active",
        entity: { cancel_at_cycle_end: true },
        previous: null,
      }),
      true,
    );
  });

  it("does not treat has_scheduled_changes alone as cancellation", () => {
    assert.equal(
      resolveCancelAtPeriodEnd({
        status: "active",
        entity: { has_scheduled_changes: true, cancel_at_cycle_end: false },
        previous: { cancelAtPeriodEnd: false, currentPeriodEnd: PERIOD_END },
      }),
      false,
    );
  });

  it("preserves scheduled cancel when the cancelled webhook arrives before period end", () => {
    assert.equal(
      resolveCancelAtPeriodEnd({
        status: "cancelled",
        entity: {
          current_end: Math.floor(PERIOD_END.getTime() / 1000),
        },
        previous: { cancelAtPeriodEnd: true, currentPeriodEnd: PERIOD_END },
      }),
      true,
    );
  });

  it("marks immediate cancel when ended_at is present without cycle-end flag", () => {
    assert.equal(
      resolveCancelAtPeriodEnd({
        status: "cancelled",
        entity: {
          ended_at: Math.floor(NOW_INSIDE.getTime() / 1000),
          cancel_at_cycle_end: false,
        },
        previous: { cancelAtPeriodEnd: false, currentPeriodEnd: PERIOD_END },
      }),
      false,
    );
  });

  it("retains paid Pro access after cancel-at-period-end until the period ends", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "active", cancelAtPeriodEnd: true }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.meteredAccessAllowed, true);
    assert.equal(normalized.billingWarning, "cancel_scheduled");
  });
});

describe("Phase 5 — failed payment / past_due", () => {
  it("maps payment.failed and subscription.pending to lifecycle statuses", () => {
    assert.equal(lifecycleStatus("payment.failed", "failed"), "past_due");
    assert.equal(lifecycleStatus("invoice.payment_failed", "failed"), "past_due");
    assert.equal(lifecycleStatus("subscription.pending", "pending"), "pending");
    assert.equal(lifecycleStatus("subscription.halted", "halted"), "halted");
    assert.equal(lifecycleStatus("subscription.charged", "active"), "active");
  });

  it("keeps paid capacity with a non-blocking warning while Razorpay pending", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "pending" }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.meteredAccessAllowed, true);
    assert.equal(normalized.billingWarning, "payment_pending");
  });

  it("blocks new metered work for past_due while retaining paid plan metadata", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({ status: "past_due" }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.meteredAccessAllowed, false);
    assert.equal(normalized.billingWarning, "past_due");
  });

  it("surfaces plan_change_pending without granting the pending plan", () => {
    const normalized = normalizeStoredSubscription(
      paidSub({
        plan: "pro",
        pendingPlan: "ultra",
        pendingInterval: "monthly",
        pendingChangeAt: "now",
      }),
      "seeker",
      NOW_INSIDE,
    );
    assert.equal(normalized.plan, "pro");
    assert.equal(normalized.billingWarning, "plan_change_pending");
  });
});

describe("Phase 5 — provider plan mapping for upgrades", () => {
  it("reverse-looks up catalog entries from configured Razorpay plan IDs", () => {
    withPlanEnv(() => {
      assert.deepEqual(resolveCatalogEntryByRazorpayPlanId("plan_seeker_ultra_m"), {
        category: "seeker",
        plan: "ultra",
        interval: "monthly",
      });
      assert.equal(resolveCatalogEntryByRazorpayPlanId("plan_unknown"), null);
      assert.equal(
        getConfiguredRazorpayPlanId("seeker", "pro", "monthly"),
        "plan_seeker_pro_m",
      );
    });
  });

  it("prefers provider plan_id over stale notes after an upgrade", () => {
    withPlanEnv(() => {
      const mapping = resolveSubscriptionMapping({
        entity: {
          id: "sub_1",
          plan_id: "plan_seeker_ultra_m",
          notes: {
            rolebolt_user_id: USER_ID.toString(),
            rolebolt_category: "seeker",
            rolebolt_plan: "pro",
            rolebolt_interval: "monthly",
          },
        },
        checkout: null,
        existing: paidSub(),
      });
      assert.ok(mapping);
      assert.equal(mapping?.plan, "ultra");
      assert.equal(mapping?.interval, "monthly");
      assert.equal(mapping?.providerPlanId, "plan_seeker_ultra_m");
    });
  });

  it("rejects provider plan IDs that are not in the server catalog", () => {
    withPlanEnv(() => {
      const mapping = resolveSubscriptionMapping({
        entity: {
          id: "sub_1",
          plan_id: "plan_attacker_forged",
          notes: {
            rolebolt_user_id: USER_ID.toString(),
            rolebolt_category: "seeker",
            rolebolt_plan: "ultra",
            rolebolt_interval: "monthly",
          },
        },
        checkout: null,
        existing: paidSub(),
      });
      assert.equal(mapping, null);
    });
  });
});

describe("Phase 5 — signature security (review gate)", () => {
  it("rejects forged checkout signatures", () => {
    const previousKeyId = process.env.RAZORPAY_KEY_ID;
    const previousKey = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    try {
      assert.throws(
        () =>
          verifySubscriptionCheckoutSignature({
            subscriptionId: "sub_1",
            paymentId: "pay_1",
            signature: "forged",
          }),
        RazorpaySignatureError,
      );
      const good = crypto
        .createHmac("sha256", "rzp_test_secret")
        .update("sub_1|pay_1")
        .digest("hex");
      assert.doesNotThrow(() =>
        verifySubscriptionCheckoutSignature({
          subscriptionId: "sub_1",
          paymentId: "pay_1",
          signature: good,
        }),
      );
    } finally {
      if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
      else process.env.RAZORPAY_KEY_ID = previousKeyId;
      if (previousKey === undefined) delete process.env.RAZORPAY_KEY_SECRET;
      else process.env.RAZORPAY_KEY_SECRET = previousKey;
    }
  });

  it("rejects forged webhook signatures", () => {
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
    const body = Buffer.from('{"event":"subscription.activated"}');
    try {
      assert.throws(() => verifyWebhookSignature(body, "forged"), RazorpaySignatureError);
      const good = crypto.createHmac("sha256", "whsec_test").update(body).digest("hex");
      assert.doesNotThrow(() => verifyWebhookSignature(body, good));
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  });
});
