import express from "express";
import mongoose from "mongoose";
import { connectMongo } from "./db";
import { RecruitSeekerProfile } from "./models/RecruitSeekerProfile";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitJob } from "./models/RecruitJob";
import { RecruitSeekerWorkspace } from "./models/RecruitSeekerWorkspace";
import { RecruitSeekerTrackerEntry } from "./models/RecruitSeekerTrackerEntry";
import {
  buildUnifiedTracker,
  buildCareerGps,
  trackerEntryDto,
  VALID_TRACKER_STAGES,
} from "./seekerCore";
import { callGeminiChain } from "./ai/geminiClient";
import { callMeshChatCompletions } from "./ai/meshClient";
import { callNvidia } from "./ai/nvidiaClient";
import {
  exportResume,
  resumeFromJson,
  resumeFromPlainText,
  sanitizeFilename,
  RESUME_TEMPLATES,
  type ResumeExportFormat,
  type ResumeJsonInput,
  type ResumeTemplateId,
} from "./resumeExport";
import {
  assertSeekerResourceLimit,
  assertSeekerProposedResourceCount,
  enforceAndSyncSeekerResumeVersion,
  respondSeekerBillingError,
  runSeekerBillingOperation,
  seekerContentHash,
  seekerIdempotencyKey,
  seekerRequestIdempotencyKey,
  seekerIdempotencyHeader,
  isSeekerBillingError,
  isActiveSeekerTrackerStage,
} from "./billing/seekerEnforcement";
import {
  isSeekerMeteredAiPath,
  seekerAiRateLimit,
} from "./billing/security";

export const seekerRouter = express.Router();

seekerRouter.use((req, res, next) => {
  if (!isSeekerMeteredAiPath(req.method, req.path)) return next();
  return seekerAiRateLimit(req, res, next);
});

// Helper: get uid from request (set by requireAuth middleware)
function getUid(req: express.Request): string {
  const uid = (req as any).user?.uid ?? (req as any).user?._id?.toString() ?? (req as any).user?.id?.toString() ?? "";
  return uid;
}

function requireUid(req: express.Request, res: express.Response): string | null {
  const uid = getUid(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return uid;
}

const ACTIVE_TRACKER_STAGES = new Set([
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
]);

// Fallback AI chain
async function callAI(prompt: string): Promise<string> {
  try {
    const r = await callGeminiChain({ prompt });
    if (r) return r;
  } catch (e) { console.error("[seeker-ai] Gemini failed:", e); }
  try {
    const MESH_KEY = process.env.GEMINI_MESH_KEY ?? "";
    const r = await callMeshChatCompletions({ apiKey: MESH_KEY, messages: [{ role: "user", content: prompt }] });
    if (r) return r;
  } catch (e) { console.error("[seeker-ai] Mesh failed:", e); }
  return callNvidia({ messages: [{ role: "user", content: prompt }] });
}

function safeParseJson(text: string): any {
  const t = (text ?? "").trim();
  const attempts = [
    () => JSON.parse(t),
    () => { const m = t.match(/```json\s*([\s\S]*?)```/); return m ? JSON.parse(m[1]) : null; },
    () => { const m = t.match(/```\s*([\s\S]*?)```/);      return m ? JSON.parse(m[1]) : null; },
    () => { const m = t.match(/(\{[\s\S]*\})/);            return m ? JSON.parse(m[1]) : null; },
    () => { const m = t.match(/(\[[\s\S]*\])/);            return m ? JSON.parse(m[1]) : null; },
  ];
  for (const fn of attempts) {
    try { const r = fn(); if (r !== null && r !== undefined) return r; } catch { /* try next */ }
  }
  return null;
}

function cleanHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlMeta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"));
  return match?.[1]?.trim() ?? "";
}

function isSafeExternalUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) return null;
    return url;
  } catch {
    return null;
  }
}

async function extractJobFromUrl(rawUrl: string): Promise<{ title: string; description: string }> {
  const url = isSafeExternalUrl(rawUrl);
  if (!url) throw new Error("Please enter a valid public http or https job URL.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Rolebolt Job Workspace/1.0 (+https://rolebolt.tech)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`The job page returned HTTP ${response.status}.`);
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = cleanHtmlText(
      htmlMeta(html, "og:title") || htmlMeta(html, "twitter:title") || titleMatch?.[1] || ""
    ).slice(0, 240);
    const description = cleanHtmlText(
      htmlMeta(html, "og:description") || htmlMeta(html, "description") || html
    ).slice(0, 30000);
    return { title, description };
  } finally {
    clearTimeout(timeout);
  }
}

function workspaceDto(workspace: any) {
  const analysis = workspace.analysis
    ? {
        ...workspace.analysis,
        analyzedAt: workspace.analysis.analyzedAt?.toISOString?.() ?? workspace.analysis.analyzedAt ?? null,
      }
    : null;
  return {
    id: workspace._id?.toString?.() ?? workspace.id,
    sourceUrl: workspace.sourceUrl ?? "",
    sourceType: workspace.sourceType ?? "manual",
    title: workspace.title ?? "Untitled job",
    companyName: workspace.companyName ?? "",
    location: workspace.location ?? "",
    workMode: workspace.workMode ?? "",
    salaryText: workspace.salaryText ?? "",
    applicationDeadline: workspace.applicationDeadline ?? null,
    jobDescription: workspace.jobDescription ?? "",
    status: workspace.status ?? "saved",
    notes: workspace.notes ?? "",
    analysis,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function clampScore(value: unknown): number {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
}

function workspaceIdIsValid(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeTrackerStage(stage: unknown): string | undefined {
  const s = String(stage || "").toLowerCase();
  const map: Record<string, string> = {
    screened: "screening",
    assessed: "assessment",
    screening: "screening",
    assessment: "assessment",
  };
  const normalized = map[s] || s;
  return VALID_TRACKER_STAGES.includes(normalized as any) ? normalized : undefined;
}

async function buildWorkspaceAnalysis(uid: string, workspaceLike: {
  title?: string;
  companyName?: string;
  location?: string;
  workMode?: string;
  salaryText?: string;
  jobDescription?: string;
}) {
  const profile = await RecruitSeekerProfile.findOne({ uid }).lean() as any;
  const resumeText = String(profile?.resumeText || "").slice(0, 6000);
  const skills = Array.isArray(profile?.skills) ? profile.skills.join(", ") : "";
  const targetRole = profile?.preferredNiche || profile?.headline || "";
  const prompt = `You are a precise career matching analyst. Analyze whether this job is a good fit for the job seeker.

JOB:
Title: ${workspaceLike.title || "Unknown"}
Company: ${workspaceLike.companyName || "Unknown"}
Location: ${workspaceLike.location || "Not specified"}
Work mode: ${workspaceLike.workMode || "Not specified"}
Salary: ${workspaceLike.salaryText || "Not specified"}
Description:
${String(workspaceLike.jobDescription || "").slice(0, 18000)}

SEEKER:
Target area: ${targetRole || "Not specified"}
Skills: ${skills || "Not listed"}
Resume:
${resumeText || "Not provided"}

Return ONLY valid JSON:
{
  "matchScore": 0,
  "matchLabel": "Strong match | Good match | Stretch opportunity | Low match",
  "summary": "One clear, honest sentence for the seeker.",
  "matchReasons": ["specific reason"],
  "strengths": ["specific requirement the seeker appears to meet"],
  "missingSkills": ["specific missing or unclear skill"],
  "profileSuggestions": ["specific action before applying"],
  "salaryInsight": "Brief note about salary fit, or say salary was not provided."
}

Rules:
- Score 0-100 and be conservative when resume details are missing.
- Do not invent experience, salary data, or company facts.
- Keep each array to at most 5 concise items.
- If there is no resume, explain that the score is an initial JD-based estimate in the summary.
- Distinguish a missing skill from a skill that is simply not visible in the resume.`;

  const parsed = safeParseJson(await callAI(prompt));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned an invalid job analysis.");
  }
  const matchScore = clampScore(parsed.matchScore);
  return {
    matchScore,
    matchLabel: String(parsed.matchLabel || (matchScore >= 75 ? "Strong match" : matchScore >= 55 ? "Good match" : "Needs review")),
    summary: String(parsed.summary || "Review this role against your current profile."),
    matchReasons: Array.isArray(parsed.matchReasons) ? parsed.matchReasons.map(String).slice(0, 5) : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 5) : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String).slice(0, 5) : [],
    profileSuggestions: Array.isArray(parsed.profileSuggestions) ? parsed.profileSuggestions.map(String).slice(0, 5) : [],
    salaryInsight: String(parsed.salaryInsight || ""),
    analyzedAt: new Date(),
  };
}

async function analyzeWorkspaceForSeeker(uid: string, workspace: any) {
  const workspaceId = workspace._id?.toString?.() ?? String(workspace._id);
  return runSeekerBillingOperation({
    uid,
    operation: "job_fit_analysis",
    idempotencyKey: seekerRequestIdempotencyKey(uid, "job-fit-workspace"),
    resourceType: "workspace",
    resourceId: workspaceId,
    work: async () => {
      const analysis = await buildWorkspaceAnalysis(uid, workspace);
      workspace.analysis = analysis;
      if (workspace.status === "saved") workspace.status = "analyzed";
      await workspace.save();
      return analysis;
    },
  });
}

function normalizeExtensionJobUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    // Strip common tracking params but keep job-identifying ones
    const keep = new Set(["jk", "vjk", "currentJobId", "gh_jid", "jobId", "id"]);
    for (const key of [...url.searchParams.keys()]) {
      if (!keep.has(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

async function resolveExtensionJobPayload(body: Record<string, string>) {
  const sourceUrl = normalizeExtensionJobUrl(String(body.url || "").trim());
  if (!sourceUrl || !isSafeExternalUrl(sourceUrl)) {
    throw new Error("A valid job page URL is required.");
  }

  let jobDescription = String(body.pageText || "").trim();
  let extractedTitle = String(body.title || "").trim();
  if (!jobDescription || jobDescription.length < 40) {
    try {
      const extracted = await extractJobFromUrl(sourceUrl);
      jobDescription = extracted.description;
      if (!extractedTitle) extractedTitle = extracted.title;
    } catch {
      jobDescription = `Saved from browser extension.\nURL: ${sourceUrl}\nTitle: ${extractedTitle || body.title || "Job posting"}`;
    }
  }

  return {
    sourceUrl,
    title: (extractedTitle || "Saved job").slice(0, 240),
    companyName: String(body.companyName || "").trim().slice(0, 180),
    location: String(body.location || "").trim().slice(0, 120),
    workMode: String(body.workMode || "").trim().slice(0, 60),
    salaryText: String(body.salaryText || "").trim().slice(0, 120),
    jobDescription: jobDescription.slice(0, 30000),
  };
}

// ── GET /recruit/seeker/profile ───────────────────────────────────────────────
seekerRouter.get("/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const profile = await RecruitSeekerProfile.findOne({ uid }).lean();
    return res.json({ profile: profile ?? null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /recruit/seeker/profile ───────────────────────────────────────────────
seekerRouter.put("/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const allowed = [
      "name", "username", "email", "phone", "headline", "bio", "skills",
      "experience", "education", "projects", "certifications", "preferredJobType", "preferredWorkMode",
      "preferredLocation", "preferredSalaryMin", "preferredSalaryMax",
      "preferredNiche", "experienceLevel", "resumeText", "resumeFileName",
      "socialLinks", "photoUrl", "weeklyApplicationGoal", "careerObjective",
    ];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const existing = await RecruitSeekerProfile.findOne({ uid })
      .select({ resumeText: 1, resumeFileName: 1, projects: 1, certifications: 1 })
      .lean()
      .exec();

    // Manual profile edits remain free. Resource capacity gates only capacity growth.
    if (Array.isArray(update.projects)) {
      await assertSeekerProposedResourceCount(uid, "projects", update.projects.length);
    }
    if (Array.isArray(update.certifications)) {
      await assertSeekerProposedResourceCount(uid, "certifications", update.certifications.length);
    }

    const nextResumeText = update.resumeText !== undefined
      ? String(update.resumeText ?? "")
      : existing?.resumeText;
    const nextResumeFileName = update.resumeFileName !== undefined
      ? String(update.resumeFileName ?? "")
      : existing?.resumeFileName;
    if (update.resumeText !== undefined || update.resumeFileName !== undefined) {
      await enforceAndSyncSeekerResumeVersion({
        uid,
        previousResumeText: existing?.resumeText,
        previousResumeFileName: existing?.resumeFileName,
        nextResumeText,
        nextResumeFileName,
        source: "profile_sync",
      });
    }

    const profile = await RecruitSeekerProfile.findOneAndUpdate(
      { uid },
      { $set: update },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ profile });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    return res.status(500).json({ error: err.message });
  }
});

// ── Seeker Universal Job Workspace ────────────────────────────────────────────
// A workspace item can represent any job, including jobs found outside Rolebolt.
seekerRouter.get("/workspace", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const filter: Record<string, any> = { uid };
    if (["saved", "analyzed", "applied", "archived"].includes(status)) filter.status = status;
    const workspaces = await RecruitSeekerWorkspace.find(filter).sort({ updatedAt: -1 }).lean();
    return res.json({ workspaces: workspaces.map(workspaceDto) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

seekerRouter.post("/workspace", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    let {
      sourceUrl = "",
      title = "",
      companyName = "",
      location = "",
      workMode = "",
      salaryText = "",
      jobDescription = "",
      notes = "",
      status = "saved",
    } = req.body as Record<string, string>;

    sourceUrl = String(sourceUrl || "").trim();
    jobDescription = String(jobDescription || "").trim();
    if (!jobDescription && !sourceUrl) {
      return res.status(400).json({ error: "Add a job URL or paste the job description." });
    }
    if (sourceUrl && !isSafeExternalUrl(sourceUrl)) {
      return res.status(400).json({ error: "Please enter a valid public http or https job URL." });
    }

    let extractedTitle = "";
    if (sourceUrl && !jobDescription) {
      try {
        const extracted = await extractJobFromUrl(sourceUrl);
        jobDescription = extracted.description;
        extractedTitle = extracted.title;
      } catch (err: any) {
        return res.status(422).json({
          error: err.message || "We could not read that job page. Paste the job description instead.",
          needsManualDescription: true,
        });
      }
    }
    if (jobDescription.length < 40) {
      return res.status(400).json({ error: "Please provide a fuller job description (at least 40 characters)." });
    }

     await assertSeekerResourceLimit(uid, "workspace_items");
     await assertSeekerResourceLimit(uid, "application_history");
     const normalizedStatus = ["saved", "applied", "archived"].includes(status) ? status : "saved";
     if (normalizedStatus === "applied") {
       await assertSeekerResourceLimit(uid, "active_applications");
     }

    const workspace = await RecruitSeekerWorkspace.create({
      uid,
      sourceUrl,
      sourceType: sourceUrl ? "url" : "manual",
      title: String(title || extractedTitle || "Untitled job").trim().slice(0, 240),
      companyName: String(companyName || "").trim().slice(0, 180),
      location: String(location || "").trim().slice(0, 180),
      workMode: String(workMode || "").trim().slice(0, 80),
      salaryText: String(salaryText || "").trim().slice(0, 180),
      jobDescription: jobDescription.slice(0, 30000),
      notes: String(notes || "").trim().slice(0, 3000),
       status: normalizedStatus,
    });

    let analysisError = "";
    try {
      await analyzeWorkspaceForSeeker(uid, workspace);
    } catch (err: any) {
      if (isSeekerBillingError(err)) {
        analysisError = "Job fit analysis limit reached for this billing period.";
      } else {
        analysisError = err.message || "The job was saved, but AI analysis could not be completed.";
      }
    }
    return res.status(201).json({
      workspace: workspaceDto(workspace),
      analysisError: analysisError || undefined,
    });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] workspace create error:", err);
    return res.status(500).json({ error: err.message });
  }
});

seekerRouter.get("/workspace/:id", async (req, res) => {
  try {
    await connectMongo();
    if (!workspaceIdIsValid(req.params.id)) return res.status(400).json({ error: "Invalid workspace id." });
    const workspace = await RecruitSeekerWorkspace.findOne({ _id: req.params.id, uid: getUid(req) }).lean();
    if (!workspace) return res.status(404).json({ error: "Workspace item not found." });
    return res.json({ workspace: workspaceDto(workspace) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

seekerRouter.patch("/workspace/:id", async (req, res) => {
  try {
    await connectMongo();
    if (!workspaceIdIsValid(req.params.id)) return res.status(400).json({ error: "Invalid workspace id." });
    const uid = getUid(req);
    const allowed = ["title", "companyName", "location", "workMode", "salaryText", "notes", "status"];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
    if (update.status && !["saved", "analyzed", "applied", "archived"].includes(update.status)) {
      return res.status(400).json({ error: "Invalid workspace status." });
    }
    if (update.status === "applied") {
      const current = await RecruitSeekerWorkspace.findOne({ _id: req.params.id, uid })
        .select({ status: 1 })
        .lean()
        .exec();
      if (!current) return res.status(404).json({ error: "Workspace item not found." });
      if (current.status !== "applied") {
        await assertSeekerResourceLimit(uid, "active_applications");
      }
    }
    const workspace = await RecruitSeekerWorkspace.findOneAndUpdate(
      { _id: req.params.id, uid },
      { $set: update },
      { new: true }
    ).lean();
    if (!workspace) return res.status(404).json({ error: "Workspace item not found." });
    return res.json({ workspace: workspaceDto(workspace) });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    return res.status(500).json({ error: err.message });
  }
});

seekerRouter.post("/workspace/:id/analyze", async (req, res) => {
  try {
    await connectMongo();
    if (!workspaceIdIsValid(req.params.id)) return res.status(400).json({ error: "Invalid workspace id." });
    const workspace = await RecruitSeekerWorkspace.findOne({ _id: req.params.id, uid: getUid(req) });
    if (!workspace) return res.status(404).json({ error: "Workspace item not found." });
    const analysis = await analyzeWorkspaceForSeeker(getUid(req), workspace);
    return res.json({ workspace: workspaceDto(workspace), analysis });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] workspace analyze error:", err);
    return res.status(500).json({ error: err.message || "Job analysis failed. Please try again." });
  }
});

seekerRouter.delete("/workspace/:id", async (req, res) => {
  try {
    await connectMongo();
    if (!workspaceIdIsValid(req.params.id)) return res.status(400).json({ error: "Invalid workspace id." });
    const deleted = await RecruitSeekerWorkspace.findOneAndDelete({ _id: req.params.id, uid: getUid(req) });
    if (!deleted) return res.status(404).json({ error: "Workspace item not found." });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /recruit/seeker/applications ─────────────────────────────────────────
// Legacy endpoint — returns Rolebolt applications only (email-based lookup).
seekerRouter.get("/applications", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;

    const tracker = await buildUnifiedTracker(uid);
    const rolebolt = tracker.filter(t => t.source === "rolebolt");

    const applications = rolebolt.map(t => ({
      id: t.candidateId ?? t.id.replace(/^rb-/, ""),
      jobId: t.jobId ?? "",
      jobTitle: t.title,
      companyName: t.companyName,
      location: t.location,
      workMode: t.workMode,
      stage: t.stage,
      totalScore: t.totalScore ?? 0,
      maxScore: t.maxScore ?? 0,
      appliedAt: t.appliedAt,
      stageMovedAt: t.updatedAt ?? null,
      source: "rolebolt" as const,
    }));

    return res.json({ applications });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Universal Application Tracker ─────────────────────────────────────────────
seekerRouter.get("/tracker", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const items = await buildUnifiedTracker(uid);
    return res.json({ items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

seekerRouter.post("/tracker", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;

    const {
      title = "",
      companyName = "",
      location = "",
      workMode = "",
      platform = "other",
      sourceUrl = "",
      stage = "applied",
      appliedAt,
      nextAction = "",
      nextFollowUpAt,
      notes = "",
    } = req.body as Record<string, string>;

    if (!String(title).trim() && !String(companyName).trim()) {
      return res.status(400).json({ error: "Add at least a job title or company name." });
    }
    if (!VALID_TRACKER_STAGES.includes(stage as any)) {
      return res.status(400).json({ error: "Invalid stage." });
    }

    if (ACTIVE_TRACKER_STAGES.has(stage)) {
      await assertSeekerResourceLimit(uid, "active_applications");
    }

    const entry = await RecruitSeekerTrackerEntry.create({
      uid,
      title: String(title).trim().slice(0, 240) || "Untitled role",
      companyName: String(companyName).trim().slice(0, 180),
      location: String(location).trim().slice(0, 180),
      workMode: String(workMode).trim().slice(0, 80),
      platform: String(platform).trim().slice(0, 80) || "other",
      sourceUrl: String(sourceUrl).trim().slice(0, 2000),
      stage,
      appliedAt: appliedAt ? new Date(appliedAt) : stage === "applied" ? new Date() : undefined,
      nextAction: String(nextAction).trim().slice(0, 500),
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      notes: String(notes).trim().slice(0, 3000),
    });

    return res.status(201).json({ entry: trackerEntryDto(entry) });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    return res.status(500).json({ error: err.message });
  }
});

seekerRouter.patch("/tracker/:id", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    if (!workspaceIdIsValid(req.params.id)) return res.status(400).json({ error: "Invalid id." });

    const allowed = ["title", "companyName", "location", "workMode", "platform", "sourceUrl", "stage", "nextAction", "notes"];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
    if (update.stage && !VALID_TRACKER_STAGES.includes(update.stage)) {
      return res.status(400).json({ error: "Invalid stage." });
    }
    if (req.body.appliedAt !== undefined) update.appliedAt = req.body.appliedAt ? new Date(req.body.appliedAt) : null;
    if (req.body.nextFollowUpAt !== undefined) update.nextFollowUpAt = req.body.nextFollowUpAt ? new Date(req.body.nextFollowUpAt) : null;
    if (req.body.lastContactAt !== undefined) update.lastContactAt = req.body.lastContactAt ? new Date(req.body.lastContactAt) : null;

    // Status edits are manual and remain available after AI exhaustion, but
    // moving an inactive entry into the active pipeline consumes capacity.
    // Check the current row first so a normal edit does not spend capacity.
    if (update.stage && ACTIVE_TRACKER_STAGES.has(update.stage)) {
      const current = await RecruitSeekerTrackerEntry.findOne({ _id: req.params.id, uid })
        .select({ stage: 1 })
        .lean()
        .exec();
      if (!current) return res.status(404).json({ error: "Tracker entry not found." });
      if (!ACTIVE_TRACKER_STAGES.has(current.stage)) {
        await assertSeekerResourceLimit(uid, "active_applications");
      }
    }

    const entry = await RecruitSeekerTrackerEntry.findOneAndUpdate(
      { _id: req.params.id, uid },
      { $set: update },
      { new: true }
    ).lean();
    if (!entry) return res.status(404).json({ error: "Tracker entry not found." });
    return res.json({ entry: trackerEntryDto(entry) });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    return res.status(500).json({ error: err.message });
  }
});

seekerRouter.delete("/tracker/:id", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const deleted = await RecruitSeekerTrackerEntry.findOneAndDelete({ _id: req.params.id, uid });
    if (!deleted) return res.status(404).json({ error: "Tracker entry not found." });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Career GPS ────────────────────────────────────────────────────────────────
seekerRouter.get("/career-gps", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const gps = await buildCareerGps(uid);
    return res.json({ gps });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Email Intelligence ────────────────────────────────────────────────────────
seekerRouter.post("/email/parse", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;

    const { emailText, trackerEntryId } = req.body as { emailText?: string; trackerEntryId?: string };
    if (!emailText?.trim() || emailText.trim().length < 20) {
      return res.status(400).json({ error: "Paste the full recruiter email (at least 20 characters)." });
    }

    const prompt = `You are an expert job-search assistant. Parse this recruiter/hiring email and extract structured updates for a job seeker's application tracker.

EMAIL:
${emailText.slice(0, 8000)}

Return ONLY valid JSON:
{
  "companyName": "",
  "jobTitle": "",
  "suggestedStage": "applied|screening|assessment|interview|offer|rejected|ghosted",
  "summary": "One sentence for the seeker",
  "interviewDate": "ISO date string or null",
  "nextAction": "Specific next step for the seeker",
  "followUpDate": "ISO date string or null",
  "subject": "Best guess at email subject"
}

Rules:
- Be conservative — only extract what is clearly stated.
- suggestedStage must reflect the email intent (interview invite → interview, rejection → rejected, etc.)
- interviewDate only if a specific date/time is mentioned
- followUpDate: suggest when to follow up if no response expected`;

    const parsed = safeParseJson(await runSeekerBillingOperation({
      uid,
      operation: "email_intelligence",
      idempotencyKey: seekerIdempotencyKey(uid, [
        "email-intelligence",
        trackerEntryId || seekerContentHash(emailText.trim().slice(0, 500)),
      ]),
      resourceType: "email",
      resourceId: trackerEntryId || undefined,
      work: async () => callAI(prompt),
    }));
    if (!parsed || typeof parsed !== "object") {
      return res.status(500).json({ error: "Could not parse this email. Try pasting the full message." });
    }

    const intel = {
      subject: String(parsed.subject || "").slice(0, 300),
      summary: String(parsed.summary || "Email parsed.").slice(0, 1000),
      suggestedStage: normalizeTrackerStage(parsed.suggestedStage),
      interviewDate: parsed.interviewDate ? new Date(parsed.interviewDate) : undefined,
      nextAction: String(parsed.nextAction || "").slice(0, 500),
      parsedAt: new Date(),
    };

    let entry = null;
    if (trackerEntryId && workspaceIdIsValid(trackerEntryId)) {
      const existingEntry = await RecruitSeekerTrackerEntry.findOne({ _id: trackerEntryId, uid }).lean();
      if (!existingEntry) {
        return res.status(404).json({ error: "Tracker entry not found." });
      }
      const nextStage = intel.suggestedStage || existingEntry.stage;
      if (
        isActiveSeekerTrackerStage(nextStage) &&
        !isActiveSeekerTrackerStage(existingEntry.stage)
      ) {
        await assertSeekerResourceLimit(uid, "active_applications");
      }
      entry = await RecruitSeekerTrackerEntry.findOneAndUpdate(
        { _id: trackerEntryId, uid },
        {
          $push: { emailIntel: intel },
          $set: {
            ...(intel.suggestedStage ? { stage: intel.suggestedStage } : {}),
            ...(parsed.followUpDate ? { nextFollowUpAt: new Date(parsed.followUpDate) } : {}),
            ...(parsed.nextAction ? { nextAction: intel.nextAction } : {}),
            lastContactAt: new Date(),
            ...(parsed.companyName ? { companyName: String(parsed.companyName).slice(0, 180) } : {}),
            ...(parsed.jobTitle ? { title: String(parsed.jobTitle).slice(0, 240) } : {}),
          },
        },
        { new: true }
      ).lean();
    } else if (parsed.companyName || parsed.jobTitle) {
      const createStage = intel.suggestedStage || "applied";
      if (isActiveSeekerTrackerStage(createStage)) {
        await assertSeekerResourceLimit(uid, "active_applications");
      }
      entry = await RecruitSeekerTrackerEntry.create({
        uid,
        title: String(parsed.jobTitle || "Recruiter update").slice(0, 240),
        companyName: String(parsed.companyName || "").slice(0, 180),
        platform: "other",
        stage: createStage,
        sourceUrl: "",
        notes: "Created from Email Intelligence",
        emailIntel: [intel],
        nextAction: intel.nextAction || undefined,
        nextFollowUpAt: parsed.followUpDate ? new Date(parsed.followUpDate) : undefined,
        lastContactAt: new Date(),
      });
    }

    return res.json({
      intel: {
        ...intel,
        interviewDate: intel.interviewDate?.toISOString?.() ?? null,
        parsedAt: intel.parsedAt.toISOString(),
        companyName: parsed.companyName ?? "",
        jobTitle: parsed.jobTitle ?? "",
        followUpDate: parsed.followUpDate ?? null,
      },
      entry: entry ? trackerEntryDto(entry) : null,
    });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] email/parse error:", err);
    return res.status(500).json({ error: err.message || "Email parsing failed." });
  }
});

// ── Extension: analyze job without saving ─────────────────────────────────────
seekerRouter.post("/workspace/extension-analyze", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;

    const payload = await resolveExtensionJobPayload(req.body as Record<string, string>);
    const existing = await RecruitSeekerWorkspace.findOne({ uid, sourceUrl: payload.sourceUrl }).lean();

    const analysis = await runSeekerBillingOperation({
      uid,
      operation: "extension_analysis",
      idempotencyKey: seekerRequestIdempotencyKey(
        uid,
        "extension-analysis",
        seekerIdempotencyHeader(req),
      ),
      resourceType: "extension",
      resourceId: payload.sourceUrl,
      work: async () => buildWorkspaceAnalysis(uid, payload),
    });
    return res.json({
      analysis: {
        ...analysis,
        analyzedAt: analysis.analyzedAt.toISOString(),
      },
      existingWorkspaceId: existing?._id?.toString() ?? null,
      job: payload,
    });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] extension-analyze error:", err);
    return res.status(err.message?.includes("valid job page") ? 400 : 500).json({ error: err.message || "Analysis failed." });
  }
});

// ── Extension: quick-save job from browser ────────────────────────────────────
seekerRouter.post("/workspace/extension-save", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;

    const payload = await resolveExtensionJobPayload(req.body as Record<string, string>);

    let workspace = await RecruitSeekerWorkspace.findOne({ uid, sourceUrl: payload.sourceUrl });
    let created = false;

    if (workspace) {
      workspace.title = payload.title;
      workspace.companyName = payload.companyName;
      workspace.location = payload.location;
      workspace.workMode = payload.workMode;
      workspace.salaryText = payload.salaryText;
      workspace.jobDescription = payload.jobDescription;
      workspace.notes = workspace.notes || "Saved via Rolebolt browser extension";
      await workspace.save();
    } else {
      await assertSeekerResourceLimit(uid, "workspace_items");
      await assertSeekerResourceLimit(uid, "application_history");
      workspace = await RecruitSeekerWorkspace.create({
        uid,
        sourceUrl: payload.sourceUrl,
        sourceType: "url",
        title: payload.title,
        companyName: payload.companyName,
        location: payload.location,
        workMode: payload.workMode,
        salaryText: payload.salaryText,
        jobDescription: payload.jobDescription,
        status: "saved",
        notes: "Saved via Rolebolt browser extension",
      });
      created = true;
    }

    let analysisError = "";
    try {
      await analyzeWorkspaceForSeeker(uid, workspace);
    } catch (err: any) {
      if (isSeekerBillingError(err)) {
        analysisError = "Job fit analysis limit reached for this billing period.";
      } else {
        analysisError = err.message || "Saved, but analysis could not run.";
      }
    }

    return res.status(created ? 201 : 200).json({
      workspace: workspaceDto(workspace),
      analysisError: analysisError || undefined,
      updated: !created,
    });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    return res.status(err.message?.includes("valid job page") ? 400 : 500).json({ error: err.message });
  }
});

// ── GET /recruit/seeker/saved-jobs ────────────────────────────────────────────
seekerRouter.get("/saved-jobs", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const profile = await RecruitSeekerProfile.findOne({ uid }).lean() as any;
    const savedIds: string[] = profile?.savedJobIds ?? [];
    if (!savedIds.length) return res.json({ jobs: [] });

    const jobDocs = await RecruitJob.find({
      _id: { $in: savedIds },
      status: "active",
      publicVisibility: { $ne: false },
    }).lean();
    const jobs = jobDocs.map((j: any) => ({
      id: j._id.toString(),
      title: j.title,
      companyName: j.companyName,
      location: j.location,
      workMode: j.workMode,
      seniority: j.seniority,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      salaryCurrency: j.salaryCurrency,
    }));
    return res.json({ jobs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/jobs/:id/save ────────────────────────────────────────
seekerRouter.post("/jobs/:id/save", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const jobId = req.params.id;
    const job = await RecruitJob.findOne({ _id: jobId, status: "active", publicVisibility: { $ne: false } }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    const existingProfile = await RecruitSeekerProfile.findOne({ uid }).lean() as { savedJobIds?: string[] } | null;
    const alreadySaved = existingProfile?.savedJobIds?.includes(jobId) ?? false;
    if (!alreadySaved) {
      await assertSeekerResourceLimit(uid, "saved_jobs");
    }
    const profile = await RecruitSeekerProfile.findOneAndUpdate(
      { uid },
      { $addToSet: { savedJobIds: jobId } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ ok: true, savedJobIds: (profile as any).savedJobIds });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /recruit/seeker/jobs/:id/save ──────────────────────────────────────
seekerRouter.delete("/jobs/:id/save", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const jobId = req.params.id;
    const profile = await RecruitSeekerProfile.findOneAndUpdate(
      { uid },
      { $pull: { savedJobIds: jobId } },
      { returnDocument: "after" }
    ).lean();
    return res.json({ ok: true, savedJobIds: (profile as any)?.savedJobIds ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/resume/build ─────────────────────────────────────────
seekerRouter.post("/resume/build", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const { answers, targetRole } = req.body as {
      answers: { question: string; answer: string }[];
      targetRole?: string;
    };
    if (!answers?.length) return res.status(400).json({ error: "Answers are required." });

    const qaPairs = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
    const prompt = `You are a professional resume writer specializing in ATS optimization. Based on the following Q&A answers, create a complete, professional resume.

Target Role: ${targetRole || "Not specified"}

Q&A Answers:
${qaPairs}

Return ONLY valid JSON in this exact structure (no markdown, no extra text):
{
  "contactInfo": { "name": "", "email": "", "phone": "", "location": "" },
  "summary": "",
  "experience": [{ "title": "", "company": "", "duration": "", "bullets": [""] }],
  "education": [{ "degree": "", "school": "", "year": "" }],
  "skills": { "technical": [""], "soft": [""] },
  "atsKeywords": [""],
  "atsScore": 85,
  "fullText": ""
}

Rules:
- summary: 2-3 sentences, strong value proposition
- experience bullets: start with action verbs, include metrics where possible
- atsKeywords: 8-12 keywords matching the target role
- atsScore: realistic 0-100 ATS compatibility score
- fullText: plain text version of the full resume (no JSON, just text)`;

    const raw = await runSeekerBillingOperation({
      uid,
      operation: "resume_build",
      idempotencyKey: seekerIdempotencyKey(uid, ["resume-build", seekerContentHash(qaPairs + (targetRole || ""))]),
      work: async () => callAI(prompt),
    });
    const parsed = safeParseJson(raw);

    if (!parsed) {
      return res.status(500).json({ error: "AI failed to generate a structured resume. Please try again." });
    }

    // If fullText is missing, build it from the parts
    if (!parsed.fullText && parsed.contactInfo) {
      const lines: string[] = [];
      lines.push(parsed.contactInfo.name ?? "");
      if (parsed.contactInfo.email) lines.push(parsed.contactInfo.email);
      if (parsed.contactInfo.phone) lines.push(parsed.contactInfo.phone);
      if (parsed.contactInfo.location) lines.push(parsed.contactInfo.location);
      lines.push("\nSUMMARY\n" + (parsed.summary ?? ""));
      if (parsed.experience?.length) {
        lines.push("\nEXPERIENCE");
        for (const e of parsed.experience) {
          lines.push(`${e.title} at ${e.company} (${e.duration})`);
          for (const b of (e.bullets ?? [])) lines.push(`• ${b}`);
        }
      }
      if (parsed.education?.length) {
        lines.push("\nEDUCATION");
        for (const e of parsed.education) lines.push(`${e.degree} — ${e.school} (${e.year})`);
      }
      if (parsed.skills) {
        lines.push("\nSKILLS");
        if (parsed.skills.technical?.length) lines.push("Technical: " + parsed.skills.technical.join(", "));
        if (parsed.skills.soft?.length) lines.push("Soft Skills: " + parsed.skills.soft.join(", "));
      }
      parsed.fullText = lines.join("\n");
    }

    return res.json({ resume: parsed });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] resume/build error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /recruit/seeker/resume/templates ──────────────────────────────────────
seekerRouter.get("/resume/templates", (_req, res) => {
  return res.json({ templates: RESUME_TEMPLATES });
});

// ── POST /recruit/seeker/resume/export ────────────────────────────────────────
seekerRouter.post("/resume/export", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;

    const {
      format = "pdf",
      template = "ats",
      resume,
      resumeText,
      useProfile,
    } = req.body as {
      format?: ResumeExportFormat;
      template?: ResumeTemplateId;
      resume?: ResumeJsonInput;
      resumeText?: string;
      useProfile?: boolean;
    };

    const validFormats: ResumeExportFormat[] = ["pdf", "docx", "txt"];
    const validTemplates: ResumeTemplateId[] = ["ats", "modern", "minimal", "creative"];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: "Invalid format. Use pdf, docx, or txt." });
    }
    if (!validTemplates.includes(template)) {
      return res.status(400).json({ error: "Invalid template." });
    }

    let document;
    if (useProfile) {
      const profile = await RecruitSeekerProfile.findOne({ uid }).lean();
      const text = String(profile?.resumeText ?? "").trim();
      if (!text) return res.status(400).json({ error: "No resume saved on your profile." });
      document = resumeFromPlainText(text, {
        name: profile?.name,
        email: profile?.email,
        phone: profile?.phone,
        location: profile?.preferredLocation,
        linkedin: profile?.socialLinks?.linkedin,
      });
    } else if (resume && (resume.summary || resume.experience?.length || resume.fullText || resume.contactInfo?.name)) {
      document = resumeFromJson(resume);
    } else if (resumeText?.trim()) {
      document = resumeFromPlainText(resumeText.trim());
    } else {
      return res.status(400).json({ error: "Provide resume data, resumeText, or useProfile." });
    }

    const { buffer, mimeType, extension } = await runSeekerBillingOperation({
      uid,
      operation: "export_seeker",
       idempotencyKey: seekerIdempotencyKey(uid, [
        "export",
        format,
        template,
         seekerContentHash(document.summary + (document.fullText ?? "").slice(0, 500)),
      ]),
      work: async () => exportResume(document, format, template),
    });
    const base = sanitizeFilename(document.contactInfo.name || "resume");
    const filename = `${base}_${template}.${extension}`;

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] resume/export error:", err);
    return res.status(500).json({ error: err.message ?? "Export failed." });
  }
});

// ── POST /recruit/seeker/resume/improve ───────────────────────────────────────
seekerRouter.post("/resume/improve", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const { resumeText, targetJobDescription } = req.body as {
      resumeText: string;
      targetJobDescription: string;
    };
    if (!resumeText) return res.status(400).json({ error: "Resume text is required." });
    if (!targetJobDescription) return res.status(400).json({ error: "Job description is required." });

    const prompt = `You are an expert resume coach. Improve this resume to better match the target job description.

CURRENT RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${targetJobDescription}

Return ONLY valid JSON (no markdown, no extra text):
{
  "improvedResume": "full improved resume text here",
  "changes": ["change description 1", "change description 2", "change description 3"],
  "atsScore": 88
}

Rules:
- improvedResume: complete rewritten resume text (plain text, not JSON)
- changes: 3-5 specific improvements made (e.g. "Added Docker to skills section", "Rewrote summary to highlight cloud experience")
- atsScore: estimated ATS score 0-100 after improvements
- Keep the same work history — do not invent new jobs or fake experience
- Add missing keywords from the JD, strengthen action verbs, quantify achievements where possible`;

    const raw = await runSeekerBillingOperation({
      uid,
      operation: "resume_improve",
      idempotencyKey: seekerRequestIdempotencyKey(uid, "resume-improve", req.get("Idempotency-Key")),
      resourceType: "resume",
      work: async () => callAI(prompt),
    });
    const parsed = safeParseJson(raw);

    if (!parsed?.improvedResume) {
      return res.status(500).json({ error: "AI failed to improve the resume. Please try again." });
    }

    return res.json({
      improvedResume: parsed.improvedResume,
      changes: parsed.changes ?? [],
      atsScore: parsed.atsScore ?? 0,
    });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] resume/improve error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/cover-letter/generate ────────────────────────────────
seekerRouter.post("/cover-letter/generate", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const { jobId, jobDescription, resumeText, tone = "professional" } = req.body as {
      jobId?: string;
      jobDescription?: string;
      resumeText: string;
      tone?: "professional" | "enthusiastic" | "concise";
    };
    if (!resumeText) return res.status(400).json({ error: "Resume text is required." });

    let jd = jobDescription ?? "";
    // If jobId provided and no JD text, fetch the JD
    if (jobId && !jd) {
      const job = await RecruitJob.findOne({ _id: jobId, publicVisibility: { $ne: false } }).lean() as any;
      if (job) jd = job.generatedJD || `${job.title} at ${job.companyName}. Required skills: ${job.mustHaveSkills}`;
    }
    if (!jd) return res.status(400).json({ error: "Job description is required." });

    const toneGuide = {
      professional: "formal, polished, and confident. Use precise language and maintain a business-appropriate tone.",
      enthusiastic: "energetic, passionate, and positive. Show genuine excitement about the role and company.",
      concise: "brief, direct, and impactful. Every sentence earns its place — no filler words.",
    }[tone];

    const prompt = `Write a compelling cover letter for this job application.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resumeText}

TONE: ${toneGuide}

Rules:
- Exactly 3 paragraphs: (1) strong hook that references the specific role, (2) why you're the right fit with 2-3 specific examples from the resume, (3) confident CTA
- Under 300 words
- Reference specific skills and requirements from the job description
- Sound human, not robotic
- NEVER start with "I am writing to express my interest"
- Return ONLY the cover letter text (no subject line, no JSON, no markdown)`;

    const coverLetter = await runSeekerBillingOperation({
      uid,
      operation: "cover_letter",
      idempotencyKey: seekerRequestIdempotencyKey(uid, "cover-letter", req.get("Idempotency-Key")),
      resourceType: "cover_letter",
      resourceId: jobId,
      work: async () => callAI(prompt),
    });
    const wordCount = coverLetter.trim().split(/\s+/).length;

    return res.json({ coverLetter: coverLetter.trim(), wordCount });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] cover-letter error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/interview-prep/questions ─────────────────────────────
seekerRouter.post("/interview-prep/questions", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const { jobDescription, difficulty = "mid" } = req.body as {
      jobDescription: string;
      difficulty?: "entry" | "mid" | "senior";
    };
    if (!jobDescription) return res.status(400).json({ error: "Job description is required." });

    const difficultyGuide = {
      entry:  "foundational questions suitable for entry-level candidates (0-2 years experience)",
      mid:    "intermediate questions for mid-level candidates (3-6 years experience)",
      senior: "advanced questions for senior candidates (7+ years experience)",
    }[difficulty];

    const prompt = `You are an expert interview coach. Generate 5 interview questions for this role.

JOB DESCRIPTION:
${jobDescription}

DIFFICULTY LEVEL: ${difficultyGuide}

Return ONLY valid JSON (no markdown, no extra text):
{
  "questions": [
    {
      "id": "q1",
      "question": "Tell me about a time you...",
      "category": "behavioral",
      "tips": "What a strong answer includes: STAR format, specific metrics, team impact"
    }
  ]
}

Include a mix of: behavioral (2), technical (2), situational (1).
Categories: "behavioral" | "technical" | "situational" | "culture"
Make questions specific to the role and skills mentioned in the JD.`;

    const raw = await runSeekerBillingOperation({
      uid,
      operation: "interview_questions",
      idempotencyKey: seekerIdempotencyKey(uid, [
        "interview-questions",
        seekerContentHash(`${jobDescription}\n${difficulty}`),
      ]),
      resourceType: "interview",
      work: async () => callAI(prompt),
    });
    const parsed = safeParseJson(raw);

    if (!parsed?.questions?.length) {
      return res.status(500).json({ error: "Failed to generate interview questions. Please try again." });
    }

    return res.json({ questions: parsed.questions });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] interview-prep/questions error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/profile/optimize ────────────────────────────────────
seekerRouter.post("/profile/optimize", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const { resumeText, targetRole, currentSkills } = req.body as {
      resumeText?: string;
      targetRole?: string;
      currentSkills?: string[];
    };
    if (!resumeText && (!currentSkills?.length)) {
      return res.status(400).json({ error: "Provide resume text or skills to analyze." });
    }

    const skillsList = Array.isArray(currentSkills) ? currentSkills.join(", ") : "";
    const prompt = `You are an expert career coach and recruiter. Analyze this job seeker's profile and give specific, high-impact improvements.

RESUME / PROFILE:
${resumeText ? resumeText.slice(0, 3000) : "Not provided"}

CURRENT SKILLS: ${skillsList || "Not listed"}
TARGET ROLE: ${targetRole || "Not specified"}

Return ONLY valid JSON (no markdown, no extra text):
{
  "profileScore": 72,
  "grade": "B",
  "improvements": [
    {
      "priority": "high",
      "action": "Add TypeScript to your skills",
      "impact": "+23% more matches",
      "howTo": "List TypeScript in your skills section and mention any TypeScript projects"
    }
  ],
  "inDemandSkills": ["Docker", "AWS", "TypeScript"],
  "missingFromProfile": ["AWS", "Docker"],
  "salaryInsight": "Developers with your profile typically earn $85K-$110K"
}

Rules:
- profileScore: 0-100 realistic score based on completeness and market fit
- grade: A/B/C/D/F matching the score
- improvements: 4-6 items ordered by priority (high/medium/low), each with a specific action, measurable impact, and brief howTo
- inDemandSkills: 5-7 skills currently in-demand for the target role
- missingFromProfile: skills from inDemandSkills that are absent from the profile
- salaryInsight: realistic salary range based on the profile (be specific, not generic)
- Be specific and data-driven — reference actual skills/experience from the profile`;

    const raw = await runSeekerBillingOperation({
      uid,
      operation: "profile_optimization",
      idempotencyKey: seekerIdempotencyKey(uid, [
        "profile-optimization",
        seekerContentHash(`${resumeText || ""}\n${skillsList}\n${targetRole || ""}`),
      ]),
      resourceType: "profile",
      work: async () => callAI(prompt),
    });
    const parsed = safeParseJson(raw);

    if (!parsed || typeof parsed.profileScore !== "number") {
      return res.status(500).json({ error: "AI failed to analyze profile. Please try again." });
    }

    return res.json({
      profileScore: Math.max(0, Math.min(100, parsed.profileScore)),
      grade: parsed.grade ?? "C",
      improvements: parsed.improvements ?? [],
      inDemandSkills: parsed.inDemandSkills ?? [],
      missingFromProfile: parsed.missingFromProfile ?? [],
      salaryInsight: parsed.salaryInsight ?? "",
    });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] profile/optimize error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/interview-prep/evaluate ──────────────────────────────
seekerRouter.post("/interview-prep/evaluate", async (req, res) => {
  try {
    await connectMongo();
    const uid = requireUid(req, res);
    if (!uid) return;
    const { question, answer, jobContext } = req.body as {
      question: string;
      answer: string;
      jobContext: string;
    };
    if (!question || !answer) return res.status(400).json({ error: "Question and answer are required." });

    const prompt = `You are an expert interview coach. Evaluate this interview answer.

INTERVIEW QUESTION: ${question}
CANDIDATE ANSWER: ${answer}
JOB CONTEXT: ${jobContext || "Not provided"}

Return ONLY valid JSON (no markdown, no extra text):
{
  "score": 78,
  "grade": "B+",
  "strengths": ["Used concrete example", "Clear structure"],
  "improvements": ["Add a quantifiable outcome", "Mention team impact"],
  "betterAnswer": "Here's how to strengthen the answer: ...",
  "followUpQuestions": ["Can you quantify the business impact?"]
}

Scoring guide:
- 90-100 (A): Exceptional — STAR format, specific metrics, clear impact
- 80-89 (B): Good — solid example, minor gaps in specifics
- 70-79 (C): Average — relevant but vague or missing impact
- 60-69 (D): Below average — lacks structure or specifics
- <60 (F): Needs significant improvement

betterAnswer: 2-3 sentences showing HOW to improve (not a full rewrite)
followUpQuestions: 1-2 natural follow-up questions an interviewer might ask`;

    const raw = await runSeekerBillingOperation({
      uid,
      operation: "interview_evaluation",
      idempotencyKey: seekerIdempotencyKey(uid, [
        "interview-evaluation",
        seekerContentHash(`${question}\n${answer}\n${jobContext || ""}`),
      ]),
      resourceType: "interview",
      work: async () => callAI(prompt),
    });
    const parsed = safeParseJson(raw);

    if (!parsed || typeof parsed.score !== "number") {
      return res.status(500).json({ error: "Failed to evaluate answer. Please try again." });
    }

    return res.json({
      score: parsed.score,
      grade: parsed.grade ?? "C",
      strengths: parsed.strengths ?? [],
      improvements: parsed.improvements ?? [],
      betterAnswer: parsed.betterAnswer ?? "",
      followUpQuestions: parsed.followUpQuestions ?? [],
    });
  } catch (err: any) {
    if (await respondSeekerBillingError(res, err, getUid(req))) return;
    console.error("[seeker] interview-prep/evaluate error:", err);
    return res.status(500).json({ error: err.message });
  }
});
