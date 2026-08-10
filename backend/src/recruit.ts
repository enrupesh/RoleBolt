import express from "express";
import crypto from "crypto";
import multer from "multer";
import PDFDocument from "pdfkit";
import { connectMongo } from "./db";
import { RecruitJob } from "./models/RecruitJob";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitSeekerProfile } from "./models/RecruitSeekerProfile";
import { RecruitCompanyProfile } from "./models/RecruitCompanyProfile";
import { callMeshChatCompletions } from "./ai/meshClient";
import { callGeminiChain } from "./ai/geminiClient";
import { callNvidia } from "./ai/nvidiaClient";
import { RecruitJobAlert } from "./models/RecruitJobAlert";
import { UsageEvent } from "./models/UsageEvent";
import { RecruitProfile } from "./models/RecruitProfile";
import { canonicalRoleForAccount, isJudgeReviewerEmail } from "./judgeReviewer";
import { RecruitImage } from "./models/RecruitImage";
import { sendEmail, verifySMTP } from "./mailer";
import { NOTIFICATION_FROM } from "./emailConfig";
import * as emailTemplates from "./emailTemplates";
import { User } from "./models/User";
import { getCollaborationAccess, hasPermission, recordCollaborationActivity } from "./collaboration";
import { RecruitCandidateCollaboration } from "./models/RecruitCandidateCollaboration";
import { RecruitForm } from "./models/RecruitForm";
import { RecruitFormResponse } from "./models/RecruitFormResponse";
import { verifyRecaptcha, RECAPTCHA_REJECTION_MESSAGE } from "./publicSubmissionGuard";
import {
  assertSeekerResourceLimit,
  respondSeekerBillingError,
  runSeekerBillingOperation,
  seekerRequestIdempotencyKey,
} from "./billing/seekerEnforcement";
import {
  assertStandardBulkActionSize,
  assertStandardBulkImportFileCount,
  assertStandardFeature,
  assertStandardResourceLimit,
  isStandardBillingError,
  respondStandardBillingError,
  runStandardBillingOperation,
  standardBillingOwnerUid,
  standardContentHash,
  standardIdempotencyHeader,
  standardIdempotencyKey,
  standardRequestIdempotencyKey,
} from "./billing/standardEnforcement";
import { getPlanDefinition } from "./billing/planCatalog";
import { UsageLimitError } from "./billing/usage";
import { bulkImportRateLimit, publicParseResumeRateLimit } from "./billing/security";
import { verifyToken } from "./authMiddleware";
import {
  type AgentAction,
  validatePipelineRuleInput,
  isPipelineRuleEnabled,
  normalizeAgentThresholds,
  computeAgentTriage,
  agentReason,
  candidateDayInStage,
  pipelineRuleMarker,
  shouldSkipPipelineRule,
  isPipelineConditionMet,
  shouldMigrateLegacyReviewZoneStage,
} from "./automation/standardJobCore";

// ─── Resume parser (in-memory only, no disk storage) ──────────────────────────
const RESUME_ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (RESUME_ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, DOCX, or TXT files are allowed."));
  },
});

// Expensive parse-resume route — per-user fair-use throttle (Phase 7).

function trackEvent(event: string, uid?: string, data?: Record<string, unknown>) {
  UsageEvent.create({ event, uid, data: data ?? {} }).catch(() => {});
}

export const recruitRouter = express.Router();
export const recruitPublicRouter = express.Router();

function publicExternalUrl(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/")) {
    const apiOrigin = String(process.env.PUBLIC_API_URL || process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
    return apiOrigin ? `${apiOrigin}${value}` : value;
  }
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizePublicUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function publicProfileUrl(path: string): string {
  return `${FRONTEND_URL}${path}`;
}

function publicSeekerDto(profile: any, username: string) {
  return {
    username,
    name: String(profile?.name ?? "").trim(),
    headline: String(profile?.headline ?? "").trim(),
    bio: String(profile?.bio ?? "").trim(),
    skills: Array.isArray(profile?.skills) ? profile.skills.map(String).filter(Boolean).slice(0, 80) : [],
    experienceLevel: String(profile?.experienceLevel ?? "").trim(),
    preferredJobType: String(profile?.preferredJobType ?? "").trim(),
    preferredWorkMode: String(profile?.preferredWorkMode ?? "").trim(),
    preferredLocation: String(profile?.preferredLocation ?? "").trim(),
    preferredNiche: String(profile?.preferredNiche ?? "").trim(),
    careerObjective: String(profile?.careerObjective ?? "").trim(),
    experience: Array.isArray(profile?.experience) ? profile.experience.slice(0, 30).map((entry: any) => ({
      title: String(entry?.title ?? "").trim(),
      company: String(entry?.company ?? "").trim(),
      location: String(entry?.location ?? "").trim(),
      startDate: String(entry?.startDate ?? "").trim(),
      endDate: String(entry?.endDate ?? "").trim(),
      current: Boolean(entry?.current),
      description: String(entry?.description ?? "").trim(),
    })).filter((entry: any) => entry.title || entry.company) : [],
    education: Array.isArray(profile?.education) ? profile.education.slice(0, 20).map((entry: any) => ({
      degree: String(entry?.degree ?? "").trim(),
      institution: String(entry?.institution ?? "").trim(),
      year: String(entry?.year ?? "").trim(),
      description: String(entry?.description ?? "").trim(),
    })).filter((entry: any) => entry.degree || entry.institution) : [],
    projects: Array.isArray(profile?.projects) ? profile.projects.slice(0, 30).map((entry: any) => ({
      name: String(entry?.name ?? "").trim(),
      description: String(entry?.description ?? "").trim(),
      url: publicExternalUrl(entry?.url),
      technologies: Array.isArray(entry?.technologies) ? entry.technologies.map(String).filter(Boolean).slice(0, 20) : [],
    })).filter((entry: any) => entry.name || entry.description) : [],
    certifications: Array.isArray(profile?.certifications) ? profile.certifications.slice(0, 30).map((entry: any) => ({
      name: String(entry?.name ?? "").trim(),
      issuer: String(entry?.issuer ?? "").trim(),
      year: String(entry?.year ?? "").trim(),
      url: publicExternalUrl(entry?.url),
    })).filter((entry: any) => entry.name || entry.issuer) : [],
    socialLinks: {
      linkedin: publicExternalUrl(profile?.socialLinks?.linkedin),
      instagram: publicExternalUrl(profile?.socialLinks?.instagram),
      twitter: publicExternalUrl(profile?.socialLinks?.twitter),
      github: publicExternalUrl(profile?.socialLinks?.github),
      portfolio: publicExternalUrl(profile?.socialLinks?.portfolio),
    },
    photoUrl: publicExternalUrl(profile?.photoUrl),
    updatedAt: profile?.updatedAt ?? null,
    publicUrl: publicProfileUrl(`/seeker/${encodeURIComponent(username)}`),
  };
}

function publicCreatorDto(profile: any, username: string, jobs: any[]) {
  const profileType = String(profile?.profileType ?? "company");
  const isPerson = profileType === "individual" || profileType === "content_creator";
  return {
    username,
    profileType,
    isPerson,
    name: String(profile?.companyName ?? "").trim(),
    tagline: String(profile?.tagline ?? "").trim(),
    companyType: String(profile?.companyType ?? "").trim(),
    industry: String(profile?.industry ?? "").trim(),
    companySize: String(profile?.companySize ?? "").trim(),
    foundedYear: String(profile?.foundedYear ?? "").trim(),
    website: publicExternalUrl(profile?.website),
    location: String(profile?.location ?? "").trim(),
    description: String(profile?.description ?? "").trim(),
    mission: String(profile?.mission ?? "").trim(),
    benefits: String(profile?.benefits ?? "").trim(),
    instituteType: String(profile?.instituteType ?? "").trim(),
    coursesOffered: String(profile?.coursesOffered ?? "").trim(),
    niche: String(profile?.niche ?? "").trim(),
    linkedinUrl: publicExternalUrl(profile?.linkedinUrl),
    logoUrl: publicExternalUrl(profile?.logoUrl),
    photoUrl: publicExternalUrl(profile?.photoUrl),
    bio: String(profile?.bio ?? "").trim(),
    personalLinkedinUrl: publicExternalUrl(profile?.personalLinkedinUrl),
    socialLinks: {
      instagram: publicExternalUrl(profile?.socialLinks?.instagram),
      twitter: publicExternalUrl(profile?.socialLinks?.twitter),
      github: publicExternalUrl(profile?.socialLinks?.github),
      portfolio: publicExternalUrl(profile?.socialLinks?.portfolio),
    },
    verificationStatus: profile?.verificationStatus === "verified" ? "verified" : profile?.verificationStatus === "requested" ? "requested" : "none",
    jobs: jobs.map((job) => ({
      id: job._id.toString(),
      title: String(job.title ?? "").trim(),
      location: String(job.location ?? "").trim(),
      workMode: String(job.workMode ?? "").trim(),
      jobType: String(job.jobType ?? "").trim(),
      seniority: String(job.seniority ?? "").trim(),
      niche: String(job.niche ?? "").trim(),
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryCurrency: String(job.salaryCurrency ?? "").trim(),
      openings: job.openings ?? 1,
      createdAt: job.createdAt ?? null,
      url: `/recruit/opportunities/${job._id.toString()}`,
    })),
    updatedAt: profile?.updatedAt ?? null,
    publicUrl: publicProfileUrl(`/creator/${encodeURIComponent(username)}`),
  };
}

const GEMINI_MESH_KEY = process.env.GEMINI_MESH_KEY ?? "";
// Guard: reject stale/incorrect FRONTEND_URL values so candidate links always point to the real domain.
const _rawRecruitFrontendUrl = process.env.FRONTEND_URL ?? "";
const FRONTEND_URL = (
  _rawRecruitFrontendUrl &&
  !_rawRecruitFrontendUrl.includes("forjob.onrender.com") &&
  !_rawRecruitFrontendUrl.includes("localhost") &&
  !_rawRecruitFrontendUrl.includes("127.0.0.1")
    ? _rawRecruitFrontendUrl
    : "https://www.rolebolt.tech"
).replace(/\/$/, "");
function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

/** Optional JWT uid for public routes that may bill an authenticated seeker. */
function optionalUidFromAuth(req: express.Request): string {
  const attached = getUid(req);
  if (attached) return attached;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return "";
  const payload = verifyToken(header.slice(7));
  return payload?.sub ?? "";
}

// Form Jobs use a shorter stage list than Standard Jobs; this projects a form
// response onto the candidate funnel so org-wide numbers cover both job types.
const FORM_STAGE_TO_CANDIDATE_STAGE: Record<string, string> = {
  new:         "applied",
  shortlisted: "screened",
  interview:   "interview",
  hired:       "hired",
  rejected:    "rejected",
};

async function getJobWithCollaborationPermission(
  jobId: string,
  uid: string,
  permission: Parameters<typeof hasPermission>[1],
) {
  const access = await getCollaborationAccess(jobId, uid);
  if (!access || !hasPermission(access, permission)) return null;
  return access;
}

// ── AI Agent + Pipeline Rules shared automation ───────────────────────────────

const EARLY_PIPELINE_STAGES = new Set(["applied", "review_zone"]);

async function getCreatorOfficialEmail(jobUid: string): Promise<string> {
  if (!jobUid) return "";
  try {
    const user = await User.findById(jobUid).select("email").lean();
    if (user?.email?.trim()) return user.email.trim();
  } catch { /* ignore */ }
  const profile = await RecruitProfile.findOne({ uid: jobUid }).select("email").lean();
  return profile?.email?.trim() ?? "";
}

async function ensureScreenedStage(candidateId: string): Promise<void> {
  const candidate = await RecruitCandidate.findById(candidateId).select("stage").lean();
  if (!candidate) return;
  if (EARLY_PIPELINE_STAGES.has(candidate.stage)) {
    await RecruitCandidate.updateOne(
      { _id: candidateId },
      { $set: { stage: "screened", stageMovedAt: new Date() } },
    );
  }
}

async function pushCandidateEmailLog(
  candidateId: string,
  entry: {
    type: string;
    to: string;
    subject: string;
    body: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  },
) {
  await RecruitCandidate.updateOne(
    { _id: candidateId },
    { $push: { emailLog: { ...entry, sentAt: new Date() } } },
  );
}

async function sendCandidateStageEmail(
  jobId: string,
  candidateId: string,
  stage: string,
  candName: string,
  candEmail: string,
  jobUid?: string,
) {
  if (!candEmail) return;
  try {
    const job = await RecruitJob.findById(jobId).lean();
    const jobTitle = (job as any)?.title ?? "";
    const companyName = (job as any)?.companyName ?? "";
    const officialContactEmail = await getCreatorOfficialEmail(jobUid ?? (job as any)?.uid ?? "");
    const ctx = { officialContactEmail };
    let payload: emailTemplates.EmailPayload | null = null;
    if (stage === "screened") {
      await ensureScreenedStage(candidateId);
      payload = emailTemplates.screened(candName, jobTitle, companyName, ctx);
    }
    if (stage === "interview") payload = emailTemplates.interview(candName, jobTitle, companyName, ctx);
    if (stage === "hired") payload = emailTemplates.hired(candName, jobTitle, companyName, undefined, ctx);
    if (!payload) return;
    const stagePayload = payload;
    const ownerUid = standardBillingOwnerUid({ uid: jobUid ?? (job as any)?.uid });
    // Automated stage emails are metered; skip (don't fail) when billing blocks.
    await runStandardBillingOperation({
      ownerUid,
      operation: "automated_email_standard",
      idempotencyKey: standardIdempotencyKey(ownerUid, ["stage-email", String(candidateId), stage]),
      resourceType: "candidate",
      resourceId: String(candidateId),
      work: async () => {
        const result = await sendEmail({
          to: candEmail,
          subject: stagePayload.subject,
          html: stagePayload.html,
          text: stagePayload.text,
          from: NOTIFICATION_FROM,
        });
        await pushCandidateEmailLog(candidateId, {
          type: stage,
          to: candEmail,
          subject: stagePayload.subject,
          body: stagePayload.text,
          status: result.ok ? "sent" : "failed",
          error: result.error,
        });
        return result;
      },
    });
  } catch (err) {
    if (isStandardBillingError(err)) {
      console.warn("[mailer] stage-change email skipped (billing):", (err as Error).message);
      return;
    }
    console.error("[mailer] stage-change email failed:", err);
  }
}

async function getOrCreateAssessmentInvite(candidateId: string): Promise<string | null> {
  const existing = await RecruitCandidate.findById(candidateId)
    .select("assessmentStatus assessmentToken")
    .lean();
  if (!existing) return null;
  if (existing.assessmentStatus === "completed") return null;
  if (existing.assessmentToken && (existing.assessmentStatus === "invited" || existing.assessmentStatus === "sent")) {
    return existing.assessmentToken;
  }
  if (existing.assessmentStatus !== "not_sent") return null;

  const token = generateToken();
  const claimed = await RecruitCandidate.findOneAndUpdate(
    { _id: candidateId, assessmentStatus: "not_sent" },
    {
      $set: {
        assessmentStatus: "invited",
        assessmentToken: token,
        assessmentSentAt: new Date(),
      },
    },
    { new: true },
  ).lean();
  return claimed ? token : null;
}

async function activateAssessmentByToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const candidate = await RecruitCandidate.findOne({ assessmentToken: token });
  if (!candidate) return { ok: false, error: "Assessment not found." };
  if (candidate.assessmentStatus === "completed") return { ok: true };
  if (candidate.assessmentQuestions?.length && candidate.assessmentStatus === "sent") return { ok: true };

  const job = await RecruitJob.findById(candidate.jobId).lean();
  if (!job) return { ok: false, error: "Job not found." };

  const ownerUid = standardBillingOwnerUid(job);
  let questions: Awaited<ReturnType<typeof generateAssessmentQuestions>>;
  try {
    questions = await runStandardBillingOperation({
      ownerUid,
      operation: "assessment_generate_standard",
      idempotencyKey: standardIdempotencyKey(ownerUid, ["assessment-generate", String(candidate._id)]),
      resourceType: "candidate",
      resourceId: String(candidate._id),
      work: async () => generateAssessmentQuestions({
        jobTitle: (job as any).title,
        rubric: (job as any).rubric,
        jd: (job as any).generatedJD,
        niche: (job as any).niche,
        nicheDetails: (job as any).nicheDetails,
        languageRequirement: (job as any).languageRequirement,
      }),
    });
  } catch (err) {
    if (isStandardBillingError(err)) {
      console.warn("[assessment] activate generation blocked by billing:", (err as Error).message);
      return { ok: false, error: "This assessment is temporarily unavailable. Please contact the employer." };
    }
    console.error("[assessment] activate generation failed:", err);
    return { ok: false, error: "Could not prepare assessment. Please try again shortly." };
  }

  await RecruitCandidate.updateOne(
    { _id: candidate._id },
    {
      $set: {
        assessmentQuestions: questions,
        assessmentStatus: "sent",
        assessmentSentAt: new Date(),
        previousResumeScore: candidate.previousResumeScore ?? candidate.totalScore,
      },
    },
  );
  await ensureScreenedStage(String(candidate._id));
  return { ok: true };
}

type AssessmentInviteMode = "unified_screened" | "assessment_only";

async function sendAssessmentInviteEmail(args: {
  job: any;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  mode: AssessmentInviteMode;
  logTag: string;
}): Promise<boolean> {
  const { job, candidateId, candidateName, candidateEmail, mode, logTag } = args;
  if (!candidateEmail?.trim()) return false;

  const token = await getOrCreateAssessmentInvite(candidateId);
  if (!token) return false;

  await ensureScreenedStage(candidateId);

  const officialContactEmail = await getCreatorOfficialEmail(job.uid ?? "");
  const ctx = { officialContactEmail };
  const assessmentUrl = `${FRONTEND_URL}/recruit/assessment/${token}`;
  const payload = mode === "unified_screened"
    ? emailTemplates.screenedWithAssessmentInvite(
        candidateName,
        job.title,
        job.companyName ?? "",
        assessmentUrl,
        ctx,
      )
    : emailTemplates.assessment(
        candidateName,
        job.title,
        job.companyName ?? "",
        assessmentUrl,
        ctx,
      );

  const result = await sendEmail({
    to: candidateEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    from: NOTIFICATION_FROM,
  });

  await pushCandidateEmailLog(candidateId, {
    type: mode === "unified_screened" ? `${logTag}_screened_assessment` : `${logTag}_assessment_invite`,
    to: candidateEmail,
    subject: payload.subject,
    body: payload.text,
    status: result.ok ? "sent" : "failed",
    error: result.error,
  });

  return result.ok;
}

async function sendAssessmentToCandidate(args: {
  job: any;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  previousResumeScore: number;
  logTag: string;
  unifiedWithScreened?: boolean;
}): Promise<boolean> {
  if (args.previousResumeScore != null) {
    await RecruitCandidate.updateOne(
      { _id: args.candidateId },
      { $set: { previousResumeScore: args.previousResumeScore } },
    );
  }
  const stageRow = await RecruitCandidate.findById(args.candidateId).select("stage").lean();
  const useUnified = args.unifiedWithScreened === true
    || (args.unifiedWithScreened !== false && EARLY_PIPELINE_STAGES.has(stageRow?.stage ?? "applied"));

  // Assessments are a gated Standard feature and consume an active-assessment slot.
  const ownerUid = standardBillingOwnerUid(args.job);
  await assertStandardFeature(ownerUid, "assessments");
  await assertStandardResourceLimit(ownerUid, "active_assessments");

  return runStandardBillingOperation({
    ownerUid,
    operation: "assessment_send_standard",
    idempotencyKey: standardIdempotencyKey(ownerUid, ["assessment-send", String(args.candidateId)]),
    resourceType: "candidate",
    resourceId: String(args.candidateId),
    work: async () => sendAssessmentInviteEmail({
      job: args.job,
      candidateId: args.candidateId,
      candidateName: args.candidateName,
      candidateEmail: args.candidateEmail,
      mode: useUnified ? "unified_screened" : "assessment_only",
      logTag: args.logTag,
    }),
  });
}

async function dispatchAgentActions(args: {
  job: any;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateTotalScore: number;
  agentAction: AgentAction;
  scorePct: number;
  shortlistThreshold: number;
  rejectThreshold: number;
  agentMode: Record<string, unknown>;
  logPrefix?: string;
}) {
  const {
    job,
    candidateId,
    candidateName,
    candidateEmail,
    candidateTotalScore,
    agentAction,
    scorePct,
    shortlistThreshold,
    rejectThreshold,
    agentMode,
    logPrefix = "agent",
  } = args;

  let emailSent = false;
  let emailStatus: "sent" | "failed" | "skipped" | "disabled" = "disabled";
  const ownerUid = standardBillingOwnerUid(job);

  try {
    // Meter the autonomous agent action against the job owner's Standard plan.
    // On billing block we skip (log) without failing the surrounding intake.
    await runStandardBillingOperation({
      ownerUid,
      operation: "agent_action",
      idempotencyKey: standardIdempotencyKey(ownerUid, ["agent", String(candidateId), agentAction]),
      resourceType: "candidate",
      resourceId: String(candidateId),
      metadata: { action: agentAction, logPrefix },
      work: async () => {
    if (agentAction === "shortlisted") {
      await ensureScreenedStage(candidateId);
      const officialContactEmail = await getCreatorOfficialEmail(job.uid ?? "");
      const ctx = { officialContactEmail };
      const withAssessment = agentMode.autoSendAssessment === true;

      if (withAssessment && candidateEmail?.trim()) {
        const ok = await sendAssessmentInviteEmail({
          job,
          candidateId,
          candidateName,
          candidateEmail,
          mode: "unified_screened",
          logTag: logPrefix,
        });
        emailSent = ok;
        emailStatus = ok ? "sent" : "failed";
        console.log(`[${logPrefix}] Screened + assessment invite (single email): ${candidateName} (${scorePct}% ≥ ${shortlistThreshold}%)`);
      } else if (agentMode.autoEmailShortlist !== false && candidateEmail?.trim()) {
        const tpl = emailTemplates.screened(candidateName, job.title, job.companyName || "", ctx);
        const result = await sendEmail({
          to: candidateEmail, subject: tpl.subject, html: tpl.html, text: tpl.text, from: NOTIFICATION_FROM,
        });
        emailSent = result.ok;
        emailStatus = result.ok ? "sent" : "failed";
        await pushCandidateEmailLog(candidateId, {
          type: "agent_screened",
          to: candidateEmail,
          subject: tpl.subject,
          body: tpl.text,
          status: emailStatus,
          error: result.error,
        });
        console.log(`[${logPrefix}] Screened email sent: ${candidateName} (${scorePct}% ≥ ${shortlistThreshold}%)`);
      } else {
        emailStatus = "disabled";
      }
    }

    if (agentAction === "rejected" && agentMode.autoEmailReject === true && candidateEmail?.trim()) {
      const officialContactEmail = await getCreatorOfficialEmail(job.uid ?? "");
      const rejBody = `Hi ${candidateName.split(" ")[0]},\n\nThank you for applying for the ${job.title} role${job.companyName ? ` at ${job.companyName}` : ""}. After reviewing your application, we've decided to move forward with other candidates at this time.\n\nWe appreciate your interest and wish you the best in your search.\n\nWarm regards,\nThe Hiring Team`;
      const tpl = emailTemplates.rejectionEmailHtml(candidateName, job.title, job.companyName || "", rejBody, { officialContactEmail });
      const result = await sendEmail({
        to: candidateEmail, subject: tpl.subject, html: tpl.html, text: tpl.text, from: NOTIFICATION_FROM,
      });
      emailSent = result.ok;
      emailStatus = result.ok ? "sent" : "failed";
      await RecruitCandidate.updateOne(
        { _id: candidateId },
        {
          $push: {
            emailLog: {
              type: "agent_rejected",
              to: candidateEmail,
              subject: tpl.subject,
              body: tpl.text,
              sentAt: new Date(),
              status: emailStatus,
              error: result.error,
            },
          },
        },
      );
      console.log(`[${logPrefix}] Auto-rejected & emailed: ${candidateName} (${scorePct}% < ${rejectThreshold}%)`);
    } else if (agentAction === "rejected") {
      emailStatus = "disabled";
    } else if (agentAction === "review_zone" && agentMode.emailReviewZoneCandidates === true && candidateEmail?.trim()) {
      const officialContactEmail = await getCreatorOfficialEmail(job.uid ?? "");
      const tpl = emailTemplates.reviewZoneEmail(candidateName, job.title, job.companyName || "", { officialContactEmail });
      const result = await sendEmail({
        to: candidateEmail, subject: tpl.subject, html: tpl.html, text: tpl.text, from: NOTIFICATION_FROM,
      });
      emailSent = result.ok;
      emailStatus = result.ok ? "sent" : "failed";
      await RecruitCandidate.updateOne(
        { _id: candidateId },
        {
          $push: {
            emailLog: {
              type: "agent_review_zone",
              to: candidateEmail,
              subject: tpl.subject,
              body: tpl.text,
              sentAt: new Date(),
              status: emailStatus,
              error: result.error,
            },
          },
        },
      );
      console.log(`[${logPrefix}] Review zone email sent: ${candidateName} (${scorePct}%)`);
    } else if (agentAction === "review_zone") {
      emailStatus = "disabled";
    }
      },
    });
  } catch (e) {
    if (isStandardBillingError(e)) {
      console.warn(`[${logPrefix}] agent action skipped (billing limit reached):`, (e as Error).message);
      emailStatus = "skipped";
    } else {
      console.error(`[${logPrefix}] Email dispatch failed:`, e);
      emailStatus = "failed";
    }
  }

  try {
    await RecruitCandidate.updateOne(
      { _id: candidateId },
      {
        $push: {
          agentLog: {
            action: agentAction,
            score: scorePct,
            reason: agentReason(agentAction, scorePct, shortlistThreshold, rejectThreshold),
            emailSent,
            emailStatus,
            timestamp: new Date(),
          },
        },
      },
    );
  } catch (e) {
    console.error(`[${logPrefix}] agentLog write failed:`, e);
  }
}

function schedulePipelineRules(jobId: string, candidateId: string) {
  setImmediate(() => {
    evaluatePipelineRules(jobId, candidateId).catch(e =>
      console.error("[pipeline-rule] evaluation failed:", e),
    );
  });
}

/** Run agent actions then pipeline rules sequentially (prevents races on intake). */
async function runPostIntakeAutomation(
  job: any,
  candidateId: string,
  agentAction: AgentAction | null,
  agentArgs: Omit<Parameters<typeof dispatchAgentActions>[0], "agentAction"> | null,
) {
  if (agentAction && agentArgs) {
    await dispatchAgentActions({ ...agentArgs, agentAction });
  }
  await evaluatePipelineRules(String(job._id), candidateId);
}

function schedulePostIntakeAutomation(
  job: any,
  candidate: any,
  agentAction: AgentAction | null,
  agentArgs: Omit<Parameters<typeof dispatchAgentActions>[0], "agentAction"> | null,
) {
  const candidateId = String(candidate._id);
  setImmediate(() => {
    runPostIntakeAutomation(job, candidateId, agentAction, agentArgs).catch(e =>
      console.error("[automation] post-intake failed:", e),
    );
  });
}

/** Score a saved candidate, apply agent triage, then run automation. Used after async public apply. */
async function finalizeScoredCandidate(args: {
  job: any;
  candidateId: string;
  scored: Awaited<ReturnType<typeof scoreCandidate>>;
  candidateEmail: string;
  fallbackName?: string;
  logPrefix?: string;
}) {
  const { job, candidateId, scored, candidateEmail, fallbackName, logPrefix = "agent" } = args;
  const agentMode = (job as any).agentMode ?? {};
  const scorePct = scored.maxScore > 0 ? Math.round((scored.totalScore / scored.maxScore) * 100) : 0;
  const { initialStage, agentAction, shortlistThreshold, rejectThreshold } = computeAgentTriage(
    agentMode,
    scorePct,
    scored.scoringFailed,
  );
  const displayName = scored.name === "Candidate" && fallbackName ? fallbackName : scored.name;

  await RecruitCandidate.findByIdAndUpdate(candidateId, {
    $set: {
      name: displayName,
      totalScore: scored.totalScore,
      maxScore: scored.maxScore,
      scoreBreakdown: scored.scoreBreakdown,
      aiSummary: scored.aiSummary,
      redFlags: scored.redFlags,
      strengths: scored.strengths,
      scoringFailed: scored.scoringFailed,
      stage: initialStage,
      stageMovedAt: new Date(),
      ...(scored.scoringFailed ? {} : { previousResumeScore: scored.totalScore }),
    },
  });

  await runPostIntakeAutomation(
    job,
    candidateId,
    agentAction,
    agentAction
      ? {
          job,
          candidateId,
          candidateName: displayName,
          candidateEmail,
          candidateTotalScore: scored.totalScore,
          scorePct,
          shortlistThreshold,
          rejectThreshold,
          agentMode,
          logPrefix,
        }
      : null,
  );
}

async function clearScorePipelineRuleState(jobId: string, candidateId: string) {
  const job = await RecruitJob.findById(jobId).lean();
  const candidate = await RecruitCandidate.findById(candidateId).lean();
  if (!job || !candidate) return;
  const state = { ...(((candidate as any).pipelineRuleState ?? {}) as Record<string, string>) };
  for (const rule of ((job as any).pipelineRules ?? [])) {
    if (rule.condition === "score_above" || rule.condition === "score_below") {
      delete state[rule.id];
    }
  }
  await RecruitCandidate.updateOne({ _id: candidateId }, { $set: { pipelineRuleState: state } });
}

/**
 * Build a fully-formed "unscored" scoring result. Used when AI scoring is
 * blocked by billing so the candidate is still stored and can be re-scored
 * later (mirrors Form Jobs `scoringFailed` degradation).
 */
function unscoredCandidateResult(
  resumeText: string,
  rubric: { name: string; weight: number; description: string }[] | undefined,
): Awaited<ReturnType<typeof scoreCandidate>> {
  const rubricMaxScore = (rubric ?? []).reduce((sum, r) => sum + (r?.weight ?? 0), 0) || 100;
  return {
    name: extractNameFromResume(resumeText),
    email: "",
    totalScore: 0,
    maxScore: rubricMaxScore,
    scoreBreakdown: [],
    aiSummary: "",
    redFlags: [],
    strengths: [],
    scoringFailed: true,
  };
}

/**
 * Meter a candidate resume-scoring AI call against the job owner's Standard plan.
 * If scoring is blocked by billing, returns an unscored result so intake never
 * hard-fails on the metered AI leg (the candidate stays re-scorable).
 */
async function meterCandidateScore(
  ownerUid: string,
  job: any,
  resumeText: string,
): Promise<Awaited<ReturnType<typeof scoreCandidate>>> {
  try {
    return await runStandardBillingOperation({
      ownerUid,
      operation: "candidate_score",
      idempotencyKey: standardIdempotencyKey(ownerUid, [
        "candidate-score",
        String(job._id),
        standardContentHash(resumeText),
      ]),
      resourceType: "job",
      resourceId: String(job._id),
      work: async () => scoreCandidate({ resumeText, jobTitle: job.title, rubric: job.rubric }),
    });
  } catch (scoreErr) {
    if (isStandardBillingError(scoreErr)) {
      console.warn("[recruit] candidate scoring blocked by billing — candidate kept unscored:", (scoreErr as Error).message);
      return unscoredCandidateResult(resumeText, job.rubric);
    }
    throw scoreErr;
  }
}

// ── AI Pipeline Rules: evaluate rules against a candidate (call non-blocking) ─
export async function evaluatePipelineRules(jobId: string, candidateId: string) {
  try {
    const job = await RecruitJob.findById(jobId).lean();
    let candidate = await RecruitCandidate.findById(candidateId);
    if (!job || !candidate) return;
    const rules: any[] = ((job as any).pipelineRules ?? []).filter((r: any) => isPipelineRuleEnabled(r));
    if (!rules.length) return;

    for (const rule of rules) {
      candidate = await RecruitCandidate.findById(candidateId);
      if (!candidate) return;

      const scorePct = candidate.maxScore > 0
        ? Math.round((candidate.totalScore / candidate.maxScore) * 100)
        : 0;
      const dayInStage = candidateDayInStage(candidate);

      if (rule.fromStage && candidate.stage !== rule.fromStage) continue;
      if (shouldSkipPipelineRule(rule, candidate as any, scorePct)) continue;
      if (!isPipelineConditionMet(rule, candidate as any, scorePct, dayInStage)) continue;

      const ownerUid = standardBillingOwnerUid(job);
      let fired = false;
      try {
        await runStandardBillingOperation({
          ownerUid,
          operation: "pipeline_rule_execution",
          idempotencyKey: standardIdempotencyKey(ownerUid, [
            "pipeline-rule",
            String(candidateId),
            String(rule.id),
            String(candidate.stage),
          ]),
          resourceType: "candidate",
          resourceId: String(candidateId),
          metadata: { ruleId: rule.id, action: rule.action, condition: rule.condition },
          work: async () => {
      if (!candidate) return;
      const stageMap: Record<string, string> = {
        move_to_screened: "screened",
        move_to_assessed: "assessed",
        move_to_interview: "interview",
        move_to_offer: "offer",
        move_to_rejected: "rejected",
      };

      const marker = pipelineRuleMarker(rule, candidate as any, scorePct);

      if (stageMap[rule.action]) {
        const newStage = stageMap[rule.action];
        if (candidate.stage !== newStage) {
          await RecruitCandidate.updateOne(
            { _id: candidateId },
            {
              stage: newStage,
              stageMovedAt: new Date(),
              [`pipelineRuleState.${rule.id}`]: marker,
            },
          );
          await RecruitJob.updateOne(
            { _id: jobId, "pipelineRules.id": rule.id },
            { $inc: { "pipelineRules.$.triggerCount": 1 } },
          );
          console.log(`[pipeline-rule] "${rule.id}" fired: ${rule.condition} → ${rule.action} for candidate ${candidateId}`);
          if (["screened", "interview", "hired"].includes(newStage) && candidate.email) {
            setImmediate(() =>
              sendCandidateStageEmail(jobId, candidateId, newStage, candidate.name, candidate.email!, job.uid),
            );
          }
          fired = true;
        } else {
          // Already at target stage (e.g. AI Agent moved them) — still count the rule as satisfied.
          await RecruitCandidate.updateOne(
            { _id: candidateId },
            { $set: { [`pipelineRuleState.${rule.id}`]: marker } },
          );
          await RecruitJob.updateOne(
            { _id: jobId, "pipelineRules.id": rule.id },
            { $inc: { "pipelineRules.$.triggerCount": 1 } },
          );
          console.log(`[pipeline-rule] "${rule.id}" satisfied (already at ${newStage}) for candidate ${candidateId}`);
          fired = true;
        }
      } else if (rule.action === "send_assessment") {
        try {
          const sent = await sendAssessmentToCandidate({
            job,
            candidateId,
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            previousResumeScore: candidate.totalScore,
            logTag: "pipeline-rule",
            unifiedWithScreened: EARLY_PIPELINE_STAGES.has(candidate.stage) || candidate.stage === "screened",
          });
          if (sent) {
            await RecruitCandidate.updateOne(
              { _id: candidateId },
              { $set: { [`pipelineRuleState.${rule.id}`]: marker } },
            );
            await RecruitJob.updateOne(
              { _id: jobId, "pipelineRules.id": rule.id },
              { $inc: { "pipelineRules.$.triggerCount": 1 } },
            );
            console.log(`[pipeline-rule] send_assessment fired for candidate ${candidateId}`);
            fired = true;
          }
        } catch (e) {
          console.error("[pipeline-rule] send_assessment failed:", e);
        }
      } else if (rule.action === "send_reminder" && ["sent", "invited"].includes(candidate.assessmentStatus) && candidate.email) {
        try {
          const assessmentUrl = `${FRONTEND_URL}/recruit/assessment/${candidate.assessmentToken}`;
          const officialContactEmail = await getCreatorOfficialEmail((job as any).uid ?? "");
          const payload = emailTemplates.assessmentReminder(
            candidate.name,
            (job as any).title,
            (job as any).companyName ?? "",
            assessmentUrl,
            { officialContactEmail },
          );
          const result = await sendEmail({
            to: candidate.email,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            from: NOTIFICATION_FROM,
          });
          await RecruitCandidate.updateOne(
            { _id: candidateId },
            {
              $set: {
                assessmentReminderSentAt: new Date(),
                [`pipelineRuleState.${rule.id}`]: marker,
              },
              $push: {
                emailLog: {
                  type: "pipeline_reminder",
                  to: candidate.email,
                  subject: payload.subject,
                  body: payload.text,
                  sentAt: new Date(),
                  status: result.ok ? "sent" : "failed",
                  error: result.error,
                },
              },
            },
          );
          await RecruitJob.updateOne(
            { _id: jobId, "pipelineRules.id": rule.id },
            { $inc: { "pipelineRules.$.triggerCount": 1 } },
          );
          console.log(`[pipeline-rule] send_reminder fired for candidate ${candidateId}`);
          fired = true;
        } catch (e) {
          console.error("[pipeline-rule] send_reminder failed:", e);
        }
      }
          },
        });
      } catch (e) {
        if (isStandardBillingError(e)) {
          console.warn(`[pipeline-rule] "${rule.id}" blocked by billing — skipped:`, (e as Error).message);
          continue;
        }
        throw e;
      }

      if (fired) break;
    }
  } catch (e) {
    console.error("[pipeline-rule] evaluatePipelineRules failed:", e);
  }
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB decoded
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ─── Image uploads (stored in MongoDB — no external storage bucket needed) ────

recruitRouter.post("/uploads/image", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { data, contentType } = req.body as { data?: string; contentType?: string };
    if (!data || !contentType) {
      return res.status(400).json({ error: "Missing data or contentType." });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      return res.status(400).json({ error: "Unsupported image type." });
    }

    const base64 = data.includes(",") ? data.split(",")[1] : data;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image too large (max 4MB)." });
    }

    const image = await RecruitImage.create({ uid, contentType, data: buffer });
    return res.json({ url: `/recruit-public/uploads/${image._id}` });
  } catch (err: any) {
    console.error("[recruit] POST /uploads/image", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/auth/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const { role, name, email, username } = req.body as {
      role?: string; name?: string; email?: string; username?: string;
    };
    if (!role || !["creator", "seeker"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'creator' or 'seeker'." });
    }
    const jwtEmail = (req as any).user?.email ?? "";
    const authUser = await User.findById(uid);
    const existing = await RecruitProfile.findOne({ uid });
    const isJudgeReviewer = isJudgeReviewerEmail(authUser?.email ?? jwtEmail);
    const profileRole = existing?.role === "creator" || existing?.role === "seeker"
      ? existing.role
      : undefined;
    const canonicalRole = canonicalRoleForAccount(
      authUser?.email ?? jwtEmail,
      authUser?.signupRole ?? profileRole,
    );
    if (isJudgeReviewer && authUser && authUser.signupRole !== "creator") {
      authUser.signupRole = "creator";
      await authUser.save();
    }
    if (authUser && !authUser.signupRole && canonicalRole) {
      authUser.signupRole = canonicalRole;
      await authUser.save();
    }
    const judgeCanUseSeeker = role === "seeker" && isJudgeReviewer;
    if (canonicalRole && canonicalRole !== role && !judgeCanUseSeeker) {
      return res.status(409).json({
        code: "ROLE_MISMATCH",
        error: `This account is registered as a ${canonicalRole === "seeker" ? "job seeker" : "job creator"}.`,
      });
    }
    const resolvedUsername = username?.trim().toLowerCase() || authUser?.username || "";
    if (existing) {
      if (isJudgeReviewer && existing.role !== "creator") {
        existing.role = "creator";
        await existing.save();
      }
      return res.json({
        uid: existing.uid,
        role: isJudgeReviewer ? "creator" : (canonicalRole ?? existing.role),
        canAccessSeeker: isJudgeReviewer,
        username: existing.username || resolvedUsername,
        name: existing.name,
        email: existing.email || jwtEmail,
      });
    }
    // A judge may initialize the seeker experience, but the canonical
    // account/profile remains a creator so both dashboards stay available.
    const initialRole = isJudgeReviewer ? (canonicalRole ?? "creator") : role;
    const profile = await RecruitProfile.create({
      uid,
      role: initialRole,
      username: resolvedUsername,
      name: name ?? "",
      email: (email ?? jwtEmail ?? "").trim(),
    });
    trackEvent("recruit_profile_created", uid, { role });
    return res.json({
      uid: profile.uid,
      role: profile.role,
      canAccessSeeker: isJudgeReviewer,
      username: profile.username,
      name: profile.name,
      email: profile.email,
    });
  } catch (err) {
    console.error("recruit profile create error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

recruitRouter.get("/auth/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const profile = await RecruitProfile.findOne({ uid });
    if (!profile) return res.status(404).json({ error: "No recruit profile found" });
    const authUser = await User.findById(uid);
    const isJudgeReviewer = isJudgeReviewerEmail(authUser?.email ?? (req as any).user?.email);
    const profileRole = profile.role === "creator" || profile.role === "seeker" ? profile.role : undefined;
    const canonicalRole = canonicalRoleForAccount(
      authUser?.email ?? (req as any).user?.email,
      authUser?.signupRole ?? profileRole,
    );
    if (isJudgeReviewer && authUser && authUser.signupRole !== "creator") {
      authUser.signupRole = "creator";
      await authUser.save();
    }
    if (authUser && !authUser.signupRole && canonicalRole) {
      authUser.signupRole = canonicalRole;
      await authUser.save();
    }
    if (canonicalRole && profile.role !== canonicalRole) {
      profile.role = canonicalRole;
      await profile.save();
    }
    let username = profile.username;
    if (!username) {
      username = authUser?.username ?? "";
    }
    return res.json({
      uid: profile.uid,
      role: canonicalRole ?? profile.role,
      canAccessSeeker: isJudgeReviewer,
      username,
      name: profile.name,
      email: profile.email,
    });
  } catch (err) {
    console.error("recruit profile get error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

recruitRouter.patch("/auth/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const { role, name, email, username, designation, bio, photoUrl, companyName, socialLinks } = req.body as {
      role?: string; name?: string; email?: string; username?: string;
      designation?: string; bio?: string; photoUrl?: string;
      companyName?: string; socialLinks?: Record<string, string>;
    };

    // role is optional on PATCH — only validate if explicitly provided
    if (role && !["creator", "seeker"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'creator' or 'seeker'." });
    }
    const authUser = await User.findById(uid);
    const existing = await RecruitProfile.findOne({ uid });
    const isJudgeReviewer = isJudgeReviewerEmail(authUser?.email ?? (req as any).user?.email);
    const profileRole = existing?.role === "creator" || existing?.role === "seeker"
      ? existing.role
      : undefined;
    const canonicalRole = canonicalRoleForAccount(
      authUser?.email ?? (req as any).user?.email,
      authUser?.signupRole ?? profileRole,
    );
    if (isJudgeReviewer && authUser && authUser.signupRole !== "creator") {
      authUser.signupRole = "creator";
      await authUser.save();
    }
    if (authUser && !authUser.signupRole && canonicalRole) {
      authUser.signupRole = canonicalRole;
      await authUser.save();
    }
    const judgeCanUseSeeker = role === "seeker" && isJudgeReviewer;
    if (role && canonicalRole && role !== canonicalRole && !judgeCanUseSeeker) {
      return res.status(409).json({
        code: "ROLE_MISMATCH",
        error: `This account is registered as a ${canonicalRole === "seeker" ? "job seeker" : "job creator"}.`,
      });
    }

    const $set: Record<string, any> = {};
    // Do not mutate the judge's canonical creator role when seeker onboarding
    // calls this endpoint. Seeker access is granted by the middleware policy.
    if (isJudgeReviewer) $set.role = "creator";
    else if (role) $set.role = role;
    if (name !== undefined) $set.name = name;
    if (email !== undefined) $set.email = email;
    if (username !== undefined) $set.username = String(username).trim().toLowerCase();
    if (designation !== undefined) $set.designation = designation;
    if (bio !== undefined) $set.bio = bio;
    if (photoUrl !== undefined) $set.photoUrl = photoUrl;
    if (companyName !== undefined) $set.companyName = companyName;
    if (socialLinks !== undefined) $set.socialLinks = socialLinks;

    const profile = await RecruitProfile.findOneAndUpdate(
      { uid },
      {
        $set,
      },
      {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean() as any;

    let resolvedUsername = profile.username;
    if (!resolvedUsername) {
      const authUser = await User.findById(uid).lean();
      resolvedUsername = authUser?.username ?? "";
    }

    return res.json({
      uid: profile.uid,
      role: profile.role,
      canAccessSeeker: isJudgeReviewer,
      username: resolvedUsername,
      name: profile.name,
      email: profile.email,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function safeJson(text: string): any {
  const normalized = String(text || "").trim();
  const decoded = decodeEscapedAiText(normalized);
  const attempts = [
    () => JSON.parse(normalized),
    () => JSON.parse(decoded),
    () => {
      const m = decoded.match(/```json\s*([\s\S]*?)```/);
      return m ? JSON.parse(m[1]) : null;
    },
    () => {
      const m = decoded.match(/```\s*([\s\S]*?)```/);
      return m ? JSON.parse(m[1]) : null;
    },
    () => {
      const m = decoded.match(/(\{[\s\S]*\})/);
      return m ? JSON.parse(m[1]) : null;
    },
  ];
  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (result !== null) return result;
    } catch { /* try next */ }
  }
  return null;
}

function decodeEscapedAiText(input: string): string {
  let value = String(input || "").trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") {
        value = parsed.trim();
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function cleanGeneratedJobDescription(value: string): string {
  const decoded = decodeEscapedAiText(value);
  const parsed = safeJson(decoded);
  if (parsed && typeof parsed.jd === "string" && parsed.jd.trim()) {
    return cleanGeneratedJobDescription(parsed.jd);
  }
  const jdMatch = decoded.match(/"jd"\s*:\s*"([\s\S]*?)"\s*,\s*"rubric"/);
  const extracted = jdMatch ? decodeEscapedAiText(jdMatch[1]) : decoded;
  return extracted
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*["'{]+/, "")
    .replace(/["'}]+\s*$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function listFromText(value: string): string {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
}

function buildFallbackJobDescription(args: {
  title: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  responsibilities: string;
  mustHaveSkills: string;
  niceToHaveSkills: string;
  salary: string;
  niche?: string;
  openings?: number;
  perks?: string;
  languageRequirement?: string;
  timezoneOverlap?: string;
  applicationDeadline?: Date;
}): string {
  const responsibilities = listFromText(args.responsibilities) || "own meaningful work, collaborate with the team, and deliver reliable outcomes";
  const mustHave = listFromText(args.mustHaveSkills) || "relevant experience, strong communication, ownership, and problem-solving";
  const niceToHave = listFromText(args.niceToHaveSkills) || "experience with similar tools, fast-moving teams, or customer-focused environments";
  const extraBits = [
    args.openings && args.openings > 1 ? `We are hiring for ${args.openings} openings for this role.` : "",
    args.workMode === "remote" && args.timezoneOverlap?.trim() ? `Working hours: ${args.timezoneOverlap.trim()}.` : "",
    args.languageRequirement?.trim() ? `Language requirement: ${args.languageRequirement.trim()}.` : "",
    args.applicationDeadline ? `Applications close on ${args.applicationDeadline.toDateString()}.` : "",
  ].filter(Boolean).join(" ");
  const perksLine = args.perks?.trim() ? `\n- ${args.perks.trim()}` : "";
  return `About the role
We are hiring a ${args.seniority || "motivated"} ${args.title} to join the ${args.department || "team"} and contribute to practical, high-impact work in ${args.niche || "this field"}. This role is based in ${args.location || "the specified location"} with a ${args.workMode || "flexible"} working model.${extraBits ? ` ${extraBits}` : ""}

What you will do
- ${responsibilities}
- Work closely with stakeholders to understand priorities and turn them into clear execution.
- Maintain quality, communicate progress clearly, and improve the way the team works over time.

What we are looking for
- Strong ability in ${mustHave}.
- A dependable, ownership-driven approach to work.
- Clear written and verbal communication with attention to detail.

Good to have
- ${niceToHave}.

Compensation and benefits
${args.salary}. The final offer will depend on skills, experience, and interview performance.${perksLine}`;
}

function serializeRecruitJob(job: any) {
  if (!job) return job;
  return {
    ...job,
    generatedJD: cleanGeneratedJobDescription(job.generatedJD || ""),
  };
}

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function buildPublicJobQuery(query: any) {
  const filter: any = {
    status: "active",
    publicVisibility: { $ne: false },
    $expr: { $lt: [{ $size: { $ifNull: ["$reports", []] } }, 3] },
  };
  const text = String(query.q ?? "").trim();
  if (text) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    filter.$or = [
      { title: rx },
      { companyName: rx },
      { location: rx },
      { mustHaveSkills: rx },
      { department: rx },
    ];
  }
  for (const key of ["niche", "workMode", "jobType", "seniority", "companyType", "location"]) {
    const value = String(query[key] ?? "").trim();
    if (value && value !== "all") filter[key] = value;
  }
  if (String(query.freshersAllowed ?? "") === "true") filter.freshersAllowed = true;
  if (String(query.verifiedCompany ?? "") === "true") filter.verifiedCompany = true;
  const minSalary = Number(query.minSalary);
  if (!Number.isNaN(minSalary) && minSalary > 0) {
    filter.$and = [...(filter.$and ?? []), { $or: [{ salaryMax: { $gte: minSalary } }, { salaryMax: { $exists: false } }] }];
  }
  const noticePeriod = String(query.noticePeriod ?? "").trim();
  if (noticePeriod && noticePeriod !== "all") filter.noticePeriod = noticePeriod;
  const educationRequirement = String(query.educationRequirement ?? "").trim();
  if (educationRequirement && educationRequirement !== "all") filter.educationRequirement = educationRequirement;
  const seniority = String(query.seniority ?? "").trim();
  if (seniority && seniority !== "all") filter.seniority = seniority;
  const postedAfterDays = Number(query.postedAfterDays);
  if (!Number.isNaN(postedAfterDays) && postedAfterDays > 0) {
    const cutoff = new Date(Date.now() - postedAfterDays * 24 * 60 * 60 * 1000);
    filter.createdAt = { $gte: cutoff };
  }
  return filter;
}

// Synonym table: maps common alternate forms → canonical lowercase term.
// Both sides of every tier-match comparison are normalized through this,
// so "React.js" in a rubric always matches "React" from AI output, etc.
const TERM_SYNONYMS: Record<string, string> = {
  // JavaScript ecosystem
  "js": "javascript", "ts": "typescript",
  "react.js": "react", "reactjs": "react",
  "vue.js": "vue", "vuejs": "vue",
  "angular.js": "angular", "angularjs": "angular",
  "next.js": "next", "nextjs": "next",
  "nuxt.js": "nuxt", "nuxtjs": "nuxt",
  "node.js": "node", "nodejs": "node",
  "express.js": "express", "expressjs": "express",
  // APIs
  "rest api": "api", "restful api": "api", "rest apis": "api",
  "api integration": "api", "api development": "api",
  "graphql api": "graphql",
  // Databases
  "postgresql": "postgres", "mongo db": "mongodb", "mongo": "mongodb",
  "ms sql": "sql", "mssql": "sql", "mysql": "sql",
  // Cloud
  "amazon web services": "aws", "amazon aws": "aws",
  "google cloud platform": "gcp", "google cloud": "gcp",
  "microsoft azure": "azure",
  // AI / ML
  "machine learning": "ml", "artificial intelligence": "ai",
  "natural language processing": "nlp", "deep learning": "dl",
  // Mobile
  "react native": "react-native",
  "ios development": "ios", "android development": "android",
  // General skills
  "communication skills": "communication",
  "leadership skills": "leadership",
  "problem solving": "problem-solving",
  "problem-solving skills": "problem-solving",
  "project management": "pm", "product management": "pm",
  "ci/cd pipeline": "ci/cd", "continuous integration": "ci/cd",
};

function normalizeTerm(name: string): string {
  const lower = name.toLowerCase().trim();
  return TERM_SYNONYMS[lower] ?? lower;
}

async function generateJobDescription(args: {
  title: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  responsibilities: string;
  mustHaveSkills: string;
  niceToHaveSkills: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  niche?: string;
  nicheDetails?: Record<string, string>;
  openings?: number;
  perks?: string;
  languageRequirement?: string;
  timezoneOverlap?: string;
  applicationDeadline?: Date;
}): Promise<{ jd: string; rubric: { name: string; weight: number; description: string }[] }> {
  const salary =
    args.salaryMin && args.salaryMax
      ? `${args.salaryCurrency} ${args.salaryMin.toLocaleString()} – ${args.salaryMax.toLocaleString()} per year`
      : "Competitive (not disclosed)";

  const nicheDetailsLines = Object.entries(args.nicheDetails || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const extraLines = [
    args.openings && args.openings > 1 ? `- Number of Openings: ${args.openings}` : "",
    args.perks?.trim() ? `- Perks & Benefits: ${args.perks.trim()}` : "",
    args.languageRequirement?.trim() ? `- Language Requirement: ${args.languageRequirement.trim()}` : "",
    args.timezoneOverlap?.trim() ? `- Timezone / Working Hours Overlap: ${args.timezoneOverlap.trim()}` : "",
    args.applicationDeadline ? `- Application Deadline: ${args.applicationDeadline.toDateString()}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `You are a senior recruiter and job-description copywriter for a global job marketplace. Generate polished, candidate-friendly hiring content.

INPUT:
- Job Niche/Category: ${args.niche || "General"}
- Role Title: ${args.title}
- Department: ${args.department || "Not specified"}
- Seniority: ${args.seniority}
- Location: ${args.location}
- Work Mode: ${args.workMode}
- Key Responsibilities: ${args.responsibilities}
- Must-Have Skills: ${args.mustHaveSkills}
- Nice-to-Have Skills: ${args.niceToHaveSkills}
- Compensation: ${salary}${nicheDetailsLines ? `\n- Niche-specific details:\n${nicheDetailsLines}` : ""}${extraLines ? `\n${extraLines}` : ""}

Tailor the tone, expectations, and rubric to fit this specific niche (e.g. a Content Creator role should value portfolios/samples over years of experience; a Blue-Collar role should value shift flexibility and reliability; a Healthcare role should value licenses/certifications).

OUTPUT FORMAT (respond with valid JSON only, no markdown):
{
  "jd": "Plain text job description only. Use clear section headings and real paragraph/bullet spacing. Do not include JSON syntax, escaped slashes, quote marks around the whole description, or rubric text inside this field.",
  "rubric": [
    {
      "name": "criterion name (e.g. Core Technical Skills)",
      "weight": 30,
      "description": "What a 5/5 candidate looks like for this criterion vs a 1/5 candidate"
    }
  ]
}

Rules for the JD:
- Use these exact sections: About the role, What you will do, What we are looking for, Good to have, Compensation and benefits
- Write in simple, professional English that sounds human and credible
- Keep it concise: 220-350 words
- Use short paragraphs and 3-5 bullets under action-heavy sections
- Do not invent unrealistic benefits, claims, company facts, or requirements
- Avoid gendered language, age bias, caste/religion references, and unnecessary degree requirements
- Focus on outcomes, ownership, collaboration, and measurable impact
- Never return the jd as a nested JSON string

Rules for the rubric:
- Create 4-6 criteria that together sum to 100 weight points
- Each criterion should be clearly differentiated and measurable
- Include: core skills, experience depth, communication/culture fit, role-specific competency
- Descriptions should guide a non-expert reviewer`;

  const fallbackJd = buildFallbackJobDescription({ ...args, salary, niche: args.niche });
  const fallbackRubric = [
    { name: "Core Skills", weight: 40, description: "Proficiency in the must-have technical skills listed for this role." },
    { name: "Relevant Experience", weight: 30, description: "Years and quality of experience directly relevant to this role." },
    { name: "Communication & Culture Fit", weight: 20, description: "Clarity of expression, professionalism, and alignment with team values." },
    { name: "Growth & Initiative", weight: 10, description: "Evidence of self-driven learning, side projects, or career progression." },
  ];

  // Strategy: try ALL Gemini models in sequence, then fall back to Nvidia.
  // callGeminiChain tries: gemini-2.5-flash → gemini-2.5-flash-lite →
  //   gemini-3.1-flash-lite → gemini-3.5-flash-lite → gemini-3.6-flash
  // If every Gemini model fails → Nvidia (5-model chain, "माई-बाप").
  let raw: string;
  try {
    raw = await callGeminiChain({
      prompt,
      temperature: 0.6,
      maxOutputTokens: 2000,
      jsonMode: true,
    });
    console.log("[recruit] generateJobDescription: Gemini chain succeeded ✓");
  } catch (geminiChainErr) {
    console.warn(
      "[recruit] generateJobDescription: all Gemini models failed, escalating to Nvidia:",
      (geminiChainErr as Error)?.message
    );
    try {
      raw = await callNvidia({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 2000,
        responseFormat: "json_object",
      });
      console.log("[recruit] generateJobDescription: Nvidia fallback succeeded ✓");
    } catch (nvidiaErr) {
      console.error(
        "[recruit] generateJobDescription: Gemini chain + Nvidia all failed, using built-in template:",
        nvidiaErr
      );
      return { jd: fallbackJd, rubric: fallbackRubric };
    }
  }

  const parsed = safeJson(raw);
  if (!parsed || !parsed.jd || !Array.isArray(parsed.rubric)) {
    const cleanedRaw = cleanGeneratedJobDescription(raw);
    return {
      jd: cleanedRaw && !cleanedRaw.includes('"rubric"') ? cleanedRaw : fallbackJd,
      rubric: fallbackRubric,
    };
  }
  const cleanedJd = cleanGeneratedJobDescription(parsed.jd) || fallbackJd;
  const rubric = parsed.rubric
    .map((item: any) => ({
      name: String(item?.name || "Role Fit").slice(0, 80),
      weight: Number(item?.weight) || 0,
      description: String(item?.description || "Relevant evidence for this hiring criterion.").slice(0, 300),
    }))
    .filter((item: any) => item.name && item.weight > 0);
  return { jd: cleanedJd, rubric: rubric.length ? rubric : fallbackRubric };
}

function extractNameFromResume(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines.slice(0, 6)) {
    if (line.length < 60 && /^[A-Z][a-zA-Z]+([\s'-][A-Z][a-zA-Z]+)+$/.test(line)) {
      return line;
    }
  }
  for (const line of lines.slice(0, 6)) {
    if (line.length < 60 && /^[A-Za-z]+([\s'-][A-Za-z]+)+$/.test(line) && !/[@:\/\d]/.test(line)) {
      return line;
    }
  }
  return "Candidate";
}

async function scoreCandidate(args: {
  resumeText: string;
  jobTitle: string;
  rubric: { name: string; weight: number; description: string }[];
}): Promise<{
  name: string;
  email: string;
  totalScore: number;
  maxScore: number;
  scoreBreakdown: { criterion: string; score: number; maxScore: number; reasoning: string }[];
  aiSummary: string;
  redFlags: string[];
  strengths: string[];
  scoringFailed: boolean;
}> {
  const rubricText = args.rubric
    .map((r) => `- ${r.name} (max ${r.weight} pts): ${r.description}`)
    .join("\n");

  const prompt = `You are a seasoned technical recruiter screening a candidate for the role of "${args.jobTitle}". Evaluate the resume below using the rubric provided.

SCORING RUBRIC:
${rubricText}

RESUME:
${args.resumeText.slice(0, 4000)}

---

SCORING PHILOSOPHY — read carefully before scoring:

Think like a human recruiter presenting this candidate to a hiring manager. Your job is to give a fair, calibrated assessment — not to find reasons to reject.

THREE-TIER SCORING WEIGHTS — apply this framework to every criterion:

TIER 1 — Must-Have Skills (accounts for 60% of the total score weight):
These are the core technical skills, domain knowledge, or mandatory qualifications stated in the job description. Score these strictly but fairly:
- Clearly demonstrated → 85–100% of that criterion's points
- Partially demonstrated or strongly implied by related experience → 60–75%
- Minimal or indirect evidence → 40–55%
- Genuinely absent with no reasonable inference → 20–35% (not zero — they got through to screening)

TIER 2 — Experience Depth (accounts for 25% of the total score weight):
This covers years of experience, seniority, scope of work, leadership, or complexity of past projects. Score based on actual evidence:
- Exceeds expectations for the level → 85–100%
- Meets expectations with solid history → 65–80%
- Slightly below expected level or years → 45–60%
- Significantly under-experienced → 25–40%

TIER 3 — Nice-to-Have Skills (accounts for 15% of the total score weight):
These are bonus qualifications, secondary tools, or preferred (not required) skills. Be generous here — do NOT penalize heavily for missing these:
- Present and demonstrated → 80–100%
- Implied or related equivalent present → 60–75%
- Absent entirely → 45–60% (this is a bonus category, not a dealbreaker)

SCORE CALIBRATION — your final score across all criteria should land roughly here:
- Strong candidate: most required skills present, solid experience → 70–85%
- Good mid-level candidate: relevant background, minor gaps → 55–70%
- Junior or partial-fit candidate → 40–55%
- Clearly unqualified → below 40%

Classify each rubric criterion into one of the three tiers above based on its name and description, then score accordingly. When in doubt about a tier, treat it as Tier 1.
Do NOT penalise for skills that are plausibly implied by the candidate's role history or industry background.

RED FLAG RULES — only flag these specific situations:
1. An unexplained employment gap of 2 or more years
2. Zero relevant skills or experience for a role that requires specific technical expertise
3. A clear mismatch between claimed seniority and actual experience (e.g., "10 years experience" with only 2 jobs totaling 3 years)
4. Applying for a role that requires a specific license/certification they demonstrably don't have
DO NOT flag: short tenures at startups, fewer years than ideal, missing one nice-to-have skill, career pivots, non-linear paths, or anything that requires assumption

SUMMARY RULES:
- Open with their current/most recent title and company (or field of work)
- Name 2–3 specific, concrete skills or achievements from the resume
- End with one sentence on how they fit (or don't fit) this specific role
- Write it as you'd say it to a hiring manager — direct, specific, no filler phrases like "strong candidate" or "well-rounded"

CONFIDENCE DEFINITIONS — set one per criterion:
- "high": Strong, explicit evidence in resume (named skill, titled role, direct achievement)
- "medium": Partial or inferred evidence (related role, implied skill, adjacent experience)
- "low": Weak or unclear signal (thin mention, assumed from context, no direct evidence)

Respond with ONLY this JSON (no markdown, no extra text):
{"name":"full name","email":"email or empty string","aiSummary":"specific 2-3 sentence summary","strengths":["concrete strength 1","concrete strength 2","concrete strength 3"],"redFlags":["only genuine red flags — omit this array or leave empty if none"],"scoreBreakdown":[{"criterion":"exact name from rubric","score":28,"maxScore":35,"reasoning":"one sentence citing specific resume evidence","confidence":"medium","tier":1}]}

For "tier": classify each criterion as 1 (must-have skill), 2 (experience depth), or 3 (nice-to-have), matching the THREE-TIER SCORING WEIGHTS defined above.`;

  // Any transport-level failure (auth, timeout, rate limit, all fallback
  // models exhausted) must NOT bubble up and hard-fail the apply/retry-score
  // request — it should degrade to the same "scoringFailed" state as an
  // unparseable AI response, so candidates are still saved and the user sees
  // a retryable "Scoring Unavailable" state instead of a generic 500.
  let raw: string;
  try {
    raw = await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 3000,
      nvidiaFallback: true,
    });
  } catch (err) {
    const rubricMaxScore = args.rubric.reduce((sum, r) => sum + r.weight, 0) || 100;
    const extractedName = extractNameFromResume(args.resumeText);
    console.error("[recruit] scoreCandidate: AI call failed:", err);
    return {
      name: extractedName,
      email: "",
      totalScore: 0,
      maxScore: rubricMaxScore,
      scoreBreakdown: [],
      aiSummary: "",
      redFlags: [],
      strengths: [],
      scoringFailed: true,
    };
  }

  const parsed = safeJson(raw);
  if (!parsed) {
    const rubricMaxScore = args.rubric.reduce((sum, r) => sum + r.weight, 0) || 100;
    const extractedName = extractNameFromResume(args.resumeText);
    console.error("[recruit] scoreCandidate: AI returned unparseable response. Raw output (first 500 chars):", raw?.slice(0, 500));
    return {
      name: extractedName,
      email: "",
      totalScore: 0,
      maxScore: rubricMaxScore,
      scoreBreakdown: [],
      aiSummary: "",
      redFlags: [],
      strengths: [],
      scoringFailed: true,
    };
  }

  const validConfidence = (v: any): "high" | "medium" | "low" =>
    v === "high" || v === "low" ? v : "medium";

  // Build deterministic tier map from rubric weights (60 / 25 / 15 split).
  // Criteria are sorted by weight descending; we accumulate until each
  // threshold is reached. This enforces the highest-weight criteria are
  // always Tier 1, regardless of what the AI classified them as.
  const totalRubricWeight = args.rubric.reduce((sum, r) => sum + r.weight, 0);
  const sortedRubric = [...args.rubric].sort((a, b) => b.weight - a.weight);
  // Store both raw and synonym-normalized keys so either form matches.
  const rubricTierMap = new Map<string, 1 | 2 | 3>();
  let accumulated = 0;
  for (const r of sortedRubric) {
    accumulated += r.weight;
    const pct = totalRubricWeight > 0 ? accumulated / totalRubricWeight : 1;
    const tier: 1 | 2 | 3 = pct <= 0.60 ? 1 : pct <= 0.85 ? 2 : 3;
    const raw = r.name.toLowerCase().trim();
    rubricTierMap.set(raw, tier);
    rubricTierMap.set(normalizeTerm(raw), tier); // also store canonical form
  }

  const resolveTier = (criterionName: string, aiTier: any): 1 | 2 | 3 => {
    const raw = (criterionName ?? "").toLowerCase().trim();
    const normalized = normalizeTerm(raw);

    // 1. Exact match on raw name
    if (rubricTierMap.has(raw)) return rubricTierMap.get(raw)!;
    // 2. Exact match on normalized name (catches React → react.js, JS → javascript, etc.)
    if (rubricTierMap.has(normalized)) return rubricTierMap.get(normalized)!;
    // 3. Partial match — normalized criterion substring of a normalized rubric key or vice versa
    for (const [rubricKey, tier] of rubricTierMap) {
      const normRubric = normalizeTerm(rubricKey);
      if (normalized.includes(normRubric) || normRubric.includes(normalized)) return tier;
    }
    // 4. AI fallback — validated integer only
    const n = Number(aiTier);
    return n === 1 || n === 2 || n === 3 ? n : 1;
  };

  const breakdown = (parsed.scoreBreakdown ?? []).map((b: any) => ({
    criterion: b.criterion ?? "",
    score: Number(b.score) || 0,
    maxScore: Number(b.maxScore) || 10,
    reasoning: (b.reasoning ?? "").trim(),
    confidence: validConfidence(b.confidence),
    tier: resolveTier(b.criterion, b.tier),
  })).filter((b: any) => b.criterion.length > 0);

  // Parsed JSON but with no usable criteria (missing/empty scoreBreakdown, or
  // every entry lacked a criterion name) is structurally invalid — treat it
  // the same as an unparseable response instead of silently persisting a
  // fabricated 0/100 score as if it were a real evaluation.
  if (breakdown.length === 0) {
    const rubricMaxScore = args.rubric.reduce((sum, r) => sum + r.weight, 0) || 100;
    const extractedName = extractNameFromResume(args.resumeText);
    console.error("[recruit] scoreCandidate: AI returned parseable but structurally invalid response (no score breakdown). Raw output (first 500 chars):", raw?.slice(0, 500));
    return {
      name: extractedName,
      email: "",
      totalScore: 0,
      maxScore: rubricMaxScore,
      scoreBreakdown: [],
      aiSummary: "",
      redFlags: [],
      strengths: [],
      scoringFailed: true,
    };
  }

  const totalScore = breakdown.reduce((sum: number, b: any) => sum + b.score, 0);
  const maxScore = breakdown.reduce((sum: number, b: any) => sum + b.maxScore, 0) || 100;

  const redFlags = Array.isArray(parsed.redFlags)
    ? parsed.redFlags.filter((f: unknown) => typeof f === "string" && f.trim().length > 0)
    : [];

  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
    : [];

  return {
    name: (parsed.name?.trim() || extractNameFromResume(args.resumeText)),
    email: parsed.email ?? "",
    totalScore,
    maxScore,
    scoreBreakdown: breakdown,
    aiSummary: (parsed.aiSummary ?? "").trim(),
    redFlags,
    strengths,
    scoringFailed: false,
  };
}

function formatNicheContext(niche?: string, nicheDetails?: Record<string, string>): string {
  if (!niche || !niche.trim()) return "";
  const detailLines = Object.entries(nicheDetails || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");
  return `\nJob Niche/Category: ${niche}${detailLines ? `\nNiche-specific details:\n${detailLines}` : ""}`;
}

async function generateInterviewBrief(args: {
  candidateName: string;
  jobTitle: string;
  resumeText: string;
  aiSummary: string;
  redFlags: string[];
  scoreBreakdown: { criterion: string; score: number; maxScore: number; reasoning: string }[];
  niche?: string;
  nicheDetails?: Record<string, string>;
  languageRequirement?: string;
}): Promise<string> {
  const lowScores = args.scoreBreakdown
    .filter((b) => b.score / b.maxScore < 0.6)
    .map((b) => `${b.criterion}: ${b.reasoning}`)
    .join("; ");

  const nicheContext = formatNicheContext(args.niche, args.nicheDetails);
  const languageLine = args.languageRequirement?.trim()
    ? `\nLanguage Requirement for this role: ${args.languageRequirement.trim()} — include at least one probing point to verify the candidate's proficiency in this.`
    : "";

  const prompt = `You are a senior talent acquisition specialist. Write a concise interview preparation brief for the interviewer.

Candidate: ${args.candidateName}
Role: ${args.jobTitle}${nicheContext}${languageLine}
AI Summary: ${args.aiSummary}
Red Flags: ${args.redFlags.join(", ") || "None identified"}
Weak Areas: ${lowScores || "None"}

Tailor the probing questions and verification points to fit this specific niche (e.g. a Content Creator role should probe portfolio quality/audience growth, not coding ability; a Healthcare role should verify licenses/certifications; a Blue-Collar role should probe shift reliability). Do not default to technical/coding questions unless the niche is actually tech-related.

Write a practical interview brief (250-350 words) covering:
1. Quick candidate summary (2 sentences)
2. 3-4 specific probing questions tailored to their weak areas or red flags
3. 2-3 skills or claims to verify with concrete examples
4. Overall hiring recommendation (Strong Yes / Yes / Maybe / No) with one-sentence reasoning

Write in plain text, no JSON, no markdown headers.`;

  try {
    return await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 2000,
      nvidiaFallback: true,
    });
  } catch (err) {
    console.error("[recruit] generateInterviewBrief: AI call failed:", err);
    return `Interview brief unavailable — the AI service could not be reached. Candidate: ${args.candidateName} for ${args.jobTitle}. Please review their resume and score breakdown manually before the interview.`;
  }
}

async function generateAssessmentQuestions(args: {
  jobTitle: string;
  rubric: { name: string; weight: number; description: string }[];
  jd: string;
  niche?: string;
  nicheDetails?: Record<string, string>;
  languageRequirement?: string;
}): Promise<{ id: string; text: string }[]> {
  const rubricText = args.rubric
    .map((r, i) => `${i + 1}. ${r.name} (${r.weight} pts): ${r.description}`)
    .join("\n");

  const nicheContext = formatNicheContext(args.niche, args.nicheDetails);
  const languageRule = args.languageRequirement?.trim()
    ? `\n- This role requires: ${args.languageRequirement.trim()}. At least one question should let the candidate demonstrate this in their written answer.`
    : "";

  const prompt = `You are a senior hiring manager at a fast-growing company. Generate exactly 5 written assessment questions for a candidate applying to be a ${args.jobTitle}.
${nicheContext}

SCORING RUBRIC (your questions must each probe a different criterion):
${rubricText}

JOB DESCRIPTION EXCERPT:
${args.jd.slice(0, 1200)}

STRICT REQUIREMENTS:
- Every question MUST be specific to the ${args.jobTitle} role AND its niche (${args.niche || "General"}) — no generic questions, and do NOT default to coding/technical questions unless the niche is actually tech-related
- Questions must require 2-4 paragraph written answers based on real experience
- Each question tests a DIFFERENT rubric criterion (match question 1 to criterion 1, etc.)
- Questions should reveal: depth of expertise, problem-solving, communication quality, judgment
- Do NOT ask trivial, yes/no, or easily-Googled questions
- Start each question with "Tell us about a time...", "Describe how you...", "Walk us through...", or "How would you approach..."${languageRule}

Respond with ONLY this exact JSON structure, no markdown, no extra text:
{"questions":[{"id":"q1","text":"..."},{"id":"q2","text":"..."},{"id":"q3","text":"..."},{"id":"q4","text":"..."},{"id":"q5","text":"..."}]}`;

  const defaultQuestions = [
    { id: "q1", text: `Describe a challenging technical problem you solved in a previous ${args.jobTitle} role. What was the situation, what actions did you take, and what was the measurable outcome?` },
    { id: "q2", text: `Walk us through a project where you had to work across teams or stakeholders with competing priorities. How did you navigate it and what did you learn?` },
    { id: "q3", text: `Tell us about a time you had to rapidly learn a new skill or technology under a tight deadline. How did you approach it and what was the result?` },
    { id: "q4", text: `Describe a situation where your initial approach to a problem was wrong. How did you identify it, course-correct, and what did you do differently afterward?` },
    { id: "q5", text: `As a ${args.jobTitle}, how would you approach your first 90 days — what would you prioritize, how would you measure early success, and what concerns would you flag to your manager?` },
  ];

  let raw: string;
  try {
    raw = await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 2000,
      nvidiaFallback: true,
    });
  } catch (err) {
    console.error("[recruit] generateAssessmentQuestions: AI call failed, using default questions:", err);
    return defaultQuestions;
  }

  const parsed = safeJson(raw);
  if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
    return parsed.questions.slice(0, 5).map((q: any, i: number) => ({
      id: q.id ?? `q${i + 1}`,
      text: (q.text ?? "").trim(),
    })).filter((q: { id: string; text: string }) => q.text.length > 10);
  }

  return defaultQuestions;
}

async function analyzeAssessmentAnswers(args: {
  candidateName: string;
  jobTitle: string;
  rubric: { name: string; weight: number; description: string }[];
  questions: { id: string; text: string }[];
  answers: { questionId: string; answer: string; timeTakenSeconds: number }[];
  resumeScore: number;
  maxScore: number;
  resumeSummary: string;
}): Promise<{
  newTotalScore: number;
  hiringDecision: "strong_yes" | "maybe" | "no";
  impact: { strengths: string[]; weaknesses: string[]; reasoning: string };
}> {
  const rubricText = args.rubric
    .map((r) => `- ${r.name} (${r.weight} pts): ${r.description}`)
    .join("\n");

  const resumePct = args.maxScore > 0 ? Math.round((args.resumeScore / args.maxScore) * 100) : 0;

  const qaText = args.questions.map((q, i) => {
    const ans = args.answers.find((a) => a.questionId === q.id);
    const timeTaken = ans?.timeTakenSeconds ?? 0;
    const answerText = ans?.answer?.trim() ?? "";
    const wordCount = answerText.split(/\s+/).filter(Boolean).length;
    const warnings: string[] = [];
    if (timeTaken > 0 && timeTaken < 25) warnings.push("⚠ Answered in under 25 seconds — possible copy-paste or very brief effort");
    if (wordCount < 20 && answerText.length > 0) warnings.push("⚠ Very short answer (fewer than 20 words)");
    if (answerText.length === 0) warnings.push("⚠ No answer provided");
    const warningLine = warnings.length > 0 ? `\n[${warnings.join("; ")}]` : "";
    return `Q${i + 1}: ${q.text}\nAnswer: ${answerText || "(blank)"}${warningLine}`;
  }).join("\n\n---\n\n");

  const prompt = `You are a senior talent acquisition specialist. Evaluate the written assessment responses below for the ${args.jobTitle} role.

CANDIDATE: ${args.candidateName}
RESUME SCORE: ${resumePct}% (${args.resumeScore}/${args.maxScore} points)
RESUME SUMMARY: ${args.resumeSummary}

SCORING RUBRIC:
${rubricText}

ASSESSMENT RESPONSES:
${qaText}

Your task: Combine the resume quality (${resumePct}%) with the assessment quality to produce a final combined score.

SCORING GUIDANCE:
- If assessment answers are EXCELLENT (specific, detailed, clearly experienced): raise score up to +15 points from resume
- If answers MATCH the resume quality (solid, relevant): keep score within ±5 points of resume
- If answers are WEAK (vague, generic, very short, copy-paste signals): lower score by 10-20 points
- If answers are COMPLETELY EMPTY or nonsensical: lower score by 20-30 points

Respond with ONLY this JSON (no markdown, no extra text):
{"combinedScorePercent":72,"hiringDecision":"maybe","impact":{"strengths":["strength from assessment","another strength"],"weaknesses":["weakness if any"],"reasoning":"2-3 sentences explaining what the assessment revealed and why the score changed"}}

Rules:
- combinedScorePercent: integer 0-100 (the final combined score as a percentage, informed by BOTH resume and assessment)
- hiringDecision: "strong_yes" if ≥78%, "maybe" if 55-77%, "no" if <55%
- strengths: 2-4 specific, concrete observations from the actual answers (quote or reference what they said)
- weaknesses: 0-3 genuine concerns (if none, use empty array)
- reasoning: specific explanation of what the assessment revealed that the resume did not show`;

  let raw: string | null = null;
  try {
    raw = await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.25,
      max_tokens: 2000,
      nvidiaFallback: true,
    });
  } catch (err) {
    console.error("[recruit] analyzeAssessmentAnswers: AI call failed, keeping resume score:", err);
  }

  const parsed = raw ? safeJson(raw) : null;

  const combinedPct = typeof parsed?.combinedScorePercent === "number"
    ? Math.max(0, Math.min(100, parsed.combinedScorePercent))
    : resumePct;

  const newTotalScore = Math.round((combinedPct / 100) * args.maxScore);

  const hiringDecision: "strong_yes" | "maybe" | "no" =
    parsed?.hiringDecision === "strong_yes" || parsed?.hiringDecision === "maybe" || parsed?.hiringDecision === "no"
      ? parsed.hiringDecision
      : combinedPct >= 78 ? "strong_yes" : combinedPct >= 55 ? "maybe" : "no";

  const strengths = Array.isArray(parsed?.impact?.strengths)
    ? parsed.impact.strengths.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
    : [];
  const weaknesses = Array.isArray(parsed?.impact?.weaknesses)
    ? parsed.impact.weaknesses.filter((w: unknown) => typeof w === "string" && w.trim().length > 0)
    : [];
  const reasoning = typeof parsed?.impact?.reasoning === "string" && parsed.impact.reasoning.trim().length > 0
    ? parsed.impact.reasoning
    : `Assessment completed. Final combined score: ${combinedPct}%.`;

  return {
    newTotalScore,
    hiringDecision,
    impact: { strengths, weaknesses, reasoning },
  };
}

async function generateRejectionEmail(args: {
  candidateName: string;
  jobTitle: string;
  stage: string;
}): Promise<string> {
  const stageContext: Record<string, string> = {
    applied: "after reviewing their application",
    screened: "after an initial review of their profile",
    assessed: "after reviewing their written assessment",
    interview: "after the interview stage",
    offer: "after careful consideration of the offer stage",
  };
  const context = stageContext[args.stage] ?? "after careful consideration";

  const prompt = `Write a rejection email for a job candidate. The email should feel human, warm, and genuinely respectful — not a corporate template.

Candidate first name: ${args.candidateName.split(" ")[0]}
Role: ${args.jobTitle}
Stage: ${context}

Write the email body only (no subject line). Follow this structure:
1. Open with their first name and a warm, specific acknowledgment of their interest in the ${args.jobTitle} role
2. Deliver the news clearly but kindly in one sentence — do not be vague or overly corporate
3. Offer one genuine, positive observation (e.g., "We were impressed by your background in X" or "It was clear you put genuine thought into your application")
4. Close with encouragement — keep the door open for future roles, wish them well
5. End with a warm sign-off

TONE RULES:
- Sound like a real person wrote this, not an HR bot
- Avoid clichés: "we regret to inform", "we had many strong candidates", "we'll keep your resume on file"
- Use contractions naturally (we're, we've, you've)
- Keep it under 200 words
- Do not use bullet points or formal headers`;

  try {
    return await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.75,
      max_tokens: 1000,
      nvidiaFallback: true,
    });
  } catch (err) {
    console.error("[recruit] generateRejectionEmail: AI call failed, using template:", err);
    return `Hi ${args.candidateName.split(" ")[0]},\n\nThank you for your interest in the ${args.jobTitle} role and for the time you invested ${context}. After careful consideration, we've decided to move forward with other candidates whose experience more closely matches what we need right now.\n\nThis isn't a reflection of your abilities, and we'd genuinely encourage you to apply for future openings that fit your background. We wish you the very best in your search.\n\nWarm regards`;
  }
}

recruitRouter.post("/jobs", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const {
      title, niche, companyName, companyType, jobType, department, seniority, location, workMode,
      responsibilities, mustHaveSkills, niceToHaveSkills, nicheDetails,
      salaryMin, salaryMax, salaryCurrency, experienceMin, experienceMax,
      educationRequirement, noticePeriod, freshersAllowed, verifiedCompany, publicVisibility,
      openings, applicationDeadline, perks, languageRequirement, timezoneOverlap,
    } = req.body;

    // Some niches (content/creator, education, social media, etc.) are
    // inherently location-agnostic — same rule the frontend uses so a
    // remote/niche-appropriate job doesn't get blocked on a fake location.
    const LOCATION_OPTIONAL_NICHES = new Set([
      "Content & Creator Economy",
      "Education & EdTech",
      "Social Media & Community Management",
    ]);
    const locationRequired = workMode !== "remote" && !LOCATION_OPTIONAL_NICHES.has(niche);

    if (!title?.trim() || title.trim().length < 3) return res.status(400).json({ error: "Job title must be at least 3 characters." });
    if (!companyName?.trim()) return res.status(400).json({ error: "Company name is required." });
    if (locationRequired && !location?.trim()) return res.status(400).json({ error: "Location is required for this role." });
    if (!responsibilities?.trim() && !mustHaveSkills?.trim()) {
      return res.status(400).json({ error: "Please provide either key responsibilities or must-have skills." });
    }

    const SPAM_WORDS = ["work from home earn money", "earn daily", "earn per day", "no investment", "part time earn", "₹ daily", "earn ₹", "guaranteed income", "100% work from home easy money"];
    const titleLower = (title || "").toLowerCase();
    const respLower = (responsibilities || "").toLowerCase();
    if (SPAM_WORDS.some(w => titleLower.includes(w) || respLower.includes(w))) {
      return res.status(400).json({ error: "This job listing appears to contain spam or misleading content. Please review and revise." });
    }

    const companyProfileForVerif = await RecruitCompanyProfile.findOne({ uid }).lean();
    const isVerifiedCompany = (companyProfileForVerif as any)?.verificationStatus === "verified";

    const safeNicheDetails: Record<string, string> =
      nicheDetails && typeof nicheDetails === "object" && !Array.isArray(nicheDetails)
        ? Object.fromEntries(
            Object.entries(nicheDetails)
              .filter(([, v]) => typeof v === "string" && v.trim())
              .map(([k, v]) => [String(k).slice(0, 60), String(v).trim().slice(0, 500)])
          )
        : {};

    const safeOpenings = openings !== undefined && openings !== "" && Number(openings) > 0 ? Math.floor(Number(openings)) : 1;
    const safeDeadline = applicationDeadline && !isNaN(new Date(applicationDeadline).getTime()) ? new Date(applicationDeadline) : undefined;
    const safePerks = typeof perks === "string" ? perks.trim().slice(0, 1000) : "";
    const safeLanguageRequirement = typeof languageRequirement === "string" ? languageRequirement.trim().slice(0, 200) : "";
    const safeTimezoneOverlap = typeof timezoneOverlap === "string" ? timezoneOverlap.trim().slice(0, 200) : "";

    // Fail-closed on plan capacity before spending an AI generation.
    await assertStandardResourceLimit(uid, "active_jobs");
    await assertStandardResourceLimit(uid, "stored_jobs");

    let jd: string;
    let rubric: { name: string; weight: number; description: string }[];
    try {
      ({ jd, rubric } = await runStandardBillingOperation({
        ownerUid: uid,
        operation: "job_generation",
        idempotencyKey: standardRequestIdempotencyKey(
          uid,
          "job-generation",
          standardIdempotencyHeader(req) || standardContentHash(`${title}:${responsibilities || ""}:${mustHaveSkills || ""}`),
        ),
        resourceType: "job",
        work: async () => generateJobDescription({
          title, department: department || "", seniority: seniority || "Mid-level",
          location: location || "Remote", workMode: workMode || "remote",
          responsibilities: responsibilities || "", mustHaveSkills: mustHaveSkills || "",
          niceToHaveSkills: niceToHaveSkills || "",
          salaryMin: salaryMin ? Number(salaryMin) : undefined,
          salaryMax: salaryMax ? Number(salaryMax) : undefined,
          salaryCurrency: salaryCurrency || "INR",
          niche: niche || "AI, Data, Software & Product Tech",
          nicheDetails: safeNicheDetails,
          openings: safeOpenings,
          perks: safePerks,
          languageRequirement: safeLanguageRequirement,
          timezoneOverlap: safeTimezoneOverlap,
          applicationDeadline: safeDeadline,
        }),
      }));
    } catch (genErr) {
      // Resource limits already asserted — AI quota exhaustion should not block job create.
      if (!isStandardBillingError(genErr)) throw genErr;
      console.warn("[recruit] job_generation blocked by billing — creating job with template JD:", (genErr as Error).message);
      jd = `# ${String(title).trim()}\n\n${String(responsibilities || "").trim()}\n\n## Must-have skills\n${String(mustHaveSkills || "").trim()}`;
      rubric = [
        { name: "Role Fit", weight: 40, description: "Alignment with the role requirements." },
        { name: "Relevant Experience", weight: 30, description: "Years and quality of relevant experience." },
        { name: "Communication & Culture Fit", weight: 20, description: "Clarity and professionalism." },
        { name: "Growth & Initiative", weight: 10, description: "Evidence of learning and initiative." },
      ];
    }

    const job = await RecruitJob.create({
      uid, title,
      niche: niche || "AI, Data, Software & Product Tech",
      companyName: companyName || "",
      companyType: companyType || "",
      jobType: jobType || "Full-time",
      department: department || "", seniority: seniority || "Mid-level",
      location: location || "Remote", workMode: workMode || "remote",
      responsibilities: responsibilities || "", mustHaveSkills: mustHaveSkills || "",
      niceToHaveSkills: niceToHaveSkills || "",
      nicheDetails: safeNicheDetails,
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      salaryMax: salaryMax ? Number(salaryMax) : undefined,
      salaryCurrency: salaryCurrency || "INR",
      experienceMin: experienceMin !== undefined && experienceMin !== "" ? Number(experienceMin) : undefined,
      experienceMax: experienceMax !== undefined && experienceMax !== "" ? Number(experienceMax) : undefined,
      educationRequirement: educationRequirement || "",
      noticePeriod: noticePeriod || "",
      freshersAllowed: Boolean(freshersAllowed),
      verifiedCompany: isVerifiedCompany,
      publicVisibility: publicVisibility !== false,
      openings: safeOpenings,
      applicationDeadline: safeDeadline,
      perks: safePerks,
      languageRequirement: safeLanguageRequirement,
      timezoneOverlap: safeTimezoneOverlap,
      generatedJD: jd, rubric, status: "active", candidateCount: 0,
    });

    trackEvent("recruiter_job_posted", uid, { jobId: String(job._id), niche, title });
    return res.json({ job });
  } catch (err: any) {
    if (await respondStandardBillingError(res, err, getUid(req))) return;
    console.error("[recruit] POST /jobs", err);
    return res.status(500).json({ error: err.message || "Failed to create job." });
  }
});

recruitRouter.get("/jobs", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const jobs = await RecruitJob.find({ uid }).sort({ createdAt: -1 }).lean();
    return res.json({ jobs: jobs.map(serializeRecruitJob) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.get("/jobs/:jobId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access) return res.status(404).json({ error: "Job not found." });
    const job = access.job;
    return res.json({ job: serializeRecruitJob(job) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.patch("/jobs/:jobId", async (req, res) => {
  let billingOwnerUid = "";
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "configure_job")) return res.status(403).json({ error: "You do not have permission to configure this job." });
    billingOwnerUid = standardBillingOwnerUid(access.job);
    const allowed = [
      "status", "title", "niche", "companyName", "companyType", "jobType",
      "department", "location", "workMode", "salaryMin", "salaryMax",
      "experienceMin", "experienceMax", "educationRequirement", "noticePeriod",
      "freshersAllowed", "publicVisibility",
      "openings", "applicationDeadline", "perks", "languageRequirement", "timezoneOverlap",
      "generatedJD", "rubric",
    ];
    const update: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.rubric !== undefined) {
      if (!Array.isArray(update.rubric) || update.rubric.length === 0) {
        return res.status(400).json({ error: "rubric must be a non-empty array." });
      }
      update.rubric = update.rubric.map((r: any) => ({
        name: String(r.name ?? "").trim().slice(0, 120),
        weight: Math.max(1, Math.min(100, Number(r.weight) || 10)),
        description: String(r.description ?? "").trim().slice(0, 500),
      })).filter((r: any) => r.name.length > 0);
      if (!update.rubric.length) {
        return res.status(400).json({ error: "rubric must include at least one named criterion." });
      }
    }
    if (update.openings !== undefined) {
      const n = Number(update.openings);
      update.openings = n > 0 ? Math.floor(n) : 1;
    }
    if (update.applicationDeadline !== undefined) {
      const d = new Date(update.applicationDeadline);
      update.applicationDeadline = isNaN(d.getTime()) ? undefined : d;
    }
     if (update.publicVisibility !== undefined) {
       update.publicVisibility = update.publicVisibility !== false;
       if ((access.job as any).publicVisibility === false && update.publicVisibility === true) {
         return res.status(400).json({ error: "Private jobs cannot be changed back to public. Create a new job to publish this role." });
       }
     }
    if (update.perks !== undefined) {
      update.perks = typeof update.perks === "string" ? update.perks.trim().slice(0, 1000) : "";
    }
    if (update.languageRequirement !== undefined) {
      update.languageRequirement = typeof update.languageRequirement === "string" ? update.languageRequirement.trim().slice(0, 200) : "";
    }
    if (update.timezoneOverlap !== undefined) {
      update.timezoneOverlap = typeof update.timezoneOverlap === "string" ? update.timezoneOverlap.trim().slice(0, 200) : "";
    }
    const companyProfileForPatch = await RecruitCompanyProfile.findOne({ uid }).lean();
    update.verifiedCompany = (companyProfileForPatch as any)?.verificationStatus === "verified";

    // Reactivating (or activating) a job consumes an active-jobs slot — fail closed.
    if (
      update.status === "active" &&
      (access.job as any).status !== "active"
    ) {
      await assertStandardResourceLimit(standardBillingOwnerUid(access.job), "active_jobs");
    }

    const job = await RecruitJob.findOneAndUpdate({ _id: req.params.jobId, uid: access.job.uid }, update, { returnDocument: "after" }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ job: serializeRecruitJob(job) });
  } catch (err: any) {
    if (billingOwnerUid && await respondStandardBillingError(res, err, billingOwnerUid)) return;
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/jobs", async (req, res) => {
  try {
    await connectMongo();
    const filter = buildPublicJobQuery(req.query);
    const jobs = await RecruitJob.find(filter)
      .select("title niche companyName companyType jobType department seniority location workMode salaryMin salaryMax salaryCurrency experienceMin experienceMax educationRequirement noticePeriod freshersAllowed verifiedCompany candidateCount createdAt mustHaveSkills generatedJD openings applicationDeadline")
      .sort({ verifiedCompany: -1, createdAt: -1 })
      .limit(80)
      .lean();
    return res.json({ jobs: jobs.map(serializeRecruitJob) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load jobs." });
  }
});

// ─── Public username profiles ─────────────────────────────────────────────────
// These endpoints intentionally return curated DTOs rather than authenticated
// profile documents. Private contact details, resume text, saved jobs, and
// recruiter internals never leave the server.
recruitPublicRouter.get("/profiles/seeker/:username", async (req, res) => {
  try {
    await connectMongo();
    const username = normalizePublicUsername(req.params.username);
    if (!username) return res.status(404).json({ error: "Profile not found." });

    const identity = await RecruitProfile.findOne({ username, role: "seeker" })
      .select("uid username")
      .lean();
    if (!identity) return res.status(404).json({ error: "Profile not found." });

    const profile = await RecruitSeekerProfile.findOne({ uid: identity.uid }).lean();
    if (!profile) return res.status(404).json({ error: "Profile not found." });

    return res.json({ profile: publicSeekerDto(profile, username) });
  } catch (err: any) {
    console.error("[recruit-public] GET /profiles/seeker/:username", err);
    return res.status(500).json({ error: "Failed to load profile." });
  }
});

recruitPublicRouter.get("/profiles/creator/:username", async (req, res) => {
  try {
    await connectMongo();
    const username = normalizePublicUsername(req.params.username);
    if (!username) return res.status(404).json({ error: "Profile not found." });

    const identity = await RecruitProfile.findOne({ username, role: "creator" })
      .select("uid username")
      .lean();
    if (!identity) return res.status(404).json({ error: "Profile not found." });

    const [profile, jobs] = await Promise.all([
      RecruitCompanyProfile.findOne({ uid: identity.uid }).lean(),
      RecruitJob.find({
        uid: identity.uid,
        status: "active",
        publicVisibility: { $ne: false },
      })
        .select("_id title location workMode jobType seniority niche salaryMin salaryMax salaryCurrency openings createdAt")
        .sort({ verifiedCompany: -1, createdAt: -1 })
        .limit(50)
        .lean(),
    ]);
    if (!profile) return res.status(404).json({ error: "Profile not found." });

    return res.json({ profile: publicCreatorDto(profile, username, jobs) });
  } catch (err: any) {
    console.error("[recruit-public] GET /profiles/creator/:username", err);
    return res.status(500).json({ error: "Failed to load profile." });
  }
});

// ─── Parse resume file → extract text ────────────────────────────────────────
recruitPublicRouter.post(
  "/parse-resume",
  publicParseResumeRateLimit,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    resumeUpload.single("resume")(req, res, (err) => {
      if (err) {
        // Normalise multer/file-filter errors into clean JSON
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err.message || "File upload error." });
      }
      next();
    });
  },
  async (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded." });

      const { mimetype, buffer } = req.file;
      let text = "";

      if (mimetype === "application/pdf") {
        // Use lib path directly — bypasses pdf-parse's test runner code which
        // tries to read a local test file and throws in production environments.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require("pdf-parse/lib/pdf-parse");
        let data: any;
        try {
          data = await pdfParse(buffer);
        } catch (pdfErr: any) {
          // Scanned / image-only PDFs produce no text layer — give a helpful message
          const msg = pdfErr?.message ?? "";
          if (msg.includes("No password") || msg.includes("password")) {
            return res.status(422).json({ error: "This PDF is password-protected. Please remove the password and try again." });
          }
          throw pdfErr; // unexpected — rethrow to outer catch
        }
        text = data.text ?? "";
        if (!text.trim()) {
          return res.status(422).json({
            error: "Your PDF appears to be a scanned image — it has no readable text layer. Please export as a text-based PDF, or paste your resume manually.",
          });
        }
      } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value ?? "";
        if (!text.trim()) {
          return res.status(422).json({ error: "Could not extract text from this DOCX. Please try saving it again and re-uploading." });
        }
      } else if (mimetype === "text/plain") {
        text = buffer.toString("utf-8");
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file." });
      }

      // ── Clean & normalise extracted text ──────────────────────────────────
      text = text
        // Normalise all line endings
        .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
        // Strip null bytes and non-printable control chars (keep tab + newline)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        // Collapse runs of spaces/tabs on a single line to one space
        .replace(/[^\S\n]+/g, " ")
        // Remove blank lines that contain only whitespace
        .replace(/^ +$/gm, "")
        // Collapse 3+ consecutive blank lines to two (preserve section breaks)
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (text.length < 40) {
        return res.status(422).json({ error: "Could not extract enough text from this file. Please try pasting your resume manually." });
      }

      return res.json({ ok: true, text });
    } catch (err: any) {
      console.error("[recruit-public] POST /parse-resume", err);
      return res.status(500).json({ error: err.message || "Failed to parse resume." });
    }
  }
);

recruitPublicRouter.get("/jobs/:jobId", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ job: serializeRecruitJob(job) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load job." });
  }
});

recruitPublicRouter.post("/jobs/:jobId/apply", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    });
    if (!job) return res.status(404).json({ error: "Job not found." });

    const { name, email, phone, resumeText, source, location, currentStatus, educationLevel, currentClassYear, availability, coverLetter, linkedinUrl, recaptchaToken } = req.body;

    // ── Google reCAPTCHA v3 bot check ─────────────────────────────────────────
    const captcha = await verifyRecaptcha(recaptchaToken ?? "");
    if (!captcha.ok) {
      return res.status(403).json({ error: RECAPTCHA_REJECTION_MESSAGE });
    }
    if (!name?.trim()) return res.status(400).json({ error: "Name is required." });
    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });
    if (!resumeText?.trim() || resumeText.trim().length < 40) {
      return res.status(400).json({ error: "Resume or profile summary must be at least 40 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await RecruitCandidate.findOne({
      jobId: job._id,
      email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).lean();
    if (existing) {
      return res.status(409).json({ error: "You have already applied to this job." });
    }

    const rubricMaxScore = (job.rubric ?? []).reduce((sum: number, r: any) => sum + (r.weight ?? 0), 0) || 100;

    // Owner (job.uid) is billed for public applications — never the applicant.
    const ownerUid = standardBillingOwnerUid(job);
    if (!ownerUid) return res.status(503).json({ error: "This job cannot accept applications right now." });

    // Reserve owner capacity BEFORE persisting the applicant (Pattern C).
    let candidate;
    try {
      candidate = await runStandardBillingOperation({
        ownerUid,
        operation: "new_candidate_intake",
        idempotencyKey: standardIdempotencyKey(ownerUid, [
          "intake",
          String(job._id),
          normalizedEmail || standardContentHash(resumeText),
        ]),
        resourceType: "job",
        resourceId: String(job._id),
        // Save immediately — score + automation run in background (non-blocking for candidate).
        work: async () => {
          await assertStandardResourceLimit(ownerUid, "stored_candidates");
          return RecruitCandidate.create({
            jobId: job._id,
            uid: job.uid,
            name: name.trim(),
            email,
            phone: phone || "",
            resumeText,
            totalScore: 0,
            maxScore: rubricMaxScore,
            scoreBreakdown: [],
            aiSummary: "",
            redFlags: [],
            strengths: [],
            stage: "applied",
            stageMovedAt: new Date(),
            assessmentStatus: "not_sent",
            previousResumeScore: 0,
            scoringFailed: true,
            source: source || "Rolebolt Jobs",
            location: location || "",
            currentStatus: currentStatus || "",
            educationLevel: educationLevel || "",
            currentClassYear: currentClassYear || "",
            availability: availability || "",
            coverLetter: coverLetter || "",
            linkedinUrl: linkedinUrl || "",
          });
        },
      });
    } catch (billingErr) {
      if (await respondStandardBillingError(res, billingErr, ownerUid)) return;
      throw billingErr;
    }

    await RecruitJob.updateOne({ _id: job._id }, { $inc: { candidateCount: 1 } });

    res.status(201).json({ ok: true, candidateId: candidate._id });

    const candidateId = String(candidate._id);
    const jobLean = job;
    // Phase 4 verified: this async public-apply scoring meters at execution time
    // via meterCandidateScore (candidate_score, owner-stable idempotency key), and
    // the downstream finalize → schedulePostIntakeAutomation / dispatchAgentActions
    // / evaluatePipelineRules legs each meter their own AI/email operations.
    setImmediate(async () => {
      try {
        const scored = await meterCandidateScore(ownerUid, jobLean, resumeText);
        await finalizeScoredCandidate({
          job: jobLean,
          candidateId,
          scored,
          candidateEmail: email,
          fallbackName: name.trim(),
          logPrefix: "agent",
        });
      } catch (e) {
        console.error("[recruit-public] background scoring failed (non-fatal):", e);
      }
    });
  } catch (err: any) {
    console.error("[recruit-public] POST /jobs/:jobId/apply", err);
    if (!res.headersSent) {
      const owner = standardBillingOwnerUid(
        await RecruitJob.findOne({ _id: req.params.jobId }).select("uid").lean().catch(() => null),
      );
      if (owner && await respondStandardBillingError(res, err, owner)) return;
      return res.status(500).json({ error: err.message || "Failed to submit application." });
    }
  }
});

recruitRouter.delete("/jobs/:jobId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "delete_job")) return res.status(403).json({ error: "You do not have permission to delete this job." });
    await RecruitJob.deleteOne({ _id: req.params.jobId, uid: access.job.uid });
    await RecruitCandidate.deleteMany({ jobId: req.params.jobId, uid: access.job.uid });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── AI Agent Activity Log ─────────────────────────────────────────────────────
recruitRouter.get("/jobs/:jobId/agent-log", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "view_candidates")) {
      return res.status(404).json({ error: "Job not found." });
    }
    const jobUid = access.job.uid;

    const candidates = await RecruitCandidate.find(
      { jobId: req.params.jobId, uid: jobUid, "agentLog.0": { $exists: true } },
      { _id: 1, name: 1, email: 1, agentLog: 1 },
    ).lean();

    // Flatten + annotate with candidateId/name/email, sort newest first
    const entries: {
      candidateId: string;
      candidateName: string;
      candidateEmail: string;
      action: string;
      score: number;
      reason: string;
      emailSent: boolean;
      emailStatus: string;
      timestamp: string;
    }[] = [];

    for (const c of candidates) {
      const log = (c as any).agentLog ?? [];
      for (const entry of log) {
        entries.push({
          candidateId:    String(c._id),
          candidateName:  (c as any).name,
          candidateEmail: (c as any).email || "",
          action:         entry.action,
          score:          entry.score,
          reason:         entry.reason,
          emailSent:      entry.emailSent,
          emailStatus:    entry.emailStatus,
          timestamp:      entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
        });
      }
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({ ok: true, entries, total: entries.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── AI Agent Stats ────────────────────────────────────────────────────────────
// GET /recruit/jobs/:jobId/agent-stats?period=week
// period: today | week | month | all
recruitRouter.get("/jobs/:jobId/agent-stats", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "view_candidates")) {
      return res.status(404).json({ error: "Job not found." });
    }
    const job = access.job;
    const jobUid = job.uid;

    const period = (req.query.period as string) || "week";
    let since: Date | null = null;
    const now = new Date();
    if (period === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    // "all" → since = null (no date filter)

    // Pull candidates with agentLog entries for this job
    const candidates = await RecruitCandidate.find(
      { jobId: req.params.jobId, uid: jobUid, "agentLog.0": { $exists: true } },
      { agentLog: 1, emailLog: 1, totalScore: 1, maxScore: 1 },
    ).lean();

    let shortlisted = 0;
    let rejected = 0;
    let reviewZone = 0;
    let emailsSent = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const c of candidates) {
      const agentLog: any[] = (c as any).agentLog ?? [];
      const emailLog: any[] = (c as any).emailLog ?? [];

      // Count only the latest triage entry per candidate (avoids double-count on retry-score).
      const entriesInPeriod = agentLog.filter(entry => {
        const ts = entry.timestamp ? new Date(entry.timestamp) : null;
        if (since && ts && ts < since) return false;
        return true;
      });
      if (entriesInPeriod.length > 0) {
        const latest = entriesInPeriod.reduce((a, b) =>
          new Date(a.timestamp).getTime() >= new Date(b.timestamp).getTime() ? a : b,
        );
        if (latest.action === "shortlisted") shortlisted++;
        else if (latest.action === "rejected") rejected++;
        else if (latest.action === "review_zone") reviewZone++;
        if (typeof latest.score === "number") {
          scoreSum += latest.score;
          scoreCount++;
        }
      }

      // Count agent emails sent in the period
      for (const e of emailLog) {
        if (!["agent_shortlisted", "agent_rejected", "agent_review_zone"].includes(e.type)) continue;
        if (e.status !== "sent") continue;
        const ts = e.sentAt ? new Date(e.sentAt) : null;
        if (since && ts && ts < since) continue;
        emailsSent++;
      }
    }

    const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;
    const totalProcessed = shortlisted + rejected + reviewZone;

    // Simple rule-based AI recommendations
    const insights: string[] = [];
    const agentMode = (job as any).agentMode ?? {};
    const shortlistThreshold = agentMode.shortlistThreshold ?? 75;
    const rejectThreshold = agentMode.rejectThreshold ?? 40;

    if (totalProcessed > 0) {
      const reviewPct = Math.round((reviewZone / totalProcessed) * 100);
      const shortlistPct = Math.round((shortlisted / totalProcessed) * 100);
      const rejectPct = Math.round((rejected / totalProcessed) * 100);

      if (reviewPct >= 70) {
        insights.push(`${reviewPct}% of candidates are in the Review zone. Consider adjusting your shortlist threshold (currently ${shortlistThreshold}%).`);
      }
      if (shortlistPct <= 10 && totalProcessed >= 5) {
        insights.push(`Very few candidates are being shortlisted (${shortlistPct}%). Your scoring criteria may be too strict.`);
      }
      if (shortlistPct >= 70 && totalProcessed >= 5) {
        insights.push(`Most candidates are being shortlisted (${shortlistPct}%). Consider increasing the shortlist threshold (currently ${shortlistThreshold}%).`);
      }
      if (rejectPct >= 80 && totalProcessed >= 5) {
        insights.push(`High rejection rate (${rejectPct}%). Consider reviewing your rubric or lowering the reject threshold (currently ${rejectThreshold}%).`);
      }
      if (avgScore !== null && avgScore < rejectThreshold + 10 && totalProcessed >= 3) {
        insights.push(`Average AI score is ${avgScore}%, close to your reject threshold. Your job description may need clearer requirements.`);
      }
    }

    return res.json({
      ok: true,
      period,
      stats: { shortlisted, rejected, reviewZone, emailsSent, avgScore, totalProcessed },
      insights,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── AI Agent Mode settings ────────────────────────────────────────────────────
recruitRouter.patch("/jobs/:jobId/agent-mode", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "configure_job")) {
      return res.status(403).json({ error: "You do not have permission to configure AI Agent settings." });
    }

    const { enabled, shortlistThreshold, rejectThreshold, autoEmailShortlist, autoEmailReject, autoSendAssessment, emailReviewZoneCandidates } = req.body;
    const currentMode = ((access.job as any).agentMode ?? {}) as Record<string, unknown>;

    const mergedMode = {
      ...currentMode,
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(shortlistThreshold !== undefined ? { shortlistThreshold: Number(shortlistThreshold) } : {}),
      ...(rejectThreshold !== undefined ? { rejectThreshold: Number(rejectThreshold) } : {}),
      ...(autoEmailShortlist !== undefined ? { autoEmailShortlist: Boolean(autoEmailShortlist) } : {}),
      ...(autoEmailReject !== undefined ? { autoEmailReject: Boolean(autoEmailReject) } : {}),
      ...(autoSendAssessment !== undefined ? { autoSendAssessment: Boolean(autoSendAssessment) } : {}),
      ...(emailReviewZoneCandidates !== undefined ? { emailReviewZoneCandidates: Boolean(emailReviewZoneCandidates) } : {}),
    };
    const { shortlistThreshold: normShortlist, rejectThreshold: normReject } = normalizeAgentThresholds(mergedMode);

    const update: Record<string, unknown> = {};
    if (enabled !== undefined) update["agentMode.enabled"] = Boolean(enabled);
    if (shortlistThreshold !== undefined || rejectThreshold !== undefined) {
      update["agentMode.shortlistThreshold"] = normShortlist;
      update["agentMode.rejectThreshold"] = normReject;
    }
    if (autoEmailShortlist !== undefined) update["agentMode.autoEmailShortlist"] = Boolean(autoEmailShortlist);
    if (autoEmailReject !== undefined) update["agentMode.autoEmailReject"] = Boolean(autoEmailReject);
    if (autoSendAssessment !== undefined) update["agentMode.autoSendAssessment"] = Boolean(autoSendAssessment);
    if (emailReviewZoneCandidates !== undefined) update["agentMode.emailReviewZoneCandidates"] = Boolean(emailReviewZoneCandidates);

    const job = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, uid: access.job.uid },
      { $set: update },
      { returnDocument: "after" },
    ).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ ok: true, agentMode: (job as any).agentMode });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Job Performance Monitor ───────────────────────────────────────────────────

async function checkJobPerformanceAlerts(jobId: string): Promise<void> {
  const job = await RecruitJob.findById(jobId).lean() as any;
  if (!job || job.status !== "active") return;

  const daysSinceCreated = (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const applicationCount = await RecruitCandidate.countDocuments({ jobId: job._id });
  const rejectedCount    = await RecruitCandidate.countDocuments({ jobId: job._id, stage: "rejected" });
  const hiredCount       = await RecruitCandidate.countDocuments({ jobId: job._id, stage: "hired" });

  const existing: string[] = (job.performanceAlerts ?? [])
    .filter((a: any) => !a.dismissed)
    .map((a: any) => a.type);

  const toAdd: any[] = [];

  // Check: low applications after 7+ days
  if (daysSinceCreated >= 7 && applicationCount < 5 && !existing.includes("low_applications")) {
    const prompt = `Job Title: ${job.title}
Days posted: ${Math.floor(daysSinceCreated)}
Applications received: ${applicationCount}
Required skills: ${job.mustHaveSkills || "not specified"}
Location: ${job.location}, Work mode: ${job.workMode}

This job has very few applications. Give exactly 3 specific, actionable suggestions to get more applications.
Return JSON only: {"suggestions": ["suggestion1", "suggestion2", "suggestion3"]}`;
    let suggestions: string[] = [];
    try {
      const nvidiaRaw = await callNvidia({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 300,
        responseFormat: "json_object",
      });
      const parsed = JSON.parse(nvidiaRaw);
      suggestions = parsed.suggestions ?? [];
      console.log("[perf-monitor] Nvidia succeeded for performance alert suggestions ✓");
    } catch (nvidiaErr) {
      console.error("[perf-monitor] Nvidia failed, using default suggestions:", nvidiaErr);
      suggestions = [
        "Consider adding a remote work option to reach more candidates",
        "Reduce required years of experience or mark some skills as 'nice to have'",
        "Share the job listing on LinkedIn and relevant job boards",
      ];
    }
    toAdd.push({
      id: crypto.randomUUID(),
      type: "low_applications",
      message: `Only ${applicationCount} application${applicationCount !== 1 ? "s" : ""} in ${Math.floor(daysSinceCreated)} days.`,
      aiSuggestions: suggestions,
      createdAt: new Date(),
      dismissed: false,
    });
  }

  // Check: no hire after 14+ days with applications
  if (daysSinceCreated >= 14 && hiredCount === 0 && applicationCount > 0 && !existing.includes("no_hire_14_days")) {
    toAdd.push({
      id: crypto.randomUUID(),
      type: "no_hire_14_days",
      message: `Job open for ${Math.floor(daysSinceCreated)} days with ${applicationCount} applications but no hire yet.`,
      aiSuggestions: [
        "Speed up interview scheduling — candidates accept competing offers fast",
        "Review your rejection rate; you may be filtering too aggressively",
        "Consider sending assessment tests to shortlisted candidates immediately",
      ],
      createdAt: new Date(),
      dismissed: false,
    });
  }

  // Check: high reject rate (>70% of scored candidates rejected)
  if (applicationCount >= 10 && !existing.includes("high_reject_rate")) {
    const rejectRate = applicationCount > 0 ? (rejectedCount / applicationCount) : 0;
    if (rejectRate > 0.7) {
      toAdd.push({
        id: crypto.randomUUID(),
        type: "high_reject_rate",
        message: `${Math.round(rejectRate * 100)}% rejection rate — your criteria may be too strict.`,
        aiSuggestions: [
          "Review your scoring rubric — some criteria may be weighted too heavily",
          "Consider widening the experience range or accepting adjacent skill sets",
          "Add a 'nice to have' tier in your rubric to surface more borderline candidates",
        ],
        createdAt: new Date(),
        dismissed: false,
      });
    }
  }

  if (toAdd.length > 0) {
    await RecruitJob.updateOne({ _id: jobId }, { $push: { performanceAlerts: { $each: toAdd } } });
    console.log(`[perf-monitor] Added ${toAdd.length} alert(s) to job ${jobId}`);
  }
}

recruitRouter.get("/jobs/:jobId/performance", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "view_candidates")) {
      return res.status(404).json({ error: "Job not found." });
    }
    await checkJobPerformanceAlerts(req.params.jobId);
    const job = await RecruitJob.findById(req.params.jobId).lean() as any;
    if (!job) return res.status(404).json({ error: "Job not found." });
    const alerts = (job.performanceAlerts ?? []).filter((a: any) => !a.dismissed);
    return res.json({ alerts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/performance/dismiss/:alertId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "configure_job")) {
      return res.status(403).json({ error: "You do not have permission to manage performance alerts." });
    }
    const job = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, uid: access.job.uid, "performanceAlerts.id": req.params.alertId },
      { $set: { "performanceAlerts.$.dismissed": true } },
      { returnDocument: "after" }
    ).lean();
    if (!job) return res.status(404).json({ error: "Alert not found." });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/performance/apply", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "configure_job")) {
      return res.status(403).json({ error: "You do not have permission to apply performance suggestions." });
    }
    const { suggestion } = req.body as { suggestion: string };
    const job = access.job as any;

    // Use AI to apply the suggestion — rewrite JD with the hint
    const prompt = `You are a recruitment expert. A recruiter wants to improve this job listing.
Job Title: ${job.title}
Current Job Description: ${job.generatedJD || "Not provided"}
Suggestion to apply: ${suggestion}

Rewrite the job description incorporating this suggestion to attract more qualified candidates.
Keep it professional, structured, and under 600 words. Return ONLY the new job description text.`;

    const ownerUid = standardBillingOwnerUid(access.job);
    const newJD = await runStandardBillingOperation({
      ownerUid,
      operation: "short_rewrite_standard",
      idempotencyKey: standardRequestIdempotencyKey(
        ownerUid,
        "performance-apply",
        standardIdempotencyHeader(req) || standardContentHash(`${req.params.jobId}:${suggestion}`),
      ),
      resourceType: "job",
      resourceId: String(req.params.jobId),
      work: async () => callGeminiChain({ prompt }),
    });
    await RecruitJob.updateOne({ _id: req.params.jobId, uid: access.job.uid }, { $set: { generatedJD: newJD } });
    return res.json({ ok: true, newJD });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    console.error("[perf-monitor] apply suggestion failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Regenerate JD with variant style ─────────────────────────────────────────
recruitRouter.post("/jobs/:jobId/regenerate-jd", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const body = req.body ?? {};
    const { variant = "standard", save = false, newJD: providedJD } = body as { variant?: string; save?: boolean; newJD?: string };

    const toneGuides: Record<string, string> = {
      conservative: "formal, traditional, and straightforward. Use professional corporate language. Focus on clear requirements and structured responsibilities. Safe and credible — suitable for enterprise, finance, healthcare, or government roles.",
      bold: "energetic, exciting, and startup-like. Use punchy, confident language. Show the company's ambition and culture. Make the role sound like an opportunity to create real impact. Appeal to high-performers who want ownership.",
      seo_optimized: "optimised for job boards and search engine discovery. Naturally include high-traffic keywords that candidates search for. Use common job-title synonyms and skill terms. Keep sections scannable with short bullets and clear headings.",
      standard: "balanced, professional, and candidate-friendly. Clear and concise.",
    };
    const toneGuide = toneGuides[variant] ?? toneGuides.standard;

    const salary =
      (job as any).salaryMin && (job as any).salaryMax
        ? `${(job as any).salaryCurrency ?? "USD"} ${Number((job as any).salaryMin).toLocaleString()} – ${Number((job as any).salaryMax).toLocaleString()} per year`
        : "Competitive (not disclosed)";

    const prompt = `You are a senior recruiter writing a job description with a specific tone style.

TONE: ${toneGuide}

JOB DETAILS:
- Title: ${(job as any).title}
- Niche/Category: ${(job as any).niche || "General"}
- Seniority: ${(job as any).seniority || "Mid-level"}
- Location: ${(job as any).location}
- Work Mode: ${(job as any).workMode}
- Must-Have Skills: ${(job as any).mustHaveSkills}
- Nice-to-Have Skills: ${(job as any).niceToHaveSkills || "Not specified"}
- Key Responsibilities: ${(job as any).responsibilities}
- Compensation: ${salary}

Write a complete job description in the specified tone. Use exactly these sections:
About the role | What you will do | What we are looking for | Good to have | Compensation and benefits

Rules:
- 220–350 words total
- Human and credible — no filler phrases or invented company facts
- Short paragraphs and 3–5 bullets under action sections
- No gendered language or unnecessary degree requirements
- Return ONLY the job description text — no JSON, no markdown code fences`;

    // If caller already has the generated text and just wants to persist it, skip re-generation
    let newJD = providedJD?.trim() ?? "";

    if (!newJD) {
      const ownerUid = standardBillingOwnerUid(job);
      newJD = await runStandardBillingOperation({
        ownerUid,
        operation: "job_generation",
        idempotencyKey: standardRequestIdempotencyKey(
          ownerUid,
          "regenerate-jd",
          standardIdempotencyHeader(req) || standardContentHash(`${req.params.jobId}:${variant}`),
        ),
        resourceType: "job",
        resourceId: String(req.params.jobId),
        work: async () => {
          let generated = "";
          try {
            generated = (await callGeminiChain({ prompt, temperature: 0.7, maxOutputTokens: 1500 })) ?? "";
            console.log("[recruit] regenerate-jd: Gemini succeeded ✓");
          } catch {
            try {
              generated = (await callNvidia({ messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 1500 })) ?? "";
              console.log("[recruit] regenerate-jd: Nvidia fallback succeeded ✓");
            } catch {
              throw new Error("AI generation failed. Please try again.");
            }
          }
          return generated.trim();
        },
      });
    }

    if (save && newJD) {
      await RecruitJob.updateOne({ _id: req.params.jobId, uid }, { $set: { generatedJD: newJD } });
    }

    return res.json({ ok: true, newJD, variant });
  } catch (err: any) {
    if (await respondStandardBillingError(res, err, getUid(req))) return;
    console.error("[recruit] regenerate-jd failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Salary Benchmark ──────────────────────────────────────────────────────────
recruitRouter.get("/salary-benchmark", async (req, res) => {
  try {
    await connectMongo();
    const { title, location, niche, currency = "USD", seniority } = req.query as Record<string, string>;
    if (!title) return res.status(400).json({ error: "title is required." });

    const prompt = `You are a compensation data expert with knowledge of current global salary benchmarks.

Provide a realistic salary benchmark for this role based on current market data (2025).

Role: ${title}
Seniority: ${seniority || "Mid-level"}
Industry/Niche: ${niche || "General"}
Location: ${location || "Global / Remote"}
Currency: ${currency}

Return valid JSON only, no markdown:
{
  "p25": <number: 25th percentile annual salary in ${currency}>,
  "p50": <number: median annual salary in ${currency}>,
  "p75": <number: 75th percentile annual salary in ${currency}>,
  "min": <number: realistic floor for entry-level in ${currency}>,
  "max": <number: realistic ceiling for senior/top in ${currency}>,
  "currency": "${currency}",
  "insight": "<one concise sentence about current salary trends for this role>",
  "factors": ["<factor that raises pay>", "<factor that raises pay>", "<factor that lowers pay>"]
}

Use realistic, current figures. All values must be annual gross, in ${currency}.`;

    let raw = "";
    try {
      raw = (await callGeminiChain({ prompt, temperature: 0.2, maxOutputTokens: 500, jsonMode: true })) ?? "";
    } catch {
      try {
        raw = (await callNvidia({ messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 500, responseFormat: "json_object" })) ?? "";
      } catch {
        return res.status(500).json({ error: "Could not fetch benchmark data. Please try again." });
      }
    }

    const parsed = safeJson(raw);
    if (!parsed || !parsed.p50) return res.status(500).json({ error: "Invalid benchmark response from AI." });

    return res.json({ ok: true, benchmark: parsed });
  } catch (err: any) {
    console.error("[recruit] salary-benchmark failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Daily Briefing: manual trigger ───────────────────────────────────────────
recruitRouter.post("/briefing/send-now", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const { generateBriefingForUser } = await import("./jobs/dailyBriefing.js");
    await runStandardBillingOperation({
      ownerUid: uid,
      operation: "daily_briefing",
      idempotencyKey: standardIdempotencyKey(uid, ["daily-briefing", new Date().toISOString().slice(0, 13)]),
      work: async () => generateBriefingForUser(uid),
    });
    return res.json({ ok: true, message: "Briefing sent to your email." });
  } catch (e: any) {
    if (await respondStandardBillingError(res, e, getUid(req))) return;
    console.error("[briefing] manual trigger failed:", e);
    return res.status(500).json({ error: e.message || "Failed to send briefing." });
  }
});

// ── Pipeline Rules CRUD ───────────────────────────────────────────────────────

recruitRouter.get("/jobs/:jobId/pipeline-rules", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "view_candidates")) {
      return res.status(404).json({ error: "Job not found." });
    }
    return res.json({ rules: (access.job as any).pipelineRules ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/pipeline-rules", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "configure_job")) {
      return res.status(403).json({ error: "You do not have permission to manage pipeline rules." });
    }
    const { condition, threshold, fromStage, action } = req.body;
    const validationError = validatePipelineRuleInput({ condition, threshold, action });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    await assertStandardResourceLimit(standardBillingOwnerUid(access.job), "pipeline_rules");
    const rule = {
      id: crypto.randomUUID(),
      condition,
      threshold: Number(threshold ?? 0),
      fromStage: fromStage || "",
      action,
      enabled: true,
      triggerCount: 0,
    };
    const job = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, uid: access.job.uid },
      { $push: { pipelineRules: rule } },
      { returnDocument: "after" },
    ).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.status(201).json({ ok: true, rule });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.patch("/jobs/:jobId/pipeline-rules/:ruleId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "configure_job")) {
      return res.status(403).json({ error: "You do not have permission to manage pipeline rules." });
    }
    const { enabled, condition, threshold, fromStage, action } = req.body;
    const existingRule = ((access.job as any).pipelineRules ?? []).find((r: any) => r.id === req.params.ruleId);
    if (condition !== undefined || action !== undefined || threshold !== undefined) {
      const toValidate = {
        condition: condition ?? existingRule?.condition,
        threshold: threshold ?? existingRule?.threshold,
        action: action ?? existingRule?.action,
      };
      const err = validatePipelineRuleInput(toValidate);
      if (err) return res.status(400).json({ error: err });
    }
    // Re-enabling a disabled rule consumes an active pipeline-rule slot.
    if (enabled !== undefined && Boolean(enabled) && existingRule && existingRule.enabled === false) {
      await assertStandardResourceLimit(standardBillingOwnerUid(access.job), "pipeline_rules");
    }
    const setFields: Record<string, unknown> = {};
    if (enabled !== undefined) setFields["pipelineRules.$.enabled"] = Boolean(enabled);
    if (condition !== undefined) setFields["pipelineRules.$.condition"] = condition;
    if (threshold !== undefined) setFields["pipelineRules.$.threshold"] = Number(threshold);
    if (fromStage !== undefined) setFields["pipelineRules.$.fromStage"] = fromStage;
    if (action !== undefined) setFields["pipelineRules.$.action"] = action;
    const job = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, uid: access.job.uid, "pipelineRules.id": req.params.ruleId },
      { $set: setFields },
      { returnDocument: "after" },
    ).lean();
    if (!job) return res.status(404).json({ error: "Rule not found." });
    const updated = ((job as any).pipelineRules ?? []).find((r: any) => r.id === req.params.ruleId);
    return res.json({ ok: true, rule: updated });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.delete("/jobs/:jobId/pipeline-rules/:ruleId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access || !hasPermission(access, "configure_job")) {
      return res.status(403).json({ error: "You do not have permission to manage pipeline rules." });
    }
    const job = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, uid: access.job.uid },
      { $pull: { pipelineRules: { id: req.params.ruleId } } },
      { returnDocument: "after" },
    ).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "review_candidates");
    if (!access) return res.status(403).json({ error: "You do not have permission to add candidates." });
    const job = access.job;

    const { resumeText } = req.body;
    if (!resumeText?.trim()) return res.status(400).json({ error: "Resume text is required." });

    const ownerUid = standardBillingOwnerUid(job);
    await assertStandardResourceLimit(ownerUid, "stored_candidates");

    const scored = await meterCandidateScore(ownerUid, job, resumeText);

    const { source } = req.body;

    let previousApplication: {
      jobTitle: string;
      stage: string;
      totalScore: number;
      maxScore: number;
      rejectedAt: Date;
      aiSummary: string;
    } | null = null;

    if (scored.email) {
      const prev = await RecruitCandidate.findOne({
        uid: job.uid,
        email: scored.email,
        stage: { $in: ["rejected", "hired"] },
      })
        .populate<{ jobId: { title: string } }>("jobId", "title")
        .sort({ updatedAt: -1 })
        .lean() as any;

      if (prev) {
        previousApplication = {
          jobTitle: (prev.jobId as any)?.title ?? "a previous role",
          stage: prev.stage,
          totalScore: prev.totalScore,
          maxScore: prev.maxScore,
          rejectedAt: prev.updatedAt,
          aiSummary: prev.aiSummary,
        };
      }
    }

    const agentMode = (job as any).agentMode ?? {};
    const scorePct = scored.maxScore > 0 ? Math.round((scored.totalScore / scored.maxScore) * 100) : 0;
    const { initialStage, agentAction, shortlistThreshold, rejectThreshold } = computeAgentTriage(
      agentMode,
      scorePct,
      scored.scoringFailed,
    );

    const candidate = await runStandardBillingOperation({
      ownerUid,
      operation: "new_candidate_intake",
      idempotencyKey: standardIdempotencyKey(ownerUid, [
        "intake",
        String(job._id),
        scored.email || standardContentHash(resumeText),
      ]),
      resourceType: "job",
      resourceId: String(job._id),
      work: async () => RecruitCandidate.create({
        jobId: job._id,
        uid: job.uid,
        name: scored.name,
        email: scored.email,
        resumeText,
        totalScore: scored.totalScore,
        maxScore: scored.maxScore,
        scoreBreakdown: scored.scoreBreakdown,
        aiSummary: scored.aiSummary,
        redFlags: scored.redFlags,
        strengths: scored.strengths,
        stage: initialStage,
        stageMovedAt: new Date(),
        assessmentStatus: "not_sent",
        previousResumeScore: scored.totalScore,
        scoringFailed: scored.scoringFailed,
        source: source || "",
      }),
    });

    await RecruitJob.updateOne({ _id: job._id }, { $inc: { candidateCount: 1 } });

    schedulePostIntakeAutomation(
      job,
      candidate,
      agentAction,
      agentAction
        ? {
            job,
            candidateId: String(candidate._id),
            candidateName: candidate.name,
            candidateEmail: scored.email || "",
            candidateTotalScore: candidate.totalScore,
            scorePct,
            shortlistThreshold,
            rejectThreshold,
            agentMode,
            logPrefix: "agent",
          }
        : null,
    );

    trackEvent("recruiter_candidate_added", uid, { jobId: req.params.jobId, source: source || "" });
    return res.json({ candidate, previousApplication });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    console.error("[recruit] POST /candidates", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Helper: extract text from a multer file buffer (shared by bulk route) ────
async function extractResumeText(file: Express.Multer.File): Promise<string> {
  const { mimetype, buffer } = file;
  let text = "";

  if (mimetype === "application/pdf") {
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    const data = await pdfParse(buffer);
    text = data.text ?? "";
    if (!text.trim()) throw new Error("PDF appears to be a scanned image with no text layer.");
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text = result.value ?? "";
    if (!text.trim()) throw new Error("Could not extract text from DOCX.");
  } else if (mimetype === "text/plain") {
    text = buffer.toString("utf-8");
  } else {
    throw new Error("Unsupported file type. Use PDF, DOCX, or TXT.");
  }

  text = text
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/^ +$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 40) throw new Error("Not enough text could be extracted from this file.");
  return text;
}

// ── Bulk resume import (SSE streaming progress) ───────────────────────────────
recruitRouter.post(
  "/jobs/:jobId/candidates/bulk",
  bulkImportRateLimit,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    resumeUpload.array("resumes", 50)(req, res, (err: any) => {
      if (err) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err.message || "File upload error." });
      }
      next();
    });
  },
  async (req: express.Request, res: express.Response) => {
    try {
      await connectMongo();
      const uid = getUid(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });

      const access = await getJobWithCollaborationPermission(String(req.params.jobId), uid, "review_candidates");
      if (!access) return res.status(403).json({ error: "You do not have permission to bulk import candidates." });
      const job = access.job;

      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) return res.status(400).json({ error: "No files uploaded." });

      // ── CRITICAL billing gate: everything here runs BEFORE SSE headers so a
      // plan-limit rejection is returned as a normal JSON 409 the frontend
      // BulkImportModal can surface (rather than a mid-stream SSE error). ──
      // Phase 4 verified: entitlement + batch reservation are taken at execution
      // time before the stream opens, so a downgraded / cancelled / past_due owner
      // is blocked (fail closed) before any metered AI import work begins.
      const ownerUid = standardBillingOwnerUid(job);
      const batchId = crypto.randomUUID();
      try {
        // Enforce plan ceilings before SSE so Free (3 files / 1 import) fails as JSON 409.
        await assertStandardBulkActionSize(ownerUid, files.length);
        await assertStandardBulkImportFileCount(ownerUid, files.length);
        // One batch reservation (quantity=1), not one per file.
        await runStandardBillingOperation({
          ownerUid,
          operation: "bulk_import_batch",
          idempotencyKey: standardIdempotencyKey(ownerUid, ["bulk-batch", String(job._id), batchId]),
          resourceType: "job",
          resourceId: String(job._id),
          metadata: { fileCount: files.length },
          work: async () => true,
        });
      } catch (gateErr) {
        if (await respondStandardBillingError(res, gateErr, ownerUid)) return;
        throw gateErr;
      }

      // Switch to SSE streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sendEvent = (payload: object) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      sendEvent({ type: "start", total: files.length });

      let succeeded = 0;
      let failed = 0;
      let planLimitHit = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = file.originalname;

        sendEvent({ type: "file", index: i, total: files.length, filename, status: "processing" });

        try {
          const resumeText = await extractResumeText(file);
          // candidate_score degrades to unscored on billing block (never fails intake).
          const scored = await meterCandidateScore(ownerUid, job, resumeText);

          // Meter per-file work; intake capacity (stored_candidates) fails closed.
          const candidate = await runStandardBillingOperation({
            ownerUid,
            operation: "bulk_import_item",
            idempotencyKey: standardIdempotencyKey(ownerUid, ["bulk-item", String(job._id), batchId, String(i)]),
            resourceType: "job",
            resourceId: String(job._id),
            work: async () => {
              await assertStandardResourceLimit(ownerUid, "stored_candidates");
              return runStandardBillingOperation({
                ownerUid,
                operation: "new_candidate_intake",
                idempotencyKey: standardIdempotencyKey(ownerUid, ["bulk-intake", String(job._id), batchId, String(i)]),
                resourceType: "job",
                resourceId: String(job._id),
                work: async () => RecruitCandidate.create({
                  jobId: job._id,
                  uid: job.uid,
                  name: scored.name || filename.replace(/\.[^.]+$/, ""),
                  email: scored.email || "",
                  resumeText,
                  totalScore: scored.totalScore,
                  maxScore: scored.maxScore,
                  scoreBreakdown: scored.scoreBreakdown,
                  aiSummary: scored.aiSummary,
                  redFlags: scored.redFlags,
                  strengths: scored.strengths,
                  stage: "applied",
                  stageMovedAt: new Date(),
                  assessmentStatus: "not_sent",
                  previousResumeScore: scored.totalScore,
                  scoringFailed: scored.scoringFailed,
                  source: "bulk_import",
                }),
              });
            },
          });

          await RecruitJob.updateOne({ _id: job._id }, { $inc: { candidateCount: 1 } });
          schedulePipelineRules(String(job._id), String(candidate._id));

          const scorePct = scored.maxScore > 0
            ? Math.round((scored.totalScore / scored.maxScore) * 100)
            : 0;

          succeeded++;
          sendEvent({
            type: "file",
            index: i,
            total: files.length,
            filename,
            status: "done",
            candidateId: String(candidate._id),
            name: candidate.name,
            email: candidate.email,
            scorePct,
            totalScore: scored.totalScore,
            maxScore: scored.maxScore,
            hiringDecision: null,
            aiSummary: scored.aiSummary,
            strengths: scored.strengths,
            redFlags: scored.redFlags,
            scoringFailed: scored.scoringFailed,
          });
        } catch (fileErr: any) {
          failed++;
          if (isStandardBillingError(fileErr)) {
            // Candidate-storage capacity exhausted mid-batch — surface PLAN_LIMIT
            // and stop; remaining files would all fail the same way.
            planLimitHit = true;
            sendEvent({
              type: "file", index: i, total: files.length, filename, status: "failed",
              error: "PLAN_LIMIT_REACHED", code: "PLAN_LIMIT_REACHED", planLimit: true,
            });
            sendEvent({
              type: "error", code: "PLAN_LIMIT_REACHED", planLimit: true,
              error: "Your plan's stored candidate limit has been reached. Upgrade to import more.",
            });
            break;
          }
          sendEvent({ type: "file", index: i, total: files.length, filename, status: "failed", error: fileErr.message });
        }
      }

      sendEvent({ type: "complete", total: files.length, succeeded, failed, planLimitHit });
      res.end();
    } catch (err: any) {
      console.error("[recruit] POST /candidates/bulk", err);
      try { res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`); res.end(); } catch {}
    }
  }
);

recruitRouter.get("/jobs/:jobId/candidates", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access) return res.status(404).json({ error: "Job not found." });
    const filter: any = { jobId: req.params.jobId, uid: access.job.uid };
    if (!access.owner && access.permissions.includes("view_assigned_candidates")) {
      const assigned = await RecruitCandidateCollaboration.find({ jobId: req.params.jobId, "assignedTo.uid": uid }).select("candidateId").lean();
      filter._id = { $in: assigned.map(item => item.candidateId) };
    } else if (!access.owner && !access.permissions.includes("view_candidates")) {
      return res.status(403).json({ error: "You do not have permission to view candidates." });
    }
    const candidates = await RecruitCandidate.find(filter)
      .sort({ totalScore: -1 })
      .lean();

    const legacyIds = candidates
      .filter(c => shouldMigrateLegacyReviewZoneStage(c as any))
      .map(c => c._id);
    if (legacyIds.length > 0) {
      await RecruitCandidate.updateMany(
        { _id: { $in: legacyIds } },
        { $set: { stage: "review_zone" } },
      );
      for (const c of candidates) {
        if (legacyIds.some(id => String(id) === String(c._id))) {
          (c as any).stage = "review_zone";
        }
      }
    }

    return res.json({ candidates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.patch("/jobs/:jobId/candidates/:candidateId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getCollaborationAccess(req.params.jobId, uid);
    if (!access) return res.status(404).json({ error: "Job not found." });
    const allowed = access.owner
      ? ["stage", "notes", "source", "gender", "ageRange", "inTalentPool", "talentPoolNote"]
      : [
          ...(access.permissions.includes("move_pipeline") ? ["stage"] : []),
          ...(access.permissions.includes("add_notes") ? ["notes"] : []),
        ];
    if (!allowed.length) return res.status(403).json({ error: "You do not have permission to update candidates." });
    const update: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.stage) {
      update.stageMovedAt = new Date();
    }
    const candidate = await RecruitCandidate.findOneAndUpdate(
      { _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid },
      update,
      { returnDocument: "after" }
    ).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (update.stage) {
      trackEvent("recruiter_stage_changed", uid, { jobId: req.params.jobId, stage: update.stage });
      setImmediate(() => recordCollaborationActivity(
        req.params.jobId,
        uid,
        "candidate_stage_changed",
        `Moved ${candidate.name} to ${update.stage}`,
        { stage: update.stage },
        req.params.candidateId,
      ).catch(err => console.error("[collaboration] stage activity failed:", err)));
      // Evaluate pipeline rules after manual stage change (non-blocking)
      schedulePipelineRules(req.params.jobId, req.params.candidateId);
    }

    // Auto-send stage-change emails for screened / interview / hired (unless recruiter
    // will compose manually via the stage-change email flow).
    const AUTO_EMAIL_STAGES = ["screened", "interview", "hired"];
    const skipAutoEmail = req.body.skipAutoEmail === true;
    if (update.stage && !skipAutoEmail && AUTO_EMAIL_STAGES.includes(update.stage) && (candidate as any).email) {
      const candId    = (candidate as any)._id;
      const candName  = (candidate as any).name  as string;
      const candEmail = (candidate as any).email as string;
      const jobId     = req.params.jobId;
      const stage     = update.stage as string;
      setImmediate(() =>
        sendCandidateStageEmail(jobId, String(candId), stage, candName, candEmail, uid),
      );
    }

    return res.json({ candidate });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/retry-score", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "review_candidates");
    if (!access) return res.status(403).json({ error: "You do not have permission to re-score candidates." });
    const job = access.job;

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const ownerUid = standardBillingOwnerUid(job);
    const scored = await runStandardBillingOperation({
      ownerUid,
      operation: "candidate_score",
      idempotencyKey: standardRequestIdempotencyKey(
        ownerUid,
        "candidate-rescore",
        standardIdempotencyHeader(req) || standardContentHash(`${candidate._id}:${Date.now()}`),
      ),
      resourceType: "candidate",
      resourceId: String(candidate._id),
      work: async () => scoreCandidate({
        resumeText: candidate.resumeText,
        jobTitle: job.title,
        rubric: job.rubric,
      }),
    });

    const scorePct = scored.maxScore > 0 ? Math.round((scored.totalScore / scored.maxScore) * 100) : 0;
    const agentMode = (job as any).agentMode ?? {};
    const EARLY_AGENT_STAGES = ["applied", "review_zone", "screened", "rejected"];
    let agentAction: AgentAction | null = null;
    let shortlistThreshold = 75;
    let rejectThreshold = 40;

    candidate.name = scored.name;
    candidate.email = scored.email || candidate.email;
    candidate.totalScore = scored.totalScore;
    candidate.maxScore = scored.maxScore;
    candidate.scoreBreakdown = scored.scoreBreakdown as any;
    candidate.aiSummary = scored.aiSummary;
    candidate.redFlags = scored.redFlags;
    candidate.strengths = scored.strengths;
    candidate.scoringFailed = scored.scoringFailed;
    if (!candidate.scoringFailed) {
      candidate.previousResumeScore = scored.totalScore;
    }

    if (EARLY_AGENT_STAGES.includes(candidate.stage)) {
      const triage = computeAgentTriage(agentMode, scorePct, scored.scoringFailed);
      shortlistThreshold = triage.shortlistThreshold;
      rejectThreshold = triage.rejectThreshold;
      agentAction = triage.agentAction;
      if (agentAction) {
        candidate.stage = triage.initialStage as any;
        candidate.stageMovedAt = new Date();
      }
    } else {
      ({ shortlistThreshold, rejectThreshold } = normalizeAgentThresholds(agentMode));
    }

    await candidate.save();
    await clearScorePipelineRuleState(req.params.jobId, String(candidate._id));

    setImmediate(() => {
      runPostIntakeAutomation(
        job,
        String(candidate._id),
        agentAction,
        agentAction
          ? {
              job,
              candidateId: String(candidate._id),
              candidateName: candidate.name,
              candidateEmail: candidate.email || "",
              candidateTotalScore: candidate.totalScore,
              scorePct,
              shortlistThreshold,
              rejectThreshold,
              agentMode,
              logPrefix: "agent-retry",
            }
          : null,
      ).catch(e => console.error("[agent-retry] automation failed:", e));
    });

    return res.json({ candidate });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    console.error("[recruit] POST /retry-score", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/brief", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "review_candidates");
    if (!access) return res.status(403).json({ error: "You do not have permission to prepare interview briefs." });
    const job = access.job;

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    if (candidate.interviewBrief) {
      return res.json({ brief: candidate.interviewBrief });
    }

    const ownerUid = standardBillingOwnerUid(job);
    const brief = await runStandardBillingOperation({
      ownerUid,
      operation: "deep_candidate_analysis",
      idempotencyKey: standardIdempotencyKey(ownerUid, ["interview-brief", String(candidate._id)]),
      resourceType: "candidate",
      resourceId: String(candidate._id),
      work: async () => generateInterviewBrief({
        candidateName: candidate.name,
        jobTitle: job.title,
        resumeText: candidate.resumeText,
        aiSummary: candidate.aiSummary,
        redFlags: candidate.redFlags,
        scoreBreakdown: candidate.scoreBreakdown,
        niche: job.niche,
        nicheDetails: job.nicheDetails,
        languageRequirement: job.languageRequirement,
      }),
    });

    candidate.interviewBrief = brief;
    await candidate.save();

    return res.json({ brief });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.delete("/jobs/:jobId/candidates/:candidateId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const candidate = await RecruitCandidate.findOneAndDelete({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    await RecruitJob.updateOne({ _id: req.params.jobId, uid }, { $inc: { candidateCount: -1 } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/assessment/send", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_assessments");
    if (!access) return res.status(403).json({ error: "You do not have permission to send assessments." });
    const job = access.job;

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    if (candidate.assessmentStatus === "completed") {
      return res.status(400).json({ error: "Assessment already completed by candidate." });
    }
    if (!["not_sent"].includes(candidate.assessmentStatus)) {
      return res.status(400).json({ error: "Assessment has already been invited or sent." });
    }

    const sent = await sendAssessmentToCandidate({
      job,
      candidateId: String(candidate._id),
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      previousResumeScore: candidate.totalScore,
      logTag: "manual",
      unifiedWithScreened: EARLY_PIPELINE_STAGES.has(candidate.stage) || candidate.stage === "screened",
    });
    if (!sent) {
      return res.status(409).json({ error: "Assessment could not be sent — it may already be in progress." });
    }

    const updated = await RecruitCandidate.findById(candidate._id).lean();
    const assessmentUrl = `${FRONTEND_URL}/recruit/assessment/${(updated as any)?.assessmentToken}`;

    return res.json({
      ok: true,
      assessmentUrl,
      questions: (updated as any)?.assessmentQuestions ?? [],
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      emailSent: Boolean(candidate.email),
    });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    console.error("[recruit] POST /assessment/send", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/reject-email", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid }).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const ownerUid = standardBillingOwnerUid(job);
    const email = await runStandardBillingOperation({
      ownerUid,
      operation: "short_rewrite_standard",
      idempotencyKey: standardRequestIdempotencyKey(
        ownerUid,
        "reject-email",
        standardIdempotencyHeader(req) || standardContentHash(`${candidate._id}:${candidate.stage}`),
      ),
      resourceType: "candidate",
      resourceId: String(candidate._id),
      work: async () => generateRejectionEmail({
        candidateName: candidate.name,
        jobTitle: job.title,
        stage: candidate.stage,
      }),
    });

    return res.json({ email, candidateName: candidate.name, candidateEmail: candidate.email });
  } catch (err: any) {
    if (await respondStandardBillingError(res, err, getUid(req))) return;
    console.error("[recruit] POST /reject-email", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Send any recruiter-composed email to a candidate & log it ─────────────────
// Used by frontend for rejection/offer one-click-send (recruiter can edit first).
recruitRouter.post("/jobs/:jobId/candidates/:candidateId/send-email", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const { type, subject, body } = req.body as { type?: string; subject?: string; body?: string };

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "Subject and body are required." });
    }

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (!candidate.email?.trim()) return res.status(400).json({ error: "This candidate has no email address on file." });

    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    const jobTitle    = (job as any)?.title       || "";
    const companyName = (job as any)?.companyName || "";
    const officialContactEmail = await getCreatorOfficialEmail(uid);
    const ctx = { officialContactEmail };

    // Build branded HTML from body text based on email type
    let html: string;
    if (type === "rejected") {
      html = emailTemplates.rejectionEmailHtml(candidate.name, jobTitle, companyName, body, ctx).html;
    } else if (type === "offer") {
      html = emailTemplates.offerEmail(candidate.name, jobTitle, companyName, body, ctx).html;
    } else {
      html = emailTemplates.genericEmail(candidate.name, subject.trim(), body, ctx);
    }

    const ownerUid = standardBillingOwnerUid(candidate);
    const result = await runStandardBillingOperation({
      ownerUid,
      operation: "automated_email_standard",
      idempotencyKey: standardRequestIdempotencyKey(
        ownerUid,
        "send-email",
        standardIdempotencyHeader(req) || standardContentHash(`${candidate._id}:${subject.trim()}:${body.trim()}`),
      ),
      resourceType: "candidate",
      resourceId: String(candidate._id),
      work: async () => sendEmail({ to: candidate.email!, subject: subject.trim(), html, text: body, from: NOTIFICATION_FROM }),
    });

    const logEntry = {
      type: type || "custom",
      to: candidate.email,
      subject: subject.trim(),
      body,
      sentAt: new Date(),
      status: (result.ok ? "sent" : "failed") as "sent" | "failed",
      error: result.error,
    };
    candidate.emailLog.push(logEntry as any);
    await candidate.save();

    if (!result.ok) {
      return res.status(502).json({ error: `Email delivery failed: ${result.error}. The log entry has been saved.`, logEntry });
    }
    return res.json({ ok: true, sentAt: logEntry.sentAt, logEntry });
  } catch (err: any) {
    if (await respondStandardBillingError(res, err, getUid(req))) return;
    console.error("[recruit] POST /send-email", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/reminder", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    if (!["sent", "invited"].includes(candidate.assessmentStatus)) {
      return res.status(400).json({ error: "Assessment not in pending state." });
    }

    candidate.assessmentReminderSentAt = new Date();
    await candidate.save();

    const assessmentUrl = `${FRONTEND_URL}/recruit/assessment/${candidate.assessmentToken}`;

    // Auto-send reminder email (fire-and-forget)
    if (candidate.email) {
      const candId    = candidate._id;
      const candName  = candidate.name;
      const candEmail = candidate.email;
      const reminderUrl = assessmentUrl;
      const ownerUid  = standardBillingOwnerUid(candidate);
      setImmediate(async () => {
        try {
          const job     = await RecruitJob.findById(req.params.jobId).lean();
          const jobTitle     = (job as any)?.title       || "";
          const companyName  = (job as any)?.companyName || "";
          const officialContactEmail = await getCreatorOfficialEmail(ownerUid);
          const payload = emailTemplates.assessmentReminder(candName, jobTitle, companyName, reminderUrl, { officialContactEmail });
          await runStandardBillingOperation({
            ownerUid,
            operation: "automated_email_standard",
            idempotencyKey: standardIdempotencyKey(ownerUid, ["assessment-reminder", String(candId), new Date().toISOString().slice(0, 10)]),
            resourceType: "candidate",
            resourceId: String(candId),
            work: async () => {
              const result  = await sendEmail({ to: candEmail, subject: payload.subject, html: payload.html, text: payload.text, from: NOTIFICATION_FROM });
              await RecruitCandidate.findByIdAndUpdate(candId, {
                $push: {
                  emailLog: {
                    type: "assessment_reminder", to: candEmail, subject: payload.subject, body: payload.text,
                    sentAt: new Date(), status: result.ok ? "sent" : "failed", error: result.error,
                  },
                },
              });
              return result;
            },
          });
        } catch (err) {
          if (isStandardBillingError(err)) {
            console.warn("[mailer] assessment reminder skipped (billing):", (err as Error).message);
            return;
          }
          console.error("[mailer] reminder email failed:", err);
        }
      });
    }

    return res.json({ ok: true, assessmentUrl, candidateEmail: candidate.email, emailSent: Boolean(candidate.email) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/assessment/:token", async (req, res) => {
  try {
    await connectMongo();
    const candidate = await RecruitCandidate.findOne({ assessmentToken: req.params.token })
      .select("name assessmentQuestions assessmentStatus assessmentCompletedAt jobId")
      .lean();

    if (!candidate) return res.status(404).json({ error: "Assessment not found." });
    if (candidate.assessmentStatus === "completed") {
      return res.json({ completed: true, candidateName: candidate.name });
    }

    const job = await RecruitJob.findById(candidate.jobId)
      .select("title department location workMode")
      .lean();

    const base = {
      completed: false as const,
      candidateName: candidate.name,
      jobTitle: job?.title ?? "the role",
      jobDepartment: job?.department ?? "",
      jobLocation: job?.location ?? "",
    };

    const needsStart = candidate.assessmentStatus === "invited"
      || !(candidate.assessmentQuestions?.length);

    if (needsStart) {
      return res.json({ ...base, needsStart: true, questions: [] });
    }

    return res.json({
      ...base,
      needsStart: false,
      questions: candidate.assessmentQuestions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.post("/assessment/:token/start", async (req, res) => {
  try {
    await connectMongo();
    const result = await activateAssessmentByToken(req.params.token);
    if (!result.ok) {
      return res.status(result.error === "Assessment not found." ? 404 : 500).json({ error: result.error });
    }

    const candidate = await RecruitCandidate.findOne({ assessmentToken: req.params.token })
      .select("name assessmentQuestions assessmentStatus assessmentCompletedAt jobId")
      .lean();
    if (!candidate) return res.status(404).json({ error: "Assessment not found." });
    if (candidate.assessmentStatus === "completed") {
      return res.json({ completed: true, candidateName: candidate.name });
    }

    const job = await RecruitJob.findById(candidate.jobId)
      .select("title department location workMode")
      .lean();

    return res.json({
      completed: false,
      needsStart: false,
      candidateName: candidate.name,
      jobTitle: job?.title ?? "the role",
      jobDepartment: job?.department ?? "",
      jobLocation: job?.location ?? "",
      questions: candidate.assessmentQuestions ?? [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Live assessment progress ping (fire-and-forget from candidate browser) ──
recruitPublicRouter.post("/assessment/:token/progress", async (req, res) => {
  try {
    await connectMongo();
    const { questionIndex } = req.body as { questionIndex: number };
    if (typeof questionIndex !== "number") return res.json({ ok: false });

    const candidate = await RecruitCandidate.findOne({
      assessmentToken: req.params.token,
      assessmentStatus: { $in: ["sent", "invited"] },
    }).select("_id assessmentStartedAt");
    if (!candidate) return res.json({ ok: false });

    const update: Record<string, any> = { currentQuestionIndex: questionIndex };
    if (!candidate.assessmentStartedAt) update.assessmentStartedAt = new Date();

    await RecruitCandidate.updateOne({ _id: candidate._id }, { $set: update });
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: false });
  }
});

recruitPublicRouter.post("/assessment/:token/submit", async (req, res) => {
  try {
    await connectMongo();
    const candidate = await RecruitCandidate.findOne({ assessmentToken: req.params.token });
    if (!candidate) return res.status(404).json({ error: "Assessment not found." });
    if (candidate.assessmentStatus === "completed") {
      return res.status(400).json({ error: "Assessment already submitted." });
    }

    const { answers } = req.body as {
      answers: { questionId: string; answer: string; timeTakenSeconds: number }[];
    };

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: "Answers are required." });
    }

    const job = await RecruitJob.findById(candidate.jobId).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    // Score the submitted assessment — metered to the job owner. If billing
    // blocks the AI scoring, still record the submission (candidate isn't
    // penalized) and keep the prior resume-based score.
    const ownerUid = standardBillingOwnerUid(job);
    let result: Awaited<ReturnType<typeof analyzeAssessmentAnswers>> | null = null;
    try {
      result = await runStandardBillingOperation({
        ownerUid,
        operation: "assessment_score_standard",
        idempotencyKey: standardIdempotencyKey(ownerUid, ["assessment-score", String(candidate._id)]),
        resourceType: "candidate",
        resourceId: String(candidate._id),
        work: async () => analyzeAssessmentAnswers({
          candidateName: candidate.name,
          jobTitle: job.title,
          rubric: job.rubric,
          questions: candidate.assessmentQuestions,
          answers,
          resumeScore: candidate.previousResumeScore || candidate.totalScore,
          maxScore: candidate.maxScore,
          resumeSummary: candidate.aiSummary,
        }),
      });
    } catch (scoreErr) {
      if (!isStandardBillingError(scoreErr)) throw scoreErr;
      console.warn("[recruit] assessment scoring blocked by billing — submission kept, prior score retained:", (scoreErr as Error).message);
    }

    candidate.assessmentAnswers = answers;
    candidate.assessmentStatus = "completed";
    candidate.assessmentCompletedAt = new Date();
    if (result) {
      candidate.totalScore = result.newTotalScore;
      candidate.hiringDecision = result.hiringDecision;
      candidate.assessmentImpact = result.impact;
    }
    candidate.stage = "assessed";
    candidate.stageMovedAt = new Date();
    await candidate.save();

    schedulePipelineRules(String(candidate.jobId), String(candidate._id));

    return res.json({ ok: true, message: "Assessment submitted successfully." });
  } catch (err: any) {
    console.error("[recruit] POST /assessment/submit", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Analytics ──────────────────────────────────────────────────────────────

recruitRouter.get("/analytics", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);

    const [jobs, allCandidates, forms, formResponses] = await Promise.all([
      RecruitJob.find({ uid }).lean(),
      RecruitCandidate.find({ uid }).lean(),
      RecruitForm.find({ uid }).lean(),
      RecruitFormResponse.find({ uid }).lean(),
    ]);

    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => j.status === "active").length;
    const totalStandardCandidates = allCandidates.length;
    const totalFormResponses = formResponses.length;
    // Form applicants are real applicants — the org-wide funnel counts both.
    const totalCandidates = totalStandardCandidates + totalFormResponses;

    // Stage funnel (all candidates across all jobs)
    const STAGES = ["applied", "review_zone", "screened", "assessed", "interview", "offer", "hired", "rejected"] as const;
    const stageCounts: Record<string, number> = {};
    for (const s of STAGES) stageCounts[s] = 0;
    for (const c of allCandidates) {
      if (stageCounts[c.stage] !== undefined) stageCounts[c.stage]++;
    }
    for (const r of formResponses as any[]) {
      const mapped = FORM_STAGE_TO_CANDIDATE_STAGE[r.stage];
      if (mapped && stageCounts[mapped] !== undefined) stageCounts[mapped]++;
    }

    // Drop-off rates: % who made it through each stage (excluding rejected)
    const activeStages = STAGES.filter(s => s !== "rejected");
    const funnelDropoff = activeStages.map((stage) => {
      const count = stageCounts[stage] || 0;
      const dropoffPct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;
      return { stage, count, dropoffPct };
    });

    // Average time-to-hire (job createdAt → first hired candidate updatedAt)
    const avgTimeToHireMs: number[] = [];
    for (const job of jobs) {
      const hired = allCandidates.filter(
        c => c.jobId.toString() === job._id.toString() && c.stage === "hired"
      );
      if (hired.length > 0) {
        const earliest = Math.min(...hired.map(c => new Date(c.updatedAt).getTime()));
        avgTimeToHireMs.push(earliest - new Date(job.createdAt).getTime());
      }
    }
    const avgTimeToHireDays = avgTimeToHireMs.length > 0
      ? Math.round(avgTimeToHireMs.reduce((a, b) => a + b, 0) / avgTimeToHireMs.length / 86400000)
      : null;

    // Source breakdown
    const sourceCounts: Record<string, number> = {};
    for (const c of allCandidates) {
      const src = c.source?.trim() || "Not specified";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
    for (const r of formResponses as any[]) {
      const src = r.source?.trim() || "Form";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
    const sourceBreakdown = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count, pct: totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // Bias detection: gender & age distribution (from voluntarily provided data only)
    const genderCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = {};
    for (const c of allCandidates) {
      if (c.gender?.trim()) {
        const g = c.gender.trim().toLowerCase();
        genderCounts[g] = (genderCounts[g] || 0) + 1;
      }
      if (c.ageRange?.trim()) {
        const a = c.ageRange.trim();
        ageCounts[a] = (ageCounts[a] || 0) + 1;
      }
    }
    const totalWithGender = Object.values(genderCounts).reduce((a, b) => a + b, 0);
    const totalWithAge = Object.values(ageCounts).reduce((a, b) => a + b, 0);
    const genderBreakdown = Object.entries(genderCounts).map(([gender, count]) => ({
      gender, count, pct: totalWithGender > 0 ? Math.round((count / totalWithGender) * 100) : 0,
    }));
    const ageBreakdown = Object.entries(ageCounts).map(([ageRange, count]) => ({
      ageRange, count, pct: totalWithAge > 0 ? Math.round((count / totalWithAge) * 100) : 0,
    }));

    // Bias across stages: gender distribution per pipeline stage (for hired vs rejected comparison)
    const biasStageData: Record<string, Record<string, number>> = {};
    for (const c of allCandidates) {
      if (!c.gender?.trim()) continue;
      const g = c.gender.trim().toLowerCase();
      if (!biasStageData[c.stage]) biasStageData[c.stage] = {};
      biasStageData[c.stage][g] = (biasStageData[c.stage][g] || 0) + 1;
    }

    // Per-job stats
    const jobStats = jobs.map(job => {
      const jCandidates = allCandidates.filter(c => c.jobId.toString() === job._id.toString());
      const avgScore = jCandidates.length > 0
        ? Math.round(jCandidates.reduce((s, c) => s + (c.maxScore > 0 ? (c.totalScore / c.maxScore) * 100 : 0), 0) / jCandidates.length)
        : 0;
      const hired = jCandidates.filter(c => c.stage === "hired").length;
      const rejected = jCandidates.filter(c => c.stage === "rejected").length;
      return {
        jobId: job._id,
        title: job.title,
        department: job.department,
        status: job.status,
        totalCandidates: jCandidates.length,
        avgScorePct: avgScore,
        hired,
        rejected,
        createdAt: job.createdAt,
      };
    });

    // Per-form stats (mirrors jobStats so the dashboard can show both side by side)
    const formStats = (forms as any[]).map(form => {
      const fResponses = (formResponses as any[]).filter(r => String(r.formId) === String(form._id));
      const scored = fResponses.filter(r => !r.scoringFailed);
      return {
        formId: form._id,
        title: form.title,
        status: form.status,
        agentEnabled: form.agentMode?.enabled === true,
        totalResponses: fResponses.length,
        avgScorePct: scored.length
          ? Math.round(scored.reduce((s, r) => s + (r.aiScore ?? 0), 0) / scored.length)
          : 0,
        hired: fResponses.filter(r => r.stage === "hired").length,
        rejected: fResponses.filter(r => r.stage === "rejected").length,
        createdAt: form.createdAt,
      };
    });

    return res.json({
      totalJobs,
      activeJobs,
      totalCandidates,
      totalStandardCandidates,
      totalFormResponses,
      totalForms: forms.length,
      stageCounts,
      funnelDropoff,
      avgTimeToHireDays,
      sourceBreakdown,
      genderBreakdown,
      ageBreakdown,
      biasStageData,
      jobStats,
      formStats,
    });
  } catch (err: any) {
    console.error("[recruit] GET /analytics", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Assessment Completion Rate Alert ────────────────────────────────────────

async function checkAssessmentCompletionRateAlert(
  jobId: string,
  uid: string,
  allTimeSent: number,
  allTimeCompleted: number,
  jobTitle: string,
): Promise<void> {
  await connectMongo();
  const job = await RecruitJob.findOne({ _id: jobId, uid }).select("assessmentAlert").lean() as any;
  if (!job) return;

  const a = job.assessmentAlert ?? { enabled: false, threshold: 50, alertFired: false, lastCompletionRate: null, bannerDismissed: false, alertLog: [] };
  const currentRate = allTimeSent > 0 ? Math.round((allTimeCompleted / allTimeSent) * 100) : 100;

  // Rate is at or above threshold → reset episode so next drop re-triggers
  if (currentRate >= a.threshold) {
    if (a.alertFired) {
      await RecruitJob.updateOne({ _id: jobId }, {
        $set: {
          "assessmentAlert.alertFired":        false,
          "assessmentAlert.bannerDismissed":   false,
          "assessmentAlert.lastCompletionRate": currentRate,
        },
      });
    }
    return;
  }

  // Rate is below threshold
  if (!a.enabled) return;
  if (a.alertFired) return; // already alerted for this episode — wait for recovery

  // New episode below threshold — send email + record log entry
  const user = await User.findById(uid).lean() as any;
  if (!user?.email) return;

  const generatedAt = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  // Phase 4 audit: this is an operational alert about the recruiter's own
  // dashboard (completion-rate drop), fired at most once per episode as a
  // side-effect of viewing analytics — not creator-initiated automated AI/email
  // campaign work. Left unmetered like other system notifications so a billing
  // lapse never suppresses an operational alert about the recruiter's own data.
  const dashboardUrl = `${FRONTEND_URL}/recruit/jobs/${jobId}`;
  const { subject, html, text } = emailTemplates.assessmentCompletionAlertEmail(
    user.name || user.email.split("@")[0],
    jobTitle,
    currentRate,
    a.threshold,
    allTimeSent,
    allTimeCompleted,
    generatedAt,
    dashboardUrl,
  );

  await sendEmail({ to: user.email, subject, html, text, from: NOTIFICATION_FROM });

  const logEntry = {
    triggeredAt:    new Date(),
    completionRate: currentRate,
    threshold:      a.threshold,
    totalSent:      allTimeSent,
    totalCompleted: allTimeCompleted,
  };

  await RecruitJob.updateOne({ _id: jobId }, {
    $set: {
      "assessmentAlert.alertFired":         true,
      "assessmentAlert.lastCompletionRate": currentRate,
      "assessmentAlert.bannerDismissed":    false,
    },
    $push: { "assessmentAlert.alertLog": logEntry },
  });

  console.log(`[assessment-alert] Fired for job ${jobId} — rate ${currentRate}% < threshold ${a.threshold}%`);
}

// ─── Assessment Analytics (per-job) ──────────────────────────────────────────

recruitRouter.get("/jobs/:jobId/assessment-analytics", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    // Optional date range (ISO strings)
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : null;
    const toDate   = to   ? new Date(to)   : null;
    if (toDate) toDate.setHours(23, 59, 59, 999); // include the full to-day

    function inRange(date: Date | undefined | null): boolean {
      if (!fromDate && !toDate) return true;
      if (!date) return false;
      const d = new Date(date);
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    }

    // Fetch all candidates for this job (only needed fields)
    const allCandidates = await RecruitCandidate.find({ jobId: req.params.jobId, uid })
      .select("name email totalScore maxScore assessmentStatus assessmentSentAt assessmentCompletedAt assessmentAnswers hiringDecision stage createdAt updatedAt")
      .lean();

    // ── Segment by assessment status + date filter ────────────────────────────
    const allSent      = allCandidates.filter(c => c.assessmentStatus !== "not_sent");
    const allCompleted = allCandidates.filter(c => c.assessmentStatus === "completed");
    const allTaking    = allCandidates.filter(c => c.assessmentStatus === "sent");
    const allAwaiting  = allCandidates.filter(c => c.assessmentStatus === "not_sent");

    // Date-filtered variants (used for metrics & charts)
    const filtSent      = allSent.filter(c  => inRange(c.assessmentSentAt));
    const filtCompleted = allCompleted.filter(c => inRange(c.assessmentCompletedAt));
    const filtTaking    = allTaking.filter(c => inRange(c.assessmentSentAt));
    const filtAwaiting  = allAwaiting.filter(c => inRange(c.createdAt));

    // ── Score helpers ─────────────────────────────────────────────────────────
    function scorePct(c: { totalScore?: number; maxScore?: number }): number | null {
      if (!c.maxScore || c.maxScore <= 0) return null;
      return Math.round(((c.totalScore ?? 0) / c.maxScore) * 100);
    }

    const completedScores = filtCompleted
      .map(c => scorePct(c))
      .filter((s): s is number => s !== null);

    const avgScore     = completedScores.length > 0 ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length) : null;
    const highestScore = completedScores.length > 0 ? Math.max(...completedScores) : null;
    const lowestScore  = completedScores.length > 0 ? Math.min(...completedScores) : null;

    // ── Time taken ────────────────────────────────────────────────────────────
    const timeTotals = filtCompleted
      .map(c => ((c.assessmentAnswers as any[]) || []).reduce((s: number, a: any) => s + (Number(a.timeTakenSeconds) || 0), 0))
      .filter(t => t > 0);
    const avgTimeTakenSeconds = timeTotals.length > 0
      ? Math.round(timeTotals.reduce((a, b) => a + b, 0) / timeTotals.length)
      : null;

    // ── Hiring decisions ──────────────────────────────────────────────────────
    const passCount  = filtCompleted.filter(c => c.hiringDecision === "strong_yes").length;
    const maybeCount = filtCompleted.filter(c => c.hiringDecision === "maybe").length;
    const failCount  = filtCompleted.filter(c => c.hiringDecision === "no").length;
    const passRate   = filtCompleted.length > 0 ? Math.round((passCount  / filtCompleted.length) * 100) : null;
    const failRate   = filtCompleted.length > 0 ? Math.round((failCount  / filtCompleted.length) * 100) : null;

    // ── Completion Trend (daily sent + completed) ─────────────────────────────
    const trendMap: Record<string, { sent: number; completed: number }> = {};
    for (const c of filtSent) {
      if (!c.assessmentSentAt) continue;
      const day = new Date(c.assessmentSentAt).toISOString().slice(0, 10);
      if (!trendMap[day]) trendMap[day] = { sent: 0, completed: 0 };
      trendMap[day].sent++;
    }
    for (const c of filtCompleted) {
      if (!c.assessmentCompletedAt) continue;
      const day = new Date(c.assessmentCompletedAt).toISOString().slice(0, 10);
      if (!trendMap[day]) trendMap[day] = { sent: 0, completed: 0 };
      trendMap[day].completed++;
    }
    const completionTrend = Object.entries(trendMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Score Distribution ────────────────────────────────────────────────────
    const buckets = [
      { range: "0–20",   min: 0,  max: 20,  count: 0 },
      { range: "21–40",  min: 21, max: 40,  count: 0 },
      { range: "41–60",  min: 41, max: 60,  count: 0 },
      { range: "61–80",  min: 61, max: 80,  count: 0 },
      { range: "81–100", min: 81, max: 100, count: 0 },
    ];
    for (const s of completedScores) {
      const b = buckets.find(bk => s >= bk.min && s <= bk.max);
      if (b) b.count++;
    }

    // ── Avg Score Over Time ───────────────────────────────────────────────────
    const avgScoreMap: Record<string, { total: number; count: number }> = {};
    for (const c of filtCompleted) {
      const sp = scorePct(c);
      if (sp === null || !c.assessmentCompletedAt) continue;
      const day = new Date(c.assessmentCompletedAt).toISOString().slice(0, 10);
      if (!avgScoreMap[day]) avgScoreMap[day] = { total: 0, count: 0 };
      avgScoreMap[day].total += sp;
      avgScoreMap[day].count++;
    }
    const avgScoreOverTime = Object.entries(avgScoreMap)
      .map(([date, { total, count }]) => ({ date, avgScore: Math.round(total / count), count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Candidate lists for drill-down ────────────────────────────────────────
    function mapC(c: any) {
      return {
        _id: String(c._id),
        name: c.name,
        email: c.email,
        scorePct: scorePct(c),
        assessmentStatus: c.assessmentStatus,
        assessmentSentAt:      c.assessmentSentAt      ?? null,
        assessmentCompletedAt: c.assessmentCompletedAt ?? null,
        hiringDecision: c.hiringDecision ?? null,
        stage: c.stage,
        timeTakenSeconds: ((c.assessmentAnswers as any[]) || []).reduce((s: number, a: any) => s + (Number(a.timeTakenSeconds) || 0), 0),
      };
    }

    const bySP = (a: any, b: any) => {
      const as = a.maxScore > 0 ? a.totalScore / a.maxScore : 0;
      const bs = b.maxScore > 0 ? b.totalScore / b.maxScore : 0;
      return bs - as; // highest first
    };

    // Recent activity feed (last 20 assessment events across all candidates)
    const activityEvents: Array<{ type: string; candidateName: string; candidateId: string; timestamp: string; scorePct?: number | null; hiringDecision?: string | null }> = [];
    for (const c of allCandidates) {
      if (c.assessmentSentAt) {
        activityEvents.push({ type: "sent", candidateName: c.name, candidateId: String(c._id), timestamp: new Date(c.assessmentSentAt).toISOString(), scorePct: null });
      }
      if (c.assessmentCompletedAt) {
        activityEvents.push({ type: "completed", candidateName: c.name, candidateId: String(c._id), timestamp: new Date(c.assessmentCompletedAt).toISOString(), scorePct: scorePct(c), hiringDecision: c.hiringDecision ?? null });
      }
    }
    activityEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ── Assessment completion rate alert ──────────────────────────────────────
    const jobAny       = job as any;
    const alertCfg     = jobAny.assessmentAlert ?? { enabled: false, threshold: 50, alertFired: false, lastCompletionRate: null, bannerDismissed: false, alertLog: [] };
    const allTimeSent      = allSent.length;
    const allTimeCompleted = allCompleted.length;
    const allTimeRate      = allTimeSent > 0 ? Math.round((allTimeCompleted / allTimeSent) * 100) : 100;
    const alertActive      = alertCfg.enabled && allTimeRate < alertCfg.threshold;

    // Inject alert log entries into the activity feed
    const alertLogEvents: typeof activityEvents = (alertCfg.alertLog ?? []).map((e: any) => ({
      type: "alert",
      candidateName: "",
      candidateId:   "",
      timestamp:     new Date(e.triggeredAt).toISOString(),
      completionRate: e.completionRate,
      threshold:      e.threshold,
    }));
    const mergedFeed = [...activityEvents, ...alertLogEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 30);

    // Trigger non-blocking alert check (won't block the response)
    const jobTitle   = (job as any).title ?? "";
    const jobIdStr   = req.params.jobId;
    const uidForAlert = uid;
    setImmediate(() => {
      checkAssessmentCompletionRateAlert(jobIdStr, uidForAlert, allTimeSent, allTimeCompleted, jobTitle)
        .catch(e => console.error("[assessment-alert] check failed:", e));
    });

    return res.json({
      metrics: {
        totalSent:         filtSent.length,
        totalCompleted:    filtCompleted.length,
        completionRate:    filtSent.length > 0 ? Math.round((filtCompleted.length / filtSent.length) * 100) : 0,
        avgScore,
        highestScore,
        lowestScore,
        avgTimeTakenSeconds,
        passCount,
        maybeCount,
        failCount,
        passRate,
        failRate,
        awaitingCount: filtAwaiting.length,
        takingCount:   filtTaking.length,
        totalCandidates: allCandidates.length,
      },
      charts: {
        completionTrend,
        scoreDistribution: buckets.map(({ min: _m, max: _x, ...rest }) => rest),
        decisionBreakdown: { strongYes: passCount, maybe: maybeCount, no: failCount },
        avgScoreOverTime,
      },
      candidates: {
        topScorers:  [...filtCompleted].filter(c => c.maxScore > 0).sort(bySP).slice(0, 8).map(mapC),
        lowScorers:  [...filtCompleted].filter(c => c.maxScore > 0).sort((a, b) => bySP(b, a)).slice(0, 8).map(mapC),
        incomplete:  filtTaking.sort((a, b) => new Date(a.assessmentSentAt ?? 0).getTime() - new Date(b.assessmentSentAt ?? 0).getTime()).slice(0, 10).map(mapC),
        taking:      filtTaking.slice(0, 10).map(mapC),
        awaiting:    filtAwaiting.slice(0, 10).map(mapC),
      },
      activityFeed: mergedFeed,
      assessmentAlert: {
        enabled:              alertCfg.enabled,
        threshold:            alertCfg.threshold,
        alertActive,
        bannerDismissed:      alertCfg.bannerDismissed,
        alertFired:           alertCfg.alertFired,
        allTimeCompletionRate: allTimeRate,
        allTimeSent,
        allTimeCompleted,
        alertLog:             (alertCfg.alertLog ?? []).map((e: any) => ({
          triggeredAt:    new Date(e.triggeredAt).toISOString(),
          completionRate: e.completionRate,
          threshold:      e.threshold,
          totalSent:      e.totalSent,
          totalCompleted: e.totalCompleted,
        })),
      },
    });
  } catch (err: any) {
    console.error("[recruit] GET /assessment-analytics", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Assessment Alert Settings ───────────────────────────────────────────────

recruitRouter.patch("/jobs/:jobId/assessment-alert", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { enabled, threshold } = req.body as { enabled?: boolean; threshold?: number };
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean() as any;
    if (!job) return res.status(404).json({ error: "Job not found." });

    const update: Record<string, unknown> = {};
    if (enabled !== undefined) update["assessmentAlert.enabled"] = Boolean(enabled);
    if (threshold !== undefined) {
      const t = Math.min(100, Math.max(1, Math.round(Number(threshold))));
      update["assessmentAlert.threshold"] = t;
      // Threshold changed — reset alertFired so the new threshold is checked fresh
      update["assessmentAlert.alertFired"] = false;
    }

    const updated = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, uid },
      { $set: update },
      { returnDocument: "after" }
    ).lean() as any;

    return res.json({ ok: true, assessmentAlert: updated?.assessmentAlert });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/assessment-alert/dismiss-banner", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    await RecruitJob.updateOne(
      { _id: req.params.jobId, uid },
      { $set: { "assessmentAlert.bannerDismissed": true } }
    );
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Assessment Analytics Export ────────────────────────────────────────────

recruitRouter.get("/jobs/:jobId/assessment-analytics/export", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : null;
    const toDate   = to   ? new Date(to)   : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    function inRange(date: Date | undefined | null): boolean {
      if (!fromDate && !toDate) return true;
      if (!date) return false;
      const d = new Date(date);
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    }

    const allCandidates = await runStandardBillingOperation({
      ownerUid: uid,
      operation: "export_standard",
      idempotencyKey: standardRequestIdempotencyKey(
        uid,
        "assessment-export",
        standardIdempotencyHeader(req) || standardContentHash(`${req.params.jobId}:${from ?? ""}:${to ?? ""}:${new Date().toISOString().slice(0, 13)}`),
      ),
      resourceType: "job",
      resourceId: String(req.params.jobId),
      work: async () => RecruitCandidate.find({ jobId: req.params.jobId, uid })
        .select("name email totalScore maxScore assessmentStatus assessmentSentAt assessmentCompletedAt assessmentAnswers hiringDecision stage createdAt")
        .lean(),
    });

    function scorePct(c: { totalScore?: number; maxScore?: number }): number | null {
      if (!c.maxScore || c.maxScore <= 0) return null;
      return Math.round(((c.totalScore ?? 0) / c.maxScore) * 100);
    }

    function timeTaken(c: { assessmentAnswers?: any[] }): number {
      return ((c.assessmentAnswers as any[]) || []).reduce((s: number, a: any) => s + (Number(a.timeTakenSeconds) || 0), 0);
    }

    function passFailLabel(c: { hiringDecision?: string | null; assessmentStatus?: string }): string {
      if (c.assessmentStatus !== "completed") return "—";
      if (c.hiringDecision === "strong_yes") return "Pass";
      if (c.hiringDecision === "no") return "Fail";
      if (c.hiringDecision === "maybe") return "Maybe";
      return "Pending";
    }

    // Filter candidates: use assessmentSentAt for sent/completed, createdAt for not_sent
    const filtered = allCandidates.filter(c => {
      if (c.assessmentStatus === "completed") return inRange(c.assessmentCompletedAt);
      if (c.assessmentStatus === "sent")      return inRange(c.assessmentSentAt);
      return inRange(c.createdAt);
    });

    const candidates = filtered.map(c => ({
      name:               c.name,
      email:              c.email ?? "",
      assessmentStatus:   c.assessmentStatus === "completed" ? "Completed"
                        : c.assessmentStatus === "sent"      ? "Sent (Incomplete)"
                        : "Not Sent",
      scorePct:           scorePct(c),
      passFailStatus:     passFailLabel(c),
      timeTakenSeconds:   timeTaken(c),
      assessmentCompletedAt: c.assessmentCompletedAt ? new Date(c.assessmentCompletedAt).toISOString() : null,
      stage:              c.stage ?? "",
      hiringDecision:     c.hiringDecision ?? null,
    }));

    return res.json({ jobTitle: (job as any).title ?? "", candidates });
  } catch (err: any) {
    if (await respondStandardBillingError(res, err, getUid(req))) return;
    console.error("[recruit] GET /assessment-analytics/export", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Comprehensive Job Analysis ──────────────────────────────────────────────

recruitRouter.get("/jobs/:jobId/job-analysis", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean() as any;
    if (!job) return res.status(404).json({ error: "Job not found." });

    const allCandidates = await RecruitCandidate.find({ jobId: req.params.jobId, uid }).lean() as any[];

    const now = Date.now();
    const jobCreated = new Date(job.createdAt).getTime();
    const activeDays = Math.max(1, Math.round((now - jobCreated) / 86400000));

    // ── Score helpers ─────────────────────────────────────────────────────────
    function scorePct(c: any): number | null {
      if (!c.maxScore || c.maxScore <= 0) return null;
      return Math.round((c.totalScore / c.maxScore) * 100);
    }

    const allScores = allCandidates.map(scorePct).filter((s): s is number => s !== null);
    const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
    const topScore = allScores.length > 0 ? Math.max(...allScores) : null;

    // ── Stage counts ──────────────────────────────────────────────────────────
    const STAGES = ["applied", "review_zone", "screened", "assessed", "interview", "offer", "hired", "rejected"] as const;
    const stageCounts: Record<string, number> = {};
    for (const s of STAGES) stageCounts[s] = 0;
    for (const c of allCandidates) {
      if (stageCounts[c.stage] !== undefined) stageCounts[c.stage]++;
    }

    const hiredCount      = stageCounts["hired"];
    const rejectedCount   = stageCounts["rejected"];
    const activeStages    = ["applied", "review_zone", "screened", "assessed", "interview", "offer"] as const;
    const totalActive     = activeStages.reduce((s, st) => s + stageCounts[st], 0);
    const totalCandidates = allCandidates.length;

    // ── Pipeline funnel ───────────────────────────────────────────────────────
    const FUNNEL_STAGES = ["applied", "review_zone", "screened", "assessed", "interview", "offer", "hired"] as const;
    const funnelStages = FUNNEL_STAGES.map((stage, i) => {
      const count = stageCounts[stage] ?? 0;
      // Cumulative count through this stage = everyone at this stage or further (except rejected)
      const cumulative = FUNNEL_STAGES.slice(i).reduce((s, st) => s + (stageCounts[st] ?? 0), 0) + (stageCounts["rejected"] ?? 0);
      const prevCumulative = i === 0
        ? totalCandidates
        : FUNNEL_STAGES.slice(i - 1).reduce((s, st) => s + (stageCounts[st] ?? 0), 0) + (stageCounts["rejected"] ?? 0);

      // Conversion rate from previous stage
      const conversionRate = (i === 0 || prevCumulative === 0)
        ? null
        : Math.round((cumulative / prevCumulative) * 100);

      // Avg days in this stage (approx: for candidates currently here, days since stageMovedAt)
      const inStage = allCandidates.filter((c: any) => c.stage === stage);
      let avgDays: number | null = null;
      if (inStage.length > 0) {
        const days = inStage
          .map((c: any) => c.stageMovedAt ? Math.round((now - new Date(c.stageMovedAt).getTime()) / 86400000) : null)
          .filter((d: number | null): d is number => d !== null && d >= 0);
        if (days.length > 0) avgDays = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      }

      return {
        stage,
        label: stage.charAt(0).toUpperCase() + stage.slice(1),
        count,
        pct: totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0,
        conversionRate,
        avgDaysInStage: avgDays,
      };
    });

    // Bottleneck: active stage with highest absolute count (most candidates stuck)
    const activeWithCount = funnelStages.filter(s => s.stage !== "hired" && s.count > 0);
    const bottleneck = activeWithCount.length > 0
      ? activeWithCount.reduce((a, b) => (a.count > b.count ? a : b)).stage
      : null;

    // ── Score distribution tiers ──────────────────────────────────────────────
    const scoreBuckets = [
      { range: "0–20",   min: 0,  max: 20,  count: 0 },
      { range: "21–40",  min: 21, max: 40,  count: 0 },
      { range: "41–60",  min: 41, max: 60,  count: 0 },
      { range: "61–80",  min: 61, max: 80,  count: 0 },
      { range: "81–100", min: 81, max: 100, count: 0 },
    ];
    for (const s of allScores) {
      const b = scoreBuckets.find(bk => s >= bk.min && s <= bk.max);
      if (b) b.count++;
    }

    const scoreDist = scoreBuckets.map(({ min: _m, max: _x, ...rest }) => ({
      ...rest,
      pct: allScores.length > 0 ? Math.round((rest.count / allScores.length) * 100) : 0,
    }));

    const excellent = allScores.filter(s => s >= 80).length;
    const good      = allScores.filter(s => s >= 60 && s < 80).length;
    const average   = allScores.filter(s => s >= 40 && s < 60).length;
    const low       = allScores.filter(s => s < 40).length;
    const scoringFailedCount = allCandidates.filter((c: any) => c.scoringFailed).length;

    // ── Application timeline (daily) ─────────────────────────────────────────
    const dayMap: Record<string, number> = {};
    for (const c of allCandidates) {
      const day = new Date(c.createdAt).toISOString().slice(0, 10);
      dayMap[day] = (dayMap[day] || 0) + 1;
    }
    const sortedDays = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    const timeline = sortedDays.map(([date, count]) => {
      cumulative += count;
      return { date, count, cumulative };
    });

    // Weekly avg applications
    const totalDays = sortedDays.length;
    const weeklyAvg = totalDays > 0 ? Math.round((totalCandidates / Math.max(1, activeDays)) * 7 * 10) / 10 : 0;
    const peakEntry = sortedDays.length > 0 ? sortedDays.reduce((a, b) => a[1] >= b[1] ? a : b) : null;

    // ── Source breakdown ──────────────────────────────────────────────────────
    const srcMap: Record<string, { total: number; hired: number; rejected: number }> = {};
    for (const c of allCandidates) {
      const src = c.source?.trim() || "Direct / Unknown";
      if (!srcMap[src]) srcMap[src] = { total: 0, hired: 0, rejected: 0 };
      srcMap[src].total++;
      if (c.stage === "hired")    srcMap[src].hired++;
      if (c.stage === "rejected") srcMap[src].rejected++;
    }
    const sources = Object.entries(srcMap)
      .map(([source, d]) => ({
        source,
        count: d.total,
        pct: totalCandidates > 0 ? Math.round((d.total / totalCandidates) * 100) : 0,
        hireCount: d.hired,
        hireRate: d.total > 0 ? Math.round((d.hired / d.total) * 100) : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── Assessment summary ────────────────────────────────────────────────────
    const allSent      = allCandidates.filter((c: any) => c.assessmentStatus !== "not_sent");
    const allCompleted = allCandidates.filter((c: any) => c.assessmentStatus === "completed");
    const assessCompletedScores = allCompleted
      .map(scorePct)
      .filter((s: number | null): s is number => s !== null);
    const assessAvgScore = assessCompletedScores.length > 0
      ? Math.round(assessCompletedScores.reduce((a: number, b: number) => a + b, 0) / assessCompletedScores.length)
      : null;
    const passCount  = allCompleted.filter((c: any) => c.hiringDecision === "strong_yes").length;
    const assessPassRate = allCompleted.length > 0 ? Math.round((passCount / allCompleted.length) * 100) : null;

    // ── Offer tracking ────────────────────────────────────────────────────────
    const offerCandidates = allCandidates.filter((c: any) => c.stage === "offer" || c.stage === "hired");
    const offerSent     = offerCandidates.filter((c: any) => c.offerStatus === "sent" || c.offerStatus === "approved" || c.offerCandidateStatus === "accepted" || c.offerCandidateStatus === "declined").length;
    const offerAccepted = offerCandidates.filter((c: any) => c.offerCandidateStatus === "accepted" || c.stage === "hired").length;
    const offerDeclined = offerCandidates.filter((c: any) => c.offerCandidateStatus === "declined").length;
    const offerPending  = offerCandidates.filter((c: any) => c.offerCandidateStatus === "pending" || c.offerCandidateStatus === "viewed").length;
    const acceptanceRate = offerSent > 0 ? Math.round((offerAccepted / offerSent) * 100) : null;

    // ── Time-to-hire ──────────────────────────────────────────────────────────
    const hiredCandidates = allCandidates.filter((c: any) => c.stage === "hired");
    const tthDays = hiredCandidates
      .map((c: any) => {
        const applied = new Date(c.createdAt).getTime();
        const hired   = new Date(c.updatedAt).getTime();
        return Math.round((hired - applied) / 86400000);
      })
      .filter((d: number) => d >= 0 && d < 365);
    const avgTimeToHireDays = tthDays.length > 0
      ? Math.round(tthDays.reduce((a: number, b: number) => a + b, 0) / tthDays.length)
      : null;

    // ── AI Health Score + Insights ────────────────────────────────────────────
    const aiPrompt = `You are a recruitment intelligence analyst. Analyze this job posting's hiring data and return structured insights.

JOB: "${job.title}" at "${job.companyName || 'the company'}" (${job.department || job.niche || ''})
STATUS: ${job.status} | Posted ${activeDays} day${activeDays !== 1 ? 's' : ''} ago | ${job.openings || 1} opening${(job.openings || 1) !== 1 ? 's' : ''}

PIPELINE DATA:
- Total candidates: ${totalCandidates}
- Applied: ${stageCounts['applied']}, Screened: ${stageCounts['screened']}, Assessed: ${stageCounts['assessed']}, Interview: ${stageCounts['interview']}, Offer: ${stageCounts['offer']}, Hired: ${hiredCount}, Rejected: ${rejectedCount}
- Bottleneck stage: ${bottleneck || 'none identified'}
- Weekly application rate: ${weeklyAvg}/week

CANDIDATE QUALITY:
- Average resume score: ${avgScore !== null ? avgScore + '%' : 'N/A'}
- Score distribution: Excellent (80+): ${excellent}, Good (60-79): ${good}, Average (40-59): ${average}, Low (<40): ${low}
- Scoring failed: ${scoringFailedCount}

ASSESSMENT:
- Sent: ${allSent.length}, Completed: ${allCompleted.length}, Completion rate: ${allSent.length > 0 ? Math.round((allCompleted.length / allSent.length) * 100) : 0}%
- Assessment avg score: ${assessAvgScore !== null ? assessAvgScore + '%' : 'N/A'}
- Pass rate: ${assessPassRate !== null ? assessPassRate + '%' : 'N/A'}

OFFERS:
- Offer acceptance rate: ${acceptanceRate !== null ? acceptanceRate + '%' : 'N/A'}
- Offers sent: ${offerSent}, Accepted: ${offerAccepted}, Declined: ${offerDeclined}

TIME METRICS:
- Avg time-to-hire: ${avgTimeToHireDays !== null ? avgTimeToHireDays + ' days' : 'no hires yet'}

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "healthScore": <number 0-100>,
  "healthLabel": <"Excellent" | "Good" | "Needs Attention" | "At Risk">,
  "insights": [
    { "type": <"success" | "warning" | "danger" | "info">, "title": "<short title>", "detail": "<1-2 sentence explanation>", "action": "<optional actionable suggestion>" }
  ]
}

Guidelines:
- healthScore: weight pipeline activity (25%), candidate quality (25%), conversion efficiency (25%), time-to-hire (25%)
- Provide 4-6 insights covering: pipeline health, quality of candidates, bottlenecks, time efficiency, recommendations
- Be specific and actionable — reference actual numbers from the data
- type "success" = doing well, "warning" = could improve, "danger" = needs immediate action, "info" = general observation`;

    let aiResult: { healthScore: number; healthLabel: string; insights: any[] } = {
      healthScore: 50,
      healthLabel: "Needs Attention",
      insights: [],
    };

    try {
      const rawAI = await runStandardBillingOperation({
        ownerUid: uid,
        operation: "job_analysis",
        idempotencyKey: standardIdempotencyKey(uid, ["job-analysis", String(req.params.jobId), new Date().toISOString().slice(0, 13)]),
        resourceType: "job",
        resourceId: String(req.params.jobId),
        work: async () => callGeminiChain({
          prompt: aiPrompt,
          temperature: 0.3,
          maxOutputTokens: 3000,
          jsonMode: true,
        }),
      });
      const parsed = JSON.parse(rawAI.trim());
      if (parsed && typeof parsed.healthScore === "number" && Array.isArray(parsed.insights)) {
        aiResult = {
          healthScore: Math.min(100, Math.max(0, Math.round(parsed.healthScore))),
          healthLabel: parsed.healthLabel || "Needs Attention",
          insights: parsed.insights.slice(0, 6).map((ins: any) => ({
            type:   ins.type   || "info",
            title:  ins.title  || "",
            detail: ins.detail || "",
            action: ins.action || null,
          })),
        };
      }
    } catch (aiErr: any) {
      console.warn("[job-analysis] AI health score skipped:", aiErr?.message);
      // Fallback heuristic score
      let hs = 50;
      if (totalCandidates > 10) hs += 10;
      if (hiredCount > 0) hs += 15;
      if (avgScore !== null && avgScore >= 65) hs += 10;
      if (allCompleted.length > 0 && assessPassRate !== null && assessPassRate >= 50) hs += 10;
      aiResult.healthScore = Math.min(100, hs);
      aiResult.healthLabel = hs >= 80 ? "Excellent" : hs >= 65 ? "Good" : hs >= 45 ? "Needs Attention" : "At Risk";
    }

    return res.json({
      overview: {
        totalCandidates,
        activeDays,
        jobStatus: job.status,
        openings: job.openings || 1,
        applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline).toISOString() : null,
        avgScore,
        topScore,
        hiredCount,
        offerSentCount:     offerSent,
        offerAcceptedCount: offerAccepted,
        rejectedCount,
        timeToHireDays: avgTimeToHireDays,
        weeklyApplicationRate: weeklyAvg,
        totalActive,
      },
      pipeline: {
        stages: funnelStages,
        bottleneck,
        totalActive,
        rejected: rejectedCount,
      },
      quality: {
        scoreDistribution: scoreDist,
        avgScore,
        topScore,
        scoringFailedCount,
        candidatesByTier: { excellent, good, average, low },
        totalScored: allScores.length,
      },
      timeline: {
        daily: timeline,
        weeklyAvg,
        peakDay: peakEntry?.[0] ?? null,
        peakCount: peakEntry?.[1] ?? 0,
      },
      sources,
      assessment: {
        sent:           allSent.length,
        completed:      allCompleted.length,
        completionRate: allSent.length > 0 ? Math.round((allCompleted.length / allSent.length) * 100) : 0,
        avgScore:       assessAvgScore,
        passRate:       assessPassRate,
        passCount,
        maybeCount:     allCompleted.filter((c: any) => c.hiringDecision === "maybe").length,
        failCount:      allCompleted.filter((c: any) => c.hiringDecision === "no").length,
      },
      offers: {
        sent:            offerSent,
        accepted:        offerAccepted,
        declined:        offerDeclined,
        pending:         offerPending,
        acceptanceRate,
      },
      ai: aiResult,
    });
  } catch (err: any) {
    console.error("[recruit] GET /job-analysis", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Live Assessment Progress ────────────────────────────────────────────────
recruitRouter.get("/jobs/:jobId/live-assessment-progress", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).select("title").lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [inProgressRaw, completedTodayRaw, awaitingCount] = await Promise.all([
      RecruitCandidate.find({ jobId: req.params.jobId, uid, assessmentStatus: "sent" })
        .select("name email stage assessmentSentAt assessmentStartedAt currentQuestionIndex assessmentQuestions")
        .lean(),
      RecruitCandidate.find({
        jobId: req.params.jobId, uid,
        assessmentStatus: "completed",
        assessmentCompletedAt: { $gte: todayStart },
      }).select("name email stage assessmentSentAt assessmentStartedAt assessmentCompletedAt totalScore maxScore hiringDecision").lean(),
      RecruitCandidate.countDocuments({ jobId: req.params.jobId, uid, assessmentStatus: "not_sent" }),
    ]);

    const inProgress = inProgressRaw.map((c: any) => {
      const totalQ = (c.assessmentQuestions ?? []).length;
      const curIdx = c.currentQuestionIndex ?? null;
      const startedMs = c.assessmentStartedAt ? new Date(c.assessmentStartedAt).getTime() : null;
      const elapsedSeconds = startedMs ? Math.floor((now - startedMs) / 1000) : null;
      const progressPct = (curIdx !== null && totalQ > 0) ? Math.round(((curIdx + 1) / totalQ) * 100) : null;
      return {
        _id: String(c._id),
        name: c.name,
        email: c.email,
        stage: c.stage,
        assessmentSentAt: c.assessmentSentAt ?? null,
        assessmentStartedAt: c.assessmentStartedAt ?? null,
        currentQuestionIndex: curIdx,
        totalQuestions: totalQ,
        elapsedSeconds,
        progressPct,
        started: c.assessmentStartedAt != null,
      };
    });

    const completedToday = completedTodayRaw.map((c: any) => {
      const scorePct = (c.maxScore ?? 0) > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : null;
      const startedMs = c.assessmentStartedAt ? new Date(c.assessmentStartedAt).getTime() : null;
      const completedMs = c.assessmentCompletedAt ? new Date(c.assessmentCompletedAt).getTime() : null;
      const durationSeconds = (startedMs && completedMs) ? Math.floor((completedMs - startedMs) / 1000) : null;
      return {
        _id: String(c._id),
        name: c.name,
        email: c.email,
        stage: c.stage,
        assessmentSentAt: c.assessmentSentAt ?? null,
        assessmentStartedAt: c.assessmentStartedAt ?? null,
        assessmentCompletedAt: c.assessmentCompletedAt ?? null,
        scorePct,
        hiringDecision: c.hiringDecision,
        durationSeconds,
      };
    });

    const started = inProgress.filter(c => c.started && c.progressPct !== null);
    const avgProgress = started.length > 0
      ? Math.round(started.reduce((s, c) => s + (c.progressPct ?? 0), 0) / started.length)
      : null;
    const avgDuration = completedToday.filter(c => c.durationSeconds).length > 0
      ? Math.round(completedToday.filter(c => c.durationSeconds).reduce((s, c) => s + (c.durationSeconds ?? 0), 0) / completedToday.filter(c => c.durationSeconds).length)
      : null;

    return res.json({
      jobTitle: (job as any).title,
      inProgress,
      completedToday,
      summary: {
        inProgressCount: inProgress.length,
        completedTodayCount: completedToday.length,
        awaitingCount,
        avgCurrentProgress: avgProgress,
        avgCompletionSeconds: avgDuration,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[recruit] GET /live-assessment-progress", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Talent Pool ─────────────────────────────────────────────────────────────

// Single source of truth for "silver-medal" auto-eligibility, mirrored in the
// Mongo $expr filter below. Exposed on API responses as `autoEligible` so the
// frontend never has to re-derive (and risk drifting from) this rule.
const TALENT_POOL_AUTO_THRESHOLD = 0.55;
function isAutoEligibleForTalentPool(c: { stage?: string; totalScore?: number; maxScore?: number }): boolean {
  const pct = (c.totalScore ?? 0) / Math.max(c.maxScore ?? 0, 1);
  return c.stage === "rejected" && pct >= TALENT_POOL_AUTO_THRESHOLD;
}

recruitRouter.get("/talent-pool", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);

    // Silver-medal candidates: rejected or not hired, but scored >= 55% OR manually added to pool
    const candidates = await RecruitCandidate.find({
      uid,
      $or: [
        { inTalentPool: true },
        {
          stage: "rejected",
          $expr: { $gte: [{ $divide: ["$totalScore", { $max: ["$maxScore", 1] }] }, TALENT_POOL_AUTO_THRESHOLD] },
        },
      ],
    })
      .populate<{ jobId: { _id: string; title: string; department: string; status: string } }>("jobId", "title department status")
      .sort({ totalScore: -1 })
      .lean();

    const withEligibility = candidates.map((c: any) => ({ ...c, autoEligible: isAutoEligibleForTalentPool(c) }));

    return res.json({ candidates: withEligibility });
  } catch (err: any) {
    console.error("[recruit] GET /talent-pool", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.patch("/talent-pool/:candidateId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const { inTalentPool, talentPoolNote } = req.body;
    const update: any = {};
    if (inTalentPool !== undefined) update.inTalentPool = inTalentPool;
    if (talentPoolNote !== undefined) update.talentPoolNote = talentPoolNote;
    const candidate = await RecruitCandidate.findOneAndUpdate(
      { _id: req.params.candidateId, uid },
      update,
      { returnDocument: "after" }
    ).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    return res.json({ candidate: { ...candidate, autoEligible: isAutoEligibleForTalentPool(candidate) } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** Re-score a talent-pool candidate into another Standard Job using stored resume text. */
recruitRouter.post("/talent-pool/:candidateId/reuse", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const targetJobId = String(req.body?.targetJobId ?? "").trim();
    if (!targetJobId) return res.status(400).json({ error: "targetJobId is required." });

    const source = await RecruitCandidate.findOne({ _id: req.params.candidateId, uid }).lean();
    if (!source) return res.status(404).json({ error: "Candidate not found." });
    if (!source.resumeText?.trim()) {
      return res.status(400).json({ error: "This candidate has no stored resume text to reuse." });
    }

    const access = await getJobWithCollaborationPermission(targetJobId, uid, "review_candidates");
    if (!access) return res.status(403).json({ error: "You do not have permission to add candidates to that job." });
    const job = access.job;

    if (String(source.jobId) === String(job._id)) {
      return res.status(400).json({ error: "Pick a different job — candidate is already on this role." });
    }

    if (source.email) {
      const existing = await RecruitCandidate.findOne({ jobId: job._id, email: source.email }).lean();
      if (existing) {
        return res.status(409).json({
          error: "A candidate with this email already exists on the target job.",
          candidateId: existing._id,
        });
      }
    }

    const ownerUid = standardBillingOwnerUid(job);
    await assertStandardResourceLimit(ownerUid, "stored_candidates");

    const scored = await meterCandidateScore(ownerUid, job, source.resumeText);

    const agentMode = (job as any).agentMode ?? {};
    const scorePct = scored.maxScore > 0 ? Math.round((scored.totalScore / scored.maxScore) * 100) : 0;
    const { initialStage, agentAction, shortlistThreshold, rejectThreshold } = computeAgentTriage(
      agentMode,
      scorePct,
      scored.scoringFailed,
    );

    const candidate = await runStandardBillingOperation({
      ownerUid,
      operation: "new_candidate_intake",
      idempotencyKey: standardIdempotencyKey(ownerUid, [
        "intake-reuse",
        String(job._id),
        String(source._id),
      ]),
      resourceType: "job",
      resourceId: String(job._id),
      work: async () => RecruitCandidate.create({
        jobId: job._id,
        uid: job.uid,
        name: scored.name || source.name,
        email: scored.email || source.email,
        resumeText: source.resumeText,
        totalScore: scored.totalScore,
        maxScore: scored.maxScore,
        scoreBreakdown: scored.scoreBreakdown,
        aiSummary: scored.aiSummary,
        redFlags: scored.redFlags,
        strengths: scored.strengths,
        stage: initialStage,
        stageMovedAt: new Date(),
        assessmentStatus: "not_sent",
        previousResumeScore: scored.totalScore,
        scoringFailed: scored.scoringFailed,
        source: "talent_pool",
        inTalentPool: true,
        talentPoolNote: source.talentPoolNote
          ? `Reused from prior role. ${source.talentPoolNote}`
          : "Reused from talent pool.",
      }),
    });

    await RecruitJob.updateOne({ _id: job._id }, { $inc: { candidateCount: 1 } });

    schedulePostIntakeAutomation(
      job,
      candidate,
      agentAction,
      agentAction
        ? {
            job,
            candidateId: String(candidate._id),
            candidateName: candidate.name,
            candidateEmail: scored.email || source.email || "",
            candidateTotalScore: candidate.totalScore,
            scorePct,
            shortlistThreshold,
            rejectThreshold,
            agentMode,
            logPrefix: "agent",
          }
        : null,
    );

    trackEvent("talent_pool_reuse", uid, { sourceId: source._id, jobId: job._id });
    return res.json({ ok: true, candidateId: candidate._id, jobId: job._id, stage: candidate.stage });
  } catch (err: any) {
    const targetJobId = String(req.body?.targetJobId ?? "").trim();
    const job = targetJobId ? (await getCollaborationAccess(targetJobId, getUid(req)))?.job : null;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    console.error("[recruit] POST /talent-pool/:candidateId/reuse", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Offer Letter ─────────────────────────────────────────────────────────────

type OfferTemplate = "full_time" | "internship" | "contract" | "remote" | "custom";

function offerTemplateInstructions(template: OfferTemplate): string {
  switch (template) {
    case "internship":
      return `This is an INTERNSHIP offer. Use appropriate language: refer to compensation as "stipend" (not salary), mention a fixed duration/end date if available, highlight learning opportunities, and keep the tone encouraging and welcoming for an early-career candidate.`;
    case "contract":
      return `This is a CONTRACT / FREELANCE engagement. Emphasize the project-based or fixed-term nature, use "engagement" or "contract" instead of "employment", mention deliverables or hourly/project rate language, and avoid permanent employment terms.`;
    case "remote":
      return `This is a REMOTE-FIRST offer. Highlight the distributed work environment, home-office flexibility, async communication culture, and any remote-specific perks (home office stipend, internet allowance, etc.) if mentioned in the benefits.`;
    case "custom":
      return `Write a general professional offer letter suitable for any employment type. Be clear and warm but keep it broadly applicable.`;
    default: // full_time
      return `This is a standard FULL-TIME PERMANENT employment offer. Include standard at-will or permanent employment terms, comprehensive benefits, and a clear acceptance timeline.`;
  }
}

async function generateOfferLetter(args: {
  candidateName: string;
  jobTitle: string;
  department: string;
  location: string;
  workMode: string;
  seniority: string;
  startDate: string;
  salary: string;
  salaryCurrency: string;
  template?: OfferTemplate;
  signingBonus?: string;
  benefits?: string;
  companyName?: string;
  hiringManagerName?: string;
  reportingManager?: string;
  offerExpiryDate?: string;
}): Promise<string> {
  const template = args.template || "full_time";
  const templateNote = offerTemplateInstructions(template);

  const prompt = `You are an expert HR professional. Write a professional, warm, and legally clear offer letter.

TEMPLATE TYPE: ${template.replace("_", " ").toUpperCase()}
${templateNote}

CANDIDATE & ROLE DETAILS:
- Candidate Name: ${args.candidateName}
- Role: ${args.jobTitle}
- Department: ${args.department || "Not specified"}
- Location: ${args.location}
- Work Mode: ${args.workMode}
- Seniority: ${args.seniority}
- Start Date: ${args.startDate}
${template === "internship" ? `- Stipend: ${args.salaryCurrency} ${args.salary}` : `- Salary: ${args.salaryCurrency} ${args.salary} per year`}
${args.signingBonus ? `- Signing Bonus: ${args.signingBonus}` : ""}
${args.benefits ? `- Benefits / Perks: ${args.benefits}` : ""}
${args.companyName ? `- Company: ${args.companyName}` : ""}
${args.hiringManagerName ? `- Hiring Manager: ${args.hiringManagerName}` : ""}
${args.reportingManager ? `- Reporting Manager: ${args.reportingManager}` : ""}
${args.offerExpiryDate ? `- Offer valid until: ${args.offerExpiryDate}` : ""}

Write a complete, ready-to-send offer letter that includes:
1. A warm congratulatory opening addressed to the candidate by name
2. Role details: title, department, location, work mode, start date
3. Compensation section appropriate to the template type
4. Employment/engagement terms paragraph (one paragraph, appropriate to template)
5. ${args.offerExpiryDate ? `A clear acceptance deadline — offer expires on ${args.offerExpiryDate}` : "A request to confirm acceptance within 5 business days by replying to this email"}
6. A warm, encouraging close

FORMAT RULES:
- Plain text only — no markdown headers, no bullet points in the letter body
- Professional but human language — never robotic legalese
- 350–500 words
- Proper letter formatting with spacing between sections
- Never invent or use placeholder text like [Address], [City] — use only the information provided
- If company name is not provided, write "the Company"
- Start directly with the date line (use start date year for context)
- End with a signature block for ${args.hiringManagerName || "the Hiring Team"}
- NEVER include square bracket placeholders`;

  try {
    return await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 2500,
      nvidiaFallback: true,
    });
  } catch (err) {
    console.error("[recruit] generateOfferLetter: AI call failed, using template:", err);
    return `Dear ${args.candidateName},\n\nCongratulations! We are pleased to offer you the position of ${args.jobTitle}${args.department ? ` in ${args.department}` : ""} at ${args.companyName || "the Company"}.\n\nRole details:\n- Location: ${args.location}\n- Work Mode: ${args.workMode}\n- Seniority: ${args.seniority}\n- Start Date: ${args.startDate}\n- Compensation: ${args.salaryCurrency} ${args.salary}${template !== "internship" ? " per year" : ""}\n${args.signingBonus ? `- Signing Bonus: ${args.signingBonus}\n` : ""}${args.benefits ? `- Benefits: ${args.benefits}\n` : ""}\nThis offer is subject to standard terms of employment, which will be detailed in your employment agreement.\n\n${args.offerExpiryDate ? `This offer is valid until ${args.offerExpiryDate}. ` : ""}Please confirm your acceptance by replying to this email${args.offerExpiryDate ? "" : " within 5 business days"}.\n\nWe're excited to have you join the team!\n\nBest regards,\n${args.hiringManagerName || "Hiring Team"}`;
  }
}

// Generate or regenerate an offer letter draft
recruitRouter.post("/jobs/:jobId/candidates/:candidateId/offer-letter", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to prepare offers." });
    const job = access.job;

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const {
      startDate, salary, salaryCurrency, signingBonus, benefits, companyName,
      hiringManagerName, reportingManager, offerExpiryDate, template, regenerate,
    } = req.body;

    if (!startDate || !salary) {
      return res.status(400).json({ error: "Start date and salary are required." });
    }

    // Return cached draft unless regenerate is explicitly requested
    if (candidate.offerLetter && candidate.offerStatus && candidate.offerStatus !== "none" && !regenerate) {
      return res.json({
        offerLetter: candidate.offerLetter,
        offerStatus: candidate.offerStatus,
        offerDetails: candidate.offerDetails,
        offerLog: candidate.offerLog,
      });
    }

    const ownerUid = standardBillingOwnerUid(job);
    const letter = await runStandardBillingOperation({
      ownerUid,
      operation: "offer_letter_standard",
      idempotencyKey: standardRequestIdempotencyKey(
        ownerUid,
        "offer-letter",
        standardIdempotencyHeader(req) || standardContentHash(`${candidate._id}:${startDate}:${salary}:${regenerate ? Date.now() : "draft"}`),
      ),
      resourceType: "candidate",
      resourceId: String(candidate._id),
      work: async () => generateOfferLetter({
        candidateName: candidate.name,
        jobTitle: (job as any).title,
        department: (job as any).department,
        location: (job as any).location,
        workMode: (job as any).workMode,
        seniority: (job as any).seniority,
        startDate,
        salary,
        salaryCurrency: salaryCurrency || (job as any).salaryCurrency || "INR",
        template: template || "full_time",
        signingBonus,
        benefits,
        companyName,
        hiringManagerName,
        reportingManager,
        offerExpiryDate,
      }),
    });

    // Persist offer details, letter, and log the generation event
    const details = { startDate, salary, salaryCurrency: salaryCurrency || (job as any).salaryCurrency || "INR", signingBonus, benefits, companyName, hiringManagerName, reportingManager, offerExpiryDate };
    candidate.offerLetter  = letter;
    candidate.offerStatus  = "draft";
    candidate.offerTemplate = template || "full_time";
    candidate.offerDetails  = details as any;
    (candidate.offerLog as any[]).push({ action: "draft_generated", note: regenerate ? "Recruiter regenerated the offer letter draft" : "AI generated offer letter draft", timestamp: new Date() });
    await candidate.save();

    trackEvent("offer_draft_generated", uid, { jobId: req.params.jobId, candidateId: req.params.candidateId, template: template || "full_time" });
    return res.json({ offerLetter: letter, offerStatus: "draft", offerDetails: details, offerLog: candidate.offerLog });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    console.error("[recruit] POST /offer-letter", err);
    return res.status(500).json({ error: err.message });
  }
});

// Save edits to an existing draft — snapshots current content as a version before overwriting
recruitRouter.patch("/jobs/:jobId/candidates/:candidateId/offer-letter", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to edit offers." });
    const { offerLetter, changeSummary } = req.body as { offerLetter: string; changeSummary?: string };
    if (!offerLetter?.trim()) return res.status(400).json({ error: "offerLetter body is required." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    // Snapshot current content as a version before overwriting (only when content actually changed)
    if (candidate.offerLetter?.trim() && candidate.offerLetter.trim() !== offerLetter.trim()) {
      const versions = (candidate.offerVersions as any[]) ?? [];
      const nextNum  = (versions.length ? Math.max(...versions.map((v: any) => v.versionNumber || 0)) : 0) + 1;
      versions.push({
        versionNumber: nextNum,
        content:       candidate.offerLetter,
        template:      candidate.offerTemplate || "full_time",
        details:       candidate.offerDetails  || {},
        editedAt:      new Date(),
        changeSummary: changeSummary || `Version ${nextNum}`,
      });
      candidate.offerVersions = versions as any;
      (candidate.offerLog as any[]).push({ action: "version_saved", note: `Auto-saved version ${nextNum} before edit`, timestamp: new Date() });
    }

    candidate.offerLetter = offerLetter.trim();
    if (!candidate.offerStatus || candidate.offerStatus === "none") candidate.offerStatus = "draft";
    (candidate.offerLog as any[]).push({ action: "offer_edited", note: changeSummary ? `Recruiter edited: ${changeSummary}` : "Recruiter edited the offer letter draft", timestamp: new Date() });
    await candidate.save();

    return res.json({ ok: true, offerLetter: candidate.offerLetter, offerStatus: candidate.offerStatus, offerLog: candidate.offerLog, offerVersions: candidate.offerVersions });
  } catch (err: any) {
    console.error("[recruit] PATCH /offer-letter", err);
    return res.status(500).json({ error: err.message });
  }
});

// Approve and send the offer letter to the candidate (generates secure token for e-sign page)
recruitRouter.post("/jobs/:jobId/candidates/:candidateId/offer-letter/send", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to approve and send offers." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (!candidate.offerLetter?.trim()) return res.status(400).json({ error: "No offer letter draft found. Generate one first." });
    if (!candidate.email?.trim()) return res.status(400).json({ error: "This candidate has no email address on file." });

    const job = access.job;
    const jobTitle    = (job as any)?.title       || "";
    const companyName = (job as any)?.companyName || (candidate.offerDetails as any)?.companyName || "";

    // Generate a secure one-time token for the candidate-facing offer page
    const offerToken = (candidate as any).offerToken || crypto.randomBytes(32).toString("hex");
    (candidate as any).offerToken = offerToken;

    const offerUrl = `${FRONTEND_URL}/recruit/offer/${offerToken}`;

    // Use the link-based email template so candidate gets a review/sign button
    const officialContactEmail = await getCreatorOfficialEmail(uid);
    const payload = emailTemplates.offerEmailWithLink(
      candidate.name, jobTitle, companyName, candidate.offerLetter, offerUrl, { officialContactEmail },
    );
    const ownerUid = standardBillingOwnerUid(job);
    const result  = await runStandardBillingOperation({
      ownerUid,
      operation: "automated_email_standard",
      idempotencyKey: standardIdempotencyKey(ownerUid, ["offer-send", String(candidate._id), offerToken]),
      resourceType: "candidate",
      resourceId: String(candidate._id),
      work: async () => sendEmail({ to: candidate.email!, subject: payload.subject, html: payload.html, text: payload.text, from: NOTIFICATION_FROM }),
    });

    // Log offer_approved + offer_sent in offerLog
    (candidate.offerLog as any[]).push({ action: "offer_approved", note: "Recruiter approved the offer letter", timestamp: new Date() });
    const sentAt = new Date();
    (candidate.offerLog as any[]).push({ action: "offer_sent", note: result.ok ? "Offer email sent to candidate" : `Email delivery failed: ${result.error}`, timestamp: sentAt });

    // Also log in emailLog for the email history panel
    const emailEntry = {
      type: "offer",
      to: candidate.email,
      subject: payload.subject,
      body: payload.text,
      sentAt,
      status: (result.ok ? "sent" : "failed") as "sent" | "failed",
      error: result.error,
    };
    candidate.emailLog.push(emailEntry as any);
    candidate.offerStatus          = "sent";
    (candidate as any).offerCandidateStatus = "pending";

    // Initialise reminder config with sensible defaults (preserves any existing settings)
    if (!(candidate as any).offerReminderConfig) {
      (candidate as any).offerReminderConfig = {
        enabled:       true,
        delayDays:     2,
        frequencyDays: 2,
        maxReminders:  3,
        remindersSent: 0,
      };
    }

    await candidate.save();
    setImmediate(() => recordCollaborationActivity(
      req.params.jobId,
      uid,
      "offer_approved",
      `Approved and sent an offer to ${candidate.name}`,
      {},
      req.params.candidateId,
    ).catch(err => console.error("[collaboration] offer activity failed:", err)));

    trackEvent("offer_sent", uid, { jobId: req.params.jobId, candidateId: req.params.candidateId });

    if (!result.ok) {
      return res.status(502).json({ error: `Email delivery failed: ${result.error}`, offerLog: candidate.offerLog, emailEntry });
    }
    return res.json({ ok: true, sentAt, offerStatus: "sent", offerCandidateStatus: "pending", offerToken, offerUrl, offerLog: candidate.offerLog, emailEntry });
  } catch (err: any) {
    const job = (await getCollaborationAccess(req.params.jobId, getUid(req)))?.job;
    if (await respondStandardBillingError(res, err, standardBillingOwnerUid(job))) return;
    console.error("[recruit] POST /offer-letter/send", err);
    return res.status(500).json({ error: err.message });
  }
});

// Download the offer letter as a PDF
recruitRouter.get("/jobs/:jobId/candidates/:candidateId/offer-letter/pdf", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to download offers." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid }).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (!(candidate as any).offerLetter?.trim()) return res.status(400).json({ error: "No offer letter draft found." });

    const job = access.job;
    const jobTitle = (job as any)?.title || "Offer Letter";

    const filename = `offer-letter-${((candidate as any).name || "candidate").replace(/\s+/g, "-").toLowerCase()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 72, size: "A4" });
    doc.pipe(res);

    // Header
    const company = (candidate as any).offerDetails?.companyName || (job as any)?.companyName || "";
    if (company) {
      doc.fontSize(18).font("Helvetica-Bold").text(company, { align: "center" });
      doc.moveDown(0.4);
    }
    doc.fontSize(13).font("Helvetica-Bold").text(`Offer Letter — ${jobTitle}`, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666666").text(`Prepared for: ${(candidate as any).name}`, { align: "center" });
    doc.moveDown(1.5);

    // Divider
    doc.moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(1);

    // Body
    doc.fontSize(11).font("Helvetica").fillColor("#1a1a1a").text((candidate as any).offerLetter, { lineGap: 4, paragraphGap: 8 });

    // Footer
    doc.moveDown(2);
    doc.moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#888888").text(`Generated by Rolebolt · ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });

    doc.end();
  } catch (err: any) {
    console.error("[recruit] GET /offer-letter/pdf", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// Lightweight poll endpoint — returns offer statuses for all offer/hired stage candidates in one cheap query
recruitRouter.get("/jobs/:jobId/offer-statuses", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "view_candidates");
    if (!access) return res.status(403).json({ error: "You do not have permission to view offer statuses." });
    const candidates = await RecruitCandidate.find(
      { jobId: req.params.jobId, uid: access.job.uid, stage: { $in: ["offer", "hired"] } },
      { _id: 1, offerStatus: 1, offerCandidateStatus: 1, offerDetails: 1, offerLog: 1 }
    ).lean();
    const statuses = candidates.map((c: any) => ({
      _id:                  c._id.toString(),
      offerStatus:          c.offerStatus          || "none",
      offerCandidateStatus: c.offerCandidateStatus || "",
      offerExpiryDate:      c.offerDetails?.offerExpiryDate || "",
      lastLogAction:        c.offerLog?.length ? c.offerLog[c.offerLog.length - 1].action : "",
    }));
    return res.json({ statuses });
  } catch (err: any) {
    console.error("[recruit] GET /offer-statuses", err);
    return res.status(500).json({ error: err.message });
  }
});

// List all saved offer letter versions
recruitRouter.get("/jobs/:jobId/candidates/:candidateId/offer-letter/versions", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to view offer history." });
    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid }).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    return res.json({ versions: (candidate as any).offerVersions || [] });
  } catch (err: any) {
    console.error("[recruit] GET /offer-letter/versions", err);
    return res.status(500).json({ error: err.message });
  }
});

// Restore a specific offer version
recruitRouter.post("/jobs/:jobId/candidates/:candidateId/offer-letter/versions/:versionId/restore", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to restore offer versions." });
    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const versions = (candidate.offerVersions as any[]) ?? [];
    const version  = versions.find((v: any) => v._id?.toString() === req.params.versionId);
    if (!version) return res.status(404).json({ error: "Version not found." });

    // Auto-save current content before restoring so nothing is lost
    if (candidate.offerLetter?.trim()) {
      const nextNum = (versions.length ? Math.max(...versions.map((v: any) => v.versionNumber || 0)) : 0) + 1;
      versions.push({
        versionNumber: nextNum,
        content:       candidate.offerLetter,
        template:      candidate.offerTemplate || "full_time",
        details:       candidate.offerDetails  || {},
        editedAt:      new Date(),
        changeSummary: `Auto-saved before restoring v${version.versionNumber}`,
      });
      candidate.offerVersions = versions as any;
    }

    candidate.offerLetter   = version.content;
    candidate.offerTemplate = version.template || candidate.offerTemplate;
    if (version.details && Object.keys(version.details).length) candidate.offerDetails = version.details;
    if (candidate.offerStatus !== "none" && candidate.offerStatus !== "sent") candidate.offerStatus = "draft";
    (candidate.offerLog as any[]).push({
      action: "version_restored",
      note: `Restored version ${version.versionNumber}: "${version.changeSummary}"`,
      timestamp: new Date(),
    });
    await candidate.save();

    return res.json({ ok: true, offerLetter: candidate.offerLetter, offerStatus: candidate.offerStatus, offerVersions: candidate.offerVersions, offerLog: candidate.offerLog });
  } catch (err: any) {
    console.error("[recruit] POST /offer-letter/versions/restore", err);
    return res.status(500).json({ error: err.message });
  }
});

// Update offer reminder configuration
recruitRouter.patch("/jobs/:jobId/candidates/:candidateId/offer-letter/reminder-config", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to configure offer reminders." });
    const { enabled, delayDays, frequencyDays, maxReminders } = req.body;
    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const cur = (candidate as any).offerReminderConfig || { remindersSent: 0 };
    (candidate as any).offerReminderConfig = {
      enabled:       enabled       !== undefined ? !!enabled       : (cur.enabled       ?? true),
      delayDays:     delayDays     !== undefined ? +delayDays     : (cur.delayDays     ?? 2),
      frequencyDays: frequencyDays !== undefined ? +frequencyDays : (cur.frequencyDays ?? 2),
      maxReminders:  maxReminders  !== undefined ? +maxReminders  : (cur.maxReminders  ?? 3),
      remindersSent:     cur.remindersSent     ?? 0,
      lastReminderSentAt: cur.lastReminderSentAt,
    };
    await candidate.save();
    return res.json({ ok: true, offerReminderConfig: (candidate as any).offerReminderConfig });
  } catch (err: any) {
    console.error("[recruit] PATCH /offer-letter/reminder-config", err);
    return res.status(500).json({ error: err.message });
  }
});

// Extend offer expiry date or reactivate an expired offer
recruitRouter.post("/jobs/:jobId/candidates/:candidateId/offer-letter/extend-expiry", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const access = await getJobWithCollaborationPermission(req.params.jobId, uid, "send_offers");
    if (!access) return res.status(403).json({ error: "You do not have permission to extend offer expiry." });
    const { newExpiryDate, sendNotification = false } = req.body as { newExpiryDate: string; sendNotification?: boolean };

    if (!newExpiryDate?.trim()) return res.status(400).json({ error: "newExpiryDate is required." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid: access.job.uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (!candidate.offerLetter?.trim()) return res.status(400).json({ error: "No offer letter found for this candidate." });
    if (!["sent", "expired"].includes(candidate.offerStatus as string)) {
      return res.status(400).json({ error: "Offer must be in 'sent' or 'expired' state to extend or reactivate." });
    }

    const isReactivating = candidate.offerStatus === "expired";
    const previousExpiry = (candidate.offerDetails as any)?.offerExpiryDate || "";
    const prevStatus     = candidate.offerStatus;

    // Save a version snapshot recording the expiry change
    const versions  = (candidate.offerVersions as any[]) ?? [];
    const nextNum   = (versions.length ? Math.max(...versions.map((v: any) => v.versionNumber || 0)) : 0) + 1;
    versions.push({
      versionNumber: nextNum,
      content:       candidate.offerLetter,
      template:      candidate.offerTemplate || "full_time",
      details:       { ...(candidate.offerDetails || {}), offerExpiryDate: previousExpiry },
      editedAt:      new Date(),
      changeSummary: isReactivating
        ? `Offer reactivated — expiry updated from ${previousExpiry || "none"} to ${newExpiryDate}`
        : `Expiry extended from ${previousExpiry || "none"} to ${newExpiryDate}`,
    });
    candidate.offerVersions = versions as any;

    // Update the expiry date in offerDetails
    candidate.offerDetails = {
      ...(candidate.offerDetails as any || {}),
      offerExpiryDate: newExpiryDate,
    } as any;

    // If reactivating, restore the offer to sent/pending state
    if (isReactivating) {
      candidate.offerStatus = "sent";
      (candidate as any).offerCandidateStatus = "pending";
    }

    // Audit log entry
    const action = isReactivating ? "offer_reactivated" : "offer_expiry_extended";
    const note   = isReactivating
      ? `Offer reactivated by recruiter. Previous expiry: ${previousExpiry || "none"}. New expiry: ${newExpiryDate}`
      : `Expiry extended by recruiter. Previous expiry: ${previousExpiry || "none"}. New expiry: ${newExpiryDate}`;
    (candidate.offerLog as any[]).push({ action, note, timestamp: new Date() });

    // Optional notification email to candidate
    let emailEntry: any = null;
    if (sendNotification && candidate.email?.trim() && (candidate as any).offerToken) {
      const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
      const jobTitle    = (job as any)?.title       || "";
      const companyName = (job as any)?.companyName || (candidate.offerDetails as any)?.companyName || "";
      const offerUrl    = `${FRONTEND_URL}/recruit/offer/${(candidate as any).offerToken}`;
      const formatted   = new Date(newExpiryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const officialContactEmail = await getCreatorOfficialEmail(uid);
      const payload     = emailTemplates.offerExtendedEmail(
        candidate.name, jobTitle, companyName, formatted, offerUrl, isReactivating, { officialContactEmail },
      );
      const result      = await sendEmail({ to: candidate.email, subject: payload.subject, html: payload.html, text: payload.text, from: NOTIFICATION_FROM });
      const sentAt      = new Date();
      (candidate.offerLog as any[]).push({
        action: "offer_extension_notified",
        note:   result.ok ? "Extension notification email sent to candidate" : `Extension email failed: ${result.error}`,
        timestamp: sentAt,
      });
      emailEntry = {
        type: "offer_extension",
        to: candidate.email,
        subject: payload.subject,
        body: payload.text,
        sentAt,
        status: result.ok ? "sent" : "failed",
        error: result.error,
      };
      if (emailEntry) candidate.emailLog.push(emailEntry as any);
    }

    await candidate.save();

    return res.json({
      ok: true,
      isReactivating,
      previousExpiry,
      newExpiry: newExpiryDate,
      offerStatus:          candidate.offerStatus,
      offerCandidateStatus: (candidate as any).offerCandidateStatus,
      offerDetails:         candidate.offerDetails,
      offerLog:             candidate.offerLog,
      offerVersions:        candidate.offerVersions,
      emailEntry,
    });
  } catch (err: any) {
    console.error("[recruit] POST /offer-letter/extend-expiry", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public: candidate views offer by secure token ───────────────────────────

recruitPublicRouter.get("/offer/:token", async (req, res) => {
  try {
    await connectMongo();
    const candidate = await RecruitCandidate.findOne({ offerToken: req.params.token });
    if (!candidate) return res.status(404).json({ error: "Offer not found." });

    // Mark as viewed if this is their first open
    if ((candidate as any).offerCandidateStatus === "pending") {
      (candidate as any).offerCandidateStatus = "viewed";
      (candidate.offerLog as any[]).push({ action: "offer_viewed", note: "Candidate opened the offer link", timestamp: new Date() });
      await candidate.save();
    }

    const job = await RecruitJob.findById(candidate.jobId).lean() as any;
    return res.json({
      offerLetter:          (candidate as any).offerLetter,
      offerStatus:          (candidate as any).offerStatus,
      offerCandidateStatus: (candidate as any).offerCandidateStatus,
      offerDetails:         (candidate as any).offerDetails,
      offerSignature:       (candidate as any).offerSignature,
      candidateName:        candidate.name,
      jobTitle:             job?.title || "",
      companyName:          (candidate as any).offerDetails?.companyName || job?.companyName || "",
    });
  } catch (err: any) {
    console.error("[recruit-public] GET /offer/:token", err);
    return res.status(500).json({ error: err.message });
  }
});

// Candidate accepts or declines the offer (with typed e-signature)
recruitPublicRouter.post("/offer/:token/respond", async (req, res) => {
  try {
    await connectMongo();
    const { response, signerName } = req.body as { response: "accepted" | "declined"; signerName?: string };

    if (!["accepted", "declined"].includes(response)) {
      return res.status(400).json({ error: "response must be 'accepted' or 'declined'." });
    }

    const candidate = await RecruitCandidate.findOne({ offerToken: req.params.token });
    if (!candidate) return res.status(404).json({ error: "Offer not found." });

    const currentStatus = (candidate as any).offerCandidateStatus;
    if (currentStatus === "expired")                              return res.status(410).json({ error: "This offer has expired and can no longer be accepted." });
    if (currentStatus === "accepted" || currentStatus === "declined") return res.status(409).json({ error: "You have already responded to this offer." });

    (candidate as any).offerCandidateStatus = response;

    if (response === "accepted") {
      (candidate as any).offerSignature = {
        signedAt:   new Date(),
        signerName: signerName || candidate.name,
        signerIp:   "",
        method:     "typed",
      };
      (candidate.offerLog as any[]).push({
        action: "offer_accepted",
        note: `Candidate accepted the offer${signerName ? ` (signed as: ${signerName})` : ""}`,
        timestamp: new Date(),
      });
    } else {
      (candidate.offerLog as any[]).push({ action: "offer_declined", note: "Candidate declined the offer", timestamp: new Date() });
    }
    await candidate.save();

    // Phase 4 audit: this is a transactional recruiter notification triggered by a
    // candidate's own action (accept/decline), not creator-initiated automated
    // AI/email work. Left unmetered on purpose — a recruiter must always learn that
    // their candidate responded even if the account's metered access is restricted.
    setImmediate(async () => {
      try {
        const user = await User.findOne({ uid: candidate.uid }).lean() as any;
        if (!user?.email) return;
        const job  = await RecruitJob.findById(candidate.jobId).lean() as any;
        const html = emailTemplates.offerResponseEmail(
          user.name || user.email, candidate.name, job?.title || "", response, signerName,
        );
        await sendEmail({
          to:      user.email,
          subject: `${candidate.name} ${response === "accepted" ? "accepted" : "declined"} the offer — ${job?.title || ""}`,
          html,
          text:    `${candidate.name} has ${response} the offer for ${job?.title || ""}.`,
          from:    NOTIFICATION_FROM,
        });
      } catch (err) {
        console.error("[recruit-public] POST /offer/respond notify error:", err);
      }
    });

    return res.json({ ok: true, response, offerCandidateStatus: response });
  } catch (err: any) {
    console.error("[recruit-public] POST /offer/:token/respond", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Recruiter views a candidate's seeker profile ─────────────────────────────

recruitRouter.get("/jobs/:jobId/candidates/:candidateId/seeker-profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    const candidate = await RecruitCandidate.findOne({
      _id: req.params.candidateId,
      jobId: req.params.jobId,
      uid,
    }).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const seekerProfile = await RecruitSeekerProfile.findOne({ email: candidate.email }).lean();
    return res.json({
      candidate: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        location: candidate.location,
        currentStatus: candidate.currentStatus,
        educationLevel: candidate.educationLevel,
        currentClassYear: candidate.currentClassYear,
        availability: candidate.availability,
        coverLetter: candidate.coverLetter,
        linkedinUrl: candidate.linkedinUrl,
        resumeText: candidate.resumeText || "",
      },
      seekerProfile: seekerProfile ?? null,
    });
  } catch (err: any) {
    console.error("[recruit] GET /seeker-profile", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/uploads/:id", async (req, res) => {
  try {
    await connectMongo();
    const image = await RecruitImage.findById(req.params.id).lean();
    if (!image) return res.status(404).json({ error: "Image not found." });
    res.set("Content-Type", image.contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(image.data.buffer ? Buffer.from(image.data.buffer) : image.data);
  } catch (err: any) {
    console.error("[recruit-public] GET /uploads/:id", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public: job seeker views recruiter profile ────────────────────────────────

recruitPublicRouter.get("/jobs/:jobId/recruiter", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      publicVisibility: { $ne: false },
    }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    const companyProfile = await RecruitCompanyProfile.findOne({ uid: job.uid }).lean();
    const otherJobs = await RecruitJob.find({
      uid: job.uid,
      status: "active",
      publicVisibility: { $ne: false },
      _id: { $ne: job._id },
    })
      .select("_id title niche location workMode jobType seniority freshersAllowed verifiedCompany salaryMin salaryMax salaryCurrency")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    return res.json({
      companyProfile: companyProfile ?? null,
      companyName: job.companyName,
      companyType: job.companyType,
      location: job.location,
      otherJobs,
    });
  } catch (err: any) {
    console.error("[recruit-public] GET /jobs/:jobId/recruiter", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

recruitRouter.get("/jobs/:jobId/export", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const format = (req.query.format as string) || "csv";

    const candidates = await runStandardBillingOperation({
      ownerUid: uid,
      operation: "export_standard",
      idempotencyKey: standardRequestIdempotencyKey(
        uid,
        "export",
        standardIdempotencyHeader(req) || standardContentHash(`${req.params.jobId}:${format}:${new Date().toISOString().slice(0, 13)}`),
      ),
      resourceType: "job",
      resourceId: String(req.params.jobId),
      work: async () => RecruitCandidate.find({ jobId: req.params.jobId, uid })
        .sort({ totalScore: -1 })
        .lean(),
    });

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${job.title.replace(/[^a-z0-9]/gi, "_")}_candidates.json"`);
      return res.json(candidates.map(c => ({
        name: c.name,
        email: c.email,
        phone: c.phone || "",
        stage: c.stage,
        score: c.totalScore,
        maxScore: c.maxScore,
        scorePct: c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : 0,
        hiringDecision: c.hiringDecision || "",
        assessmentStatus: c.assessmentStatus,
        source: c.source || "",
        redFlags: c.redFlags.join("; "),
        strengths: c.strengths.join("; "),
        aiSummary: c.aiSummary,
        notes: c.notes || "",
        addedAt: c.createdAt,
      })));
    }

    // CSV export
    const escape = (val: string | number | undefined) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ["Name", "Email", "Phone", "Stage", "Score", "Max Score", "Score %", "Hiring Decision", "Assessment Status", "Source", "Red Flags", "Strengths", "AI Summary", "Notes", "Added At"];
    const rows = candidates.map(c => [
      c.name,
      c.email,
      c.phone || "",
      c.stage,
      c.totalScore,
      c.maxScore,
      c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : 0,
      c.hiringDecision || "",
      c.assessmentStatus,
      c.source || "",
      c.redFlags.join("; "),
      c.strengths.join("; "),
      c.aiSummary,
      c.notes || "",
      new Date(c.createdAt).toISOString(),
    ].map(escape).join(","));

    const csv = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${job.title.replace(/[^a-z0-9]/gi, "_")}_candidates.csv"`);
    trackEvent("recruiter_export_csv", uid, { jobId: req.params.jobId, candidateCount: candidates.length });
    return res.send(csv);
  } catch (err: any) {
    if (await respondStandardBillingError(res, err, getUid(req))) return;
    console.error("[recruit] GET /export", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Seeker: one-click apply (uses recruit scoring pipeline) ─────────────────

recruitRouter.post("/seeker/jobs/:jobId/apply", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const seekerProfile = await RecruitSeekerProfile.findOne({ uid }).lean() as any;
    if (!seekerProfile) return res.status(400).json({ error: "Please complete your seeker profile before applying." });
    if (!seekerProfile.resumeText) return res.status(400).json({ error: "Please add your resume to your profile before applying." });
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    }).lean() as any;
    if (!job) return res.status(404).json({ error: "Job not found." });
    const existing = await RecruitCandidate.findOne({ jobId: req.params.jobId, email: seekerProfile.email }).lean();
    if (existing) {
      return res.status(409).json({
        error: "DUPLICATE_APPLICATION",
        code: "DUPLICATE_APPLICATION",
        message: "You have already applied to this job.",
      });
    }

    await assertSeekerResourceLimit(uid, "active_applications");

    const scored = await runSeekerBillingOperation({
      uid,
      operation: "job_fit_analysis",
      idempotencyKey: seekerRequestIdempotencyKey(uid, "one-click-apply", req.get("Idempotency-Key")),
      resourceType: "application",
      resourceId: String(job._id),
      work: async () => scoreCandidate({
        resumeText: seekerProfile.resumeText,
        jobTitle: job.title,
        rubric: job.rubric ?? [],
      }),
    });

    const agentMode = job.agentMode ?? {};
    const scorePct = scored.maxScore > 0 ? Math.round((scored.totalScore / scored.maxScore) * 100) : 0;
    const { initialStage, agentAction, shortlistThreshold, rejectThreshold } = computeAgentTriage(
      agentMode,
      scorePct,
      scored.scoringFailed,
    );

    const candidate = await RecruitCandidate.create({
      jobId: req.params.jobId,
      uid: job.uid,
      name: seekerProfile.name,
      email: seekerProfile.email,
      phone: seekerProfile.phone ?? "",
      resumeText: seekerProfile.resumeText,
      totalScore: scored.totalScore,
      maxScore: scored.maxScore,
      scoreBreakdown: scored.scoreBreakdown,
      aiSummary: scored.aiSummary,
      redFlags: scored.redFlags,
      strengths: scored.strengths,
      stage: initialStage,
      stageMovedAt: new Date(),
      assessmentStatus: "not_sent",
      previousResumeScore: scored.totalScore,
      scoringFailed: scored.scoringFailed,
      source: "seeker_profile",
    });

    await RecruitJob.updateOne({ _id: job._id }, { $inc: { candidateCount: 1 } });

    schedulePostIntakeAutomation(
      job,
      candidate,
      agentAction,
      agentAction
        ? {
            job,
            candidateId: String(candidate._id),
            candidateName: candidate.name,
            candidateEmail: seekerProfile.email,
            candidateTotalScore: candidate.totalScore,
            scorePct,
            shortlistThreshold,
            rejectThreshold,
            agentMode,
            logPrefix: "agent-seeker",
          }
        : null,
    );

    return res.status(201).json({ ok: true, candidateId: candidate._id.toString() });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    return res.status(500).json({ error: err.message });
  }
});

// ─── Company Profile ──────────────────────────────────────────────────────────

recruitRouter.get("/company/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const profile = await RecruitCompanyProfile.findOne({ uid }).lean();
    return res.json({ profile: profile ?? null });
  } catch (err: any) {
    console.error("[recruit] GET /company/profile", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.put("/company/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const fields = [
      "profileType", "companyName", "tagline", "companyType", "industry", "companySize", "foundedYear",
      "website", "location", "description", "mission", "benefits",
      "instituteType", "coursesOffered", "affiliationNumber",
      "niche", "registrationNumber",
      "linkedinUrl", "logoUrl", "photoUrl", "bio", "personalLinkedinUrl",
    ];
    const update: Record<string, any> = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) update[f] = String(req.body[f]).trim();
    }
    if (update.profileType && !["company", "educational_institute", "individual", "content_creator", "ngo_government"].includes(update.profileType)) {
      delete update.profileType;
    }
    if (req.body.socialLinks && typeof req.body.socialLinks === "object") {
      const sl = req.body.socialLinks;
      update.socialLinks = {
        instagram: String(sl.instagram || "").trim(),
        twitter: String(sl.twitter || "").trim(),
        github: String(sl.github || "").trim(),
        portfolio: String(sl.portfolio || "").trim(),
      };
    }

    const profile = await RecruitCompanyProfile.findOneAndUpdate(
      { uid },
      { $set: update },
      { returnDocument: "after", upsert: true }
    ).lean();

    return res.json({ profile });
  } catch (err: any) {
    console.error("[recruit] PUT /company/profile", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/company/request-verification", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const profile = await RecruitCompanyProfile.findOne({ uid }).lean();
    if (!profile) return res.status(404).json({ error: "Company profile not found. Please save your company profile first." });
    const hasPresence = Boolean(
      String(profile.website ?? "").trim()
      || String(profile.linkedinUrl ?? "").trim()
      || String(profile.personalLinkedinUrl ?? "").trim()
      || String(profile.socialLinks?.portfolio ?? "").trim(),
    );
    if (!profile.companyName || !profile.description || !hasPresence) {
      return res.status(400).json({ error: "Please complete your company profile (name, description, and website or LinkedIn/portfolio link) before requesting verification." });
    }
    if ((profile as any).verificationStatus === "verified") {
      return res.json({ status: "verified", message: "Your company is already verified." });
    }
    if ((profile as any).verificationStatus === "requested") {
      return res.json({ status: "requested", message: "Your verification request is already under review." });
    }

    const updated = await RecruitCompanyProfile.findOneAndUpdate(
      { uid },
      { $set: { verificationStatus: "requested", verificationRequestedAt: new Date() } },
      { returnDocument: "after" }
    ).lean();

    return res.json({ status: "requested", message: "Verification request submitted. Our team will review within 2–3 business days.", profile: updated });
  } catch (err: any) {
    console.error("[recruit] POST /company/request-verification", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/jobs/:jobId/company", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    }).select("uid companyName companyType location").lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const profile = await RecruitCompanyProfile.findOne({ uid: job.uid }).lean();
    return res.json({
      companyName: job.companyName,
      companyType: job.companyType,
      location: job.location,
      profile: profile ?? null,
    });
  } catch (err: any) {
    console.error("[recruit] GET /jobs/company", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Job Match Analysis (Phase 3 – job seeker AI) ────────────────────────────

async function generateJobMatch(args: {
  job: any;
  skills: string[];
  preferredNiche?: string;
  preferredWorkMode?: string;
  preferredLocation?: string;
  preferredSalaryMin?: number;
  preferredSalaryMax?: number;
  experienceLevel?: string;
  resumeText?: string;
}): Promise<{
  matchScore: number;
  matchReasons: string[];
  missingSkills: string[];
  profileSuggestions: string[];
}> {
  const jobSalary =
    args.job.salaryMin || args.job.salaryMax
      ? `INR ${(args.job.salaryMin ?? 0).toLocaleString("en-IN")}–${(args.job.salaryMax ?? 0).toLocaleString("en-IN")} per year`
      : "Not disclosed";
  const seekerSalary =
    args.preferredSalaryMin || args.preferredSalaryMax
      ? `INR ${(args.preferredSalaryMin ?? 0).toLocaleString("en-IN")}–${(args.preferredSalaryMax ?? 0).toLocaleString("en-IN")}`
      : "Not specified";

  const prompt = `You are a career counselor analyzing how well a job matches a job seeker. Be specific and encouraging.

JOB:
- Title: ${args.job.title}
- Niche: ${args.job.niche || args.job.department || "General"}
- Location: ${args.job.location || "the specified location"}
- Work Mode: ${args.job.workMode || "Not specified"}
- Salary: ${jobSalary}
- Seniority Level: ${(args.job as any).seniority || "Not specified"}
- Freshers Allowed: ${args.job.freshersAllowed ? "Yes" : "No"}
- Must-have skills: ${args.job.mustHaveSkills || "Not specified"}
- Nice-to-have skills: ${args.job.niceToHaveSkills || "Not specified"}

SEEKER PROFILE:
- Skills: ${args.skills.join(", ") || "Not listed"}
- Experience Level: ${args.experienceLevel || "Not specified"}
- Preferred Niche: ${args.preferredNiche || "Any"}
- Preferred Work Mode: ${args.preferredWorkMode || "Any"}
- Preferred Location: ${args.preferredLocation || "Any"}
- Expected Salary: ${seekerSalary}
- Resume Text: ${args.resumeText ? args.resumeText.slice(0, 2000) : "Not provided"}

Analyze the match. Return ONLY this JSON (no markdown):
{
  "matchScore": 72,
  "matchReasons": ["specific reason referencing actual data", "another specific reason"],
  "missingSkills": ["skill genuinely absent from profile"],
  "profileSuggestions": ["specific actionable improvement for this role"]
}

Rules:
- matchScore: 0–100, based on skills overlap, niche/work-mode/location/salary alignment, and experience fit
- matchReasons: 3–5 items, specific to this job+seeker combination, not generic phrases
- missingSkills: only skills listed in job requirements that are genuinely absent (max 5); empty array if none
- profileSuggestions: 2–4 concrete, actionable suggestions to improve their profile or chances for this specific role
- If no resume text, focus on preference and skills matching only`;

  let raw: string;
  try {
    raw = await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.35,
      max_tokens: 2000,
      nvidiaFallback: true,
    });
  } catch (err) {
    console.error("[recruit] generateJobMatch: AI call failed:", err);
    return { matchScore: 0, matchReasons: [], missingSkills: [], profileSuggestions: ["Match analysis is temporarily unavailable — please try again shortly."] };
  }

  const parsed = safeJson(raw);
  if (!parsed) {
    return { matchScore: 0, matchReasons: [], missingSkills: [], profileSuggestions: ["Complete your profile to get personalized match insights."] };
  }

  return {
    matchScore: Math.max(0, Math.min(100, Number(parsed.matchScore) || 0)),
    matchReasons: Array.isArray(parsed.matchReasons) ? parsed.matchReasons.filter((r: any) => typeof r === "string").slice(0, 5) : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.filter((s: any) => typeof s === "string").slice(0, 5) : [],
    profileSuggestions: Array.isArray(parsed.profileSuggestions) ? parsed.profileSuggestions.filter((s: any) => typeof s === "string").slice(0, 4) : [],
  };
}

recruitPublicRouter.post("/jobs/:jobId/match", async (req, res) => {
  try {
    await connectMongo();
    const uid = optionalUidFromAuth(req);
    if (!uid) {
      return res.status(401).json({
        error: "AUTH_REQUIRED_FOR_MATCH",
        code: "AUTH_REQUIRED_FOR_MATCH",
        message: "Sign in to check your match score. This uses your Job Seeker AI quota.",
        upgradeRequired: false,
      });
    }

    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const { skills, preferredNiche, preferredWorkMode, preferredLocation, preferredSalaryMin, preferredSalaryMax, experienceLevel, resumeText } = req.body;

    if (!resumeText?.trim() && (!Array.isArray(skills) || skills.length === 0)) {
      return res.status(400).json({ error: "Provide at least your skills or resume text for match analysis." });
    }

    const result = await runSeekerBillingOperation({
      uid,
      operation: "job_fit_analysis",
      idempotencyKey: seekerRequestIdempotencyKey(
        uid,
        "public-job-match",
        typeof req.headers["idempotency-key"] === "string"
          ? req.headers["idempotency-key"]
          : undefined,
      ),
      resourceType: "job",
      resourceId: String(job._id),
      work: async () => generateJobMatch({
        job,
        skills: Array.isArray(skills) ? skills : [],
        preferredNiche,
        preferredWorkMode,
        preferredLocation,
        preferredSalaryMin: preferredSalaryMin ? Number(preferredSalaryMin) : undefined,
        preferredSalaryMax: preferredSalaryMax ? Number(preferredSalaryMax) : undefined,
        experienceLevel,
        resumeText,
      }),
    });

    return res.json(result);
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, optionalUidFromAuth(req))) return;
    console.error("[recruit] POST /jobs/match", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Report Job ───────────────────────────────────────────────────────────────

recruitPublicRouter.post("/jobs/:jobId/report", async (req, res) => {
  try {
    await connectMongo();
    const { reason, details } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: "Reason is required." });
    const job = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, status: "active", publicVisibility: { $ne: false } },
      { $push: { reports: { reason: String(reason).trim(), details: String(details || "").trim(), reportedAt: new Date() } } },
      { returnDocument: "after" }
    ).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[recruit] POST /jobs/report", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Applications by email (for applied jobs history) ──────────────────────

recruitPublicRouter.get("/my-applications", async (req, res) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    const candidates = await RecruitCandidate.find({ email: new RegExp(`^${email}$`, "i") })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const jobIds = [...new Set(candidates.map(c => c.jobId.toString()))];
    const jobs = await RecruitJob.find({ _id: { $in: jobIds }, publicVisibility: { $ne: false } })
      .select("title companyName location workMode jobType status niche createdAt")
      .lean();
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j._id.toString()] = j;
    const applications = candidates.map(c => ({
      _id: c._id,
      jobId: c.jobId,
      job: jobMap[c.jobId.toString()] ?? null,
      stage: c.stage,
      totalScore: c.totalScore,
      maxScore: c.maxScore,
      assessmentStatus: c.assessmentStatus,
      appliedAt: c.createdAt,
    }));
    return res.json({ applications });
  } catch (err: any) {
    console.error("[recruit] GET /my-applications", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Job Alerts ──────────────────────────────────────────────────────────────

recruitPublicRouter.post("/job-alerts", async (req, res) => {
  try {
    await connectMongo();
    const { email, niche, workMode, keywords, location, freshersOnly, verifiedOnly } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ error: "email required" });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await RecruitJobAlert.findOne({ email: normalizedEmail, niche: niche || "", workMode: workMode || "" });
    if (existing) {
      existing.keywords = keywords || "";
      existing.location = location || "";
      existing.freshersOnly = !!freshersOnly;
      existing.verifiedOnly = !!verifiedOnly;
      await existing.save();
      return res.json({ alert: existing, updated: true });
    }

    const ownerProfile = await RecruitSeekerProfile.findOne({ email: normalizedEmail })
      .select({ uid: 1 })
      .lean()
      .exec();
    if (ownerProfile?.uid) {
      await assertSeekerResourceLimit(ownerProfile.uid, "job_alerts");
    } else {
      const freeLimit = getPlanDefinition("seeker", "free").limits.job_alerts;
      const current = await RecruitJobAlert.countDocuments({ email: normalizedEmail }).exec();
      if (typeof freeLimit === "number" && current + 1 > freeLimit) {
        throw new UsageLimitError({
          reasonCode: "JOB_ALERTS_QUOTA_EXHAUSTED",
          category: "seeker",
          feature: "job_alerts",
          used: current,
          limit: freeLimit,
        });
      }
    }

    const alert = await RecruitJobAlert.create({
      email: normalizedEmail,
      niche: niche || "",
      workMode: workMode || "",
      keywords: keywords || "",
      location: location || "",
      freshersOnly: !!freshersOnly,
      verifiedOnly: !!verifiedOnly,
    });
    return res.status(201).json({ alert });
  } catch (err: any) {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    let billingUid = optionalUidFromAuth(req);
    if (!billingUid && email) {
      const profile = await RecruitSeekerProfile.findOne({ email }).select({ uid: 1 }).lean().exec();
      billingUid = profile?.uid ?? "";
    }
    if (billingUid && await respondSeekerBillingError(res, err, billingUid)) return;
    if (err instanceof UsageLimitError) {
      return res.status(409).json({
        error: "PLAN_LIMIT_REACHED",
        code: err.reasonCode,
        category: "seeker",
        feature: err.feature,
        plan: "free",
        used: err.used,
        limit: err.limit,
        upgradeRequired: true,
        message: "Job alert limit reached for the Free plan. Sign in and upgrade for more alerts.",
      });
    }
    console.error("[recruit] POST /job-alerts", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/job-alerts", async (req, res) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    const alerts = await RecruitJobAlert.find({ email }).sort({ createdAt: -1 }).lean();
    const alertsWithCounts = await Promise.all(
      alerts.map(async (a) => {
        const filter: any = { status: "active", publicVisibility: { $ne: false }, createdAt: { $gt: a.lastCheckedAt } };
        if (a.niche) filter.niche = a.niche;
        if (a.workMode) filter.workMode = a.workMode;
        if (a.freshersOnly) filter.freshersAllowed = true;
        if (a.verifiedOnly) filter.verifiedCompany = true;
        if (a.keywords) {
          const terms = a.keywords.split(/[\s,]+/).map((k: string) => k.trim()).filter(Boolean);
          if (terms.length > 0) {
            const orClauses = terms.flatMap((t: string) => {
              const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
              return [{ title: rx }, { mustHaveSkills: rx }, { companyName: rx }, { location: rx }];
            });
            filter.$or = orClauses;
          }
        }
        if (a.location) filter.location = new RegExp(a.location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const newCount = await RecruitJob.countDocuments(filter);
        return { ...a, newJobCount: newCount };
      })
    );
    return res.json({ alerts: alertsWithCounts });
  } catch (err: any) {
    console.error("[recruit] GET /job-alerts", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/job-alerts/:alertId/jobs", async (req: express.Request, res: express.Response) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    const alert = await RecruitJobAlert.findOne({ _id: req.params.alertId, email });
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    const filter: any = { status: "active", publicVisibility: { $ne: false } };
    if (alert.niche) filter.niche = alert.niche;
    if (alert.workMode) filter.workMode = alert.workMode;
    if (alert.freshersOnly) filter.freshersAllowed = true;
    if (alert.verifiedOnly) filter.verifiedCompany = true;
    if (alert.keywords) {
      const rx = new RegExp(alert.keywords.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { mustHaveSkills: rx }, { companyName: rx }, { location: rx }];
    }
    if (alert.location) filter.location = new RegExp(alert.location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const jobs = await RecruitJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .select("title companyName location workMode jobType salaryMin salaryMax salaryCurrency freshersAllowed verifiedCompany mustHaveSkills createdAt niche")
      .lean();
    alert.lastCheckedAt = new Date();
    await alert.save();
    return res.json({ jobs, alertId: alert._id });
  } catch (err: any) {
    console.error("[recruit] GET /job-alerts/:id/jobs", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.delete("/job-alerts/:alertId", async (req: express.Request, res: express.Response) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    await RecruitJobAlert.deleteOne({ _id: req.params.alertId, email });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[recruit] DELETE /job-alerts/:id", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Recommended Jobs (based on profile or manual prefs) ─────────────────────

recruitPublicRouter.get("/recommended-jobs", async (req: express.Request, res: express.Response) => {
  try {
    await connectMongo();
    const niche = String(req.query.niche ?? "").trim();
    const workMode = String(req.query.workMode ?? "").trim();
    const skills = String(req.query.skills ?? "").trim();
    const location = String(req.query.location ?? "").trim();
    const freshersAllowed = req.query.freshersAllowed === "true";

    const filter: any = { status: "active", publicVisibility: { $ne: false } };
    if (niche) filter.niche = niche;
    if (workMode) filter.workMode = workMode;
    if (freshersAllowed) filter.freshersAllowed = true;
    if (location) filter.location = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (skills) {
      const skillList = skills.split(",").map(s => s.trim()).filter(Boolean);
      if (skillList.length > 0) {
        const rx = skillList.map(s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
        filter.$or = rx.map(r => ({ mustHaveSkills: r }));
      }
    }
    const jobs = await RecruitJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(6)
      .select("title companyName location workMode jobType salaryMin salaryMax salaryCurrency freshersAllowed verifiedCompany mustHaveSkills createdAt niche seniority")
      .lean();
    return res.json({ jobs });
  } catch (err: any) {
    console.error("[recruit] GET /recommended-jobs", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Recruiter: new applicants count since last check ────────────────────────

recruitRouter.get("/jobs/:jobId/new-applicants-count", async (req: express.Request, res: express.Response) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);
    const count = await RecruitCandidate.countDocuments({ jobId: req.params.jobId, createdAt: { $gt: since } });
    return res.json({ count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Pipeline summary for dashboard ─────────────────────────────────────────

// GET /recruit/smtp-verify — auth-protected SMTP connectivity check for the diagnostics page.
recruitRouter.get("/smtp-verify", async (_req: express.Request, res: express.Response) => {
  try {
    const result = await verifySMTP();
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || String(err) });
  }
});

recruitRouter.get("/pipeline-summary", async (req: express.Request, res: express.Response) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const [stageCounts, sourceCounts, formStageCounts, formSourceCounts] = await Promise.all([
      RecruitCandidate.aggregate([
        { $match: { uid } },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),
      RecruitCandidate.aggregate([
        { $match: { uid, source: { $exists: true, $ne: "" } } },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
      RecruitFormResponse.aggregate([
        { $match: { uid } },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),
      RecruitFormResponse.aggregate([
        { $match: { uid } },
        { $group: { _id: { $ifNull: ["$source", "Form"] }, count: { $sum: 1 } } },
      ]),
    ]);

    const stages: Record<string, number> = {};
    for (const s of stageCounts as Array<{ _id: string; count: number }>) {
      stages[s._id] = s.count;
    }
    for (const s of formStageCounts as Array<{ _id: string; count: number }>) {
      const mapped = FORM_STAGE_TO_CANDIDATE_STAGE[s._id];
      if (mapped) stages[mapped] = (stages[mapped] || 0) + s.count;
    }

    const sourceTotals: Record<string, number> = {};
    for (const s of [...sourceCounts, ...formSourceCounts] as Array<{ _id: string; count: number }>) {
      const key = s._id || "Form";
      sourceTotals[key] = (sourceTotals[key] || 0) + s.count;
    }
    const sourceBreakdown = Object.entries(sourceTotals)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const shortlisted = (stages["screened"] || 0) + (stages["assessed"] || 0);
    const interview = stages["interview"] || 0;
    const hired = stages["hired"] || 0;
    const offer = stages["offer"] || 0;
    const total = Object.values(stages).reduce((sum, v) => sum + v, 0);

    return res.json({
      total,
      shortlisted,
      interview,
      hired,
      offer,
      stages,
      sourceBreakdown,
    });
  } catch (err: any) {
    console.error("[recruit] GET /pipeline-summary", err);
    return res.status(500).json({ error: err.message });
  }
});
