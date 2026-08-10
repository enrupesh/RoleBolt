import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  buildRazorpayCheckoutPrefill,
  formatRazorpayNotifyPhone,
  formatRazorpayPrefillContact,
  getConfiguredRazorpayPlanId,
  getRazorpayPlanEnvKey,
  getRazorpaySubscriptionTotalCount,
  subscriptionSupportsCheckoutAuth,
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

  it("keeps subscription end times inside Razorpay's UPI mandate boundary", () => {
    assert.equal(getRazorpaySubscriptionTotalCount("monthly"), 348);
    assert.equal(getRazorpaySubscriptionTotalCount("yearly"), 29);
  });

  it("formats Indian phone numbers for Razorpay checkout prefill and notify_info", () => {
    assert.equal(formatRazorpayPrefillContact("9876543210"), "+919876543210");
    assert.equal(formatRazorpayPrefillContact("+91 98765 43210"), "+919876543210");
    assert.equal(formatRazorpayNotifyPhone("9876543210"), "9876543210");
    assert.deepEqual(
      buildRazorpayCheckoutPrefill({
        name: "Rolebolt User",
        email: "User@Example.com",
        phone: "9876543210",
      }),
      {
        name: "Rolebolt User",
        email: "user@example.com",
        contact: "+919876543210",
      },
    );
  });

  it("allows checkout auth only for subscriptions awaiting first payment", () => {
    assert.equal(subscriptionSupportsCheckoutAuth("created"), true);
    assert.equal(subscriptionSupportsCheckoutAuth("active"), false);
    assert.equal(subscriptionSupportsCheckoutAuth("authenticated"), false);
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
    assert.equal(lifecycleStatus("payment.failed", "failed"), "past_due");
    assert.equal(lifecycleStatus("subscription.unknown", "unknown"), null);
    assert.equal(getRazorpayEventId({ "x-razorpay-event-id": "evt_123" }), "evt_123");
    assert.throws(() => getRazorpayEventId({}), /Missing x-razorpay-event-id/);
  });
});