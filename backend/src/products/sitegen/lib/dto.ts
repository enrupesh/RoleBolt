import type { ISitegenWebsite } from "../models/SitegenWebsite";
import { sitegenPublicSiteUrl } from "./publicUrl";

export function sitegenWebsiteDto(website: ISitegenWebsite | Record<string, unknown>) {
  const doc = website as ISitegenWebsite;
  return {
    id: String(doc._id),
    username: String(doc.username),
    siteType: doc.siteType,
    status: doc.status,
    publicUrl: sitegenPublicSiteUrl(String(doc.username)),
    inputMode: doc.inputMode || null,
    resumeText: doc.resumeText || "",
    resumeFileName: doc.resumeFileName || "",
    seekerProfile: doc.seekerProfile || null,
    creatorProfile: doc.creatorProfile || null,
    infoCompletedAt: doc.infoCompletedAt ? new Date(doc.infoCompletedAt).toISOString() : null,
    structuredContent: doc.structuredContent || null,
    recommendedThemeId: doc.recommendedThemeId || null,
    selectedThemeId: doc.selectedThemeId || null,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
    hasUnpublishedChanges: Boolean(doc.hasUnpublishedChanges),
    needsRestructure: Boolean(doc.needsRestructure),
    aiProcessingStatus: doc.aiProcessingStatus || "idle",
    aiMessage: doc.aiMessage || "",
    structuredAt: doc.structuredAt ? new Date(doc.structuredAt).toISOString() : null,
  };
}
