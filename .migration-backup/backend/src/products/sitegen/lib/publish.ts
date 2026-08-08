import type { ISitegenWebsite } from "../models/SitegenWebsite";
import { isThemeAllowedForSiteType } from "../ai/themeMapping";
import type { SitegenThemeId } from "../types/structuredContent";

export function getPublishThemeId(website: ISitegenWebsite): SitegenThemeId | null {
  const themeId = (website.selectedThemeId || website.recommendedThemeId) as SitegenThemeId | undefined;
  if (!themeId || !isThemeAllowedForSiteType(themeId, website.siteType)) return null;
  return themeId;
}

export function validatePublishReady(website: ISitegenWebsite): string | null {
  if (!website.infoCompletedAt) {
    return "Please complete your information before publishing.";
  }
  if (!website.structuredContent) {
    return "Please structure your website content before publishing.";
  }
  if (!getPublishThemeId(website)) {
    return "Please select a theme before publishing.";
  }
  return null;
}

export function applyPublish(website: ISitegenWebsite): void {
  const themeId = getPublishThemeId(website);
  if (!themeId || !website.structuredContent) {
    throw new Error("Website is not ready to publish.");
  }

  website.status = "published";
  website.publishedStructuredContent = website.structuredContent;
  website.publishedThemeId = themeId;
  website.publishedAt = new Date();
  website.hasUnpublishedChanges = false;
}

export function markUnpublishedChanges(website: ISitegenWebsite): void {
  if (website.status === "published") {
    website.hasUnpublishedChanges = true;
  }
}
