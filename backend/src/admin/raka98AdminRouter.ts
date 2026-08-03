import { Router, type NextFunction, type Request, type Response } from "express";
import { connectMongo } from "../db";
import { RecruitCompanyProfile } from "../models/RecruitCompanyProfile";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitProfile } from "../models/RecruitProfile";
import { User } from "../models/User";
import { setCompanyVerificationStatus } from "./companyVerificationSync";
import {
  grantAdminPlans,
  lookupAdminUser,
  revokeAdminPlans,
} from "./adminPlanGrant";
import { BILLING_CATEGORIES, type BillingCategory } from "../billingTypes";

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

raka98AdminRouter.get("/users/lookup", async (req, res) => {
  try {
    await connectMongo();
    const query = String(req.query.q ?? "").trim();
    if (!query) return res.status(400).json({ error: "Enter an email or username." });

    const user = await lookupAdminUser(query);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to look up user.";
    console.error("[admin] GET /users/lookup", err);
    return res.status(500).json({ error: message });
  }
});

function parseCategories(input: unknown): BillingCategory[] {
  const raw = Array.isArray(input) ? input : [];
  const categories = raw
    .map((value) => String(value).trim())
    .filter((value): value is BillingCategory =>
      (BILLING_CATEGORIES as readonly string[]).includes(value),
    );
  return Array.from(new Set(categories));
}

raka98AdminRouter.post("/users/:uid/plans/grant", async (req, res) => {
  try {
    await connectMongo();
    const uid = String(req.params.uid || "").trim();
    if (!uid) return res.status(400).json({ error: "Missing uid." });

    const plan = String(req.body?.plan ?? "").trim();
    const interval = String(req.body?.interval ?? "monthly").trim();
    const categories = parseCategories(req.body?.categories);
    const note = String(req.body?.note ?? "").trim();

    if (plan !== "pro" && plan !== "ultra") {
      return res.status(400).json({ error: "Plan must be pro or ultra." });
    }
    if (categories.length === 0) {
      return res.status(400).json({ error: "Select at least one category." });
    }

    const result = await grantAdminPlans({
      userId: uid,
      categories,
      plan,
      interval: interval === "yearly" ? "yearly" : "monthly",
      note,
    });

    return res.json({
      ok: true,
      message: `Granted ${plan} on ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to grant plan.";
    console.error("[admin] POST /users/plans/grant", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.post("/users/:uid/plans/revoke", async (req, res) => {
  try {
    await connectMongo();
    const uid = String(req.params.uid || "").trim();
    if (!uid) return res.status(400).json({ error: "Missing uid." });

    const categories = parseCategories(req.body?.categories);
    const note = String(req.body?.note ?? "").trim();
    if (categories.length === 0) {
      return res.status(400).json({ error: "Select at least one category." });
    }

    const result = await revokeAdminPlans({ userId: uid, categories, note });
    return res.json({
      ok: true,
      message: `Reset ${categories.length} categor${categories.length === 1 ? "y" : "ies"} to Free.`,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to revoke plan.";
    console.error("[admin] POST /users/plans/revoke", err);
    return res.status(500).json({ error: message });
  }
});
