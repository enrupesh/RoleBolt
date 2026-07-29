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
import type { GlobalCandidateSummary } from "./ai/buildCopilotPrompt";
import { computeGlobalHiringStats, globalStatsToPromptText } from "./ai/globalHiringStats";
import type { JobPipelineStat } from "./ai/globalHiringStats";

export const copilotRouter = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
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
}

/** Fields needed for org-wide reasoning — deliberately excludes heavy fields
 * (resumeText, assessmentQuestions/Answers, interviewBrief) to keep the
 * global prompt within a sane token budget across potentially many candidates. */
const GLOBAL_CANDIDATE_SELECT =
  "name email jobId totalScore maxScore stage hiringDecision assessmentStatus strengths redFlags scoreBreakdown location availability createdAt stageMovedAt";

async function loadContextData(
  uid: string,
  context: { level: string; jobId?: string; candidateId?: string }
): Promise<ContextData> {
  const [profile, companyProfile] = await Promise.all([
    RecruitProfile.findOne({ uid }).lean(),
    RecruitCompanyProfile.findOne({ uid }).lean(),
  ]);

  const recruiterName = (profile as any)?.name as string | undefined;
  const companyName = (companyProfile as any)?.name as string | undefined;

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

  // ── Global — Organization Intelligence ────────────────────────────────────
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
  candidate: any | null = null
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

// ─── POST /recruit/copilot/chat ───────────────────────────────────────────────

copilotRouter.post("/chat", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const {
    message,
    context,
    conversationId,
  }: {
    message: string;
    context: { level: "global" | "job" | "candidate"; jobId?: string; candidateId?: string };
    conversationId?: string;
  } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: "message is required" });
  if (!context?.level) return res.status(400).json({ error: "context.level is required" });

  const apiKey = process.env.GEMINI_MESH_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured (GEMINI_MESH_KEY missing)" });

  try {
    // ── 1. Load or create conversation ──────────────────────────────────────
    let conversation = conversationId
      ? await RecruitCopilotConversation.findOne({ _id: conversationId, uid })
      : null;
    const isNew = !conversation;

    if (!conversation) {
      conversation = await RecruitCopilotConversation.create({
        uid,
        context: { level: context.level, jobId: context.jobId, candidateId: context.candidateId },
        title: "New conversation",
        messages: [],
      });
    }

    // ── 2. Load context data ─────────────────────────────────────────────────
    const { job, candidates, candidate, recruiterName, companyName, allJobs, allCandidates, globalStatsText, pipelines } =
      await loadContextData(uid, context);
    if (context.level === "job" && context.jobId && !job) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (context.level === "candidate" && context.candidateId && !candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    // ── 3. Build prompt + message history ────────────────────────────────────
    const systemPrompt = buildCopilotPrompt({
      level: context.level,
      mode: "json",
      recruiterName,
      companyName,
      job: job ?? undefined,
      candidates: candidates ?? undefined,
      candidate: candidate ?? undefined,
      allJobs,
      allCandidates,
      globalStats: globalStatsText,
      pipelines,
    });

    const aiMessages = buildMessageHistory(systemPrompt, conversation, message.trim());

    // ── 4. Call AI ────────────────────────────────────────────────────────────
    const rawAi = await callMeshChatCompletions({
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

    const parsed = parseAiResponse(rawAi);
    parsed.sources = await attachCandidateEmails(uid, parsed.sources);

    // ── 5. Persist + respond ──────────────────────────────────────────────────
    await persistExchange(conversation, message.trim(), parsed, isNew, job, candidate);

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

copilotRouter.post("/chat/stream", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const {
    message,
    context,
    conversationId,
  }: {
    message: string;
    context: { level: "global" | "job" | "candidate"; jobId?: string; candidateId?: string };
    conversationId?: string;
  } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: "message is required" });
  if (!context?.level) return res.status(400).json({ error: "context.level is required" });

  const apiKey = process.env.GEMINI_MESH_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured" });

  // ── Set up SSE ─────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  function sendEvent(data: Record<string, unknown>) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // ── 1. Load or create conversation ──────────────────────────────────────
    let conversation = conversationId
      ? await RecruitCopilotConversation.findOne({ _id: conversationId, uid })
      : null;
    const isNew = !conversation;

    if (!conversation) {
      conversation = await RecruitCopilotConversation.create({
        uid,
        context: { level: context.level, jobId: context.jobId, candidateId: context.candidateId },
        title: "New conversation",
        messages: [],
      });
    }

    // ── 2. Load context data ─────────────────────────────────────────────────
    const { job, candidates, candidate, recruiterName, companyName, allJobs, allCandidates, globalStatsText, pipelines } =
      await loadContextData(uid, context);
    if (context.level === "job" && context.jobId && !job) {
      sendEvent({ type: "error", error: "Job not found" });
      return res.end();
    }
    if (context.level === "candidate" && context.candidateId && !candidate) {
      sendEvent({ type: "error", error: "Candidate not found" });
      return res.end();
    }

    // ── 3. Build prompt + history ────────────────────────────────────────────
    const systemPrompt = buildCopilotPrompt({
      level: context.level,
      mode: "stream",
      recruiterName,
      companyName,
      job: job ?? undefined,
      candidates: candidates ?? undefined,
      candidate: candidate ?? undefined,
      allJobs,
      allCandidates,
      globalStats: globalStatsText,
      pipelines,
    });

    const aiMessages = buildMessageHistory(systemPrompt, conversation, message.trim());

    // ── 4. Stream tokens, detect sentinel ────────────────────────────────────
    let fullText = "";
    let sentinelFound = false;
    let emittedUpTo = 0;

    // We keep a lookbehind buffer of SENTINEL.length chars to handle sentinels
    // split across two SSE chunks.
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
        // Emit any reply text before the sentinel that hasn't been emitted yet
        if (sentinelIdx > emittedUpTo) {
          sendEvent({ type: "token", token: fullText.slice(emittedUpTo, sentinelIdx) });
        }
        sentinelFound = true;
        break;
      }

      // Safe to emit up to (length - SENTINEL_LEN) to avoid splitting the sentinel
      const safeUpTo = Math.max(emittedUpTo, fullText.length - SENTINEL_LEN);
      if (safeUpTo > emittedUpTo) {
        sendEvent({ type: "token", token: fullText.slice(emittedUpTo, safeUpTo) });
        emittedUpTo = safeUpTo;
      }
    }

    // If sentinel wasn't found in the stream, the model returned plain text
    // (e.g. fallback or format error). Emit remaining buffer and use empty meta.
    if (!sentinelFound && emittedUpTo < fullText.length) {
      sendEvent({ type: "token", token: fullText.slice(emittedUpTo) });
    }

    // ── 5. Parse metadata ─────────────────────────────────────────────────────
    const sentinelIdx = fullText.indexOf(STREAM_SENTINEL);
    const replyText = sentinelFound
      ? fullText.slice(0, sentinelIdx).trim()
      : fullText.trim();
    const metaRaw = sentinelFound
      ? fullText.slice(sentinelIdx + STREAM_SENTINEL.length)
      : "";

    const meta = parseStreamMeta(metaRaw);
    const parsed: ParsedAiResponse = { reply: replyText, ...meta };
    parsed.sources = await attachCandidateEmails(uid, parsed.sources);

    // ── 6. Persist ────────────────────────────────────────────────────────────
    await persistExchange(conversation, message.trim(), parsed, isNew, job, candidate);

    // ── 7. Send done event ────────────────────────────────────────────────────
    sendEvent({
      type: "done",
      conversationId: String(conversation._id),
      recommendation: parsed.recommendation,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      sources: parsed.sources,
      quickActions: parsed.quickActions,
      title: conversation.title,
    });

    return res.end();
  } catch (err: any) {
    console.error("[copilot] stream error:", err?.message ?? err);
    sendEvent({ type: "error", error: "AI Copilot stream failed. Please try again." });
    return res.end();
  }
});

// ─── GET /recruit/copilot/conversations ──────────────────────────────────────

copilotRouter.get("/conversations", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const conversations = await RecruitCopilotConversation.find({ uid })
      .sort({ lastActiveAt: -1 })
      .limit(50)
      .select("title context selectedJobId selectedJobTitle selectedCandidateId selectedCandidateName lastActiveAt totalMessages messages createdAt updatedAt")
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
      await loadContextData(uid, { level: "global" });

    const conversation = await RecruitCopilotConversation.create({
      uid,
      context: { level: "global" },
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

    const rawAi = await callMeshChatCompletions({
      apiKey,
      model: "openai/gpt-4o-mini",
      fallbackModels: ["google/gemini-2.5-flash-lite", "anthropic/claude-3-5-sonnet"],
      messages: aiMessages,
      max_tokens: 1200,
      temperature: 0.5,
      retries: 2,
      timeoutMs: 60_000,
      nvidiaFallback: true,
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
    console.error("[copilot] insights error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to generate organization insights" });
  }
});
