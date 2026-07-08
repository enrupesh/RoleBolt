import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import admin from "firebase-admin";
import cookieParser from "cookie-parser";
import { recruitRouter, recruitPublicRouter } from "./recruit";
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
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

app.use(express.json({ limit: "2mb" }));

app.use("/recruit-public", recruitPublicRouter);
app.use("/recruit", requireFirebaseAuth, recruitRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "recruit-backend" });
});

const PORT = Number(process.env.PORT) || 8080;

connectMongo()
  .then(() => console.log("[db] MongoDB connected"))
  .catch((err) => console.error("[db] MongoDB connection failed:", err?.message || err));

app.listen(PORT, () => {
  console.log(`Recruit backend listening on port ${PORT}`);
});
