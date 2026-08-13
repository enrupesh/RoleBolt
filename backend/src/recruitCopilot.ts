/**
 * Recruit Copilot — AI Hiring Copilot ("Ask Rolebolt")
 *
 * Routes:
 *   POST   /recruit/copilot/chat                       — structured JSON response
 *   POST   /recruit/copilot/chat/stream                — SSE streaming response
 *   GET    /recruit/copilot/conversations              — list conversations (sidebar)
 *   GET    /recruit/copilot/conversations/:id          — get full conversation
 *   DELETE /recruit/copilot/conversations/:id          — delete conversation
 *   POST   /recruit/copilot/conversations/:id/clear    — clear messages (keep convo)
 *   GET    /recruit/copilot/starter-actions            — starter action chips by level
 */

import express from "express";
import { RecruitCopilotConversation } from "./models/RecruitCopilotConversation";
import type { ICopilotSource } from "./models/RecruitCopilotConversation";
import { RecruitJob } from "./models/RecruitJob";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitProfile } from "./models/RecruitProfile";
import { RecruitCompanyProfile } from "./models/RecruitCompanyProfile";
import { callMeshChatCompletions, streamMeshChatCompletions } from "./ai/meshClient";
import { buildCopilotPrompt } from "./ai/buildCopilotPrompt";
import type { ChatMessage } from "./ai/meshClient";
import type { GlobalCandidateSummary, FormResponseSummary } from "./ai/buildCopilotPrompt";
import { RecruitForm } from "./models/RecruitForm";
import { RecruitFormResponse } from "./models/RecruitFormResponse";
import { computeGlobalHiringStats, globalStatsToPromptText } from "./ai/globalHiringStats";
import type { JobPipelineStat } from "./ai/globalHiringStats";
import { computeGlobalFormStats, globalFormStatsToPromptText } from "./ai/globalFormStats";
import type { FormPipelineStat } from "./ai/globalFormStats";
import type { CopilotWorkspace } from "./models/RecruitCopilotConversation";
import {
  formIdempotencyHeader,
  formRequestIdempotencyKey,
  respondFormBillingError,
  runFormBillingOperation,
} from "./billing/formEnforcement";
import {
  standardIdempotencyHeader,
  standardRequestIdempotencyKey,
  respondStandardBillingError,
  runStandardBillingOperation,
} from "./billing/standardEnforcement";
import { copilotTurnRateLimit } from "./billing/security";

export const copilotRouter = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

type ApiContext = {
  workspace?: CopilotWorkspace;
  level: string;
  jobId?: string;
  candidateId?: string;
  formId?: string;
  responseId?: string;
};

function inferWorkspace(ctx: ApiContext): CopilotWorkspace {
  if (ctx.workspace === "form" || ctx.workspace === "standard") return ctx.workspace;
  if (ctx.level === "form" || ctx.level.startsWith("form_")) return "form";
  return "standard";
}

function normalizeContext(ctx: ApiContext): ApiContext {
  const workspace = inferWorkspace(ctx);
  // Legacy: level "form" without workspace → form workspace, level stays "form"
  return { ...ctx, workspace };
}

// ─── Structured response types ────────────────────────────────────────────────

interface ParsedAiResponse {
  reply: string;
  recommendation: string;
  confidence: number;
  reasoning: string;
  sources: ICopilotSource[];
  quickActions: string[];
}

/**
 * Parse the AI's JSON response.
 * The AI is instructed to return a JSON object — but as a safety net we
 * attempt to extract a JSON block even if the model wraps it in markdown.
 */
function parseAiResponse(raw: string): ParsedAiResponse {
  const fallback: ParsedAiResponse = {
    reply: raw,
    recommendation: "",
    confidence: 0,
    reasoning: "",
    sources: [],
    quickActions: [],
  };

  function extract(obj: any): ParsedAiResponse | null {
    if (!obj || typeof obj.reply !== "string") return null;
    return {
      reply: obj.reply,
      recommendation: typeof obj.recommendation === "string" ? obj.recommendation : "",
      confidence: typeof obj.confidence === "number" ? Math.min(100, Math.max(0, obj.confidence)) : 0,
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
      sources: Array.isArray(obj.sources) ? obj.sources : [],
      quickActions: Array.isArray(obj.quickActions) ? obj.quickActions : [],
    };
  }

  // 1. Direct parse
  try {
    const result = extract(JSON.parse(raw));
    if (result) return result;
  } catch { /* fall through */ }

  // 2. Markdown code fence
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const result = extract(JSON.parse(fenceMatch[1].trim()));
      if (result) return result;
    } catch { /* fall through */ }
  }

  // 3. Outermost JSON object (greedy — captures full object)
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const result = extract(JSON.parse(objMatch[0]));
      if (result) return result;
    } catch { /* fall through */ }
  }

  // 4. Fallback: return raw text — but if it still looks like JSON, strip it
  if (fallback.reply.trim().startsWith("{") || fallback.reply.trim().startsWith("```")) {
    // Last-ditch: extract anything after "reply": "
    const inlineMatch = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (inlineMatch) {
      try {
        const unescaped = JSON.parse(`"${inlineMatch[1]}"`);
        return { ...fallback, reply: unescaped };
      } catch { /* use fallback */ }
    }
  }

  return fallback;
}

/**
 * Parse the metadata JSON that follows ---ROLEBOLT_META--- in streaming mode.
 */
function parseStreamMeta(metaRaw: string): Omit<ParsedAiResponse, "reply"> {
  const empty: Omit<ParsedAiResponse, "reply"> = {
    recommendation: "",
    confidence: 0,
    reasoning: "",
    sources: [],
    quickActions: [],
  };

  const clean = metaRaw.trim();
  // Strip any markdown code fence the model might add
  const json = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const obj = JSON.parse(json);
    return {
      recommendation: typeof obj.recommendation === "string" ? obj.recommendation : "",
      confidence: typeof obj.confidence === "number" ? Math.min(100, Math.max(0, obj.confidence)) : 0,
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
      sources: Array.isArray(obj.sources) ? obj.sources : [],
      quickActions: Array.isArray(obj.quickActions) ? obj.quickActions : [],
    };
  } catch {
    return empty;
  }
}

/**
 * Attach candidate emails + fit scores to sources, looked up fresh from the
 * database. The AI never sees or generates these — this is the single point
 * where candidate identity (name + email + fit score) is grounded in real
 * data before the response reaches the client. Sources without a
 * matching/known value are left untouched (simply omitted, never invented).
 */
async function attachFormResponseDetails(
  uid: string,
  sources: ICopilotSource[]
): Promise<ICopilotSource[]> {
  const ids = Array.from(
    new Set(
      sources
        .filter(s => s.type === "form_response" || (s.type === "candidate_profile" && !s.jobId))
        .map(s => s.candidateId)
        .filter((id): id is string => !!id)
    )
  );
  if (ids.length === 0) return sources;

  const rows = await RecruitFormResponse.find({ _id: { $in: ids }, uid })
    .select("submittedEmail submittedName aiScore scoringFailed formId")
    .lean();
  const byId = new Map(
    rows.map((r: any) => [
      String(r._id),
      {
        email: r.submittedEmail as string | undefined,
        name: r.submittedName as string | undefined,
        score: r.scoringFailed ? undefined : (r.aiScore as number | undefined),
        formId: String(r.formId),
      },
    ])
  );

  return sources.map(s => {
    if (!s.candidateId) return s;
    const d = byId.get(s.candidateId);
    if (!d) return s;
    return {
      ...s,
      ...(d.email ? { candidateEmail: d.email } : {}),
      ...(d.name ? { candidateName: d.name } : {}),
      ...(d.score !== undefined ? { candidateFitScorePct: d.score } : {}),
      ...(d.formId ? { jobId: d.formId } : {}),
    };
  });
}

async function attachSourceDetails(uid: string, sources: ICopilotSource[], workspace: CopilotWorkspace): Promise<ICopilotSource[]> {
  if (workspace === "form") return attachFormResponseDetails(uid, sources);
  return attachCandidateEmails(uid, sources);
}

async function attachCandidateEmails(
  uid: string,
  sources: ICopilotSource[]
): Promise<ICopilotSource[]> {
  const ids = Array.from(
    new Set(sources.map((s) => s.candidateId).filter((id): id is string => !!id))
  );
  if (ids.length === 0) return sources;

  const candidates = await RecruitCandidate.find({ _id: { $in: ids }, uid })
    .select("email totalScore maxScore")
    .lean();
  const detailsById = new Map(
    candidates.map((c: any) => [
      String(c._id),
      {
        email: c.email as string | undefined,
        fitScorePct:
          typeof c.totalScore === "number" && typeof c.maxScore === "number" && c.maxScore > 0
            ? Math.round((c.totalScore / c.maxScore) * 100)
            : undefined,
      },
    ])
  );

  return sources.map((s) => {
    if (!s.candidateId) return s;
    const details = detailsById.get(s.candidateId);
    if (!details) return s;
    return {
      ...s,
      ...(details.email ? { candidateEmail: details.email } : {}),
      ...(details.fitScorePct !== undefined ? { candidateFitScorePct: details.fitScorePct } : {}),
    };
  });
}

/**
 * Auto-generate a short conversation title from the first user message.
 * Fire-and-forget — never blocks the chat response.
 */
async function generateTitle(firstMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_MESH_KEY;
  if (!apiKey) return firstMessage.slice(0, 60);
  try {
    const raw = await callMeshChatCompletions({
      apiKey,
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate a short, descriptive title (max 6 words) for a recruiter's hiring chat based on their first message. Return ONLY the title — no punctuation, no quotes, no explanation.",
        },
        { role: "user", content: firstMessage },
      ],
      max_tokens: 20,
      temperature: 0.4,
      retries: 1,
      nvidiaFallback: true,
    });
    return raw.trim().replace(/^["']|["']$/g, "").slice(0, 80);
  } catch {
    return firstMessage.slice(0, 60);
  }
}

// ─── Context loader ───────────────────────────────────────────────────────────

interface ContextData {
  job: any | null;
  candidates: any[];
  candidate: any | null;
  recruiterName: string | undefined;
  companyName: string | undefined;
  allJobs?: any[];
  allCandidates?: GlobalCandidateSummary[];
  globalStatsText?: string;
  pipelines?: JobPipelineStat[];
  formResponses?: FormResponseSummary[];
  // Form context
  form?: any | null;
  formDetailedResponses?: any[];
  formResponse?: any | null;
  formGlobalStatsText?: string;
  formPipelines?: FormPipelineStat[];
}

/** Single-applicant fields for form_applicant level */
const FORM_RESPONSE_FULL_SELECT =
  "submittedName submittedEmail formId aiScore aiSummary scoringFailed stage strengths redFlags stageHistory createdAt assessmentStatus assessmentScore assessmentScoringStatus assessmentSummary answers agentLog emailLog notes";

/** Fields needed for org-wide reasoning — deliberately excludes heavy fields
 * (resumeText, assessmentQuestions/Answers, interviewBrief) to keep the
 * global prompt within a sane token budget across potentially many candidates. */
const GLOBAL_CANDIDATE_SELECT =
  "name email jobId totalScore maxScore stage hiringDecision assessmentStatus strengths redFlags scoreBreakdown location availability createdAt stageMovedAt";

/** Same idea for Form Job applicants — excludes resumeText and per-answer detail. */
const GLOBAL_FORM_RESPONSE_SELECT =
  "submittedName submittedEmail formId aiScore scoringFailed stage strengths redFlags createdAt assessmentStatus assessmentScore assessmentScoringStatus";

/** Full fields for a single-form context (deeper — includes question answers for AI reasoning). */
const FORM_RESPONSE_DETAIL_SELECT =
  "submittedName submittedEmail formId aiScore aiSummary scoringFailed stage strengths redFlags stageHistory createdAt assessmentStatus assessmentScore assessmentScoringStatus answers";

async function loadContextData(uid: string, rawContext: ApiContext): Promise<ContextData> {
  const context = normalizeContext(rawContext);
  const workspace = context.workspace!;

  const [profile, companyProfile] = await Promise.all([
    RecruitProfile.findOne({ uid }).lean(),
    RecruitCompanyProfile.findOne({ uid }).lean(),
  ]);

    const recruiterName =
      ((profile as any)?.username || (profile as any)?.name || undefined) as string | undefined;
  const companyName = (companyProfile as any)?.name as string | undefined;

  // ── Form Job workspace ────────────────────────────────────────────────────
  if (workspace === "form") {
    if (context.level === "form_applicant" && context.responseId) {
      const formResponse = await RecruitFormResponse.findOne({ _id: context.responseId, uid })
        .select(FORM_RESPONSE_FULL_SELECT)
        .lean();
      const form = formResponse
        ? await RecruitForm.findOne({ _id: (formResponse as any).formId, uid }).lean()
        : null;
      return {
        job: null, candidates: [], candidate: null, recruiterName, companyName,
        form, formResponse,
      };
    }

    if (context.level === "form" && context.formId) {
      const [form, formDetailedResponses] = await Promise.all([
        RecruitForm.findOne({ _id: context.formId, uid }).lean(),
        RecruitFormResponse.find({ formId: context.formId, uid })
          .select(FORM_RESPONSE_DETAIL_SELECT)
          .sort({ aiScore: -1 })
          .lean(),
      ]);
      return {
        job: null, candidates: [], candidate: null, recruiterName, companyName,
        form, formDetailedResponses: formDetailedResponses ?? [],
      };
    }

    // form_global — all forms, no Standard Job data
    const [allForms, rawFormResponses] = await Promise.all([
      RecruitForm.find({ uid }).sort({ createdAt: -1 }).lean(),
      RecruitFormResponse.find({ uid }).select(GLOBAL_FORM_RESPONSE_SELECT).lean(),
    ]);

    const formTitleById = new Map(allForms.map((f: any) => [String(f._id), f.title as string]));
    const formResponses: FormResponseSummary[] = rawFormResponses.map((r: any) => ({
      _id: r._id,
      name: r.submittedName,
      email: r.submittedEmail,
      formId: r.formId,
      formTitle: formTitleById.get(String(r.formId)) || "Unknown form",
      aiScore: r.aiScore ?? 0,
      scoringFailed: r.scoringFailed,
      stage: r.stage,
      strengths: r.strengths,
      redFlags: r.redFlags,
      submittedAt: r.createdAt,
      assessmentStatus: r.assessmentStatus,
      assessmentScore: r.assessmentScore,
      assessmentScoringStatus: r.assessmentScoringStatus,
    }));

    const { stats, pipelines } = computeGlobalFormStats(allForms as any[], rawFormResponses as any[]);
    const formGlobalStatsText = globalFormStatsToPromptText(stats, pipelines);

    return {
      job: null, candidates: [], candidate: null, recruiterName, companyName,
      allJobs: allForms as any[],
      formResponses,
      formGlobalStatsText,
      formPipelines: pipelines,
    };
  }

  // ── Standard Job workspace ────────────────────────────────────────────────
  if (context.level === "candidate" && context.candidateId) {
    const [candidate, job] = await Promise.all([
      RecruitCandidate.findOne({ _id: context.candidateId, uid }).lean(),
      context.jobId
        ? RecruitJob.findOne({ _id: context.jobId, uid }).lean()
        : Promise.resolve(null),
    ]);
    return { job, candidates: [], candidate, recruiterName, companyName };
  }

  if (context.level === "job" && context.jobId) {
    const [job, candidates] = await Promise.all([
      RecruitJob.findOne({ _id: context.jobId, uid }).lean(),
      RecruitCandidate.find({ jobId: context.jobId, uid })
        .sort({ totalScore: -1 })
        .lean(),
    ]);
    return { job, candidates: candidates ?? [], candidate: null, recruiterName, companyName };
  }

  // Standard global — NO form data
  const [allJobs, rawCandidates] = await Promise.all([
    RecruitJob.find({ uid }).sort({ createdAt: -1 }).lean(),
    RecruitCandidate.find({ uid }).select(GLOBAL_CANDIDATE_SELECT).lean(),
  ]);

  const jobTitleById = new Map(allJobs.map((j: any) => [String(j._id), j.title as string]));
  const allCandidates: GlobalCandidateSummary[] = rawCandidates.map((c: any) => ({
    _id: c._id,
    name: c.name,
    email: c.email,
    jobId: c.jobId,
    jobTitle: jobTitleById.get(String(c.jobId)) || "Unknown role",
    totalScore: c.totalScore,
    maxScore: c.maxScore,
    stage: c.stage,
    hiringDecision: c.hiringDecision,
    assessmentStatus: c.assessmentStatus,
    strengths: c.strengths,
    location: c.location,
    availability: c.availability,
  }));

  const { stats, pipelines } = buildGlobalStatsAndPipelines(allJobs, rawCandidates);
  const globalStatsText = globalStatsToPromptText(stats, pipelines);

  return {
    job: null,
    candidates: [],
    candidate: null,
    recruiterName,
    companyName,
    allJobs,
    allCandidates,
    globalStatsText,
    pipelines,
  };
}

/** Shared helper: compute stats + per-job pipeline breakdown from raw docs. */
function buildGlobalStatsAndPipelines(allJobs: any[], rawCandidates: any[]) {
  const stats = computeGlobalHiringStats(allJobs, rawCandidates);
  // computeGlobalHiringStats already derives pipelines internally for topPipeline/weakestPipeline,
  // but we also want the full per-job list for the prompt — recompute lightly here.
  const byJob = new Map<string, any[]>();
  for (const c of rawCandidates) {
    const key = String(c.jobId);
    (byJob.get(key) ?? byJob.set(key, []).get(key)!).push(c);
  }
  const pipelines: JobPipelineStat[] = allJobs.map((j: any) => {
    const list = byJob.get(String(j._id)) ?? [];
    const scored = list.filter((c: any) => c.maxScore > 0);
    const avg = scored.length
      ? Math.round(
          scored.reduce((s: number, c: any) => s + Math.round((c.totalScore / c.maxScore) * 100), 0) /
            scored.length
        )
      : null;
    return {
      jobId: String(j._id),
      title: j.title,
      department: j.department,
      candidateCount: list.length,
      avgScorePct: avg,
    };
  });
  return { stats, pipelines };
}

// ─── Starter actions ──────────────────────────────────────────────────────────

const STARTER_ACTIONS: Record<string, string[]> = {
  job: [
    "Who should I interview first?",
    "Compare top candidates",
    "Recommend top 5",
    "Generate interview questions",
    "Show missing skills",
    "Who can join immediately?",
    "Which candidates have red flags?",
    "Draft a shortlist email",
  ],
  candidate: [
    "Summarize this candidate",
    "What are their strengths and weaknesses?",
    "Should I hire this candidate?",
    "Generate interview questions",
    "What skills are missing compared to the JD?",
    "Compare with another candidate",
    "Draft an interview invite",
  ],
  global: [
    "What should I prioritize today?",
    "Show my strongest candidates",
    "Which jobs need attention?",
    "Show hiring bottlenecks",
    "Compare all active jobs",
    "Search my talent pool",
    "Which candidates are stuck in a stage?",
    "Where should I focus my time this week?",
  ],
  form: [
    "Who are the top applicants for this form?",
    "Which applicants should I shortlist?",
    "Summarize the overall applicant quality",
    "Which applicants have red flags?",
    "Who answered the questions most thoroughly?",
    "Which applicants are stuck in a stage?",
    "How is our assessment completion rate?",
    "Which stage has the most dropoff?",
  ],
  form_global: [
    "What should I prioritize across my forms today?",
    "Which form has the strongest applicants?",
    "Show applicants stuck in review",
    "Compare my active forms",
    "Who are my top 5 applicants overall?",
    "Which forms need more sharing?",
    "Assessment completion across all forms",
    "Where are applicants dropping off?",
  ],
  form_applicant: [
    "Summarize this applicant",
    "Should I shortlist them?",
    "What are their strengths and weaknesses?",
    "How did they answer the key questions?",
    "Compare to other applicants on this form",
    "What stage should they move to next?",
    "Draft a shortlist email",
    "Any red flags I should know about?",
  ],
};

// ─── Shared: build AI message history ────────────────────────────────────────

function buildMessageHistory(
  systemPrompt: string,
  conversation: any,
  userMessage: string
): ChatMessage[] {
  const recent = conversation.messages.slice(-20);
  return [
    { role: "system", content: systemPrompt },
    ...recent.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];
}

// ─── Shared: persist messages + update metadata ───────────────────────────────

async function persistExchange(
  conversation: any,
  userMessage: string,
  parsed: ParsedAiResponse,
  isNew: boolean,
  job: any | null,
  candidate: any | null = null,
  form: any | null = null,
  formResponse: any | null = null,
): Promise<void> {
  const now = new Date();

  conversation.messages.push(
    {
      role: "user",
      content: userMessage,
      sources: [],
      quickActions: [],
      timestamp: now,
    },
    {
      role: "assistant",
      content: parsed.reply,
      recommendation: parsed.recommendation || undefined,
      confidence: parsed.confidence || undefined,
      reasoning: parsed.reasoning || undefined,
      sources: parsed.sources,
      quickActions: parsed.quickActions,
      timestamp: now,
    }
  );

  conversation.lastActiveAt = now;
  conversation.totalMessages = conversation.messages.length;

  if (job) {
    conversation.selectedJobId = String(job._id);
    conversation.selectedJobTitle = job.title;
  }

  if (candidate) {
    conversation.selectedCandidateId = String(candidate._id);
    conversation.selectedCandidateName = candidate.name;
  }

  if (form) {
    conversation.selectedFormId = String(form._id);
    conversation.selectedFormTitle = form.title;
  }

  if (formResponse) {
    conversation.selectedResponseId = String(formResponse._id);
    conversation.selectedResponseName = formResponse.submittedName || "Applicant";
  }

  await conversation.save();

  // Auto-title: fire and forget after first exchange
  if (isNew || conversation.title === "New conversation") {
    setImmediate(async () => {
      try {
        const title = await generateTitle(userMessage);
        await RecruitCopilotConversation.updateOne(
          { _id: conversation._id },
          { $set: { title } }
        );
      } catch { /* silent */ }
    });
  }
}

function buildPromptFromContext(context: ApiContext, data: ContextData, mode: "json" | "stream", syntheticInstruction?: string) {
  const ctx = normalizeContext(context);
  return buildCopilotPrompt({
    level: ctx.level as any,
    mode,
    recruiterName: data.recruiterName,
    companyName: data.companyName,
    job: data.job ?? undefined,
    candidates: data.candidates ?? undefined,
    candidate: data.candidate ?? undefined,
    form: data.form ?? undefined,
    formDetailedResponses: data.formDetailedResponses ?? undefined,
    formResponse: data.formResponse ?? undefined,
    allJobs: data.allJobs,
    allCandidates: data.allCandidates,
    globalStats: data.globalStatsText,
    formGlobalStats: data.formGlobalStatsText,
    pipelines: data.pipelines,
    formPipelines: data.formPipelines,
    formResponses: data.formResponses,
    syntheticInstruction,
  });
}

function validateContext(context: ApiContext, data: ContextData): string | null {
  const ctx = normalizeContext(context);
  if (ctx.workspace === "standard") {
    if (ctx.level === "job" && ctx.jobId && !data.job) return "Job not found";
    if (ctx.level === "candidate" && ctx.candidateId && !data.candidate) return "Candidate not found";
  } else {
    if (ctx.level === "form" && ctx.formId && !data.form) return "Form not found";
    if (ctx.level === "form_applicant" && ctx.responseId && !data.formResponse) return "Applicant not found";
  }
  return null;
}

// ─── POST /recruit/copilot/chat ───────────────────────────────────────────────

copilotRouter.post("/chat", copilotTurnRateLimit, async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const {
    message,
    context: rawContext,
    conversationId,
  }: {
    message: string;
    context: ApiContext;
    conversationId?: string;
  } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: "message is required" });
  if (!rawContext?.level) return res.status(400).json({ error: "context.level is required" });
  const context = normalizeContext(rawContext);

  const apiKey = process.env.GEMINI_MESH_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured (GEMINI_MESH_KEY missing)" });

  try {
    let conversation = conversationId
      ? await RecruitCopilotConversation.findOne({ _id: conversationId, uid })
      : null;
    const isNew = !conversation;

    if (!conversation) {
      conversation = await RecruitCopilotConversation.create({
        uid,
        context: {
          workspace: context.workspace,
          level: context.level as any,
          jobId: context.jobId,
          candidateId: context.candidateId,
          formId: context.formId,
          responseId: context.responseId,
        },
        title: "New conversation",
        messages: [],
      });
    }

    const data = await loadContextData(uid, context);
    const err = validateContext(context, data);
    if (err) return res.status(404).json({ error: err });

    const systemPrompt = buildPromptFromContext(context, data, "json");

    const aiMessages = buildMessageHistory(systemPrompt, conversation, message.trim());

    const runAi = async () => callMeshChatCompletions({
      apiKey,
      model: "openai/gpt-4o-mini",
      fallbackModels: ["google/gemini-2.5-flash-lite", "anthropic/claude-3-5-sonnet"],
      messages: aiMessages,
      max_tokens: 2000,
      temperature: 0.5,
      retries: 2,
      timeoutMs: 60_000,
      nvidiaFallback: true,
    });

    // Phase 2: Form Job workspace turns. Phase 3: Standard Jobs workspace turns.
    const rawAi = context.workspace === "form"
      ? await runFormBillingOperation({
          ownerUid: uid,
          operation: "copilot_turn_form",
          idempotencyKey: formRequestIdempotencyKey(
            uid,
            `copilot-chat:${context.level}:${context.formId || "global"}:${conversation._id}`,
            formIdempotencyHeader(req),
          ),
          resourceType: "form",
          resourceId: context.formId || String(conversation._id),
          work: runAi,
        })
      : await runStandardBillingOperation({
          ownerUid: uid,
          operation: "copilot_turn_standard",
          idempotencyKey: standardRequestIdempotencyKey(
            uid,
            `copilot-chat:${context.level}:${context.jobId || "global"}:${conversation._id}`,
            standardIdempotencyHeader(req),
          ),
          resourceType: "job",
          resourceId: context.jobId || String(conversation._id),
          work: runAi,
        });

    const parsed = parseAiResponse(rawAi);
    parsed.sources = await attachSourceDetails(uid, parsed.sources, context.workspace!);

    await persistExchange(
      conversation, message.trim(), parsed, isNew,
      data.job, data.candidate, data.form, data.formResponse,
    );

    return res.status(200).json({
      conversationId: String(conversation._id),
      reply: parsed.reply,
      recommendation: parsed.recommendation,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      sources: parsed.sources,
      quickActions: parsed.quickActions,
      title: conversation.title,
    });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, uid)) return;
    if (await respondStandardBillingError(res, err, uid)) return;
    console.error("[copilot] chat error:", err?.message ?? err);
    return res.status(500).json({ error: "AI Copilot request failed. Please try again." });
  }
});

// ─── POST /recruit/copilot/chat/stream ───────────────────────────────────────
//
// SSE streaming endpoint. The AI first writes the reply naturally (tokens are
// forwarded immediately to the client), then outputs the sentinel
// ---ROLEBOLT_META--- followed by a JSON block containing recommendation,
// confidence, reasoning, sources, and quickActions.
//
// SSE event types emitted:
//   { type: "token",    token: string }
//   { type: "done",     conversationId, recommendation, confidence, reasoning, sources, quickActions, title }
//   { type: "error",    error: string }

const STREAM_SENTINEL = "---ROLEBOLT_META---";

copilotRouter.post("/chat/stream", copilotTurnRateLimit, async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const {
    message,
    context: rawContext,
    conversationId,
  }: {
    message: string;
    context: ApiContext;
    conversationId?: string;
  } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: "message is required" });
  if (!rawContext?.level) return res.status(400).json({ error: "context.level is required" });
  const context = normalizeContext(rawContext);

  const apiKey = process.env.GEMINI_MESH_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured" });

  const meterFormTurn = context.workspace === "form";
  const meterStandardTurn = context.workspace === "standard";
  const meterTurn = meterFormTurn || meterStandardTurn;
  let sseStarted = false;

  function beginSse() {
    if (sseStarted) return;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    sseStarted = true;
  }

  function sendEvent(data: Record<string, unknown>) {
    beginSse();
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    let conversation = conversationId
      ? await RecruitCopilotConversation.findOne({ _id: conversationId, uid })
      : null;
    const isNew = !conversation;

    if (!conversation) {
      conversation = await RecruitCopilotConversation.create({
        uid,
        context: {
          workspace: context.workspace,
          level: context.level as any,
          jobId: context.jobId,
          candidateId: context.candidateId,
          formId: context.formId,
          responseId: context.responseId,
        },
        title: "New conversation",
        messages: [],
      });
    }

    const data = await loadContextData(uid, context);
    const err = validateContext(context, data);
    if (err) {
      if (meterTurn && !sseStarted) {
        return res.status(404).json({ error: err });
      }
      sendEvent({ type: "error", error: err });
      return res.end();
    }

    const systemPrompt = buildPromptFromContext(context, data, "stream");
    const aiMessages = buildMessageHistory(systemPrompt, conversation, message.trim());

    const runStreamedTurn = async () => {
      // Headers start only after a successful reserve for Form Job turns.
      beginSse();

      let fullText = "";
      let sentinelFound = false;
      let emittedUpTo = 0;
      const SENTINEL_LEN = STREAM_SENTINEL.length;

      for await (const token of streamMeshChatCompletions({
        apiKey,
        model: "openai/gpt-4o-mini",
        messages: aiMessages,
        max_tokens: 2500,
        temperature: 0.5,
        timeoutMs: 90_000,
      })) {
        fullText += token;

        const sentinelIdx = fullText.indexOf(STREAM_SENTINEL);
        if (sentinelIdx !== -1) {
          if (sentinelIdx > emittedUpTo) {
            sendEvent({ type: "token", token: fullText.slice(emittedUpTo, sentinelIdx) });
          }
          sentinelFound = true;
          break;
        }

        const safeUpTo = Math.max(emittedUpTo, fullText.length - SENTINEL_LEN);
        if (safeUpTo > emittedUpTo) {
          sendEvent({ type: "token", token: fullText.slice(emittedUpTo, safeUpTo) });
          emittedUpTo = safeUpTo;
        }
      }

      if (!sentinelFound && emittedUpTo < fullText.length) {
        sendEvent({ type: "token", token: fullText.slice(emittedUpTo) });
      }

      const sentinelIdx = fullText.indexOf(STREAM_SENTINEL);
      const replyText = sentinelFound
        ? fullText.slice(0, sentinelIdx).trim()
        : fullText.trim();
      const metaRaw = sentinelFound
        ? fullText.slice(sentinelIdx + STREAM_SENTINEL.length)
        : "";

      const meta = parseStreamMeta(metaRaw);
      const parsed: ParsedAiResponse = { reply: replyText, ...meta };
      parsed.sources = await attachSourceDetails(uid, parsed.sources, context.workspace!);

      await persistExchange(
        conversation!, message.trim(), parsed, isNew,
        data.job, data.candidate, data.form, data.formResponse,
      );

      sendEvent({
        type: "done",
        conversationId: String(conversation!._id),
        recommendation: parsed.recommendation,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        sources: parsed.sources,
        quickActions: parsed.quickActions,
        title: conversation!.title,
      });
      return parsed;
    };

    // Phase 4 verified: entitlement + reservation happen here at execution time,
    // before any SSE bytes are written. Queued/streamed copilot turns for an owner
    // who downgraded / cancelled / went past_due are blocked at the reserve step
    // (fail closed), so no new AI streams start without a committed reservation.
    if (meterFormTurn) {
      // Critical: reserve BEFORE SSE headers so capacity errors remain JSON.
      await runFormBillingOperation({
        ownerUid: uid,
        operation: "copilot_turn_form",
        idempotencyKey: formRequestIdempotencyKey(
          uid,
          `copilot-stream:${context.level}:${context.formId || "global"}:${conversation._id}`,
          formIdempotencyHeader(req),
        ),
        resourceType: "form",
        resourceId: context.formId || String(conversation._id),
        work: runStreamedTurn,
      });
    } else if (meterStandardTurn) {
      // Critical: reserve BEFORE SSE headers so capacity errors remain JSON.
      await runStandardBillingOperation({
        ownerUid: uid,
        operation: "copilot_turn_standard",
        idempotencyKey: standardRequestIdempotencyKey(
          uid,
          `copilot-stream:${context.level}:${context.jobId || "global"}:${conversation._id}`,
          standardIdempotencyHeader(req),
        ),
        resourceType: "job",
        resourceId: context.jobId || String(conversation._id),
        work: runStreamedTurn,
      });
    } else {
      await runStreamedTurn();
    }

    return res.end();
  } catch (err: any) {
    if (!sseStarted && await respondFormBillingError(res, err, uid)) return;
    if (!sseStarted && await respondStandardBillingError(res, err, uid)) return;
    console.error("[copilot] stream error:", err?.message ?? err);
    if (!sseStarted) {
      return res.status(500).json({ error: "AI Copilot stream failed. Please try again." });
    }
    sendEvent({ type: "error", error: "AI Copilot stream failed. Please try again." });
    return res.end();
  }
});

// ─── GET /recruit/copilot/conversations ──────────────────────────────────────

copilotRouter.get("/conversations", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const workspaceFilter = req.query.workspace as string | undefined;
    const query: Record<string, unknown> = { uid };
    if (workspaceFilter === "form") {
      query.$or = [
        { "context.workspace": "form" },
        { "context.level": { $in: ["form", "form_global", "form_applicant"] } },
      ];
    } else if (workspaceFilter === "standard") {
      query.$or = [
        { "context.workspace": "standard" },
        { "context.level": { $in: ["global", "job", "candidate"] } },
        { "context.workspace": { $exists: false }, "context.level": { $nin: ["form", "form_global", "form_applicant"] } },
      ];
    }

    const conversations = await RecruitCopilotConversation.find(query)
      .sort({ lastActiveAt: -1 })
      .limit(50)
      .select("title context selectedJobId selectedJobTitle selectedCandidateId selectedCandidateName selectedFormId selectedFormTitle selectedResponseId selectedResponseName lastActiveAt totalMessages messages createdAt updatedAt")
      .lean();

    const result = conversations.map((c) => {
      const lastMsg = c.messages[c.messages.length - 1] ?? null;
      return {
        id: String(c._id),
        title: c.title,
        context: c.context,
        selectedJobId: c.selectedJobId,
        selectedJobTitle: c.selectedJobTitle,
        selectedCandidateId: (c as any).selectedCandidateId,
        selectedCandidateName: (c as any).selectedCandidateName,
        selectedFormId: (c as any).selectedFormId,
        selectedFormTitle: (c as any).selectedFormTitle,
        selectedResponseId: (c as any).selectedResponseId,
        selectedResponseName: (c as any).selectedResponseName,
        lastActiveAt: c.lastActiveAt,
        totalMessages: c.totalMessages ?? c.messages.length,
        lastMessage: lastMsg
          ? { role: lastMsg.role, preview: lastMsg.content.slice(0, 120) }
          : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return res.json({ conversations: result });
  } catch (err: any) {
    console.error("[copilot] list conversations error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to load conversations" });
  }
});

// ─── GET /recruit/copilot/conversations/:id ───────────────────────────────────

copilotRouter.get("/conversations/:id", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const conversation = await RecruitCopilotConversation.findOne({
      _id: req.params.id,
      uid,
    }).lean();

    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    return res.json({
      id: String(conversation._id),
      title: conversation.title,
      context: conversation.context,
      selectedJobId: conversation.selectedJobId,
      selectedJobTitle: conversation.selectedJobTitle,
      selectedCandidateId: (conversation as any).selectedCandidateId,
      selectedCandidateName: (conversation as any).selectedCandidateName,
      lastActiveAt: conversation.lastActiveAt,
      totalMessages: conversation.totalMessages ?? conversation.messages.length,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      starterActions:
        conversation.messages.length === 0
          ? (STARTER_ACTIONS[conversation.context.level] ?? [])
          : [],
    });
  } catch (err: any) {
    console.error("[copilot] get conversation error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to load conversation" });
  }
});

// ─── DELETE /recruit/copilot/conversations/:id ────────────────────────────────

copilotRouter.delete("/conversations/:id", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await RecruitCopilotConversation.deleteOne({ _id: req.params.id, uid });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Conversation not found" });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[copilot] delete error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// ─── POST /recruit/copilot/conversations/:id/clear ───────────────────────────

copilotRouter.post("/conversations/:id/clear", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const conversation = await RecruitCopilotConversation.findOneAndUpdate(
      { _id: req.params.id, uid },
      { $set: { messages: [], title: "New conversation", totalMessages: 0 } },
      { returnDocument: "after" }
    );
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    return res.json({
      id: String(conversation._id),
      starterActions: STARTER_ACTIONS[conversation.context.level] ?? [],
    });
  } catch (err: any) {
    console.error("[copilot] clear error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to clear conversation" });
  }
});

// ─── GET /recruit/copilot/starter-actions ────────────────────────────────────

copilotRouter.get("/starter-actions", (req, res) => {
  const level = (req.query.level as string) || "job";
  return res.json({ starterActions: STARTER_ACTIONS[level] ?? STARTER_ACTIONS.job });
});

// ─── GET /recruit/copilot/global-stats ────────────────────────────────────────
//
// Deterministic organization-wide metrics for the Organization Context Panel.
// No AI call — computed directly from jobs + candidates.

copilotRouter.get("/global-stats", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [allJobs, rawCandidates] = await Promise.all([
      RecruitJob.find({ uid }).lean(),
      RecruitCandidate.find({ uid }).select(GLOBAL_CANDIDATE_SELECT).lean(),
    ]);

    const { stats, pipelines } = buildGlobalStatsAndPipelines(allJobs, rawCandidates);

    return res.json({ stats, pipelines });
  } catch (err: any) {
    console.error("[copilot] global-stats error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to load organization stats" });
  }
});

// ─── POST /recruit/copilot/insights ───────────────────────────────────────────
//
// Auto-generated "Good morning" organization insights card. Called by the
// frontend when the recruiter opens Global Context with no active
// conversation — the AI does not wait for a question, it proactively
// summarizes the org's hiring state and recommends the next action.

copilotRouter.post("/insights", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const apiKey = process.env.GEMINI_MESH_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured (GEMINI_MESH_KEY missing)" });

  try {
    const { allJobs, allCandidates, globalStatsText, pipelines, recruiterName, companyName } =
      await loadContextData(uid, { workspace: "standard", level: "global" });

    const conversation = await RecruitCopilotConversation.create({
      uid,
      context: { workspace: "standard", level: "global" },
      title: "Organization Overview",
      messages: [],
    });

    const systemPrompt = buildCopilotPrompt({
      level: "global",
      mode: "json",
      recruiterName,
      companyName,
      allJobs,
      allCandidates,
      globalStats: globalStatsText,
      pipelines,
      syntheticInstruction:
        "The recruiter just opened their Organization Overview — they have not asked a question yet. " +
        "Proactively greet them by time of day and generate a short 'Here's today's hiring overview' card: " +
        "a handful of bullet points covering new applicants, interview-ready candidates, the strongest and weakest pipelines, " +
        "the most commonly missing skill, and end with one concrete recommendation of who to act on today. Keep it brief and scannable.",
    });

    const aiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate today's hiring overview." },
    ];

    const rawAi = await runStandardBillingOperation({
      ownerUid: uid,
      operation: "copilot_turn_standard",
      idempotencyKey: standardRequestIdempotencyKey(
        uid,
        `insights:${conversation._id}`,
        standardIdempotencyHeader(req),
      ),
      resourceType: "job",
      resourceId: String(conversation._id),
      work: async () => callMeshChatCompletions({
        apiKey,
        model: "openai/gpt-4o-mini",
        fallbackModels: ["google/gemini-2.5-flash-lite", "anthropic/claude-3-5-sonnet"],
        messages: aiMessages,
        max_tokens: 1200,
        temperature: 0.5,
        retries: 2,
        timeoutMs: 60_000,
        nvidiaFallback: true,
      }),
    });

    const parsed = parseAiResponse(rawAi);

    conversation.messages.push({
      role: "assistant",
      content: parsed.reply,
      recommendation: parsed.recommendation || undefined,
      confidence: parsed.confidence || undefined,
      reasoning: parsed.reasoning || undefined,
      sources: parsed.sources,
      quickActions: parsed.quickActions.length ? parsed.quickActions : STARTER_ACTIONS.global,
      timestamp: new Date(),
    } as any);
    conversation.lastActiveAt = new Date();
    conversation.totalMessages = conversation.messages.length;
    await conversation.save();

    return res.status(200).json({
      conversationId: String(conversation._id),
      reply: parsed.reply,
      recommendation: parsed.recommendation,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      sources: parsed.sources,
      quickActions: parsed.quickActions.length ? parsed.quickActions : STARTER_ACTIONS.global,
      title: conversation.title,
    });
  } catch (err: any) {
    if (await respondStandardBillingError(res, err, uid)) return;
    console.error("[copilot] insights error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to generate organization insights" });
  }
});

// ─── GET /recruit/copilot/form-global-stats ───────────────────────────────────

copilotRouter.get("/form-global-stats", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [allForms, rawResponses] = await Promise.all([
      RecruitForm.find({ uid }).lean(),
      RecruitFormResponse.find({ uid }).select(GLOBAL_FORM_RESPONSE_SELECT).lean(),
    ]);
    const { stats, pipelines } = computeGlobalFormStats(allForms as any[], rawResponses as any[]);
    return res.json({ stats, pipelines });
  } catch (err: any) {
    console.error("[copilot] form-global-stats error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to load form organization stats" });
  }
});

// ─── POST /recruit/copilot/form-insights ──────────────────────────────────────

copilotRouter.post("/form-insights", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const apiKey = process.env.GEMINI_MESH_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured" });

  try {
    const data = await loadContextData(uid, { workspace: "form", level: "form_global" });

    const conversation = await RecruitCopilotConversation.create({
      uid,
      context: { workspace: "form", level: "form_global" },
      title: "Forms Overview",
      messages: [],
    });

    const systemPrompt = buildPromptFromContext(
      { workspace: "form", level: "form_global" },
      data,
      "json",
      "The recruiter just opened their Form Job workspace overview. " +
        "Proactively greet them and summarize: active forms, top applicants, forms needing attention, " +
        "assessment completion, and one concrete recommendation for who to shortlist or follow up today. Keep it brief.",
    );

    const aiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate today's Form Job overview." },
    ];

    const rawAi = await runFormBillingOperation({
      ownerUid: uid,
      operation: "copilot_turn_form",
      idempotencyKey: formRequestIdempotencyKey(
        uid,
        `form-insights:${conversation._id}`,
        formIdempotencyHeader(req),
      ),
      resourceType: "form",
      resourceId: String(conversation._id),
      work: async () => callMeshChatCompletions({
        apiKey,
        model: "openai/gpt-4o-mini",
        fallbackModels: ["google/gemini-2.5-flash-lite"],
        messages: aiMessages,
        max_tokens: 1200,
        temperature: 0.5,
        retries: 2,
        timeoutMs: 60_000,
        nvidiaFallback: true,
      }),
    });

    const parsed = parseAiResponse(rawAi);
    parsed.sources = await attachSourceDetails(uid, parsed.sources, "form");

    conversation.messages.push({
      role: "assistant",
      content: parsed.reply,
      recommendation: parsed.recommendation || undefined,
      confidence: parsed.confidence || undefined,
      reasoning: parsed.reasoning || undefined,
      sources: parsed.sources,
      quickActions: parsed.quickActions.length ? parsed.quickActions : STARTER_ACTIONS.form_global,
      timestamp: new Date(),
    } as any);
    conversation.lastActiveAt = new Date();
    conversation.totalMessages = conversation.messages.length;
    await conversation.save();

    return res.status(200).json({
      conversationId: String(conversation._id),
      reply: parsed.reply,
      recommendation: parsed.recommendation,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      sources: parsed.sources,
      quickActions: parsed.quickActions.length ? parsed.quickActions : STARTER_ACTIONS.form_global,
      title: conversation.title,
    });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, uid)) return;
    console.error("[copilot] form-insights error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to generate form insights" });
  }
});
