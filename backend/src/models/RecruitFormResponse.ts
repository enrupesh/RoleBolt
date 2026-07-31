import mongoose, { Document, Schema } from "mongoose";

export interface IFormAnswer {
  questionId: string;
  label: string;
  value: string;
}

export interface IAnswerSignal {
  questionId: string;
  signal: "strong" | "ok" | "thin";
  note: string;
}

export interface IQuestionScore {
  questionId: string;
  score: number; // 0-10
  strengths: string[];
  weaknesses: string[];
  feedback: string;
}

export interface IEmailLogEntry {
  type: string;
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
  status: "sent" | "failed";
  error?: string;
}

export interface IAgentActionEntry {
  action: "shortlisted" | "rejected" | "review_zone";
  score: number;   // 0–100 aiScore at the time the agent acted
  reason: string;
  emailSent: boolean;
  emailStatus: "sent" | "failed" | "skipped" | "disabled";
  runKey?: string;
  timestamp: Date;
}

export interface IFormStageHistoryEntry {
  fromStage: string;
  toStage: string;
  actor: "recruiter" | "agent" | "rule" | "system";
  actorUid: string;
  reason: string;
  timestamp: Date;
}

export type FormAssessmentStatus = "not_sent" | "sent" | "in_progress" | "completed";
export type FormAssessmentScoringStatus = "not_started" | "pending" | "completed" | "failed";

export interface IFormAssessmentQuestion {
  id: string;
  text: string;
}

export interface IFormAssessmentAnswer {
  questionId: string;
  answer: string;
  timeTakenSeconds: number;
}

export interface IRecruitFormResponse extends Document {
  formId: mongoose.Types.ObjectId;
  uid: string; // owner of the form (recruiter)
  answers: IFormAnswer[];
  resumeText: string;
  aiSummary: string;
  aiScore: number; // 0-100
  strengths: string[];
  redFlags: string[];
  answerSignals: IAnswerSignal[];
  questionScores: IQuestionScore[];
  interviewQuestions: string[];
  scoringFailed: boolean;
  stage:
    | "new"
    | "scored"
    | "review_zone"
    | "shortlisted"
    | "assessment"
    | "interview"
    | "offer"
    | "hired"
    | "rejected"
    | "withdrawn";
  submittedName: string;
  submittedEmail: string;
  submittedPhone: string;
  emailLog: IEmailLogEntry[];
  agentLog: IAgentActionEntry[];
  agentRunKeys: string[];
  notes: string;
  source: string;
  stageMovedAt: Date;
  stageHistory: IFormStageHistoryEntry[];
  assessmentStatus: FormAssessmentStatus;
  assessmentToken?: string;
  assessmentSentAt?: Date;
  assessmentStartedAt?: Date;
  assessmentCompletedAt?: Date;
  assessmentQuestions: IFormAssessmentQuestion[];
  assessmentAnswers: IFormAssessmentAnswer[];
  assessmentCurrentQuestionIndex: number;
  assessmentScore: number;
  assessmentSummary: string;
  assessmentStrengths: string[];
  assessmentWeaknesses: string[];
  assessmentScoringStatus: FormAssessmentScoringStatus;
  assessmentRunKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const FormAnswerSchema = new Schema<IFormAnswer>(
  {
    questionId: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: String, default: "" },
  },
  { _id: false }
);

const AnswerSignalSchema = new Schema<IAnswerSignal>(
  {
    questionId: { type: String, required: true },
    signal: { type: String, enum: ["strong", "ok", "thin"], required: true },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const QuestionScoreSchema = new Schema<IQuestionScore>(
  {
    questionId: { type: String, required: true },
    score: { type: Number, default: 0 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    feedback: { type: String, default: "" },
  },
  { _id: false }
);

const EmailLogEntrySchema = new Schema<IEmailLogEntry>(
  {
    type: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["sent", "failed"], default: "sent" },
    error: { type: String },
  },
  { _id: false }
);

const AgentActionEntrySchema = new Schema<IAgentActionEntry>(
  {
    action:      { type: String, enum: ["shortlisted", "rejected", "review_zone"], required: true },
    score:       { type: Number, default: 0 },
    reason:      { type: String, default: "" },
    emailSent:   { type: Boolean, default: false },
    emailStatus: { type: String, enum: ["sent", "failed", "skipped", "disabled"], default: "disabled" },
    runKey:      { type: String, default: "" },
    timestamp:   { type: Date, default: Date.now },
  },
  { _id: false }
);

const FormStageHistorySchema = new Schema<IFormStageHistoryEntry>(
  {
    fromStage: { type: String, required: true },
    toStage: { type: String, required: true },
    actor: { type: String, enum: ["recruiter", "agent", "rule", "system"], required: true },
    actorUid: { type: String, default: "" },
    reason: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FormAssessmentQuestionSchema = new Schema<IFormAssessmentQuestion>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const FormAssessmentAnswerSchema = new Schema<IFormAssessmentAnswer>(
  {
    questionId: { type: String, required: true },
    answer: { type: String, required: true },
    timeTakenSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const RecruitFormResponseSchema = new Schema<IRecruitFormResponse>(
  {
    formId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitForm", index: true },
    uid: { type: String, required: true, index: true },
    answers: { type: [FormAnswerSchema], default: [] },
    resumeText: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    aiScore: { type: Number, default: 0 },
    strengths: { type: [String], default: [] },
    redFlags: { type: [String], default: [] },
    answerSignals: { type: [AnswerSignalSchema], default: [] },
    questionScores: { type: [QuestionScoreSchema], default: [] },
    interviewQuestions: { type: [String], default: [] },
    scoringFailed: { type: Boolean, default: false },
    stage: {
      type: String,
      enum: [
        "new", "scored", "review_zone", "shortlisted", "assessment",
        "interview", "offer", "hired", "rejected", "withdrawn",
      ],
      default: "new",
    },
    submittedName: { type: String, default: "" },
    submittedEmail: { type: String, default: "" },
    submittedPhone: { type: String, default: "" },
    emailLog: { type: [EmailLogEntrySchema], default: [] },
    agentLog: { type: [AgentActionEntrySchema], default: [] },
    agentRunKeys: { type: [String], default: [] },
    notes: { type: String, default: "" },
    source: { type: String, default: "Form" },
    stageMovedAt: { type: Date, default: Date.now },
    stageHistory: { type: [FormStageHistorySchema], default: [] },
    assessmentStatus: {
      type: String,
      enum: ["not_sent", "sent", "in_progress", "completed"],
      default: "not_sent",
    },
    assessmentToken: { type: String, index: true, sparse: true },
    assessmentSentAt: { type: Date },
    assessmentStartedAt: { type: Date },
    assessmentCompletedAt: { type: Date },
    assessmentQuestions: { type: [FormAssessmentQuestionSchema], default: [] },
    assessmentAnswers: { type: [FormAssessmentAnswerSchema], default: [] },
    assessmentCurrentQuestionIndex: { type: Number, default: 0 },
    assessmentScore: { type: Number, default: 0 },
    assessmentSummary: { type: String, default: "" },
    assessmentStrengths: { type: [String], default: [] },
    assessmentWeaknesses: { type: [String], default: [] },
    assessmentScoringStatus: {
      type: String,
      enum: ["not_started", "pending", "completed", "failed"],
      default: "not_started",
    },
    assessmentRunKey: { type: String, default: "" },
  },
  { timestamps: true }
);

export const RecruitFormResponse =
  mongoose.models.RecruitFormResponse ||
  mongoose.model<IRecruitFormResponse>("RecruitFormResponse", RecruitFormResponseSchema);
