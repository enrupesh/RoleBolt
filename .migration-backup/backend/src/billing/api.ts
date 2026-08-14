import express from "express";
import { connectMongo } from "../db";
import { UsagePeriod } from "../models/UsagePeriod";
import { getPublicPlanCatalog } from "./planCatalog";
import { getEntitlement } from "./entitlements";
import { getPeriodWindow } from "./periods";
import {
  countOwnedResources,
  supportedResourceCounters,
} from "./resourceCounters";
import { isBillingCategory, type BillingCategory } from "../billingTypes";

export const billingCatalogRouter = express.Router();
export const billingFoundationRouter = express.Router();

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

function safeCategory(value: unknown): BillingCategory | null {
  return typeof value === "string" && isBillingCategory(value) ? value : null;
}

function mapCounters(source: unknown): Record<string, number> {
  if (source instanceof Map) return Object.fromEntries(source.entries());
  if (source && typeof source === "object") return { ...(source as Record<string, number>) };
  return {};
}

/** Backend-owned pricing/limits catalog. Provider IDs are intentionally omitted. */
billingCatalogRouter.get("/catalog", (_req, res) => {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim() || null;
  return res.json({
    version: 1,
    currency: "INR",
    categories: ["seeker", "creator_form", "creator_standard"],
    plans: ["free", "pro", "ultra"],
    intervals: ["monthly", "yearly"],
    /** Public Razorpay key for Checkout.js only — never includes secrets or plan IDs. */
    razorpayKeyId,
    plansByCategory: getPublicPlanCatalog(),
  });
});

/** Current server-resolved entitlements and visible counters for the account. */
billingFoundationRouter.get("/entitlements", async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    await connectMongo();
    const requestedCategory = safeCategory(req.query.category);
    const categories = requestedCategory
      ? [requestedCategory]
      : (["seeker", "creator_form", "creator_standard"] as BillingCategory[]);
    const now = new Date();
    const entitlements = await Promise.all(
      categories.map(async (category) => {
        const entitlement = await getEntitlement(uid, category, now);
        const period = getPeriodWindow(
          entitlement.interval,
          now,
          entitlement.currentPeriodStart,
          entitlement.currentPeriodEnd,
        );
        const usage = await UsagePeriod.findOne({
          userId: uid,
          category,
          periodKey: period.periodKey,
        }).lean();
        const resourceCounterEntries = await Promise.all(
          supportedResourceCounters(category).map(
            async (counter) =>
              [
                counter,
                await countOwnedResources(uid, category, counter),
              ] as const,
          ),
        );
        // Resource limits are absolute owner-scoped capacities, not period
        // usage. Keep metered counters from UsagePeriod, but always replace
        // resource counters with the current database count so the billing
        // tracker matches the same source used by enforcement.
        const usedCounters = {
          ...mapCounters(usage?.usedCounters),
          ...Object.fromEntries(resourceCounterEntries),
        };
        const reservedCounters = mapCounters(usage?.reservedCounters);
        const remaining: Record<string, number | null> = {};
        for (const [counter, limit] of Object.entries(
          entitlement.definition.limits,
        )) {
          remaining[counter] =
            typeof limit === "number"
              ? Math.max(
                  0,
                  limit -
                    (usedCounters[counter] ?? 0) -
                    (reservedCounters[counter] ?? 0),
                )
              : null;
        }
        return {
          category,
          plan: entitlement.plan,
          interval: entitlement.interval,
          status: entitlement.status,
          processingPriority: entitlement.definition.processingPriority,
          featureFlags: entitlement.definition.featureFlags,
          cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
          meteredAccessAllowed: entitlement.meteredAccessAllowed,
          billingWarning: entitlement.billingWarning ?? null,
          pendingPlan: entitlement.pendingPlan ?? null,
          pendingInterval: entitlement.pendingInterval ?? null,
          pendingChangeAt: entitlement.pendingChangeAt ?? null,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          usedCounters,
          reservedCounters,
          remaining,
        };
      }),
    );
    return res.json({ version: 1, entitlements });
  } catch (error: any) {
    console.error("[billing] entitlement read error:", error);
    return res.status(500).json({ error: "Unable to resolve billing entitlements." });
  }
});