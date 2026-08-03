import type { BillingCategory } from "../billingTypes";
import { assertMeteredAccessAllowed, BillingAccessRestrictedError } from "../billingTypes";
import { getEntitlement } from "./entitlements";
import { executeBillingOperation } from "./executeOperation";
import { isStandardBillingError } from "./standardEnforcement";
import { isFormBillingError } from "./formEnforcement";
import { UsageLimitError, UsageIdempotencyConflictError } from "./usage";
import {
  FeatureNotAvailableError,
  BillingConfigurationError,
} from "./enforcement";

/**
 * Phase 4 policy: evaluate entitlement at execution time.
 * Queued work after downgrade / cancel / past_due must not start new AI or email.
 */
export async function canRunMeteredBackgroundWork(
  ownerUid: string,
  category: BillingCategory,
): Promise<{ allowed: boolean; reason?: string }> {
  const uid = ownerUid.trim();
  if (!uid) return { allowed: false, reason: "missing_owner" };
  try {
    const entitlement = await getEntitlement(uid, category);
    assertMeteredAccessAllowed(entitlement);
    return { allowed: true };
  } catch (error) {
    if (error instanceof BillingAccessRestrictedError) {
      return { allowed: false, reason: "billing_access_restricted" };
    }
    console.warn(
      `[billing][background] entitlement check failed for ${category}/${uid}:`,
      (error as Error)?.message ?? error,
    );
    // Fail closed — do not run metered background work when entitlement cannot be resolved.
    return { allowed: false, reason: "entitlement_unavailable" };
  }
}

export function isBackgroundBillingBlock(error: unknown): boolean {
  return (
    isStandardBillingError(error) ||
    isFormBillingError(error) ||
    error instanceof BillingAccessRestrictedError ||
    error instanceof UsageLimitError ||
    error instanceof UsageIdempotencyConflictError ||
    error instanceof FeatureNotAvailableError ||
    error instanceof BillingConfigurationError
  );
}

export interface RunBackgroundOperationInput<T> {
  ownerUid: string;
  category: BillingCategory;
  operation: string;
  idempotencyKey: string;
  resourceType?: string;
  resourceId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
  work: () => Promise<T>;
}

/**
 * Reserve → execute → commit for cron / setImmediate paths.
 * Returns `{ ok: false }` on billing blocks instead of throwing, so crons stay resilient.
 */
export async function tryBackgroundBillingOperation<T>(
  input: RunBackgroundOperationInput<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: string; error?: unknown }> {
  const gate = await canRunMeteredBackgroundWork(input.ownerUid, input.category);
  if (!gate.allowed) {
    return { ok: false, reason: gate.reason || "billing_blocked" };
  }

  try {
    const value = await executeBillingOperation({
      category: input.category,
      ownerUid: input.ownerUid,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      quantity: input.quantity,
      metadata: input.metadata,
      work: async () => input.work(),
    });
    return { ok: true, value };
  } catch (error) {
    if (isBackgroundBillingBlock(error)) {
      return {
        ok: false,
        reason: (error as { code?: string; reasonCode?: string })?.reasonCode
          || (error as { code?: string })?.code
          || "plan_limit",
        error,
      };
    }
    throw error;
  }
}

/** Stable idempotency key for background / cron work. */
export function backgroundIdempotencyKey(ownerUid: string, parts: string[]): string {
  return `bg:${ownerUid}:${parts.join(":")}`;
}
