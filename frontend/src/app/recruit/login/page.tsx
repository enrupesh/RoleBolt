"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { apiUrl } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";

function RecruitLoginForm() {
  const router = useRouter();
  const { refreshProfile } = useRecruitAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedUser, setUnverifiedUser] = useState<import("firebase/auth").User | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resentVerification, setResentVerification] = useState(false);

  async function setupRecruitProfile() {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    const res = await fetch(apiUrl("/recruit/auth/profile"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: "creator", name: user.displayName ?? "", email: user.email ?? "" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to set up profile");
    }
    await refreshProfile();
    router.replace("/recruit/dashboard");
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverifiedUser(null);
    setResentVerification(false);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        // Keep user signed in but block access — show verify prompt
        setUnverifiedUser(cred.user);
        setError("Please verify your email before signing in. Check your inbox for the verification link.");
        return;
      }
      await setupRecruitProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!unverifiedUser) return;
    setResendingVerification(true);
    setResentVerification(false);
    try {
      await sendEmailVerification(unverifiedUser);
      setResentVerification(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
      await setupRecruitProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/recruit" className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a66c2] text-white font-black text-xs shadow-[0_2px_8px_rgba(10,102,194,0.28)] group-hover:shadow-[0_3px_12px_rgba(10,102,194,0.36)] transition-all">R</div>
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <p className="text-xs text-slate-400">New here? <Link href="/recruit/signup" className="font-semibold text-[#0a66c2] hover:underline">Create account</Link></p>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to your Rolebolt account</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="p-7">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-red-500 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                  </div>
                  {unverifiedUser && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      {resentVerification ? (
                        <p className="text-xs text-emerald-700 font-medium">✓ Verification email sent! Check your inbox.</p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendingVerification}
                          className="text-xs font-semibold text-[#0a66c2] hover:underline disabled:opacity-60"
                        >
                          {resendingVerification ? "Sending…" : "Resend verification email"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
                  <input
                    id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 transition-all placeholder:text-slate-400"
                    placeholder="you@example.com" autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                  <input
                    id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 transition-all placeholder:text-slate-400"
                    placeholder="••••••••" autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="mt-1 h-11 w-full rounded-xl bg-[#0a66c2] text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,102,194,0.28)] hover:bg-[#004182] hover:shadow-[0_4px_16px_rgba(10,102,194,0.36)] hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Signing in…
                    </span>
                  ) : "Sign in"}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <button
                type="button" onClick={handleGoogleLogin} disabled={googleLoading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
                </svg>
                {googleLoading ? "Please wait…" : "Continue with Google"}
              </button>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-7 py-4 text-center">
              <p className="text-xs text-slate-500">
                Don't have an account?{" "}
                <Link href="/recruit/signup" className="font-semibold text-[#0a66c2] hover:underline">Create one free</Link>
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            <Link href="/recruit" className="hover:text-slate-600 hover:underline transition-colors">← Back to Rolebolt</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RecruitLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fafc]" />}>
      <RecruitLoginForm />
    </Suspense>
  );
}
