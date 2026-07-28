/**
 * Google Cloud Translation API Client
 *
 * Translates any text into a target language.
 * Free tier: 500,000 characters / month
 * Docs: https://cloud.google.com/translate/docs/reference/rest/v2/translate
 *
 * Env: GOOGLE_CLOUD_API_KEY
 */

const TRANSLATE_BASE = "https://translation.googleapis.com/language/translate/v2";

/**
 * Supported language codes (common subset).
 * Full list: https://cloud.google.com/translate/docs/languages
 */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
  ar: "Arabic",
  zh: "Chinese (Simplified)",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
  it: "Italian",
  bn: "Bengali",
  ur: "Urdu",
  pa: "Punjabi",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
};

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  targetLanguage: string;
  targetLanguageLabel: string;
}

/**
 * Translate text to the given target language.
 * Returns null (gracefully) if the API key is missing or the call fails.
 */
export async function translateText(
  text: string,
  targetLang: string,
  timeoutMs = 15_000
): Promise<TranslateResult | null> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    console.warn("[googleTranslateClient] GOOGLE_CLOUD_API_KEY not set — skipping translation.");
    return null;
  }

  if (!text?.trim()) return null;

  // Validate language code
  const targetLabel = SUPPORTED_LANGUAGES[targetLang] ?? targetLang;

  // Google Translate API allows up to ~30 KB per request in free tier
  const snippet = text.slice(0, 25_000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${TRANSLATE_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: snippet,
        target: targetLang,
        format: "text",
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn("[googleTranslateClient] Request failed:", err?.message ?? err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[googleTranslateClient] API error (${res.status}): ${body}`);
    return null;
  }

  const data: any = await res.json().catch(() => null);
  const translated = data?.data?.translations?.[0];
  if (!translated?.translatedText) {
    console.warn("[googleTranslateClient] Empty translation response.");
    return null;
  }

  console.log(`[googleTranslateClient] ✓ Translated ${snippet.length} chars → ${targetLang}`);

  return {
    translatedText: translated.translatedText,
    detectedSourceLanguage: translated.detectedSourceLanguage ?? "en",
    targetLanguage: targetLang,
    targetLanguageLabel: targetLabel,
  };
}
