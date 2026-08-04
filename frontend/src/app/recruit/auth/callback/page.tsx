"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { apiUrl } from "@/lib/api";
import { markSignupWelcome } from "@/lib/signupWelcome";

function Spinner() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin h-8 w-8 text-[#0a66c2]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-500 font-medium">Signing you in…</p>
      </div>
    </div>
  );
}

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { signInWithToken } = useRecruitAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  const target = params.get("target") === "seeker" ? "seeker" : "recruit";
  const intent = params.get("intent") === "login" ? "login" : "signup";
  const destination = target === "seeker"
    ? intent === "signup" ? "/seeker/profile?onboarding=1" : "/seeker/dashboard"
    : "/recruit/dashboard";
  const retryHref = target === "seeker"
    ? intent === "signup" ? "/seeker/signup" : "/seeker/login"
    : intent === "login" ? "/recruit/login" : "/recruit/signup";
  const retryLabel = intent === "signup" ? "Back to sign up" : "Back to sign in";

  useEffect(() => {
    const token = params.get("token");
    const error = params.get("error");

    if (error || !token) {
      const messages: Record<string, string> = {
        github_denied:       "GitHub sign-in was cancelled.",
        invalid_state:       "Invalid OAuth state. Please try again.",
        no_code:             "No authorization code received from GitHub.",
        no_github_email:     "Your GitHub account has no public or verified email. Please add one in GitHub settings and try again.",
        github_token_failed: "GitHub token exchange failed. Please try again.",
        github_failed:       "GitHub sign-in failed. Please try again.",
        role_mismatch:       "This account belongs to the other Rolebolt workspace. Please use the correct sign-in page.",
      };
      setErrMsg(messages[error ?? ""] || "Something went wrong. Please try again.");
      setStatus("error");
      return;
    }

    (async () => {
      try {
        if (target === "seeker") {
          const headers = { Authorization: `Bearer ${token}` };
          const meRes = await fetch(apiUrl("/auth/me"), { headers });
          const me = meRes.ok ? await meRes.json() : null;

          const profileRes = await fetch(apiUrl("/recruit/auth/profile"), {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ role: "seeker", username: me?.username, email: me?.email }),
          });
          if (!profileRes.ok) {
            const profileError = await profileRes.json().catch(() => ({}));
            throw new Error(profileError.error ?? "This account belongs to the creator workspace.");
          }

          const seekerProfileRes = await fetch(apiUrl("/recruit/seeker/profile"), {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ username: me?.username, email: me?.email }),
          });
          if (!seekerProfileRes.ok) {
            throw new Error("Could not create the seeker profile.");
          }
        }

        const result = await signInWithToken(token);
        if (result.error) {
          setErrMsg(result.error);
          setStatus("error");
          return;
        }

        if (intent === "signup" && params.get("created") !== "0") {
          markSignupWelcome(target === "seeker" ? "seeker" : "creator");
        }
        if (!result.username?.trim()) {
          router.replace(`/recruit/choose-username?role=${target}&next=${encodeURIComponent(destination)}`);
        } else {
          router.replace(destination);
        }
      } catch {
        setErrMsg("Something went wrong while completing sign-in. Please try again.");
        setStatus("error");
      }
    })();
  }, [params, signInWithToken, router, target, destination]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Sign-in failed</h1>
          <p className="text-sm text-slate-500 mb-6">{errMsg}</p>
          <a
            href={retryHref}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition-all"
          >
            {retryLabel}
          </a>
        </div>
      </div>
    );
  }

  return <Spinner />;
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OAuthCallbackInner />
    </Suspense>
  );
}
