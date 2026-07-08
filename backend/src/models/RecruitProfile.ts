import mongoose, { Schema, Document } from "mongoose";

export interface IRecruitProfile extends Document {
  uid: string;
  role: "creator" | "seeker";
  name?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecruitProfileSchema = new Schema<IRecruitProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["creator", "seeker"], required: true },
    name: { type: String },
    email: { type: String },
  },
  { timestamps: true }
);

export const RecruitProfile =
  mongoose.models.RecruitProfile ||
  mongoose.model<IRecruitProfile>("RecruitProfile", RecruitProfileSchema);
