import type { NextConfig } from "next";

const BACKEND_URL = (
  process.env.BACKEND_URL || "http://localhost:8080"
).replace(/\/$/, "");

const allowedDevOrigins = new Set<string>([
  "*.replit.dev",
  "*.janeway.replit.dev",
  "*.repl.co",
]);
if (process.env.REPLIT_DEV_DOMAIN) {
  allowedDevOrigins.add(process.env.REPLIT_DEV_DOMAIN.replace(/^https?:\/\//, ""));
}
if (process.env.REPLIT_DOMAINS) {
  for (const domain of process.env.REPLIT_DOMAINS.split(",")) {
    const normalized = domain.trim().replace(/^https?:\/\//, "");
    if (normalized) allowedDevOrigins.add(normalized);
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  allowedDevOrigins: allowedDevOrigins.size > 0 ? Array.from(allowedDevOrigins) : undefined,
  transpilePackages: [
    "firebase",
    "@firebase/app",
    "@firebase/auth",
    "@firebase/firestore",
    "@firebase/storage",
  ],
  async rewrites() {
    return [
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
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

export default nextConfig;
