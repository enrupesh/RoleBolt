import mongoose, { Schema, Document } from "mongoose";

export interface IRecruitAuthSettings extends Document {
  requireEmailVerification: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RecruitAuthSettingsSchema = new Schema<IRecruitAuthSettings>(
  {
    requireEmailVerification: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const RecruitAuthSettings =
  mongoose.models.RecruitAuthSettings ||
  mongoose.model<IRecruitAuthSettings>("RecruitAuthSettings", RecruitAuthSettingsSchema);