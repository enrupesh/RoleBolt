import type { Request, Response, NextFunction } from "express";
import { connectMongo } from "../db";
import { RecruitProfile } from "../models/RecruitProfile";
import { canAccessSeekerRole } from "../judgeReviewer";

/** Ensures the authenticated user has seeker role (not just any JWT). */
export async function requireSeekerRole(req: Request, res: Response, next: NextFunction) {
  try {
    const uid = (req as any).user?.uid ?? "";
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    await connectMongo();
    const profile = await RecruitProfile.findOne({ uid }).select("role").lean() as { role?: string } | null;
    if (!profile || !canAccessSeekerRole((req as any).user?.email, profile.role)) {
      return res.status(403).json({ error: "This area is for job seekers only." });
    }
    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Authorization failed." });
  }
}
