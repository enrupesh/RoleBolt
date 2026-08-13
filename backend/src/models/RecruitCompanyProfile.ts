import mongoose, { Document, Schema } from "mongoose";

export interface ICompanySocialLinks {
  instagram?: string;
  twitter?: string;
  github?: string;
  portfolio?: string;
}

export type RecruitProfileType =
  | "company"
  | "educational_institute"
  | "individual"
  | "content_creator"
  | "ngo_government";

export interface IRecruitCompanyProfile extends Document {
  uid: string;
  profileType: RecruitProfileType;
  companyName: string;
  tagline: string;
  companyType: string;
  industry: string;
  companySize: string;
  foundedYear: string;
  website: string;
  location: string;
  description: string;
  mission: string;
  benefits: string;
  // Educational institute specific
  instituteType: string;
  coursesOffered: string;
  affiliationNumber: string;
  // Individual / content creator specific
  niche: string;
  // NGO / government specific
  registrationNumber: string;
  linkedinUrl: string;
  logoUrl: string;
  photoUrl: string;
  bio: string;
  personalLinkedinUrl: string;
  socialLinks: ICompanySocialLinks;
  verificationStatus: "none" | "requested" | "verified" | "rejected";
  verificationRequestedAt?: Date;
  verifiedAt?: Date;
  verificationNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySocialLinksSchema = new Schema<ICompanySocialLinks>(
  {
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },
  },
  { _id: false }
);

const RecruitCompanyProfileSchema = new Schema<IRecruitCompanyProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    profileType: {
      type: String,
      enum: ["company", "educational_institute", "individual", "content_creator", "ngo_government"],
      default: "company",
    },
    companyName: { type: String, default: "" },
    tagline: { type: String, default: "" },
    companyType: { type: String, default: "" },
    industry: { type: String, default: "" },
    companySize: { type: String, default: "" },
    foundedYear: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    description: { type: String, default: "" },
    mission: { type: String, default: "" },
    benefits: { type: String, default: "" },
    instituteType: { type: String, default: "" },
    coursesOffered: { type: String, default: "" },
    affiliationNumber: { type: String, default: "" },
    niche: { type: String, default: "" },
    registrationNumber: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    personalLinkedinUrl: { type: String, default: "" },
    socialLinks: { type: CompanySocialLinksSchema, default: () => ({}) },
    verificationStatus: { type: String, enum: ["none", "requested", "verified", "rejected"], default: "none" },
    verificationRequestedAt: { type: Date },
    verifiedAt: { type: Date },
    verificationNote: { type: String, default: "" },
  },
  { timestamps: true }
);

export const RecruitCompanyProfile =
  mongoose.models.RecruitCompanyProfile ||
  mongoose.model<IRecruitCompanyProfile>("RecruitCompanyProfile", RecruitCompanyProfileSchema);
