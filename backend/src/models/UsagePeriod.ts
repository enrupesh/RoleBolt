import mongoose, { Document, Schema } from "mongoose";
import type { BillingCategory, BillingInterval, BillingPlan, PlanLimits } from "../billingTypes";

export interface IUsagePeriod extends Document {
  userId: mongoose.Types.ObjectId;
  category: BillingCategory;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  planSnapshot: {
    plan: BillingPlan;
    interval: BillingInterval;
    catalogVersion: number;
  };
  limitsSnapshot: PlanLimits;
  usedCounters: Record<string, number>;
  reservedCounters: Record<string, number>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const UsagePeriodSchema = new Schema<IUsagePeriod>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["seeker", "creator_form", "creator_standard"],
      required: true,
    },
    periodKey: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    planSnapshot: {
      plan: { type: String, enum: ["free", "pro", "ultra"], required: true },
      interval: { type: String, enum: ["monthly", "yearly"], required: true },
      catalogVersion: { type: Number, required: true },
    },
    limitsSnapshot: { type: Map, of: Schema.Types.Mixed, required: true },
    usedCounters: { type: Map, of: Number, default: () => ({}) },
    reservedCounters: { type: Map, of: Number, default: () => ({}) },
    version: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true },
);

UsagePeriodSchema.index({ userId: 1, category: 1, periodKey: 1 }, { unique: true });

export const UsagePeriod =
  mongoose.models.UsagePeriod ||
  mongoose.model<IUsagePeriod>("UsagePeriod", UsagePeriodSchema);