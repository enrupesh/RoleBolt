import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// All routes are open — auth is handled client-side by RecruitGuard.
const NO_INDEX_PREFIXES = [
  "/billing",
  "/f/",
  "/recruit/analytics",
  "/recruit/assessment",
  "/recruit/auth",
  "/recruit/billing",
  "/recruit/choose-username",
  "/recruit/company-profile",
  "/recruit/copilot",
  "/recruit/dashboard",
  "/recruit/diagnostics",
  "/recruit/forms",
  "/recruit/forgot-password",
  "/recruit/jobs",
  "/recruit/judges",
  "/recruit/login",
  "/recruit/mesh-api-status",
  "/recruit/new",
  "/recruit/offer",
  "/recruit/raka98",
  "/recruit/recruiter",
  "/recruit/recruiter-profile",
  "/recruit/reset-password",
  "/recruit/signup",
  "/recruit/status",
  "/recruit/talent-pool",
  "/recruit/team-invite",
  "/recruit/verification",
  "/recruit/verify-email",
  "/seeker/applications",
  "/seeker/billing",
  "/seeker/career",
  "/seeker/cover-letter",
  "/seeker/dashboard",
  "/seeker/email",
  "/seeker/extension",
  "/seeker/interview-prep",
  "/seeker/login",
  "/seeker/profile",
  "/seeker/resume",
  "/seeker/signup",
  "/seeker/tracker",
  "/seeker/verify-email",
  "/seeker/workspace",
];

export function proxy(req: NextRequest) {
  const response = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const isApplyRoute = pathname.endsWith("/apply");
  if (isApplyRoute || NO_INDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
