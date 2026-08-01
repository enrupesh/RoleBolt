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

export interface IAgentMode {
  enabled: boolean;                    // false = Manual Mode, true = AI Agent Mode
  shortlistThreshold: number;          // score% >= this → auto-shortlist (default 75)
  rejectThreshold: number;             // score% < this → auto-reject (default 40)
  autoEmailShortlist: boolean;         // send screened email automatically (default true)
  autoEmailReject: boolean;            // send rejection email automatically (default false)
  autoSendAssessment: boolean;         // auto-send assessment to shortlisted (default false)
  emailReviewZoneCandidates: boolean;  // send "under review" email to review zone candidates (default false)
}

export interface IPerformanceAlert {
  id: string;
  type: "low_applications" | "no_hire_14_days" | "high_reject_rate";
  message: string;
  aiSuggestions: string[];
  createdAt: Date;
  dismissed: boolean;
}

export interface IAssessmentAlertLogEntry {
  triggeredAt: Date;
  completionRate: number;
  threshold: number;
  totalSent: number;
  totalCompleted: number;
}

export interface IAssessmentAlert {
  enabled: boolean;
  threshold: number;          // 0–100, e.g. 50
  alertFired: boolean;        // true = email sent for current "below" episode
  lastCompletionRate: number | null;
  bannerDismissed: boolean;
  alertLog: IAssessmentAlertLogEntry[];
}

export interface IPipelineRule {
  id: string;
  condition: "score_above" | "score_below" | "assessment_passed" | "assessment_failed" | "stage_age_days";
  threshold: number;       // score% for score conditions, days for age condition
  fromStage?: string;      // optional: only apply when candidate is in this stage
  action: "move_to_screened" | "move_to_assessed" | "move_to_interview" | "move_to_offer" | "move_to_rejected" | "send_assessment" | "send_reminder";
  enabled: boolean;
  triggerCount: number;    // how many times this rule has fired (for stats)
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
  nicheDetails: Record<string, string>;
  openings: number;
  applicationDeadline?: Date;
  perks: string;
  languageRequirement: string;
  timezoneOverlap: string;
  generatedJD: string;
  rubric: IRubricCriteria[];
  status: "active" | "paused" | "closed";
  candidateCount: number;
  reports: IJobReport[];
  agentMode: IAgentMode;
  pipelineRules: IPipelineRule[];
  performanceAlerts: IPerformanceAlert[];
  assessmentAlert: IAssessmentAlert;
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

const PerformanceAlertSchema = new Schema<IPerformanceAlert>(
  {
    id:             { type: String, required: true },
    type:           { type: String, required: true },
    message:        { type: String, default: "" },
    aiSuggestions:  { type: [String], default: [] },
    createdAt:      { type: Date, default: Date.now },
    dismissed:      { type: Boolean, default: false },
  },
  { _id: false }
);

const PipelineRuleSchema = new Schema<IPipelineRule>(
  {
    id:           { type: String, required: true },
    condition:    { type: String, required: true },
    threshold:    { type: Number, required: true },
    fromStage:    { type: String, default: "" },
    action:       { type: String, required: true },
    enabled:      { type: Boolean, default: true },
    triggerCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const AssessmentAlertLogEntrySchema = new Schema<IAssessmentAlertLogEntry>(
  {
    triggeredAt:    { type: Date,   default: Date.now },
    completionRate: { type: Number, required: true },
    threshold:      { type: Number, required: true },
    totalSent:      { type: Number, required: true },
    totalCompleted: { type: Number, required: true },
  },
  { _id: false }
);

const AssessmentAlertSchema = new Schema<IAssessmentAlert>(
  {
    enabled:              { type: Boolean, default: false },
    threshold:            { type: Number,  default: 50 },
    alertFired:           { type: Boolean, default: false },
    lastCompletionRate:   { type: Number,  default: null },
    bannerDismissed:      { type: Boolean, default: false },
    alertLog:             { type: [AssessmentAlertLogEntrySchema], default: [] },
  },
  { _id: false }
);

const AgentModeSchema = new Schema<IAgentMode>(
  {
    enabled:                    { type: Boolean, default: false },
    shortlistThreshold:         { type: Number,  default: 75 },
    rejectThreshold:            { type: Number,  default: 40 },
    autoEmailShortlist:         { type: Boolean, default: true },
    autoEmailReject:            { type: Boolean, default: false },
    autoSendAssessment:         { type: Boolean, default: false },
    emailReviewZoneCandidates:  { type: Boolean, default: false },
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
    nicheDetails: { type: Schema.Types.Mixed, default: {} },
    openings: { type: Number, default: 1 },
    applicationDeadline: { type: Date },
    perks: { type: String, default: "" },
    languageRequirement: { type: String, default: "" },
    timezoneOverlap: { type: String, default: "" },
    generatedJD: { type: String, default: "" },
    rubric: { type: [RubricCriteriaSchema], default: [] },
    status: { type: String, enum: ["active", "paused", "closed"], default: "active" },
    candidateCount: { type: Number, default: 0 },
    reports: { type: [JobReportSchema], default: [] },
    agentMode: { type: AgentModeSchema, default: () => ({}) },
    pipelineRules: { type: [PipelineRuleSchema], default: [] },
    performanceAlerts: { type: [PerformanceAlertSchema], default: [] },
    assessmentAlert: { type: AssessmentAlertSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const RecruitJob =
  mongoose.models.RecruitJob ||
  mongoose.model<IRecruitJob>("RecruitJob", RecruitJobSchema);
