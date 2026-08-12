const X_POST_PATTERN = /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i;

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
