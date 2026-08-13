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
import {
  FEEDBACK_CATEGORIES,
  RecruitFeedback,
  type FeedbackCategory,
} from "../models/RecruitFeedback";
import { RecruitReview, RecruitReviewSettings } from "../models/RecruitReview";
import { parseXPostUrls, resolvedFeaturedXPostUrls } from "../xPost";
import { parseYouTubeVideoUrls, resolvedFeaturedVideoReviewUrls } from "../youtubeVideo";
import { RecruitAuthSettings } from "../models/RecruitAuthSettings";

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

raka98AdminRouter.get("/auth-settings", async (_req, res) => {
  try {
    await connectMongo();
    const settings = await RecruitAuthSettings.findOne().lean();
    return res.json({
      settings: {
        requireEmailVerification: settings?.requireEmailVerification !== false,
      },
    });
  } catch (err: any) {
    console.error("[admin] GET /auth-settings", err);
    return res.status(500).json({ error: "Failed to load authentication settings." });
  }
});

raka98AdminRouter.patch("/auth-settings", async (req, res) => {
  try {
    await connectMongo();
    if (typeof req.body?.requireEmailVerification !== "boolean") {
      return res.status(400).json({ error: "requireEmailVerification must be a boolean." });
    }
    const settings = await RecruitAuthSettings.findOneAndUpdate(
      {},
      { $set: { requireEmailVerification: req.body.requireEmailVerification } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({
      settings: {
        requireEmailVerification: settings?.requireEmailVerification !== false,
      },
    });
  } catch (err: any) {
    console.error("[admin] PATCH /auth-settings", err);
    return res.status(500).json({ error: "Failed to update authentication settings." });
  }
});

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

function feedbackDto(feedback: Record<string, any>) {
  return {
    id: String(feedback._id),
    category: feedback.category,
    message: feedback.message,
    email: feedback.email || "",
    pageUrl: feedback.pageUrl || "",
    readAt: feedback.readAt || null,
    createdAt: feedback.createdAt || null,
  };
}

function isFeedbackCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

raka98AdminRouter.get("/feedback", async (req, res) => {
  try {
    await connectMongo();
    const category = String(req.query.category ?? "all").trim();
    const status = String(req.query.status ?? "all").trim();

    const filter: Record<string, unknown> = {};
    if (category !== "all") {
      if (!isFeedbackCategory(category)) {
        return res.status(400).json({ error: "Invalid feedback category." });
      }
      filter.category = category;
    }
    if (status === "unread") filter.readAt = null;
    else if (status === "read") filter.readAt = { $ne: null };
    else if (status !== "all") return res.status(400).json({ error: "Invalid feedback status." });

    const [feedback, unreadCount] = await Promise.all([
      RecruitFeedback.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
      RecruitFeedback.countDocuments({ readAt: null }),
    ]);

    return res.json({
      feedback: feedback.map((item) => feedbackDto(item as Record<string, any>)),
      count: feedback.length,
      unreadCount,
      categories: FEEDBACK_CATEGORIES,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load feedback.";
    console.error("[admin] GET /feedback", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.patch("/feedback/:id/read", async (req, res) => {
  try {
    await connectMongo();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing feedback id." });

    const read = req.body?.read !== false;
    const feedback = await RecruitFeedback.findByIdAndUpdate(
      id,
      { $set: { readAt: read ? new Date() : null } },
      { new: true },
    ).lean();
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });

    return res.json({ ok: true, feedback: feedbackDto(feedback as Record<string, any>) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update feedback.";
    console.error("[admin] PATCH /feedback/:id/read", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.delete("/feedback/:id", async (req, res) => {
  try {
    await connectMongo();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing feedback id." });
    const result = await RecruitFeedback.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: "Feedback not found." });
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete feedback.";
    console.error("[admin] DELETE /feedback/:id", err);
    return res.status(500).json({ error: message });
  }
});

function reviewDto(review: Record<string, any>) {
  return {
    id: String(review._id),
    rating: Number(review.rating),
    title: String(review.title || ""),
    message: String(review.message || ""),
    displayName: String(review.displayName || ""),
    role: review.role,
    isGuest: Boolean(review.isGuest),
    featured: Boolean(review.featured),
    visible: review.visible !== false,
    createdAt: review.createdAt || null,
    email: String(review.email || ""),
    videoUrl: String(review.videoUrl || ""),
    submitterPlan: review.submitterPlan || null,
  };
}

async function getReviewSettings() {
  return RecruitReviewSettings.findOneAndUpdate(
    {},
    { $setOnInsert: { allowGuestReviews: false, showFeaturedReviews: true, featuredXPostUrls: [], featuredVideoReviewUrls: [] } },
    { new: true, upsert: true },
  ).lean();
}

function reviewSettingsDto(settings: Record<string, any> | null | undefined) {
  return {
    allowGuestReviews: settings?.showFeaturedReviews === false,
    showFeaturedReviews: settings?.showFeaturedReviews !== false,
    featuredXPostUrls: resolvedFeaturedXPostUrls(settings?.featuredXPostUrls),
    savedFeaturedXPostUrls: parseXPostUrls(settings?.featuredXPostUrls),
    featuredVideoReviewUrls: resolvedFeaturedVideoReviewUrls(settings?.featuredVideoReviewUrls),
    savedFeaturedVideoReviewUrls: parseYouTubeVideoUrls(settings?.featuredVideoReviewUrls),
  };
}

raka98AdminRouter.get("/reviews", async (_req, res) => {
  try {
    await connectMongo();
    const [reviews, settings] = await Promise.all([
      RecruitReview.find({}).sort({ createdAt: -1 }).limit(500).lean(),
      getReviewSettings(),
    ]);
    return res.json({
      reviews: reviews.map((item) => reviewDto(item as Record<string, any>)),
      settings: reviewSettingsDto(settings as Record<string, any>),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load reviews.";
    console.error("[admin] GET /reviews", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.patch("/reviews/settings", async (req, res) => {
  try {
    await connectMongo();
    const update: Record<string, boolean | string[]> = {};
    if (typeof req.body?.allowGuestReviews === "boolean") update.allowGuestReviews = req.body.allowGuestReviews;
    if (typeof req.body?.showFeaturedReviews === "boolean") {
      update.showFeaturedReviews = req.body.showFeaturedReviews;
      update.allowGuestReviews = !req.body.showFeaturedReviews;
    }
    if (typeof req.body?.allowGuestReviews === "boolean" && typeof req.body?.showFeaturedReviews !== "boolean") {
      update.allowGuestReviews = req.body.allowGuestReviews;
      update.showFeaturedReviews = !req.body.allowGuestReviews;
    }
    if (req.body?.featuredXPostUrls !== undefined) {
      update.featuredXPostUrls = parseXPostUrls(req.body.featuredXPostUrls);
    }
    if (req.body?.featuredVideoReviewUrls !== undefined) {
      update.featuredVideoReviewUrls = parseYouTubeVideoUrls(req.body.featuredVideoReviewUrls);
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: "No review setting was provided." });
    const current = await getReviewSettings();
    const settings = await RecruitReviewSettings.findByIdAndUpdate(
      current?._id,
      { $set: update },
      { new: true },
    ).lean();
    return res.json({
      ok: true,
      settings: reviewSettingsDto(settings as Record<string, any>),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update review settings.";
    console.error("[admin] PATCH /reviews/settings", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.patch("/reviews/:id", async (req, res) => {
  try {
    await connectMongo();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing review id." });
    const update: Record<string, boolean> = {};
    if (typeof req.body?.featured === "boolean") update.featured = req.body.featured;
    if (typeof req.body?.visible === "boolean") update.visible = req.body.visible;
    if (!Object.keys(update).length) return res.status(400).json({ error: "No review change was provided." });
    const review = await RecruitReview.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!review) return res.status(404).json({ error: "Review not found." });
    return res.json({ ok: true, review: reviewDto(review as Record<string, any>) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update review.";
    console.error("[admin] PATCH /reviews/:id", err);
    return res.status(500).json({ error: message });
  }
});

raka98AdminRouter.delete("/reviews/:id", async (req, res) => {
  try {
    await connectMongo();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing review id." });
    const result = await RecruitReview.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: "Review not found." });
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete review.";
    console.error("[admin] DELETE /reviews/:id", err);
    return res.status(500).json({ error: message });
  }
});

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
