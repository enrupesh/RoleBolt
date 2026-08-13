import type { SitegenStructuredContent, SitegenThemeId } from "./structuredContent";

export type SitegenPublishedSite = {
  username: string;
  siteType: "seeker" | "creator";
  themeId: SitegenThemeId;
  structuredContent: SitegenStructuredContent;
  publicUrl: string;
  publishedAt: string | null;
};
