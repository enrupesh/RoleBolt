export const SITEGEN_SEEKER_THEMES = ["seeker-classic", "seeker-modern"] as const;
export const SITEGEN_CREATOR_THEMES = ["creator-business", "creator-studio"] as const;
export const SITEGEN_THEME_IDS = [...SITEGEN_SEEKER_THEMES, ...SITEGEN_CREATOR_THEMES] as const;

export type SitegenThemeId = (typeof SITEGEN_THEME_IDS)[number];
export type SitegenAiProcessingStatus = "idle" | "ai_success" | "ai_fallback" | "failed";

export type SitegenContactInfo = {
  email: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
};

export type SitegenSeekerStructuredExperience = {
  title: string;
  company: string;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  bullets: string[];
};

export type SitegenSeekerStructuredEducation = {
  school: string;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
};

export type SitegenSeekerStructuredProject = {
  name: string;
  description: string | null;
  url: string | null;
};

export type SitegenSeekerStructuredContent = {
  type: "seeker";
  name: string;
  headline: string | null;
  about: string | null;
  photoUrl: string | null;
  skills: string[];
  experience: SitegenSeekerStructuredExperience[];
  education: SitegenSeekerStructuredEducation[];
  projects: SitegenSeekerStructuredProject[];
  certifications: string[];
  achievements: string[];
  contact: SitegenContactInfo;
  sections: {
    about: boolean;
    skills: boolean;
    experience: boolean;
    education: boolean;
    projects: boolean;
    certifications: boolean;
    achievements: boolean;
    contact: boolean;
  };
};

export type SitegenCreatorStructuredTeamMember = {
  name: string;
  role: string | null;
  bio: string | null;
};

export type SitegenCreatorStructuredPortfolioItem = {
  title: string;
  url: string;
  description: string | null;
};

export type SitegenCreatorStructuredContent = {
  type: "creator";
  businessName: string;
  tagline: string | null;
  about: string | null;
  category: string | null;
  logoUrl: string | null;
  services: string[];
  location: string | null;
  contact: {
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  socialLinks: {
    linkedin: string | null;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
    tiktok: string | null;
  };
  portfolio: SitegenCreatorStructuredPortfolioItem[];
  team: SitegenCreatorStructuredTeamMember[];
  sections: {
    hero: boolean;
    about: boolean;
    services: boolean;
    portfolio: boolean;
    team: boolean;
    contact: boolean;
  };
};

export type SitegenStructuredContent =
  | SitegenSeekerStructuredContent
  | SitegenCreatorStructuredContent;

export type SitegenStructureResult = {
  structuredContent: SitegenStructuredContent;
  recommendedThemeId: SitegenThemeId;
  selectedThemeId: SitegenThemeId;
  aiProcessingStatus: SitegenAiProcessingStatus;
  aiMessage?: string;
};
