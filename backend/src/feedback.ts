import express from "express";
import { connectMongo } from "./db";
import {
  FEEDBACK_CATEGORIES,
  RecruitFeedback,
  type FeedbackCategory,
} from "./models/RecruitFeedback";

export const feedbackPublicRouter = express.Router();

const CATEGORY_SET = new Set<string>(FEEDBACK_CATEGORIES);

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeCategory(value: unknown): FeedbackCategory | null {
  const category = String(value ?? "").trim();
  return CATEGORY_SET.has(category) ? category as FeedbackCategory : null;
}

feedbackPublicRouter.post("/feedback", async (req, res) => {
  try {
    const category = normalizeCategory(req.body?.category);
    const message = String(req.body?.message ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const pageUrl = String(req.body?.pageUrl ?? "").trim();

    if (!category) {
      return res.status(400).json({ error: "Please choose a feedback category." });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: "Please share a little more detail (at least 10 characters)." });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: "Feedback must be 5,000 characters or fewer." });
    }
    if (email && (email.length > 254 || !isValidEmail(email))) {
      return res.status(400).json({ error: "Please enter a valid email address, or leave it blank." });
    }

    await connectMongo();
    const feedback = await RecruitFeedback.create({
      category,
      message,
      ...(email ? { email } : {}),
      ...(pageUrl ? { pageUrl: pageUrl.slice(0, 500) } : {}),
    });

    return res.status(201).json({
      ok: true,
      feedbackId: String(feedback._id),
      message: "Thank you for helping us make Rolebolt better.",
    });
  } catch (err: unknown) {
    console.error("[feedback] POST /feedback", err);
    return res.status(500).json({ error: "We couldn't save your feedback right now. Please try again." });
  }
});