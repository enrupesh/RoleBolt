import mongoose, { Schema, Document } from "mongoose";

/**
 * Durable seeker resume version history for billing resource counters.
 * Active versions (`isActive: true`) count toward `active_resume_versions`.
 * All owned versions count toward `stored_resume_versions`.
 */
export interface IRecruitSeekerResumeVersion extends Document {
  uid: string;
  versionNumber: number;
  resumeText: string;
  resumeFileName: string;
  isActive: boolean;
  source: "profile_sync" | "upload" | "build" | "import";
  createdAt: Date;
  updatedAt: Date;
}

const RecruitSeekerResumeVersionSchema = new Schema<IRecruitSeekerResumeVersion>(
  {
    uid: { type: String, required: true, index: true },
    versionNumber: { type: Number, required: true, min: 1 },
    resumeText: { type: String, default: "" },
    resumeFileName: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    source: {
      type: String,
      enum: ["profile_sync", "upload", "build", "import"],
      default: "profile_sync",
    },
  },
  { timestamps: true },
);

RecruitSeekerResumeVersionSchema.index({ uid: 1, versionNumber: -1 }, { unique: true });
RecruitSeekerResumeVersionSchema.index({ uid: 1, isActive: 1 });

export const RecruitSeekerResumeVersion = mongoose.model<IRecruitSeekerResumeVersion>(
  "RecruitSeekerResumeVersion",
  RecruitSeekerResumeVersionSchema,
);
