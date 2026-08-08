import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { connectMongo } from "../../../db";
import { SitegenWebsite, SITEGEN_SITE_TYPES } from "../models/SitegenWebsite";
import { SitegenImage } from "../models/SitegenImage";
import {
  isSitegenUsernameGloballyAvailable,
  validateSitegenUsername,
} from "../lib/username";
import { signSitegenAccessToken } from "../lib/token";
import { requireSitegenAuth } from "../middleware/requireSitegenAuth";
import { sitegenWebsiteDto } from "../lib/dto";
import { extractResumeTextFromFile } from "../lib/resumeText";
import {
  parseCreatorProfile,
  parseSeekerProfile,
  validateCreatorProfileSubmission,
  validateSeekerProfileSubmission,
} from "../lib/validateProfile";
import { structureSitegenWebsite } from "../ai/structuring";
import { isThemeAllowedForSiteType } from "../ai/themeMapping";
import type { SitegenThemeId } from "../types/structuredContent";

export const sitegenPublicRouter = express.Router();

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN = 8;

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ]);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file."));
  },
});

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
      website: sitegenWebsiteDto(website),
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

sitegenPublicRouter.post("/auth/login", async (req, res) => {
  try {
    await connectMongo();
    const parsed = validateSitegenUsername(req.body?.username);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });

    const password = String(req.body?.password || "");
    if (!password) return res.status(400).json({ error: "Password is required." });

    const website = await SitegenWebsite.findOne({ username: parsed.username }).select("+passwordHash");
    if (!website?.passwordHash) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const valid = await bcrypt.compare(password, website.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password." });

    const accessToken = signSitegenAccessToken({
      sub: website._id.toString(),
      username: website.username,
    });

    return res.json({
      ok: true,
      website: sitegenWebsiteDto(website),
      accessToken,
    });
  } catch (err: unknown) {
    console.error("[sitegen] POST /auth/login", err);
    return res.status(500).json({ error: "We couldn't sign you in right now." });
  }
});

sitegenPublicRouter.get("/drafts/me", requireSitegenAuth, async (req, res) => {
  return res.json({ website: sitegenWebsiteDto(req.sitegen!.website) });
});

sitegenPublicRouter.patch("/drafts/me", requireSitegenAuth, async (req, res) => {
  try {
    const website = req.sitegen!.website;
    const complete = Boolean(req.body?.complete);

    if (website.siteType === "seeker") {
      const parsed = parseSeekerProfile(req.body?.seekerProfile ?? req.body);
      if (parsed.error || !parsed.profile) return res.status(400).json({ error: parsed.error || "Invalid profile data." });

      const inputMode = req.body?.inputMode === "resume" ? "resume" : "manual";
      const resumeText = String(req.body?.resumeText ?? website.resumeText ?? "").trim();

      if (complete) {
        const validationError = validateSeekerProfileSubmission({
          profile: parsed.profile,
          resumeText,
          inputMode,
        });
        if (validationError) return res.status(400).json({ error: validationError });
      }

      website.inputMode = inputMode;
      website.seekerProfile = parsed.profile;
      if (resumeText) website.resumeText = resumeText.slice(0, 50000);
      website.infoCompletedAt = complete ? new Date() : website.infoCompletedAt;
      await website.save();
      return res.json({ ok: true, website: sitegenWebsiteDto(website) });
    }

    const parsed = parseCreatorProfile(req.body?.creatorProfile ?? req.body);
    if (parsed.error || !parsed.profile) return res.status(400).json({ error: parsed.error || "Invalid profile data." });

    if (complete) {
      const validationError = validateCreatorProfileSubmission(parsed.profile);
      if (validationError) return res.status(400).json({ error: validationError });
    }

    website.creatorProfile = parsed.profile;
    website.infoCompletedAt = complete ? new Date() : website.infoCompletedAt;
    await website.save();
    return res.json({ ok: true, website: sitegenWebsiteDto(website) });
  } catch (err: unknown) {
    console.error("[sitegen] PATCH /drafts/me", err);
    return res.status(500).json({ error: "We couldn't save your information right now." });
  }
});

sitegenPublicRouter.post("/drafts/me/structure", requireSitegenAuth, async (req, res) => {
  try {
    const website = req.sitegen!.website;
    if (!website.infoCompletedAt) {
      return res.status(400).json({ error: "Please complete your information before structuring your website." });
    }

    const result = await structureSitegenWebsite(website);
    website.structuredContent = result.structuredContent;
    website.recommendedThemeId = result.recommendedThemeId;
    website.selectedThemeId = result.selectedThemeId;
    website.aiProcessingStatus = result.aiProcessingStatus;
    website.aiMessage = result.aiMessage || "";
    website.structuredAt = new Date();
    await website.save();

    return res.json({
      ok: true,
      website: sitegenWebsiteDto(website),
      aiProcessingStatus: result.aiProcessingStatus,
      aiMessage: result.aiMessage || "",
    });
  } catch (err: unknown) {
    console.error("[sitegen] POST /drafts/me/structure", err);
    return res.status(500).json({ error: "We couldn't structure your website content right now." });
  }
});

sitegenPublicRouter.patch("/drafts/me/theme", requireSitegenAuth, async (req, res) => {
  try {
    const website = req.sitegen!.website;
    const themeId = String(req.body?.themeId || "").trim() as SitegenThemeId;
    if (!themeId || !isThemeAllowedForSiteType(themeId, website.siteType)) {
      return res.status(400).json({ error: "Please choose a valid theme for your website type." });
    }

    website.selectedThemeId = themeId;
    await website.save();
    return res.json({ ok: true, website: sitegenWebsiteDto(website) });
  } catch (err: unknown) {
    console.error("[sitegen] PATCH /drafts/me/theme", err);
    return res.status(500).json({ error: "We couldn't update your theme right now." });
  }
});

sitegenPublicRouter.post(
  "/drafts/me/resume",
  requireSitegenAuth,
  (req, res, next) => {
    resumeUpload.single("resume")(req, res, (err) => {
      if (err) {
        const status = (err as { code?: string }).code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err instanceof Error ? err.message : "File upload error." });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (req.sitegen!.website.siteType !== "seeker") {
        return res.status(400).json({ error: "Resume upload is only available for Job Seeker websites." });
      }
      if (!req.file) return res.status(400).json({ error: "No file uploaded." });

      const text = await extractResumeTextFromFile(req.file);
      const website = req.sitegen!.website;
      website.resumeText = text;
      website.resumeFileName = req.file.originalname.slice(0, 255);
      website.inputMode = "resume";
      await website.save();

      return res.json({
        ok: true,
        resumeText: text,
        resumeFileName: website.resumeFileName,
        website: sitegenWebsiteDto(website),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to parse resume.";
      const status = message.includes("Unsupported") || message.includes("password") || message.includes("scanned") ? 422 : 500;
      console.error("[sitegen] POST /drafts/me/resume", err);
      return res.status(status).json({ error: message });
    }
  },
);

sitegenPublicRouter.post("/uploads/image", requireSitegenAuth, async (req, res) => {
  try {
    const data = String(req.body?.data || "");
    const contentType = String(req.body?.contentType || "image/jpeg");
    if (!data.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image data." });
    }

    const [, base64 = ""] = data.split(",");
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "Image is too large. Please use a smaller file." });
    }

    const image = await SitegenImage.create({
      websiteId: req.sitegen!.websiteId,
      contentType,
      data: buffer,
    });

    return res.json({ ok: true, url: `/uploads/${image._id}` });
  } catch (err: unknown) {
    console.error("[sitegen] POST /uploads/image", err);
    return res.status(500).json({ error: "Image upload failed." });
  }
});

sitegenPublicRouter.get("/uploads/:id", async (req, res) => {
  try {
    await connectMongo();
    const image = await SitegenImage.findById(req.params.id);
    if (!image) return res.status(404).send("Not found");
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(image.data);
  } catch (err: unknown) {
    console.error("[sitegen] GET /uploads/:id", err);
    return res.status(500).send("Failed to load image.");
  }
});

function normalizeQueryUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

declare global {
  namespace Express {
    interface Request {
      sitegen?: import("../middleware/requireSitegenAuth").SitegenRequestContext;
    }
  }
}
