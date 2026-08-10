import mongoose, { Document, Schema } from "mongoose";

export type BillingEventStatus = "received" | "processed" | "ignored" | "failed";

export interface IBillingEvent extends Document {
  provider: "razorpay";
  providerEventId: string;
  eventType: string;
  status: BillingEventStatus;
  payloadHash: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillingEventSchema = new Schema<IBillingEvent>(
  {
    provider: { type: String, enum: ["razorpay"], required: true },
    providerEventId: { type: String, required: true },
    eventType: { type: String, required: true },
    status: {
      type: String,
      enum: ["received", "processed", "ignored", "failed"],
      required: true,
      default: "received",
    },
    payloadHash: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date },
    error: { type: String, default: "" },
  },
  { timestamps: true },
);

BillingEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
BillingEventSchema.index({ status: 1, createdAt: -1 });

export const BillingEvent =
  mongoose.models.BillingEvent ||
  mongoose.model<IBillingEvent>("BillingEvent", BillingEventSchema);