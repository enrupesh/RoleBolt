import type { ISitegenWebsite } from "../models/SitegenWebsite";
import { isThemeAllowedForSiteType } from "../ai/themeMapping";
import type { SitegenThemeId } from "../types/structuredContent";

export function getPublishThemeId(website: ISitegenWebsite): SitegenThemeId | null {
  const themeId = (website.selectedThemeId || website.recommendedThemeId) as SitegenThemeId | undefined;
  if (!themeId || !isThemeAllowedForSiteType(themeId, website.siteType)) return null;
  return themeId;
}

function validateStructuredContent(website: ISitegenWebsite): string | null {
  const content = website.structuredContent;
  if (!content) return "Please structure your website content before publishing.";

  if (content.type === "seeker") {
    if (!content.name?.trim()) return "Structured content is missing a name.";
    if (content.type !== website.siteType) return "Structured content does not match your website type.";
  }

  if (content.type === "creator") {
    if (!content.businessName?.trim()) return "Structured content is missing a business name.";
    if (content.type !== website.siteType) return "Structured content does not match your website type.";
  }

  return null;
}

export function validatePublishReady(website: ISitegenWebsite): string | null {
  if (!website.infoCompletedAt) {
    return "Please complete your information before publishing.";
  }
  if (website.needsRestructure) {
    return "Your information has changed. Please re-run AI structuring on the preview page before publishing.";
  }
  const contentError = validateStructuredContent(website);
  if (contentError) return contentError;
  if (!getPublishThemeId(website)) {
    return "Please select a theme before publishing.";
  }
  return null;
}

export function applyPublish(website: ISitegenWebsite): void {
  const validationError = validatePublishReady(website);
  if (validationError) throw new Error(validationError);

  const themeId = getPublishThemeId(website);
  if (!themeId || !website.structuredContent) {
    throw new Error("Website is not ready to publish.");
  }

  website.status = "published";
  website.publishedStructuredContent = website.structuredContent;
  website.publishedThemeId = themeId;
  website.publishedAt = new Date();
  website.hasUnpublishedChanges = false;
  website.needsRestructure = false;
}

export function markUnpublishedChanges(website: ISitegenWebsite): void {
  if (website.status === "published") {
    website.hasUnpublishedChanges = true;
  }
}

export function markNeedsRestructure(website: ISitegenWebsite): void {
  if (website.structuredContent || website.structuredAt) {
    website.needsRestructure = true;
  }
  markUnpublishedChanges(website);
}
