import mongoose, { Document, Schema } from "mongoose";
import type { BillingCategory } from "../billingTypes";

export type BillingAuditAction =
  | "cancel_scheduled"
  | "cancel_immediate"
  | "plan_change_requested"
  | "plan_change_cancelled"
  | "webhook_applied"
  | "webhook_ignored_stale"
  | "reconciliation_repair"
  | "reconciliation_noop"
  | "reconciliation_failed";

export interface IBillingAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  category?: BillingCategory;
  action: BillingAuditAction;
  provider: "razorpay";
  providerSubscriptionId?: string;
  actor: "user" | "webhook" | "cli" | "system";
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const BillingAuditLogSchema = new Schema<IBillingAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    category: {
      type: String,
      enum: ["seeker", "creator_form", "creator_standard"],
    },
    action: {
      type: String,
      enum: [
        "cancel_scheduled",
        "cancel_immediate",
        "plan_change_requested",
        "plan_change_cancelled",
        "webhook_applied",
        "webhook_ignored_stale",
        "reconciliation_repair",
        "reconciliation_noop",
        "reconciliation_failed",
      ],
      required: true,
      index: true,
    },
    provider: { type: String, enum: ["razorpay"], required: true, default: "razorpay" },
    providerSubscriptionId: { type: String, index: true, default: "" },
    actor: {
      type: String,
      enum: ["user", "webhook", "cli", "system"],
      required: true,
    },
    summary: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

BillingAuditLogSchema.index({ createdAt: -1 });

export const BillingAuditLog =
  mongoose.models.BillingAuditLog ||
  mongoose.model<IBillingAuditLog>("BillingAuditLog", BillingAuditLogSchema);
