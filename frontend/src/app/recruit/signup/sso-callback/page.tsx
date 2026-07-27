"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Clerk SSO callback for the sign-up flow.
 *
 * After a user completes Google / GitHub OAuth, Clerk redirects here.
 * AuthenticateWithRedirectCallback exchanges the OAuth token, completes
 * the Clerk session, then redirects to the URL carried in
 * `sign_up_force_redirect_url` (set by <SignUp forceRedirectUrl="…">).
 */
export default function SignUpSSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      signInUrl="/recruit/login"
      signUpUrl="/recruit/signup"
      signInForceRedirectUrl="/recruit/dashboard"
      signUpForceRedirectUrl="/recruit/dashboard"
    />
  );
}
