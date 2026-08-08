/**
 * Sitegen NVIDIA integration — uses Rolebolt's NVIDIA NIM client directly.
 * No Gemini, Mesh, or OpenAI. Isolated behind this module for extraction.
 */
import { callNvidia, NVIDIA_MODEL_CHAIN } from "../../../ai/nvidiaClient";

/** Faster models first — 405B was causing 60–90s waits before any response. */
export const SITEGEN_NVIDIA_MODEL_CHAIN = [
  "meta/llama-3.3-70b-instruct",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "meta/llama-3.1-70b-instruct",
] as const;

/** Previous Sitegen defaults (for benchmarks): 405B first, 90s timeout, 4000 tokens. */
export const SITEGEN_LEGACY_NVIDIA_MODEL_CHAIN = NVIDIA_MODEL_CHAIN;

export const SITEGEN_NVIDIA_TIMEOUT_MS = 50_000;
export const SITEGEN_NVIDIA_MAX_TOKENS = 2400;

export async function callSitegenNvidia(prompt: string, system: string): Promise<string> {
  return callNvidia({
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.35,
    max_tokens: SITEGEN_NVIDIA_MAX_TOKENS,
    responseFormat: "json_object",
    timeoutMs: SITEGEN_NVIDIA_TIMEOUT_MS,
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
