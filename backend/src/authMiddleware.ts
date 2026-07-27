import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "./auth";

export async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    (req as any).user = { uid: session.user.id, email: session.user.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Backward-compatible alias
export const requireFirebaseAuth = requireAuth;
