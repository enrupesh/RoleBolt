import type { SitegenThemeId } from "../types/structuredContent";

export const SITEGEN_THEME_OPTIONS: Record<"seeker" | "creator", Array<{ id: SitegenThemeId; name: string; description: string }>> = {
  seeker: [
    { id: "seeker-classic", name: "Seeker Classic", description: "Clean, professional layout for experience-led profiles." },
    { id: "seeker-modern", name: "Seeker Modern", description: "Bold, contemporary layout for skills and projects." },
  ],
  creator: [
    { id: "creator-business", name: "Creator Business", description: "Polished business presence for companies and agencies." },
    { id: "creator-studio", name: "Creator Studio", description: "Expressive layout for creators and personal brands." },
  ],
};
