import type express from "express";
import type { BillingCategory } from "../billingTypes";
import { getEntitlement } from "./entitlements";
import { serializeBillingError } from "./enforcement";
import { assertMeteredAccessAllowed } from "../billingTypes";
import { requireBillingOwnerUid, type BillingOwnerResource } from "./billingOwner";
import {
  commitUsage,
  releaseUsage,
  reserveUsage,
  type UsageReservation,
} from "./usage";
import { safeBillingLog } from "./security";

export class BillingOperationAbortedError extends Error {
  readonly code = "BILLING_OPERATION_ABORTED";

  constructor(message = "Billing operation was aborted before provider work ran.") {
    super(message);
    this.name = "BillingOperationAbortedError";
  }
}

export class IdempotentOperationAlreadyCompletedError extends Error {
  readonly code = "IDEMPOTENT_OPERATION_ALREADY_COMPLETED";

  constructor(readonly reservation: UsageReservation) {
    super("This billing operation was already committed for the supplied idempotency key.");
    this.name = "IdempotentOperationAlreadyCompletedError";
  }
}

export interface ExecuteBillingOperationInput<T> {
  req?: express.Request;
  category: BillingCategory;
  operation: string;
  ownerUid?: string;
  resource?: BillingOwnerResource | null;
  idempotencyKey: string;
  resourceType?: string;
  resourceId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
  /**
   * When false, the reservation is kept for support audit (ambiguous provider failure).
   * Default: release on failure unless the error is marked ambiguous.
   */
  releaseOnFailure?: (error: unknown) => boolean;
  work: (reservation: UsageReservation) => Promise<T>;
}

function defaultReleaseOnFailure(error: unknown): boolean {
  if (error instanceof BillingOperationAbortedError) return true;
  const code = (error as { code?: string })?.code;
  if (code === "PLAN_LIMIT_REACHED" || code === "FEATURE_NOT_AVAILABLE") return true;
  if (code === "IDEMPOTENCY_KEY_REUSED") return true;
  // Provider/network ambiguity: retain reservation per payment.md §5.2
  return false;
}

/**
 * Standard reserve → execute → commit/release wrapper for metered AI and period operations.
 */
export async function executeBillingOperation<T>(
  input: ExecuteBillingOperationInput<T>,
): Promise<T> {
  const ownerUid = input.ownerUid?.trim()
    ?? (input.req ? requireBillingOwnerUid(input.req, input.resource) : "");
  if (!ownerUid) throw new Error("Billing owner UID is required.");

  const entitlement = await getEntitlement(ownerUid, input.category);
  assertMeteredAccessAllowed(entitlement);

  const reservation = await reserveUsage({
    userId: ownerUid,
    category: input.category,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    quantity: input.quantity,
    metadata: input.metadata,
  });

  if (reservation.status === "committed") {
    throw new IdempotentOperationAlreadyCompletedError(reservation);
  }
  if (reservation.status === "released") {
    throw new BillingOperationAbortedError("A prior attempt for this idempotency key was released.");
  }

  try {
    const result = await input.work(reservation);
    if (reservation.status === "reserved") {
      await commitUsage(reservation.reservationId);
    }
    return result;
  } catch (error) {
    const shouldRelease = input.releaseOnFailure ?? defaultReleaseOnFailure;
    if (shouldRelease(error)) {
      try {
        await releaseUsage(reservation.reservationId);
      } catch (releaseError) {
        safeBillingLog("error", "release_usage_failed", {
          reservationId: reservation.reservationId,
          operation: input.operation,
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        });
      }
    } else {
      safeBillingLog("warn", "reservation_retained_ambiguous_failure", {
        reservationId: reservation.reservationId,
        operation: input.operation,
        error: (error as Error)?.message,
      });
    }
    throw error;
  }
}

export function billingOperationErrorResponse(
  error: unknown,
  entitlement?: Awaited<ReturnType<typeof getEntitlement>>,
): { status: number; body: Record<string, unknown> } {
  return serializeBillingError(error, entitlement);
}
