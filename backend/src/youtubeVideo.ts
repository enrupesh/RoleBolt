const YOUTUBE_PATTERNS = [
  /^https?:\/\/(?:www\.)?youtube\.com\/shorts\/([\w-]{6,})/i,
  /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/i,
  /^https?:\/\/(?:www\.)?youtu\.be\/([\w-]{6,})/i,
  /^https?:\/\/(?:www\.)?youtube\.com\/embed\/([\w-]{6,})/i,
];

/** Shown when no URLs are saved in admin settings yet. */
export const DEFAULT_FEATURED_VIDEO_REVIEW_URLS = [
  "https://www.youtube.com/shorts/6gmOVyWTX7k",
];

export function parseYouTubeVideoUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw.startsWith("http")) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const normalized = parsed.toString().split("#")[0];
    for (const pattern of YOUTUBE_PATTERNS) {
      if (pattern.test(normalized)) return normalized.slice(0, 2048);
    }
    return "";
  } catch {
    return "";
  }
}

export function extractYouTubeVideoId(url: string): string {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function parseYouTubeVideoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const item of value) {
    const parsed = parseYouTubeVideoUrl(item);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    urls.push(parsed);
    if (urls.length >= 6) break;
  }
  return urls;
}

export function resolvedFeaturedVideoReviewUrls(value: unknown): string[] {
  const fromDb = parseYouTubeVideoUrls(value);
  return fromDb.length ? fromDb : DEFAULT_FEATURED_VIDEO_REVIEW_URLS;
}
