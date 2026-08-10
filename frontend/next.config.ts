import type { NextConfig } from "next";
import path from "path";

const BACKEND_URL = (
  process.env.BACKEND_URL || "http://localhost:8080"
).replace(/\/$/, "");

const allowedDevOrigins = new Set<string>([
  "127.0.0.1",
  "localhost",
]);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // Dependencies are installed per-package. Keep Turbopack scoped to this app.
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: allowedDevOrigins.size > 0 ? Array.from(allowedDevOrigins) : undefined,
  transpilePackages: [],
  async rewrites() {
    // The site-guide chatbot route is brand-new and may not be deployed to the
    // production backend (BACKEND_URL) yet. In local dev, always proxy it to
    // the local backend workflow (port 8080) so it's testable immediately,
    // regardless of what BACKEND_URL points to. In production this override
    // does not apply — client requests go straight to BACKEND_URL as usual.
    const isDev = process.env.NODE_ENV !== "production";
    const LOCAL_BACKEND_URL = "http://localhost:8080";
    const siteGuideRewrites = isDev
      ? [
          {
            source: "/backend/recruit-public/feedback",
            destination: `${LOCAL_BACKEND_URL}/recruit-public/feedback`,
          },
          {
            source: "/backend/recruit-public/reviews",
            destination: `${LOCAL_BACKEND_URL}/recruit-public/reviews`,
          },
          {
            source: "/backend/recruit-public/reviews/:path*",
            destination: `${LOCAL_BACKEND_URL}/recruit-public/reviews/:path*`,
          },
          {
            source: "/backend/sitegen-public/:path*",
            destination: `${LOCAL_BACKEND_URL}/sitegen-public/:path*`,
          },
          {
            source: "/sitegen-public/:path*",
            destination: `${LOCAL_BACKEND_URL}/sitegen-public/:path*`,
          },
          {
            source: "/backend/recruit-public/site-guide/:path*",
            destination: `${LOCAL_BACKEND_URL}/recruit-public/site-guide/:path*`,
          },
          {
            source: "/recruit-public/site-guide/:path*",
            destination: `${LOCAL_BACKEND_URL}/recruit-public/site-guide/:path*`,
          },
        ]
      : [];

    return [
      ...siteGuideRewrites,
      {
        source: "/backend/recruit/:path*",
        destination: `${BACKEND_URL}/recruit/:path*`,
      },
      {
        source: "/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
      {
        source: "/recruit-public/:path*",
        destination: `${BACKEND_URL}/recruit-public/:path*`,
      },
      {
        source: "/sitegen-public/:path*",
        destination: `${BACKEND_URL}/sitegen-public/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

export default nextConfig;
