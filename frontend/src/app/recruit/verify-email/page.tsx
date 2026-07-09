"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendEmailVerification, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { apiUrl } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { firebaseUser, loading, refreshProfile } = useRecruitAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user is already verified (e.g. they come back here after verifying), send them on
  useEffect(() => {
    if (firebaseUser?.emailVerified) {
      handleContinueVerified();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  const handleContinueVerified = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) { router.replace("/recruit/login"); return; }

    try {
      // Force-refresh the token so emailVerified is up-to-date
      await user.reload();
      const fresh = auth.currentUser;
      if (!fresh?.emailVerified) {
        setError("Your email is not verified yet. Please check your inbox and click the link, then try again.");
        return;
      }

      // Create/upsert the backend profile now that they're verified
      const token = await fresh.getIdToken(true);
      const res = await fetch(apiUrl("/recruit/auth/profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: "creator", name: fresh.displayName ?? "", email: fresh.email ?? "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to set up profile");
      }
      await refreshProfile();
      router.replace("/recruit/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }, [router, refreshProfile]);

  async function handleCheckVerification() {
    setError(null);
    setChecking(true);
    try {
      await handleContinueVerified();
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) { router.replace("/recruit/login"); return; }
      await sendEmailVerification(user);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification email.");
    } finally {
      setResending(false);
    }
  }

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    await signOut(auth);
    router.replace("/recruit/login");
  }

  // While auth is resolving, show a neutral loading state
  if (loading) {
    return <div className="min-h-screen bg-[#f8fafc]" />;
  }

  // No signed-in user — send them to login
  if (!firebaseUser) {
    router.replace("/recruit/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/recruit" className="flex items-center gap-2 group">
            <RoleboltLogo size="sm" className="group-hover:shadow-[0_3px_12px_rgba(10,102,194,0.36)] group-hover:scale-105 transition-all" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="p-8 text-center">
              {/* Email icon */}
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100">
                <svg width="26" height="26" fill="none" stroke="#0a66c2" strokeWidth="1.8" viewBox="0 0 24 24">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <polyline points="2,4 12,13 22,4"/>
                </svg>
              </div>

              <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">Check your inbox</h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                We sent a verification link to
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 break-all">
                {firebaseUser.email}
              </p>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Click the link in the email to verify your account. Once verified, come back here and click&nbsp;
                <strong className="text-slate-600">Continue</strong>.
              </p>

              {/* Spam folder notice */}
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                <svg width="14" height="14" fill="none" stroke="#b45309" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Didn't receive the email? Check your <strong>Spam or Junk</strong> folder. If you still can't find it, use the resend button below.
                </p>
              </div>

              {error && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-red-500 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                </div>
              )}

              {resent && !error && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-500 mt-0.5 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  <p className="text-xs text-emerald-700 leading-relaxed">Verification email resent! Check your inbox.</p>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleCheckVerification}
                  disabled={checking}
                  className="h-11 w-full rounded-xl bg-[#0a66c2] text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,102,194,0.28)] hover:bg-[#004182] hover:shadow-[0_4px_16px_rgba(10,102,194,0.36)] hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {checking ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Checking…
                    </span>
                  ) : "I've verified — Continue"}
                </button>

                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60"
                >
                  {resending ? "Sending…" : "Resend verification email"}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-7 py-4 text-center">
              <p className="text-xs text-slate-400">
                Wrong email?{" "}
                <button onClick={handleSignOut} className="font-semibold text-[#0a66c2] hover:underline">
                  Sign out and start over
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
