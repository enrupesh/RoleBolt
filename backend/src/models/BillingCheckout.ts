import mongoose, { Document, Schema } from "mongoose";
import type { BillingCategory, BillingInterval, BillingPlan } from "../billingTypes";

export type BillingCheckoutStatus = "creating" | "created" | "verified" | "failed";

export interface IBillingCheckout extends Document {
  userId: mongoose.Types.ObjectId;
  category: BillingCategory;
  plan: BillingPlan;
  interval: BillingInterval;
  idempotencyKey: string;
  status: BillingCheckoutStatus;
  provider: "razorpay";
  providerSubscriptionId?: string;
  providerPaymentId?: string;
  providerPlanId: string;
  payloadHash?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillingCheckoutSchema = new Schema<IBillingCheckout>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["seeker", "creator_form", "creator_standard"],
      required: true,
    },
    plan: { type: String, enum: ["free", "pro", "ultra"], required: true },
    interval: { type: String, enum: ["monthly", "yearly"], required: true },
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["creating", "created", "verified", "failed"],
      required: true,
      default: "creating",
    },
    provider: { type: String, enum: ["razorpay"], required: true, default: "razorpay" },
    providerSubscriptionId: { type: String },
    providerPaymentId: { type: String },
    providerPlanId: { type: String, required: true },
    payloadHash: { type: String },
    failureReason: { type: String },
  },
  { timestamps: true },
);

BillingCheckoutSchema.index({ idempotencyKey: 1 }, { unique: true });
BillingCheckoutSchema.index({ providerSubscriptionId: 1 }, { unique: true, sparse: true });

export const BillingCheckout =
  mongoose.models.BillingCheckout ||
  mongoose.model<IBillingCheckout>("BillingCheckout", BillingCheckoutSchema);