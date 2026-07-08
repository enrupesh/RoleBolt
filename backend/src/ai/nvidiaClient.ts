// Thin OpenAI-compatible chat-completions client. Originally written against
// NVIDIA NIM; now pointed at Mesh API (https://developers.meshapi.ai), which
// exposes the same OpenAI-style `/v1/chat/completions` contract in front of
// 1000+ models (use provider-prefixed model IDs, e.g. "openai/gpt-4o-mini").
// The function/param names below still say "nvidia" for historical reasons
// but the logic is provider-agnostic — only `baseUrl`/`apiKey`/`model` change.
export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string | Array<Record<string, unknown>>;
};

/**
 * Detect "model is permanently unavailable on this endpoint" responses from
 * NVIDIA NIM. These are NOT transient — retrying the same model is pointless,
 * but if the caller supplied `fallbackModels`, we should immediately try the
 * next one. As of April 2026 NVIDIA returns:
 *   HTTP 400 {"detail":"Function id '...': DEGRADED function cannot be invoked"}
 * for retired models. We also treat 404 (model not found) and 4xx bodies that
 * mention "model" + "not available/found/supported" the same way.
 */
function isModelUnavailableError(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status < 400 || status >= 500) return false;
  const lower = body.toLowerCase();
  if (lower.includes("degraded function")) return true;
  if (lower.includes("model not found")) return true;
  if (lower.includes("model is not available")) return true;
  if (lower.includes("does not exist") && lower.includes("model")) return true;
  if (lower.includes("unknown model")) return true;
  return false;
}

export async function callNvidiaChatCompletions(args: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  /** Set to "json_object" to force JSON-only output (OpenAI-compatible). */
  responseFormat?: "json_object";
  /**
   * Optional per-call timeout (milliseconds). Defaults to 45 000 ms — same as
   * before this field was added — so existing callers (Inbox AI, Sales AI,
   * Ibara, etc.) are completely unaffected. Vision OCR calls, which routinely
   * take 30–60 s on large invoice images, can pass a longer value to avoid
   * spurious aborts.
   */
  timeoutMs?: number;
  /**
   * Number of automatic retries for TRANSIENT failures (timeouts, network
   * errors, NVIDIA 5xx and 429). Defaults to 0 to preserve historical
   * behaviour for non-Payables callers. 4xx responses other than 429 are
   * NEVER retried (they indicate a client bug — bad payload, bad model name,
   * bad auth — that retrying can't fix).
   */
  retries?: number;
  /**
   * Ordered list of fallback model IDs. If the primary `model` returns a
   * MODEL-UNAVAILABLE response (NVIDIA's "DEGRADED function cannot be
   * invoked", 404 model-not-found, etc.) the client AUTOMATICALLY transitions
   * to the next model in the list and replays the same request. This makes
   * NVIDIA's silent model retirements (which previously surfaced as user-
   * facing extraction failures) self-healing as long as at least one fallback
   * is still alive. Each fallback also gets the full retry budget. A loud
   * warning is logged whenever a fallback is engaged so we can swap the
   * primary in code on the next deploy.
   */
  fallbackModels?: string[];
}) {
  const {
    apiKey,
    baseUrl = "https://api.meshapi.ai/v1",
    model = "openai/gpt-4o-mini",
    messages,
    temperature = 0.7,
    top_p = 0.9,
    max_tokens = 1200,
    responseFormat,
    timeoutMs = 45_000,
    retries = 0,
    fallbackModels = [],
  } = args;

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const modelChain = [model, ...fallbackModels.filter((m) => m && m !== model)];
  let lastErr: unknown;

  for (let modelIdx = 0; modelIdx < modelChain.length; modelIdx++) {
    const currentModel = modelChain[modelIdx];
    const body = JSON.stringify({
      model: currentModel,
      messages,
      temperature,
      top_p,
      max_tokens,
      stream: false,
      ...(responseFormat ? { response_format: { type: responseFormat } } : {}),
    });

    const maxAttempts = Math.max(1, retries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
          ? new Error(`NVIDIA API timeout: request exceeded ${Math.round(timeoutMs / 1000)} seconds (model=${currentModel}, attempt ${attempt}/${maxAttempts}).`)
          : err;
        if (attempt < maxAttempts) {
          const backoffMs = 1000 * attempt;
          console.warn(
            `[nvidiaClient] transient ${isTimeout ? "timeout" : "network error"} on ${currentModel} (attempt ${attempt}/${maxAttempts}): ${err?.message ?? err}. Retrying in ${backoffMs}ms…`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        // Exhausted retries on this model. If we have a fallback, log and
        // move on to it; otherwise rethrow.
        if (modelIdx < modelChain.length - 1) {
          console.warn(
            `[nvidiaClient] giving up on ${currentModel} after ${maxAttempts} attempts (${isTimeout ? "timeout" : "network error"}). Falling back to ${modelChain[modelIdx + 1]}.`
          );
          break; // breaks inner attempt loop, outer modelIdx loop continues
        }
        throw lastErr;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const isTransient = res.status === 429 || (res.status >= 500 && res.status <= 599);
        const isModelDead = isModelUnavailableError(res.status, text);
        const apiErr = new Error(`NVIDIA API error (${res.status}, model=${currentModel}): ${text || res.statusText}`);
        lastErr = apiErr;

        if (isModelDead) {
          // Model is permanently unavailable on this NVIDIA endpoint. Skip
          // remaining retries on THIS model and immediately try the next
          // fallback model if any. Loud warning so ops can promote the
          // fallback to primary on the next deploy.
          if (modelIdx < modelChain.length - 1) {
            console.error(
              `[nvidiaClient] MODEL DEGRADED — ${currentModel} returned HTTP ${res.status}: ${(text || res.statusText).slice(0, 240)}. Auto-falling back to ${modelChain[modelIdx + 1]}. Promote this fallback to primary on the next deploy.`
            );
            break; // try next model
          }
          console.error(
            `[nvidiaClient] MODEL DEGRADED — ${currentModel} returned HTTP ${res.status} and no fallback models are configured: ${(text || res.statusText).slice(0, 240)}.`
          );
          throw apiErr;
        }

        if (isTransient && attempt < maxAttempts) {
          const backoffMs = 1500 * attempt;
          console.warn(
            `[nvidiaClient] transient HTTP ${res.status} on ${currentModel} (attempt ${attempt}/${maxAttempts}): ${(text || res.statusText).slice(0, 200)}. Retrying in ${backoffMs}ms…`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        // Out of retries on a transient error — fall back if we can,
        // otherwise rethrow.
        if (isTransient && modelIdx < modelChain.length - 1) {
          console.warn(
            `[nvidiaClient] giving up on ${currentModel} after ${maxAttempts} attempts (HTTP ${res.status}). Falling back to ${modelChain[modelIdx + 1]}.`
          );
          break;
        }
        throw apiErr;
      }

      const data: any = await res.json();
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        "";
      return String(content).trim();
    }
  }

  throw lastErr ?? new Error("NVIDIA API call failed without a captured error.");
}
