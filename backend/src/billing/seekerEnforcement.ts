import type express from "express";
import { createHash } from "node:crypto";
import { assertResourceLimit, serializeBillingError } from "./enforcement";
import { executeBillingOperation } from "./executeOperation";
import type { ResourceCounterKey } from "./resourceCounters";
import { UsageLimitError } from "./usage";
import { FeatureNotAvailableError, BillingAccessRestrictedError, BillingConfigurationError } from "./enforcement";

export const SEEKER_BILLING_CATEGORY = "seeker" as const;

export function isSeekerBillingError(error: unknown): boolean {
  return (
    error instanceof UsageLimitError ||
    error instanceof FeatureNotAvailableError ||
    error instanceof BillingAccessRestrictedError ||
    error instanceof BillingConfigurationError ||
    (error as { code?: string })?.code === "PLAN_LIMIT_REACHED" ||
    (error as { code?: string })?.code === "IDEMPOTENCY_KEY_REUSED"
  );
}

/** Sends a stable billing error response. Returns true if the response was sent. */
export function respondSeekerBillingError(
  res: express.Response,
  error: unknown,
): boolean {
  if (!isSeekerBillingError(error)) return false;
  const serialized = serializeBillingError(error);
  res.status(serialized.status).json(serialized.body);
  return true;
}

export async function assertSeekerResourceLimit(
  uid: string,
  counter: ResourceCounterKey,
  quantity = 1,
) {
  return assertResourceLimit(uid, SEEKER_BILLING_CATEGORY, counter, quantity);
}

export interface RunSeekerOperationInput<T> {
  uid: string;
  operation: string;
  idempotencyKey: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  work: () => Promise<T>;
}

export async function runSeekerBillingOperation<T>(
  input: RunSeekerOperationInput<T>,
): Promise<T> {
  return executeBillingOperation({
    category: SEEKER_BILLING_CATEGORY,
    ownerUid: input.uid,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata,
    work: async () => input.work(),
  });
}

export function seekerIdempotencyKey(uid: string, parts: string[]): string {
  return `seeker:${uid}:${parts.join(":")}`;
}

export function seekerContentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
