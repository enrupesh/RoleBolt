import mongoose, { Document, Schema } from "mongoose";

export type CandidateStage =
  | "applied"
  | "screened"
  | "assessed"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type AssessmentStatus = "not_sent" | "sent" | "completed";
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
  offerLetter?: string;
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
      enum: ["applied", "screened", "assessed", "interview", "offer", "hired", "rejected"],
      default: "applied",
    },
    notes: { type: String, default: "" },
    interviewBrief: { type: String, default: "" },
    assessmentStatus: {
      type: String,
      enum: ["not_sent", "sent", "completed"],
      default: "not_sent",
    },
    assessmentToken: { type: String, index: true, sparse: true },
    assessmentSentAt: { type: Date },
    assessmentCompletedAt: { type: Date },
    assessmentReminderSentAt: { type: Date },
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
    offerLetter: { type: String, default: "" },
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
