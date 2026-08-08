import type { SitegenThemeId } from "../types/structuredContent";

export const SITEGEN_THEME_OPTIONS: Record<"seeker" | "creator", Array<{ id: SitegenThemeId; name: string; description: string }>> = {
  seeker: [
    { id: "seeker-classic", name: "Seeker Classic", description: "Polished professional portfolio with clear hierarchy and resume-style sections." },
    { id: "seeker-modern", name: "Seeker Modern", description: "Contemporary dark portfolio with bold hero, cards, and visual skill presentation." },
  ],
  creator: [
    { id: "creator-business", name: "Creator Business", description: "Corporate-quality business site with services, work, and contact CTAs." },
    { id: "creator-studio", name: "Creator Studio", description: "Expressive creator brand site with premium hero and showcase sections." },
  ],
};
