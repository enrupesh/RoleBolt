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
import { NOTIFICATION_FROM } from "./emailConfig";
import { callMeshChatCompletions } from "./ai/meshClient";
import * as emailTemplates from "./emailTemplates";
import {
  assertStandardResourceLimit,
  respondStandardBillingError,
  standardBillingOwnerUid,
} from "./billing/standardEnforcement";

const GEMINI_MESH_KEY = process.env.GEMINI_MESH_KEY ?? "";

const FRONTEND_URL = (() => {
  const raw = process.env.FRONTEND_URL ?? "";
  if (raw && !raw.includes("localhost") && !raw.includes("127.0.0.1")) return raw.replace(/\/$/, "");
  return "https://www.rolebolt.tech";
})();

const TEAM_INVITE_EXPIRY_DAYS = 14;

export const collaborationRouter = express.Router();
export const collaborationPublicRouter = express.Router();

const ROLE_PERMISSIONS: Record<CollaborationRole, CollaborationPermission[]> = {
  recruiter: ["view_candidates", "review_candidates", "move_pipeline", "send_assessments", "schedule_interviews", "send_offers", "add_comments", "add_notes"],
  senior_recruiter: [...COLLABORATION_PERMISSIONS].filter(p => p !== "delete_job") as CollaborationPermission[],
  hiring_manager: ["view_candidates", "review_candidates", "add_comments", "submit_feedback", "approve_hiring"],
  hr_manager: ["view_candidates", "review_candidates", "add_comments", "add_notes", "approve_hiring", "view_analytics"],
  interviewer: ["view_assigned_candidates", "submit_feedback", "add_comments", "add_notes"],
  admin: [...COLLABORATION_PERMISSIONS],
};

const ROLE_LABELS: Record<CollaborationRole, string> = {
  recruiter: "Recruiter",
  senior_recruiter: "Senior Recruiter",
  hiring_manager: "Hiring Manager",
  hr_manager: "HR Manager",
  interviewer: "Interviewer",
  admin: "Admin",
};

const ROLE_CAPABILITY_BULLETS: Record<CollaborationRole, string[]> = {
  recruiter: [
    "Review and score candidates",
    "Move candidates through the hiring pipeline",
    "Send assessments and offer letters",
  ],
  senior_recruiter: [
    "Full pipeline management",
    "Manage team members and assignments",
    "Configure job settings and analytics",
  ],
  hiring_manager: [
    "Review shortlisted candidates",
    "Submit interview feedback",
    "Approve final hiring decisions",
  ],
  hr_manager: [
    "Review candidates and hiring analytics",
    "Add internal notes and comments",
    "Approve hiring decisions",
  ],
  interviewer: [
    "View assigned candidates only",
    "Submit structured interview feedback",
    "Add comments on candidates you interview",
  ],
  admin: [
    "Full access to this hiring workspace",
    "Manage team, job settings, and all candidates",
  ],
};

function roleLabel(role: CollaborationRole): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

function inviteExpiryDate(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + TEAM_INVITE_EXPIRY_DAYS);
  return d;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.length <= 2 ? local[0] ?? "*" : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function isInviteExpired(member: { inviteExpiresAt?: Date | null }): boolean {
  if (!member.inviteExpiresAt) return false;
  return new Date(member.inviteExpiresAt).getTime() < Date.now();
}

async function sendTeamInviteEmail(args: {
  member: any;
  job: any;
  inviterName: string;
  role: CollaborationRole;
}) {
  const { member, job, inviterName, role } = args;
  if (!member?.email || !member.notifyByEmail) return;

  const companyName = (job as any).companyName ?? "";
  const jobTitle = (job as any).title ?? "Hiring workspace";
  const inviteToken = member.inviteToken as string | undefined;

  if (member.status === "pending" && inviteToken) {
    const acceptUrl = `${FRONTEND_URL}/recruit/team-invite/${inviteToken}`;
    const expiresAt = member.inviteExpiresAt ? new Date(member.inviteExpiresAt) : inviteExpiryDate();
    const payload = emailTemplates.teamInviteEmail({
      inviteeName: member.name,
      inviterName,
      companyName,
      jobTitle,
      roleLabel: roleLabel(role),
      permissionBullets: ROLE_CAPABILITY_BULLETS[role] ?? [],
      acceptUrl,
      expiresAt,
    });
    const result = await sendEmail({
      to: member.email,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      from: NOTIFICATION_FROM,
    });
    if (!result.ok) console.error("[collaboration] team invite email failed:", result.error);
    return;
  }

  if (member.status === "active") {
    const jobUrl = `${FRONTEND_URL}/recruit/jobs/${job._id}`;
    const payload = emailTemplates.teamMemberAddedEmail({
      memberName: member.name,
      inviterName,
      companyName,
      jobTitle,
      roleLabel: roleLabel(role),
      jobUrl,
    });
    const result = await sendEmail({
      to: member.email,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      from: NOTIFICATION_FROM,
    });
    if (!result.ok) console.error("[collaboration] team added email failed:", result.error);
  }
}

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
  // Private jobs are owner-only. This boundary is shared by recruiter job
  // detail and every collaboration-protected job/candidate action.
  if (job.publicVisibility === false) return null;
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
    // Recruiter seats are a Standard plan resource (Free = 1 seat). Fail closed
    // before creating a new invite when re-inviting a previously revoked member
    // or adding a brand-new one.
    if (!existing || existing.status === "revoked") {
      await assertStandardResourceLimit(standardBillingOwnerUid(access.job), "recruiter_seats");
    }
    const invitedUser = await User.findOne({ email }).select("_id name email").lean() as any;
    const inviteToken = invitedUser ? undefined : crypto.randomBytes(24).toString("hex");
    const inviteExpiresAt = invitedUser ? undefined : inviteExpiryDate();
    const memberPayload = {
      name,
      role,
      permissions: normalizedPermissions(role, req.body.permissions),
      status: invitedUser ? "active" as const : "pending" as const,
      memberUid: invitedUser?._id?.toString(),
      inviteToken,
      inviteExpiresAt,
      notifyByEmail: req.body.notifyByEmail !== false,
      joinedAt: invitedUser ? new Date() : undefined,
    };
    const member = existing
      ? await RecruitTeamMember.findByIdAndUpdate(existing._id, memberPayload, { returnDocument: "after" }).lean()
      : await RecruitTeamMember.create({ jobId: req.params.jobId, ownerUid: access.job.uid, email, ...memberPayload }).then(m => m.toObject());
    const inviter = await actorForUid(uid);
    await addActivity(req.params.jobId, uid, "team_member_added", `Added ${name} as ${roleLabel(role)}`, { email, role });
    if (invitedUser?._id) {
      await notify(invitedUser._id.toString(), {
        type: "team_invite",
        title: "You joined a hiring team",
        body: `You were added to ${access.job.title}.`,
        jobId: req.params.jobId,
      });
    }
    if (member?.notifyByEmail) {
      setImmediate(() => {
        sendTeamInviteEmail({ member, job: access.job, inviterName: inviter.name, role }).catch(err =>
          console.error("[collaboration] invite email failed:", err),
        );
      });
    }
    return res.status(201).json({ member });
  } catch (err: any) {
    const access = await getCollaborationAccess(req.params.jobId, uidOf(req)).catch(() => null);
    if (access && await respondStandardBillingError(res, err, standardBillingOwnerUid(access.job))) return;
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
    const member = await RecruitTeamMember.findOneAndUpdate({ _id: req.params.memberId, jobId: req.params.jobId, email: (profileOf(req).email).toLowerCase(), status: "pending" }, { status: "active", memberUid: uidOf(req), joinedAt: new Date(), inviteToken: undefined, inviteExpiresAt: undefined }, { returnDocument: "after" }).lean();
    if (!member) return res.status(404).json({ error: "Invitation not found for this account." });
    return res.json({ member });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** Accept a pending team invite via secure email link token. */
collaborationRouter.post("/team-invite/:token/accept", async (req, res) => {
  try {
    await connectMongo();
    const profile = profileOf(req);
    if (!profile.email) return res.status(401).json({ error: "You must be signed in to accept this invitation." });

    const member = await RecruitTeamMember.findOne({
      inviteToken: req.params.token,
      status: "pending",
    });
    if (!member) return res.status(404).json({ error: "This invitation was not found or has already been accepted." });
    if (isInviteExpired(member)) {
      return res.status(410).json({ error: "This invitation has expired. Please ask the job owner to send a new invite." });
    }
    if (member.email.toLowerCase() !== profile.email.toLowerCase()) {
      return res.status(403).json({
        error: `This invitation was sent to ${maskEmail(member.email)}. Please sign in with that email address to accept.`,
        expectedEmailMasked: maskEmail(member.email),
      });
    }

    member.status = "active";
    member.memberUid = uidOf(req);
    member.joinedAt = new Date();
    member.inviteToken = undefined;
    member.inviteExpiresAt = undefined;
    await member.save();

    const job = await RecruitJob.findById(member.jobId).lean();
    await addActivity(
      String(member.jobId),
      uidOf(req),
      "team_member_added",
      `${member.name} accepted the team invitation`,
      { email: member.email, role: member.role },
    );
    await notify(uidOf(req), {
      type: "team_invite",
      title: "Welcome to the hiring team",
      body: `You joined ${(job as any)?.title ?? "a hiring workspace"}.`,
      jobId: String(member.jobId),
    });

    return res.json({
      ok: true,
      jobId: String(member.jobId),
      jobTitle: (job as any)?.title ?? "",
      member,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

collaborationPublicRouter.get("/team-invite/:token", async (req, res) => {
  try {
    await connectMongo();
    const member = await RecruitTeamMember.findOne({
      inviteToken: req.params.token,
      status: "pending",
    }).lean();
    if (!member) return res.status(404).json({ error: "This invitation was not found or has already been accepted." });

    const expired = isInviteExpired(member);
    const job = await RecruitJob.findById(member.jobId).lean();
    if (!job) return res.status(404).json({ error: "The associated job no longer exists." });

    const inviter = await User.findById((job as any).uid).select("name email").lean() as any;
    const inviterName = inviter?.name || inviter?.email?.split("@")[0] || "A team member";
    const role = member.role as CollaborationRole;

    return res.json({
      inviteeName: member.name,
      inviteeEmailMasked: maskEmail(member.email),
      jobTitle: (job as any).title ?? "",
      companyName: (job as any).companyName ?? "",
      role,
      roleLabel: roleLabel(role),
      permissionBullets: ROLE_CAPABILITY_BULLETS[role] ?? [],
      inviterName,
      expiresAt: member.inviteExpiresAt,
      expired,
      jobId: String(member.jobId),
    });
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
        if (member.notifyByEmail) setImmediate(() => sendEmail({ to: member.email, subject: `${author.name} mentioned you in a candidate comment`, html: `<p>${author.name} mentioned you while discussing <strong>${context.candidate.name}</strong>.</p><p>${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`, from: NOTIFICATION_FROM }).catch(() => {}));
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
    const uid = uidOf(req);
    const context = await candidateContext(jobId, candidateId, uid);
    if (!context || !hasPermission(context.access, "submit_feedback")) {
      return res.status(403).json({ error: "You do not have permission to submit interview feedback." });
    }
    const body = String(req.body.body ?? "").trim();
    if (body.length > 10000) return res.status(400).json({ error: "Additional comments must be under 10,000 characters." });

    // Overall rating (1-5, optional)
    const rating = req.body.rating === undefined || req.body.rating === "" ? undefined : Number(req.body.rating);
    if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "Rating must be a whole number from 1 to 5." });
    }

    // Per-category structured ratings (all optional, each 1-5)
    const RATING_KEYS = ["technicalSkills", "communicationSkills", "problemSolving", "cultureFit", "leadership", "roleSpecificSkills", "overallRecommendation"] as const;
    const rawRatings = req.body.ratings ?? {};
    const ratings: Record<string, number> = {};
    for (const key of RATING_KEYS) {
      const val = rawRatings[key];
      if (val !== undefined && val !== "" && val !== null) {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 5) return res.status(400).json({ error: `Rating for ${key} must be 1–5.` });
        ratings[key] = n;
      }
    }
    const hasRatings = Object.keys(ratings).length > 0;
    if (!body && !hasRatings) return res.status(400).json({ error: "At least one rating or a comment is required." });

    const actorInfo = await actorForUid(uid);
    const entry = {
      body,
      ...(rating === undefined ? {} : { rating }),
      ...(hasRatings ? { ratings } : {}),
      author: actorInfo,
      createdAt: new Date(),
      updatedAt: new Date(),
      editHistory: [],
    };
    await RecruitCandidateCollaboration.updateOne(
      { jobId, candidateId },
      { $setOnInsert: { ownerUid: context.access.job.uid }, $push: { interviewFeedback: entry } },
      { upsert: true },
    );

    // Compute average of structured ratings for activity metadata
    const ratingValues = Object.values(ratings);
    const avgRating = hasRatings ? +(ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1) : (rating ?? null);
    await addActivity(
      jobId, uid, "interview_feedback",
      `${actorInfo.name} submitted interview feedback for ${context.candidate.name}`,
      { rating: avgRating, categories: Object.keys(ratings) },
      candidateId,
    );

    // Post-submission: notify reviewers and check if all interviewers have submitted
    setImmediate(async () => {
      try {
        const collaboration = await RecruitCandidateCollaboration.findOne({ jobId, candidateId }).lean() as any;
        const submittedUids: Set<string> = new Set(
          (collaboration?.interviewFeedback ?? []).map((f: any) => f.author?.uid).filter(Boolean)
        );

        // All active team members who have submit_feedback permission
        const teamMembers = await RecruitTeamMember.find({ jobId, status: "active" }).lean();
        const feedbackMembers = teamMembers.filter(m => m.permissions.includes("submit_feedback" as any));
        const allSubmitted = feedbackMembers.length > 0 && feedbackMembers.every(m => m.memberUid && submittedUids.has(m.memberUid));

        // Notify reviewers (review_candidates permission) and owner
        const reviewers = teamMembers.filter(m => m.memberUid && m.memberUid !== uid && m.permissions.includes("review_candidates" as any));
        const ownerUid = context.access.job.uid;

        const notifyUids = new Set<string>([...reviewers.map(m => m.memberUid as string), ownerUid].filter(u => u && u !== uid));
        for (const notifyUid of notifyUids) {
          await notify(notifyUid, {
            type: "activity",
            title: "Interview feedback submitted",
            body: `${actorInfo.name} submitted interview feedback for ${context.candidate.name}.`,
            jobId,
            candidateId,
          });
        }

        // Notify owner if all required feedback is now in
        if (allSubmitted) {
          await addActivity(
            jobId, uid, "interview_feedback_all_completed",
            `All required interview feedback received for ${context.candidate.name} — AI Hiring Summary is ready to generate`,
            { candidateName: context.candidate.name, feedbackCount: collaboration?.interviewFeedback?.length ?? 0 },
            candidateId,
          );
          await notify(ownerUid, {
            type: "activity",
            title: "All interview feedback received",
            body: `All interviewers have submitted feedback for ${context.candidate.name}. The AI Hiring Summary is ready to generate.`,
            jobId,
            candidateId,
          });
          // Email notification to owner
          const ownerUser = await User.findById(ownerUid).select("email name").lean() as any;
          if (ownerUser?.email) {
            sendEmail({
              to: ownerUser.email,
              subject: `All interview feedback received for ${context.candidate.name}`,
              html: `<p>All required interviewers have submitted their feedback for <strong>${context.candidate.name}</strong>.</p><p>You can now generate the AI Hiring Summary in your hiring dashboard.</p>`,
              from: NOTIFICATION_FROM,
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error("[collaboration] post-feedback notifications failed:", e);
      }
    });

    const collaboration = await RecruitCandidateCollaboration.findOne({ jobId, candidateId }).lean();
    return res.status(201).json({ collaboration });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ─── AI Hiring Synthesis ──────────────────────────────────────────────────── */
async function generateAiHiringSynthesis(args: {
  candidateName: string;
  jobTitle: string;
  rubric: { name: string; weight: number; description: string }[];
  resumeScore: number;
  maxScore: number;
  aiSummary: string;
  resumeStrengths: string[];
  resumeRedFlags: string[];
  assessmentStatus: string;
  assessmentImpact: { strengths?: string[]; weaknesses?: string[]; reasoning?: string } | null;
  interviewFeedback: Array<{ body: string; rating?: number; ratings?: Record<string, number>; author?: { name: string } }>;
  stage: string;
}) {
  const rubricText = args.rubric.map(r => `- ${r.name} (${r.weight} pts): ${r.description}`).join("\n") || "No rubric defined.";

  const feedbackText = args.interviewFeedback.length
    ? args.interviewFeedback.map((fb, i) => {
        const ratingLines = fb.ratings
          ? Object.entries(fb.ratings).map(([k, v]) => `  ${k}: ${v}/5`).join("\n")
          : "";
        return `--- Feedback #${i + 1} from ${fb.author?.name ?? "Interviewer"} ---
Overall: ${fb.rating ? `${fb.rating}/5` : "not rated"}
${ratingLines}
Notes: ${fb.body || "(no notes)"}`;
      }).join("\n\n")
    : "No interview feedback submitted yet.";

  const assessmentText = args.assessmentStatus === "completed" && args.assessmentImpact
    ? `Status: Completed
Strengths: ${args.assessmentImpact.strengths?.join(", ") || "none"}
Weaknesses: ${args.assessmentImpact.weaknesses?.join(", ") || "none"}
Reasoning: ${args.assessmentImpact.reasoning || ""}`
    : `Status: ${args.assessmentStatus}`;

  const prompt = `You are a senior talent partner at a top-tier company. Synthesise all available evaluation data for this candidate and produce a structured hiring recommendation.

CANDIDATE: ${args.candidateName}
JOB: ${args.jobTitle}
CURRENT STAGE: ${args.stage}

RESUME SCORE: ${args.resumeScore} / ${args.maxScore} (${Math.round((args.resumeScore / (args.maxScore || 100)) * 100)}%)
RESUME SUMMARY: ${args.aiSummary || "Not available."}
RESUME STRENGTHS: ${args.resumeStrengths.join(", ") || "none"}
RESUME RED FLAGS: ${args.resumeRedFlags.join(", ") || "none"}

SCORING RUBRIC:
${rubricText}

ASSESSMENT:
${assessmentText}

INTERVIEW FEEDBACK:
${feedbackText}

---

Based on ALL of the above, produce a comprehensive hiring recommendation. Your output must be valid JSON only — no markdown, no commentary outside the JSON object.

{
  "recommendation": "hire" | "hold" | "pass",
  "executiveSummary": "2-3 sentence summary of the candidate's overall fit",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "riskFactors": ["risk 1"],
  "keyReasons": ["reason 1 for the recommendation", "reason 2"],
  "overallFit": "One paragraph on how well they fit the role and team",
  "suggestedNextStep": "One concrete action the recruiter should take next"
}

GUIDELINES:
- recommendation: "hire" if clearly qualified and positive signals across resume/assessment/interview; "hold" if mixed signals or one more step needed; "pass" if performance clearly below bar.
- Be specific, reference actual data from the inputs. Do not hallucinate.
- strengths, weaknesses, riskFactors: 1-5 items each (bullet-style, concise).
- keyReasons: 2-4 specific reasons grounded in the data.
- suggestedNextStep: actionable (e.g. "Schedule final panel interview", "Send offer letter", "Archive candidate").
- If interview feedback is missing, recommend "hold" unless resume+assessment are exceptional.`;

  let raw = "";
  try {
    raw = await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "google/gemini-2.0-flash-001",
      fallbackModels: ["openai/gpt-4o-mini", "anthropic/claude-3-haiku"],
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
      temperature: 0.3,
      responseFormat: "json_object",
      retries: 2,
    });
    const parsed = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/```$/, ""));
    const rec = (["hire", "hold", "pass"] as const).includes(parsed.recommendation) ? parsed.recommendation : "hold";
    return {
      recommendation: rec as "hire" | "hold" | "pass",
      executiveSummary: String(parsed.executiveSummary ?? "").trim(),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors.map(String) : [],
      keyReasons: Array.isArray(parsed.keyReasons) ? parsed.keyReasons.map(String) : [],
      overallFit: String(parsed.overallFit ?? "").trim(),
      suggestedNextStep: String(parsed.suggestedNextStep ?? "").trim(),
    };
  } catch (err) {
    console.error("[collaboration] generateAiHiringSynthesis failed:", err, "raw:", raw?.slice(0, 300));
    return null;
  }
}

collaborationRouter.post("/jobs/:jobId/candidates/:candidateId/ai-synthesis", async (req, res) => {
  try {
    await connectMongo();
    const jobId = String(req.params.jobId);
    const candidateId = String(req.params.candidateId);
    const uid = uidOf(req);
    const context = await candidateContext(jobId, candidateId, uid);
    if (!context) return res.status(404).json({ error: "Candidate not found or access denied." });
    if (!context.access.owner && !hasPermission(context.access, "review_candidates")) {
      return res.status(403).json({ error: "You do not have permission to generate AI summaries." });
    }
    const force = req.body.force === true;
    const candidate = context.candidate as any;

    // Return cached synthesis unless forced
    if (!force && candidate.aiHiringSynthesis?.generatedAt) {
      return res.json({ synthesis: candidate.aiHiringSynthesis });
    }

    const job = await RecruitJob.findById(jobId).lean() as any;
    const collaboration = await RecruitCandidateCollaboration.findOne({ jobId, candidateId }).lean() as any;

    // Validate: interview feedback is required before generating an AI hiring recommendation
    const feedbackEntries: Array<{ author?: { name: string } }> = collaboration?.interviewFeedback ?? [];
    if (feedbackEntries.length === 0) {
      return res.status(422).json({
        error: "AI Hiring Recommendation is unavailable because the required interview feedback has not yet been submitted.",
        interviewFeedbackRequired: true,
        feedbackCount: 0,
        submittedBy: [],
      });
    }

    const actorInfo = await actorForUid(uid);

    const synthesis = await generateAiHiringSynthesis({
      candidateName: candidate.name,
      jobTitle: job?.title ?? "",
      rubric: job?.rubric ?? [],
      resumeScore: candidate.totalScore ?? 0,
      maxScore: candidate.maxScore ?? 100,
      aiSummary: candidate.aiSummary ?? "",
      resumeStrengths: candidate.strengths ?? [],
      resumeRedFlags: candidate.redFlags ?? [],
      assessmentStatus: candidate.assessmentStatus ?? "not_sent",
      assessmentImpact: candidate.assessmentImpact ?? null,
      interviewFeedback: collaboration?.interviewFeedback ?? [],
      stage: candidate.stage ?? "applied",
    });

    if (!synthesis) return res.status(502).json({ error: "AI synthesis failed. Please try again." });

    const fullSynthesis = { ...synthesis, generatedAt: new Date(), generatedBy: actorInfo.name };
    await RecruitCandidate.updateOne({ _id: candidateId }, { $set: { aiHiringSynthesis: fullSynthesis } });
    await addActivity(
      jobId, uid, "ai_hiring_summary_generated",
      `AI hiring summary generated for ${candidate.name} — recommendation: ${synthesis.recommendation.toUpperCase()}`,
      { recommendation: synthesis.recommendation },
      candidateId,
    );

    return res.json({ synthesis: fullSynthesis });
  } catch (err: any) {
    console.error("[collaboration] POST /ai-synthesis", err);
    return res.status(500).json({ error: err.message });
  }
});

collaborationRouter.patch("/jobs/:jobId/candidates/:candidateId/recruiter-decision", async (req, res) => {
  try {
    await connectMongo();
    const jobId = String(req.params.jobId);
    const candidateId = String(req.params.candidateId);
    const uid = uidOf(req);
    const context = await candidateContext(jobId, candidateId, uid);
    if (!context) return res.status(404).json({ error: "Candidate not found or access denied." });
    if (!context.access.owner && !hasPermission(context.access, "approve_hiring")) {
      return res.status(403).json({ error: "You do not have permission to record hiring decisions." });
    }
    const decision = String(req.body.decision ?? "");
    if (!["accepted", "overridden", "ignored"].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'accepted', 'overridden', or 'ignored'." });
    }
    const candidate = await RecruitCandidate.findById(candidateId) as any;
    if (!candidate?.aiHiringSynthesis) return res.status(400).json({ error: "Generate an AI summary first before recording a decision." });
    const actorInfo = await actorForUid(uid);
    const note = String(req.body.note ?? "").trim();
    candidate.aiHiringSynthesis.recruiterDecision = decision;
    candidate.aiHiringSynthesis.recruiterDecisionNote = note;
    candidate.aiHiringSynthesis.recruiterDecisionAt = new Date();
    candidate.aiHiringSynthesis.recruiterDecisionBy = actorInfo.name;
    candidate.markModified("aiHiringSynthesis");
    await candidate.save();
    await addActivity(
      jobId, uid, "recruiter_final_decision",
      `${actorInfo.name} recorded hiring decision for ${context.candidate.name}: ${decision}`,
      { decision, note },
      candidateId,
    );
    return res.json({ synthesis: candidate.aiHiringSynthesis });
  } catch (err: any) {
    console.error("[collaboration] PATCH /recruiter-decision", err);
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
    const uid = uidOf(req);
    const context = await candidateContext(req.params.jobId, req.params.candidateId, uid);
    if (!context) return res.status(404).json({ error: "Candidate not found or not assigned to you." });
    const collaboration = await RecruitCandidateCollaboration.findOne({ jobId: req.params.jobId, candidateId: req.params.candidateId }).lean() as any;
    const base = collaboration ?? { comments: [], internalNotes: [], interviewFeedback: [], assignedTo: null };

    // Feedback visibility: owners and users with review_candidates can always see all feedback.
    // Interviewers (submit_feedback only, no review_candidates) must submit their own feedback first.
    const canReview = context.access.owner || hasPermission(context.access, "review_candidates");
    const allFeedback: any[] = base.interviewFeedback ?? [];

    let visibleFeedback: any[];
    let feedbackLocked = false;

    if (canReview) {
      visibleFeedback = allFeedback;
    } else {
      // Check if this user has already submitted their own feedback
      const hasSubmitted = allFeedback.some((f: any) => f.author?.uid === uid);
      if (hasSubmitted) {
        visibleFeedback = allFeedback;
      } else {
        visibleFeedback = [];
        feedbackLocked = true;
      }
    }

    return res.json({
      collaboration: { ...base, interviewFeedback: visibleFeedback },
      feedbackLocked,
      feedbackCount: allFeedback.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export { ROLE_PERMISSIONS, hasPermission };