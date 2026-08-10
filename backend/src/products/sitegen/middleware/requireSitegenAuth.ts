import express from "express";
import { connectMongo } from "../../../db";
import { SitegenWebsite } from "../models/SitegenWebsite";
import { verifySitegenAccessToken } from "../lib/token";

export type SitegenRequestContext = {
  websiteId: string;
  username: string;
  website: InstanceType<typeof SitegenWebsite>;
};

export async function requireSitegenAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Please sign in with your Sitegen username and password." });
    }

    const payload = verifySitegenAccessToken(header.slice(7));
    if (!payload) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }

    await connectMongo();
    const website = await SitegenWebsite.findById(payload.sub);
    if (!website || website.username !== payload.username) {
      return res.status(401).json({ error: "Please sign in with your Sitegen username and password." });
    }

    (req as express.Request & { sitegen: SitegenRequestContext }).sitegen = {
      websiteId: website._id.toString(),
      username: website.username,
      website,
    };
    return next();
  } catch (err: unknown) {
    console.error("[sitegen] auth middleware", err);
    return res.status(500).json({ error: "Authentication failed." });
  }
}
