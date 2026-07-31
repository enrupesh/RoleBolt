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

export interface IFormAgentMode {
  enabled: boolean;
  shortlistThreshold: number;
  rejectThreshold: number;
  autoEmailShortlist: boolean;
  autoEmailReject: boolean;
}

export interface IRecruitForm extends Document {
  uid: string;
  title: string;
  description: string;
  slug: string;
  questions: IFormQuestion[];
  status: "active" | "closed";
  responseCount: number;
  agentMode: IFormAgentMode;
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

const FormAgentModeSchema = new Schema<IFormAgentMode>(
  {
    enabled: { type: Boolean, default: false },
    shortlistThreshold: { type: Number, default: 75, min: 0, max: 100 },
    rejectThreshold: { type: Number, default: 40, min: 0, max: 100 },
    autoEmailShortlist: { type: Boolean, default: true },
    autoEmailReject: { type: Boolean, default: false },
  },
  { _id: false }
);

const RecruitFormSchema = new Schema<IRecruitForm>(
  {
    uid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    slug: { type: String, required: true, unique: true, index: true },
    questions: { type: [FormQuestionSchema], default: [] },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    responseCount: { type: Number, default: 0 },
    agentMode: { type: FormAgentModeSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const RecruitForm =
  mongoose.models.RecruitForm ||
  mongoose.model<IRecruitForm>("RecruitForm", RecruitFormSchema);
