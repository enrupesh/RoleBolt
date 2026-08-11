import express from "express";
import { randomUUID } from "node:crypto";
import { connectMongo } from "./db";
import { verifyToken } from "./authMiddleware";
import { RecruitProfile } from "./models/RecruitProfile";
import { User } from "./models/User";
import {
  REVIEW_ROLES,
  REVIEW_SUBMITTER_PLANS,
  RecruitReview,
  RecruitReviewSettings,
  type ReviewRole,
  type ReviewSubmitterPlan,
} from "./models/RecruitReview";
import { getEntitlement } from "./billing/entitlements";
import { PARTNER_REVIEWS } from "./partnerReviews";
import { parseXPostUrls, resolvedFeaturedXPostUrls } from "./xPost";
import { parseYouTubeVideoUrls, resolvedFeaturedVideoReviewUrls } from "./youtubeVideo";

export const reviewsPublicRouter = express.Router();

function reviewDto(review: Record<string, any>) {
  return {
    id: String(review._id),
    rating: Number(review.rating),
    title: String(review.title || ""),
    message: String(review.message || ""),
    displayName: String(review.displayName || "Rolebolt user"),
    role: review.role,
    featured: Boolean(review.featured),
  };
}

/** Idempotent upsert of curated partner reviews (featured on landing + /reviews). */
let partnerReviewsReady: Promise<void> | null = null;
async function ensurePartnerReviews(): Promise<void> {
  if (!partnerReviewsReady) {
    partnerReviewsReady = (async () => {
      await Promise.all(
        PARTNER_REVIEWS.map((review) =>
          RecruitReview.findOneAndUpdate(
            { uid: review.uid },
            {
              $set: {
                uid: review.uid,
                rating: review.rating,
                title: review.title,
                message: review.message,
                displayName: review.displayName,
                role: review.role,
                featured: review.featured,
                visible: review.visible,
                isGuest: review.isGuest,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          ).exec(),
        ),
      );
    })().catch((err) => {
      partnerReviewsReady = null;
      throw err;
    });
  }
  await partnerReviewsReady;
}

async function getSettings() {
  return RecruitReviewSettings.findOneAndUpdate(
    {},
    { $setOnInsert: { allowGuestReviews: false, showFeaturedReviews: true, featuredXPostUrls: [], featuredVideoReviewUrls: [] } },
    { new: true, upsert: true },
  ).lean();
}

function settingsDto(settings: Record<string, any> | null | undefined) {
  return {
    showFeaturedReviews: settings?.showFeaturedReviews !== false,
    allowGuestReviews: settings?.showFeaturedReviews === false,
    featuredXPostUrls: resolvedFeaturedXPostUrls(settings?.featuredXPostUrls),
    featuredVideoReviewUrls: resolvedFeaturedVideoReviewUrls(settings?.featuredVideoReviewUrls),
  };
}

function parseRole(value: unknown): ReviewRole | null {
  const role = String(value || "").trim();
  return (REVIEW_ROLES as readonly string[]).includes(role) ? role as ReviewRole : null;
}

function getOptionalAuth(req: express.Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyToken(header.slice(7));
}

function getGuestEditToken(req: express.Request): string {
  return String(req.headers["x-review-edit-token"] || "").trim();
}

function parseVideoUrl(value: unknown): string {
  const videoUrl = String(value || "").trim();
  if (!videoUrl) return "";
  try {
    const parsed = new URL(videoUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return videoUrl.slice(0, 2048);
  } catch {
    return "";
  }
}

function parseSubmitterPlan(value: unknown): ReviewSubmitterPlan | undefined {
  const plan = String(value || "").trim();
  return (REVIEW_SUBMITTER_PLANS as readonly string[]).includes(plan)
    ? plan as ReviewSubmitterPlan
    : undefined;
}

reviewsPublicRouter.get("/reviews", async (_req, res) => {
  try {
    await connectMongo();
    await ensurePartnerReviews();
    const settings = await getSettings();
    const reviews = await RecruitReview.find({ visible: true })
      .sort({ featured: -1, createdAt: -1 })
      .limit(200)
      .lean();
    return res.json({
      reviews: reviews.map((review) => reviewDto(review as Record<string, any>)),
      ...settingsDto(settings),
    });
  } catch (err: unknown) {
    console.error("[reviews] GET /reviews", err);
    return res.status(500).json({ error: "We couldn't load reviews right now." });
  }
});

reviewsPublicRouter.get("/reviews/featured", async (_req, res) => {
  try {
    await connectMongo();
    await ensurePartnerReviews();
    const settings = await getSettings();
    if (!settings?.showFeaturedReviews) {
      return res.json({
        reviews: [],
        enabled: false,
        featuredXPostUrls: resolvedFeaturedXPostUrls(settings?.featuredXPostUrls),
        featuredVideoReviewUrls: resolvedFeaturedVideoReviewUrls(settings?.featuredVideoReviewUrls),
      });
    }
    const reviews = await RecruitReview.find({ visible: true, featured: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    return res.json({
      reviews: reviews.map((review) => reviewDto(review as Record<string, any>)),
      enabled: true,
      featuredXPostUrls: resolvedFeaturedXPostUrls(settings?.featuredXPostUrls),
      featuredVideoReviewUrls: resolvedFeaturedVideoReviewUrls(settings?.featuredVideoReviewUrls),
    });
  } catch (err: unknown) {
    console.error("[reviews] GET /reviews/featured", err);
    return res.status(500).json({ error: "We couldn't load featured reviews right now." });
  }
});

reviewsPublicRouter.get("/reviews/me", async (req, res) => {
  try {
    const auth = getOptionalAuth(req);
    await connectMongo();
    const review = auth?.sub
      ? await RecruitReview.findOne({ uid: auth.sub }).lean()
      : await RecruitReview.findOne({ editToken: getGuestEditToken(req) }).select("+editToken").lean();
    return res.json({ review: review ? reviewDto(review as Record<string, any>) : null });
  } catch (err: unknown) {
    console.error("[reviews] GET /reviews/me", err);
    return res.status(500).json({ error: "We couldn't load your review right now." });
  }
});

reviewsPublicRouter.post("/reviews", async (req, res) => {
  try {
    await connectMongo();
    const auth = getOptionalAuth(req);
    const roleFromAccount = auth?.sub
      ? (await RecruitProfile.findOne({ uid: auth.sub }).select("role").lean())?.role
      : null;
    const isGuest = !auth?.sub || !roleFromAccount;
    const settings = await getSettings();

    const guestReviewsAllowed = settings?.showFeaturedReviews === false;
    if (isGuest && !guestReviewsAllowed) {
      return res.status(403).json({ error: "Please sign up as a Job Seeker or Job Creator before reviewing Rolebolt." });
    }

    const role = roleFromAccount || parseRole(req.body?.role);
    const videoUrl = parseVideoUrl(req.body?.videoUrl);
    const isVideoReview = Boolean(videoUrl);
    let message = String(req.body?.message || "").trim();
    const title = String(req.body?.title || "").trim();
    const displayName = String(req.body?.displayName || "").trim();
    const rating = Number(req.body?.rating);

    if (isVideoReview && !auth?.sub) {
      return res.status(401).json({ error: "Please sign in before submitting a video review." });
    }
    if (String(req.body?.videoUrl || "").trim() && !videoUrl) {
      return res.status(400).json({ error: "Please enter a valid public video URL." });
    }

    if (!role) return res.status(400).json({ error: "Please choose Job Seeker or Job Creator." });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Please choose a rating from 1 to 5." });
    if (!isVideoReview && message.length < 10) return res.status(400).json({ error: "Please write at least 10 characters." });
    if (isVideoReview && !message) message = "Video review submission — pending admin approval.";
    if (message.length > 2000) return res.status(400).json({ error: "Review must be 2,000 characters or fewer." });
    if (!displayName || displayName.length > 100) return res.status(400).json({ error: "Please enter a display name." });
    if (title.length > 120) return res.status(400).json({ error: "Review title must be 120 characters or fewer." });

    const email = auth?.email || String(req.body?.email || "").trim().toLowerCase();
    const guestEditToken = !auth?.sub ? String(req.body?.editToken || "").trim() : "";
    let submitterPlan = parseSubmitterPlan(req.body?.submitterPlan);
    if (auth?.sub && role === "seeker") {
      try {
        const entitlement = await getEntitlement(auth.sub, "seeker");
        submitterPlan = entitlement.plan;
      } catch {
        // Keep client-provided plan as a fallback for admin reference.
      }
    }

    const update = {
      rating,
      title,
      message,
      displayName,
      role,
      isGuest,
      ...(email ? { email } : {}),
      ...(isVideoReview ? {
        videoUrl,
        visible: false,
        featured: false,
        ...(submitterPlan ? { submitterPlan } : {}),
      } : {
        videoUrl: undefined,
        submitterPlan: undefined,
      }),
    };
    const review = auth?.sub
      ? await RecruitReview.findOneAndUpdate(
        { uid: auth.sub },
        { $set: { ...update, uid: auth.sub } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).lean()
        : guestEditToken
          ? await RecruitReview.findOneAndUpdate(
            { editToken: guestEditToken, isGuest: true },
            { $set: update },
            { new: true },
          ).select("+editToken")
          : await RecruitReview.create({ ...update, editToken: randomUUID() });

    if (!review) {
      return res.status(404).json({ error: "This guest review edit link is no longer valid. Please submit a new review." });
    }

    return res.status(200).json({
      ok: true,
      review: reviewDto(review as Record<string, any>),
      ...(!auth?.sub ? { editToken: String((review as Record<string, any>).editToken || guestEditToken) } : {}),
    });
  } catch (err: unknown) {
    console.error("[reviews] POST /reviews", err);
    return res.status(500).json({ error: "We couldn't save your review right now. Please try again." });
  }
});