import mongoose, { Document, Schema } from "mongoose";

export const REVIEW_ROLES = ["creator", "seeker"] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];

export const REVIEW_SUBMITTER_PLANS = ["free", "pro", "ultra"] as const;
export type ReviewSubmitterPlan = (typeof REVIEW_SUBMITTER_PLANS)[number];

export interface IRecruitReview extends Document {
  uid?: string;
  editToken?: string;
  email?: string;
  rating: number;
  title?: string;
  message: string;
  displayName: string;
  role: ReviewRole;
  isGuest: boolean;
  featured: boolean;
  visible: boolean;
  videoUrl?: string;
  submitterPlan?: ReviewSubmitterPlan;
  createdAt: Date;
  updatedAt: Date;
}

const RecruitReviewSchema = new Schema<IRecruitReview>(
  {
  uid: { type: String, sparse: true },
    editToken: { type: String, index: true, sparse: true, select: false },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: REVIEW_ROLES, required: true, index: true },
    isGuest: { type: Boolean, required: true, default: true, index: true },
    featured: { type: Boolean, default: false, index: true },
    visible: { type: Boolean, default: true, index: true },
    videoUrl: { type: String, trim: true, maxlength: 2048 },
    submitterPlan: { type: String, enum: REVIEW_SUBMITTER_PLANS },
  },
  { timestamps: true },
);

RecruitReviewSchema.index({ uid: 1 }, { unique: true, sparse: true });
RecruitReviewSchema.index({ visible: 1, featured: 1, createdAt: -1 });

export const RecruitReview =
  mongoose.models.RecruitReview ||
  mongoose.model<IRecruitReview>("RecruitReview", RecruitReviewSchema);

export interface IRecruitReviewSettings extends Document {
  allowGuestReviews: boolean;
  showFeaturedReviews: boolean;
  featuredXPostUrls: string[];
  featuredVideoReviewUrls: string[];
  updatedAt: Date;
}

const RecruitReviewSettingsSchema = new Schema<IRecruitReviewSettings>(
  {
    allowGuestReviews: { type: Boolean, default: false },
    showFeaturedReviews: { type: Boolean, default: true },
    featuredXPostUrls: { type: [String], default: [] },
    featuredVideoReviewUrls: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const RecruitReviewSettings =
  mongoose.models.RecruitReviewSettings ||
  mongoose.model<IRecruitReviewSettings>("RecruitReviewSettings", RecruitReviewSettingsSchema);