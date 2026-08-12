/** Mirrors backend/src/products/sitegen/types/structuredContent.ts */

export type SitegenThemeId =
  | "seeker-classic"
  | "seeker-modern"
  | "creator-business"
  | "creator-studio";

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

export type SitegenSeekerStructuredContent = {
  type: "seeker";
  name: string;
  headline: string | null;
  about: string | null;
  photoUrl: string | null;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    startDate: string | null;
    endDate: string | null;
    current: boolean;
    bullets: string[];
  }>;
  education: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
  }>;
  projects: Array<{ name: string; description: string | null; url: string | null }>;
  certifications: string[];
  achievements: string[];
  contact: SitegenContactInfo;
  sections: Record<string, boolean>;
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
  contact: { email: string | null; phone: string | null; website: string | null };
  socialLinks: {
    linkedin: string | null;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
    tiktok: string | null;
  };
  portfolio: Array<{ title: string; url: string; description: string | null }>;
  team: Array<{ name: string; role: string | null; bio: string | null }>;
  sections: Record<string, boolean>;
};

export type SitegenStructuredContent =
  | SitegenSeekerStructuredContent
  | SitegenCreatorStructuredContent;
