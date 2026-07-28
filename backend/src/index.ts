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

const PORT = Number(process.env.PORT) || 8080;

connectMongo()
  .then(() => console.log("[db] MongoDB connected"))
  .catch((err) => console.error("[db] MongoDB connection failed:", err?.message || err));

app.listen(PORT, () => {
  console.log(`Recruit backend listening on port ${PORT} | Auth: custom JWT`);
});
