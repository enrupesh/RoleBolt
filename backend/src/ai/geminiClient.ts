/**
 * Thin Google Gemini API client using the generateContent REST endpoint.
 * Uses the GEMINI_PRIMARY_KEY environment variable.
 * Docs: https://ai.google.dev/api/generate-content
 *
 * callGemini       — call one specific model
 * callGeminiChain  — try ALL Gemini models in sequence; throws only if every
 *                    model fails (caller can then fall back to Nvidia)
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiModel =
  | "gemini-2.5-flash"       // Best quality — thinking model, great for JD generation
  | "gemini-2.5-flash-lite"  // Mid-tier
  | "gemini-3.1-flash-lite"  // Best free RPD (500/day) — good for resume scoring
  | "gemini-3.5-flash-lite"  // Same as above, alternate
  | "gemini-3.6-flash";      // Latest flash

/**
 * All available Gemini models ordered from best to most available.
 * callGeminiChain tries these in sequence.
 */
export const GEMINI_MODEL_CHAIN: GeminiModel[] = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
];

export interface GeminiCallArgs {
  model?: GeminiModel;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Instruct model to return JSON only */
  jsonMode?: boolean;
  /** Timeout in ms — default 45s */
  timeoutMs?: number;
}

/** Call a single Gemini model. Throws on any failure. */
export async function callGemini(args: GeminiCallArgs): Promise<string> {
  const apiKey = process.env.GEMINI_PRIMARY_KEY;
  if (!apiKey) {
    throw new Error("[geminiClient] GEMINI_PRIMARY_KEY not set in environment.");
  }

  const {
    model = "gemini-2.5-flash",
    prompt,
    temperature = 0.7,
    maxOutputTokens = 2000,
    jsonMode = false,
    timeoutMs = 45_000,
  } = args;

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err?.name === "AbortError"
      ? new Error(`[geminiClient] Timeout after ${Math.round(timeoutMs / 1000)}s (model=${model})`)
      : err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[geminiClient] API error (${res.status}, model=${model}): ${text || res.statusText}`);
  }

  const data: any = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!content) {
    throw new Error(`[geminiClient] Empty response from model=${model}`);
  }
  return content.trim();
}

/**
 * Try every Gemini model in GEMINI_MODEL_CHAIN one by one.
 * Returns the first successful response.
 * Throws only if ALL models fail — the caller should then fall back to Nvidia.
 */
export async function callGeminiChain(
  args: Omit<GeminiCallArgs, "model">
): Promise<string> {
  let lastErr: unknown;

  for (let i = 0; i < GEMINI_MODEL_CHAIN.length; i++) {
    const model = GEMINI_MODEL_CHAIN[i];
    try {
      const result = await callGemini({ ...args, model });
      console.log(`[geminiClient] ✓ callGeminiChain succeeded with ${model} (attempt ${i + 1}/${GEMINI_MODEL_CHAIN.length})`);
      return result;
    } catch (err: any) {
      lastErr = err;
      console.warn(
        `[geminiClient] ${model} failed (${i + 1}/${GEMINI_MODEL_CHAIN.length}): ${err?.message ?? err}. ${i + 1 < GEMINI_MODEL_CHAIN.length ? `Trying ${GEMINI_MODEL_CHAIN[i + 1]}…` : "All Gemini models exhausted."}`
      );
    }
  }

  throw lastErr ?? new Error("[geminiClient] All Gemini models in chain failed.");
}
