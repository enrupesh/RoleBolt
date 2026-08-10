import { sitegenProduct } from "../config/product";

export function sitegenPublicSitePath(username: string): string {
  return `/${encodeURIComponent(username)}`;
}

export function sitegenPublicSiteUrl(username: string): string {
  return `${sitegenProduct.canonicalOrigin}/${encodeURIComponent(username)}`;
}

export function sitegenDisplayPublicUrl(username: string): string {
  return `${sitegenProduct.publicHost}/${username}`;
}
