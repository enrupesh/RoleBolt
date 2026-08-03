import mongoose, { Document, Schema } from "mongoose";

export const FEEDBACK_CATEGORIES = [
  "product",
  "bug",
  "feature",
  "recruiter",
  "job_seeker",
  "billing",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface IRecruitFeedback extends Document {
  category: FeedbackCategory;
  message: string;
  email?: string;
  pageUrl?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecruitFeedbackSchema = new Schema<IRecruitFeedback>(
  {
    category: { type: String, enum: FEEDBACK_CATEGORIES, required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    pageUrl: { type: String, trim: true, maxlength: 500 },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

RecruitFeedbackSchema.index({ createdAt: -1 });

export const RecruitFeedback =
  mongoose.models.RecruitFeedback ||
  mongoose.model<IRecruitFeedback>("RecruitFeedback", RecruitFeedbackSchema);