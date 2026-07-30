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
  confidence: "High" | "Medium" | "Low";
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
  stage: "new" | "shortlisted" | "interview" | "hired" | "rejected";
  submittedName: string;
  submittedEmail: string;
  submittedPhone: string;
  emailLog: IEmailLogEntry[];
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
    confidence: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
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
      enum: ["new", "shortlisted", "interview", "hired", "rejected"],
      default: "new",
    },
    submittedName: { type: String, default: "" },
    submittedEmail: { type: String, default: "" },
    submittedPhone: { type: String, default: "" },
    emailLog: { type: [EmailLogEntrySchema], default: [] },
  },
  { timestamps: true }
);

export const RecruitFormResponse =
  mongoose.models.RecruitFormResponse ||
  mongoose.model<IRecruitFormResponse>("RecruitFormResponse", RecruitFormResponseSchema);
