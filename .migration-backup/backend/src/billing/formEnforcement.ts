import type express from "express";
import { createHash, randomUUID } from "node:crypto";
import {
  assertResourceLimit,
  assertWithinLimit,
  requireFeature,
  serializeBillingError,
  FeatureNotAvailableError,
  BillingAccessRestrictedError,
  BillingConfigurationError,
} from "./enforcement";
import { executeBillingOperation } from "./executeOperation";
import { getEntitlement } from "./entitlements";
import type { ResourceCounterKey } from "./resourceCounters";
import { UsageIdempotencyConflictError, UsageLimitError } from "./usage";
import type { ResolvedEntitlement } from "../billingTypes";

export const FORM_BILLING_CATEGORY = "creator_form" as const;

export function isFormBillingError(error: unknown): boolean {
  return (
    error instanceof UsageLimitError ||
    error instanceof UsageIdempotencyConflictError ||
    error instanceof FeatureNotAvailableError ||
    error instanceof BillingAccessRestrictedError ||
    error instanceof BillingConfigurationError ||
    (error as { code?: string })?.code === "PLAN_LIMIT_REACHED" ||
    (error as { code?: string })?.code === "IDEMPOTENCY_KEY_REUSED" ||
    (error as { code?: string })?.code === "IDEMPOTENT_OPERATION_ALREADY_COMPLETED" ||
    (error as { code?: string })?.code === "BILLING_ACCESS_RESTRICTED" ||
    (error as { code?: string })?.code === "FEATURE_NOT_AVAILABLE"
  );
}

/** Sends a stable billing error for Form Jobs routes. Returns true if handled. */
export async function respondFormBillingError(
  res: express.Response,
  error: unknown,
  ownerUid: string,
): Promise<boolean> {
  if (!isFormBillingError(error)) return false;
  let entitlement: ResolvedEntitlement | undefined;
  try {
    entitlement = await getEntitlement(ownerUid, FORM_BILLING_CATEGORY);
  } catch {
    // serializeBillingError has safe defaults when entitlement is missing
  }
  const serialized = serializeBillingError(error, entitlement);
  // Public capacity messages should be clear without leaking owner plan internals excessively.
  if (serialized.body.error === "PLAN_LIMIT_REACHED" && serialized.body.feature === "form_responses") {
    serialized.body.message =
      "This form is not accepting more responses right now. Please try again later or contact the employer.";
  }
  res.status(serialized.status).json(serialized.body);
  return true;
}

export async function assertFormResourceLimit(
  ownerUid: string,
  counter: ResourceCounterKey,
  quantity = 1,
) {
  return assertResourceLimit(ownerUid, FORM_BILLING_CATEGORY, counter, quantity);
}

export async function assertFormFeature(ownerUid: string, featureKey: string): Promise<ResolvedEntitlement> {
  const entitlement = await getEntitlement(ownerUid, FORM_BILLING_CATEGORY);
  requireFeature(entitlement, featureKey);
  return entitlement;
}

/**
 * Enforce plan `bulk_action_size` for a batch. Call before processing multi-item actions.
 * When no bulk Form Jobs routes exist yet, this helper is the Phase 2 contract for future wiring.
 */
export async function assertFormBulkActionSize(ownerUid: string, batchSize: number): Promise<void> {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new BillingConfigurationError("Bulk action size must be a positive integer.");
  }
  const entitlement = await getEntitlement(ownerUid, FORM_BILLING_CATEGORY);
  const limit = entitlement.definition.limits.bulk_action_size;
  if (typeof limit === "number" && batchSize > limit) {
    throw new UsageLimitError({
      reasonCode: "BULK_ACTION_SIZE_QUOTA_EXHAUSTED",
      category: FORM_BILLING_CATEGORY,
      feature: "bulk_action_size",
      used: batchSize,
      limit,
    });
  }
  assertWithinLimit(entitlement, "bulk_action_size", 1, { used: 0, reserved: 0 });
}

export interface RunFormOperationInput<T> {
  ownerUid: string;
  operation: string;
  idempotencyKey: string;
  resourceType?: string;
  resourceId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
  work: () => Promise<T>;
}

export async function runFormBillingOperation<T>(
  input: RunFormOperationInput<T>,
): Promise<T> {
  return executeBillingOperation({
    category: FORM_BILLING_CATEGORY,
    ownerUid: input.ownerUid,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    quantity: input.quantity,
    metadata: input.metadata,
    work: async () => input.work(),
  });
}

export function formIdempotencyKey(ownerUid: string, parts: string[]): string {
  return `form:${ownerUid}:${parts.join(":")}`;
}

export function formContentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function formRequestIdempotencyKey(
  ownerUid: string,
  operation: string,
  requestKey?: string,
): string {
  const normalized = requestKey?.trim();
  return formIdempotencyKey(ownerUid, [operation, normalized || randomUUID()]);
}

export function formIdempotencyHeader(req: express.Request): string | undefined {
  const value = req.headers["idempotency-key"];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/** Resolve the Form Jobs billing owner — always the form's `uid`, never a collaborator. */
export function formBillingOwnerUid(form: { uid?: string } | null | undefined): string {
  return (form?.uid ?? "").trim();
}
