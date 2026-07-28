import { Request, Response, NextFunction } from "express";
import { connectMongo } from "../db";
import { Subscription } from "../models/Subscription";

export type Plan = "free" | "pro" | "agency" | "seeker_pro";

const PLAN_ORDER: Plan[] = ["free", "pro", "agency"];

/** Get the effective plan for a user (defaults to "free" if no active subscription) */
export async function getEffectivePlan(userId: string): Promise<Plan> {
  try {
    await connectMongo();
    const sub = await Subscription.findOne({ userId }).lean() as any;
    if (!sub) return "free";
    if (sub.status === "active" || sub.status === "trialing") return sub.plan;
    return "free";
  } catch {
    return "free";
  }
}

/** Middleware factory — rejects with 403 upgrade_required if user is below minPlan */
export function requirePlan(minPlan: "pro" | "agency") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?._id?.toString() ?? (req as any).user?.id?.toString();
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const plan = await getEffectivePlan(userId);
      const userIdx = PLAN_ORDER.indexOf(plan as Plan);
      const requiredIdx = PLAN_ORDER.indexOf(minPlan);
      if (userIdx >= requiredIdx) return next();
      return res.status(403).json({
        error: "upgrade_required",
        requiredPlan: minPlan,
        currentPlan: plan,
        message: `This feature requires the ${minPlan.charAt(0).toUpperCase() + minPlan.slice(1)} plan.`,
      });
    } catch (err) {
      return next(); // on error, allow through rather than block
    }
  };
}
