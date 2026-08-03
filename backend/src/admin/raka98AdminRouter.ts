import { Router, type NextFunction, type Request, type Response } from "express";
import { connectMongo } from "../db";
import { RecruitCompanyProfile } from "../models/RecruitCompanyProfile";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitProfile } from "../models/RecruitProfile";
import { User } from "../models/User";
import { setCompanyVerificationStatus } from "./companyVerificationSync";

export const raka98AdminRouter = Router();

function getAdminPassword(): string {
  return process.env.RAKA98_ADMIN_PASSWORD?.trim() || "raka@9800";
}

function requireAdminPassword(req: Request, res: Response, next: NextFunction): void {
  const provided = String(req.headers["x-admin-password"] ?? "").trim();
  if (!provided || provided !== getAdminPassword()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

raka98AdminRouter.use(requireAdminPassword);

const PROFILE_TYPE_LABELS: Record<string, string> = {
  company: "Company / Organisation",
  educational_institute: "Educational Institute",
  individual: "Individual / Freelance Recruiter",
  content_creator: "Content Creator / Personal Brand",
  ngo_government: "NGO / Government",
};

function profileHasPublicPresence(profile: {
  website?: string;
  linkedinUrl?: string;
  personalLinkedinUrl?: string;
  socialLinks?: { portfolio?: string };
}): boolean {
  return Boolean(
    String(profile.website ?? "").trim()
    || String(profile.linkedinUrl ?? "").trim()
    || String(profile.personalLinkedinUrl ?? "").trim()
    || String(profile.socialLinks?.portfolio ?? "").trim(),
  );
}

async function buildVerificationRequestDto(profile: Record<string, any>) {
  const uid = String(profile.uid);
  const [recruitProfile, user, jobCount, activeJobCount] = await Promise.all([
    RecruitProfile.findOne({ uid }).select("username email name role").lean(),
    User.findById(uid).select("email name username").lean(),
    RecruitJob.countDocuments({ uid }),
    RecruitJob.countDocuments({ uid, status: "active" }),
  ]);

  const email = String(recruitProfile?.email || user?.email || "").trim();
  const username = String(recruitProfile?.username || user?.username || "").trim();
  const displayName = String(profile.companyName || recruitProfile?.name || user?.name || "").trim();

  return {
    uid,
    email,
    username,
    displayName,
    profileType: profile.profileType || "company",
    profileTypeLabel: PROFILE_TYPE_LABELS[profile.profileType] || profile.profileType || "Profile",
    companyName: profile.companyName || "",
    tagline: profile.tagline || "",
    companyType: profile.companyType || "",
    industry: profile.industry || "",
    companySize: profile.companySize || "",
    location: profile.location || "",
    website: profile.website || "",
    linkedinUrl: profile.linkedinUrl || "",
    personalLinkedinUrl: profile.personalLinkedinUrl || "",
    portfolioUrl: profile.socialLinks?.portfolio || "",
    description: profile.description || "",
    mission: profile.mission || "",
    logoUrl: profile.logoUrl || "",
    photoUrl: profile.photoUrl || "",
    instituteType: profile.instituteType || "",
    affiliationNumber: profile.affiliationNumber || "",
    registrationNumber: profile.registrationNumber || "",
    niche: profile.niche || "",
    verificationStatus: profile.verificationStatus || "none",
    verificationRequestedAt: profile.verificationRequestedAt || null,
    verificationNote: profile.verificationNote || "",
    verifiedAt: profile.verifiedAt || null,
    updatedAt: profile.updatedAt || null,
    jobCount,
    activeJobCount,
    hasPublicPresence: profileHasPublicPresence(profile),
    publicProfileUrl: username ? `/creator/${encodeURIComponent(username)}` : null,
    recruiterProfileUrl: "/recruit/recruiter-profile",
  };
}

raka98AdminRouter.get("/verification-requests", async (req, res) => {
  try {
    await connectMongo();
    const status = String(req.query.status ?? "pending").trim().toLowerCase();

    let filter: Record<string, unknown> = {};
    if (status === "pending" || status === "requested") {
      filter = { verificationStatus: "requested" };
    } else if (status === "verified") {
      filter = { verificationStatus: "verified" };
    } else if (status === "rejected") {
      filter = { verificationStatus: "rejected" };
    } else if (status === "all") {
      filter = { verificationStatus: { $in: ["requested", "verified", "rejected"] } };
    } else {
      return res.status(400).json({ error: "Invalid status filter." });
    }

    const profiles = await RecruitCompanyProfile.find(filter)
      .sort({ verificationRequestedAt: -1, updatedAt: -1 })
      .lean();

    const requests = await Promise.all(profiles.map((profile) => buildVerificationRequestDto(profile)));
    return res.json({ requests, count: requests.length, status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load verification requests.";
    console.error("[admin] GET /verification-requests", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.post("/verification-requests/:uid/verify", async (req, res) => {
  try {
    await connectMongo();
    const uid = String(req.params.uid || "").trim();
    if (!uid) return res.status(400).json({ error: "Missing uid." });

    const note = String(req.body?.note ?? "").trim();
    const result = await setCompanyVerificationStatus(uid, "verified", note);
    const request = await buildVerificationRequestDto(result.profile as Record<string, any>);

    return res.json({
      ok: true,
      message: "Company verified. Verified badge will appear across all listings.",
      jobsUpdated: result.jobsUpdated,
      request,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to verify company.";
    console.error("[admin] POST verify", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.post("/verification-requests/:uid/reject", async (req, res) => {
  try {
    await connectMongo();
    const uid = String(req.params.uid || "").trim();
    if (!uid) return res.status(400).json({ error: "Missing uid." });

    const note = String(req.body?.note ?? "").trim();
    const result = await setCompanyVerificationStatus(uid, "rejected", note);
    const request = await buildVerificationRequestDto(result.profile as Record<string, any>);

    return res.json({
      ok: true,
      message: "Verification request rejected.",
      jobsUpdated: result.jobsUpdated,
      request,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reject verification request.";
    console.error("[admin] POST reject", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.post("/verification-requests/:uid/unverify", async (req, res) => {
  try {
    await connectMongo();
    const uid = String(req.params.uid || "").trim();
    if (!uid) return res.status(400).json({ error: "Missing uid." });

    const note = String(req.body?.note ?? "").trim();
    const result = await setCompanyVerificationStatus(uid, "none", note);
    const request = await buildVerificationRequestDto(result.profile as Record<string, any>);

    return res.json({
      ok: true,
      message: "Company verification removed.",
      jobsUpdated: result.jobsUpdated,
      request,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unverify company.";
    console.error("[admin] POST unverify", err);
    return res.status(500).json({ error: message });
  }
});
