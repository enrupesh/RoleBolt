import type express from "express";
import { checkRateLimit } from "../../../publicSubmissionGuard";

export const SITEGEN_RATE_LIMITS = {
  login: { scope: "sitegen-login", limit: 20, windowMs: 10 * 60_000 },
  createDraft: { scope: "sitegen-create-draft", limit: 12, windowMs: 10 * 60_000 },
  usernameCheck: { scope: "sitegen-username-check", limit: 60, windowMs: 10 * 60_000 },
} as const;

export function sitegenRateLimit(
  scope: string,
  limit: number,
  windowMs: number,
): express.RequestHandler {
  return (req, res, next) => {
    const result = checkRateLimit(scope, req, limit, windowMs);
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      return res.status(429).json({
        error: "Too many attempts. Please wait a few minutes and try again.",
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
    return next();
  };
}
