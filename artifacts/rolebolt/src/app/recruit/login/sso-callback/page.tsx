"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// SSO callback — Clerk removed. Redirect to dashboard directly.
export default function SignInSSOCallback() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/recruit/dashboard");
  }, [router]);
  return null;
}
