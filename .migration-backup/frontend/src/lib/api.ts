const DEFAULT_BACKEND_URL = "https://back-mp9k.onrender.com";
const FRONTEND_HOSTS = new Set(["rolebolt.tech", "www.rolebolt.tech"]);

function defaultApiBaseUrl(): string {
  if (process.env.NODE_ENV === "production") return DEFAULT_BACKEND_URL;
  return typeof window === "undefined" ? "http://localhost:8080" : "/backend";
}

function normalizeApiBaseUrl(value?: string): string {
  const raw = (value || "").trim().replace(/\/$/, "");
  if (!raw) return defaultApiBaseUrl();

  if (raw.startsWith("/")) return process.env.NODE_ENV === "production" ? DEFAULT_BACKEND_URL : defaultApiBaseUrl();

  try {
    const url = new URL(raw);
    if (FRONTEND_HOSTS.has(url.hostname)) return DEFAULT_BACKEND_URL;
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return process.env.NODE_ENV === "production" ? DEFAULT_BACKEND_URL : "/backend";
    }
  } catch {
    return defaultApiBaseUrl();
  }

  return raw;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL
);

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export type BillingErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
  category?: string;
  feature?: string;
  plan?: string;
  used?: number;
  limit?: number | null;
  resetAt?: string;
  upgradeRequired?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly payload: BillingErrorPayload;

  constructor(status: number, payload: BillingErrorPayload, fallback: string) {
    super(payload.message || payload.error || fallback);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function apiErrorFromPayload(
  status: number,
  payload: BillingErrorPayload,
  fallback: string,
): ApiError {
  return new ApiError(status, payload, fallback);
}

/** Read a failed response while preserving stable billing fields for the UI. */
export async function throwApiError(res: Response, fallback: string): Promise<never> {
  const payload = await res.json().catch(() => ({})) as BillingErrorPayload;
  throw apiErrorFromPayload(res.status, payload, fallback);
}

export function errorText(error: unknown, fallback = "Something went wrong."): string {
  if (typeof error === "string" && error.trim()) return error;
  return error instanceof Error ? error.message : fallback;
}

/** Routes that go through the public (unauthenticated) prefix */
export function apiPublicUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}/recruit-public${normalizedPath}`;
}

export async function readApiJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    const contentType = res.headers.get("content-type") || "unknown";
    throw new Error(
      res.ok
        ? "Backend returned an invalid response. Please try again."
        : `Backend request failed (${res.status}, ${contentType}). Please try again.`
    );
  }
}