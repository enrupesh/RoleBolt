import mongoose, { Document, Schema } from "mongoose";

export interface ICompanySocialLinks {
  instagram?: string;
  twitter?: string;
  github?: string;
  portfolio?: string;
}

export interface IRecruitCompanyProfile extends Document {
  uid: string;
  companyName: string;
  companyType: string;
  industry: string;
  companySize: string;
  website: string;
  location: string;
  description: string;
  mission: string;
  benefits: string;
  linkedinUrl: string;
  logoUrl: string;
  photoUrl: string;
  bio: string;
  socialLinks: ICompanySocialLinks;
  verificationStatus: "none" | "requested" | "verified" | "rejected";
  verificationRequestedAt?: Date;
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
    companyName: { type: String, default: "" },
    companyType: { type: String, default: "" },
    industry: { type: String, default: "" },
    companySize: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    description: { type: String, default: "" },
    mission: { type: String, default: "" },
    benefits: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    socialLinks: { type: CompanySocialLinksSchema, default: () => ({}) },
    verificationStatus: { type: String, enum: ["none", "requested", "verified", "rejected"], default: "none" },
    verificationRequestedAt: { type: Date },
    verificationNote: { type: String, default: "" },
  },
  { timestamps: true }
);

export const RecruitCompanyProfile =
  mongoose.models.RecruitCompanyProfile ||
  mongoose.model<IRecruitCompanyProfile>("RecruitCompanyProfile", RecruitCompanyProfileSchema);
