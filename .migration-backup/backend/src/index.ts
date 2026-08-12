// Load .env before importing auth modules; several auth helpers read
// configuration at request time and OAuth/JWT must work in local development too.
import "dotenv/config";
import cors from "cors";
import express from "express";
import { authRouter } from "./auth";
import { requireAuth } from "./authMiddleware";
import { recruitRouter, recruitPublicRouter } from "./recruit";
import { formRouter, formPublicRouter } from "./recruitForms";
import { copilotRouter } from "./recruitCopilot";
import { siteGuideRouter } from "./siteGuideChat";
import { connectMongo } from "./db";
import { startDailyBriefingJob } from "./jobs/dailyBriefing";
import { startOfferManagementJob } from "./jobs/offerManagement";
import { startPipelineRulesCron } from "./jobs/pipelineRulesCron";
import { seekerRouter } from "./seeker";
import { requireSeekerRole } from "./middleware/requireSeekerRole";
import { billingRouter } from "./billing";
import { billingCatalogRouter, billingFoundationRouter } from "./billing/api";
import { handleRazorpayWebhook, razorpayBillingRouter } from "./billing/razorpayApi";
import { collaborationRouter, collaborationPublicRouter } from "./collaboration";
import { raka98AdminRouter } from "./admin/raka98AdminRouter";
import { creatorEmailRouter } from "./creatorEmailRouter";
import { feedbackPublicRouter } from "./feedback";
import { reviewsPublicRouter } from "./reviews";
import { sitegenPublicRouter } from "./products/sitegen";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

function buildCorsOrigin(): string | string[] | boolean {
  const defaultOrigins = ["http://localhost:3000", "http://localhost:5000"];
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    if (isProduction) {
      console.warn(
        "[cors] CORS_ORIGIN not set in production — set it to your deployed frontend URL(s)."
      );
    }
    return defaultOrigins;
  }
  if (raw === "*" || raw === "true") return true;
  const origins = Array.from(
    new Set([...raw.split(",").map((s) => s.trim()).filter(Boolean), ...defaultOrigins])
  );
  return origins.length === 1 ? origins[0] : origins;
}

app.use(
  cors({
    origin: buildCorsOrigin(),
    credentials: true,
  })
);

// ── Razorpay webhook (raw body BEFORE express.json) ──────────────────────────
app.post("/billing/webhook", express.raw({ type: "application/json" }), handleRazorpayWebhook);

app.use(express.json({ limit: "6mb" }));

// ── Health check (before auth middleware so it always works) ─────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "recruit-backend" });
});

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.use("/auth", authRouter);

// ── Public routes ─────────────────────────────────────────────────────────────
app.use("/recruit-public", recruitPublicRouter);
app.use("/recruit-public", collaborationPublicRouter);
app.use("/recruit-public/forms", formPublicRouter);
app.use("/recruit-public/site-guide", siteGuideRouter);
app.use("/recruit-public", feedbackPublicRouter);
app.use("/recruit-public", reviewsPublicRouter);
app.use("/sitegen-public", sitegenPublicRouter);

// ── Internal admin routes (password header, no JWT) ───────────────────────────
app.use("/admin", raka98AdminRouter);

// ── Protected routes (JWT required) ──────────────────────────────────────────
app.use("/recruit/copilot", requireAuth, copilotRouter);
app.use("/recruit/seeker", requireAuth, requireSeekerRole, seekerRouter);
app.use("/recruit/collaboration", requireAuth, collaborationRouter);
app.use("/recruit", requireAuth, recruitRouter);
app.use("/recruit/creator-emails", requireAuth, creatorEmailRouter);
app.use("/recruit/forms", requireAuth, formRouter);
// Pricing metadata is safe to expose publicly; account entitlements and all
// mutation/legacy billing routes remain behind JWT authentication.
app.use("/billing", billingCatalogRouter);
app.use("/billing", requireAuth, billingFoundationRouter);
app.use("/billing", requireAuth, razorpayBillingRouter);
// Retired Stripe compatibility routes are mounted last so they cannot shadow
// the active Razorpay checkout route with the same legacy path.
app.use("/billing", requireAuth, billingRouter);

// ── Helper: ping one AI API ───────────────────────────────────────────────────
async function pingApi(opts: {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}): Promise<{ status: "operational" | "degraded" | "unavailable"; responseTimeMs: number; error?: string }> {
  const t = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    let r: Response;
    try {
      r = await fetch(opts.url, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        body: opts.body,
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
    const ms = Date.now() - t;
    if (r.ok)          return { status: ms > 6000 ? "degraded" : "operational", responseTimeMs: ms };
    if (r.status >= 500) return { status: "degraded",    responseTimeMs: ms, error: `HTTP ${r.status}` };
    return { status: r.status === 401 || r.status === 403 ? "unavailable" : "degraded", responseTimeMs: ms, error: `HTTP ${r.status}` };
  } catch (err: any) {
    const ms = Date.now() - t;
    return { status: "unavailable", responseTimeMs: ms, error: err?.name === "AbortError" ? `Timeout (>${opts.timeoutMs / 1000}s)` : err?.message };
  }
}

// ── GET /status (and legacy /mesh-api-status) ─────────────────────────────────
async function handleStatusRoute(_req: any, res: any) {
  const geminiMeshKey = process.env.GEMINI_MESH_KEY || "";
  const geminiFallbackKey = process.env.GEMINI_FALLBACK_KEY || "";
  const geminiPrimaryKey  = process.env.GEMINI_PRIMARY_KEY  || "";
  const resendKey  = process.env.RESEND_API_KEY  || "";
  const sessionKey = process.env.SESSION_SECRET  || "";

  const totalStart = Date.now();

  // ── Ping all three AI APIs in parallel ─────────────────────────────────────
  const [geminiMeshResult, geminiFallbackResult, geminiPrimaryResult] = await Promise.all([
    // Google M API (Mesh)
    geminiMeshKey
      ? pingApi({
          url: "https://api.meshapi.ai/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer ${geminiMeshKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
          timeoutMs: 9000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GEMINI_MESH_KEY not configured" }),

    // Google N API (NVIDIA NIM) — use GET /v1/models (model-agnostic, no 404 from bad model name)
    geminiFallbackKey
      ? pingApi({
          url: "https://integrate.api.nvidia.com/v1/models",
          headers: { Authorization: `Bearer ${geminiFallbackKey}` },
          timeoutMs: 11000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GEMINI_FALLBACK_KEY not configured" }),

    // Google API (Gemini — list models endpoint, no chat needed)
    geminiPrimaryKey
      ? pingApi({
          url: `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiPrimaryKey}&pageSize=1`,
          headers: {},
          timeoutMs: 8000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GEMINI_PRIMARY_KEY not configured" }),
  ]);

  // ── Infrastructure status ───────────────────────────────────────────────────
  const mongoose = (await import("mongoose")).default;
  const dbStatus: "operational" | "unavailable" =
    mongoose.connection.readyState === 1 ? "operational" : "unavailable";

  const authStatus:  "operational" | "unavailable" = sessionKey ? "operational" : "unavailable";
  const emailStatus: "operational" | "unavailable" = resendKey  ? "operational" : "unavailable";

  // ── Overall status ──────────────────────────────────────────────────────────
  const aiStatuses = [geminiMeshResult.status, geminiFallbackResult.status, geminiPrimaryResult.status];
  const overallStatus =
    aiStatuses.every(s => s === "operational") && dbStatus === "operational"
      ? "operational"
      : aiStatuses.some(s => s === "operational")
      ? "degraded"
      : "unavailable";

  return res.json({
    status: overallStatus,
    checkedAt: new Date().toISOString(),
    totalResponseTimeMs: Date.now() - totalStart,
    aiApis: {
      geminiMesh: { ...geminiMeshResult, endpoint: "api.meshapi.ai",                        label: "Gemini Fallback Key 1" },
      geminiFallback: { ...geminiFallbackResult, endpoint: "integrate.api.nvidia.com",              label: "Gemini Fallback Key 2" },
      geminiPrimary:  { ...geminiPrimaryResult,  endpoint: "generativelanguage.googleapis.com",     label: "Gemini Primary Key"    },
    },
    systemHealth: {
      backend:  "operational",
      database: dbStatus,
      auth:     authStatus,
      email:    emailStatus,
      frontend: "operational",
    },
    // ── Legacy fields (kept for backward compat) ──────────────────────────────
    meshApiUrl:    "https://api.meshapi.ai/v1",
    apiVersion:    "v1",
    responseTimeMs: geminiMeshResult.responseTimeMs,
    models: [
      { id: "openai/gpt-4o-mini",           role: "primary",    label: "GPT-4o mini",          status: geminiMeshResult.status },
      { id: "anthropic/claude-3-haiku",      role: "fallback-1", label: "Claude 3 Haiku",        status: geminiMeshResult.status },
      { id: "google/gemini-2.5-flash-lite",  role: "fallback-2", label: "Gemini 2.5 Flash Lite", status: geminiMeshResult.status },
    ],
    services: [
      { id: "resumeAnalysis",           label: "Resume Analysis",            status: geminiMeshResult.status },
      { id: "candidateScoring",         label: "Candidate Scoring",          status: geminiMeshResult.status },
      { id: "candidateMatching",        label: "Candidate Matching",         status: geminiMeshResult.status },
      { id: "jobDescriptionGeneration", label: "Job Description Generation", status: geminiMeshResult.status },
      { id: "aiAssistant",              label: "AI Recruitment Assistant",   status: geminiMeshResult.status },
      { id: "formResponseScoring",      label: "Form Response Scoring",      status: geminiMeshResult.status },
    ],
  });
}

app.get("/status",          handleStatusRoute);
app.get("/mesh-api-status", handleStatusRoute); // legacy alias
app.get("/status/ai",       handleStatusRoute); // Feature 4.1 — Gemini verification alias

// ── GET /ai-routing — detailed routing intelligence for admin dashboard ────────
app.get("/ai-routing", async (_req, res) => {
  const geminiMeshKey = process.env.GEMINI_MESH_KEY || "";
  const geminiFallbackKey = process.env.GEMINI_FALLBACK_KEY || "";
  const geminiPrimaryKey  = process.env.GEMINI_PRIMARY_KEY  || "";

  // Ping all three in parallel
  const [geminiMeshResult, geminiFallbackResult, geminiPrimaryResult] = await Promise.all([
    geminiMeshKey
      ? pingApi({
          url: "https://api.meshapi.ai/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer ${geminiMeshKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
          timeoutMs: 9000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GEMINI_MESH_KEY not configured" }),

    geminiFallbackKey
      ? pingApi({
          url: "https://integrate.api.nvidia.com/v1/models",
          headers: { Authorization: `Bearer ${geminiFallbackKey}` },
          timeoutMs: 11000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GEMINI_FALLBACK_KEY not configured" }),

    geminiPrimaryKey
      ? pingApi({
          url: `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiPrimaryKey}&pageSize=1`,
          headers: {},
          timeoutMs: 8000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GEMINI_PRIMARY_KEY not configured" }),
  ]);

  const mUp = geminiMeshResult.status !== "unavailable";
  const nUp = geminiFallbackResult.status !== "unavailable";
  const gUp = geminiPrimaryResult.status  !== "unavailable";

  // Infer active model for Google M API (Mesh)
  // Primary: google/gemini-2.5-flash; fallbacks: anthropic/claude-3-haiku, google/gemini-2.5-flash-lite
  // If Mesh is down → NVIDIA NIM
  const googleMActiveModel  = mUp ? "google/gemini-2.5-flash"           : (nUp ? "meta/llama-3.1-405b-instruct (via NVIDIA fallback)" : null);
  const googleMRoutingState = mUp ? "normal"                             : (nUp ? "fallback-nvidia"                                    : "unavailable");

  // Infer active model for Google API (Gemini direct)
  // Primary chain starts at gemini-2.5-flash; if all down → NVIDIA NIM
  const googleActiveModel   = gUp ? "gemini-2.5-flash"                  : (nUp ? "meta/llama-3.1-405b-instruct (via NVIDIA fallback)" : null);
  const googleRoutingState  = gUp ? "normal"                            : (nUp ? "fallback-nvidia"                                    : "unavailable");

  // NVIDIA is the ultimate fallback — active model is head of chain
  const googleNActiveModel  = nUp ? "meta/llama-3.1-405b-instruct"      : null;

  // Determine overall routing mode
  const anyDown   = !mUp || !nUp || !gUp;
  const allDown   = !mUp && !gUp;
  const routingMode = !anyDown ? "normal" : (allDown ? "critical" : "degraded");

  // Which features route where, with fallback notes
  const features = [
    {
      id: "resumeScoring",
      label: "Resume Scoring & Analysis",
      primaryProvider: "googleM",
      primaryModel: "google/gemini-2.5-flash",
      fallbackChain: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
      ultimateFallback: "nvidia",
      activeProvider: mUp ? "googleM" : (nUp ? "nvidia" : null),
      activeModel:    mUp ? "google/gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !mUp,
    },
    {
      id: "candidateScoring",
      label: "Candidate Fit Scoring",
      primaryProvider: "googleM",
      primaryModel: "google/gemini-2.5-flash",
      fallbackChain: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
      ultimateFallback: "nvidia",
      activeProvider: mUp ? "googleM" : (nUp ? "nvidia" : null),
      activeModel:    mUp ? "google/gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !mUp,
    },
    {
      id: "assessmentGen",
      label: "Assessment Question Generation",
      primaryProvider: "googleM",
      primaryModel: "google/gemini-2.5-flash",
      fallbackChain: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
      ultimateFallback: "nvidia",
      activeProvider: mUp ? "googleM" : (nUp ? "nvidia" : null),
      activeModel:    mUp ? "google/gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !mUp,
    },
    {
      id: "interviewBrief",
      label: "Interview Brief Generation",
      primaryProvider: "googleM",
      primaryModel: "google/gemini-2.5-flash",
      fallbackChain: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
      ultimateFallback: "nvidia",
      activeProvider: mUp ? "googleM" : (nUp ? "nvidia" : null),
      activeModel:    mUp ? "google/gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !mUp,
    },
    {
      id: "formScoring",
      label: "Form Response Scoring",
      primaryProvider: "googleM",
      primaryModel: "google/gemini-2.5-flash",
      fallbackChain: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
      ultimateFallback: "nvidia",
      activeProvider: mUp ? "googleM" : (nUp ? "nvidia" : null),
      activeModel:    mUp ? "google/gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !mUp,
    },
    {
      id: "copilot",
      label: "AI Hiring Copilot (Ask Rolebolt)",
      primaryProvider: "googleM",
      primaryModel: "google/gemini-2.5-flash",
      fallbackChain: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
      ultimateFallback: "nvidia",
      activeProvider: mUp ? "googleM" : (nUp ? "nvidia" : null),
      activeModel:    mUp ? "google/gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !mUp,
    },
    {
      id: "siteGuide",
      label: "Site Guide Chatbot",
      primaryProvider: "googleM",
      primaryModel: "google/gemini-2.5-flash",
      fallbackChain: [],
      ultimateFallback: "nvidia",
      activeProvider: mUp ? "googleM" : (nUp ? "nvidia" : null),
      activeModel:    mUp ? "google/gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !mUp,
    },
    {
      id: "jobDescription",
      label: "Job Description Generation",
      primaryProvider: "google",
      primaryModel: "gemini-2.5-flash",
      fallbackChain: ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.6-flash"],
      ultimateFallback: "nvidia",
      activeProvider: gUp ? "google" : (nUp ? "nvidia" : null),
      activeModel:    gUp ? "gemini-2.5-flash" : (nUp ? "meta/llama-3.1-405b-instruct" : null),
      inFallback:     !gUp,
    },
  ];

  return res.json({
    checkedAt: new Date().toISOString(),
    routingMode,
    providers: {
      geminiMesh: {
        label: "Gemini Fallback Key 1",
        sublabel: "Mesh API Gateway",
        endpoint: "api.meshapi.ai",
        keyConfigured: !!geminiMeshKey,
        status: geminiMeshResult.status,
        responseTimeMs: geminiMeshResult.responseTimeMs,
        error: geminiMeshResult.error,
        primaryModel: "google/gemini-2.5-flash",
        fallbackModels: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
        ultimateFallback: "nvidia",
        activeModel: googleMActiveModel,
        routingState: googleMRoutingState,
        modelRegistry: [
          { id: "google/gemini-2.5-flash",         label: "Gemini 2.5 Flash",       role: "primary",    provider: "Google via Mesh" },
          { id: "anthropic/claude-3-haiku",         label: "Claude 3 Haiku",          role: "fallback-1", provider: "Anthropic via Mesh" },
          { id: "google/gemini-2.5-flash-lite",     label: "Gemini 2.5 Flash Lite",  role: "fallback-2", provider: "Google via Mesh" },
          { id: "openai/gpt-4o-mini",               label: "GPT-4o Mini",             role: "available",  provider: "OpenAI via Mesh" },
          { id: "anthropic/claude-3-5-sonnet",      label: "Claude 3.5 Sonnet",       role: "available",  provider: "Anthropic via Mesh" },
        ],
      },
      geminiPrimary: {
        label: "Gemini Primary Key",
        sublabel: "Gemini Direct",
        endpoint: "generativelanguage.googleapis.com",
        keyConfigured: !!geminiPrimaryKey,
        status: geminiPrimaryResult.status,
        responseTimeMs: geminiPrimaryResult.responseTimeMs,
        error: geminiPrimaryResult.error,
        primaryModel: "gemini-2.5-flash",
        fallbackModels: ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.6-flash"],
        ultimateFallback: "nvidia",
        activeModel: googleActiveModel,
        routingState: googleRoutingState,
        modelRegistry: [
          { id: "gemini-2.5-flash",       label: "Gemini 2.5 Flash",       role: "primary",    provider: "Google" },
          { id: "gemini-2.5-flash-lite",  label: "Gemini 2.5 Flash Lite",  role: "fallback-1", provider: "Google" },
          { id: "gemini-3.1-flash-lite",  label: "Gemini 3.1 Flash Lite",  role: "fallback-2", provider: "Google" },
          { id: "gemini-3.5-flash-lite",  label: "Gemini 3.5 Flash Lite",  role: "fallback-3", provider: "Google" },
          { id: "gemini-3.6-flash",       label: "Gemini 3.6 Flash",       role: "fallback-4", provider: "Google" },
        ],
      },
      nvidia: {
        label: "NVIDIA API",
        sublabel: "Ultimate Fallback",
        endpoint: "integrate.api.nvidia.com",
        keyConfigured: !!geminiFallbackKey,
        status: geminiFallbackResult.status,
        responseTimeMs: geminiFallbackResult.responseTimeMs,
        error: geminiFallbackResult.error,
        primaryModel: "meta/llama-3.1-405b-instruct",
        fallbackModels: [
          "nvidia/llama-3.1-nemotron-70b-instruct",
          "meta/llama-3.3-70b-instruct",
          "meta/llama-3.1-70b-instruct",
          "mistralai/mixtral-8x22b-instruct-v0.1",
        ],
        ultimateFallback: null,
        activeModel: googleNActiveModel,
        routingState: nUp ? "normal" : "unavailable",
        modelRegistry: [
          { id: "meta/llama-3.1-405b-instruct",              label: "Llama 3.1 405B",         role: "primary",    provider: "Meta via NVIDIA" },
          { id: "nvidia/llama-3.1-nemotron-70b-instruct",    label: "Nemotron 70B",            role: "fallback-1", provider: "NVIDIA" },
          { id: "meta/llama-3.3-70b-instruct",               label: "Llama 3.3 70B",           role: "fallback-2", provider: "Meta via NVIDIA" },
          { id: "meta/llama-3.1-70b-instruct",               label: "Llama 3.1 70B",           role: "fallback-3", provider: "Meta via NVIDIA" },
          { id: "mistralai/mixtral-8x22b-instruct-v0.1",     label: "Mixtral 8x22B",           role: "fallback-4", provider: "Mistral via NVIDIA" },
        ],
      },
    },
    features,
  });
});

// ── GET /stats/public — live platform stats for landing page ──────────────────
app.get("/stats/public", async (_req, res) => {
  try {
    await connectMongo();
    const RecruitJob      = (await import("./models/RecruitJob.js")).RecruitJob;
    const RecruitCandidate = (await import("./models/RecruitCandidate.js")).RecruitCandidate;
    const User            = (await import("./models/User.js")).User;

    const [totalJobs, totalCandidates, totalUsers] = await Promise.all([
      RecruitJob.countDocuments({ status: "active" }),
      RecruitCandidate.countDocuments({}),
      User.countDocuments({}),
    ]);

    return res.json({
      activeJobs: totalJobs,
      candidatesScreened: totalCandidates,
      recruiters: totalUsers,
      aiProvider: "Google Gemini",
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 8080;

connectMongo()
  .then(() => console.log("[db] MongoDB connected"))
  .catch((err) => console.error("[db] MongoDB connection failed:", err?.message || err));

if (process.env.CRON_ENABLED === "true") {
  startDailyBriefingJob();
  startOfferManagementJob();
  startPipelineRulesCron();
}

app.listen(PORT, () => {
  console.log(`Recruit backend listening on port ${PORT} | Auth: custom JWT`);
});
