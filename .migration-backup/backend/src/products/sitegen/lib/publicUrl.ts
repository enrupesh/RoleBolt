/** Canonical public-site configuration for Sitegen published websites. */
export const SITEGEN_PUBLIC_ORIGIN = "https://www.rolebolt.tech";
export const SITEGEN_PUBLIC_HOST = "www.rolebolt.tech";

export function sitegenPublicSiteUrl(username: string): string {
  return `${SITEGEN_PUBLIC_ORIGIN}/${encodeURIComponent(username)}`;
}

export function sitegenDisplayPublicUrl(username: string): string {
  return `${SITEGEN_PUBLIC_HOST}/${username}`;
}
