import express from "express";
import mongoose from "mongoose";
import { connectMongo } from "../db";
import { BillingCheckout } from "../models/BillingCheckout";
import { Subscription } from "../models/Subscription";
import { User } from "../models/User";
import { getEntitlement } from "./entitlements";
import {
  buildRazorpayCheckoutPrefill,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  getConfiguredRazorpayPlanId,
  RazorpayApiError,
  RazorpayNotConfiguredError,
  RazorpaySignatureError,
  subscriptionSupportsCheckoutAuth,
  verifySubscriptionCheckoutSignature,
  verifyWebhookSignature,
} from "./razorpay";
import { processRazorpayWebhook, getRazorpayEventId } from "./razorpayLifecycle";
import {
  cancelPendingSubscriptionPlanChange,
  reconcileSubscription,
  requestSubscriptionPlanChange,
  scheduleSubscriptionCancellation,
  SubscriptionLifecycleError,
} from "./subscriptionLifecycle";
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

function parseCategory(body: unknown): BillingCategory | null {
  if (!body || typeof body !== "object") return null;
  const category = (body as Record<string, unknown>).category;
  return typeof category === "string" && isBillingCategory(category) ? category : null;
}

function idempotencyKey(req: express.Request): string {
  const header = req.header("Idempotency-Key") ?? req.header("X-Idempotency-Key");
  const body = req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>).idempotencyKey
    : undefined;
  const value = typeof header === "string" ? header : typeof body === "string" ? body : "";
  return value.trim();
}

async function loadCheckoutCustomer(uid: string): Promise<{
  prefill: ReturnType<typeof buildRazorpayCheckoutPrefill>;
  notifyEmail?: string;
  notifyPhone?: string;
}> {
  const user = await User.findById(uid).lean().exec();
  const prefill = buildRazorpayCheckoutPrefill({
    name: user?.name,
    email: user?.email,
    phone: user?.phoneNumber,
  });
  return {
    prefill,
    notifyEmail: prefill.email,
    notifyPhone: user?.phoneNumber ?? undefined,
  };
}

function serializeCheckoutResponse(input: {
  checkout: {
    status: string;
    providerSubscriptionId?: string | null;
    category: BillingCategory;
    plan: BillingPlan;
    interval: BillingInterval;
    providerPlanId?: string;
  };
  providerSubscription?: {
    id?: string;
    plan_id?: string;
    status?: string;
    short_url?: string;
  } | null;
  prefill: ReturnType<typeof buildRazorpayCheckoutPrefill>;
}) {
  const subscriptionId =
    input.providerSubscription?.id ??
    input.checkout.providerSubscriptionId ??
    null;
  return {
    checkout: {
      status: input.checkout.status,
      provider: "razorpay" as const,
      subscriptionId,
      subscriptionStatus: input.providerSubscription?.status ?? null,
      planId: input.providerSubscription?.plan_id ?? input.checkout.providerPlanId,
      shortUrl: input.providerSubscription?.short_url ?? null,
      prefill: input.prefill,
      category: input.checkout.category,
      plan: input.checkout.plan,
      interval: input.checkout.interval,
    },
    activation: "webhook_required" as const,
  };
}

async function resolveProviderSubscriptionForCheckout(
  subscriptionId: string | null | undefined,
): Promise<{ id: string; plan_id?: string; status: string; short_url?: string } | null> {
  const id = subscriptionId?.trim();
  if (!id) return null;
  const providerSubscription = await fetchRazorpaySubscription(id);
  if (!subscriptionSupportsCheckoutAuth(providerSubscription.status)) {
    throw new SubscriptionLifecycleError(
      "CHECKOUT_SUBSCRIPTION_UNAVAILABLE",
      "This checkout session is no longer valid. Start checkout again.",
      409,
    );
  }
  return {
    id: providerSubscription.id,
    plan_id: providerSubscription.plan_id,
    status: providerSubscription.status,
    short_url: providerSubscription.short_url,
  };
}

function serializedProviderError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof SubscriptionLifecycleError) {
    return {
      status: error.httpStatus,
      body: { error: error.code, message: error.message },
    };
  }
  if (error instanceof RazorpayNotConfiguredError) {
    return {
      status: 503,
      body: {
        error: "RAZORPAY_NOT_CONFIGURED",
        message: error.message,
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

    // Existing paid Razorpay subscriptions must use change-plan, not a second checkout.
    const existingPaid = await Subscription.findOne({
      userId: objectId,
      category: requested.category,
      provider: "razorpay",
      providerSubscriptionId: { $type: "string", $gt: "" },
      plan: { $in: ["pro", "ultra"] },
    }).lean();
    if (existingPaid) {
      const entitlement = await getEntitlement(uid, requested.category);
      if (entitlement.plan !== "free") {
        return res.status(409).json({
          error: "CHANGE_PLAN_REQUIRED",
          message:
            "This category already has a Razorpay subscription. Use /billing/change-plan for upgrades or downgrades, or /billing/cancel-subscription to leave paid.",
          endpoints: {
            changePlan: "/billing/change-plan",
            cancelSubscription: "/billing/cancel-subscription",
          },
        });
      }
    }

    const customer = await loadCheckoutCustomer(uid);

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
      const providerSubscription = await resolveProviderSubscriptionForCheckout(
        existing.providerSubscriptionId,
      );
      return res.json(
        serializeCheckoutResponse({
          checkout: existing,
          providerSubscription,
          prefill: customer.prefill,
        }),
      );
    }

    const entitlement = await getEntitlement(uid, requested.category);
    if (entitlement.plan === requested.plan && entitlement.interval === requested.interval) {
      return res.status(409).json({
        error: "PLAN_ALREADY_ACTIVE",
        message: "This plan is already active for the selected category.",
      });
    }

    // Resolve the server-owned provider plan before creating the checkout
    // record. BillingCheckout.providerPlanId is required, and keeping the
    // same resolved ID in the record lets reconciliation compare our
    // requested catalog entry with Razorpay's returned subscription.
    const providerPlanId = getConfiguredRazorpayPlanId(
      requested.category,
      requested.plan,
      requested.interval,
    );

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
        providerPlanId,
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
      return res.json(
        serializeCheckoutResponse({
          checkout: raced,
          providerSubscription: await resolveProviderSubscriptionForCheckout(
            raced.providerSubscriptionId,
          ),
          prefill: customer.prefill,
        }),
      );
    }

    try {
      const providerSubscription = await createRazorpaySubscription({
        ...requested,
        userId: uid,
        idempotencyKey: key,
        notifyEmail: customer.notifyEmail,
        notifyPhone: customer.notifyPhone,
      });
      if (!subscriptionSupportsCheckoutAuth(providerSubscription.status)) {
        throw new RazorpayApiError(
          "Razorpay returned a subscription that is not ready for checkout authentication.",
          502,
          { status: providerSubscription.status },
        );
      }
      checkout.status = "created";
      checkout.providerPlanId = providerSubscription.plan_id;
      checkout.providerSubscriptionId = providerSubscription.id;
      await checkout.save();
      return res.status(201).json(
        serializeCheckoutResponse({
          checkout,
          providerSubscription,
          prefill: customer.prefill,
        }),
      );
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
      userId: new mongoose.Types.ObjectId(uid),
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

/**
 * Schedule cancellation at period end (default) or cancel immediately when explicitly requested.
 * Paid access is retained until currentPeriodEnd when cancelAtPeriodEnd is set.
 */
razorpayBillingRouter.post("/cancel-subscription", async (req, res) => {
  try {
    const uid = uidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const category = parseCategory(req.body);
    if (!category) {
      return res.status(422).json({
        error: "INVALID_BILLING_CATEGORY",
        message: "Provide a valid billing category.",
      });
    }
    const body = req.body && typeof req.body === "object"
      ? req.body as Record<string, unknown>
      : {};
    const cancelAtCycleEnd = body.cancelAtCycleEnd !== false && body.immediate !== true;

    await connectMongo();
    const result = await scheduleSubscriptionCancellation({
      userId: uid,
      category,
      cancelAtCycleEnd,
    });
    return res.json({
      ...result,
      message: result.cancelAtPeriodEnd
        ? "Cancellation scheduled at period end. Paid access continues until the current period ends."
        : "Subscription cancelled immediately.",
    });
  } catch (error) {
    const serialized = serializedProviderError(error);
    console.error("[billing] cancel-subscription error:", error);
    return res.status(serialized.status).json(serialized.body);
  }
});

/**
 * Upgrade (now) or downgrade (cycle_end) an existing Razorpay subscription.
 * Never grants the target plan from this response — webhook/reconciliation required.
 */
razorpayBillingRouter.post("/change-plan", async (req, res) => {
  try {
    const uid = uidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const requested = parseRequestedPlan(req.body);
    if (!requested || requested.plan === "free") {
      return res.status(422).json({
        error: "INVALID_BILLING_PLAN",
        message:
          "Choose a paid plan, category, and interval. Use /billing/cancel-subscription to leave paid.",
      });
    }

    await connectMongo();
    const result = await requestSubscriptionPlanChange({
      userId: uid,
      ...requested,
    });
    return res.json({
      ...result,
      message:
        result.changeType === "upgrade"
          ? "Upgrade requested. Paid entitlement updates only after Razorpay webhook confirmation."
          : "Downgrade scheduled at period end. Current paid limits remain until then.",
    });
  } catch (error) {
    const serialized = serializedProviderError(error);
    console.error("[billing] change-plan error:", error);
    return res.status(serialized.status).json(serialized.body);
  }
});

razorpayBillingRouter.post("/cancel-pending-plan-change", async (req, res) => {
  try {
    const uid = uidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const category = parseCategory(req.body);
    if (!category) {
      return res.status(422).json({
        error: "INVALID_BILLING_CATEGORY",
        message: "Provide a valid billing category.",
      });
    }
    await connectMongo();
    const result = await cancelPendingSubscriptionPlanChange({ userId: uid, category });
    return res.json(result);
  } catch (error) {
    const serialized = serializedProviderError(error);
    console.error("[billing] cancel-pending-plan-change error:", error);
    return res.status(serialized.status).json(serialized.body);
  }
});

/**
 * Authenticated self-service reconciliation for one category.
 * Admin/batch repairs belong to the CLI (`npm run billing:reconcile`).
 */
razorpayBillingRouter.post("/reconcile-subscription", async (req, res) => {
  try {
    const uid = uidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const category = parseCategory(req.body);
    if (!category) {
      return res.status(422).json({
        error: "INVALID_BILLING_CATEGORY",
        message: "Provide a valid billing category.",
      });
    }
    await connectMongo();
    const result = await reconcileSubscription({
      userId: uid,
      category,
      actor: "user",
    });
    return res.json({
      ...result,
      activation: "provider_verified",
    });
  } catch (error) {
    const serialized = serializedProviderError(error);
    console.error("[billing] reconcile-subscription error:", error);
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
