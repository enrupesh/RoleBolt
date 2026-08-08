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
export { sitegenApiUrl } from "./lib/api";
export {
  createSitegenDraft,
  checkSitegenUsername,
  fetchSitegenDraft,
  saveSitegenDraft,
  loginSitegen,
  uploadSitegenResume,
} from "./lib/client";
export type { SitegenWebsiteDraft } from "./types/profile";
