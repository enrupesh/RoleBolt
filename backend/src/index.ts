import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { authRouter } from "./auth";
import { requireAuth } from "./authMiddleware";
import { recruitRouter, recruitPublicRouter } from "./recruit";
import { formRouter, formPublicRouter } from "./recruitForms";
import { copilotRouter } from "./recruitCopilot";
import { siteGuideRouter } from "./siteGuideChat";
import { connectMongo } from "./db";

dotenv.config();

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

app.use(express.json({ limit: "6mb" }));

// ── Health check (before auth middleware so it always works) ─────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "recruit-backend" });
});

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.use("/auth", authRouter);

// ── Public routes ─────────────────────────────────────────────────────────────
app.use("/recruit-public", recruitPublicRouter);
app.use("/recruit-public/forms", formPublicRouter);
app.use("/recruit-public/site-guide", siteGuideRouter);

// ── Protected routes (JWT required) ──────────────────────────────────────────
app.use("/recruit/copilot", requireAuth, copilotRouter);
app.use("/recruit", requireAuth, recruitRouter);
app.use("/recruit/forms", requireAuth, formRouter);

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
  const googleMKey = process.env.GOOGLEM_API_KEY || "";
  const googleNKey = process.env.GOOGLEN_API_KEY || "";
  const googleKey  = process.env.GOOGLE_API_KEY  || "";
  const resendKey  = process.env.RESEND_API_KEY  || "";
  const sessionKey = process.env.SESSION_SECRET  || "";

  const totalStart = Date.now();

  // ── Ping all three AI APIs in parallel ─────────────────────────────────────
  const [googleMResult, googleNResult, googleResult] = await Promise.all([
    // Google M API (Mesh)
    googleMKey
      ? pingApi({
          url: "https://api.meshapi.ai/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer ${googleMKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
          timeoutMs: 9000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GOOGLEM_API_KEY not configured" }),

    // Google N API (NVIDIA NIM)
    googleNKey
      ? pingApi({
          url: "https://integrate.api.nvidia.com/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer ${googleNKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "nvidia/llama-3.1-nemotron-70b-instruct", messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
          timeoutMs: 11000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GOOGLEN_API_KEY not configured" }),

    // Google API (Gemini — list models endpoint, no chat needed)
    googleKey
      ? pingApi({
          url: `https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}&pageSize=1`,
          headers: {},
          timeoutMs: 8000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GOOGLE_API_KEY not configured" }),
  ]);

  // ── Infrastructure status ───────────────────────────────────────────────────
  const mongoose = (await import("mongoose")).default;
  const dbStatus: "operational" | "unavailable" =
    mongoose.connection.readyState === 1 ? "operational" : "unavailable";

  const authStatus:  "operational" | "unavailable" = sessionKey ? "operational" : "unavailable";
  const emailStatus: "operational" | "unavailable" = resendKey  ? "operational" : "unavailable";

  // ── Overall status ──────────────────────────────────────────────────────────
  const aiStatuses = [googleMResult.status, googleNResult.status, googleResult.status];
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
      googleM: { ...googleMResult, endpoint: "api.meshapi.ai",                        label: "Google M API" },
      googleN: { ...googleNResult, endpoint: "integrate.api.nvidia.com",              label: "Google N API" },
      google:  { ...googleResult,  endpoint: "generativelanguage.googleapis.com",     label: "Google API"   },
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
    responseTimeMs: googleMResult.responseTimeMs,
    models: [
      { id: "openai/gpt-4o-mini",           role: "primary",    label: "GPT-4o mini",          status: googleMResult.status },
      { id: "anthropic/claude-3-haiku",      role: "fallback-1", label: "Claude 3 Haiku",        status: googleMResult.status },
      { id: "google/gemini-2.5-flash-lite",  role: "fallback-2", label: "Gemini 2.5 Flash Lite", status: googleMResult.status },
    ],
    services: [
      { id: "resumeAnalysis",           label: "Resume Analysis",            status: googleMResult.status },
      { id: "candidateScoring",         label: "Candidate Scoring",          status: googleMResult.status },
      { id: "candidateMatching",        label: "Candidate Matching",         status: googleMResult.status },
      { id: "jobDescriptionGeneration", label: "Job Description Generation", status: googleMResult.status },
      { id: "aiAssistant",              label: "AI Recruitment Assistant",   status: googleMResult.status },
      { id: "formResponseScoring",      label: "Form Response Scoring",      status: googleMResult.status },
    ],
  });
}

app.get("/status",          handleStatusRoute);
app.get("/mesh-api-status", handleStatusRoute); // legacy alias

// ── GET /ai-routing — detailed routing intelligence for admin dashboard ────────
app.get("/ai-routing", async (_req, res) => {
  const googleMKey = process.env.GOOGLEM_API_KEY || "";
  const googleNKey = process.env.GOOGLEN_API_KEY || "";
  const googleKey  = process.env.GOOGLE_API_KEY  || "";

  // Ping all three in parallel
  const [googleMResult, googleNResult, googleResult] = await Promise.all([
    googleMKey
      ? pingApi({
          url: "https://api.meshapi.ai/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer ${googleMKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
          timeoutMs: 9000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GOOGLEM_API_KEY not configured" }),

    googleNKey
      ? pingApi({
          url: "https://integrate.api.nvidia.com/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer ${googleNKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "nvidia/llama-3.1-nemotron-70b-instruct", messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
          timeoutMs: 11000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GOOGLEN_API_KEY not configured" }),

    googleKey
      ? pingApi({
          url: `https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}&pageSize=1`,
          headers: {},
          timeoutMs: 8000,
        })
      : Promise.resolve({ status: "unavailable" as const, responseTimeMs: 0, error: "GOOGLE_API_KEY not configured" }),
  ]);

  const mUp = googleMResult.status !== "unavailable";
  const nUp = googleNResult.status !== "unavailable";
  const gUp = googleResult.status  !== "unavailable";

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
      googleM: {
        label: "Google M API",
        sublabel: "Mesh API Gateway",
        endpoint: "api.meshapi.ai",
        keyConfigured: !!googleMKey,
        status: googleMResult.status,
        responseTimeMs: googleMResult.responseTimeMs,
        error: googleMResult.error,
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
      google: {
        label: "Google API",
        sublabel: "Gemini Direct",
        endpoint: "generativelanguage.googleapis.com",
        keyConfigured: !!googleKey,
        status: googleResult.status,
        responseTimeMs: googleResult.responseTimeMs,
        error: googleResult.error,
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
        keyConfigured: !!googleNKey,
        status: googleNResult.status,
        responseTimeMs: googleNResult.responseTimeMs,
        error: googleNResult.error,
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

const PORT = Number(process.env.PORT) || 8080;

connectMongo()
  .then(() => console.log("[db] MongoDB connected"))
  .catch((err) => console.error("[db] MongoDB connection failed:", err?.message || err));

app.listen(PORT, () => {
  console.log(`Recruit backend listening on port ${PORT} | Auth: custom JWT`);
});
