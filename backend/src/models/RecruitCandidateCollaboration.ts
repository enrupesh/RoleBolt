import mongoose, { Document, Schema } from "mongoose";

export interface ICollaborationAuthor {
  uid: string;
  name: string;
  email: string;
}

export interface ICommentHistory {
  body: string;
  editedAt: Date;
}

export interface ICollaborativeComment {
  _id?: mongoose.Types.ObjectId;
  body: string;
  author: ICollaborationAuthor;
  createdAt: Date;
  updatedAt: Date;
  editHistory: ICommentHistory[];
}

export interface IInternalNote {
  _id?: mongoose.Types.ObjectId;
  body: string;
  author: ICollaborationAuthor;
  createdAt: Date;
  updatedAt: Date;
  editHistory: ICommentHistory[];
}

export interface IInterviewFeedback {
  _id?: mongoose.Types.ObjectId;
  body: string;
  rating?: number;
  author: ICollaborationAuthor;
  createdAt: Date;
  updatedAt: Date;
  editHistory: ICommentHistory[];
}

export interface IAssignedTeamMember {
  uid?: string;
  teamMemberId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: string;
}

export interface IRecruitCandidateCollaboration extends Document {
  jobId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  ownerUid: string;
  assignedTo?: IAssignedTeamMember;
  comments: ICollaborativeComment[];
  internalNotes: IInternalNote[];
  interviewFeedback: IInterviewFeedback[];
  createdAt: Date;
  updatedAt: Date;
}

const AuthorSchema = new Schema<ICollaborationAuthor>(
  { uid: String, name: String, email: String },
  { _id: false }
);
const HistorySchema = new Schema<ICommentHistory>(
  { body: String, editedAt: { type: Date, default: Date.now } },
  { _id: false }
);
const CommentSchema = new Schema<ICollaborativeComment>({
  body: { type: String, required: true, maxlength: 10000 },
  author: { type: AuthorSchema, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  editHistory: { type: [HistorySchema], default: [] },
});
const NoteSchema = new Schema<IInternalNote>({
  body: { type: String, required: true, maxlength: 10000 },
  author: { type: AuthorSchema, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  editHistory: { type: [HistorySchema], default: [] },
});
const InterviewFeedbackSchema = new Schema<IInterviewFeedback>({
  body: { type: String, required: true, maxlength: 10000 },
  rating: { type: Number, min: 1, max: 5 },
  author: { type: AuthorSchema, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  editHistory: { type: [HistorySchema], default: [] },
});
const AssignedTeamMemberSchema = new Schema<IAssignedTeamMember>(
  {
    uid: String,
    teamMemberId: { type: Schema.Types.ObjectId, required: true },
    name: String,
    email: String,
    role: String,
  },
  { _id: false }
);

const RecruitCandidateCollaborationSchema = new Schema<IRecruitCandidateCollaboration>(
  {
    jobId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitJob", index: true },
    candidateId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitCandidate", index: true },
    ownerUid: { type: String, required: true, index: true },
    assignedTo: { type: AssignedTeamMemberSchema },
    comments: { type: [CommentSchema], default: [] },
    internalNotes: { type: [NoteSchema], default: [] },
    interviewFeedback: { type: [InterviewFeedbackSchema], default: [] },
  },
  { timestamps: true }
);

RecruitCandidateCollaborationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

export const RecruitCandidateCollaboration =
  mongoose.models.RecruitCandidateCollaboration ||
  mongoose.model<IRecruitCandidateCollaboration>(
    "RecruitCandidateCollaboration",
    RecruitCandidateCollaborationSchema
  );
