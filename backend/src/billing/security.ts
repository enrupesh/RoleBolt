import type express from "express";
import { checkRateLimit } from "../publicSubmissionGuard";

/** Keys that must never appear in billing audit logs. */
const PII_FIELD_NAMES = new Set([
  "email",
  "resume",
  "resumeText",
  "resume_text",
  "coverLetter",
  "cover_letter",
  "answer",
  "answers",
  "formAnswers",
  "message",
  "body",
  "content",
  "phone",
  "address",
  "password",
  "token",
  "authorization",
]);

const SECRET_FIELD_NAMES = new Set([
  "razorpay_signature",
  "razorpaySignature",
  "key_secret",
  "keySecret",
  "webhook_secret",
  "webhookSecret",
  "password",
  "secret",
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_TEXT_THRESHOLD = 120;

export type SafeBillingLogMeta = Record<string, unknown>;

/**
 * Redact PII and secrets from billing log metadata.
 * Billing logs must never contain resume text, form answers, or emails.
 */
export function sanitizeBillingLogMeta(
  meta: Record<string, unknown> | undefined,
): SafeBillingLogMeta {
  if (!meta) return {};
  const out: SafeBillingLogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (SECRET_FIELD_NAMES.has(lower) || lower.includes("secret") || lower.includes("password")) {
      out[key] = "[redacted]";
      continue;
    }
    if (PII_FIELD_NAMES.has(lower)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      if (value.length > LONG_TEXT_THRESHOLD) {
        out[key] = `[text:${value.length}chars]`;
        continue;
      }
      out[key] = value.replace(EMAIL_PATTERN, "[email]");
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "string" && item.length > LONG_TEXT_THRESHOLD
          ? `[text:${item.length}chars]`
          : item,
      );
      continue;
    }
    if (value && typeof value === "object") {
      out[key] = sanitizeBillingLogMeta(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function safeBillingLog(
  level: "log" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
): void {
  const payload = sanitizeBillingLogMeta(meta ?? {});
  const line = `[billing][${event}]`;
  if (level === "error") console.error(line, payload);
  else if (level === "warn") console.warn(line, payload);
  else console.log(line, payload);
}

// ── Per-user rate limiter (authenticated expensive operations) ───────────────
// Single-process only — same constraint as publicSubmissionGuard IP limiter.
interface RateWindow {
  count: number;
  resetAt: number;
}

const userBuckets = new Map<string, RateWindow>();
let userSweepAt = Date.now();

function sweepUserBuckets(now: number): void {
  if (now - userSweepAt < 60_000) return;
  userSweepAt = now;
  for (const [key, window] of userBuckets) {
    if (window.resetAt <= now) userBuckets.delete(key);
  }
}

export const BILLING_RATE_LIMITS = {
  seekerAi: { scope: "seeker-ai", limit: 40, windowMs: 10 * 60_000 },
  bulkImport: { scope: "bulk-import", limit: 6, windowMs: 10 * 60_000 },
  parseResume: { scope: "parse-resume", limit: 10, windowMs: 60_000 },
  copilotTurn: { scope: "copilot-turn", limit: 60, windowMs: 10 * 60_000 },
} as const;

export function checkUserRateLimit(
  scope: string,
  userId: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweepUserBuckets(now);
  const key = `${scope}:${userId}`;
  const existing = userBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    userBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.count++;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Reset in-memory buckets — test helper only. */
export function resetBillingRateLimitBucketsForTests(): void {
  userBuckets.clear();
  userSweepAt = Date.now();
}

function uidFromRequest(req: express.Request): string {
  return (
    (req as express.Request & { user?: { uid?: string } }).user?.uid?.trim() ?? ""
  );
}

export function billingUserRateLimit(
  scope: string,
  limit: number,
  windowMs: number,
): express.RequestHandler {
  return (req, res, next) => {
    const uid = uidFromRequest(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const outcome = checkUserRateLimit(scope, uid, limit, windowMs);
    if (!outcome.allowed) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please wait before trying again.",
        retryAfterSeconds: outcome.retryAfterSeconds,
      });
    }
    return next();
  };
}

/** Seeker POST paths that trigger metered AI work. */
export function isSeekerMeteredAiPath(method: string, path: string): boolean {
  if (method !== "POST") return false;
  const aiPaths = [
    "/workspace/",
    "/email/parse",
    "/resume/build",
    "/resume/improve",
    "/resume/export",
    "/cover-letter/generate",
    "/interview-prep/",
    "/profile/optimize",
  ];
  return aiPaths.some((segment) => path.includes(segment));
}

export const seekerAiRateLimit = billingUserRateLimit(
  BILLING_RATE_LIMITS.seekerAi.scope,
  BILLING_RATE_LIMITS.seekerAi.limit,
  BILLING_RATE_LIMITS.seekerAi.windowMs,
);

export const bulkImportRateLimit = billingUserRateLimit(
  BILLING_RATE_LIMITS.bulkImport.scope,
  BILLING_RATE_LIMITS.bulkImport.limit,
  BILLING_RATE_LIMITS.bulkImport.windowMs,
);

export const parseResumeRateLimit = billingUserRateLimit(
  BILLING_RATE_LIMITS.parseResume.scope,
  BILLING_RATE_LIMITS.parseResume.limit,
  BILLING_RATE_LIMITS.parseResume.windowMs,
);

/** IP-scoped limiter for unauthenticated public endpoints (e.g. parse-resume). */
export function billingIpRateLimit(
  scope: string,
  limit: number,
  windowMs: number,
): express.RequestHandler {
  return (req, res, next) => {
    const outcome = checkRateLimit(scope, req, limit, windowMs);
    if (!outcome.allowed) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please wait before trying again.",
        retryAfterSeconds: outcome.retryAfterSeconds,
      });
    }
    return next();
  };
}

export const publicParseResumeRateLimit = billingIpRateLimit(
  BILLING_RATE_LIMITS.parseResume.scope,
  BILLING_RATE_LIMITS.parseResume.limit,
  BILLING_RATE_LIMITS.parseResume.windowMs,
);

export const copilotTurnRateLimit = billingUserRateLimit(
  BILLING_RATE_LIMITS.copilotTurn.scope,
  BILLING_RATE_LIMITS.copilotTurn.limit,
  BILLING_RATE_LIMITS.copilotTurn.windowMs,
);
