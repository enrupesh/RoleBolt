import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
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

// Clerk middleware — verifies JWT session tokens on every request.
// Reads CLERK_SECRET_KEY from env automatically.
app.use(clerkMiddleware());

// Re-export for any external consumers
export { requireAuth, requireFirebaseAuth } from "./authMiddleware";

// ── Public routes (no auth required) ────────────────────────────────────────
app.use("/recruit-public", recruitPublicRouter);
app.use("/recruit-public/forms", formPublicRouter);
app.use("/recruit-public/site-guide", siteGuideRouter);

// ── Protected routes (Clerk token required) ──────────────────────────────────
app.use("/recruit/copilot", requireAuth, copilotRouter);
app.use("/recruit", requireAuth, recruitRouter);
app.use("/recruit/forms", requireAuth, formRouter);

// ── GET /mesh-api-status ─────────────────────────────────────────────────────
app.get("/mesh-api-status", async (_req, res) => {
  const apiKey = process.env.GOOGLEM_API_KEY || "";
  const meshBaseUrl = "https://api.meshapi.ai/v1";
  const models = [
    { id: "openai/gpt-4o-mini",           role: "primary",    label: "GPT-4o mini" },
    { id: "anthropic/claude-3-haiku",      role: "fallback-1", label: "Claude 3 Haiku" },
    { id: "google/gemini-2.5-flash-lite",  role: "fallback-2", label: "Gemini 2.5 Flash Lite" },
  ];
  const services = [
    { id: "resumeAnalysis",           label: "Resume Analysis" },
    { id: "candidateScoring",         label: "Candidate Scoring" },
    { id: "candidateMatching",        label: "Candidate Matching" },
    { id: "jobDescriptionGeneration", label: "Job Description Generation" },
    { id: "aiAssistant",              label: "AI Recruitment Assistant" },
    { id: "formResponseScoring",      label: "Form Response Scoring" },
  ];

  if (!apiKey) {
    return res.json({
      status: "unavailable",
      reason: "GOOGLEM_API_KEY not configured",
      responseTimeMs: null,
      checkedAt: new Date().toISOString(),
      meshApiUrl: meshBaseUrl,
      apiVersion: "v1",
      models: models.map(m => ({ ...m, status: "unknown" })),
      services: services.map(s => ({ ...s, status: "unknown" })),
      systemHealth: { backend: "operational", meshApi: "unavailable", database: "unknown", auth: "clerk" },
    });
  }

  const startMs = Date.now();
  let meshStatus: "operational" | "degraded" | "unavailable" = "unavailable";
  let responseTimeMs: number | null = null;
  let errorDetail: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let meshRes: Response;
    try {
      meshRes = await fetch(`${meshBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
          temperature: 0,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    responseTimeMs = Date.now() - startMs;
    if (meshRes.ok) {
      meshStatus = responseTimeMs > 5000 ? "degraded" : "operational";
    } else if (meshRes.status >= 500) {
      meshStatus = "degraded";
      errorDetail = `HTTP ${meshRes.status}`;
    } else {
      meshStatus = meshRes.status === 401 ? "unavailable" : "degraded";
      errorDetail = `HTTP ${meshRes.status}`;
    }
  } catch (err: any) {
    responseTimeMs = Date.now() - startMs;
    meshStatus = "unavailable";
    errorDetail = err?.name === "AbortError" ? "Request timed out (>8s)" : err?.message;
  }

  const modelStatus = meshStatus === "operational" ? "operational" : meshStatus;
  const serviceStatus = meshStatus === "operational" ? "operational" : meshStatus;

  return res.json({
    status: meshStatus,
    reason: errorDetail,
    responseTimeMs,
    checkedAt: new Date().toISOString(),
    meshApiUrl: meshBaseUrl,
    apiVersion: "v1",
    models: models.map(m => ({ ...m, status: modelStatus })),
    services: services.map(s => ({ ...s, status: serviceStatus })),
    systemHealth: {
      backend: "operational",
      meshApi: meshStatus,
      database: "operational",
      auth: "clerk",
    },
  });
});

const PORT = Number(process.env.PORT) || 8080;

connectMongo()
  .then(() => console.log("[db] MongoDB connected"))
  .catch((err) => console.error("[db] MongoDB connection failed:", err?.message || err));

app.listen(PORT, () => {
  console.log(`Recruit backend listening on port ${PORT} | Auth: Clerk`);
});
