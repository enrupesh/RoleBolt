import { SITEGEN_HOST_DOMAIN } from "../constants";

export function sitegenPublicSiteUrl(username: string): string {
  return `https://${SITEGEN_HOST_DOMAIN}/${encodeURIComponent(username)}`;
}
