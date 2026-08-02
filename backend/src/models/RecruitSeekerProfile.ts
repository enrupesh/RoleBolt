import mongoose, { Document, Schema } from "mongoose";

export interface IExperienceEntry {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
}

export interface IEducationEntry {
  degree: string;
  institution: string;
  year?: string;
  description?: string;
}

export interface IProjectEntry {
  name: string;
  description: string;
  url?: string;
  technologies?: string[];
}

export interface ICertificationEntry {
  name: string;
  issuer: string;
  year?: string;
  url?: string;
}

export interface ISocialLinks {
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  github?: string;
  portfolio?: string;
}

export interface IRecruitSeekerProfile extends Document {
  uid: string;
  username?: string;
  name: string;
  email: string;
  phone?: string;
  headline: string;
  bio: string;
  skills: string[];
  experience: IExperienceEntry[];
  education: IEducationEntry[];
  projects: IProjectEntry[];
  certifications: ICertificationEntry[];
  preferredJobType: string;
  preferredWorkMode: string;
  preferredLocation: string;
  preferredSalaryMin?: number;
  preferredSalaryMax?: number;
  preferredNiche: string;
  experienceLevel: string;
  resumeText: string;
  socialLinks?: ISocialLinks;
  photoUrl?: string;
  savedJobIds: string[];
  resumeFileName?: string;
  weeklyApplicationGoal?: number;
  careerObjective?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExperienceSchema = new Schema<IExperienceEntry>(
  {
    title: { type: String, default: "" },
    company: { type: String, default: "" },
    location: { type: String },
    startDate: { type: String, default: "" },
    endDate: { type: String },
    current: { type: Boolean, default: false },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const EducationSchema = new Schema<IEducationEntry>(
  {
    degree: { type: String, default: "" },
    institution: { type: String, default: "" },
    year: { type: String },
    description: { type: String },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProjectEntry>(
  {
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    url: { type: String },
    technologies: { type: [String], default: [] },
  },
  { _id: false }
);

const CertificationSchema = new Schema<ICertificationEntry>(
  {
    name: { type: String, default: "" },
    issuer: { type: String, default: "" },
    year: { type: String },
    url: { type: String },
  },
  { _id: false }
);

const SocialLinksSchema = new Schema<ISocialLinks>(
  {
    linkedin: { type: String, default: "" },
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },
  },
  { _id: false }
);

const RecruitSeekerProfileSchema = new Schema<IRecruitSeekerProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String },
    headline: { type: String, default: "" },
    bio: { type: String, default: "" },
    skills: { type: [String], default: [] },
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    projects: { type: [ProjectSchema], default: [] },
    certifications: { type: [CertificationSchema], default: [] },
    preferredJobType: { type: String, default: "" },
    preferredWorkMode: { type: String, default: "" },
    preferredLocation: { type: String, default: "" },
    preferredSalaryMin: { type: Number },
    preferredSalaryMax: { type: Number },
    preferredNiche: { type: String, default: "" },
    experienceLevel: { type: String, default: "" },
    resumeText: { type: String, default: "" },
    socialLinks: { type: SocialLinksSchema, default: () => ({}) },
    photoUrl: { type: String, default: "" },
    savedJobIds: { type: [String], default: [] },
    resumeFileName: { type: String, default: "" },
    weeklyApplicationGoal: { type: Number, default: 5 },
    careerObjective: { type: String, default: "" },
  },
  { timestamps: true }
);

export const RecruitSeekerProfile =
  mongoose.models.RecruitSeekerProfile ||
  mongoose.model<IRecruitSeekerProfile>("RecruitSeekerProfile", RecruitSeekerProfileSchema);
