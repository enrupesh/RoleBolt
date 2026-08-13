import { apiUrl, ApiError, throwApiError, type BillingErrorPayload } from "@/lib/api";

export type BillingCategory = "seeker" | "creator_form" | "creator_standard";
export type BillingPlan = "free" | "pro" | "ultra";
export type BillingInterval = "monthly" | "yearly";
export type ProcessingPriority = "free" | "normal" | "priority";
export type BillingWarning =
  | "past_due"
  | "halted"
  | "cancel_scheduled"
  | "payment_pending"
  | "plan_change_pending";

export type PublicPlanDefinition = {
  id: string;
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
  pricePaise: number;
  displayPriceInr: string;
  limits: Record<string, number | null>;
  featureFlags: Record<string, boolean>;
  processingPriority: ProcessingPriority;
  catalogVersion: number;
};

export type BillingCatalogResponse = {
  version: number;
  currency: string;
  categories: BillingCategory[];
  plans: BillingPlan[];
  intervals: BillingInterval[];
  razorpayKeyId?: string | null;
  razorpayCheckoutConfigId?: string | null;
  plansByCategory: PublicPlanDefinition[];
};

export type CategoryEntitlement = {
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
  status: string;
  processingPriority: ProcessingPriority;
  featureFlags: Record<string, boolean>;
  cancelAtPeriodEnd: boolean;
  meteredAccessAllowed: boolean;
  billingWarning: BillingWarning | null;
  pendingPlan: BillingPlan | null;
  pendingInterval: BillingInterval | null;
  pendingChangeAt: "now" | "cycle_end" | null;
  periodStart: string;
  periodEnd: string;
  usedCounters: Record<string, number>;
  reservedCounters: Record<string, number>;
  remaining: Record<string, number | null>;
};

export type EntitlementsResponse = {
  version: number;
  entitlements: CategoryEntitlement[];
};

export const CATEGORY_LABELS: Record<BillingCategory, string> = {
  seeker: "Job Seeker",
  creator_form: "Form Jobs",
  creator_standard: "Standard Jobs",
};

export const PLAN_LABELS: Record<BillingPlan, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra Pro",
};

export const VISIBLE_COUNTERS: Record<BillingCategory, string[]> = {
  seeker: [
    "ai_units",
    "cover_letters",
    "job_fit_analyses",
    "interview_sessions",
    "workspace_items",
    "saved_jobs",
    "exports",
  ],
  creator_form: [
    "ai_units",
    "active_forms",
    "form_responses",
    "pipeline_rules",
    "copilot_turns",
    "automated_emails",
    "exports",
  ],
  creator_standard: [
    "ai_units",
    "active_jobs",
    "stored_candidates",
    "pipeline_rules",
    "copilot_turns",
    "recruiter_seats",
    "exports",
  ],
};

export function authHeaders(token: string, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(extra ?? {}),
  };
}

export function newIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function counterLabel(counter: string): string {
  return counter.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatLimit(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unlimited";
  return value.toLocaleString("en-IN");
}

export function formatInrPaise(paise: number, interval: BillingInterval): string {
  if (paise <= 0) return "₹0";
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN")}${interval === "monthly" ? "/mo" : "/yr"}`;
}

export function isUpgradeRequiredError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const payload = error.payload;
  return (
    payload.upgradeRequired === true ||
    payload.error === "PLAN_LIMIT_REACHED" ||
    payload.error === "FEATURE_NOT_AVAILABLE" ||
    payload.error === "BILLING_ACCESS_RESTRICTED" ||
    payload.code?.endsWith("_QUOTA_EXHAUSTED") === true
  );
}

export function billingErrorPayload(error: unknown): BillingErrorPayload | null {
  return error instanceof ApiError ? error.payload : null;
}

export async function fetchBillingCatalog(): Promise<BillingCatalogResponse> {
  const res = await fetch(apiUrl("/billing/catalog"));
  if (!res.ok) await throwApiError(res, "Unable to load pricing catalog.");
  return res.json();
}

export async function fetchEntitlements(
  token: string,
  category?: BillingCategory,
): Promise<EntitlementsResponse> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await fetch(apiUrl(`/billing/entitlements${query}`), {
    headers: authHeaders(token),
  });
  if (!res.ok) await throwApiError(res, "Unable to load billing entitlements.");
  return res.json();
}

export type RazorpayCheckoutPrefill = {
  name?: string;
  email?: string;
  contact?: string;
};

export async function createCheckout(
  token: string,
  input: { category: BillingCategory; plan: BillingPlan; interval: BillingInterval },
): Promise<{
  checkout: {
    status: string;
    provider: string;
    subscriptionId: string | null;
    subscriptionStatus?: string | null;
    planId?: string;
    shortUrl?: string | null;
    prefill?: RazorpayCheckoutPrefill;
    category: BillingCategory;
    plan: BillingPlan;
    interval: BillingInterval;
  };
  activation: string;
}> {
  const key = newIdempotencyKey(`checkout_${input.category}_${input.plan}_${input.interval}`);
  const res = await fetch(apiUrl("/billing/create-checkout"), {
    method: "POST",
    headers: authHeaders(token, { "Idempotency-Key": key }),
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwApiError(res, "Unable to start checkout.");
  return res.json();
}

export async function verifyCheckout(
  token: string,
  input: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
): Promise<{ verified: boolean; activation: string }> {
  const res = await fetch(apiUrl("/billing/verify-checkout"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwApiError(res, "Unable to verify checkout.");
  return res.json();
}

export async function changePlan(
  token: string,
  input: { category: BillingCategory; plan: BillingPlan; interval: BillingInterval },
): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl("/billing/change-plan"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) await throwApiError(res, "Unable to change plan.");
  return res.json();
}

export async function cancelSubscription(
  token: string,
  category: BillingCategory,
): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl("/billing/cancel-subscription"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ category }),
  });
  if (!res.ok) await throwApiError(res, "Unable to cancel subscription.");
  return res.json();
}

export async function cancelPendingPlanChange(
  token: string,
  category: BillingCategory,
): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl("/billing/cancel-pending-plan-change"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ category }),
  });
  if (!res.ok) await throwApiError(res, "Unable to cancel pending plan change.");
  return res.json();
}

export function highlightLimits(
  category: BillingCategory,
  limits: Record<string, number | null>,
): string[] {
  const keys = VISIBLE_COUNTERS[category].slice(0, 6);
  return keys.map((key) => `${counterLabel(key)}: ${formatLimit(limits[key])}`);
}

export function pricingHref(category?: BillingCategory): string {
  if (!category) return "/recruit/pricing";
  return `/recruit/pricing?category=${encodeURIComponent(category)}`;
}

export function billingHref(category?: BillingCategory, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/recruit/billing?${query}` : "/recruit/billing";
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error("Unable to load Razorpay Checkout."));
    };
    document.head.appendChild(script);
  });
  return razorpayScriptPromise;
}

function buildCheckoutPrefill(input?: RazorpayCheckoutPrefill): Record<string, string> | undefined {
  if (!input) return undefined;
  const prefill: Record<string, string> = {};
  if (input.name?.trim()) prefill.name = input.name.trim();
  if (input.email?.trim()) prefill.email = input.email.trim().toLowerCase();
  if (input.contact?.trim()) prefill.contact = input.contact.trim();
  return Object.keys(prefill).length > 0 ? prefill : undefined;
}

export async function openRazorpaySubscriptionCheckout(input: {
  keyId: string;
  subscriptionId: string;
  description: string;
  prefill?: RazorpayCheckoutPrefill;
  onSuccess: (result: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
}): Promise<void> {
  await loadRazorpayCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");

  const subscriptionId = input.subscriptionId.trim();
  const keyId = input.keyId.trim();
  if (!subscriptionId || !keyId) {
    throw new Error("Razorpay checkout is missing a subscription id or public key.");
  }

  const prefill = buildCheckoutPrefill(input.prefill);

  await new Promise<void>((resolve, reject) => {
    const checkoutOptions: Record<string, unknown> = {
      key: keyId,
      subscription_id: subscriptionId,
      name: "Rolebolt",
      description: input.description,
      theme: { color: "#0f766e" },
      ...(prefill ? { prefill } : {}),
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_subscription_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await input.onSuccess(response);
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => {
          input.onDismiss?.();
          resolve();
        },
      },
    };
    const rzp = new window.Razorpay!(checkoutOptions);
    rzp.on("payment.failed", (response: unknown) => {
      const failure = response as {
        error?: { description?: string; reason?: string };
      };
      const message = failure?.error?.description || failure?.error?.reason;
      reject(new Error(message || "Razorpay could not complete the payment."));
    });
    rzp.open();
  });
}
