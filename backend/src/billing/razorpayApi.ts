import express from "express";
import mongoose from "mongoose";
import { connectMongo } from "../db";
import { BillingCheckout } from "../models/BillingCheckout";
import { getEntitlement } from "./entitlements";
import {
  createRazorpaySubscription,
  RazorpayApiError,
  RazorpayNotConfiguredError,
  RazorpaySignatureError,
  verifySubscriptionCheckoutSignature,
  verifyWebhookSignature,
} from "./razorpay";
import { processRazorpayWebhook, getRazorpayEventId } from "./razorpayLifecycle";
import {
  isBillingCategory,
  isBillingInterval,
  isBillingPlan,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
} from "../billingTypes";

export const razorpayBillingRouter = express.Router();

class RazorpayWebhookInputError extends Error {
  readonly code = "INVALID_RAZORPAY_WEBHOOK";
}

function uidFromRequest(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

function parseRequestedPlan(body: unknown): {
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
} | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  if (
    typeof input.category !== "string" ||
    typeof input.plan !== "string" ||
    typeof input.interval !== "string" ||
    !isBillingCategory(input.category) ||
    !isBillingPlan(input.plan) ||
    !isBillingInterval(input.interval)
  ) {
    return null;
  }
  return { category: input.category, plan: input.plan, interval: input.interval };
}

function idempotencyKey(req: express.Request): string {
  const header = req.header("Idempotency-Key") ?? req.header("X-Idempotency-Key");
  const body = req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>).idempotencyKey
    : undefined;
  const value = typeof header === "string" ? header : typeof body === "string" ? body : "";
  return value.trim();
}

function serializedProviderError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof RazorpayNotConfiguredError) {
    return {
      status: 503,
      body: {
        error: "RAZORPAY_NOT_CONFIGURED",
        message: "Razorpay billing is not configured for this environment.",
      },
    };
  }
  if (error instanceof RazorpaySignatureError) {
    return { status: 400, body: { error: error.code, message: "Signature verification failed." } };
  }
  if (error instanceof RazorpayApiError) {
    return {
      status: 502,
      body: { error: error.code, message: "Razorpay could not complete the request." },
    };
  }
  return {
    status: 500,
    body: { error: "RAZORPAY_INTEGRATION_ERROR", message: "Razorpay billing operation failed." },
  };
}

razorpayBillingRouter.post("/create-checkout", async (req, res) => {
  try {
    const uid = uidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    if (!mongoose.isValidObjectId(uid)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const requested = parseRequestedPlan(req.body);
    if (!requested || requested.plan === "free") {
      return res.status(422).json({
        error: "INVALID_BILLING_PLAN",
        message: "Choose a paid plan, category, and interval from the server catalog.",
      });
    }
    const key = idempotencyKey(req);
    if (!key || key.length > 200) {
      return res.status(422).json({
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Provide a unique Idempotency-Key for this checkout attempt.",
      });
    }

    await connectMongo();
    const objectId = new mongoose.Types.ObjectId(uid);
    const existing = await BillingCheckout.findOne({
      idempotencyKey: key,
    }).lean().exec();
    if (existing) {
      if (
        existing.userId.toString() !== uid ||
        existing.category !== requested.category ||
        existing.plan !== requested.plan ||
        existing.interval !== requested.interval
      ) {
        return res.status(409).json({
          error: "IDEMPOTENCY_KEY_REUSED",
          message: "The idempotency key was used for a different billing plan.",
        });
      }
      return res.json({
        checkout: {
          status: existing.status,
          subscriptionId: existing.providerSubscriptionId ?? null,
          provider: "razorpay",
          category: existing.category,
          plan: existing.plan,
          interval: existing.interval,
        },
        activation: "webhook_required",
      });
    }

    const entitlement = await getEntitlement(uid, requested.category);
    if (entitlement.plan === requested.plan && entitlement.interval === requested.interval) {
      return res.status(409).json({
        error: "PLAN_ALREADY_ACTIVE",
        message: "This plan is already active for the selected category.",
      });
    }

    let checkout;
    try {
      checkout = await BillingCheckout.create({
        userId: objectId,
        category: requested.category,
        plan: requested.plan,
        interval: requested.interval,
        idempotencyKey: key,
        status: "creating",
        provider: "razorpay",
        providerPlanId: "",
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const raced = await BillingCheckout.findOne({
        idempotencyKey: key,
      }).lean().exec();
      if (
        !raced ||
        raced.userId.toString() !== uid ||
        raced.category !== requested.category ||
        raced.plan !== requested.plan ||
        raced.interval !== requested.interval
      ) {
        return res.status(409).json({
          error: "IDEMPOTENCY_KEY_REUSED",
          message: "The idempotency key was used for a different billing plan.",
        });
      }
      return res.json({
        checkout: {
          status: raced.status,
          subscriptionId: raced.providerSubscriptionId ?? null,
          provider: "razorpay",
          category: raced.category,
          plan: raced.plan,
          interval: raced.interval,
        },
        activation: "webhook_required",
      });
    }

    try {
      const providerSubscription = await createRazorpaySubscription({
        ...requested,
        userId: uid,
        idempotencyKey: key,
      });
      checkout.status = "created";
      checkout.providerPlanId = providerSubscription.plan_id;
      checkout.providerSubscriptionId = providerSubscription.id;
      await checkout.save();
      return res.status(201).json({
        checkout: {
          status: checkout.status,
          provider: "razorpay",
          subscriptionId: providerSubscription.id,
          planId: providerSubscription.plan_id,
          shortUrl: providerSubscription.short_url ?? null,
          category: requested.category,
          plan: requested.plan,
          interval: requested.interval,
        },
        activation: "webhook_required",
      });
    } catch (error) {
      checkout.status = "failed";
      checkout.failureReason = error instanceof Error ? error.message.slice(0, 500) : "Provider error";
      await checkout.save();
      throw error;
    }
  } catch (error) {
    const serialized = serializedProviderError(error);
    console.error("[billing] Razorpay checkout error:", error);
    return res.status(serialized.status).json(serialized.body);
  }
});

razorpayBillingRouter.post("/verify-checkout", async (req, res) => {
  try {
    const uid = uidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const body = req.body && typeof req.body === "object"
      ? req.body as Record<string, unknown>
      : {};
    const subscriptionId = typeof body.razorpay_subscription_id === "string"
      ? body.razorpay_subscription_id.trim()
      : "";
    const paymentId = typeof body.razorpay_payment_id === "string"
      ? body.razorpay_payment_id.trim()
      : "";
    const signature = typeof body.razorpay_signature === "string"
      ? body.razorpay_signature.trim()
      : "";
    if (!subscriptionId || !paymentId || !signature) {
      return res.status(422).json({ error: "INVALID_CHECKOUT_VERIFICATION" });
    }

    await connectMongo();
    const checkout = await BillingCheckout.findOne({
      provider: "razorpay",
      providerSubscriptionId: subscriptionId,
      userId: uid,
    }).exec();
    if (!checkout) return res.status(404).json({ error: "CHECKOUT_NOT_FOUND" });

    verifySubscriptionCheckoutSignature({ subscriptionId, paymentId, signature });
    checkout.status = "verified";
    checkout.providerPaymentId = paymentId;
    await checkout.save();

    // This endpoint never mutates Subscription. The verified webhook is the
    // only authority allowed to activate paid access.
    return res.json({
      verified: true,
      activation: "webhook_required",
      category: checkout.category,
      plan: checkout.plan,
      interval: checkout.interval,
    });
  } catch (error) {
    const serialized = serializedProviderError(error);
    console.error("[billing] Razorpay checkout verification error:", error);
    return res.status(serialized.status).json(serialized.body);
  }
});

export async function handleRazorpayWebhook(req: express.Request, res: express.Response) {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "");
    if (!rawBody.length) throw new RazorpayWebhookInputError("Empty webhook body.");
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as Record<string, any>;
    } catch {
      throw new SyntaxError("Invalid Razorpay webhook JSON.");
    }
    const eventType = typeof payload.event === "string" ? payload.event : "";
    if (!eventType) throw new RazorpayWebhookInputError("Missing webhook event.");
    const eventId = getRazorpayEventId(req.headers as Record<string, unknown>);
    const signature = req.header("X-Razorpay-Signature") ?? "";
    verifyWebhookSignature(rawBody, signature);
    await connectMongo();
    const result = await processRazorpayWebhook({
      rawBody,
      eventId,
      eventType,
      payload,
    });
    return res.status(200).json({ received: true, result });
  } catch (error) {
    if (
      error instanceof RazorpayWebhookInputError ||
      error instanceof SyntaxError ||
      (error instanceof Error && error.name === "RazorpayWebhookInputError")
    ) {
      return res.status(400).json({
        error: "INVALID_RAZORPAY_WEBHOOK",
        message: "The Razorpay webhook payload is invalid.",
      });
    }
    const serialized = serializedProviderError(error);
    console.error("[billing] Razorpay webhook error:", error);
    return res.status(serialized.status).json(serialized.body);
  }
}