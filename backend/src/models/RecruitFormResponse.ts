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
  interviewQuestions: string[];
  scoringFailed: boolean;
  stage: "new" | "shortlisted" | "interview" | "hired" | "rejected";
  submittedName: string;
  submittedEmail: string;
  submittedPhone: string;
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
  },
  { timestamps: true }
);

export const RecruitFormResponse =
  mongoose.models.RecruitFormResponse ||
  mongoose.model<IRecruitFormResponse>("RecruitFormResponse", RecruitFormResponseSchema);
