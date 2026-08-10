import type {
  SitegenCreatorStructuredContent,
  SitegenSeekerStructuredContent,
  SitegenStructuredContent,
  SitegenThemeId,
} from "../types/structuredContent";
import { SITEGEN_CREATOR_THEMES, SITEGEN_SEEKER_THEMES } from "../types/structuredContent";

export function recommendThemeId(content: SitegenStructuredContent): SitegenThemeId {
  if (content.type === "seeker") return recommendSeekerTheme(content);
  return recommendCreatorTheme(content);
}

function recommendSeekerTheme(content: SitegenSeekerStructuredContent): SitegenThemeId {
  const projectHeavy = content.projects.length >= 2 || content.skills.length >= 8;
  const experienceHeavy = content.experience.length >= 3;
  const educationHeavy = content.education.length >= 2 && content.experience.length <= 1;
  const portfolioSignals = Boolean(content.contact.portfolio || content.contact.github);
  if (projectHeavy || (portfolioSignals && !experienceHeavy)) return "seeker-modern";
  if (educationHeavy && !experienceHeavy) return "seeker-classic";
  if (experienceHeavy && !projectHeavy) return "seeker-classic";
  return projectHeavy ? "seeker-modern" : "seeker-classic";
}

function recommendCreatorTheme(content: SitegenCreatorStructuredContent): SitegenThemeId {
  const category = (content.category || "").toLowerCase();
  const creatorLike = ["creator", "personal brand", "content creator", "influencer"].some((item) => category.includes(item));
  const businessLike = ["business", "startup", "agency", "company", "consultant"].some((item) => category.includes(item));
  const leanProfile = (content.team?.length || 0) <= 1 && (content.services?.length || 0) <= 3;
  if (creatorLike && !businessLike) return "creator-studio";
  if (leanProfile && (content.portfolio?.length || 0) >= 2) return "creator-studio";
  if ((content.team?.length || 0) >= 2 || businessLike) return "creator-business";
  return leanProfile ? "creator-studio" : "creator-business";
}

export function isThemeAllowedForSiteType(themeId: SitegenThemeId, siteType: "seeker" | "creator"): boolean {
  if (siteType === "seeker") return (SITEGEN_SEEKER_THEMES as readonly string[]).includes(themeId);
  return (SITEGEN_CREATOR_THEMES as readonly string[]).includes(themeId);
}

export const SITEGEN_THEME_LABELS: Record<SitegenThemeId, string> = {
  "seeker-classic": "Seeker Classic",
  "seeker-modern": "Seeker Modern",
  "creator-business": "Creator Business",
  "creator-studio": "Creator Studio",
};
