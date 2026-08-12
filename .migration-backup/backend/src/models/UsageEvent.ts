import mongoose, { Document, Schema } from "mongoose";

export interface IUsageEvent extends Document {
  event: string;
  uid?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}

const UsageEventSchema = new Schema<IUsageEvent>(
  {
    event: { type: String, required: true, index: true },
    uid: { type: String, index: true },
    sessionId: { type: String },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UsageEventSchema.index({ createdAt: 1 });
UsageEventSchema.index({ event: 1, createdAt: 1 });

export const UsageEvent = mongoose.model<IUsageEvent>("UsageEvent", UsageEventSchema);
