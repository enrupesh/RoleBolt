import mongoose, { Document, Schema } from "mongoose";

export interface IRecruitNotification extends Document {
  uid: string;
  type: "mention" | "assignment" | "team_invite" | "activity";
  title: string;
  body: string;
  jobId?: mongoose.Types.ObjectId;
  candidateId?: mongoose.Types.ObjectId;
  readAt?: Date;
  createdAt: Date;
}

const RecruitNotificationSchema = new Schema<IRecruitNotification>(
  {
    uid: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "RecruitJob" },
    candidateId: { type: Schema.Types.ObjectId, ref: "RecruitCandidate" },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const RecruitNotification =
  mongoose.models.RecruitNotification ||
  mongoose.model<IRecruitNotification>("RecruitNotification", RecruitNotificationSchema);
