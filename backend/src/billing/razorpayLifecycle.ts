import crypto from "node:crypto";
import mongoose from "mongoose";
import { BillingCheckout } from "../models/BillingCheckout";
import { BillingEvent, type IBillingEvent } from "../models/BillingEvent";
import { Subscription, type SubscriptionStatus } from "../models/Subscription";
import { getConfiguredRazorpayPlanId, unixSecondsToDate } from "./razorpay";
import { isBillingCategory, isBillingInterval, isBillingPlan } from "../billingTypes";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  authenticated: "authenticated",
  active: "active",
  activated: "active",
  charged: "active",
  resumed: "active",
  pending: "pending",
  halted: "halted",
  cancelled: "cancelled",
  paused: "paused",
  completed: "completed",
};

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

export function lifecycleStatus(eventType: string, providerStatus: unknown): SubscriptionStatus | null {
  const eventStatus = eventType.startsWith("subscription.")
    ? eventType.slice("subscription.".length)
    : "";
  return STATUS_MAP[eventStatus] ?? (typeof providerStatus === "string" ? STATUS_MAP[providerStatus] ?? null : null);
}

function getSubscriptionUserId(entity: Record<string, any>, checkout?: { userId?: unknown }): string {
  const note = entity.notes?.rolebolt_user_id;
  if (typeof note === "string" && mongoose.isValidObjectId(note)) return note;
  if (checkout?.userId) return checkout.userId.toString();
  return "";
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
      event = await BillingEvent.create({
        provider: "razorpay",
        providerEventId: input.eventId,
        eventType: input.eventType,
        status: "received",
        payloadHash: hash,
        payload: input.payload,
      }) as IBillingEvent;
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

  const entity = input.payload?.payload?.subscription?.entity;
  if (!entity || typeof entity !== "object" || typeof entity.id !== "string") {
    await BillingEvent.updateOne(
      { _id: event._id },
      { $set: { status: "ignored", processedAt: new Date(), error: "No subscription entity." } },
    ).exec();
    return "ignored";
  }

  const providerSubscriptionId = entity.id as string;
  const checkout = await BillingCheckout.findOne({ providerSubscriptionId }).exec();
  const existing = await Subscription.findOne({ providerSubscriptionId }).exec();
  const userId = getSubscriptionUserId(entity, checkout ?? undefined);
  const category = typeof entity.notes?.rolebolt_category === "string" && isBillingCategory(entity.notes.rolebolt_category)
    ? entity.notes.rolebolt_category
    : checkout?.category ?? existing?.category;
  const plan = typeof entity.notes?.rolebolt_plan === "string" && isBillingPlan(entity.notes.rolebolt_plan)
    ? entity.notes.rolebolt_plan
    : checkout?.plan ?? (isBillingPlan(existing?.plan ?? "") ? existing?.plan : undefined);
  const interval = typeof entity.notes?.rolebolt_interval === "string" && isBillingInterval(entity.notes.rolebolt_interval)
    ? entity.notes.rolebolt_interval
    : checkout?.interval ?? existing?.interval;
  const providerPlanId = typeof entity.plan_id === "string"
    ? entity.plan_id
    : checkout?.providerPlanId ?? existing?.providerPlanId;

  if (
    !userId ||
    !category ||
    !plan ||
    !interval ||
    plan === "free" ||
    !providerPlanId
  ) {
    await BillingEvent.updateOne(
      { _id: event._id },
      { $set: { status: "ignored", processedAt: new Date(), error: "Subscription could not be mapped to a Rolebolt paid plan." } },
    ).exec();
    return "ignored";
  }

  const configuredPlanId = getConfiguredRazorpayPlanId(category, plan, interval);
  if (configuredPlanId !== providerPlanId) {
    await BillingEvent.updateOne(
      { _id: event._id },
      { $set: { status: "ignored", processedAt: new Date(), error: "Provider plan ID does not match the server catalog." } },
    ).exec();
    return "ignored";
  }

  const status = lifecycleStatus(input.eventType, entity.status);
  if (!status) {
    await BillingEvent.updateOne(
      { _id: event._id },
      { $set: { status: "ignored", processedAt: new Date(), error: "Unsupported Razorpay lifecycle event." } },
    ).exec();
    return "ignored";
  }

  await Subscription.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), category },
    {
      $set: {
        userId: new mongoose.Types.ObjectId(userId),
        category,
        plan,
        interval,
        status,
        provider: "razorpay",
        providerCustomerId: typeof entity.customer_id === "string" ? entity.customer_id : "",
        providerSubscriptionId,
        providerPlanId,
        providerLatestPaymentId: typeof entity.payment_id === "string" ? entity.payment_id : "",
        currentPeriodStart: unixSecondsToDate(entity.current_start) ?? unixSecondsToDate(entity.start_at),
        currentPeriodEnd: unixSecondsToDate(entity.current_end) ?? unixSecondsToDate(entity.end_at),
        cancelAtPeriodEnd: entity.has_scheduled_changes === true,
        cancelledAt: status === "cancelled" ? new Date() : undefined,
        endedAt: status === "cancelled" || status === "completed" ? new Date() : undefined,
        lastWebhookAt: new Date(),
      },
      $setOnInsert: {
        cancelAtPeriodEnd: false,
      },
    },
    { upsert: true, new: true },
  ).exec();

  await BillingCheckout.updateOne(
    { providerSubscriptionId },
    {
      $set: {
        status: status === "active" || status === "authenticated" ? "verified" : "created",
        providerPaymentId: typeof entity.payment_id === "string" ? entity.payment_id : undefined,
      },
    },
  ).exec();

  await BillingEvent.updateOne(
    { _id: event._id },
    { $set: { status: "processed", processedAt: new Date() } },
  ).exec();
  return "processed";
}

export function hashRazorpayPayload(rawBody: Buffer): string {
  return payloadHash(rawBody);
}