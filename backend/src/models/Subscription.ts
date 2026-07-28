import mongoose, { Document, Schema } from "mongoose";

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: "free" | "pro" | "agency" | "seeker_pro";
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId:                 { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    stripeCustomerId:       { type: String, default: "" },
    stripeSubscriptionId:   { type: String, default: "" },
    plan:                   { type: String, enum: ["free", "pro", "agency", "seeker_pro"], default: "free" },
    status:                 { type: String, enum: ["active", "canceled", "past_due", "trialing"], default: "active" },
    currentPeriodEnd:       { type: Date },
    cancelAtPeriodEnd:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Subscription =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
