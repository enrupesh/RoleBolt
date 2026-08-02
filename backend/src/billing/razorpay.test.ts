import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  getConfiguredRazorpayPlanId,
  getRazorpayPlanEnvKey,
  verifySubscriptionCheckoutSignature,
  verifyWebhookSignature,
  RazorpayNotConfiguredError,
  RazorpaySignatureError,
} from "./razorpay";
import { getRazorpayEventId, lifecycleStatus } from "./razorpayLifecycle";

describe("Razorpay provider boundary", () => {
  it("maps catalog entries to server-side plan environment keys", () => {
    assert.equal(
      getRazorpayPlanEnvKey("creator_standard", "pro", "yearly"),
      "RAZORPAY_PLAN_CREATOR_STANDARD_PRO_YEARLY",
    );
  });

  it("never accepts a missing paid plan ID", () => {
    const key = getRazorpayPlanEnvKey("seeker", "pro", "monthly");
    const previous = process.env[key];
    delete process.env[key];
    try {
      assert.throws(
        () => getConfiguredRazorpayPlanId("seeker", "pro", "monthly"),
        RazorpayNotConfiguredError,
      );
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("verifies checkout signatures using subscription and payment IDs", () => {
    const previousKeyId = process.env.RAZORPAY_KEY_ID;
    const previousKey = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_KEY_ID = "test-key-id";
    process.env.RAZORPAY_KEY_SECRET = "test-api-secret";
    const subscriptionId = "sub_test_123";
    const paymentId = "pay_test_123";
    const signature = crypto
      .createHmac("sha256", "test-api-secret")
      .update(`${subscriptionId}|${paymentId}`)
      .digest("hex");
    try {
      assert.doesNotThrow(() =>
        verifySubscriptionCheckoutSignature({ subscriptionId, paymentId, signature }),
      );
      assert.throws(
        () => verifySubscriptionCheckoutSignature({ subscriptionId, paymentId, signature: "bad" }),
        RazorpaySignatureError,
      );
    } finally {
      if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
      else process.env.RAZORPAY_KEY_ID = previousKeyId;
      if (previousKey === undefined) delete process.env.RAZORPAY_KEY_SECRET;
      else process.env.RAZORPAY_KEY_SECRET = previousKey;
    }
  });

  it("verifies webhook signatures against the raw body", () => {
    const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
    const body = Buffer.from('{"event":"subscription.activated"}');
    const signature = crypto.createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    try {
      assert.doesNotThrow(() => verifyWebhookSignature(body, signature));
      assert.throws(() => verifyWebhookSignature(body, "bad"), RazorpaySignatureError);
    } finally {
      if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("maps lifecycle events and rejects missing event IDs", () => {
    assert.equal(lifecycleStatus("subscription.activated", "pending"), "active");
    assert.equal(lifecycleStatus("subscription.pending", "active"), "pending");
    assert.equal(lifecycleStatus("subscription.cancelled", "cancelled"), "cancelled");
    assert.equal(lifecycleStatus("subscription.unknown", "unknown"), null);
    assert.equal(getRazorpayEventId({ "x-razorpay-event-id": "evt_123" }), "evt_123");
    assert.throws(() => getRazorpayEventId({}), /Missing x-razorpay-event-id/);
  });
});