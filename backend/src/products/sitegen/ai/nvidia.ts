/**
 * Sitegen NVIDIA integration — uses Rolebolt's NVIDIA NIM client directly.
 * No Gemini, Mesh, or OpenAI. Isolated behind this module for extraction.
 */
import { callNvidia, NVIDIA_MODEL_CHAIN } from "../../../ai/nvidiaClient";

/**
 * NVIDIA-hosted models first for lower latency, then Meta 70B variants, then Mixtral.
 * Per-model timeouts: give the primary model more room under load without waiting
 * 50s × 3 on every slow attempt.
 */
export const SITEGEN_NVIDIA_MODEL_CHAIN = [
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-70b-instruct",
  "mistralai/mixtral-8x22b-instruct-v0.1",
] as const;

export const SITEGEN_NVIDIA_MODEL_TIMEOUTS_MS = [
  90_000,
  75_000,
  75_000,
  60_000,
] as const;

/** Previous Sitegen defaults (for benchmarks): 405B first, 90s timeout, 4000 tokens. */
export const SITEGEN_LEGACY_NVIDIA_MODEL_CHAIN = NVIDIA_MODEL_CHAIN;

export const SITEGEN_NVIDIA_MAX_TOKENS = 1800;

export async function callSitegenNvidia(prompt: string, system: string): Promise<string> {
  return callNvidia({
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.35,
    max_tokens: SITEGEN_NVIDIA_MAX_TOKENS,
    responseFormat: "json_object",
    timeoutMs: SITEGEN_NVIDIA_MODEL_TIMEOUTS_MS,
    models: SITEGEN_NVIDIA_MODEL_CHAIN,
  });
}

export async function callSitegenNvidiaLegacy(prompt: string, system: string): Promise<string> {
  return callNvidia({
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.35,
    max_tokens: 4000,
    responseFormat: "json_object",
    timeoutMs: 90_000,
    models: SITEGEN_LEGACY_NVIDIA_MODEL_CHAIN,
  });
}
