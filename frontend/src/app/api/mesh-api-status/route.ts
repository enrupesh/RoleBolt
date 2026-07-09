import { NextResponse } from "next/server";

const FRONTEND_HOSTS = new Set(["forjob.onrender.com", "rolebolt.app", "www.rolebolt.app"]);

/**
 * Resolve the backend base URL for server-side calls.
 *
 * Priority:
 *  1. BACKEND_URL env var — unless it points at the frontend host or is a
 *     relative path (not reachable server-side).
 *  2. http://localhost:8080 — correct for co-located dev (Replit, Docker) and
 *     any deployment where frontend + backend share a container.
 */
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
  const res = await fetch(`${baseUrl}/mesh-api-status`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`Backend returned non-JSON response (HTTP ${res.status})`);
  }
  return res.json();
}

function errorPayload(message: string): unknown {
  return {
    status: "unavailable",
    reason: message,
    responseTimeMs: null,
    checkedAt: new Date().toISOString(),
    meshApiUrl: "https://api.meshapi.ai/v1",
    apiVersion: "v1",
    models: [
      { id: "openai/gpt-4o-mini",         role: "primary",    label: "GPT-4o mini",          status: "unknown" },
      { id: "anthropic/claude-3-haiku",    role: "fallback-1", label: "Claude 3 Haiku",        status: "unknown" },
      { id: "google/gemini-2.5-flash-lite",role: "fallback-2", label: "Gemini 2.5 Flash Lite", status: "unknown" },
    ],
    services: [
      { id: "resumeAnalysis",           label: "Resume Analysis",            status: "unknown" },
      { id: "candidateScoring",         label: "Candidate Scoring",          status: "unknown" },
      { id: "candidateMatching",        label: "Candidate Matching",         status: "unknown" },
      { id: "jobDescriptionGeneration", label: "Job Description Generation", status: "unknown" },
      { id: "aiAssistant",              label: "AI Recruitment Assistant",   status: "unknown" },
      { id: "formResponseScoring",      label: "Form Response Scoring",      status: "unknown" },
    ],
    systemHealth: { backend: "unavailable", meshApi: "unavailable", database: "unknown", auth: "unknown" },
  };
}

export async function GET() {
  const configuredUrl = resolveBackendUrl();
  // If env points somewhere other than localhost, also try localhost as a
  // fallback — covers split-deployment and misconfigured BACKEND_URL.
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
