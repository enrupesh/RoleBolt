import express from "express";
import bcrypt from "bcryptjs";
import { connectMongo } from "../../../db";
import { SitegenWebsite, SITEGEN_SITE_TYPES } from "../models/SitegenWebsite";
import {
  isSitegenUsernameGloballyAvailable,
  validateSitegenUsername,
} from "../lib/username";
import { signSitegenAccessToken } from "../lib/token";

export const sitegenPublicRouter = express.Router();

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN = 8;

function websitePublicDto(website: { _id: { toString(): string }; username: string; siteType: string; status: string }) {
  return {
    id: website._id.toString(),
    username: website.username,
    siteType: website.siteType,
    status: website.status,
    publicUrl: `https://www.rolebolt.tech/${website.username}`,
  };
}

function parseSiteType(value: unknown): "seeker" | "creator" | null {
  const siteType = String(value || "").trim();
  return (SITEGEN_SITE_TYPES as readonly string[]).includes(siteType)
    ? siteType as "seeker" | "creator"
    : null;
}

sitegenPublicRouter.get("/usernames/check", async (req, res) => {
  try {
    const parsed = validateSitegenUsername(req.query.username);
    if ("error" in parsed) {
      return res.json({ available: false, error: parsed.error, username: normalizeQueryUsername(req.query.username) });
    }

    const available = await isSitegenUsernameGloballyAvailable(parsed.username);
    return res.json({ available, username: parsed.username });
  } catch (err: unknown) {
    console.error("[sitegen] GET /usernames/check", err);
    return res.status(500).json({ error: "We couldn't check that username right now." });
  }
});

sitegenPublicRouter.post("/drafts", async (req, res) => {
  try {
    await connectMongo();

    const parsed = validateSitegenUsername(req.body?.username);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });

    const siteType = parseSiteType(req.body?.siteType);
    if (!siteType) return res.status(400).json({ error: "Please choose Job Seeker or Creator / Business." });

    const password = String(req.body?.password || "");
    if (!password) return res.status(400).json({ error: "Password is required." });
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters.` });
    }

    const available = await isSitegenUsernameGloballyAvailable(parsed.username);
    if (!available) {
      return res.status(409).json({ error: "This username is already taken. Please choose another." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const website = await SitegenWebsite.create({
      username: parsed.username,
      passwordHash,
      siteType,
      status: "draft",
    });

    const accessToken = signSitegenAccessToken({
      sub: website._id.toString(),
      username: website.username,
    });

    return res.status(201).json({
      ok: true,
      website: websitePublicDto(website),
      accessToken,
    });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return res.status(409).json({ error: "This username is already taken. Please choose another." });
    }
    console.error("[sitegen] POST /drafts", err);
    return res.status(500).json({ error: "We couldn't create your website draft right now." });
  }
});

function normalizeQueryUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}
