import express from "express";
import { connectMongo } from "../db";
import { getEntitlement } from "./entitlements";
import {
  requireFeature,
  assertResourceLimit,
  serializeBillingError,
} from "./enforcement";
import { assertMeteredAccessAllowed } from "../billingTypes";
import { resolveBillingOwner, type BillingOwnerResource } from "./billingOwner";
import { getBillingOperation } from "./operationCatalog";
import { reserveUsage, type UsageReservation } from "./usage";
import type { BillingCategory } from "../billingTypes";

export interface BillingRequestState {
  billingEntitlement?: Awaited<ReturnType<typeof getEntitlement>>;
  billingOwnerUid?: string;
  billingReservation?: UsageReservation;
}

function uidFromRequest(req: express.Request): string {
  return (req as express.Request & BillingRequestState).billingOwnerUid
    ?? (req as express.Request & { user?: { uid?: string } }).user?.uid
    ?? "";
}

function attachEntitlement(req: express.Request, entitlement: unknown): void {
  (req as express.Request & BillingRequestState).billingEntitlement = entitlement as BillingRequestState["billingEntitlement"];
}

function attachOwner(req: express.Request, ownerUid: string): void {
  (req as express.Request & BillingRequestState).billingOwnerUid = ownerUid;
}

function attachReservation(req: express.Request, reservation: UsageReservation): void {
  (req as express.Request & BillingRequestState).billingReservation = reservation;
}

export function requireBillingEntitlement(category: BillingCategory): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const uid = uidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      await connectMongo();
      const entitlement = await getEntitlement(uid, category);
      attachEntitlement(req, entitlement);
      return next();
    } catch (error) {
      const serialized = serializeBillingError(error);
      return res.status(serialized.status).json(serialized.body);
    }
  };
}

export function requireBillingFeature(
  category: BillingCategory,
  featureKey: string,
): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const uid = uidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      await connectMongo();
      const entitlement = await getEntitlement(uid, category);
      attachEntitlement(req, entitlement);
      assertMeteredAccessAllowed(entitlement);
      requireFeature(entitlement, featureKey);
      return next();
    } catch (error) {
      const entitlement = (req as express.Request & BillingRequestState).billingEntitlement;
      const serialized = serializeBillingError(error, entitlement);
      return res.status(serialized.status).json(serialized.body);
    }
  };
}

export function requireBillingResourceLimit(
  category: BillingCategory,
  counterKey: Parameters<typeof assertResourceLimit>[2],
  quantity = 1,
  resolveResource?: (req: express.Request) => BillingOwnerResource | null | undefined,
): express.RequestHandler {
  return async (req, res, next) => {
    try {
      await connectMongo();
      const ownerUid = resolveResource
        ? resolveBillingOwner(req, resolveResource(req))
        : uidFromRequest(req);
      if (!ownerUid) return res.status(401).json({ error: "Unauthorized" });
      attachOwner(req, ownerUid);
      const entitlement = await getEntitlement(ownerUid, category);
      attachEntitlement(req, entitlement);
      await assertResourceLimit(ownerUid, category, counterKey, quantity);
      return next();
    } catch (error) {
      const entitlement = (req as express.Request & BillingRequestState).billingEntitlement;
      const serialized = serializeBillingError(error, entitlement);
      return res.status(serialized.status).json(serialized.body);
    }
  };
}

export interface UsageReservationMiddlewareOptions {
  category: BillingCategory;
  operation: string;
  quantity?: number;
  resolveResource?: (req: express.Request) => BillingOwnerResource | null | undefined;
  idempotencyKey?: (req: express.Request) => string;
  resourceType?: (req: express.Request) => string | undefined;
  resourceId?: (req: express.Request) => string | undefined;
}

/**
 * Reserves usage quota before the route handler runs. The handler must call
 * `commitBillingReservation(req)` on success or `releaseBillingReservation(req)` on definite failure.
 */
export function requireUsageReservation(
  options: UsageReservationMiddlewareOptions,
): express.RequestHandler {
  return async (req, res, next) => {
    try {
      await connectMongo();
      const resource = options.resolveResource?.(req);
      const ownerUid = resolveBillingOwner(req, resource);
      if (!ownerUid) return res.status(401).json({ error: "Unauthorized" });
      attachOwner(req, ownerUid);

      const entitlement = await getEntitlement(ownerUid, options.category);
      attachEntitlement(req, entitlement);
      assertMeteredAccessAllowed(entitlement);

      const operation = getBillingOperation(options.operation);
      if (operation.category !== options.category) {
        throw new Error(`Operation ${options.operation} is not valid for ${options.category}.`);
      }

      const idempotencyKey = options.idempotencyKey?.(req)?.trim()
        ?? `${ownerUid}:${options.operation}:${req.method}:${req.path}:${Date.now()}`;
      if (!idempotencyKey) {
        return res.status(400).json({ error: "An idempotency key is required for this operation." });
      }

      const reservation = await reserveUsage({
        userId: ownerUid,
        category: options.category,
        operation: options.operation,
        idempotencyKey,
        quantity: options.quantity,
        resourceType: options.resourceType?.(req),
        resourceId: options.resourceId?.(req),
      });
      attachReservation(req, reservation);
      return next();
    } catch (error) {
      const entitlement = (req as express.Request & BillingRequestState).billingEntitlement;
      const serialized = serializeBillingError(error, entitlement);
      return res.status(serialized.status).json(serialized.body);
    }
  };
}

export async function commitBillingReservation(req: express.Request): Promise<void> {
  const reservation = (req as express.Request & BillingRequestState).billingReservation;
  if (!reservation || reservation.status !== "reserved") return;
  const { commitUsage } = await import("./usage.js");
  await commitUsage(reservation.reservationId);
  reservation.status = "committed";
}

export async function releaseBillingReservation(req: express.Request): Promise<void> {
  const reservation = (req as express.Request & BillingRequestState).billingReservation;
  if (!reservation || reservation.status !== "reserved") return;
  const { releaseUsage } = await import("./usage.js");
  await releaseUsage(reservation.reservationId);
  reservation.status = "released";
}
