import type { ISitegenWebsite } from "../models/SitegenWebsite";
import type { SitegenStructureResult, SitegenThemeId } from "../types/structuredContent";
import { callSitegenNvidia } from "./nvidia";
import { parseSitegenJson } from "./parseJson";
import {
  buildCreatorStructuringPrompt,
  buildSeekerStructuringPrompt,
} from "./prompts";
import {
  buildFallbackStructuredContent,
  parseCreatorStructuredFromAi,
  parseSeekerStructuredFromAi,
} from "./fallback";
import { isThemeAllowedForSiteType, recommendThemeId } from "./themeMapping";

function parseRecommendedThemeId(raw: unknown, siteType: "seeker" | "creator", structured: SitegenStructureResult["structuredContent"]): SitegenThemeId {
  const value = String((raw as Record<string, unknown>)?.recommendedThemeId || "").trim() as SitegenThemeId;
  if (isThemeAllowedForSiteType(value, siteType)) return value;
  return recommendThemeId(structured);
}

export async function structureSitegenWebsite(website: ISitegenWebsite): Promise<SitegenStructureResult> {
  const fallbackContent = buildFallbackStructuredContent(website);
  const fallbackTheme = recommendThemeId(fallbackContent);

  if (!website.infoCompletedAt) {
    return {
      structuredContent: fallbackContent,
      recommendedThemeId: fallbackTheme,
      selectedThemeId: website.selectedThemeId || fallbackTheme,
      aiProcessingStatus: "ai_fallback",
      aiMessage: "Information step is not complete yet. Using saved profile data.",
    };
  }

  try {
    const profileJson = JSON.stringify(
      website.siteType === "seeker" ? website.seekerProfile || {} : website.creatorProfile || {},
    );

    const { system, prompt } = website.siteType === "seeker"
      ? buildSeekerStructuringPrompt({
        profileJson,
        resumeText: website.resumeText || "",
      })
      : buildCreatorStructuringPrompt({ profileJson });

    const raw = await callSitegenNvidia(prompt, system);
    const parsed = parseSitegenJson(raw);

    const structuredContent = website.siteType === "seeker"
      ? parseSeekerStructuredFromAi(parsed, website)
      : parseCreatorStructuredFromAi(parsed, website);

    const recommendedThemeId = parseRecommendedThemeId(parsed, website.siteType, structuredContent);
    const selectedThemeId = website.selectedThemeId && isThemeAllowedForSiteType(website.selectedThemeId, website.siteType)
      ? website.selectedThemeId
      : recommendedThemeId;

    return {
      structuredContent,
      recommendedThemeId,
      selectedThemeId,
      aiProcessingStatus: "ai_success",
      aiMessage: "Your information was structured successfully with NVIDIA AI.",
    };
  } catch (err: unknown) {
    console.error("[sitegen] structureSitegenWebsite fallback", err);
    return {
      structuredContent: fallbackContent,
      recommendedThemeId: fallbackTheme,
      selectedThemeId: website.selectedThemeId && isThemeAllowedForSiteType(website.selectedThemeId, website.siteType)
        ? website.selectedThemeId
        : fallbackTheme,
      aiProcessingStatus: "ai_fallback",
      aiMessage: err instanceof Error
        ? `AI structuring unavailable (${err.message}). Your saved information was preserved and used instead.`
        : "AI structuring unavailable. Your saved information was preserved and used instead.",
    };
  }
}
