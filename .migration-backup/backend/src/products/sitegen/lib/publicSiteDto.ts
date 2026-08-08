import type { ISitegenWebsite } from "../models/SitegenWebsite";

/** Public-safe payload — no passwords, drafts, or internal fields. */
export function sitegenPublicSiteDto(website: ISitegenWebsite) {
  return {
    username: String(website.username),
    siteType: website.siteType,
    themeId: website.publishedThemeId || null,
    structuredContent: website.publishedStructuredContent || null,
    publicUrl: `https://www.rolebolt.tech/${website.username}`,
    publishedAt: website.publishedAt ? new Date(website.publishedAt).toISOString() : null,
  };
}
