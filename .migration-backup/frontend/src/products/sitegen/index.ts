/**
 * Sitegen — extractable website-generation product.
 * Import from `@/products/sitegen` only; do not scatter sitegen logic across Rolebolt.
 */

export { sitegenProduct, sitegenSiteTypeLabels } from "./config/product";
export type { SitegenSiteType } from "./config/product";
export { sitegenMetadata } from "./config/seo";
export { sitegenRoutes } from "./lib/routes";
export { SITEGEN_RESERVED_USERNAMES } from "./config/reserved-usernames";
export { SitegenLandingPage } from "./components/landing/SitegenLandingPage";
export { SitegenCreateDraftPage } from "./components/create/SitegenCreateDraftPage";
export { SitegenBuildPage } from "./components/build/SitegenBuildPage";
export { SitegenPreviewPage } from "./components/preview/SitegenPreviewPage";
export { SitegenManagePage, SitegenLoginPage } from "./components/manage/SitegenManagePage";
export { SitegenShareTools } from "./components/share/SitegenShareTools";
export { sitegenApiUrl } from "./lib/api";
export {
  createSitegenDraft,
  checkSitegenUsername,
  fetchSitegenDraft,
  saveSitegenDraft,
  loginSitegen,
  uploadSitegenResume,
  structureSitegenDraft,
  updateSitegenTheme,
  publishSitegenDraft,
  fetchPublishedSitegenSite,
} from "./lib/client";
export { sitegenPublicSiteUrl, sitegenDisplayPublicUrl } from "./lib/publicUrl";
export type { SitegenPublishedSite } from "./types/publicSite";
export type { SitegenWebsiteDraft } from "./types/profile";
export type {
  SitegenCreatorStructuredContent,
  SitegenSeekerStructuredContent,
  SitegenStructuredContent,
  SitegenThemeId,
} from "./types/structuredContent";
export { SITEGEN_THEME_OPTIONS } from "./config/themes";
export { SitegenThemeRenderer } from "./themes";
