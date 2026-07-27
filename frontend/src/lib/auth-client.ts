"use client";

import { createAuthClient } from "better-auth/react";
import { API_BASE_URL } from "@/lib/api";

// Better Auth requires an absolute base URL.
// In the browser, API_BASE_URL may be a relative path like "/backend" (Next.js rewrite).
// Resolve it against window.location.origin so Better Auth gets a valid absolute URL.
function resolveBaseUrl(url: string): string {
  if (typeof window !== "undefined" && url.startsWith("/")) {
    return window.location.origin + url;
  }
  // SSR / already absolute
  if (url.startsWith("/")) return "http://localhost:8080";
  return url;
}

export const authClient = createAuthClient({
  baseURL: resolveBaseUrl(API_BASE_URL),
  basePath: "/api/auth",
});
