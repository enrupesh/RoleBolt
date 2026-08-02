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
  notes?: Record<string, string>;
}

export interface RazorpayPlanResponse {
  id: string;
  item?: { name?: string; amount?: number; currency?: string; description?: string };
  period?: string;
  interval?: number;
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
  init: { method: "GET" | "POST"; body?: Record<string, unknown> },
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
}): Promise<RazorpaySubscriptionResponse> {
  const planId = getConfiguredRazorpayPlanId(input.category, input.plan, input.interval);
  return razorpayRequest<RazorpaySubscriptionResponse>("/v1/subscriptions", {
    method: "POST",
    body: {
      plan_id: planId,
      quantity: 1,
      customer_notify: true,
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