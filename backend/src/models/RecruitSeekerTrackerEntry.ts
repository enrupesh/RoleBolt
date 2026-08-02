import mongoose, { Document, Schema } from "mongoose";

export type TrackerStage =
  | "saved"
  | "applied"
  | "screening"
  | "assessment"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "ghosted"
  | "archived";

export interface IEmailIntelEntry {
  subject: string;
  summary: string;
  suggestedStage?: TrackerStage;
  interviewDate?: Date;
  nextAction?: string;
  parsedAt: Date;
}

export interface IRecruitSeekerTrackerEntry extends Document {
  uid: string;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  platform: string;
  sourceUrl: string;
  stage: TrackerStage;
  appliedAt?: Date;
  lastContactAt?: Date;
  nextFollowUpAt?: Date;
  nextAction: string;
  notes: string;
  workspaceId?: string;
  emailIntel: IEmailIntelEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const EmailIntelSchema = new Schema<IEmailIntelEntry>(
  {
    subject: { type: String, default: "" },
    summary: { type: String, default: "" },
    suggestedStage: { type: String },
    interviewDate: { type: Date },
    nextAction: { type: String, default: "" },
    parsedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RecruitSeekerTrackerEntrySchema = new Schema<IRecruitSeekerTrackerEntry>(
  {
    uid: { type: String, required: true, index: true },
    title: { type: String, default: "Untitled role" },
    companyName: { type: String, default: "" },
    location: { type: String, default: "" },
    workMode: { type: String, default: "" },
    platform: { type: String, default: "other" },
    sourceUrl: { type: String, default: "" },
    stage: {
      type: String,
      enum: ["saved", "applied", "screening", "assessment", "interview", "offer", "hired", "rejected", "ghosted", "archived"],
      default: "applied",
    },
    appliedAt: { type: Date },
    lastContactAt: { type: Date },
    nextFollowUpAt: { type: Date },
    nextAction: { type: String, default: "" },
    notes: { type: String, default: "" },
    workspaceId: { type: String },
    emailIntel: { type: [EmailIntelSchema], default: [] },
  },
  { timestamps: true }
);

RecruitSeekerTrackerEntrySchema.index({ uid: 1, updatedAt: -1 });

export const RecruitSeekerTrackerEntry =
  mongoose.models.RecruitSeekerTrackerEntry ||
  mongoose.model<IRecruitSeekerTrackerEntry>("RecruitSeekerTrackerEntry", RecruitSeekerTrackerEntrySchema);
