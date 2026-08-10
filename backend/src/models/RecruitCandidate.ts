import mongoose, { Document, Schema } from "mongoose";

export type CandidateStage =
  | "applied"
  | "review_zone"
  | "screened"
  | "assessed"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type AssessmentStatus = "not_sent" | "invited" | "sent" | "completed";
export type HiringDecision = "strong_yes" | "maybe" | "no" | null;

export interface IScoreBreakdown {
  criterion: string;
  score: number;
  maxScore: number;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  tier: 1 | 2 | 3;
}

export interface IAssessmentQuestion {
  id: string;
  text: string;
}

export interface IAssessmentAnswer {
  questionId: string;
  answer: string;
  timeTakenSeconds: number;
}

export interface IAssessmentImpact {
  strengths: string[];
  weaknesses: string[];
  reasoning: string;
}

export interface IEmailLogEntry {
  type: string;
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

export interface IAgentActionEntry {
  action: "shortlisted" | "rejected" | "review_zone";
  score: number;          // 0–100 percentage
  reason: string;         // e.g. "Score 82% ≥ shortlist threshold 75%"
  emailSent: boolean;
  emailStatus: "sent" | "failed" | "skipped" | "disabled";
  timestamp: Date;
}

export interface IRecruitCandidate extends Document {
  jobId: mongoose.Types.ObjectId;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  resumeText: string;
  totalScore: number;
  maxScore: number;
  scoreBreakdown: IScoreBreakdown[];
  aiSummary: string;
  redFlags: string[];
  strengths: string[];
  stage: CandidateStage;
  notes: string;
  interviewBrief: string;
  assessmentStatus: AssessmentStatus;
  assessmentToken?: string;
  assessmentSentAt?: Date;
  assessmentCompletedAt?: Date;
  assessmentReminderSentAt?: Date;
  assessmentStartedAt?: Date;
  currentQuestionIndex?: number;
  assessmentQuestions: IAssessmentQuestion[];
  assessmentAnswers: IAssessmentAnswer[];
  previousResumeScore: number;
  hiringDecision?: HiringDecision;
  assessmentImpact?: IAssessmentImpact;
  scoringFailed?: boolean;
  source?: string;
  gender?: string;
  ageRange?: string;
  inTalentPool?: boolean;
  talentPoolNote?: string;
  stageMovedAt?: Date;
  /** Tracks which pipeline rules already fired for this candidate (ruleId → context marker). */
  pipelineRuleState?: Record<string, string>;
  emailLog: IEmailLogEntry[];
  agentLog: IAgentActionEntry[];
  offerLetter?: string;
  offerStatus?: "none" | "draft" | "approved" | "sent" | "expired";
  offerTemplate?: string;
  offerToken?: string;
  offerCandidateStatus?: "pending" | "viewed" | "accepted" | "declined" | "expired";
  offerDetails?: {
    startDate?: string;
    salary?: string;
    salaryCurrency?: string;
    signingBonus?: string;
    benefits?: string;
    companyName?: string;
    hiringManagerName?: string;
    offerExpiryDate?: string;
    reportingManager?: string;
  };
  offerSignature?: {
    signedAt?: Date;
    signerName?: string;
    signerIp?: string;
    method?: string;
  };
  offerReminderConfig?: {
    enabled: boolean;
    delayDays: number;
    frequencyDays: number;
    maxReminders: number;
    remindersSent: number;
    lastReminderSentAt?: Date;
  };
  offerVersions?: Array<{
    _id?: any;
    versionNumber: number;
    content: string;
    template: string;
    details: any;
    editedAt: Date;
    changeSummary: string;
  }>;
  offerLog?: Array<{
    _id?: any;
    action: string;
    note: string;
    timestamp: Date;
  }>;
  aiHiringSynthesis?: {
    recommendation: "hire" | "hold" | "pass";
    executiveSummary: string;
    strengths: string[];
    weaknesses: string[];
    riskFactors: string[];
    keyReasons: string[];
    overallFit: string;
    suggestedNextStep: string;
    generatedAt: Date;
    generatedBy: string;
    recruiterDecision?: "accepted" | "overridden" | "ignored";
    recruiterDecisionNote?: string;
    recruiterDecisionAt?: Date;
    recruiterDecisionBy?: string;
  };
  location?: string;
  currentStatus?: string;
  educationLevel?: string;
  currentClassYear?: string;
  availability?: string;
  coverLetter?: string;
  linkedinUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScoreBreakdownSchema = new Schema<IScoreBreakdown>(
  {
    criterion: { type: String, required: true },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    reasoning: { type: String, required: true },
    confidence: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    tier: { type: Number, enum: [1, 2, 3], default: 1 },
  },
  { _id: false }
);

const AssessmentQuestionSchema = new Schema<IAssessmentQuestion>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const AssessmentAnswerSchema = new Schema<IAssessmentAnswer>(
  {
    questionId: { type: String, required: true },
    answer: { type: String, required: true },
    timeTakenSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const AssessmentImpactSchema = new Schema<IAssessmentImpact>(
  {
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    reasoning: { type: String, default: "" },
  },
  { _id: false }
);

const RecruitCandidateSchema = new Schema<IRecruitCandidate>(
  {
    jobId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitJob", index: true },
    uid: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String },
    resumeText: { type: String, required: true },
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    scoreBreakdown: { type: [ScoreBreakdownSchema], default: [] },
    aiSummary: { type: String, default: "" },
    redFlags: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    stage: {
      type: String,
      enum: ["applied", "review_zone", "screened", "assessed", "interview", "offer", "hired", "rejected"],
      default: "applied",
    },
    notes: { type: String, default: "" },
    interviewBrief: { type: String, default: "" },
    assessmentStatus: {
      type: String,
      enum: ["not_sent", "invited", "sent", "completed"],
      default: "not_sent",
    },
    assessmentToken: { type: String, index: true, sparse: true },
    assessmentSentAt: { type: Date },
    assessmentCompletedAt: { type: Date },
    assessmentReminderSentAt: { type: Date },
    assessmentStartedAt: { type: Date },
    currentQuestionIndex: { type: Number, default: null },
    assessmentQuestions: { type: [AssessmentQuestionSchema], default: [] },
    assessmentAnswers: { type: [AssessmentAnswerSchema], default: [] },
    previousResumeScore: { type: Number, default: 0 },
    hiringDecision: {
      type: String,
      enum: ["strong_yes", "maybe", "no"],
    },
    assessmentImpact: { type: AssessmentImpactSchema },
    scoringFailed: { type: Boolean, default: false },
    source: { type: String, default: "" },
    gender: { type: String, default: "" },
    ageRange: { type: String, default: "" },
    inTalentPool: { type: Boolean, default: false },
    talentPoolNote: { type: String, default: "" },
    stageMovedAt: { type: Date },
    pipelineRuleState: { type: Schema.Types.Mixed, default: {} },
    emailLog: {
      type: [
        new Schema(
          {
            type:    { type: String, default: "custom" },
            to:      { type: String, default: "" },
            subject: { type: String, default: "" },
            body:    { type: String, default: "" },
            sentAt:  { type: Date,   default: Date.now },
            status:  { type: String, enum: ["sent", "failed", "skipped"], default: "sent" },
            error:   { type: String },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    agentLog: {
      type: [
        new Schema(
          {
            action:      { type: String, enum: ["shortlisted", "rejected", "review_zone"], required: true },
            score:       { type: Number, required: true },
            reason:      { type: String, default: "" },
            emailSent:   { type: Boolean, default: false },
            emailStatus: { type: String, enum: ["sent", "failed", "skipped", "disabled"], default: "disabled" },
            timestamp:   { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    offerLetter: { type: String, default: "" },
    offerStatus: { type: String, enum: ["none", "draft", "approved", "sent", "expired"], default: "none" },
    offerTemplate: { type: String, default: "" },
    offerToken: { type: String, index: true, sparse: true },
    offerCandidateStatus: {
      type: String,
      enum: ["pending", "viewed", "accepted", "declined", "expired"],
    },
    offerSignature: {
      type: {
        signedAt:   { type: Date },
        signerName: { type: String },
        signerIp:   { type: String },
        method:     { type: String, default: "typed" },
      },
      default: undefined,
    },
    offerReminderConfig: {
      type: {
        enabled:            { type: Boolean, default: true },
        delayDays:          { type: Number, default: 2 },
        frequencyDays:      { type: Number, default: 2 },
        maxReminders:       { type: Number, default: 3 },
        remindersSent:      { type: Number, default: 0 },
        lastReminderSentAt: { type: Date },
      },
      default: undefined,
    },
    offerVersions: {
      type: [
        new Schema(
          {
            versionNumber: { type: Number, required: true },
            content:       { type: String, default: "" },
            template:      { type: String, default: "" },
            details:       { type: Schema.Types.Mixed, default: {} },
            editedAt:      { type: Date, default: Date.now },
            changeSummary: { type: String, default: "" },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    offerDetails: {
      type: {
        startDate:        { type: String },
        salary:           { type: String },
        salaryCurrency:   { type: String },
        signingBonus:     { type: String },
        benefits:         { type: String },
        companyName:      { type: String },
        hiringManagerName:{ type: String },
        offerExpiryDate:  { type: String },
        reportingManager: { type: String },
      },
      default: {},
    },
    offerLog: {
      type: [
        new Schema(
          {
            action:    { type: String, required: true },
            note:      { type: String, default: "" },
            timestamp: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    aiHiringSynthesis: {
      type: {
        recommendation:       { type: String, enum: ["hire", "hold", "pass"], required: true },
        executiveSummary:     { type: String, default: "" },
        strengths:            { type: [String], default: [] },
        weaknesses:           { type: [String], default: [] },
        riskFactors:          { type: [String], default: [] },
        keyReasons:           { type: [String], default: [] },
        overallFit:           { type: String, default: "" },
        suggestedNextStep:    { type: String, default: "" },
        generatedAt:          { type: Date, default: Date.now },
        generatedBy:          { type: String, default: "" },
        recruiterDecision:    { type: String, enum: ["accepted", "overridden", "ignored"] },
        recruiterDecisionNote:{ type: String, default: "" },
        recruiterDecisionAt:  { type: Date },
        recruiterDecisionBy:  { type: String, default: "" },
      },
      default: undefined,
    },
    location: { type: String, default: "" },
    currentStatus: { type: String, default: "" },
    educationLevel: { type: String, default: "" },
    currentClassYear: { type: String, default: "" },
    availability: { type: String, default: "" },
    coverLetter: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export const RecruitCandidate =
  mongoose.models.RecruitCandidate ||
  mongoose.model<IRecruitCandidate>("RecruitCandidate", RecruitCandidateSchema);
