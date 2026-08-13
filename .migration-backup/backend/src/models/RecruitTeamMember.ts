import mongoose, { Document, Schema } from "mongoose";

export type CollaborationRole =
  | "recruiter"
  | "senior_recruiter"
  | "hiring_manager"
  | "hr_manager"
  | "interviewer"
  | "admin";

export const COLLABORATION_PERMISSIONS = [
  "manage_team",
  "configure_job",
  "view_analytics",
  "delete_job",
  "view_candidates",
  "view_assigned_candidates",
  "review_candidates",
  "move_pipeline",
  "send_assessments",
  "schedule_interviews",
  "send_offers",
  "add_comments",
  "add_notes",
  "approve_hiring",
  "submit_feedback",
] as const;

export type CollaborationPermission = typeof COLLABORATION_PERMISSIONS[number];
export type TeamMemberStatus = "pending" | "active" | "revoked";

export interface IRecruitTeamMember extends Document {
  jobId: mongoose.Types.ObjectId;
  ownerUid: string;
  memberUid?: string;
  email: string;
  name: string;
  role: CollaborationRole;
  permissions: CollaborationPermission[];
  status: TeamMemberStatus;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  notifyByEmail: boolean;
  joinedAt?: Date;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecruitTeamMemberSchema = new Schema<IRecruitTeamMember>(
  {
    jobId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitJob", index: true },
    ownerUid: { type: String, required: true, index: true },
    memberUid: { type: String, index: true, sparse: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["recruiter", "senior_recruiter", "hiring_manager", "hr_manager", "interviewer", "admin"],
      required: true,
      default: "recruiter",
    },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: ["pending", "active", "revoked"], default: "pending" },
    inviteToken: { type: String, index: true, sparse: true },
    inviteExpiresAt: { type: Date },
    notifyByEmail: { type: Boolean, default: true },
    joinedAt: { type: Date },
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

RecruitTeamMemberSchema.index({ jobId: 1, email: 1 }, { unique: true });

export const RecruitTeamMember =
  mongoose.models.RecruitTeamMember ||
  mongoose.model<IRecruitTeamMember>("RecruitTeamMember", RecruitTeamMemberSchema);
