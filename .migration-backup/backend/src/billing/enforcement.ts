import { UsagePeriod } from "../models/UsagePeriod";
import { getEntitlement } from "./entitlements";
import { getPeriodWindow } from "./periods";
import { UsageIdempotencyConflictError, UsageLimitError } from "./usage";
import { countOwnedResources, type ResourceCounterKey } from "./resourceCounters";
import {
  assertMeteredAccessAllowed,
  BillingAccessRestrictedError,
  type BillingCategory,
  type ResolvedEntitlement,
} from "../billingTypes";

export { assertMeteredAccessAllowed, BillingAccessRestrictedError };

export class FeatureNotAvailableError extends Error {
  readonly code = "FEATURE_NOT_AVAILABLE";

  constructor(
    readonly category: BillingCategory,
    readonly feature: string,
  ) {
    super(`The ${feature} feature is not available for this plan.`);
    this.name = "FeatureNotAvailableError";
  }
}

export class BillingConfigurationError extends Error {
  readonly code = "BILLING_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "BillingConfigurationError";
  }
}

export interface CounterSnapshot {
  used: number;
  reserved: number;
}

export function requireFeature(
  entitlement: ResolvedEntitlement,
  featureKey: string,
): void {
  if (entitlement.definition.featureFlags[featureKey] !== true) {
    throw new FeatureNotAvailableError(entitlement.category, featureKey);
  }
}

export function assertWithinLimit(
  entitlement: ResolvedEntitlement,
  counterKey: string,
  quantity = 1,
  snapshot: CounterSnapshot = { used: 0, reserved: 0 },
): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new BillingConfigurationError("Limit quantity must be a positive integer.");
  }
  const limit = entitlement.definition.limits[counterKey];
  if (limit === undefined) {
    throw new BillingConfigurationError(
      `Counter ${counterKey} is not defined for ${entitlement.category}/${entitlement.plan}.`,
    );
  }
  if (limit === null) return;
  if (
    !Number.isSafeInteger(snapshot.used) ||
    snapshot.used < 0 ||
    !Number.isSafeInteger(snapshot.reserved) ||
    snapshot.reserved < 0
  ) {
    throw new BillingConfigurationError(`Invalid usage snapshot for ${counterKey}.`);
  }
  if (snapshot.used + snapshot.reserved + quantity > limit) {
    throw new UsageLimitError({
      reasonCode: `${counterKey.toUpperCase()}_QUOTA_EXHAUSTED`,
      category: entitlement.category,
      feature: counterKey,
      used: snapshot.used + snapshot.reserved,
      limit,
    });
  }
}

async function currentUsageSnapshot(
  entitlement: ResolvedEntitlement,
  counterKey: string,
): Promise<CounterSnapshot> {
  const period = getPeriodWindow(
    entitlement.interval,
    new Date(),
    entitlement.currentPeriodStart,
    entitlement.currentPeriodEnd,
  );
  const usage = await UsagePeriod.findOne({
    userId: entitlement.userId,
    category: entitlement.category,
    periodKey: period.periodKey,
  }).lean().exec();
  const usedCounters = usage?.usedCounters;
  const reservedCounters = usage?.reservedCounters;
  const read = (source: unknown): number => {
    if (source instanceof Map) {
      const value = source.get(counterKey);
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    }
    if (source && typeof source === "object") {
      const value = (source as Record<string, unknown>)[counterKey];
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    }
    return 0;
  };
  return { used: read(usedCounters), reserved: read(reservedCounters) };
}

export async function assertUsageLimit(
  entitlement: ResolvedEntitlement,
  counterKey: string,
  quantity = 1,
): Promise<void> {
  assertWithinLimit(
    entitlement,
    counterKey,
    quantity,
    await currentUsageSnapshot(entitlement, counterKey),
  );
}

export async function assertResourceLimit(
  uid: string,
  category: BillingCategory,
  counterKey: ResourceCounterKey,
  quantity = 1,
): Promise<{ entitlement: ResolvedEntitlement; current: number; limit: number | null }> {
  const entitlement = await getEntitlement(uid, category);
  const current = await countOwnedResources(uid, category, counterKey);
  const limit = entitlement.definition.limits[counterKey];
  assertWithinLimit(entitlement, counterKey, quantity, { used: current, reserved: 0 });
  return { entitlement, current, limit: limit ?? null };
}

export function serializeBillingError(
  error: unknown,
  entitlement?: ResolvedEntitlement,
): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof UsageLimitError) {
    return {
      status: 409,
      body: {
        error: "PLAN_LIMIT_REACHED",
        code: error.reasonCode,
        category: error.category,
        feature: error.feature,
        plan: entitlement?.plan ?? "free",
        used: error.used,
        limit: error.limit,
        resetAt: entitlement?.currentPeriodEnd?.toISOString(),
        upgradeRequired: (entitlement?.plan ?? "free") === "free",
      },
    };
  }
  if (error instanceof UsageIdempotencyConflictError) {
    return {
      status: 409,
      body: {
        error: "IDEMPOTENCY_KEY_REUSED",
        code: error.code,
        message: "This request key was already used for a different operation.",
        upgradeRequired: false,
      },
    };
  }
  if (error instanceof FeatureNotAvailableError) {
    return {
      status: 403,
      body: {
        error: "FEATURE_NOT_AVAILABLE",
        code: error.code,
        category: error.category,
        feature: error.feature,
        plan: entitlement?.plan ?? "free",
        upgradeRequired: true,
      },
    };
  }
  if (error instanceof BillingAccessRestrictedError) {
    return {
      status: 403,
      body: {
        error: "BILLING_ACCESS_RESTRICTED",
        code: error.code,
        category: error.category,
        plan: entitlement?.plan ?? "free",
        upgradeRequired: false,
      },
    };
  }
  if (error instanceof BillingConfigurationError) {
    return {
      status: 500,
      body: { error: error.code, message: "Billing configuration is incomplete." },
    };
  }
  if ((error as { code?: string })?.code === "IDEMPOTENT_OPERATION_ALREADY_COMPLETED") {
    return {
      status: 409,
      body: {
        error: "IDEMPOTENT_OPERATION_ALREADY_COMPLETED",
        code: "IDEMPOTENT_OPERATION_ALREADY_COMPLETED",
        category: entitlement?.category,
        plan: entitlement?.plan ?? "free",
        message: "This request was already completed. Submit a new change to run it again.",
        upgradeRequired: false,
      },
    };
  }
  return {
    status: 500,
    body: { error: "BILLING_ENFORCEMENT_ERROR", message: "Billing enforcement failed." },
  };
}