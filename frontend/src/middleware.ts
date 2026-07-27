import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require the user to be signed in
const isProtectedRoute = createRouteMatcher([
  "/recruit/dashboard(.*)",
  "/recruit/jobs(.*)",
  "/recruit/analytics(.*)",
  "/recruit/talent-pool(.*)",
  "/recruit/copilot(.*)",
  "/recruit/forms(.*)",
  "/recruit/recruiter-profile(.*)",
  "/recruit/verification(.*)",
  "/recruit/diagnostics(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
