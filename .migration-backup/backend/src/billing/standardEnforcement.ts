import type express from "express";
import { createHash, randomUUID } from "node:crypto";
import {
  assertResourceLimit,
  assertWithinLimit,
  assertUsageLimit,
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

export const STANDARD_BILLING_CATEGORY = "creator_standard" as const;

export function isStandardBillingError(error: unknown): boolean {
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

/** Sends a stable billing error for Standard Jobs routes. Returns true if handled. */
export async function respondStandardBillingError(
  res: express.Response,
  error: unknown,
  ownerUid: string,
): Promise<boolean> {
  if (!isStandardBillingError(error)) return false;
  let entitlement: ResolvedEntitlement | undefined;
  try {
    entitlement = await getEntitlement(ownerUid, STANDARD_BILLING_CATEGORY);
  } catch {
    // serializeBillingError has safe defaults when entitlement is missing
  }
  const serialized = serializeBillingError(error, entitlement);
  if (serialized.body.error === "PLAN_LIMIT_REACHED" && serialized.body.feature === "new_candidates") {
    serialized.body.message =
      "This job is not accepting more applications right now. Please try again later or contact the employer.";
  }
  res.status(serialized.status).json(serialized.body);
  return true;
}

export async function assertStandardResourceLimit(
  ownerUid: string,
  counter: ResourceCounterKey,
  quantity = 1,
) {
  return assertResourceLimit(ownerUid, STANDARD_BILLING_CATEGORY, counter, quantity);
}

export async function assertStandardFeature(
  ownerUid: string,
  featureKey: string,
): Promise<ResolvedEntitlement> {
  const entitlement = await getEntitlement(ownerUid, STANDARD_BILLING_CATEGORY);
  requireFeature(entitlement, featureKey);
  return entitlement;
}

/** Enforce plan `bulk_action_size` for a multi-candidate batch. */
export async function assertStandardBulkActionSize(
  ownerUid: string,
  batchSize: number,
): Promise<void> {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new BillingConfigurationError("Bulk action size must be a positive integer.");
  }
  const entitlement = await getEntitlement(ownerUid, STANDARD_BILLING_CATEGORY);
  const limit = entitlement.definition.limits.bulk_action_size;
  if (typeof limit === "number" && batchSize > limit) {
    throw new UsageLimitError({
      reasonCode: "BULK_ACTION_SIZE_QUOTA_EXHAUSTED",
      category: STANDARD_BILLING_CATEGORY,
      feature: "bulk_action_size",
      used: batchSize,
      limit,
    });
  }
  assertWithinLimit(entitlement, "bulk_action_size", 1, { used: 0, reserved: 0 });
}

/**
 * Ensure a bulk resume import batch fits remaining `bulk_import_files` quota
 * (Free: 3 files/period) before SSE starts.
 */
export async function assertStandardBulkImportFileCount(
  ownerUid: string,
  fileCount: number,
): Promise<void> {
  if (!Number.isSafeInteger(fileCount) || fileCount <= 0) {
    throw new BillingConfigurationError("Bulk import file count must be a positive integer.");
  }
  const entitlement = await getEntitlement(ownerUid, STANDARD_BILLING_CATEGORY);
  await assertUsageLimit(entitlement, "bulk_import_files", fileCount);
}

export interface RunStandardOperationInput<T> {
  ownerUid: string;
  operation: string;
  idempotencyKey: string;
  resourceType?: string;
  resourceId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
  work: () => Promise<T>;
}

export async function runStandardBillingOperation<T>(
  input: RunStandardOperationInput<T>,
): Promise<T> {
  return executeBillingOperation({
    category: STANDARD_BILLING_CATEGORY,
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

export function standardIdempotencyKey(ownerUid: string, parts: string[]): string {
  return `standard:${ownerUid}:${parts.join(":")}`;
}

export function standardContentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function standardRequestIdempotencyKey(
  ownerUid: string,
  operation: string,
  requestKey?: string,
): string {
  const normalized = requestKey?.trim();
  return standardIdempotencyKey(ownerUid, [operation, normalized || randomUUID()]);
}

export function standardIdempotencyHeader(req: express.Request): string | undefined {
  const value = req.headers["idempotency-key"];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/**
 * Resolve Standard Jobs billing owner — always the job owner (`job.uid`),
 * never a collaborator acting on the job.
 */
export function standardBillingOwnerUid(
  job: { uid?: string; ownerUid?: string } | null | undefined,
): string {
  return (job?.ownerUid ?? job?.uid ?? "").trim();
}
