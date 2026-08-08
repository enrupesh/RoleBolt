import { readApiJson } from "@/lib/api";
import { sitegenApiUrl } from "./api";
import type { SitegenWebsiteDraft } from "../types/profile";
import type { SitegenPublishedSite } from "../types/publicSite";
import type { SitegenSessionWebsite } from "./session";
import { handleSitegenAuthedResponse } from "./authErrors";

export type SitegenUsernameCheckResponse = {
  available: boolean;
  username?: string;
  error?: string;
};

export type SitegenDraftResponse = {
  ok?: boolean;
  website?: SitegenWebsiteDraft;
  accessToken?: string;
  error?: string;
  resumeText?: string;
  resumeFileName?: string;
};

function authHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function checkSitegenUsername(username: string): Promise<SitegenUsernameCheckResponse> {
  const response = await fetch(
    sitegenApiUrl(`/usernames/check?username=${encodeURIComponent(username)}`),
    { cache: "no-store" },
  );
  return readApiJson<SitegenUsernameCheckResponse>(response);
}

export async function createSitegenDraft(input: {
  username: string;
  password: string;
  siteType: "seeker" | "creator";
}): Promise<SitegenDraftResponse> {
  const response = await fetch(sitegenApiUrl("/drafts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readApiJson<SitegenDraftResponse>(response);
  if (!response.ok) throw new Error(data.error || "We couldn't create your website draft.");
  return data;
}

export async function loginSitegen(input: {
  username: string;
  password: string;
}): Promise<SitegenDraftResponse> {
  const response = await fetch(sitegenApiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readApiJson<SitegenDraftResponse>(response);
  if (!response.ok) throw new Error(data.error || "Invalid username or password.");
  return data;
}

export async function fetchSitegenDraft(accessToken: string): Promise<SitegenWebsiteDraft> {
  const response = await fetch(sitegenApiUrl("/drafts/me"), {
    headers: authHeaders(accessToken),
    cache: "no-store",
  });
  const data = await readApiJson<{ website?: SitegenWebsiteDraft; error?: string }>(response);
  await handleSitegenAuthedResponse(response, data);
  if (!response.ok || !data.website) {
    throw new Error(data.error || "We couldn't load your website draft.");
  }
  return data.website;
}

export async function saveSitegenDraft(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<SitegenWebsiteDraft> {
  const response = await fetch(sitegenApiUrl("/drafts/me"), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  });
  const data = await readApiJson<SitegenDraftResponse>(response);
  await handleSitegenAuthedResponse(response, data);
  if (!response.ok || !data.website) {
    throw new Error(data.error || "We couldn't save your information.");
  }
  return data.website;
}

export async function structureSitegenDraft(accessToken: string): Promise<SitegenWebsiteDraft> {
  const response = await fetch(sitegenApiUrl("/drafts/me/structure"), {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  const data = await readApiJson<SitegenDraftResponse>(response);
  await handleSitegenAuthedResponse(response, data);
  if (!response.ok || !data.website) {
    throw new Error(data.error || "We couldn't structure your website content.");
  }
  return data.website;
}

export async function updateSitegenTheme(accessToken: string, themeId: string): Promise<SitegenWebsiteDraft> {
  const response = await fetch(sitegenApiUrl("/drafts/me/theme"), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ themeId }),
  });
  const data = await readApiJson<SitegenDraftResponse>(response);
  await handleSitegenAuthedResponse(response, data);
  if (!response.ok || !data.website) {
    throw new Error(data.error || "We couldn't update your theme.");
  }
  return data.website;
}

export async function publishSitegenDraft(accessToken: string): Promise<SitegenWebsiteDraft> {
  const response = await fetch(sitegenApiUrl("/drafts/me/publish"), {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  const data = await readApiJson<SitegenDraftResponse & { publicUrl?: string }>(response);
  await handleSitegenAuthedResponse(response, data);
  if (!response.ok || !data.website) {
    throw new Error(data.error || "We couldn't publish your website.");
  }
  return data.website;
}

export async function fetchPublishedSitegenSite(username: string): Promise<SitegenPublishedSite | null> {
  try {
    const response = await fetch(sitegenApiUrl(`/sites/${encodeURIComponent(username)}`), {
      cache: "no-store",
    });
    if (response.status === 404) return null;
    const data = await readApiJson<{ site?: SitegenPublishedSite; error?: string }>(response).catch(
      (): { site?: SitegenPublishedSite; error?: string } => ({}),
    );
    if (!response.ok || !data.site?.structuredContent || !data.site.themeId) return null;
    return data.site;
  } catch {
    return null;
  }
}

export async function uploadSitegenResume(accessToken: string, file: File): Promise<SitegenDraftResponse> {
  const formData = new FormData();
  formData.append("resume", file);
  const response = await fetch(sitegenApiUrl("/drafts/me/resume"), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const data = await readApiJson<SitegenDraftResponse>(response);
  await handleSitegenAuthedResponse(response, data);
  if (!response.ok) throw new Error(data.error || "We couldn't read your resume.");
  return data;
}

export async function uploadSitegenImage(accessToken: string, file: File): Promise<string> {
  const dataUrl = await resizeImageToDataUrl(file, 800);
  const response = await fetch(sitegenApiUrl("/uploads/image"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ data: dataUrl, contentType: "image/jpeg" }),
  });
  const body = await readApiJson<{ url?: string; error?: string }>(response);
  await handleSitegenAuthedResponse(response, body);
  if (!response.ok || !body.url) throw new Error(body.error || "Image upload failed.");
  return sitegenApiUrl(body.url);
}

function resizeImageToDataUrl(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported."));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function toSessionWebsite(website: SitegenWebsiteDraft): SitegenSessionWebsite {
  return {
    id: website.id,
    username: website.username,
    siteType: website.siteType,
    status: website.status,
    publicUrl: website.publicUrl,
  };
}
