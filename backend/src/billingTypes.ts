export const BILLING_CATEGORIES = [
  "seeker",
  "creator_form",
  "creator_standard",
] as const;

export type BillingCategory = (typeof BILLING_CATEGORIES)[number];

export const BILLING_PLANS = ["free", "pro", "ultra"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];
export type LegacyBillingPlan = "agency" | "seeker_pro";
export type StoredBillingPlan = BillingPlan | LegacyBillingPlan;

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type ProcessingPriority = "free" | "normal" | "priority";
export type LimitValue = number | null;
export type PlanLimits = Record<string, LimitValue>;
export type FeatureFlags = Record<string, boolean>;

export interface PlanDefinition {
  id: string;
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
  pricePaise: number;
  displayPriceInr: string;
  razorpayPlanId: string;
  limits: PlanLimits;
  featureFlags: FeatureFlags;
  processingPriority: ProcessingPriority;
  catalogVersion: number;
}

export type BillingWarning =
  | "past_due"
  | "halted"
  | "cancel_scheduled"
  | "payment_pending"
  | "plan_change_pending";

/** Thrown when past_due/halted (or similar) blocks new metered work. */
export class BillingAccessRestrictedError extends Error {
  readonly code = "BILLING_ACCESS_RESTRICTED";

  constructor(readonly category: BillingCategory) {
    super("Metered billing access is restricted for this account.");
    this.name = "BillingAccessRestrictedError";
  }
}

export function assertMeteredAccessAllowed(entitlement: {
  category: BillingCategory;
  meteredAccessAllowed: boolean;
}): void {
  if (!entitlement.meteredAccessAllowed) {
    throw new BillingAccessRestrictedError(entitlement.category);
  }
}

export interface ResolvedEntitlement {
  userId: string;
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
  status: string;
  subscriptionId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  /** When true, metered/AI operations may proceed (subject to plan limits). */
  meteredAccessAllowed: boolean;
  /** Non-blocking billing state surfaced to clients when payment needs attention. */
  billingWarning?: BillingWarning;
  /** Scheduled plan change awaiting provider confirmation (never grants access alone). */
  pendingPlan?: BillingPlan;
  pendingInterval?: BillingInterval;
  pendingChangeAt?: "now" | "cycle_end";
  definition: PlanDefinition;
}

export function isBillingCategory(value: string): value is BillingCategory {
  return (BILLING_CATEGORIES as readonly string[]).includes(value);
}

export function isBillingPlan(value: string): value is BillingPlan {
  return (BILLING_PLANS as readonly string[]).includes(value);
}

export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}