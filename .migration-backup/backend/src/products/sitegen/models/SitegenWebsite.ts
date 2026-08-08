import mongoose, { Document, Schema } from "mongoose";

export const SITEGEN_SITE_TYPES = ["seeker", "creator"] as const;
export type SitegenSiteType = (typeof SITEGEN_SITE_TYPES)[number];

export const SITEGEN_WEBSITE_STATUSES = ["draft", "published"] as const;
export type SitegenWebsiteStatus = (typeof SITEGEN_WEBSITE_STATUSES)[number];

export interface ISitegenWebsite extends Document {
  username: string;
  passwordHash: string;
  siteType: SitegenSiteType;
  status: SitegenWebsiteStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SitegenWebsiteSchema = new Schema<ISitegenWebsite>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    siteType: { type: String, enum: SITEGEN_SITE_TYPES, required: true, index: true },
    status: { type: String, enum: SITEGEN_WEBSITE_STATUSES, default: "draft", index: true },
  },
  { timestamps: true },
);

export const SitegenWebsite =
  mongoose.models.SitegenWebsite ||
  mongoose.model<ISitegenWebsite>("SitegenWebsite", SitegenWebsiteSchema);
