import { connectMongo } from "../../../db";
import { RecruitProfile } from "../../../models/RecruitProfile";
import { User } from "../../../models/User";
import { SitegenWebsite } from "../models/SitegenWebsite";
import {
  SITEGEN_RESERVED_USERNAMES,
  SITEGEN_USERNAME_MAX,
  SITEGEN_USERNAME_MIN,
  SITEGEN_USERNAME_PATTERN,
} from "../config/reservedUsernames";

export function normalizeSitegenUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function validateSitegenUsername(raw: unknown): { username: string } | { error: string } {
  const username = normalizeSitegenUsername(raw);
  if (!username) return { error: "Username is required." };
  if (username.length < SITEGEN_USERNAME_MIN) {
    return { error: `Username must be at least ${SITEGEN_USERNAME_MIN} characters.` };
  }
  if (username.length > SITEGEN_USERNAME_MAX) {
    return { error: `Username must be at most ${SITEGEN_USERNAME_MAX} characters.` };
  }
  if (!SITEGEN_USERNAME_PATTERN.test(username)) {
    return { error: "Username must start with a letter and contain only letters, numbers, and underscores." };
  }
  if (SITEGEN_RESERVED_USERNAMES.has(username)) {
    return { error: "This username is reserved. Please choose another." };
  }
  return { username };
}

export async function isSitegenUsernameGloballyAvailable(username: string): Promise<boolean> {
  await connectMongo();
  const [sitegenTaken, userTaken, profileTaken] = await Promise.all([
    SitegenWebsite.findOne({ username }).select("_id").lean(),
    User.findOne({ username }).select("_id").lean(),
    RecruitProfile.findOne({ username }).select("_id").lean(),
  ]);
  return !sitegenTaken && !userTaken && !profileTaken;
}
