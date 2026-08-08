import { sitegenProduct } from "../config/product";

export function sitegenPublicSitePath(username: string): string {
  return `/${encodeURIComponent(username)}`;
}

export function sitegenPublicSiteUrl(username: string): string {
  return `https://${sitegenProduct.hostDomain}/${encodeURIComponent(username)}`;
}

export function sitegenDisplayPublicUrl(username: string): string {
  return `${sitegenProduct.hostDomain}/${username}`;
}
