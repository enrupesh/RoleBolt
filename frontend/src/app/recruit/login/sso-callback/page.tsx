"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Clerk SSO callback for the sign-in flow.
 *
 * After a user completes Google / GitHub OAuth, Clerk redirects here.
 * AuthenticateWithRedirectCallback exchanges the OAuth token, completes
 * the Clerk session, then redirects to the URL carried in
 * `sign_in_force_redirect_url` (set by <SignIn forceRedirectUrl="…">).
 */
export default function SignInSSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      signInUrl="/recruit/login"
      signUpUrl="/recruit/signup"
      signInForceRedirectUrl="/recruit/dashboard"
      signUpForceRedirectUrl="/recruit/dashboard"
    />
  );
}
