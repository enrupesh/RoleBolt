import express from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "";

if (!JWT_SECRET) {
  console.warn("[auth] SESSION_SECRET is not set — JWT signing will fail in production.");
}

export interface JwtPayload {
  sub: string;   // User _id as string
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as any).user = { uid: payload.sub, email: payload.email };
  return next();
}

// Backward-compatible alias
export const requireFirebaseAuth = requireAuth;
