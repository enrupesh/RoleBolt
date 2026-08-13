const YOUTUBE_PATTERNS = [
  /^https?:\/\/(?:www\.)?youtube\.com\/shorts\/([\w-]{6,})/i,
  /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/i,
  /^https?:\/\/(?:www\.)?youtu\.be\/([\w-]{6,})/i,
  /^https?:\/\/(?:www\.)?youtube\.com\/embed\/([\w-]{6,})/i,
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
