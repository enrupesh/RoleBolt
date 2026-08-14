import mongoose, { Document, Schema } from "mongoose";

export type CopilotWorkspace = "standard" | "form";

export type CopilotContextLevel =
  | "global"
  | "job"
  | "candidate"
  | "form_global"
  | "form"
  | "form_applicant";

export interface ICopilotContext {
  workspace?: CopilotWorkspace;
  level: CopilotContextLevel;
  jobId?: string;
  candidateId?: string;
  formId?: string;
  responseId?: string;
}

export interface ICopilotSource {
  /** What kind of document this source links to */
  type:
    | "resume"
    | "assessment"
    | "interview_brief"
    | "score_breakdown"
    | "candidate_profile"
    | "job_description"
    | "form_description"
    | "form_response";
  /** Human-readable chip label shown in the UI, e.g. "Rahul — Resume" */
  label: string;
  /** MongoDB _id of the candidate this source belongs to */
  candidateId?: string;
  /** Display name of the candidate */
  candidateName?: string;
  /** Candidate's email, looked up from the database server-side — never AI-generated */
  candidateEmail?: string;
  /** Candidate's fit score %, looked up from the database server-side — never AI-generated */
  candidateFitScorePct?: number;
  /** MongoDB _id of the job this source's candidate belongs to (needed for deep-links from Global context) */
  jobId?: string;
  /** Display title of the job */
  jobTitle?: string;
  /** MongoDB _id of the resume document (for future deep-link) */
  resumeId?: string;
  /** MongoDB _id of the assessment record */
  assessmentId?: string;
  /** Page number inside a resume PDF (1-based) */
  page?: number;
  /** Named section inside the document, e.g. "experience", "skills" */
  sectionId?: string;
  /** Fine-grained human pointer shown as tooltip, e.g. "Experience Section", "Question 4" */
  detail?: string;
}

export interface ICopilotMessage {
  role: "user" | "assistant";
  /** Markdown reply text */
  content: string;
  /** Single clear action the AI recommends, e.g. "Interview Rahul first" */
  recommendation?: string;
  /** 0–100 confidence in the recommendation */
  confidence?: number;
  /** One-sentence reason behind the recommendation */
  reasoning?: string;
  sources: ICopilotSource[];
  quickActions: string[];
  timestamp: Date;
}

export interface IRecruitCopilotConversation extends Document {
  uid: string;
  context: ICopilotContext;
  title: string;
  /** Denormalised for fast sidebar rendering */
  selectedJobId?: string;
  selectedJobTitle?: string;
  /** Candidate context — set when level === "candidate" */
  selectedCandidateId?: string;
  selectedCandidateName?: string;
  /** Form context — denormalised for sidebar */
  selectedFormId?: string;
  selectedFormTitle?: string;
  selectedResponseId?: string;
  selectedResponseName?: string;
  lastActiveAt: Date;
  totalMessages: number;
  messages: ICopilotMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const CopilotContextSchema = new Schema<ICopilotContext>(
  {
    workspace: { type: String, enum: ["standard", "form"] },
    level: {
      type: String,
      enum: ["global", "job", "candidate", "form_global", "form", "form_applicant"],
      required: true,
    },
    jobId: { type: String },
    candidateId: { type: String },
    formId: { type: String },
    responseId: { type: String },
  },
  { _id: false }
);

const CopilotSourceSchema = new Schema<ICopilotSource>(
  {
    type: {
      type: String,
      enum: [
        "resume",
        "assessment",
        "interview_brief",
        "score_breakdown",
        "candidate_profile",
        "job_description",
        "form_description",
        "form_response",
      ],
      required: true,
    },
    label: { type: String, required: true },
    candidateId: { type: String },
    candidateName: { type: String },
    candidateEmail: { type: String },
    candidateFitScorePct: { type: Number },
    jobId: { type: String },
    jobTitle: { type: String },
    resumeId: { type: String },
    assessmentId: { type: String },
    page: { type: Number },
    sectionId: { type: String },
    detail: { type: String },
  },
  { _id: false }
);

const CopilotMessageSchema = new Schema<ICopilotMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    recommendation: { type: String },
    confidence: { type: Number, min: 0, max: 100 },
    reasoning: { type: String },
    sources: { type: [CopilotSourceSchema], default: [] },
    quickActions: { type: [String], default: [] },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const RecruitCopilotConversationSchema = new Schema<IRecruitCopilotConversation>(
  {
    uid: { type: String, required: true, index: true },
    context: { type: CopilotContextSchema, required: true },
    title: { type: String, default: "New conversation" },
    selectedJobId: { type: String },
    selectedJobTitle: { type: String },
    selectedCandidateId: { type: String },
    selectedCandidateName: { type: String },
    selectedFormId: { type: String },
    selectedFormTitle: { type: String },
    selectedResponseId: { type: String },
    selectedResponseName: { type: String },
    lastActiveAt: { type: Date, default: () => new Date() },
    totalMessages: { type: Number, default: 0 },
    messages: { type: [CopilotMessageSchema], default: [] },
  },
  { timestamps: true }
);

// Compound index for sidebar: list conversations sorted by activity
RecruitCopilotConversationSchema.index({ uid: 1, lastActiveAt: -1 });

export const RecruitCopilotConversation = mongoose.model<IRecruitCopilotConversation>(
  "RecruitCopilotConversation",
  RecruitCopilotConversationSchema
);
