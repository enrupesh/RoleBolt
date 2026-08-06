import mongoose, { Schema, Document } from "mongoose";

export interface RecruitImageDoc extends Document {
  uid: string;
  contentType: string;
  data: Buffer;
  createdAt: Date;
}

const RecruitImageSchema = new Schema<RecruitImageDoc>({
  uid: { type: String, required: true, index: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const RecruitImage =
  mongoose.models.RecruitImage ||
  mongoose.model<RecruitImageDoc>("RecruitImage", RecruitImageSchema);
