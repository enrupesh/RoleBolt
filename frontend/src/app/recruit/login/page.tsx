"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { apiUrl } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";

function RecruitLoginForm() {
  const router = useRouter();
  const { refreshProfile } = useRecruitAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setupProfile(token: string, name?: string, userEmail?: string) {
    await fetch(apiUrl("/recruit/auth/profile"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: "creator", name: name ?? "", email: userEmail ?? "" }),
    });
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError || !data) {
        setError(signInError?.message ?? "Could not sign in. Please try again.");
        return;
      }
      const token = (data.session as any)?.token as string;
      if (token) await setupProfile(token, data.user?.name, data.user?.email);
      await refreshProfile();
      router.replace("/recruit/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/recruit/dashboard",
      });
      // Page will redirect to Google then back — no code needed after this
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
      setGoogleLoading(false);
    }
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
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
              </button>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-7 py-4 text-center">
              <p className="text-xs text-slate-500">
                Don&apos;t have an account?{" "}
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
