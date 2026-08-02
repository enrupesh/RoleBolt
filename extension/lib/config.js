/** @typedef {{ token: string; apiBase: string }} AuthState */

export const DEFAULT_API_BASE = "https://www.rolebolt.tech";
export const STORAGE_KEYS = { token: "rbToken", apiBase: "rbApiBase" };

export function normalizeApiBase(raw) {
  const base = (raw || DEFAULT_API_BASE).trim().replace(/\/$/, "");
  return base || DEFAULT_API_BASE;
}
