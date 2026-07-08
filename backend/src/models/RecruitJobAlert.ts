import mongoose, { Document, Schema } from "mongoose";

export interface IRecruitJobAlert extends Document {
  email: string;
  niche: string;
  workMode: string;
  keywords: string;
  location: string;
  freshersOnly: boolean;
  verifiedOnly: boolean;
  createdAt: Date;
  lastCheckedAt: Date;
}

const RecruitJobAlertSchema = new Schema<IRecruitJobAlert>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    niche: { type: String, default: "" },
    workMode: { type: String, default: "" },
    keywords: { type: String, default: "" },
    location: { type: String, default: "" },
    freshersOnly: { type: Boolean, default: false },
    verifiedOnly: { type: Boolean, default: false },
    lastCheckedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

RecruitJobAlertSchema.index({ email: 1, niche: 1, workMode: 1 });

export const RecruitJobAlert =
  mongoose.models.RecruitJobAlert ||
  mongoose.model<IRecruitJobAlert>("RecruitJobAlert", RecruitJobAlertSchema);
