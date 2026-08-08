import type { ISitegenWebsite } from "../models/SitegenWebsite";
import { sitegenPublicSiteUrl } from "./publicUrl";

/** Public-safe payload — no passwords, drafts, or internal fields. */
export function sitegenPublicSiteDto(website: ISitegenWebsite) {
  return {
    username: String(website.username),
    siteType: website.siteType,
    themeId: website.publishedThemeId || null,
    structuredContent: website.publishedStructuredContent || null,
    publicUrl: sitegenPublicSiteUrl(String(website.username)),
    publishedAt: website.publishedAt ? new Date(website.publishedAt).toISOString() : null,
  };
}
