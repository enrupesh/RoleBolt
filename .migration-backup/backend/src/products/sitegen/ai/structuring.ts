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

function formatStructuringErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("Timeout")) {
    return "NVIDIA AI took longer than expected and timed out. Your saved information was used instead — please try “Re-run AI structuring” in a minute; it often succeeds on retry.";
  }
  if (message.includes("GEMINI_FALLBACK_KEY")) {
    return "NVIDIA AI is not configured on the server right now. Your saved information was used instead.";
  }
  if (message) {
    return `AI structuring unavailable (${message}). Your saved information was preserved and used instead.`;
  }
  return "AI structuring unavailable. Your saved information was preserved and used instead.";
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
    const startedAt = Date.now();
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
    const nvidiaMs = Date.now() - startedAt;
    console.log(`[sitegen] NVIDIA structuring completed in ${nvidiaMs}ms (username=${website.username})`);

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
      aiMessage: formatStructuringErrorMessage(err),
    };
  }
}
