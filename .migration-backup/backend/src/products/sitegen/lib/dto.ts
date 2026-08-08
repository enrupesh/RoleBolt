import type { ISitegenWebsite } from "../models/SitegenWebsite";

export function sitegenWebsiteDto(website: ISitegenWebsite | Record<string, unknown>) {
  const doc = website as ISitegenWebsite;
  return {
    id: String(doc._id),
    username: String(doc.username),
    siteType: doc.siteType,
    status: doc.status,
    publicUrl: `https://www.rolebolt.tech/${doc.username}`,
    inputMode: doc.inputMode || null,
    resumeText: doc.resumeText || "",
    resumeFileName: doc.resumeFileName || "",
    seekerProfile: doc.seekerProfile || null,
    creatorProfile: doc.creatorProfile || null,
    infoCompletedAt: doc.infoCompletedAt ? new Date(doc.infoCompletedAt).toISOString() : null,
    structuredContent: doc.structuredContent || null,
    recommendedThemeId: doc.recommendedThemeId || null,
    selectedThemeId: doc.selectedThemeId || null,
    aiProcessingStatus: doc.aiProcessingStatus || "idle",
    aiMessage: doc.aiMessage || "",
    structuredAt: doc.structuredAt ? new Date(doc.structuredAt).toISOString() : null,
  };
}
