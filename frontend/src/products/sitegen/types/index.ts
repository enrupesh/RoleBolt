export type { SitegenSiteType } from "../config/product";

/** Draft website record shape — used in later phases */
export type SitegenWebsiteStatus = "draft" | "published";

export type SitegenThemeId =
  | "seeker-classic"
  | "seeker-modern"
  | "creator-business"
  | "creator-creator";

export type {
  SitegenWebsiteDraft,
  SitegenSeekerProfile,
  SitegenCreatorProfile,
} from "./profile";
