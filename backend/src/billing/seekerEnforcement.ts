import type express from "express";
import { createHash, randomUUID } from "node:crypto";
import {
  assertResourceLimit,
  assertWithinLimit,
  serializeBillingError,
  FeatureNotAvailableError,
  BillingAccessRestrictedError,
  BillingConfigurationError,
} from "./enforcement";
import { executeBillingOperation } from "./executeOperation";
import {
  syncSeekerResumeVersionFromProfile,
  type ResourceCounterKey,
} from "./resourceCounters";
import { UsageIdempotencyConflictError, UsageLimitError } from "./usage";
import { getEntitlement } from "./entitlements";

export const SEEKER_BILLING_CATEGORY = "seeker" as const;

export function isSeekerBillingError(error: unknown): boolean {
  return (
    error instanceof UsageLimitError ||
    error instanceof UsageIdempotencyConflictError ||
    error instanceof FeatureNotAvailableError ||
    error instanceof BillingAccessRestrictedError ||
    error instanceof BillingConfigurationError ||
    (error as { code?: string })?.code === "PLAN_LIMIT_REACHED" ||
    (error as { code?: string })?.code === "IDEMPOTENCY_KEY_REUSED" ||
    (error as { code?: string })?.code === "IDEMPOTENT_OPERATION_ALREADY_COMPLETED" ||
    (error as { code?: string })?.code === "BILLING_ACCESS_RESTRICTED"
  );
}

/** Sends a stable billing error response. Returns true if the response was sent. */
export async function respondSeekerBillingError(
  res: express.Response,
  error: unknown,
  uid: string,
): Promise<boolean> {
  if (!isSeekerBillingError(error)) return false;
  const category = (error as { category?: "seeker" | "creator_form" | "creator_standard" })?.category ?? SEEKER_BILLING_CATEGORY;
  let entitlement;
  try {
    entitlement = await getEntitlement(uid, category);
  } catch {
    // The stable error still needs to be returned if entitlement lookup itself
    // is unavailable; serializeBillingError has safe defaults.
  }
  const serialized = serializeBillingError(error, entitlement);
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

/**
 * Enforce an absolute resource count (e.g. projects/certifications array length)
 * against the seeker's plan limit. Decreasing or empty updates are always allowed.
 */
export async function assertSeekerProposedResourceCount(
  uid: string,
  counter: ResourceCounterKey,
  proposedCount: number,
): Promise<void> {
  if (!Number.isSafeInteger(proposedCount) || proposedCount < 0) {
    throw new BillingConfigurationError(`Invalid proposed count for ${counter}.`);
  }
  if (proposedCount === 0) return;
  const entitlement = await getEntitlement(uid, SEEKER_BILLING_CATEGORY);
  assertWithinLimit(entitlement, counter, proposedCount, { used: 0, reserved: 0 });
}

const ACTIVE_TRACKER_STAGES = new Set([
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
]);

export function isActiveSeekerTrackerStage(stage: string | undefined | null): boolean {
  return Boolean(stage && ACTIVE_TRACKER_STAGES.has(stage));
}

/**
 * When resume text/file changes, enforce stored version capacity and sync the
 * durable version history used by billing counters.
 */
export async function enforceAndSyncSeekerResumeVersion(input: {
  uid: string;
  previousResumeText?: string;
  previousResumeFileName?: string;
  nextResumeText?: string;
  nextResumeFileName?: string;
  source?: "profile_sync" | "upload" | "build" | "import";
}): Promise<boolean> {
  const nextText = (input.nextResumeText ?? "").trim();
  const nextFile = (input.nextResumeFileName ?? "").trim();
  const prevText = (input.previousResumeText ?? "").trim();
  const prevFile = (input.previousResumeFileName ?? "").trim();
  const hasResume = Boolean(nextText || nextFile);
  const changed = nextText !== prevText || nextFile !== prevFile;
  if (!hasResume || !changed) return false;

  // A new distinct version will be appended by sync — require capacity first.
  await assertSeekerResourceLimit(input.uid, "stored_resume_versions");
  // Active versions become exactly one after sync; ensure the plan allows ≥1 active.
  await assertSeekerProposedResourceCount(input.uid, "active_resume_versions", 1);

  await syncSeekerResumeVersionFromProfile({
    uid: input.uid,
    resumeText: nextText,
    resumeFileName: nextFile,
    source: input.source ?? "profile_sync",
  });
  return true;
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

/**
 * Request-level idempotency is opt-in. A fresh key is used when a client does
 * not send Idempotency-Key so repeated user actions (for example, re-analyze)
 * are new billable operations rather than permanent 409s. Retries can reuse
 * the header and still reserve/charge only once across the full provider chain.
 */
export function seekerRequestIdempotencyKey(
  uid: string,
  operation: string,
  requestKey?: string,
): string {
  const normalized = requestKey?.trim();
  return seekerIdempotencyKey(uid, [
    operation,
    normalized || randomUUID(),
  ]);
}

export function seekerIdempotencyHeader(req: express.Request): string | undefined {
  const value = req.headers["idempotency-key"];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}
