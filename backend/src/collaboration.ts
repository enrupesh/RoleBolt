import express from "express";
import crypto from "crypto";
import { connectMongo } from "./db";
import { RecruitJob } from "./models/RecruitJob";
import { RecruitCandidate } from "./models/RecruitCandidate";
import {
  CollaborationPermission,
  CollaborationRole,
  COLLABORATION_PERMISSIONS,
  RecruitTeamMember,
} from "./models/RecruitTeamMember";
import { RecruitCandidateCollaboration } from "./models/RecruitCandidateCollaboration";
import { RecruitCollaborationActivity, CollaborationActivityType } from "./models/RecruitCollaborationActivity";
import { RecruitNotification } from "./models/RecruitNotification";
import { User } from "./models/User";
import { sendEmail } from "./mailer";

export const collaborationRouter = express.Router();

const ROLE_PERMISSIONS: Record<CollaborationRole, CollaborationPermission[]> = {
  recruiter: ["view_candidates", "review_candidates", "move_pipeline", "send_assessments", "schedule_interviews", "send_offers", "add_comments", "add_notes"],
  senior_recruiter: [...COLLABORATION_PERMISSIONS].filter(p => p !== "delete_job") as CollaborationPermission[],
  hiring_manager: ["view_candidates", "review_candidates", "add_comments", "submit_feedback", "approve_hiring"],
  hr_manager: ["view_candidates", "review_candidates", "add_comments", "add_notes", "approve_hiring", "view_analytics"],
  interviewer: ["view_assigned_candidates", "submit_feedback", "add_comments", "add_notes"],
  admin: [...COLLABORATION_PERMISSIONS],
};

function uidOf(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

function profileOf(req: express.Request) {
  const user = (req as any).user ?? {};
  return { uid: uidOf(req), name: user.name || user.email?.split("@")[0] || "Team member", email: user.email || "" };
}

function normalizedPermissions(role: CollaborationRole, input: unknown): CollaborationPermission[] {
  const defaults = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.recruiter;
  if (!Array.isArray(input)) return [...defaults];
  return input.filter((permission): permission is CollaborationPermission =>
    (COLLABORATION_PERMISSIONS as readonly string[]).includes(permission)
  );
}

export async function getCollaborationAccess(jobId: string, uid: string) {
  const job = await RecruitJob.findById(jobId).lean();
  if (!job) return null;
  if (job.uid === uid) return { job, owner: true, member: null, permissions: [...COLLABORATION_PERMISSIONS] as CollaborationPermission[] };
  const member = await RecruitTeamMember.findOne({ jobId, memberUid: uid, status: "active" }).lean();
  if (!member) return null;
  return { job, owner: false, member, permissions: member.permissions };
}

function hasPermission(access: Awaited<ReturnType<typeof getCollaborationAccess>>, permission: CollaborationPermission) {
  return Boolean(access && (access.owner || access.permissions.includes(permission)));
}

async function actorForUid(uid: string) {
  const user = await User.findById(uid).select("name email").lean() as any;
  return { uid, name: user?.name || user?.email?.split("@")[0] || "Team member", email: user?.email || "" };
}

async function addActivity(jobId: string, actorUid: string, type: CollaborationActivityType, action: string, metadata: Record<string, unknown> = {}, candidateId?: string) {
  await RecruitCollaborationActivity.create({ jobId, candidateId, actor: await actorForUid(actorUid), type, action, metadata });
}

export async function recordCollaborationActivity(
  jobId: string,
  actorUid: string,
  type: CollaborationActivityType,
  action: string,
  metadata: Record<string, unknown> = {},
  candidateId?: string,
) {
  return addActivity(jobId, actorUid, type, action, metadata, candidateId);
}

async function notify(uid: string, payload: { type: "mention" | "assignment" | "team_invite" | "activity"; title: string; body: string; jobId?: string; candidateId?: string }) {
  if (!uid) return;
  await RecruitNotification.create({ uid, ...payload });
}

async function candidateContext(jobId: string, candidateId: string, uid: string) {
  const access = await getCollaborationAccess(jobId, uid);
  if (!access) return null;
  const candidate = await RecruitCandidate.findOne({ _id: candidateId, jobId }).lean();
  if (!candidate) return null;
  if (!access.owner && access.permissions.includes("view_assigned_candidates")) {
    const collaboration = await RecruitCandidateCollaboration.findOne({ jobId, candidateId }).lean();
    if (collaboration?.assignedTo?.uid !== uid) return null;
  }
  return { access, candidate };
}

collaborationRouter.get("/notifications", async (req, res) => {
  try {
    await connectMongo();
    const notifications = await RecruitNotification.find({ uid: uidOf(req) }).sort({ createdAt: -1 }).limit(50).lean();
    return res.json({ notifications, unreadCount: notifications.filter(n => !n.readAt).length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.patch("/notifications/:notificationId/read", async (req, res) => {
  try {
    await connectMongo();
    await RecruitNotification.updateOne({ _id: req.params.notificationId, uid: uidOf(req) }, { $set: { readAt: new Date() } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.get("/jobs/:jobId/collaboration", async (req, res) => {
  try {
    await connectMongo();
    const uid = uidOf(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access) return res.status(404).json({ error: "Job not found or you are not on its team." });
    const [team, activity, collaborations] = await Promise.all([
      RecruitTeamMember.find({ jobId: req.params.jobId, status: { $ne: "revoked" } }).sort({ createdAt: 1 }).lean(),
      RecruitCollaborationActivity.find({ jobId: req.params.jobId }).sort({ createdAt: -1 }).limit(100).lean(),
      RecruitCandidateCollaboration.find({ jobId: req.params.jobId }).lean(),
    ]);
    const enrichedTeam = access.owner
      ? team
      : team.filter(member => member.memberUid === uid || member.status === "active");
    return res.json({ team: enrichedTeam, activity, collaborations, permissions: access.permissions, isOwner: access.owner });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.post("/jobs/:jobId/team", async (req, res) => {
  try {
    await connectMongo();
    const uid = uidOf(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "manage_team")) return res.status(403).json({ error: "You do not have permission to manage this team." });
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const name = String(req.body.name ?? "").trim();
    const role = String(req.body.role ?? "recruiter") as CollaborationRole;
    if (!email || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "A valid name and email are required." });
    if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) return res.status(400).json({ error: "Invalid team role." });
    const existing = await RecruitTeamMember.findOne({ jobId: req.params.jobId, email });
    if (existing && existing.status !== "revoked") return res.status(409).json({ error: "That person is already on this job team." });
    const invitedUser = await User.findOne({ email }).select("_id name email").lean() as any;
    const member = existing
      ? await RecruitTeamMember.findByIdAndUpdate(existing._id, { name, role, permissions: normalizedPermissions(role, req.body.permissions), status: invitedUser ? "active" : "pending", memberUid: invitedUser?._id?.toString(), inviteToken: invitedUser ? undefined : crypto.randomBytes(24).toString("hex"), notifyByEmail: req.body.notifyByEmail !== false, joinedAt: invitedUser ? new Date() : undefined }, { returnDocument: "after" }).lean()
      : await RecruitTeamMember.create({ jobId: req.params.jobId, ownerUid: access.job.uid, memberUid: invitedUser?._id?.toString(), email, name, role, permissions: normalizedPermissions(role, req.body.permissions), status: invitedUser ? "active" : "pending", inviteToken: invitedUser ? undefined : crypto.randomBytes(24).toString("hex"), notifyByEmail: req.body.notifyByEmail !== false, joinedAt: invitedUser ? new Date() : undefined });
    await addActivity(req.params.jobId, uid, "team_member_added", `Added ${name} as ${role.replace("_", " ")}`, { email, role });
    if (invitedUser?._id) await notify(invitedUser._id.toString(), { type: "team_invite", title: "You joined a hiring team", body: `You were added to ${access.job.title}.`, jobId: req.params.jobId });
    if (member?.notifyByEmail && !invitedUser) {
      setImmediate(() => sendEmail({ to: email, subject: `You're invited to collaborate on ${access.job.title}`, html: `<p>You have been invited to collaborate on <strong>${access.job.title}</strong> as ${role.replace("_", " ")}.</p>` }).catch(() => {}));
    }
    return res.status(201).json({ member });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.patch("/jobs/:jobId/team/:memberId", async (req, res) => {
  try {
    await connectMongo();
    const access = await getCollaborationAccess(req.params.jobId, uidOf(req));
    if (!access || !hasPermission(access, "manage_team")) return res.status(403).json({ error: "You do not have permission to manage this team." });
    const update: Record<string, unknown> = {};
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    if (req.body.role !== undefined) {
      if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, req.body.role)) return res.status(400).json({ error: "Invalid team role." });
      update.role = req.body.role;
      update.permissions = normalizedPermissions(req.body.role, req.body.permissions);
    } else if (req.body.permissions !== undefined) update.permissions = normalizedPermissions("recruiter", req.body.permissions);
    if (req.body.notifyByEmail !== undefined) update.notifyByEmail = Boolean(req.body.notifyByEmail);
    const member = await RecruitTeamMember.findOneAndUpdate({ _id: req.params.memberId, jobId: req.params.jobId, status: { $ne: "revoked" } }, update, { returnDocument: "after" }).lean();
    if (!member) return res.status(404).json({ error: "Team member not found." });
    await addActivity(req.params.jobId, uidOf(req), "team_member_updated", `Updated ${member.name}'s permissions`, { memberId: req.params.memberId });
    return res.json({ member });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.delete("/jobs/:jobId/team/:memberId", async (req, res) => {
  try {
    await connectMongo();
    const access = await getCollaborationAccess(req.params.jobId, uidOf(req));
    if (!access || !hasPermission(access, "manage_team")) return res.status(403).json({ error: "You do not have permission to manage this team." });
    const member = await RecruitTeamMember.findOneAndUpdate({ _id: req.params.memberId, jobId: req.params.jobId }, { status: "revoked" }, { returnDocument: "after" }).lean();
    if (!member) return res.status(404).json({ error: "Team member not found." });
    await addActivity(req.params.jobId, uidOf(req), "team_member_removed", `Removed ${member.name} from the team`, { memberId: req.params.memberId });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.post("/jobs/:jobId/team/:memberId/accept", async (req, res) => {
  try {
    await connectMongo();
    const member = await RecruitTeamMember.findOneAndUpdate({ _id: req.params.memberId, jobId: req.params.jobId, email: (profileOf(req).email).toLowerCase(), status: "pending" }, { status: "active", memberUid: uidOf(req), joinedAt: new Date(), inviteToken: undefined }, { returnDocument: "after" }).lean();
    if (!member) return res.status(404).json({ error: "Invitation not found for this account." });
    return res.json({ member });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.post("/jobs/:jobId/candidates/:candidateId/assign", async (req, res) => {
  try {
    await connectMongo();
    const uid = uidOf(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "manage_team")) return res.status(403).json({ error: "You do not have permission to assign candidates." });
    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId }).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const teamMember = await RecruitTeamMember.findOne({ _id: req.body.teamMemberId, jobId: req.params.jobId, status: "active" }).lean();
    if (!teamMember) {
      await RecruitCandidateCollaboration.updateOne({ jobId: req.params.jobId, candidateId: req.params.candidateId }, { $unset: { assignedTo: 1 }, $setOnInsert: { ownerUid: access.job.uid } }, { upsert: true });
      await addActivity(req.params.jobId, uid, "candidate_unassigned", `Unassigned ${candidate.name}`, {}, req.params.candidateId);
      return res.json({ ok: true, assignedTo: null });
    }
    const assignedTo = { teamMemberId: teamMember._id, uid: teamMember.memberUid, name: teamMember.name, email: teamMember.email, role: teamMember.role };
    await RecruitCandidateCollaboration.updateOne({ jobId: req.params.jobId, candidateId: req.params.candidateId }, { $set: { assignedTo }, $setOnInsert: { ownerUid: access.job.uid } }, { upsert: true });
    await addActivity(req.params.jobId, uid, "candidate_assigned", `Assigned ${candidate.name} to ${teamMember.name}`, { teamMemberId: teamMember._id, assignee: teamMember.name }, req.params.candidateId);
    if (teamMember.memberUid) await notify(teamMember.memberUid, { type: "assignment", title: "Candidate assigned to you", body: `${candidate.name} was assigned to you for ${access.job.title}.`, jobId: req.params.jobId, candidateId: req.params.candidateId });
    return res.json({ ok: true, assignedTo });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

async function addCollaborativeEntry(req: express.Request, res: express.Response, isNote: boolean) {
  const jobId = String(req.params.jobId);
  const candidateId = String(req.params.candidateId);
  const context = await candidateContext(jobId, candidateId, uidOf(req));
  if (!context) return res.status(404).json({ error: "Candidate not found or not assigned to you." });
  const permission = isNote ? "add_notes" : "add_comments";
  if (!hasPermission(context.access, permission)) return res.status(403).json({ error: "You do not have permission to add this entry." });
  const body = String(req.body.body ?? "").trim();
  if (!body || body.length > 10000) return res.status(400).json({ error: "Entry must contain between 1 and 10,000 characters." });
  const author = await actorForUid(uidOf(req));
  const field = isNote ? "internalNotes" : "comments";
  const entry = { body, author, createdAt: new Date(), updatedAt: new Date(), editHistory: [] };
  await RecruitCandidateCollaboration.updateOne({ jobId, candidateId }, { $setOnInsert: { ownerUid: context.access.job.uid }, $push: { [field]: entry } }, { upsert: true });
  await addActivity(jobId, uidOf(req), isNote ? "internal_note_added" : "comment_added", `${isNote ? "Added an internal note to" : "Commented on"} ${context.candidate.name}`, {}, candidateId);
  const mentionNames = [...body.matchAll(/@([A-Za-z][A-Za-z0-9._-]*)/g)].map(match => match[1].toLowerCase());
  if (!isNote && mentionNames.length) {
    const team = await RecruitTeamMember.find({ jobId, status: "active" }).lean();
    for (const member of team) {
      if (mentionNames.includes(member.name.split(/\s+/)[0].toLowerCase()) && member.memberUid !== uidOf(req)) {
        await notify(member.memberUid || "", { type: "mention", title: `${author.name} mentioned you`, body: `${author.name} mentioned you on ${context.candidate.name}.`, jobId, candidateId });
        if (member.notifyByEmail) setImmediate(() => sendEmail({ to: member.email, subject: `${author.name} mentioned you in a candidate comment`, html: `<p>${author.name} mentioned you while discussing <strong>${context.candidate.name}</strong>.</p><p>${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` }).catch(() => {}));
      }
    }
  }
  const collaboration = await RecruitCandidateCollaboration.findOne({ jobId, candidateId }).lean();
  return res.status(201).json({ collaboration });
}

collaborationRouter.post("/jobs/:jobId/candidates/:candidateId/comments", (req, res) => addCollaborativeEntry(req, res, false).catch(err => res.status(500).json({ error: err.message })));
collaborationRouter.post("/jobs/:jobId/candidates/:candidateId/internal-notes", (req, res) => addCollaborativeEntry(req, res, true).catch(err => res.status(500).json({ error: err.message })));

collaborationRouter.post("/jobs/:jobId/candidates/:candidateId/interview-feedback", async (req, res) => {
  try {
    await connectMongo();
    const jobId = String(req.params.jobId);
    const candidateId = String(req.params.candidateId);
    const context = await candidateContext(jobId, candidateId, uidOf(req));
    if (!context || !hasPermission(context.access, "submit_feedback")) {
      return res.status(403).json({ error: "You do not have permission to submit interview feedback." });
    }
    const body = String(req.body.body ?? "").trim();
    if (!body || body.length > 10000) {
      return res.status(400).json({ error: "Feedback must contain between 1 and 10,000 characters." });
    }
    const rating = req.body.rating === undefined || req.body.rating === "" ? undefined : Number(req.body.rating);
    if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "Rating must be a whole number from 1 to 5." });
    }
    const entry = {
      body,
      ...(rating === undefined ? {} : { rating }),
      author: await actorForUid(uidOf(req)),
      createdAt: new Date(),
      updatedAt: new Date(),
      editHistory: [],
    };
    await RecruitCandidateCollaboration.updateOne(
      { jobId, candidateId },
      { $setOnInsert: { ownerUid: context.access.job.uid }, $push: { interviewFeedback: entry } },
      { upsert: true },
    );
    await addActivity(
      jobId,
      uidOf(req),
      "interview_feedback",
      `Submitted interview feedback for ${context.candidate.name}`,
      { rating: rating ?? null },
      candidateId,
    );
    const collaboration = await RecruitCandidateCollaboration.findOne({ jobId, candidateId }).lean();
    return res.status(201).json({ collaboration });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.patch("/jobs/:jobId/candidates/:candidateId/comments/:commentId", async (req, res) => {
  try {
    await connectMongo();
    const context = await candidateContext(req.params.jobId, req.params.candidateId, uidOf(req));
    if (!context || !hasPermission(context.access, "add_comments")) return res.status(403).json({ error: "You do not have permission to edit comments." });
    const body = String(req.body.body ?? "").trim();
    const collaboration = await RecruitCandidateCollaboration.findOne({ jobId: req.params.jobId, candidateId: req.params.candidateId });
    const comment: any = collaboration?.comments.find((item: any) => item._id?.toString() === req.params.commentId);
    if (!collaboration || !comment) return res.status(404).json({ error: "Comment not found." });
    if (comment.author.uid !== uidOf(req) && !context.access.owner) return res.status(403).json({ error: "You can only edit your own comments." });
    comment.editHistory.push({ body: comment.body, editedAt: new Date() });
    comment.body = body; comment.updatedAt = new Date();
    await collaboration.save();
    await addActivity(req.params.jobId, uidOf(req), "comment_edited", `Edited a comment on ${context.candidate.name}`, {}, req.params.candidateId);
    return res.json({ collaboration });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.get("/jobs/:jobId/candidates/:candidateId/collaboration", async (req, res) => {
  try {
    await connectMongo();
    const context = await candidateContext(req.params.jobId, req.params.candidateId, uidOf(req));
    if (!context) return res.status(404).json({ error: "Candidate not found or not assigned to you." });
    const collaboration = await RecruitCandidateCollaboration.findOne({ jobId: req.params.jobId, candidateId: req.params.candidateId }).lean();
    return res.json({ collaboration: collaboration ?? { comments: [], internalNotes: [], assignedTo: null } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export { ROLE_PERMISSIONS, hasPermission };