import crypto from "node:crypto";
import type { BillingCategory, BillingInterval, BillingPlan } from "../billingTypes";
import { getPlanDefinition } from "./planCatalog";

const RAZORPAY_API_URL = "https://api.razorpay.com";

export class RazorpayNotConfiguredError extends Error {
  readonly code = "RAZORPAY_NOT_CONFIGURED";

  constructor(message = "Razorpay is not configured.") {
    super(message);
    this.name = "RazorpayNotConfiguredError";
  }
}

export class RazorpayApiError extends Error {
  readonly code = "RAZORPAY_API_ERROR";

  constructor(
    message: string,
    readonly status: number,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

export class RazorpaySignatureError extends Error {
  readonly code = "RAZORPAY_SIGNATURE_INVALID";

  constructor() {
    super("Razorpay signature verification failed.");
    this.name = "RazorpaySignatureError";
  }
}

export interface RazorpaySubscriptionResponse {
  id: string;
  plan_id: string;
  status: string;
  short_url?: string;
  customer_id?: string;
  current_start?: number;
  current_end?: number;
  start_at?: number;
  end_at?: number;
  ended_at?: number;
  charge_at?: number;
  created_at?: number;
  cancel_at_cycle_end?: boolean;
  has_scheduled_changes?: boolean;
  change_scheduled_at?: number | string | null;
  payment_id?: string;
  notes?: Record<string, string>;
}

export interface RazorpayPlanResponse {
  id: string;
  item?: { name?: string; amount?: number; currency?: string; description?: string };
  period?: string;
  interval?: number;
}

/**
 * Razorpay requires a bounded subscription when perpetual subscriptions are
 * not enabled on the account. UPI mandates have a stricter 30-year expiry
 * boundary than the general subscription API, so keep a full year of headroom
 * for subscriptions created near the end of a calendar year.
 */
export function getRazorpaySubscriptionTotalCount(interval: BillingInterval): number {
  return interval === "monthly" ? 348 : 29;
}

/** Razorpay Checkout prefill expects E.164, e.g. +919876543210 for Indian numbers. */
export function formatRazorpayPrefillContact(phone?: string | null): string | undefined {
  if (!phone?.trim()) return undefined;
  const raw = phone.trim();
  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    return digits.length >= 10 ? `+${digits}` : undefined;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return undefined;
}

/** Razorpay subscription notify_info uses a plain national number without the country prefix. */
export function formatRazorpayNotifyPhone(phone?: string | null): string | undefined {
  const prefill = formatRazorpayPrefillContact(phone);
  if (!prefill) return undefined;
  const digits = prefill.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits.length === 10 ? digits : undefined;
}

export function buildRazorpayCheckoutPrefill(input: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): { name?: string; email?: string; contact?: string } {
  const prefill: { name?: string; email?: string; contact?: string } = {};
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const contact = formatRazorpayPrefillContact(input.phone);
  if (name) prefill.name = name.slice(0, 120);
  if (email) prefill.email = email.slice(0, 120);
  if (contact) prefill.contact = contact;
  return prefill;
}

export function subscriptionSupportsCheckoutAuth(status: string | undefined): boolean {
  return status === "created";
}

function getApiConfig(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new RazorpayNotConfiguredError(
      "Razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  return { keyId, keySecret };
}

function getWebhookSecret(): string {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new RazorpayNotConfiguredError(
      "Razorpay webhooks require RAZORPAY_WEBHOOK_SECRET.",
    );
  }
  return webhookSecret;
}

export function getRazorpayPlanEnvKey(
  category: BillingCategory,
  plan: BillingPlan,
  interval: BillingInterval,
): string {
  return `RAZORPAY_PLAN_${category.toUpperCase()}_${plan.toUpperCase()}_${interval.toUpperCase()}`;
}

export function getConfiguredRazorpayPlanId(
  category: BillingCategory,
  plan: BillingPlan,
  interval: BillingInterval,
): string {
  if (plan === "free") return "";
  const key = getRazorpayPlanEnvKey(category, plan, interval);
  const value = process.env[key]?.trim() ?? "";
  if (!value) {
    throw new RazorpayNotConfiguredError(
      `Missing server-side Razorpay plan configuration: ${key}.`,
    );
  }
  return value;
}

function authorizationHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpayRequest<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: Record<string, unknown> },
): Promise<T> {
  const { keyId, keySecret } = getApiConfig();
  const response = await fetch(`${RAZORPAY_API_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: authorizationHeader(keyId, keySecret),
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 1000) };
  }
  if (!response.ok) {
    throw new RazorpayApiError(
      `Razorpay API returned HTTP ${response.status}.`,
      response.status,
      parsed,
    );
  }
  return parsed as T;
}

/**
 * Reverse-lookup a Rolebolt catalog entry from a server-configured Razorpay plan ID.
 * Webhooks for plan changes must prefer this over stale subscription notes.
 */
export function resolveCatalogEntryByRazorpayPlanId(
  providerPlanId: string,
): { category: BillingCategory; plan: BillingPlan; interval: BillingInterval } | null {
  const needle = providerPlanId.trim();
  if (!needle) return null;
  const categories: BillingCategory[] = ["seeker", "creator_form", "creator_standard"];
  const plans: BillingPlan[] = ["pro", "ultra"];
  const intervals: BillingInterval[] = ["monthly", "yearly"];
  for (const category of categories) {
    for (const plan of plans) {
      for (const interval of intervals) {
        const configured = process.env[getRazorpayPlanEnvKey(category, plan, interval)]?.trim();
        if (configured && configured === needle) {
          return { category, plan, interval };
        }
      }
    }
  }
  return null;
}

export async function fetchRazorpaySubscription(
  subscriptionId: string,
): Promise<RazorpaySubscriptionResponse> {
  const id = subscriptionId.trim();
  if (!id) throw new RazorpayApiError("Missing Razorpay subscription id.", 400);
  return razorpayRequest<RazorpaySubscriptionResponse>(`/v1/subscriptions/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

/**
 * Schedule cancellation at cycle end (preferred) or cancel immediately.
 * Launch policy uses cancel_at_cycle_end=true so paid access continues until period end.
 */
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  options: { cancelAtCycleEnd?: boolean } = {},
): Promise<RazorpaySubscriptionResponse> {
  const id = subscriptionId.trim();
  if (!id) throw new RazorpayApiError("Missing Razorpay subscription id.", 400);
  return razorpayRequest<RazorpaySubscriptionResponse>(
    `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      body: {
        cancel_at_cycle_end: options.cancelAtCycleEnd !== false,
      },
    },
  );
}

/**
 * Change the Razorpay plan linked to an existing subscription.
 * Upgrades use schedule_change_at=now; downgrades use cycle_end per payment.md §13.3–13.4.
 * Local entitlement must still wait for webhook/reconciliation — never trust this response alone.
 */
export async function updateRazorpaySubscriptionPlan(input: {
  subscriptionId: string;
  planId: string;
  scheduleChangeAt: "now" | "cycle_end";
}): Promise<RazorpaySubscriptionResponse> {
  const id = input.subscriptionId.trim();
  if (!id) throw new RazorpayApiError("Missing Razorpay subscription id.", 400);
  return razorpayRequest<RazorpaySubscriptionResponse>(
    `/v1/subscriptions/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: {
        plan_id: input.planId,
        schedule_change_at: input.scheduleChangeAt,
        customer_notify: true,
      },
    },
  );
}

/** Cancel a pending plan update that has not yet taken effect. */
export async function cancelRazorpaySubscriptionPendingUpdate(
  subscriptionId: string,
): Promise<RazorpaySubscriptionResponse> {
  const id = subscriptionId.trim();
  if (!id) throw new RazorpayApiError("Missing Razorpay subscription id.", 400);
  return razorpayRequest<RazorpaySubscriptionResponse>(
    `/v1/subscriptions/${encodeURIComponent(id)}/cancel_scheduled_changes`,
    { method: "POST", body: {} },
  );
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): void {
  const webhookSecret = getWebhookSecret();
  if (!signature?.trim()) throw new RazorpaySignatureError();
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const actual = signature.trim();
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  ) {
    throw new RazorpaySignatureError();
  }
}

export function verifySubscriptionCheckoutSignature(input: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): void {
  const { keySecret } = getApiConfig();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${input.subscriptionId}|${input.paymentId}`)
    .digest("hex");
  const actual = input.signature.trim();
  if (
    !actual ||
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  ) {
    throw new RazorpaySignatureError();
  }
}

export async function createRazorpaySubscription(input: {
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
  userId: string;
  idempotencyKey: string;
  notifyEmail?: string | null;
  notifyPhone?: string | null;
}): Promise<RazorpaySubscriptionResponse> {
  const planId = getConfiguredRazorpayPlanId(input.category, input.plan, input.interval);
  const notifyEmail = input.notifyEmail?.trim().toLowerCase();
  const notifyPhone = formatRazorpayNotifyPhone(input.notifyPhone);
  const notifyInfo =
    notifyEmail || notifyPhone
      ? {
          ...(notifyEmail ? { notify_email: notifyEmail.slice(0, 120) } : {}),
          ...(notifyPhone ? { notify_phone: notifyPhone } : {}),
        }
      : undefined;

  return razorpayRequest<RazorpaySubscriptionResponse>("/v1/subscriptions", {
    method: "POST",
    body: {
      plan_id: planId,
      total_count: getRazorpaySubscriptionTotalCount(input.interval),
      quantity: 1,
      customer_notify: true,
      ...(notifyInfo ? { notify_info: notifyInfo } : {}),
      notes: {
        rolebolt_user_id: input.userId,
        rolebolt_category: input.category,
        rolebolt_plan: input.plan,
        rolebolt_interval: input.interval,
        rolebolt_idempotency_key: input.idempotencyKey,
      },
    },
  });
}

export async function createRazorpayPlan(input: {
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
}): Promise<RazorpayPlanResponse> {
  if (input.plan === "free") throw new Error("Razorpay plans are only created for paid plans.");
  const definition = getPlanDefinition(input.category, input.plan, input.interval);
  const period = input.interval === "monthly" ? "monthly" : "yearly";
  return razorpayRequest<RazorpayPlanResponse>("/v1/plans", {
    method: "POST",
    body: {
      period,
      interval: 1,
      item: {
        name: `Rolebolt ${input.category} ${input.plan}`,
        amount: definition.pricePaise,
        currency: "INR",
        description: `${input.interval} ${input.plan} plan for Rolebolt ${input.category}`,
      },
      notes: {
        rolebolt_catalog_id: definition.id,
        rolebolt_category: input.category,
        rolebolt_plan: input.plan,
        rolebolt_interval: input.interval,
      },
    },
  });
}

export function unixSecondsToDate(value: unknown): Date | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return undefined;
  return new Date(value * 1000);
}

export function extractSubscriptionEntity(payload: unknown): Record<string, any> | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, any>;
  const entity = root.payload?.subscription?.entity;
  return entity && typeof entity === "object" ? entity : null;
}