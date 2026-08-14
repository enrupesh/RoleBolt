/**
 * Shared bot/abuse protection for public, unauthenticated candidate-facing writes
 * (job applications and form submissions). Both endpoints persist a document and
 * trigger a paid AI call, so both need the same guard.
 */
import type express from "express";

// ── reCAPTCHA v3 ──────────────────────────────────────────────────────────────
export async function verifyRecaptcha(token: string): Promise<{ ok: boolean; score: number }> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // Key not configured — skip verification (graceful degradation)
    console.warn("[recaptcha] RECAPTCHA_SECRET_KEY not set — skipping bot check.");
    return { ok: true, score: 1 };
  }
  if (!token) return { ok: false, score: 0 };
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data: any = await res.json();
    const score: number = data?.score ?? 0;
    console.log(`[recaptcha] success=${data?.success} score=${score} action=${data?.action}`);
    return { ok: data?.success === true && score >= 0.5, score };
  } catch (err: any) {
    console.warn("[recaptcha] Verification request failed:", err?.message);
    return { ok: true, score: 1 }; // network failure → allow (don't block real users)
  }
}

export const RECAPTCHA_REJECTION_MESSAGE =
  "Our spam filter flagged this submission as automated. Please refresh the page and try again.";

// ── Fixed-window per-IP rate limiter (in-memory) ──────────────────────────────
// Single-process only; enough to stop a naive flood from burning AI credits.
// Move to Redis if the API is ever run with more than one instance.
interface Window { count: number; resetAt: number }

const buckets = new Map<string, Window>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key);
  }
}

export function clientIp(req: express.Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw?.split(",")[0].trim() || req.ip || req.socket.remoteAddress || "unknown");
}

/**
 * Returns `{ allowed: false, retryAfterSeconds }` once `limit` submissions from the
 * same IP have been seen within `windowMs`.
 */
export function checkRateLimit(
  scope: string,
  req: express.Request,
  limit = 8,
  windowMs = 10 * 60 * 1000,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);

  const key = `${scope}:${clientIp(req)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
