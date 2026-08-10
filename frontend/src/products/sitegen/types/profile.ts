/** Structured profile data — mirrors backend/src/products/sitegen/types/profile.ts */

export type SitegenSeekerExperience = {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
};

export type SitegenSeekerEducation = {
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

export type SitegenSeekerProject = {
  name: string;
  description?: string;
  url?: string;
};

export type SitegenSeekerProfile = {
  fullName: string;
  headline?: string;
  summary?: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  skills?: string[];
  experience?: SitegenSeekerExperience[];
  education?: SitegenSeekerEducation[];
  projects?: SitegenSeekerProject[];
};

export type SitegenCreatorSocialLinks = {
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
};

export type SitegenCreatorPortfolioLink = { title: string; url: string };
export type SitegenCreatorTeamMember = { name: string; role?: string; bio?: string };

export type SitegenCreatorProfile = {
  businessName: string;
  category?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  about?: string;
  services?: string[];
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
  socialLinks?: SitegenCreatorSocialLinks;
  portfolioLinks?: SitegenCreatorPortfolioLink[];
  team?: SitegenCreatorTeamMember[];
  imageUrls?: string[];
};

export type SitegenInputMode = "resume" | "manual";

import type { SitegenAiProcessingStatus, SitegenStructuredContent, SitegenThemeId } from "./structuredContent";

export type SitegenWebsiteDraft = {
  id: string;
  username: string;
  siteType: "seeker" | "creator";
  status: "draft" | "published";
  publicUrl: string;
  inputMode?: SitegenInputMode | null;
  resumeText?: string;
  resumeFileName?: string;
  seekerProfile?: SitegenSeekerProfile | null;
  creatorProfile?: SitegenCreatorProfile | null;
  infoCompletedAt?: string | null;
  structuredContent?: SitegenStructuredContent | null;
  recommendedThemeId?: SitegenThemeId | null;
  selectedThemeId?: SitegenThemeId | null;
  aiProcessingStatus?: SitegenAiProcessingStatus;
  aiMessage?: string;
  structuredAt?: string | null;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
  needsRestructure?: boolean;
};
