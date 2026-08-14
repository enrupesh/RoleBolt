import mongoose from "mongoose";
import { BillingAuditLog } from "../models/BillingAuditLog";
import { Subscription, type ISubscription } from "../models/Subscription";
import { getPlanDefinition } from "./planCatalog";
import { getEntitlement } from "./entitlements";
import {
  cancelRazorpaySubscription,
  cancelRazorpaySubscriptionPendingUpdate,
  fetchRazorpaySubscription,
  getConfiguredRazorpayPlanId,
  updateRazorpaySubscriptionPlan,
  type RazorpaySubscriptionResponse,
} from "./razorpay";
import { applyProviderSubscriptionState, lifecycleStatus } from "./razorpayLifecycle";
import {
  isBillingCategory,
  isBillingInterval,
  isBillingPlan,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
} from "../billingTypes";

const PLAN_RANK: Record<BillingPlan, number> = {
  free: 0,
  pro: 1,
  ultra: 2,
};

export class SubscriptionLifecycleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 422,
  ) {
    super(message);
    this.name = "SubscriptionLifecycleError";
  }
}

function requireObjectId(userId: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(userId)) {
    throw new SubscriptionLifecycleError("UNAUTHORIZED", "Unauthorized", 401);
  }
  return new mongoose.Types.ObjectId(userId);
}

function snapshot(sub: ISubscription | null): Record<string, unknown> | undefined {
  if (!sub) return undefined;
  return {
    status: sub.status,
    plan: sub.plan,
    interval: sub.interval,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    providerSubscriptionId: sub.providerSubscriptionId,
    providerPlanId: sub.providerPlanId,
    pendingPlan: sub.pendingPlan || "",
    pendingInterval: sub.pendingInterval || "",
    currentPeriodEnd: sub.currentPeriodEnd,
  };
}

export function classifyPlanChange(input: {
  category: BillingCategory;
  fromPlan: BillingPlan;
  fromInterval: BillingInterval;
  toPlan: BillingPlan;
  toInterval: BillingInterval;
}): "upgrade" | "downgrade" | "same" {
  if (input.fromPlan === input.toPlan && input.fromInterval === input.toInterval) {
    return "same";
  }
  const fromRank = PLAN_RANK[input.fromPlan];
  const toRank = PLAN_RANK[input.toPlan];
  if (toRank > fromRank) return "upgrade";
  if (toRank < fromRank) return "downgrade";
  const fromPrice = getPlanDefinition(input.category, input.fromPlan, input.fromInterval).pricePaise;
  const toPrice = getPlanDefinition(input.category, input.toPlan, input.toInterval).pricePaise;
  if (toPrice > fromPrice) return "upgrade";
  if (toPrice < fromPrice) return "downgrade";
  return "same";
}

async function loadPaidSubscription(
  userId: string,
  category: BillingCategory,
): Promise<ISubscription> {
  const objectId = requireObjectId(userId);
  const sub = await Subscription.findOne({ userId: objectId, category }).exec();
  if (
    !sub ||
    sub.provider !== "razorpay" ||
    !sub.providerSubscriptionId ||
    !isBillingPlan(sub.plan) ||
    sub.plan === "free"
  ) {
    throw new SubscriptionLifecycleError(
      "NO_ACTIVE_PAID_SUBSCRIPTION",
      "No active Razorpay subscription exists for this category. Use checkout to start a paid plan.",
      409,
    );
  }
  const entitlement = await getEntitlement(userId, category);
  if (entitlement.plan === "free") {
    throw new SubscriptionLifecycleError(
      "NO_ACTIVE_PAID_SUBSCRIPTION",
      "The category is not currently on a paid entitlement. Use checkout or reconciliation.",
      409,
    );
  }
  return sub;
}

/**
 * Schedule cancellation at period end via Razorpay, then mirror locally.
 * Does not strip paid access before currentPeriodEnd when cancel-at-period-end succeeds.
 */
export async function scheduleSubscriptionCancellation(input: {
  userId: string;
  category: BillingCategory;
  /** Launch default is period-end cancel. Immediate cancel is explicit opt-in only. */
  cancelAtCycleEnd?: boolean;
}): Promise<{
  category: BillingCategory;
  cancelAtPeriodEnd: boolean;
  status: string;
  currentPeriodEnd?: Date;
  activation: "webhook_required";
  providerSubscriptionId: string;
}> {
  if (!isBillingCategory(input.category)) {
    throw new SubscriptionLifecycleError("INVALID_BILLING_CATEGORY", "Invalid billing category.");
  }
  const cancelAtCycleEnd = input.cancelAtCycleEnd !== false;
  const sub = await loadPaidSubscription(input.userId, input.category);

  if (sub.cancelAtPeriodEnd && cancelAtCycleEnd) {
    return {
      category: input.category,
      cancelAtPeriodEnd: true,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      activation: "webhook_required",
      providerSubscriptionId: sub.providerSubscriptionId,
    };
  }

  if (sub.status === "cancelled" && !sub.cancelAtPeriodEnd) {
    throw new SubscriptionLifecycleError(
      "SUBSCRIPTION_ALREADY_CANCELLED",
      "This subscription is already cancelled.",
      409,
    );
  }

  const before = snapshot(sub);
  const provider = await cancelRazorpaySubscription(sub.providerSubscriptionId, {
    cancelAtCycleEnd,
  });

  sub.cancelAtPeriodEnd = cancelAtCycleEnd;
  sub.cancelledAt = new Date();
  if (!cancelAtCycleEnd) {
    sub.status = "cancelled";
    sub.endedAt = new Date();
  } else if (provider.status && ["active", "authenticated", "pending"].includes(provider.status)) {
    // Keep local paid status; cancel_at_cycle_end only flips the flag until period end.
    sub.status = provider.status as ISubscription["status"];
  }
  if (typeof provider.current_end === "number") {
    sub.currentPeriodEnd = new Date(provider.current_end * 1000);
  }
  if (typeof provider.current_start === "number") {
    sub.currentPeriodStart = new Date(provider.current_start * 1000);
  }
  await sub.save();

  await BillingAuditLog.create({
    userId: sub.userId,
    category: input.category,
    action: cancelAtCycleEnd ? "cancel_scheduled" : "cancel_immediate",
    provider: "razorpay",
    providerSubscriptionId: sub.providerSubscriptionId,
    actor: "user",
    summary: cancelAtCycleEnd
      ? `Scheduled cancellation at period end for ${input.category}.`
      : `Immediately cancelled ${input.category} subscription.`,
    before,
    after: snapshot(sub),
    metadata: { providerStatus: provider.status },
  });

  return {
    category: input.category,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    activation: "webhook_required",
    providerSubscriptionId: sub.providerSubscriptionId,
  };
}

/**
 * Upgrade (immediate provider change) or downgrade (cycle-end) an existing paid subscription.
 * Never mutates the entitled plan to the target until webhook/reconciliation confirms.
 */
export async function requestSubscriptionPlanChange(input: {
  userId: string;
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
}): Promise<{
  category: BillingCategory;
  changeType: "upgrade" | "downgrade";
  scheduleChangeAt: "now" | "cycle_end";
  currentPlan: BillingPlan;
  currentInterval: BillingInterval;
  pendingPlan: BillingPlan;
  pendingInterval: BillingInterval;
  activation: "webhook_required";
  providerSubscriptionId: string;
}> {
  if (!isBillingCategory(input.category) || !isBillingPlan(input.plan) || !isBillingInterval(input.interval)) {
    throw new SubscriptionLifecycleError("INVALID_BILLING_PLAN", "Invalid plan request.");
  }
  if (input.plan === "free") {
    throw new SubscriptionLifecycleError(
      "USE_CANCEL_FOR_FREE",
      "To move to Free, use cancel-subscription (period-end). Immediate Free is not offered at launch.",
    );
  }

  const sub = await loadPaidSubscription(input.userId, input.category);
  if (!isBillingPlan(sub.plan) || !isBillingInterval(sub.interval) || sub.plan === "free") {
    throw new SubscriptionLifecycleError("NO_ACTIVE_PAID_SUBSCRIPTION", "Paid subscription required.", 409);
  }

  const changeType = classifyPlanChange({
    category: input.category,
    fromPlan: sub.plan,
    fromInterval: sub.interval,
    toPlan: input.plan,
    toInterval: input.interval,
  });
  if (changeType === "same") {
    throw new SubscriptionLifecycleError(
      "PLAN_ALREADY_ACTIVE",
      "This plan is already active for the selected category.",
      409,
    );
  }

  if (sub.cancelAtPeriodEnd) {
    throw new SubscriptionLifecycleError(
      "CANCEL_PENDING",
      "A cancellation is already scheduled for this category. Plan changes are blocked until the period ends or support clears the cancel state.",
      409,
    );
  }

  if (sub.pendingPlan && sub.pendingChangeAt === "cycle_end") {
    throw new SubscriptionLifecycleError(
      "PLAN_CHANGE_PENDING",
      "A plan change is already scheduled at period end. Cancel the pending update before requesting another change.",
      409,
    );
  }

  const scheduleChangeAt: "now" | "cycle_end" =
    changeType === "upgrade" ? "now" : "cycle_end";
  const targetPlanId = getConfiguredRazorpayPlanId(input.category, input.plan, input.interval);
  const before = snapshot(sub);

  await updateRazorpaySubscriptionPlan({
    subscriptionId: sub.providerSubscriptionId,
    planId: targetPlanId,
    scheduleChangeAt,
  });

  // Entitlement plan stays on the current verified plan until webhook confirmation.
  sub.pendingPlan = input.plan;
  sub.pendingInterval = input.interval;
  sub.pendingProviderPlanId = targetPlanId;
  sub.pendingChangeAt = scheduleChangeAt;
  await sub.save();

  await BillingAuditLog.create({
    userId: sub.userId,
    category: input.category,
    action: "plan_change_requested",
    provider: "razorpay",
    providerSubscriptionId: sub.providerSubscriptionId,
    actor: "user",
    summary: `Requested ${changeType} to ${input.plan}/${input.interval} (${scheduleChangeAt}).`,
    before,
    after: snapshot(sub),
    metadata: {
      changeType,
      scheduleChangeAt,
      targetPlanId,
      activation: "webhook_required",
    },
  });

  return {
    category: input.category,
    changeType,
    scheduleChangeAt,
    currentPlan: sub.plan,
    currentInterval: sub.interval,
    pendingPlan: input.plan,
    pendingInterval: input.interval,
    activation: "webhook_required",
    providerSubscriptionId: sub.providerSubscriptionId,
  };
}

export async function cancelPendingSubscriptionPlanChange(input: {
  userId: string;
  category: BillingCategory;
}): Promise<{ cancelled: true; category: BillingCategory }> {
  const sub = await loadPaidSubscription(input.userId, input.category);
  if (!sub.pendingPlan) {
    throw new SubscriptionLifecycleError(
      "NO_PENDING_PLAN_CHANGE",
      "There is no pending plan change to cancel.",
      409,
    );
  }
  const before = snapshot(sub);
  if (sub.pendingChangeAt === "cycle_end") {
    await cancelRazorpaySubscriptionPendingUpdate(sub.providerSubscriptionId);
  }
  sub.pendingPlan = "";
  sub.pendingInterval = "";
  sub.pendingProviderPlanId = "";
  sub.pendingChangeAt = "";
  await sub.save();

  await BillingAuditLog.create({
    userId: sub.userId,
    category: input.category,
    action: "plan_change_cancelled",
    provider: "razorpay",
    providerSubscriptionId: sub.providerSubscriptionId,
    actor: "user",
    summary: `Cancelled pending plan change for ${input.category}.`,
    before,
    after: snapshot(sub),
  });

  return { cancelled: true, category: input.category };
}

function providerEntityFromFetch(
  provider: RazorpaySubscriptionResponse,
  local: ISubscription,
): Record<string, any> {
  return {
    id: provider.id,
    plan_id: provider.plan_id,
    status: provider.status,
    customer_id: provider.customer_id,
    current_start: provider.current_start,
    current_end: provider.current_end,
    start_at: provider.start_at,
    end_at: provider.end_at,
    ended_at: provider.ended_at,
    cancel_at_cycle_end: provider.cancel_at_cycle_end === true,
    has_scheduled_changes: provider.has_scheduled_changes === true,
    payment_id: provider.payment_id,
    created_at: provider.created_at,
    notes: {
      rolebolt_user_id: local.userId.toString(),
      rolebolt_category: local.category,
      rolebolt_plan:
        typeof provider.notes?.rolebolt_plan === "string"
          ? provider.notes.rolebolt_plan
          : local.plan,
      rolebolt_interval:
        typeof provider.notes?.rolebolt_interval === "string"
          ? provider.notes.rolebolt_interval
          : local.interval,
      ...(provider.notes ?? {}),
    },
  };
}

export interface ReconciliationResult {
  userId: string;
  category: BillingCategory;
  outcome: "repaired" | "noop" | "failed" | "skipped";
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Fetch Razorpay subscription state and repair local Subscription mismatches.
 */
export async function reconcileSubscription(input: {
  userId: string;
  category: BillingCategory;
  dryRun?: boolean;
  actor?: "cli" | "user" | "system";
}): Promise<ReconciliationResult> {
  const objectId = requireObjectId(input.userId);
  const sub = await Subscription.findOne({
    userId: objectId,
    category: input.category,
  }).exec();

  if (!sub || !sub.providerSubscriptionId || sub.provider !== "razorpay") {
    return {
      userId: input.userId,
      category: input.category,
      outcome: "skipped",
      summary: "No Razorpay provider subscription id on the local record.",
    };
  }

  const before = snapshot(sub);
  try {
    const provider = await fetchRazorpaySubscription(sub.providerSubscriptionId);
    const status =
      lifecycleStatus(`subscription.${provider.status}`, provider.status) ??
      (provider.status as any);
    if (!status) {
      await BillingAuditLog.create({
        userId: objectId,
        category: input.category,
        action: "reconciliation_failed",
        provider: "razorpay",
        providerSubscriptionId: sub.providerSubscriptionId,
        actor: input.actor ?? "cli",
        summary: `Unsupported provider status during reconciliation: ${provider.status}`,
        before,
      });
      return {
        userId: input.userId,
        category: input.category,
        outcome: "failed",
        summary: `Unsupported provider status: ${provider.status}`,
        before,
      };
    }

    const entity = providerEntityFromFetch(provider, sub);
    const mismatches: string[] = [];
    if (sub.status !== status) mismatches.push(`status:${sub.status}->${status}`);
    if (sub.providerPlanId && provider.plan_id && sub.providerPlanId !== provider.plan_id) {
      mismatches.push(`plan_id:${sub.providerPlanId}->${provider.plan_id}`);
    }
    const providerCancel =
      provider.cancel_at_cycle_end === true ||
      (status === "cancelled" && Boolean(sub.cancelAtPeriodEnd));
    if (Boolean(sub.cancelAtPeriodEnd) !== Boolean(providerCancel) && provider.cancel_at_cycle_end != null) {
      mismatches.push(`cancelAtPeriodEnd:${sub.cancelAtPeriodEnd}->${providerCancel}`);
    }

    if (mismatches.length === 0) {
      await BillingAuditLog.create({
        userId: objectId,
        category: input.category,
        action: "reconciliation_noop",
        provider: "razorpay",
        providerSubscriptionId: sub.providerSubscriptionId,
        actor: input.actor ?? "cli",
        summary: "Local subscription already matches Razorpay.",
        before,
        after: before,
      });
      return {
        userId: input.userId,
        category: input.category,
        outcome: "noop",
        summary: "Local subscription already matches Razorpay.",
        before,
        after: before,
      };
    }

    if (input.dryRun) {
      return {
        userId: input.userId,
        category: input.category,
        outcome: "repaired",
        summary: `Dry run would repair: ${mismatches.join(", ")}`,
        before,
      };
    }

    const applied = await applyProviderSubscriptionState({
      entity,
      status,
      source: "reconciliation",
      providerEventAt: new Date(),
      eventType: `reconciliation.${provider.status}`,
    });

    const fresh = await Subscription.findById(sub._id).exec();
    return {
      userId: input.userId,
      category: input.category,
      outcome: applied.outcome === "applied" ? "repaired" : "noop",
      summary:
        applied.outcome === "applied"
          ? `Repaired mismatches: ${mismatches.join(", ")}`
          : `Reconciliation did not apply (${applied.outcome}).`,
      before,
      after: snapshot(fresh),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation failed.";
    await BillingAuditLog.create({
      userId: objectId,
      category: input.category,
      action: "reconciliation_failed",
      provider: "razorpay",
      providerSubscriptionId: sub.providerSubscriptionId,
      actor: input.actor ?? "cli",
      summary: message.slice(0, 500),
      before,
    });
    return {
      userId: input.userId,
      category: input.category,
      outcome: "failed",
      summary: message,
      before,
    };
  }
}

export async function reconcileAllPaidSubscriptions(input?: {
  dryRun?: boolean;
  userId?: string;
  category?: BillingCategory;
}): Promise<ReconciliationResult[]> {
  const filter: Record<string, unknown> = {
    provider: "razorpay",
    providerSubscriptionId: { $type: "string", $gt: "" },
    plan: { $in: ["pro", "ultra"] },
  };
  if (input?.userId) filter.userId = requireObjectId(input.userId);
  if (input?.category) filter.category = input.category;

  const subs = await Subscription.find(filter).exec();
  const results: ReconciliationResult[] = [];
  for (const sub of subs) {
    results.push(
      await reconcileSubscription({
        userId: sub.userId.toString(),
        category: sub.category,
        dryRun: input?.dryRun,
        actor: "cli",
      }),
    );
  }
  return results;
}
