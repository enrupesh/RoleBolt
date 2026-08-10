const X_POST_PATTERN = /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i;

/** Shown when no URLs are saved in admin settings yet. */
export const DEFAULT_FEATURED_X_POST_URLS = [
  "https://x.com/yerkeRakhimov/status/2086704909399777369",
];

export function parseXPostUrl(value: unknown): string {
  const url = String(value || "").trim().split("?")[0];
  const withProtocol = url.startsWith("http") ? url : "";
  if (!withProtocol || !X_POST_PATTERN.test(withProtocol)) return "";
  return withProtocol.slice(0, 2048);
}

export function parseXPostUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const item of value) {
    const parsed = parseXPostUrl(item);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    urls.push(parsed);
    if (urls.length >= 6) break;
  }
  return urls;
}

export function resolvedFeaturedXPostUrls(value: unknown): string[] {
  const fromDb = parseXPostUrls(value);
  return fromDb.length ? fromDb : DEFAULT_FEATURED_X_POST_URLS;
}
