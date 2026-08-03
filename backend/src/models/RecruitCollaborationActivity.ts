import mongoose, { Document, Schema } from "mongoose";

export type CollaborationActivityType =
  | "team_member_added"
  | "team_member_updated"
  | "team_member_removed"
  | "candidate_assigned"
  | "candidate_unassigned"
  | "comment_added"
  | "comment_edited"
  | "internal_note_added"
  | "internal_note_edited"
  | "candidate_stage_changed"
  | "offer_approved"
  | "interview_feedback"
  | "interview_feedback_all_completed"
  | "ai_hiring_summary_generated"
  | "recruiter_final_decision";

export interface IRecruitCollaborationActivity extends Document {
  jobId: mongoose.Types.ObjectId;
  candidateId?: mongoose.Types.ObjectId;
  actor: { uid: string; name: string; email: string };
  type: CollaborationActivityType;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const RecruitCollaborationActivitySchema = new Schema<IRecruitCollaborationActivity>(
  {
    jobId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitJob", index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "RecruitCandidate", index: true, sparse: true },
    actor: {
      uid: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, default: "" },
    },
    type: { type: String, required: true },
    action: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

export const RecruitCollaborationActivity =
  mongoose.models.RecruitCollaborationActivity ||
  mongoose.model<IRecruitCollaborationActivity>(
    "RecruitCollaborationActivity",
    RecruitCollaborationActivitySchema
  );
