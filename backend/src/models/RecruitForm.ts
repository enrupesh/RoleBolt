import mongoose, { Document, Schema } from "mongoose";

export type QuestionType =
  | "short"
  | "paragraph"
  | "number"
  | "email"
  | "phone"
  | "dropdown"
  | "multiple_choice"
  | "yes_no"
  | "file";

export interface IFormQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  placeholder: string;
}

export type FormWorkMode = "remote" | "onsite" | "hybrid";

export interface IFormJobDetails {
  companyName: string;
  jobType: string;
  department: string;
  seniority: string;
  location: string;
  workMode: FormWorkMode;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  experienceMin?: number;
  experienceMax?: number;
  openings?: number;
  applicationDeadline?: Date;
}

export interface IFormAgentMode {
  enabled: boolean;                    // false = Manual Mode, true = AI Agent Mode
  shortlistThreshold: number;          // aiScore >= this → auto-shortlist
  rejectThreshold: number;             // aiScore < this → auto-reject
  autoEmailShortlist: boolean;
  autoEmailReject: boolean;
  emailReviewZoneCandidates: boolean;  // "still under review" email for the middle band
}

export type FormRuleCondition = "score_above" | "score_below" | "stage_age_days";
export type FormRuleAction =
  | "move_to_scored"
  | "move_to_review_zone"
  | "move_to_shortlisted"
  | "move_to_assessment"
  | "move_to_interview"
  | "move_to_offer"
  | "move_to_hired"
  | "move_to_withdrawn"
  | "move_to_rejected";

export interface IFormPipelineRule {
  id: string;
  condition: FormRuleCondition;
  threshold: number;    // aiScore for score conditions, days for stage_age_days
  fromStage?: string;   // optional: only apply while the response sits in this stage
  action: FormRuleAction;
  enabled: boolean;
  triggerCount: number;
}

export interface IFormHiringSummary {
  generatedAt: Date;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  highSignalQuestions: string[];
  lowSignalQuestions: string[];
  priorityCandidates: {
    responseId: string;
    reason: string;
  }[];
}

export interface IRecruitForm extends Document {
  uid: string;
  title: string;
  description: string;
  slug: string;
  jobDetails: IFormJobDetails;
  questions: IFormQuestion[];
  status: "active" | "closed";
  responseCount: number;
  agentMode: IFormAgentMode;
  pipelineRules: IFormPipelineRule[];
  aiHiringSummary?: IFormHiringSummary;
  createdAt: Date;
  updatedAt: Date;
}

const FormQuestionSchema = new Schema<IFormQuestion>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["short", "paragraph", "number", "email", "phone", "dropdown", "multiple_choice", "yes_no", "file"],
      default: "short",
    },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    placeholder: { type: String, default: "" },
  },
  { _id: false }
);

const FormJobDetailsSchema = new Schema<IFormJobDetails>(
  {
    companyName: { type: String, default: "" },
    jobType: { type: String, default: "" },
    department: { type: String, default: "" },
    seniority: { type: String, default: "" },
    location: { type: String, default: "" },
    workMode: { type: String, enum: ["remote", "onsite", "hybrid"], default: "remote" },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    salaryCurrency: { type: String, default: "INR" },
    experienceMin: { type: Number },
    experienceMax: { type: Number },
    openings: { type: Number },
    applicationDeadline: { type: Date },
  },
  { _id: false }
);

// Form answers are weaker evidence than a resume scored against a rubric, so auto-reject
// is off by default and the review zone is wider than on Standard Jobs.
const FormAgentModeSchema = new Schema<IFormAgentMode>(
  {
    enabled:                   { type: Boolean, default: false },
    shortlistThreshold:        { type: Number,  default: 75 },
    rejectThreshold:           { type: Number,  default: 35 },
    autoEmailShortlist:        { type: Boolean, default: true },
    autoEmailReject:           { type: Boolean, default: false },
    emailReviewZoneCandidates: { type: Boolean, default: false },
  },
  { _id: false }
);

const FormPipelineRuleSchema = new Schema<IFormPipelineRule>(
  {
    id:           { type: String, required: true },
    condition:    { type: String, enum: ["score_above", "score_below", "stage_age_days"], required: true },
    threshold:    { type: Number, required: true },
    fromStage:    { type: String, default: "" },
    action:       {
      type: String,
      enum: [
        "move_to_scored", "move_to_review_zone", "move_to_shortlisted",
        "move_to_assessment", "move_to_interview", "move_to_offer",
        "move_to_hired", "move_to_withdrawn", "move_to_rejected",
      ],
      required: true,
    },
    enabled:      { type: Boolean, default: true },
    triggerCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const FormHiringSummarySchema = new Schema<IFormHiringSummary>(
  {
    generatedAt: { type: Date, default: Date.now },
    summary: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    highSignalQuestions: { type: [String], default: [] },
    lowSignalQuestions: { type: [String], default: [] },
    priorityCandidates: {
      type: [{
        responseId: { type: String, required: true },
        reason: { type: String, default: "" },
      }],
      default: [],
    },
  },
  { _id: false }
);

const RecruitFormSchema = new Schema<IRecruitForm>(
  {
    uid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    slug: { type: String, required: true, unique: true, index: true },
    jobDetails: { type: FormJobDetailsSchema, default: () => ({}) },
    questions: { type: [FormQuestionSchema], default: [] },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    responseCount: { type: Number, default: 0 },
    agentMode: { type: FormAgentModeSchema, default: () => ({}) },
    pipelineRules: { type: [FormPipelineRuleSchema], default: [] },
    aiHiringSummary: { type: FormHiringSummarySchema, default: undefined },
  },
  { timestamps: true }
);

export const RecruitForm =
  mongoose.models.RecruitForm ||
  mongoose.model<IRecruitForm>("RecruitForm", RecruitFormSchema);
