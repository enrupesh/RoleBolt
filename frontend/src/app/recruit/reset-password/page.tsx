"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { apiUrl } from "@/lib/api";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [showConf, setShowConf]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState(false);
  const [tokenInvalid, setTokenInvalvalid] = useState(false);

  // If no token in URL, mark invalid immediately
  useEffect(() => {
    if (!token) setTokenInvalvalid(true);
  }, [token]);

  // Password strength
  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)  s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#ef4444", "#f59e0b", "#3b82f6", "#10b981"][strength];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!password)               { setError("Password is required."); return; }
    if (password.length < 8)     { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)    { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && (data.code === "TOKEN_INVALID" || data.code === "TOKEN_EXPIRED")) {
          setTokenInvalvalid(true);
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
      } else {
        setSuccess(true);
        setTimeout(() => router.replace("/recruit/login"), 3000);
      }
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  // ── Invalid / expired token ──
  if (tokenInvalid) {
    return (
      <div className="px-8 py-10 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
          <svg width="26" height="26" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <p className="text-lg font-extrabold text-slate-950 tracking-tight">Link expired or invalid</p>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            This password reset link is no longer valid. Reset links expire after 1 hour and can only be used once.
          </p>
        </div>
        <Link
          href="/recruit/forgot-password"
          className="mt-2 w-full h-11 rounded-xl bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] transition flex items-center justify-center shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
        >
          Request a new link
        </Link>
        <Link href="/recruit/login" className="text-xs text-slate-400 hover:text-slate-600 transition">
          Back to sign in
        </Link>
      </div>
    );
  }

  // ── Success ──
  if (success) {
    return (
      <div className="px-8 py-10 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <svg width="26" height="26" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <p className="text-lg font-extrabold text-slate-950 tracking-tight">Password updated!</p>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Your password has been changed successfully. Redirecting you to sign in…
          </p>
        </div>
        <Link
          href="/recruit/login"
          className="mt-2 w-full h-11 rounded-xl bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] transition flex items-center justify-center shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
        >
          Sign in now
        </Link>
      </div>
    );
  }

  // ── Form ──
  return (
    <>
      <div className="px-8 pt-8 pb-6 border-b border-slate-100">
        <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Set new password</h1>
        <p className="text-sm text-slate-500 mt-1">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4" noValidate>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* New password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              placeholder="Min. 8 characters"
              className="w-full h-11 rounded-xl border border-slate-200 px-3.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 outline-none transition-all"
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>

          {/* Strength bar */}
          {password && (
            <div className="space-y-1 pt-0.5">
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{ background: i <= strength ? strengthColor : "#e2e8f0" }}
                  />
                ))}
              </div>
              <p className="text-xs font-medium" style={{ color: strengthColor }}>{strengthLabel}</p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirm"
              type={showConf ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(""); }}
              placeholder="Re-enter your password"
              className="w-full h-11 rounded-xl border border-slate-200 px-3.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 outline-none transition-all"
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConf(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              aria-label={showConf ? "Hide password" : "Show password"}
            >
              {showConf ? (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
          {/* Match indicator */}
          {confirm && (
            <p className={`text-xs font-medium ${password === confirm ? "text-emerald-600" : "text-red-500"}`}>
              {password === confirm ? "✓ Passwords match" : "Passwords do not match"}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)] hover:shadow-[0_4px_16px_rgba(10,102,194,0.36)] hover:-translate-y-px active:translate-y-0 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </>
          ) : "Set new password"}
        </button>

      </form>

      <div className="px-8 pb-7 text-center">
        <Link href="/recruit/login" className="text-xs text-slate-400 hover:text-slate-600 transition">
          ← Back to sign in
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">

      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/recruit" className="flex items-center gap-2 group">
            <RoleboltLogo size="sm" className="group-hover:scale-105 transition-all" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <p className="text-xs text-slate-400">
            Remember it?{" "}
            <Link href="/recruit/login" className="font-semibold text-[#0a66c2] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden">
            <Suspense fallback={<div className="px-8 py-10 text-center text-sm text-slate-400">Loading…</div>}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
