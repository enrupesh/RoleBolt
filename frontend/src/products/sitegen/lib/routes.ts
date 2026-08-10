import { sitegenProduct } from "../config/product";
import type { SitegenSiteType } from "../config/product";

const base = sitegenProduct.basePath;

/** All Sitegen routes — single source of truth for navigation */
export const sitegenRoutes = {
  landing: base,
  start: (type: SitegenSiteType) => `${base}/start/${type}`,
  username: `${base}/username`,
  build: `${base}/build`,
  preview: `${base}/preview`,
  manage: `${base}/manage`,
  login: `${base}/login`,
  publishedSite: (username: string) => `/${encodeURIComponent(username)}`,
} as const;
