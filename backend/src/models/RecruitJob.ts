import mongoose, { Document, Schema } from "mongoose";

export interface IRubricCriteria {
  name: string;
  weight: number;
  description: string;
}

export interface IJobReport {
  reason: string;
  details?: string;
  reportedAt: Date;
}

export interface IRecruitJob extends Document {
  uid: string;
  title: string;
  niche: string;
  companyName: string;
  companyType: string;
  jobType: string;
  department: string;
  seniority: string;
  location: string;
  workMode: "remote" | "onsite" | "hybrid";
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  experienceMin?: number;
  experienceMax?: number;
  educationRequirement: string;
  noticePeriod: string;
  freshersAllowed: boolean;
  verifiedCompany: boolean;
  publicVisibility: boolean;
  responsibilities: string;
  mustHaveSkills: string;
  niceToHaveSkills: string;
  generatedJD: string;
  rubric: IRubricCriteria[];
  status: "active" | "paused" | "closed";
  candidateCount: number;
  reports: IJobReport[];
  createdAt: Date;
  updatedAt: Date;
}

const RubricCriteriaSchema = new Schema<IRubricCriteria>(
  {
    name: { type: String, required: true },
    weight: { type: Number, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const JobReportSchema = new Schema<IJobReport>(
  {
    reason: { type: String, required: true },
    details: { type: String, default: "" },
    reportedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RecruitJobSchema = new Schema<IRecruitJob>(
  {
    uid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    niche: { type: String, default: "AI, Data, Software & Product Tech", index: true },
    companyName: { type: String, default: "" },
    companyType: { type: String, default: "" },
    jobType: { type: String, default: "Full-time", index: true },
    department: { type: String, default: "" },
    seniority: { type: String, default: "Mid-level" },
    location: { type: String, default: "Remote", index: true },
    workMode: { type: String, enum: ["remote", "onsite", "hybrid"], default: "remote" },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    salaryCurrency: { type: String, default: "INR" },
    experienceMin: { type: Number },
    experienceMax: { type: Number },
    educationRequirement: { type: String, default: "" },
    noticePeriod: { type: String, default: "" },
    freshersAllowed: { type: Boolean, default: false, index: true },
    verifiedCompany: { type: Boolean, default: false, index: true },
    publicVisibility: { type: Boolean, default: true, index: true },
    responsibilities: { type: String, default: "" },
    mustHaveSkills: { type: String, default: "" },
    niceToHaveSkills: { type: String, default: "" },
    generatedJD: { type: String, default: "" },
    rubric: { type: [RubricCriteriaSchema], default: [] },
    status: { type: String, enum: ["active", "paused", "closed"], default: "active" },
    candidateCount: { type: Number, default: 0 },
    reports: { type: [JobReportSchema], default: [] },
  },
  { timestamps: true }
);

export const RecruitJob =
  mongoose.models.RecruitJob ||
  mongoose.model<IRecruitJob>("RecruitJob", RecruitJobSchema);
