import mongoose, { Schema, Document } from "mongoose";

export interface SitegenImageDoc extends Document {
  websiteId: string;
  contentType: string;
  data: Buffer;
  createdAt: Date;
}

const SitegenImageSchema = new Schema<SitegenImageDoc>({
  websiteId: { type: String, required: true, index: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const SitegenImage =
  mongoose.models.SitegenImage ||
  mongoose.model<SitegenImageDoc>("SitegenImage", SitegenImageSchema);
