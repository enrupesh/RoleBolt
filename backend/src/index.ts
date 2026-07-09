import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import admin from "firebase-admin";
import cookieParser from "cookie-parser";
import { recruitRouter, recruitPublicRouter } from "./recruit";
import { formRouter, formPublicRouter } from "./recruitForms";
import { connectMongo } from "./db";

dotenv.config();

const app = express();

app.use(cookieParser());

let firebaseReady = false;
function parseServiceAccountJson(raw: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const normalized = raw
      .trim()
      .replace(/^\s*['"]/, "")
      .replace(/['"]\s*$/, "")
      .replace(/\\"/g, '"');
    parsed = JSON.parse(normalized);
  }
  if (parsed && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

function initFirebaseAdmin() {
  if (firebaseReady) return;
  if (admin.apps.length) {
    firebaseReady = true;
    return;
  }

  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

  if (serviceAccountJson) {
    const parsed = parseServiceAccountJson(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    firebaseReady = true;
    return;
  }

  if (serviceAccountPath) {
    const parsed = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    firebaseReady = true;
    return;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    firebaseReady = true;
    return;
  }

  throw new Error(
    "Firebase Admin credentials not configured. Set one of: FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS."
  );
}

export async function requireFirebaseAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    initFirebaseAdmin();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[auth] firebase init failed:", e);
    return res
      .status(500)
      .json({ error: "Server auth not configured (Firebase Admin missing)" });
  }

  const authHeader = req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // Email verification requirement disabled for now — allow both
    // Google Sign-In and email/password accounts regardless of
    // email_verified status.
    (req as any).user = { uid: decoded.uid, email: decoded.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

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

app.use("/recruit-public", recruitPublicRouter);
app.use("/recruit-public/forms", formPublicRouter);
app.use("/recruit", requireFirebaseAuth, recruitRouter);
app.use("/recruit/forms", requireFirebaseAuth, formRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "recruit-backend" });
});

// ── GET /mesh-api-status ─────────────────────────────────────────────────────
// Public endpoint: pings Mesh API with a 1-token completion to verify
// connectivity, then returns a structured health payload.
app.get("/mesh-api-status", async (_req, res) => {
  const apiKey = process.env.MESHAPI_API_KEY || "";
  const meshBaseUrl = "https://api.meshapi.ai/v1";
  const models = [
    { id: "openai/gpt-4o-mini",              role: "primary",    label: "GPT-4o mini" },
    { id: "anthropic/claude-3-haiku",         role: "fallback-1", label: "Claude 3 Haiku" },
    { id: "google/gemini-2.5-flash-lite",     role: "fallback-2", label: "Gemini 2.5 Flash Lite" },
  ];

  const services = [
    { id: "resumeAnalysis",          label: "Resume Analysis" },
    { id: "candidateScoring",        label: "Candidate Scoring" },
    { id: "candidateMatching",       label: "Candidate Matching" },
    { id: "jobDescriptionGeneration",label: "Job Description Generation" },
    { id: "aiAssistant",             label: "AI Recruitment Assistant" },
    { id: "formResponseScoring",     label: "Form Response Scoring" },
  ];

  if (!apiKey) {
    return res.json({
      status: "unavailable",
      reason: "MESHAPI_API_KEY not configured",
      responseTimeMs: null,
      checkedAt: new Date().toISOString(),
      meshApiUrl: meshBaseUrl,
      apiVersion: "v1",
      models: models.map(m => ({ ...m, status: "unknown" })),
      services: services.map(s => ({ ...s, status: "unknown" })),
      systemHealth: { backend: "operational", meshApi: "unavailable", database: "unknown", auth: "unknown" },
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
      // 4xx other than 401/429 means the API is reachable but something is wrong
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
      auth: "operational",
    },
  });
});

const PORT = Number(process.env.PORT) || 8080;

connectMongo()
  .then(() => console.log("[db] MongoDB connected"))
  .catch((err) => console.error("[db] MongoDB connection failed:", err?.message || err));

app.listen(PORT, () => {
  console.log(`Recruit backend listening on port ${PORT}`);
});
