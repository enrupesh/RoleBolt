/**
 * Recruit Copilot — AI Hiring Copilot ("Ask Rolebolt")
 *
 * Routes:
 *   POST   /recruit/copilot/chat                       — send a message
 *   GET    /recruit/copilot/conversations              — list conversations
 *   GET    /recruit/copilot/conversations/:id          — get full conversation
 *   DELETE /recruit/copilot/conversations/:id          — delete conversation
 *   POST   /recruit/copilot/conversations/:id/clear    — clear messages (keep convo)
 */

import express from "express";
import { requireFirebaseAuth } from "./index";
import { RecruitCopilotConversation } from "./models/RecruitCopilotConversation";
import { RecruitJob } from "./models/RecruitJob";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitProfile } from "./models/RecruitProfile";
import { RecruitCompanyProfile } from "./models/RecruitCompanyProfile";
import { callMeshChatCompletions } from "./ai/meshClient";
import { buildCopilotPrompt } from "./ai/buildCopilotPrompt";
import type { ChatMessage } from "./ai/meshClient";
import type { ICopilotSource } from "./models/RecruitCopilotConversation";

export const copilotRouter = express.Router();
copilotRouter.use(requireFirebaseAuth);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

/**
 * Parse the AI response. The AI is instructed to return JSON — but as a safety
 * net we attempt to extract a JSON block even if the model wraps it in markdown.
 */
function parseAiResponse(raw: string): {
  reply: string;
  sources: ICopilotSource[];
  quickActions: string[];
} {
  const fallback = {
    reply: raw,
    sources: [] as ICopilotSource[],
    quickActions: [] as string[],
  };

  try {
    // Try direct parse
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.reply === "string") {
      return {
        reply: parsed.reply,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        quickActions: Array.isArray(parsed.quickActions) ? parsed.quickActions : [],
      };
    }
  } catch {
    // Try extracting JSON from markdown code block
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed && typeof parsed.reply === "string") {
          return {
            reply: parsed.reply,
            sources: Array.isArray(parsed.sources) ? parsed.sources : [],
            quickActions: Array.isArray(parsed.quickActions) ? parsed.quickActions : [],
          };
        }
      } catch {
        // fall through
      }
    }
    // Try finding raw JSON object in the string
    const objMatch = raw.match(/\{[\s\S]*"reply"[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed && typeof parsed.reply === "string") {
          return {
            reply: parsed.reply,
            sources: Array.isArray(parsed.sources) ? parsed.sources : [],
            quickActions: Array.isArray(parsed.quickActions) ? parsed.quickActions : [],
          };
        }
      } catch {
        // fall through
      }
    }
  }

  return fallback;
}

/**
 * Auto-generate a short conversation title from the first user message.
 * We use a lightweight AI call so it's fast and non-blocking.
 */
async function generateTitle(firstMessage: string): Promise<string> {
  const apiKey = process.env.MESHAPI_API_KEY;
  if (!apiKey) return firstMessage.slice(0, 60);

  try {
    const raw = await callMeshChatCompletions({
      apiKey,
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate a short, descriptive title (max 6 words) for a recruiter's chat conversation based on their first message. Return ONLY the title, no punctuation, no quotes.",
        },
        { role: "user", content: firstMessage },
      ],
      max_tokens: 20,
      temperature: 0.4,
      retries: 1,
    });
    return raw.trim().replace(/^["']|["']$/g, "").slice(0, 80);
  } catch {
    return firstMessage.slice(0, 60);
  }
}

// ─── Default Starter Actions ──────────────────────────────────────────────────

const STARTER_ACTIONS_BY_LEVEL: Record<string, string[]> = {
  job: [
    "Who should I interview first?",
    "Compare top candidates",
    "Recommend top 5",
    "Generate interview questions",
    "Show missing skills",
    "Who can join immediately?",
  ],
  candidate: [
    "Summarize this candidate",
    "What are their strengths and weaknesses?",
    "Should I hire this candidate?",
    "Generate interview questions",
    "What skills are missing compared to the JD?",
  ],
  global: [
    "Which job has the most applicants?",
    "Which role is hardest to fill?",
    "Show jobs with no strong candidates",
  ],
};

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

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (!context?.level) {
    return res.status(400).json({ error: "context.level is required" });
  }

  const apiKey = process.env.MESHAPI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AI service not configured (MESHAPI_API_KEY missing)" });
  }

  try {
    // ── 1. Load or create conversation ──────────────────────────────────────
    let conversation = conversationId
      ? await RecruitCopilotConversation.findOne({ _id: conversationId, uid })
      : null;

    const isNewConversation = !conversation;

    if (!conversation) {
      conversation = await RecruitCopilotConversation.create({
        uid,
        context: {
          level: context.level,
          jobId: context.jobId,
          candidateId: context.candidateId,
        },
        title: "New conversation",
        messages: [],
      });
    }

    // ── 2. Load context data from DB ─────────────────────────────────────────
    let job: any = null;
    let candidates: any[] = [];
    let recruiterName: string | undefined;
    let companyName: string | undefined;

    // Load recruiter profile for personalisation
    const [profile, companyProfile] = await Promise.all([
      RecruitProfile.findOne({ uid }).lean(),
      RecruitCompanyProfile.findOne({ uid }).lean(),
    ]);
    recruiterName = (profile as any)?.name;
    companyName = (companyProfile as any)?.name;

    if (context.level === "job" && context.jobId) {
      [job, candidates] = await Promise.all([
        RecruitJob.findOne({ _id: context.jobId, uid }).lean(),
        RecruitCandidate.find({ jobId: context.jobId, uid })
          .sort({ totalScore: -1 })
          .lean(),
      ]);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
    }

    // ── 3. Build system prompt ────────────────────────────────────────────────
    const systemPrompt = buildCopilotPrompt({
      level: context.level,
      recruiterName,
      companyName,
      job: job ?? undefined,
      candidates: candidates ?? undefined,
    });

    // ── 4. Build conversation history for the AI ──────────────────────────────
    // Include last 20 messages to stay within token limits while keeping memory
    const recentMessages = conversation.messages.slice(-20);
    const historyMessages: ChatMessage[] = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const aiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: message.trim() },
    ];

    // ── 5. Call AI ────────────────────────────────────────────────────────────
    const rawAiResponse = await callMeshChatCompletions({
      apiKey,
      model: "openai/gpt-4o",
      fallbackModels: ["openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet"],
      messages: aiMessages,
      max_tokens: 2000,
      temperature: 0.5,
      retries: 2,
      timeoutMs: 60_000,
    });

    const { reply, sources, quickActions } = parseAiResponse(rawAiResponse);

    // ── 6. Persist messages ───────────────────────────────────────────────────
    conversation.messages.push(
      {
        role: "user",
        content: message.trim(),
        sources: [],
        quickActions: [],
        timestamp: new Date(),
      },
      {
        role: "assistant",
        content: reply,
        sources,
        quickActions,
        timestamp: new Date(),
      }
    );

    // ── 7. Auto-generate title on first exchange ──────────────────────────────
    if (isNewConversation || conversation.title === "New conversation") {
      // Non-blocking — fire and forget, update in background
      setImmediate(async () => {
        try {
          const title = await generateTitle(message.trim());
          await RecruitCopilotConversation.updateOne(
            { _id: conversation!._id },
            { $set: { title } }
          );
        } catch {
          // silent — title stays as "New conversation"
        }
      });
    }

    await conversation.save();

    return res.status(200).json({
      conversationId: String(conversation._id),
      reply,
      sources,
      quickActions,
      title: conversation.title,
    });
  } catch (err: any) {
    console.error("[copilot] chat error:", err?.message ?? err);
    return res.status(500).json({ error: "AI Copilot request failed. Please try again." });
  }
});

// ─── GET /recruit/copilot/conversations ──────────────────────────────────────

copilotRouter.get("/conversations", async (req, res) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const conversations = await RecruitCopilotConversation.find({ uid })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select("title context createdAt updatedAt messages")
      .lean();

    const result = conversations.map((c) => ({
      id: String(c._id),
      title: c.title,
      context: c.context,
      messageCount: c.messages.length,
      lastMessage:
        c.messages.length > 0
          ? {
              role: c.messages[c.messages.length - 1].role,
              preview: c.messages[c.messages.length - 1].content.slice(0, 120),
            }
          : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

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

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json({
      id: String(conversation._id),
      title: conversation.title,
      context: conversation.context,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      starterActions:
        conversation.messages.length === 0
          ? STARTER_ACTIONS_BY_LEVEL[conversation.context.level] ?? []
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
    const result = await RecruitCopilotConversation.deleteOne({
      _id: req.params.id,
      uid,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[copilot] delete conversation error:", err?.message ?? err);
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
      { $set: { messages: [], title: "New conversation" } },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json({
      id: String(conversation._id),
      starterActions: STARTER_ACTIONS_BY_LEVEL[conversation.context.level] ?? [],
    });
  } catch (err: any) {
    console.error("[copilot] clear conversation error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to clear conversation" });
  }
});

// ─── GET /recruit/copilot/starter-actions ────────────────────────────────────

copilotRouter.get("/starter-actions", async (req, res) => {
  const level = (req.query.level as string) || "job";
  return res.json({
    starterActions: STARTER_ACTIONS_BY_LEVEL[level] ?? STARTER_ACTIONS_BY_LEVEL.job,
  });
});
