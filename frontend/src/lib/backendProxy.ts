import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "https://raina-1.onrender.com";
const TIMEOUT_MS = 65_000;
const FRONTEND_HOSTS = new Set(["plyndrox.app", "www.plyndrox.app"]);

function normalizeBackendUrl(value: string) {
  const raw = value.trim().replace(/\/$/, "");
  try {
    const url = new URL(raw);
    return FRONTEND_HOSTS.has(url.hostname) ? DEFAULT_BACKEND_URL : raw;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

const BACKEND_URL = normalizeBackendUrl(
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "production" ? DEFAULT_BACKEND_URL : "http://localhost:8080")
);

export async function proxyBackendRequest(
  req: NextRequest,
  path: string[],
  prefix = ""
) {
  const safePath = path.map(segment => encodeURIComponent(segment)).join("/");
  const targetPath = [prefix.replace(/^\/|\/$/g, ""), safePath].filter(Boolean).join("/");
  const targetUrl = `${BACKEND_URL}/${targetPath}${req.nextUrl.search || ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {};
    const auth = req.headers.get("authorization");
    const contentType = req.headers.get("content-type");
    const accept = req.headers.get("accept");
    if (auth) headers.authorization = auth;
    if (contentType) headers["content-type"] = contentType;
    if (accept) headers.accept = accept;

    const init: RequestInit = {
      method: req.method,
      headers,
      signal: controller.signal,
      cache: "no-store",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.text();
    }

    const upstream = await fetch(targetUrl, init);
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    const contentDisposition = upstream.headers.get("content-disposition");
    responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json");
    responseHeaders.set("cache-control", "no-store");
    if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.name === "AbortError" ? "Backend request timed out. Please try again." : "Backend service is unavailable." },
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }
}