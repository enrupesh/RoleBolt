import mongoose, { type ClientSession } from "mongoose";
import { UsagePeriod } from "../models/UsagePeriod";
import { Subscription, type ISubscription } from "../models/Subscription";
import {
  getPlanDefinition,
} from "./planCatalog";
import { getPeriodWindow } from "./periods";
import {
  isBillingCategory,
  isBillingInterval,
  isBillingPlan,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
  type BillingWarning,
  type PlanDefinition,
  type ResolvedEntitlement,
} from "../billingTypes";

/** Active paid provider statuses. `trialing` is excluded — no trials at launch. */
const ACTIVE_PAID_STATUSES = new Set(["active", "authenticated", "pending"]);

/** Paid access may continue until period end when payment failed or cancellation is scheduled. */
const RETAINED_PAID_STATUSES = new Set(["cancelled", "past_due", "halted"]);

function toObjectId(userId: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid billing user ID.");
  }
  return new mongoose.Types.ObjectId(userId);
}

function isLegacySubscription(sub: ISubscription): boolean {
  return sub.plan === "agency" || sub.plan === "seeker_pro";
}

function periodStillActive(end: Date | undefined, now: Date): boolean {
  return Boolean(end && end.getTime() > now.getTime());
}

export interface NormalizedSubscription {
  plan: BillingPlan;
  interval: BillingInterval;
  status: string;
  definition: PlanDefinition;
  start?: Date;
  end?: Date;
  cancelAtPeriodEnd: boolean;
  meteredAccessAllowed: boolean;
  billingWarning?: BillingWarning;
}

/**
 * Pure entitlement normalization used by `getEntitlement` and unit tests.
 * Implements cancel-at-period-end retention and failed-payment grace per `payment.md` §13.5–13.7.
 */
export function normalizeStoredSubscription(
  sub: ISubscription | null,
  category: BillingCategory,
  now: Date,
): NormalizedSubscription {
  const freeDefaults = (): NormalizedSubscription => ({
    plan: "free",
    interval: "monthly",
    status: "free",
    definition: getPlanDefinition(category, "free", "monthly"),
    start: undefined,
    end: undefined,
    cancelAtPeriodEnd: false,
    meteredAccessAllowed: true,
  });

  if (
    !sub ||
    isLegacySubscription(sub) ||
    !isBillingCategory(sub.category) ||
    sub.category !== category ||
    !isBillingPlan(sub.plan) ||
    !isBillingInterval(sub.interval) ||
    sub.provider !== "razorpay" ||
    sub.plan === "free"
  ) {
    return freeDefaults();
  }

  const periodActive = periodStillActive(sub.currentPeriodEnd, now);
  const activePaid =
    ACTIVE_PAID_STATUSES.has(sub.status) && periodActive;

  const cancelledButRetained =
    sub.status === "cancelled" &&
    periodActive &&
    sub.cancelAtPeriodEnd;

  const paymentIssueButRetained =
    RETAINED_PAID_STATUSES.has(sub.status) &&
    sub.status !== "cancelled" &&
    periodActive;

  if (!activePaid && !cancelledButRetained && !paymentIssueButRetained) {
    return freeDefaults();
  }

  let billingWarning: BillingWarning | undefined;
  if (sub.status === "past_due") billingWarning = "past_due";
  else if (sub.status === "halted") billingWarning = "halted";
  else if (sub.status === "pending") billingWarning = "payment_pending";
  else if (sub.cancelAtPeriodEnd || sub.status === "cancelled") billingWarning = "cancel_scheduled";
  else if (sub.pendingPlan && sub.pendingPlan !== sub.plan) {
    billingWarning = "plan_change_pending";
  }

  // Cancel-at-period-end keeps full paid capacity until period end.
  // pending (Razorpay retry window) keeps full capacity with a non-blocking warning.
  // past_due / halted retain paid plan metadata for read access and warnings,
  // but block new metered/AI work per payment.md failed-payment rules.
  const meteredAccessAllowed = !paymentIssueButRetained;

  return {
    plan: sub.plan,
    interval: sub.interval,
    status: sub.status,
    definition: getPlanDefinition(category, sub.plan, sub.interval),
    start: sub.currentPeriodStart,
    end: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    meteredAccessAllowed,
    billingWarning,
  };
}

export async function getEntitlement(
  userId: string,
  category: BillingCategory,
  now = new Date(),
  session?: ClientSession,
): Promise<ResolvedEntitlement> {
  const objectId = toObjectId(userId);
  const query = Subscription.findOne({ userId: objectId, category }).lean();
  if (session) query.session(session);
  const sub = await query.exec() as ISubscription | null;
  const normalized = normalizeStoredSubscription(sub, category, now);
  const period = getPeriodWindow(
    normalized.interval,
    now,
    normalized.start,
    normalized.end,
  );

  return {
    userId,
    category,
    plan: normalized.plan,
    interval: normalized.interval,
    status: normalized.status,
    subscriptionId: sub?._id?.toString(),
    currentPeriodStart: period.periodStart,
    currentPeriodEnd: period.periodEnd,
    cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
    meteredAccessAllowed: normalized.meteredAccessAllowed,
    billingWarning: normalized.billingWarning,
    pendingPlan:
      sub?.pendingPlan && isBillingPlan(sub.pendingPlan) ? sub.pendingPlan : undefined,
    pendingInterval:
      sub?.pendingInterval && isBillingInterval(sub.pendingInterval)
        ? sub.pendingInterval
        : undefined,
    pendingChangeAt:
      sub?.pendingChangeAt === "now" || sub?.pendingChangeAt === "cycle_end"
        ? sub.pendingChangeAt
        : undefined,
    definition: normalized.definition,
  };
}

export async function ensureUsagePeriod(
  entitlement: ResolvedEntitlement,
  session?: ClientSession,
): Promise<{ period: Awaited<ReturnType<typeof UsagePeriod.findOne>>; periodKey: string }> {
  const period = getPeriodWindow(
    entitlement.interval,
    entitlement.currentPeriodStart,
    entitlement.currentPeriodStart,
    entitlement.currentPeriodEnd,
  );
  const userId = toObjectId(entitlement.userId);
  const query = UsagePeriod.findOneAndUpdate(
    { userId, category: entitlement.category, periodKey: period.periodKey },
    {
      $setOnInsert: {
        userId,
        category: entitlement.category,
        periodKey: period.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        planSnapshot: {
          plan: entitlement.plan,
          interval: entitlement.interval,
          catalogVersion: entitlement.definition.catalogVersion,
        },
        limitsSnapshot: entitlement.definition.limits,
        usedCounters: {},
        reservedCounters: {},
        version: 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (session) query.session(session);
  const doc = await query.exec();

  if (!doc) throw new Error("Could not create billing usage period.");
  return { period: doc, periodKey: period.periodKey };
}

/**
 * Creates the three permanent Free category records for an existing account.
 * This is intentionally idempotent and does not touch legacy Stripe records.
 * It can be called during a later migration job or immediately after signup.
 */
export async function initializeFreeEntitlements(userId: string): Promise<void> {
  const objectId = toObjectId(userId);
  await Promise.all(
    (["seeker", "creator_form", "creator_standard"] as BillingCategory[]).map((category) =>
      Subscription.updateOne(
        { userId: objectId, category },
        {
          $setOnInsert: {
            userId: objectId,
            category,
            plan: "free",
            interval: "monthly",
            status: "free",
            provider: "razorpay",
            providerCustomerId: "",
            providerSubscriptionId: "",
            providerPlanId: "",
            providerLatestPaymentId: "",
            cancelAtPeriodEnd: false,
          },
        },
        { upsert: true },
      ).exec(),
    ),
  );
}
