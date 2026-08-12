import mongoose, { Document, Schema } from "mongoose";
import type {
  BillingCategory,
  BillingInterval,
  BillingPlan,
  StoredBillingPlan,
} from "../billingTypes";

export type SubscriptionStatus =
  | "free"
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "past_due"
  | "halted"
  | "paused"
  | "completed"
  | "cancelled"
  | "expired"
  // Transitional values retained so old records can be read safely while the
  // Stripe billing surface is removed in the Razorpay integration phase.
  | "canceled"
  | "trialing";

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  category: BillingCategory;
  plan: StoredBillingPlan;
  interval: BillingInterval;
  status: SubscriptionStatus;
  provider: "razorpay" | "stripe_legacy";
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerPlanId: string;
  providerLatestPaymentId: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  endedAt?: Date;
  lastWebhookAt?: Date;
  /** Provider event/created timestamp used to ignore out-of-order webhooks. */
  lastProviderEventAt?: Date;
  /** Scheduled plan change awaiting verified webhook confirmation. */
  pendingPlan?: BillingPlan | "";
  pendingInterval?: BillingInterval | "";
  pendingProviderPlanId?: string;
  pendingChangeAt?: "now" | "cycle_end" | "";
  createdAt: Date;
  updatedAt: Date;

  /** @deprecated Read-only migration compatibility for legacy Stripe data. */
  stripeCustomerId?: string;
  /** @deprecated Read-only migration compatibility for legacy Stripe data. */
  stripeSubscriptionId?: string;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["seeker", "creator_form", "creator_standard"],
      required: true,
      default: "creator_standard",
    },
    plan: {
      type: String,
      enum: ["free", "pro", "ultra", "agency", "seeker_pro"],
      required: true,
      default: "free",
    },
    interval: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
      default: "monthly",
    },
    status: {
      type: String,
      enum: [
        "free",
        "created",
        "authenticated",
        "active",
        "pending",
        "past_due",
        "halted",
        "paused",
        "completed",
        "cancelled",
        "expired",
        // Transitional reads for legacy records. New code must not create them.
        "canceled",
        "trialing",
      ],
      required: true,
      default: "free",
    },
    provider: {
      type: String,
      enum: ["razorpay", "stripe_legacy"],
      required: true,
      default: "razorpay",
    },
    providerCustomerId: { type: String, default: "" },
    providerSubscriptionId: { type: String, default: "" },
    providerPlanId: { type: String, default: "" },
    providerLatestPaymentId: { type: String, default: "" },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    endedAt: { type: Date },
    lastWebhookAt: { type: Date },
    lastProviderEventAt: { type: Date },
    pendingPlan: {
      type: String,
      enum: ["", "free", "pro", "ultra"],
      default: "",
    },
    pendingInterval: {
      type: String,
      enum: ["", "monthly", "yearly"],
      default: "",
    },
    pendingProviderPlanId: { type: String, default: "" },
    pendingChangeAt: {
      type: String,
      enum: ["", "now", "cycle_end"],
      default: "",
    },

    // Temporary compatibility fields. They are never consulted by the new
    // entitlement service and will be removed with the Stripe migration.
    stripeCustomerId: { type: String, default: "", select: false },
    stripeSubscriptionId: { type: String, default: "", select: false },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ userId: 1, category: 1 }, { unique: true });
SubscriptionSchema.index(
  { providerSubscriptionId: 1 },
  { unique: true, partialFilterExpression: { providerSubscriptionId: { $type: "string", $gt: "" } } },
);
SubscriptionSchema.index({ providerCustomerId: 1 });

export const Subscription =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);