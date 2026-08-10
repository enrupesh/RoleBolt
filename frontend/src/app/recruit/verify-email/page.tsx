"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiUrl } from "@/lib/api";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { markSignupWelcome } from "@/lib/signupWelcome";

type Status = "loading" | "success" | "error" | "expired" | "no-token";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token        = searchParams.get("token");

  const [status, setStatus]   = useState<Status>(token ? "loading" : "no-token");
  const [message, setMessage] = useState("");
  const [verifiedRole, setVerifiedRole] = useState<"creator" | "seeker">("creator");
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    fetch(apiUrl("/auth/verify-email"), {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          if (data.role === "seeker" || data.role === "creator") setVerifiedRole(data.role);
          markSignupWelcome(data.role === "seeker" ? "seeker" : "creator");
          setStatus("success");
        } else if (data.code === "TOKEN_EXPIRED") {
          setStatus("expired");
        } else {
          setStatus("error");
          setMessage(data.error ?? "Something went wrong.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">

      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center">
          <Link href="/recruit" className="flex items-center gap-2 group">
            <RoleboltLogo size="sm" className="group-hover:scale-105 transition-all" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] rounded-2xl bg-white border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.07)] p-8 text-center">

          {/* Loading */}
          {status === "loading" && (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <svg className="animate-spin h-7 w-7 text-[#0a66c2]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-slate-950 tracking-tight mb-2">Verifying your email…</h2>
              <p className="text-sm text-slate-500">This will only take a moment.</p>
            </>
          )}

          {/* Success */}
          {status === "success" && (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200">
                <svg width="30" height="30" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-slate-950 tracking-tight mb-2">Email verified!</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Your email address has been confirmed. You can now sign in to your Rolebolt account.
              </p>
              <Link
                href={verifiedRole === "seeker" ? "/seeker/login" : "/recruit/login"}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
              >
                {verifiedRole === "seeker" ? "Sign in as a job seeker" : "Sign in to your account"}
              </Link>
            </>
          )}

          {/* Expired */}
          {status === "expired" && (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
                <svg width="28" height="28" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-slate-950 tracking-tight mb-2">Link expired</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                This verification link has expired. Verification links are valid for 24 hours. Please sign in to request a new one.
              </p>
              <Link
                href="/recruit/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
              >
                Go to sign in
              </Link>
            </>
          )}

          {/* No token */}
          {status === "no-token" && (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <svg width="28" height="28" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-slate-950 tracking-tight mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Click the verification link in your email to activate your account.
              </p>
              <Link
                href="/recruit/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Go to sign in
              </Link>
            </>
          )}

          {/* Generic error */}
          {status === "error" && (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 border border-red-200">
                <svg width="28" height="28" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-slate-950 tracking-tight mb-2">Verification failed</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                {message || "This link is invalid or has already been used. Please try signing up again or contact support."}
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/recruit/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
                >
                  Go to sign in
                </Link>
                <Link
                  href="/recruit/signup"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Create a new account
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[#0a66c2] border-t-transparent animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
