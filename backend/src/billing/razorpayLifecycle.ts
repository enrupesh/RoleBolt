import crypto from "node:crypto";
import mongoose from "mongoose";
import { BillingAuditLog } from "../models/BillingAuditLog";
import { BillingCheckout } from "../models/BillingCheckout";
import { BillingEvent, type IBillingEvent } from "../models/BillingEvent";
import { Subscription, type ISubscription, type SubscriptionStatus } from "../models/Subscription";
import {
  getConfiguredRazorpayPlanId,
  resolveCatalogEntryByRazorpayPlanId,
  unixSecondsToDate,
} from "./razorpay";
import {
  isBillingCategory,
  isBillingInterval,
  isBillingPlan,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
} from "../billingTypes";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  authenticated: "authenticated",
  active: "active",
  activated: "active",
  charged: "active",
  resumed: "active",
  pending: "pending",
  halted: "halted",
  cancelled: "cancelled",
  canceled: "cancelled",
  paused: "paused",
  completed: "completed",
  expired: "expired",
};

/** Terminal / regressive statuses that must not overwrite a newer active period. */
const REGRESSIVE_STATUSES = new Set<SubscriptionStatus>([
  "cancelled",
  "completed",
  "expired",
  "halted",
  "paused",
]);

function payloadHash(rawBody: Buffer): string {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

function eventIdFromRequest(headers: Record<string, unknown>): string {
  const value = headers["x-razorpay-event-id"];
  return typeof value === "string" ? value.trim() : "";
}

export function getRazorpayEventId(headers: Record<string, unknown>): string {
  const eventId = eventIdFromRequest(headers);
  if (!eventId) {
    const error = new Error("Missing x-razorpay-event-id header.");
    error.name = "RazorpayWebhookInputError";
    throw error;
  }
  return eventId;
}

export function lifecycleStatus(
  eventType: string,
  providerStatus: unknown,
): SubscriptionStatus | null {
  if (eventType === "payment.failed" || eventType === "invoice.payment_failed") {
    return "past_due";
  }
  const eventStatus = eventType.startsWith("subscription.")
    ? eventType.slice("subscription.".length)
    : "";
  if (eventStatus === "pending") return "pending";
  return (
    STATUS_MAP[eventStatus] ??
    (typeof providerStatus === "string" ? STATUS_MAP[providerStatus] ?? null : null)
  );
}

function getSubscriptionUserId(
  entity: Record<string, any>,
  checkout?: { userId?: unknown } | null,
  existing?: { userId?: unknown } | null,
): string {
  const note = entity.notes?.rolebolt_user_id;
  if (typeof note === "string" && mongoose.isValidObjectId(note)) return note;
  if (checkout?.userId) return checkout.userId.toString();
  if (existing?.userId) return existing.userId.toString();
  return "";
}

export function resolveCancelAtPeriodEnd(input: {
  status: SubscriptionStatus;
  entity: Record<string, any>;
  previous?: Pick<ISubscription, "cancelAtPeriodEnd" | "currentPeriodEnd"> | null;
}): boolean {
  const { status, entity, previous } = input;
  if (entity.cancel_at_cycle_end === true) return true;
  if (entity.cancel_at_cycle_end === false && status !== "cancelled") return false;

  // Razorpay often leaves cancel_at_cycle_end unset on the eventual cancelled
  // webhook after a cycle-end cancel. Preserve the scheduled flag when the
  // paid period is still open.
  if (status === "cancelled") {
    const periodEnd =
      unixSecondsToDate(entity.current_end) ??
      unixSecondsToDate(entity.end_at) ??
      previous?.currentPeriodEnd;
    if (previous?.cancelAtPeriodEnd && periodEnd && periodEnd.getTime() > Date.now()) {
      return true;
    }
    // Immediate cancel: ended_at present and no cycle-end flag.
    if (entity.cancel_at_cycle_end === true) return true;
    if (entity.ended_at && entity.cancel_at_cycle_end !== true) return false;
    if (periodEnd && periodEnd.getTime() > Date.now() && previous?.cancelAtPeriodEnd) {
      return true;
    }
  }

  return Boolean(previous?.cancelAtPeriodEnd);
}

export function resolveSubscriptionMapping(input: {
  entity: Record<string, any>;
  checkout?: {
    category?: BillingCategory;
    plan?: BillingPlan;
    interval?: BillingInterval;
    providerPlanId?: string;
    userId?: unknown;
  } | null;
  existing?: ISubscription | null;
}): {
  userId: string;
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
  providerPlanId: string;
} | null {
  const { entity, checkout, existing } = input;
  const providerPlanId =
    (typeof entity.plan_id === "string" ? entity.plan_id : "") ||
    checkout?.providerPlanId ||
    existing?.providerPlanId ||
    "";
  if (!providerPlanId) return null;

  const fromProviderPlan = resolveCatalogEntryByRazorpayPlanId(providerPlanId);
  const noteCategory =
    typeof entity.notes?.rolebolt_category === "string" && isBillingCategory(entity.notes.rolebolt_category)
      ? entity.notes.rolebolt_category
      : undefined;
  const category =
    fromProviderPlan?.category ??
    noteCategory ??
    checkout?.category ??
    (existing?.category && isBillingCategory(existing.category) ? existing.category : undefined);
  if (!category) return null;

  // Prefer reverse-lookup from plan_id so plan-change webhooks do not keep stale notes.
  const plan =
    fromProviderPlan?.plan ??
    (typeof entity.notes?.rolebolt_plan === "string" && isBillingPlan(entity.notes.rolebolt_plan)
      ? entity.notes.rolebolt_plan
      : undefined) ??
    checkout?.plan ??
    (existing && isBillingPlan(existing.plan) ? existing.plan : undefined);
  const interval =
    fromProviderPlan?.interval ??
    (typeof entity.notes?.rolebolt_interval === "string" &&
    isBillingInterval(entity.notes.rolebolt_interval)
      ? entity.notes.rolebolt_interval
      : undefined) ??
    checkout?.interval ??
    existing?.interval;
  const userId = getSubscriptionUserId(entity, checkout, existing);

  if (!userId || !plan || !interval || plan === "free") return null;

  // Defense: configured ID for resolved catalog must match provider plan.
  try {
    if (getConfiguredRazorpayPlanId(category, plan, interval) !== providerPlanId) {
      return null;
    }
  } catch {
    return null;
  }

  return { userId, category, plan, interval, providerPlanId };
}

function extractProviderEventAt(
  payload: Record<string, any>,
  entity: Record<string, any>,
): Date | undefined {
  return (
    unixSecondsToDate(payload.created_at) ??
    unixSecondsToDate(entity.created_at) ??
    unixSecondsToDate(entity.charge_at) ??
    unixSecondsToDate(entity.current_end)
  );
}

function shouldIgnoreStaleEvent(input: {
  existing: ISubscription | null;
  nextStatus: SubscriptionStatus;
  providerEventAt?: Date;
}): boolean {
  const { existing, nextStatus, providerEventAt } = input;
  if (!existing?.lastProviderEventAt || !providerEventAt) return false;
  if (providerEventAt.getTime() >= existing.lastProviderEventAt.getTime()) return false;

  // Older regressive events must not clobber a newer paid state.
  if (
    REGRESSIVE_STATUSES.has(nextStatus) &&
    (existing.status === "active" ||
      existing.status === "authenticated" ||
      existing.status === "pending")
  ) {
    return true;
  }
  return providerEventAt.getTime() < existing.lastProviderEventAt.getTime();
}

function clearPendingFieldsIfApplied(
  pendingPlan: string | undefined,
  pendingProviderPlanId: string | undefined,
  appliedPlan: BillingPlan,
  appliedProviderPlanId: string,
): Record<string, unknown> {
  if (
    pendingProviderPlanId &&
    pendingProviderPlanId === appliedProviderPlanId
  ) {
    return {
      pendingPlan: "",
      pendingInterval: "",
      pendingProviderPlanId: "",
      pendingChangeAt: "",
    };
  }
  if (pendingPlan && pendingPlan === appliedPlan) {
    return {
      pendingPlan: "",
      pendingInterval: "",
      pendingProviderPlanId: "",
      pendingChangeAt: "",
    };
  }
  return {};
}

export interface ApplyProviderSubscriptionResult {
  outcome: "applied" | "ignored_stale" | "ignored_unmapped";
  subscription?: ISubscription | null;
}

/**
 * Shared mutation path for verified webhooks and reconciliation repairs.
 * Never grants access from checkout callbacks — only provider-verified state.
 */
export async function applyProviderSubscriptionState(input: {
  entity: Record<string, any>;
  status: SubscriptionStatus;
  source: "webhook" | "reconciliation";
  providerEventAt?: Date;
  eventType?: string;
}): Promise<ApplyProviderSubscriptionResult> {
  const providerSubscriptionId =
    typeof input.entity.id === "string" ? input.entity.id : "";
  if (!providerSubscriptionId) {
    return { outcome: "ignored_unmapped" };
  }

  const checkout = await BillingCheckout.findOne({ providerSubscriptionId }).exec();
  const existing = await Subscription.findOne({ providerSubscriptionId }).exec();
  const mapping = resolveSubscriptionMapping({
    entity: input.entity,
    checkout,
    existing,
  });
  if (!mapping) {
    return { outcome: "ignored_unmapped" };
  }

  if (
    shouldIgnoreStaleEvent({
      existing,
      nextStatus: input.status,
      providerEventAt: input.providerEventAt,
    })
  ) {
    await BillingAuditLog.create({
      userId: new mongoose.Types.ObjectId(mapping.userId),
      category: mapping.category,
      action: "webhook_ignored_stale",
      provider: "razorpay",
      providerSubscriptionId,
      actor: input.source === "webhook" ? "webhook" : "cli",
      summary: `Ignored stale ${input.eventType ?? input.status} event for ${providerSubscriptionId}.`,
      before: existing
        ? {
            status: existing.status,
            plan: existing.plan,
            lastProviderEventAt: existing.lastProviderEventAt,
          }
        : undefined,
      metadata: { status: input.status, providerEventAt: input.providerEventAt },
    });
    return { outcome: "ignored_stale", subscription: existing };
  }

  const cancelAtPeriodEnd = resolveCancelAtPeriodEnd({
    status: input.status,
    entity: input.entity,
    previous: existing,
  });

  const periodStart =
    unixSecondsToDate(input.entity.current_start) ??
    unixSecondsToDate(input.entity.start_at) ??
    existing?.currentPeriodStart;
  const periodEnd =
    unixSecondsToDate(input.entity.current_end) ??
    unixSecondsToDate(input.entity.end_at) ??
    existing?.currentPeriodEnd;

  const pendingClear = clearPendingFieldsIfApplied(
    existing?.pendingPlan,
    existing?.pendingProviderPlanId,
    mapping.plan,
    mapping.providerPlanId,
  );

  const setFields: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(mapping.userId),
    category: mapping.category,
    plan: mapping.plan,
    interval: mapping.interval,
    status: input.status,
    provider: "razorpay",
    providerCustomerId:
      typeof input.entity.customer_id === "string"
        ? input.entity.customer_id
        : existing?.providerCustomerId ?? "",
    providerSubscriptionId,
    providerPlanId: mapping.providerPlanId,
    providerLatestPaymentId:
      typeof input.entity.payment_id === "string"
        ? input.entity.payment_id
        : existing?.providerLatestPaymentId ?? "",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd,
    lastWebhookAt: new Date(),
    ...(input.providerEventAt ? { lastProviderEventAt: input.providerEventAt } : {}),
    ...pendingClear,
  };

  const unsetFields: Record<string, 1> = {};
  if (input.status === "cancelled") {
    setFields.cancelledAt = existing?.cancelledAt ?? new Date();
  } else if (cancelAtPeriodEnd) {
    if (existing?.cancelledAt) setFields.cancelledAt = existing.cancelledAt;
  } else {
    unsetFields.cancelledAt = 1;
  }

  if (input.status === "cancelled" && !cancelAtPeriodEnd) {
    setFields.endedAt = unixSecondsToDate(input.entity.ended_at) ?? new Date();
  } else if (input.status === "completed" || input.status === "expired") {
    setFields.endedAt = unixSecondsToDate(input.entity.ended_at) ?? new Date();
  } else if (
    input.status === "active" ||
    input.status === "authenticated" ||
    input.status === "pending"
  ) {
    unsetFields.endedAt = 1;
  } else if (existing?.endedAt) {
    setFields.endedAt = existing.endedAt;
  }

  const update: Record<string, unknown> = { $set: setFields };
  if (Object.keys(unsetFields).length > 0) update.$unset = unsetFields;

  const updated = await Subscription.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(mapping.userId), category: mapping.category },
    update,
    { upsert: true, new: true },
  ).exec();

  await BillingCheckout.updateOne(
    { providerSubscriptionId },
    {
      $set: {
        status:
          input.status === "active" || input.status === "authenticated"
            ? "verified"
            : checkout?.status === "verified"
              ? "verified"
              : "created",
        providerPaymentId:
          typeof input.entity.payment_id === "string"
            ? input.entity.payment_id
            : undefined,
        plan: mapping.plan,
        interval: mapping.interval,
        providerPlanId: mapping.providerPlanId,
      },
    },
  ).exec();

  await BillingAuditLog.create({
    userId: new mongoose.Types.ObjectId(mapping.userId),
    category: mapping.category,
    action: input.source === "webhook" ? "webhook_applied" : "reconciliation_repair",
    provider: "razorpay",
    providerSubscriptionId,
    actor: input.source === "webhook" ? "webhook" : "cli",
    summary: `Applied provider status ${input.status} for ${mapping.category}/${mapping.plan}.`,
    before: existing
      ? {
          status: existing.status,
          plan: existing.plan,
          interval: existing.interval,
          cancelAtPeriodEnd: existing.cancelAtPeriodEnd,
          providerPlanId: existing.providerPlanId,
        }
      : undefined,
    after: {
      status: updated?.status,
      plan: updated?.plan,
      interval: updated?.interval,
      cancelAtPeriodEnd: updated?.cancelAtPeriodEnd,
      providerPlanId: updated?.providerPlanId,
    },
    metadata: { eventType: input.eventType, source: input.source },
  });

  return { outcome: "applied", subscription: updated };
}

function extractSubscriptionEntityFromPayload(
  payload: Record<string, any>,
): Record<string, any> | null {
  const direct = payload?.payload?.subscription?.entity;
  if (direct && typeof direct === "object" && typeof direct.id === "string") {
    return direct;
  }
  // payment.failed may nest subscription under payment notes or subscription_id only.
  const payment = payload?.payload?.payment?.entity;
  if (payment && typeof payment === "object") {
    const nested = payment.subscription_id;
    if (typeof nested === "string" && nested) {
      return {
        id: nested,
        status: "pending",
        plan_id: typeof payment.plan_id === "string" ? payment.plan_id : undefined,
        customer_id: typeof payment.customer_id === "string" ? payment.customer_id : undefined,
        payment_id: typeof payment.id === "string" ? payment.id : undefined,
        notes: payment.notes && typeof payment.notes === "object" ? payment.notes : undefined,
      };
    }
  }
  return null;
}

export async function processRazorpayWebhook(input: {
  rawBody: Buffer;
  eventId: string;
  eventType: string;
  payload: Record<string, any>;
}): Promise<"processed" | "ignored"> {
  const hash = payloadHash(input.rawBody);
  let event: IBillingEvent | null = await BillingEvent.findOne({
    provider: "razorpay",
    providerEventId: input.eventId,
  }).exec();
  if (event) {
    if (event.payloadHash !== hash) {
      throw new Error("Razorpay event ID was replayed with a different payload.");
    }
    if (event.status === "processed" || event.status === "ignored") return event.status;
  }

  if (!event) {
    try {
      event = (await BillingEvent.create({
        provider: "razorpay",
        providerEventId: input.eventId,
        eventType: input.eventType,
        status: "received",
        payloadHash: hash,
        payload: input.payload,
      })) as IBillingEvent;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      event = await BillingEvent.findOne({
        provider: "razorpay",
        providerEventId: input.eventId,
      }).exec();
      if (!event) throw error;
      if (event.payloadHash !== hash) {
        throw new Error("Razorpay event ID was replayed with a different payload.");
      }
      if (event.status === "processed" || event.status === "ignored") return event.status;
    }
  }

  const entity = extractSubscriptionEntityFromPayload(input.payload);
  if (!entity) {
    await BillingEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          status: "ignored",
          processedAt: new Date(),
          error: "No subscription entity.",
        },
      },
    ).exec();
    return "ignored";
  }

  // payment.failed with only a subscription id needs a local record to map plan.
  if (!entity.plan_id && typeof entity.id === "string") {
    const existing = await Subscription.findOne({
      providerSubscriptionId: entity.id,
    }).lean();
    if (existing?.providerPlanId) {
      entity.plan_id = existing.providerPlanId;
      entity.notes = {
        rolebolt_user_id: existing.userId.toString(),
        rolebolt_category: existing.category,
        rolebolt_plan: existing.plan,
        rolebolt_interval: existing.interval,
      };
      if (existing.currentPeriodStart) {
        entity.current_start = Math.floor(existing.currentPeriodStart.getTime() / 1000);
      }
      if (existing.currentPeriodEnd) {
        entity.current_end = Math.floor(existing.currentPeriodEnd.getTime() / 1000);
      }
      if (existing.cancelAtPeriodEnd) entity.cancel_at_cycle_end = true;
    }
  }

  const status = lifecycleStatus(input.eventType, entity.status);
  if (!status) {
    await BillingEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          status: "ignored",
          processedAt: new Date(),
          error: "Unsupported Razorpay lifecycle event.",
        },
      },
    ).exec();
    return "ignored";
  }

  const providerEventAt = extractProviderEventAt(input.payload, entity);
  const applied = await applyProviderSubscriptionState({
    entity,
    status,
    source: "webhook",
    providerEventAt,
    eventType: input.eventType,
  });

  if (applied.outcome === "ignored_unmapped") {
    await BillingEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          status: "ignored",
          processedAt: new Date(),
          error: "Subscription could not be mapped to a Rolebolt paid plan.",
        },
      },
    ).exec();
    return "ignored";
  }

  await BillingEvent.updateOne(
    { _id: event._id },
    {
      $set: {
        status: applied.outcome === "ignored_stale" ? "ignored" : "processed",
        processedAt: new Date(),
        error: applied.outcome === "ignored_stale" ? "Stale out-of-order event." : "",
      },
    },
  ).exec();
  return applied.outcome === "ignored_stale" ? "ignored" : "processed";
}

export function hashRazorpayPayload(rawBody: Buffer): string {
  return payloadHash(rawBody);
}
