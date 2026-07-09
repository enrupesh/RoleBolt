// Thin OpenAI-compatible chat-completions client for Mesh API
// (https://developers.meshapi.ai). Mesh exposes the standard OpenAI-style
// `/v1/chat/completions` contract in front of 1,000+ models — use
// provider-prefixed model IDs, e.g. "openai/gpt-4o-mini", "anthropic/claude-3-haiku".
// Supports automatic retries, per-model fallback chains, and configurable timeouts.
export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string | Array<Record<string, unknown>>;
};

/**
 * Detect "model is permanently unavailable" responses from Mesh API.
 * These are NOT transient — retrying the same model is pointless, but if the
 * caller supplied `fallbackModels` we immediately try the next one.
 * Covers: 404 (model not found), 400 with "DEGRADED function cannot be invoked",
 * and any 4xx body that references a model as not available/found/supported.
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

export async function callMeshChatCompletions(args: {
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
   * Optional per-call timeout (milliseconds). Defaults to 45 000 ms.
   * Long-running calls (e.g. large document analysis) can pass a higher value.
   */
  timeoutMs?: number;
  /**
   * Number of automatic retries for TRANSIENT failures (timeouts, network
   * errors, 5xx and 429). Defaults to 0. 4xx responses other than 429 are
   * never retried — they indicate a client-side error that retrying cannot fix.
   */
  retries?: number;
  /**
   * Ordered list of fallback model IDs. If the primary `model` returns a
   * MODEL-UNAVAILABLE response, the client automatically transitions to the
   * next model and replays the same request. Each fallback receives the full
   * retry budget. A warning is logged whenever a fallback is engaged.
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
          ? new Error(`Mesh API timeout: request exceeded ${Math.round(timeoutMs / 1000)} seconds (model=${currentModel}, attempt ${attempt}/${maxAttempts}).`)
          : err;
        if (attempt < maxAttempts) {
          const backoffMs = 1000 * attempt;
          console.warn(
            `[meshClient] transient ${isTimeout ? "timeout" : "network error"} on ${currentModel} (attempt ${attempt}/${maxAttempts}): ${err?.message ?? err}. Retrying in ${backoffMs}ms…`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        // Exhausted retries on this model — fall back if available, else rethrow.
        if (modelIdx < modelChain.length - 1) {
          console.warn(
            `[meshClient] giving up on ${currentModel} after ${maxAttempts} attempts (${isTimeout ? "timeout" : "network error"}). Falling back to ${modelChain[modelIdx + 1]}.`
          );
          break;
        }
        throw lastErr;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const isTransient = res.status === 429 || (res.status >= 500 && res.status <= 599);
        const isModelDead = isModelUnavailableError(res.status, text);
        const apiErr = new Error(`Mesh API error (${res.status}, model=${currentModel}): ${text || res.statusText}`);
        lastErr = apiErr;

        if (isModelDead) {
          // Model is permanently unavailable. Skip remaining retries and try
          // the next fallback model. Log loudly so the primary can be updated.
          if (modelIdx < modelChain.length - 1) {
            console.error(
              `[meshClient] MODEL UNAVAILABLE — ${currentModel} returned HTTP ${res.status}: ${(text || res.statusText).slice(0, 240)}. Auto-falling back to ${modelChain[modelIdx + 1]}.`
            );
            break;
          }
          console.error(
            `[meshClient] MODEL UNAVAILABLE — ${currentModel} returned HTTP ${res.status} and no fallback models are configured: ${(text || res.statusText).slice(0, 240)}.`
          );
          throw apiErr;
        }

        if (isTransient && attempt < maxAttempts) {
          const backoffMs = 1500 * attempt;
          console.warn(
            `[meshClient] transient HTTP ${res.status} on ${currentModel} (attempt ${attempt}/${maxAttempts}): ${(text || res.statusText).slice(0, 200)}. Retrying in ${backoffMs}ms…`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        // Out of retries on a transient error — fall back if possible.
        if (isTransient && modelIdx < modelChain.length - 1) {
          console.warn(
            `[meshClient] giving up on ${currentModel} after ${maxAttempts} attempts (HTTP ${res.status}). Falling back to ${modelChain[modelIdx + 1]}.`
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

  throw lastErr ?? new Error("Mesh API call failed without a captured error.");
}
