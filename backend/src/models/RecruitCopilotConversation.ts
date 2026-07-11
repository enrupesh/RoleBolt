import mongoose, { Document, Schema } from "mongoose";

export type CopilotContextLevel = "global" | "job" | "candidate";

export interface ICopilotContext {
  level: CopilotContextLevel;
  jobId?: string;
  candidateId?: string;
}

export interface ICopilotSource {
  type: "resume" | "assessment" | "interview_brief" | "score_breakdown" | "candidate_profile" | "job_description";
  label: string;
  candidateId?: string;
  candidateName?: string;
  /** Optional fine-grained pointer, e.g. "Experience Section", "Question 4" */
  detail?: string;
}

export interface ICopilotMessage {
  role: "user" | "assistant";
  content: string;
  sources: ICopilotSource[];
  quickActions: string[];
  timestamp: Date;
}

export interface IRecruitCopilotConversation extends Document {
  uid: string; // recruiter Firebase uid
  context: ICopilotContext;
  title: string;
  messages: ICopilotMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const CopilotContextSchema = new Schema<ICopilotContext>(
  {
    level: { type: String, enum: ["global", "job", "candidate"], required: true },
    jobId: { type: String },
    candidateId: { type: String },
  },
  { _id: false }
);

const CopilotSourceSchema = new Schema<ICopilotSource>(
  {
    type: {
      type: String,
      enum: ["resume", "assessment", "interview_brief", "score_breakdown", "candidate_profile", "job_description"],
      required: true,
    },
    label: { type: String, required: true },
    candidateId: { type: String },
    candidateName: { type: String },
    detail: { type: String },
  },
  { _id: false }
);

const CopilotMessageSchema = new Schema<ICopilotMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [CopilotSourceSchema], default: [] },
    quickActions: { type: [String], default: [] },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const RecruitCopilotConversationSchema = new Schema<IRecruitCopilotConversation>(
  {
    uid: { type: String, required: true, index: true },
    context: { type: CopilotContextSchema, required: true },
    title: { type: String, default: "New conversation" },
    messages: { type: [CopilotMessageSchema], default: [] },
  },
  { timestamps: true }
);

RecruitCopilotConversationSchema.index({ uid: 1, updatedAt: -1 });

export const RecruitCopilotConversation = mongoose.model<IRecruitCopilotConversation>(
  "RecruitCopilotConversation",
  RecruitCopilotConversationSchema
);
