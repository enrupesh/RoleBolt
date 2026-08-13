import mongoose, { Document, Schema } from "mongoose";
import type {
  SitegenCreatorProfile,
  SitegenInputMode,
  SitegenSeekerProfile,
} from "../types/profile";
import type {
  SitegenAiProcessingStatus,
  SitegenStructuredContent,
  SitegenThemeId,
} from "../types/structuredContent";

export const SITEGEN_SITE_TYPES = ["seeker", "creator"] as const;
export type SitegenSiteType = (typeof SITEGEN_SITE_TYPES)[number];

export const SITEGEN_WEBSITE_STATUSES = ["draft", "published"] as const;
export type SitegenWebsiteStatus = (typeof SITEGEN_WEBSITE_STATUSES)[number];

export interface ISitegenWebsite extends Document {
  username: string;
  passwordHash: string;
  siteType: SitegenSiteType;
  status: SitegenWebsiteStatus;
  inputMode?: SitegenInputMode;
  resumeText?: string;
  resumeFileName?: string;
  seekerProfile?: SitegenSeekerProfile;
  creatorProfile?: SitegenCreatorProfile;
  infoCompletedAt?: Date;
  structuredContent?: SitegenStructuredContent;
  recommendedThemeId?: SitegenThemeId;
  selectedThemeId?: SitegenThemeId;
  publishedStructuredContent?: SitegenStructuredContent;
  publishedThemeId?: SitegenThemeId;
  publishedAt?: Date;
  hasUnpublishedChanges?: boolean;
  needsRestructure?: boolean;
  aiProcessingStatus?: SitegenAiProcessingStatus;
  aiMessage?: string;
  structuredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SeekerExperienceSchema = new Schema(
  {
    title: String,
    company: String,
    startDate: String,
    endDate: String,
    current: Boolean,
    description: String,
  },
  { _id: false },
);

const SeekerEducationSchema = new Schema(
  {
    school: String,
    degree: String,
    field: String,
    startDate: String,
    endDate: String,
    description: String,
  },
  { _id: false },
);

const SeekerProjectSchema = new Schema(
  {
    name: String,
    description: String,
    url: String,
  },
  { _id: false },
);

const SeekerProfileSchema = new Schema(
  {
    fullName: { type: String, trim: true, maxlength: 120 },
    headline: { type: String, trim: true, maxlength: 160 },
    summary: { type: String, trim: true, maxlength: 4000 },
    email: { type: String, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    location: { type: String, trim: true, maxlength: 120 },
    website: { type: String, trim: true, maxlength: 500 },
    linkedin: { type: String, trim: true, maxlength: 500 },
    github: { type: String, trim: true, maxlength: 500 },
    portfolio: { type: String, trim: true, maxlength: 500 },
    photoUrl: { type: String, trim: true, maxlength: 1000 },
    skills: [{ type: String, trim: true, maxlength: 80 }],
    experience: [SeekerExperienceSchema],
    education: [SeekerEducationSchema],
    projects: [SeekerProjectSchema],
  },
  { _id: false },
);

const CreatorProfileSchema = new Schema(
  {
    businessName: { type: String, trim: true, maxlength: 160 },
    category: { type: String, trim: true, maxlength: 80 },
    tagline: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    logoUrl: { type: String, trim: true, maxlength: 1000 },
    about: { type: String, trim: true, maxlength: 4000 },
    services: [{ type: String, trim: true, maxlength: 120 }],
    location: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    website: { type: String, trim: true, maxlength: 500 },
    socialLinks: {
      linkedin: String,
      instagram: String,
      twitter: String,
      youtube: String,
      tiktok: String,
    },
    portfolioLinks: [{ title: String, url: String }],
    team: [{ name: String, role: String, bio: String }],
    imageUrls: [{ type: String, trim: true, maxlength: 1000 }],
  },
  { _id: false },
);

const SitegenWebsiteSchema = new Schema<ISitegenWebsite>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    siteType: { type: String, enum: SITEGEN_SITE_TYPES, required: true, index: true },
    status: { type: String, enum: SITEGEN_WEBSITE_STATUSES, default: "draft", index: true },
    inputMode: { type: String, enum: ["resume", "manual"] },
    resumeText: { type: String, trim: true, maxlength: 50000 },
    resumeFileName: { type: String, trim: true, maxlength: 255 },
    seekerProfile: SeekerProfileSchema,
    creatorProfile: CreatorProfileSchema,
    infoCompletedAt: { type: Date },
    structuredContent: { type: Schema.Types.Mixed },
    recommendedThemeId: { type: String },
    selectedThemeId: { type: String },
    publishedStructuredContent: { type: Schema.Types.Mixed },
    publishedThemeId: { type: String },
    publishedAt: { type: Date },
    hasUnpublishedChanges: { type: Boolean, default: false },
    needsRestructure: { type: Boolean, default: false },
    aiProcessingStatus: { type: String, enum: ["idle", "ai_success", "ai_fallback", "failed"], default: "idle" },
    aiMessage: { type: String, trim: true, maxlength: 500 },
    structuredAt: { type: Date },
  },
  { timestamps: true },
);

export const SitegenWebsite =
  mongoose.models.SitegenWebsite ||
  mongoose.model<ISitegenWebsite>("SitegenWebsite", SitegenWebsiteSchema);
