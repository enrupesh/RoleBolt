import express from "express";

/**
 * Auth middleware — NO-OP (auth removed).
 * All routes are open. Replace this with your custom auth logic.
 * Sets req.user = { uid: "anonymous" } as a placeholder.
 */
export async function requireAuth(
  _req: express.Request,
  _res: express.Response,
  next: express.NextFunction
) {
  return next();
}

// Alias kept for any remaining internal references
export const requireFirebaseAuth = requireAuth;
