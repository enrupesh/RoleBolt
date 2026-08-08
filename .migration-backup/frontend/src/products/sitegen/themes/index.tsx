import type { SitegenStructuredContent, SitegenThemeId } from "../types/structuredContent";
import { SeekerClassicTheme } from "./SeekerClassicTheme";
import { SeekerModernTheme } from "./SeekerModernTheme";
import { CreatorBusinessTheme } from "./CreatorBusinessTheme";
import { CreatorStudioTheme } from "./CreatorStudioTheme";

export function SitegenThemeRenderer({
  themeId,
  content,
  username,
}: {
  themeId: SitegenThemeId;
  content: SitegenStructuredContent;
  username: string;
}) {
  if (themeId === "seeker-classic" && content.type === "seeker") {
    return <SeekerClassicTheme content={content} username={username} />;
  }
  if (themeId === "seeker-modern" && content.type === "seeker") {
    return <SeekerModernTheme content={content} username={username} />;
  }
  if (themeId === "creator-business" && content.type === "creator") {
    return <CreatorBusinessTheme content={content} username={username} />;
  }
  if (themeId === "creator-studio" && content.type === "creator") {
    return <CreatorStudioTheme content={content} username={username} />;
  }
  return <div className="p-8 text-center text-slate-500">Theme preview unavailable.</div>;
}
