/**
 * Sitegen NVIDIA integration — uses Rolebolt's NVIDIA NIM client directly.
 * No Gemini, Mesh, or OpenAI. Isolated behind this module for extraction.
 */
import { callNvidia } from "../../../ai/nvidiaClient";

export async function callSitegenNvidia(prompt: string, system: string): Promise<string> {
  return callNvidia({
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.35,
    max_tokens: 4000,
    responseFormat: "json_object",
    timeoutMs: 90_000,
  });
}
