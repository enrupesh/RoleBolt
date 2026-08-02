import express from "express";
import { connectMongo } from "../db";
import { getEntitlement } from "./entitlements";
import {
  requireFeature,
  assertResourceLimit,
  serializeBillingError,
} from "./enforcement";
import type { BillingCategory } from "../billingTypes";

function uidFromRequest(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

function attachEntitlement(req: express.Request, entitlement: unknown): void {
  (req as any).billingEntitlement = entitlement;
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
      requireFeature(entitlement, featureKey);
      return next();
    } catch (error) {
      const entitlement = (req as any).billingEntitlement;
      const serialized = serializeBillingError(error, entitlement);
      return res.status(serialized.status).json(serialized.body);
    }
  };
}

export function requireBillingResourceLimit(
  category: BillingCategory,
  counterKey: Parameters<typeof assertResourceLimit>[2],
  quantity = 1,
): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const uid = uidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      await connectMongo();
      const entitlement = await getEntitlement(uid, category);
      attachEntitlement(req, entitlement);
      const result = await assertResourceLimit(uid, category, counterKey, quantity);
      return next();
    } catch (error) {
      const entitlement = (req as any).billingEntitlement;
      const serialized = serializeBillingError(error, entitlement);
      return res.status(serialized.status).json(serialized.body);
    }
  };
}