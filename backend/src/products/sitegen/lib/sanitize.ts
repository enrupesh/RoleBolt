const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function detectImageContentType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function isSafeImageContentType(contentType: string): boolean {
  return SAFE_IMAGE_TYPES.has(contentType);
}

export function sanitizeHttpUrl(value: unknown, maxLen = 500): string | undefined {
  const raw = String(value ?? "").trim().slice(0, maxLen);
  if (!raw) return undefined;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Accept canonical http(s) URLs and Sitegen upload paths served by this product. */
export function sanitizeSitegenMediaUrl(value: unknown, maxLen = 1000): string | undefined {
  const raw = String(value ?? "").trim().slice(0, maxLen);
  if (!raw) return undefined;
  if (raw.startsWith("/sitegen-public/uploads/")) return raw;
  return sanitizeHttpUrl(raw, maxLen);
}
