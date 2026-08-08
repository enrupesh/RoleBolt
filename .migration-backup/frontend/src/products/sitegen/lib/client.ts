import { readApiJson } from "@/lib/api";
import { sitegenApiUrl } from "./api";
import type { SitegenSessionWebsite } from "./session";

export type SitegenUsernameCheckResponse = {
  available: boolean;
  username?: string;
  error?: string;
};

export type SitegenCreateDraftResponse = {
  ok?: boolean;
  website?: SitegenSessionWebsite;
  accessToken?: string;
  error?: string;
};

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
}): Promise<SitegenCreateDraftResponse> {
  const response = await fetch(sitegenApiUrl("/drafts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readApiJson<SitegenCreateDraftResponse>(response);
  if (!response.ok) {
    throw new Error(data.error || "We couldn't create your website draft.");
  }
  return data;
}
