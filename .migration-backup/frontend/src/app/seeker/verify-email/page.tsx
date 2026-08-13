"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { markSignupWelcome } from "@/lib/signupWelcome";

type Status = "loading" | "success" | "error" | "expired" | "no-token";

function SeekerVerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "no-token");
  const [message, setMessage] = useState("");
  const [verifiedRole, setVerifiedRole] = useState<"creator" | "seeker">("seeker");
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    fetch(apiUrl("/auth/verify-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          const role = data.role === "creator" ? "creator" : "seeker";
          setVerifiedRole(role);
          markSignupWelcome(role);
          setStatus("success");
        }
        else if (data.code === "TOKEN_EXPIRED") setStatus("expired");
        else {
          setStatus("error");
          setMessage(data.error ?? "Something went wrong.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [token]);

  const buttonClass =
    "inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors";
  const secondaryClass =
    "inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center gap-2">
          <Link href="/recruit" className="flex items-center gap-2">
            <RoleboltLogo size="sm" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_4px_24px_rgba(79,70,229,0.10)]">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              </div>
              <h1 className="mb-2 text-xl font-extrabold text-slate-950">Verifying your email…</h1>
              <p className="text-sm text-slate-500">This will only take a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600">
                <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h1 className="mb-2 text-xl font-extrabold text-slate-950">Email verified!</h1>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                Your {verifiedRole === "seeker" ? "seeker" : "creator"} account is ready. Sign in to continue.
              </p>
              <Link href={verifiedRole === "seeker" ? "/seeker/login" : "/recruit/login"} className={buttonClass}>
                {verifiedRole === "seeker" ? "Sign in as a job seeker" : "Sign in as a job creator"}
              </Link>
            </>
          )}

          {status === "expired" && (
            <>
              <h1 className="mb-2 text-xl font-extrabold text-slate-950">Link expired</h1>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                This verification link was valid for 24 hours. Sign in to request a new one.
              </p>
              <Link href="/seeker/login" className={buttonClass}>Go to seeker sign in</Link>
            </>
          )}

          {status === "no-token" && (
            <>
              <h1 className="mb-2 text-xl font-extrabold text-slate-950">Check your email</h1>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                Click the verification link in your email to activate your seeker account.
              </p>
              <Link href="/seeker/login" className={secondaryClass}>Go to seeker sign in</Link>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="mb-2 text-xl font-extrabold text-slate-950">Verification failed</h1>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                {message || "This link is invalid or has already been used."}
              </p>
              <div className="space-y-2">
                <Link href="/seeker/login" className={buttonClass}>Go to seeker sign in</Link>
                <Link href="/seeker/signup" className={secondaryClass}>Create a seeker account</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SeekerVerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    }>
      <SeekerVerifyEmailContent />
    </Suspense>
  );
}