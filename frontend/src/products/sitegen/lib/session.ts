const SITEGEN_SESSION_KEY = "sitegen_access_token";
const SITEGEN_WEBSITE_KEY = "sitegen_website";

export type SitegenSessionWebsite = {
  id: string;
  username: string;
  siteType: "seeker" | "creator";
  status: "draft" | "published";
  publicUrl: string;
};

export function saveSitegenSession(accessToken: string, website: SitegenSessionWebsite): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SITEGEN_SESSION_KEY, accessToken);
  window.localStorage.setItem(SITEGEN_WEBSITE_KEY, JSON.stringify(website));
}

export function readSitegenSession(): { accessToken: string; website: SitegenSessionWebsite } | null {
  if (typeof window === "undefined") return null;
  const accessToken = window.localStorage.getItem(SITEGEN_SESSION_KEY);
  const websiteRaw = window.localStorage.getItem(SITEGEN_WEBSITE_KEY);
  if (!accessToken || !websiteRaw) return null;
  try {
    return { accessToken, website: JSON.parse(websiteRaw) as SitegenSessionWebsite };
  } catch {
    return null;
  }
}

export function clearSitegenSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SITEGEN_SESSION_KEY);
  window.localStorage.removeItem(SITEGEN_WEBSITE_KEY);
}
