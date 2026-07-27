import express from "express";
import { getAuth } from "@clerk/express";

/**
 * Clerk-based auth middleware.
 * Reads the Clerk session token from the Authorization header or cookie,
 * verifies it with Clerk, and sets req.user = { uid: userId }.
 */
export async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    (req as any).user = { uid: userId };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Backward-compatible alias used in recruitCopilot.ts
export const requireFirebaseAuth = requireAuth;
