import express from "express";
import { connectMongo } from "./db";
import { getEntitlement } from "./billing/entitlements";
import { BILLING_CATEGORIES, isBillingCategory, type BillingCategory } from "./billingTypes";

/**
 * Legacy billing compatibility surface.
 *
 * Stripe checkout and portal operations are intentionally retired. Razorpay
 * checkout/webhooks will be introduced only after the entitlement engine and
 * signature/idempotency implementation are complete.
 */
export const billingRouter = express.Router();

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

billingRouter.get("/subscription", async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    await connectMongo();

    const requestedCategory = typeof req.query.category === "string" && isBillingCategory(req.query.category)
      ? req.query.category
      : null;
    const categories: BillingCategory[] = requestedCategory
      ? [requestedCategory]
      : [...BILLING_CATEGORIES];

    const now = new Date();
    const subscriptions = await Promise.all(
      categories.map(async (category) => {
        const entitlement = await getEntitlement(uid, category, now);
        return {
          category,
          plan: entitlement.plan,
          interval: entitlement.interval,
          status: entitlement.status,
          currentPeriodStart: entitlement.currentPeriodStart,
          currentPeriodEnd: entitlement.currentPeriodEnd,
          cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
          meteredAccessAllowed: entitlement.meteredAccessAllowed,
          billingWarning: entitlement.billingWarning ?? null,
          provider: "razorpay",
        };
      }),
    );

    return res.json({
      version: 2,
      subscriptions,
      /** Prefer `/billing/entitlements` for usage counters and remaining quotas. */
      entitlementsEndpoint: "/billing/entitlements",
    });
  } catch (error: any) {
    console.error("[billing] subscription read error:", error);
    return res.status(500).json({ error: "Unable to resolve subscription." });
  }
});

function retiredBillingResponse(_req: express.Request, res: express.Response) {
  return res.status(410).json({
    error: "legacy_billing_disabled",
    message: "Stripe billing has been retired. Razorpay billing will be enabled after verification.",
  });
}

billingRouter.post("/create-checkout", retiredBillingResponse);
billingRouter.post("/create-portal", retiredBillingResponse);

/**
 * Kept only so the existing route registration remains explicit. It does not
 * accept or process provider events; unverified/legacy events cannot change
 * entitlements.
 */
export async function handleStripeWebhook(
  _req: express.Request,
  res: express.Response,
) {
  return res.status(410).json({
    error: "legacy_webhook_disabled",
    message: "Stripe webhooks are retired. No entitlement was changed.",
  });
}
