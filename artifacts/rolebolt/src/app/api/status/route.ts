import { NextResponse } from "next/server";

const FRONTEND_HOSTS = new Set(["rolebolt.tech", "www.rolebolt.tech"]);

function resolveBackendUrl(): string {
  const raw = (process.env.BACKEND_URL ?? "").trim().replace(/\/$/, "");
  if (!raw || raw.startsWith("/")) return "http://localhost:8080";
  try {
    const url = new URL(raw);
    if (FRONTEND_HOSTS.has(url.hostname)) return "http://localhost:8080";
    return raw;
  } catch {
    return "http://localhost:8080";
  }
}

async function fetchStatus(baseUrl: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}/status`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`Backend returned non-JSON response (HTTP ${res.status})`);
  }
  return res.json();
}

function errorPayload(message: string): unknown {
  const unknown = "unknown" as const;
  const unavailable = "unavailable" as const;
  return {
    status: unavailable,
    checkedAt: new Date().toISOString(),
    totalResponseTimeMs: 0,
    aiApis: {
      googleM: { status: unavailable, responseTimeMs: null, error: message, endpoint: "api.meshapi.ai",                    label: "Google M API" },
      googleN: { status: unavailable, responseTimeMs: null, error: message, endpoint: "integrate.api.nvidia.com",          label: "Google N API" },
      google:  { status: unavailable, responseTimeMs: null, error: message, endpoint: "generativelanguage.googleapis.com", label: "Google API"   },
    },
    systemHealth: {
      backend:  unavailable,
      database: unknown,
      auth:     unknown,
      email:    unknown,
      frontend: "operational" as const,
    },
  };
}

export async function GET() {
  const configuredUrl = resolveBackendUrl();
  const tryUrls =
    configuredUrl !== "http://localhost:8080"
      ? [configuredUrl, "http://localhost:8080"]
      : ["http://localhost:8080"];

  let lastMessage = "Could not reach backend status endpoint.";
  for (const url of tryUrls) {
    try {
      const payload = await fetchStatus(url);
      return NextResponse.json(payload);
    } catch (err: any) {
      lastMessage = err?.message ?? lastMessage;
    }
  }
  return NextResponse.json(errorPayload(lastMessage));
}
