import mongoose from "mongoose";
import { isJudgeReviewerEmail } from "../judgeReviewer";
import { Subscription } from "../models/Subscription";
import {
  BILLING_CATEGORIES,
  type BillingCategory,
} from "../billingTypes";

const JUDGE_GRANT_YEARS = 1;

function judgeProviderSubscriptionId(userId: string, category: BillingCategory): string {
  return `judge_grant:${userId}:${category}`;
}

function periodEndFromNow(): Date {
  const end = new Date();
  end.setFullYear(end.getFullYear() + JUDGE_GRANT_YEARS);
  return end;
}

/**
 * Grants Ultra (yearly) on every billing category for the hackathon judge account.
 * Idempotent — safe to call on login and /auth/me.
 */
export async function ensureJudgeReviewerEntitlements(
  userId: string,
  email?: unknown,
): Promise<void> {
  if (!isJudgeReviewerEmail(email)) return;
  if (!mongoose.isValidObjectId(userId)) return;

  const objectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const periodEnd = periodEndFromNow();

  await Promise.all(
    BILLING_CATEGORIES.map((category) =>
      Subscription.findOneAndUpdate(
        { userId: objectId, category },
        {
          $set: {
            userId: objectId,
            category,
            plan: "ultra",
            interval: "yearly",
            status: "active",
            provider: "razorpay",
            providerSubscriptionId: judgeProviderSubscriptionId(userId, category),
            providerCustomerId: "",
            providerPlanId: "",
            providerLatestPaymentId: "",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            cancelledAt: undefined,
            endedAt: undefined,
            pendingPlan: "",
            pendingInterval: "",
            pendingProviderPlanId: "",
            pendingChangeAt: "",
          },
        },
        { upsert: true },
      ).exec(),
    ),
  );
}
