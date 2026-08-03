import mongoose from "mongoose";
import { getEntitlement } from "../billing/entitlements";
import { Subscription } from "../models/Subscription";
import { BillingAuditLog } from "../models/BillingAuditLog";
import { RecruitProfile } from "../models/RecruitProfile";
import { User } from "../models/User";
import {
  BILLING_CATEGORIES,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
} from "../billingTypes";

const ADMIN_GRANT_YEARS = 1;

export type AdminUserLookup = {
  uid: string;
  email: string;
  username: string;
  name: string;
  entitlements: Array<{
    category: BillingCategory;
    plan: BillingPlan;
    interval: BillingInterval;
    status: string;
    periodEnd: string | null;
    billingWarning: string | null;
  }>;
};

function toObjectId(userId: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid user id.");
  }
  return new mongoose.Types.ObjectId(userId);
}

export async function resolveAdminUser(query: string) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    const user = await User.findOne({ email }).lean();
    if (user) return user;
    const profile = await RecruitProfile.findOne({ email }).lean();
    if (profile?.uid) return User.findById(profile.uid).lean();
    return null;
  }

  const username = trimmed.toLowerCase();
  const user = await User.findOne({ username }).lean();
  if (user) return user;
  const profile = await RecruitProfile.findOne({ username }).lean();
  if (profile?.uid) return User.findById(profile.uid).lean();
  return null;
}

export async function lookupAdminUser(query: string): Promise<AdminUserLookup | null> {
  const user = await resolveAdminUser(query);
  if (!user?._id) return null;
  return lookupAdminUserById(String(user._id));
}

export async function lookupAdminUserById(userId: string): Promise<AdminUserLookup | null> {
  const user = await User.findById(userId).lean();
  if (!user?._id) return null;

  const uid = String(user._id);
  const profile = await RecruitProfile.findOne({ uid }).select("email username name").lean();
  const entitlements = await Promise.all(
    BILLING_CATEGORIES.map(async (category) => {
      const entitlement = await getEntitlement(uid, category);
      return {
        category,
        plan: entitlement.plan,
        interval: entitlement.interval,
        status: entitlement.status,
        periodEnd: entitlement.currentPeriodEnd?.toISOString() ?? null,
        billingWarning: entitlement.billingWarning ?? null,
      };
    }),
  );

  return {
    uid,
    email: String(profile?.email || user.email || "").trim(),
    username: String(profile?.username || user.username || "").trim(),
    name: String(profile?.name || user.name || "").trim(),
    entitlements,
  };
}

function adminProviderSubscriptionId(userId: string, category: BillingCategory): string {
  return `admin_grant:${userId}:${category}`;
}

function periodEndFromNow(years = ADMIN_GRANT_YEARS): Date {
  const end = new Date();
  end.setFullYear(end.getFullYear() + years);
  return end;
}

async function writeAdminAudit(args: {
  userId: string;
  category: BillingCategory;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  await BillingAuditLog.create({
    userId: toObjectId(args.userId),
    category: args.category,
    action: "reconciliation_repair",
    provider: "razorpay",
    providerSubscriptionId: adminProviderSubscriptionId(args.userId, args.category),
    actor: "cli",
    summary: args.summary,
    before: args.before,
    after: args.after,
    metadata: { source: "raka98_admin", ...args.metadata },
  });
}

export async function grantAdminPlans(args: {
  userId: string;
  categories: BillingCategory[];
  plan: BillingPlan;
  interval?: BillingInterval;
  note?: string;
}) {
  if (!["pro", "ultra"].includes(args.plan)) {
    throw new Error("Only Pro or Ultra Pro plans can be granted from admin.");
  }

  const interval = args.interval === "yearly" ? "yearly" : "monthly";
  const categories = Array.from(new Set(args.categories));
  if (categories.length === 0) {
    throw new Error("Select at least one category.");
  }

  const user = await User.findById(args.userId).lean();
  if (!user) throw new Error("User not found.");

  const now = new Date();
  const periodEnd = periodEndFromNow();
  const results: AdminUserLookup["entitlements"] = [];

  for (const category of categories) {
    const before = await getEntitlement(args.userId, category);
    const objectId = toObjectId(args.userId);

    await Subscription.findOneAndUpdate(
      { userId: objectId, category },
      {
        $set: {
          userId: objectId,
          category,
          plan: args.plan,
          interval,
          status: "active",
          provider: "razorpay",
          providerSubscriptionId: adminProviderSubscriptionId(args.userId, category),
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
      { upsert: true, new: true },
    );

    const after = await getEntitlement(args.userId, category);
    results.push({
      category,
      plan: after.plan,
      interval: after.interval,
      status: after.status,
      periodEnd: after.currentPeriodEnd?.toISOString() ?? null,
      billingWarning: after.billingWarning ?? null,
    });

    await writeAdminAudit({
      userId: args.userId,
      category,
      summary: `Admin granted ${args.plan} (${interval}) on ${category}.`,
      before: {
        plan: before.plan,
        status: before.status,
        periodEnd: before.currentPeriodEnd?.toISOString() ?? null,
      },
      after: {
        plan: after.plan,
        status: after.status,
        periodEnd: after.currentPeriodEnd?.toISOString() ?? null,
      },
      metadata: { note: args.note || "", grantType: "admin_plan_grant" },
    });
  }

  return {
    user: await lookupAdminUserById(args.userId),
    entitlements: results,
  };
}

export async function revokeAdminPlans(args: {
  userId: string;
  categories: BillingCategory[];
  note?: string;
}) {
  const categories = Array.from(new Set(args.categories));
  if (categories.length === 0) {
    throw new Error("Select at least one category.");
  }

  const user = await User.findById(args.userId).lean();
  if (!user) throw new Error("User not found.");

  const results: AdminUserLookup["entitlements"] = [];

  for (const category of categories) {
    const before = await getEntitlement(args.userId, category);
    const objectId = toObjectId(args.userId);

    await Subscription.findOneAndUpdate(
      { userId: objectId, category },
      {
        $set: {
          userId: objectId,
          category,
          plan: "free",
          interval: "monthly",
          status: "free",
          provider: "razorpay",
          providerSubscriptionId: "",
          providerCustomerId: "",
          providerPlanId: "",
          providerLatestPaymentId: "",
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
          cancelAtPeriodEnd: false,
          cancelledAt: undefined,
          endedAt: undefined,
          pendingPlan: "",
          pendingInterval: "",
          pendingProviderPlanId: "",
          pendingChangeAt: "",
        },
      },
      { upsert: true, new: true },
    );

    const after = await getEntitlement(args.userId, category);
    results.push({
      category,
      plan: after.plan,
      interval: after.interval,
      status: after.status,
      periodEnd: after.currentPeriodEnd?.toISOString() ?? null,
      billingWarning: after.billingWarning ?? null,
    });

    await writeAdminAudit({
      userId: args.userId,
      category,
      summary: `Admin revoked paid plan on ${category} (reset to Free).`,
      before: {
        plan: before.plan,
        status: before.status,
        periodEnd: before.currentPeriodEnd?.toISOString() ?? null,
      },
      after: {
        plan: after.plan,
        status: after.status,
        periodEnd: after.currentPeriodEnd?.toISOString() ?? null,
      },
      metadata: { note: args.note || "", grantType: "admin_plan_revoke" },
    });
  }

  return {
    user: await lookupAdminUserById(args.userId),
    entitlements: results,
  };
}
