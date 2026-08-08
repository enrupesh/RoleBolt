/**
 * Nvidia NIM API Client — Ultimate AI Fallback
 *
 * Nvidia's API is OpenAI-compatible (https://integrate.api.nvidia.com/v1).
 * This client is used as the LAST resort when all Gemini + Mesh API models
 * have failed. It runs a 5-model fallback chain internally so it almost
 * never fails.
 *
 * Models are ordered: largest/best first, reliable alternatives after.
 * Env: GEMINI_FALLBACK_KEY
 */

import type { ChatMessage } from "./meshClient";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

/**
 * Nvidia model fallback chain — ordered by capability + reliability.
 * If the first model is unavailable/overloaded, the next one is tried.
 */
export const NVIDIA_MODEL_CHAIN = [
  "meta/llama-3.1-405b-instruct",            // Best quality, largest
  "nvidia/llama-3.1-nemotron-70b-instruct",  // Nvidia's own, very reliable
  "meta/llama-3.3-70b-instruct",             // Latest Llama, excellent
  "meta/llama-3.1-70b-instruct",             // Proven workhorse
  "mistralai/mixtral-8x22b-instruct-v0.1",  // Diverse architecture, solid fallback
] as const;

export interface NvidiaCallArgs {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Response format — "json_object" forces JSON-only output */
  responseFormat?: "json_object";
  /** Per-request timeout in ms. Default: 60s. Pass an array for per-model timeouts. */
  timeoutMs?: number | readonly number[];
  /** Optional model chain override (defaults to NVIDIA_MODEL_CHAIN) */
  models?: readonly string[];
}

/**
 * Call Nvidia NIM API with automatic 5-model fallback chain.
 * Tries each model in NVIDIA_MODEL_CHAIN — moves to the next on any error.
 * Throws only if ALL 5 models fail.
 */
export async function callNvidia(args: NvidiaCallArgs): Promise<string> {
  const apiKey = process.env.GEMINI_FALLBACK_KEY;
  if (!apiKey) {
    throw new Error("[nvidiaClient] GEMINI_FALLBACK_KEY not set in environment.");
  }

  const {
    messages,
    temperature = 0.7,
    max_tokens = 1200,
    responseFormat,
    timeoutMs = 60_000,
    models = NVIDIA_MODEL_CHAIN,
  } = args;

  const url = `${NVIDIA_BASE_URL}/chat/completions`;
  let lastErr: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const modelTimeoutMs = Array.isArray(timeoutMs)
      ? (timeoutMs[i] ?? timeoutMs[timeoutMs.length - 1] ?? 60_000)
      : timeoutMs;

    const body = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
      ...(responseFormat ? { response_format: { type: responseFormat } } : {}),
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), modelTimeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === "AbortError";
      lastErr = isTimeout
        ? new Error(`[nvidiaClient] Timeout after ${Math.round(modelTimeoutMs / 1000)}s (model=${model})`)
        : err;
      console.warn(
        `[nvidiaClient] Network error on ${model} (${i + 1}/${models.length}): ${(lastErr as Error).message}. ${i + 1 < models.length ? `Trying ${models[i + 1]}…` : "No more models."}`
      );
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastErr = new Error(
        `[nvidiaClient] HTTP ${res.status} from ${model}: ${text || res.statusText}`
      );
      console.warn(
        `[nvidiaClient] ${model} returned HTTP ${res.status} (${i + 1}/${models.length}). ${i + 1 < models.length ? `Trying ${models[i + 1]}…` : "No more models."}`
      );
      continue;
    }

    const data: any = await res.json().catch(() => null);
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";

    if (!content) {
      lastErr = new Error(`[nvidiaClient] Empty response from ${model}`);
      console.warn(
        `[nvidiaClient] Empty content from ${model} (${i + 1}/${models.length}). ${i + 1 < models.length ? `Trying ${models[i + 1]}…` : "No more models."}`
      );
      continue;
    }

    console.log(`[nvidiaClient] ✓ Success with ${model} (attempt ${i + 1}/${models.length})`);
    return content.trim();
  }

  throw lastErr ?? new Error("[nvidiaClient] All Nvidia models failed without a captured error.");
}
