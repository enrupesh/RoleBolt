import mongoose, { Document, Schema } from "mongoose";
import type { BillingCategory } from "../billingTypes";

export type UsageLedgerStatus =
  | "pending"
  | "reserved"
  | "committed"
  | "released"
  | "reversed";

export interface IUsageLedger extends Document {
  userId: mongoose.Types.ObjectId;
  category: BillingCategory;
  periodKey: string;
  operation: string;
  resourceType?: string;
  resourceId?: string;
  units: number;
  quantity: number;
  counters: Record<string, number>;
  reservationId: string;
  idempotencyKey: string;
  status: UsageLedgerStatus;
  metadata: Record<string, unknown>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UsageLedgerSchema = new Schema<IUsageLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["seeker", "creator_form", "creator_standard"],
      required: true,
    },
    periodKey: { type: String, required: true, index: true },
    operation: { type: String, required: true },
    resourceType: { type: String, default: "" },
    resourceId: { type: String, default: "" },
    units: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    counters: { type: Map, of: Number, default: () => ({}) },
    reservationId: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["pending", "reserved", "committed", "released", "reversed"],
      required: true,
      default: "pending",
    },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true },
);

UsageLedgerSchema.index({ userId: 1, category: 1, periodKey: 1, createdAt: -1 });

export const UsageLedger =
  mongoose.models.UsageLedger ||
  mongoose.model<IUsageLedger>("UsageLedger", UsageLedgerSchema);