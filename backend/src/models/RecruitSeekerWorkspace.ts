import mongoose, { Document, Schema } from "mongoose";

export type SeekerWorkspaceStatus = "saved" | "analyzed" | "applied" | "archived";

export interface ISeekerWorkspaceAnalysis {
  matchScore: number;
  matchLabel: string;
  summary: string;
  matchReasons: string[];
  strengths: string[];
  missingSkills: string[];
  profileSuggestions: string[];
  salaryInsight: string;
  analyzedAt?: Date;
}

export interface IRecruitSeekerWorkspace extends Document {
  uid: string;
  sourceUrl: string;
  sourceType: "url" | "manual";
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  salaryText: string;
  applicationDeadline?: Date;
  jobDescription: string;
  status: SeekerWorkspaceStatus;
  notes: string;
  analysis?: ISeekerWorkspaceAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisSchema = new Schema<ISeekerWorkspaceAnalysis>(
  {
    matchScore: { type: Number, default: 0 },
    matchLabel: { type: String, default: "Not analyzed" },
    summary: { type: String, default: "" },
    matchReasons: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    profileSuggestions: { type: [String], default: [] },
    salaryInsight: { type: String, default: "" },
    analyzedAt: { type: Date },
  },
  { _id: false }
);

const RecruitSeekerWorkspaceSchema = new Schema<IRecruitSeekerWorkspace>(
  {
    uid: { type: String, required: true, index: true },
    sourceUrl: { type: String, default: "" },
    sourceType: { type: String, enum: ["url", "manual"], default: "manual" },
    title: { type: String, default: "Untitled job" },
    companyName: { type: String, default: "" },
    location: { type: String, default: "" },
    workMode: { type: String, default: "" },
    salaryText: { type: String, default: "" },
    applicationDeadline: { type: Date },
    jobDescription: { type: String, default: "" },
    status: {
      type: String,
      enum: ["saved", "analyzed", "applied", "archived"],
      default: "saved",
    },
    notes: { type: String, default: "" },
    analysis: { type: AnalysisSchema },
  },
  { timestamps: true }
);

RecruitSeekerWorkspaceSchema.index({ uid: 1, updatedAt: -1 });

export const RecruitSeekerWorkspace =
  mongoose.models.RecruitSeekerWorkspace ||
  mongoose.model<IRecruitSeekerWorkspace>("RecruitSeekerWorkspace", RecruitSeekerWorkspaceSchema);