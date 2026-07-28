"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { apiUrl } from "@/lib/api";
import { firebaseAuth, googleProvider, microsoftProvider } from "@/lib/firebaseClient";
import { signInWithPopup } from "firebase/auth";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}

export default function RecruitLoginPage() {
  const router = useRouter();
  const { signIn, signInWithToken, authUser, recruitProfile, loading } = useRecruitAuth();

  useEffect(() => {
    if (!loading && authUser && recruitProfile) {
      router.replace("/recruit/dashboard");
    }
  }, [loading, authUser, recruitProfile, router]);

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "microsoft" | null>(null);

  const [unverified, setUnverified]       = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const emailRef = useRef(email);
  emailRef.current = email;

  if (loading) return null;

  async function handleSocialLogin(provider: "google" | "microsoft") {
    if (socialLoading) return;
    setError("");
    setSocialLoading(provider);
    try {
      const fbProvider = provider === "google" ? googleProvider : microsoftProvider;
      const result = await signInWithPopup(firebaseAuth, fbProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch(apiUrl("/auth/social"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, provider }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Social sign-in failed. Please try again.");
        return;
      }

      await signInWithToken(data.token);
      router.replace("/recruit/dashboard");
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled or failed. Please try again.");
      }
    } finally {
      setSocialLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setUnverified(false);
    setResendSuccess(false);

    if (!email.trim()) { setError("Email is required."); return; }
    if (!password)     { setError("Password is required."); return; }

    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);

    if (result.error) {
      if (result.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
      } else {
        setError(result.error);
      }
      return;
    }

    router.replace("/recruit/dashboard");
  }

  async function handleResend() {
    if (resendLoading || resendSuccess) return;
    setResendLoading(true);
    try {
      await fetch(apiUrl("/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRef.current.trim() }),
      });
      setResendSuccess(true);
    } catch {
      setResendSuccess(true);
    } finally {
      setResendLoading(false);
    }
  }

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
            New here?{" "}
            <Link href="/recruit/signup" className="font-semibold text-[#0a66c2] hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">

          <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden">

            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-slate-100">
              <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Welcome back</h1>
              <p className="text-sm text-slate-500 mt-1">Sign in to your Rolebolt account</p>
            </div>

            <div className="px-8 pt-6 pb-2 space-y-3">
              {/* Google button */}
              <button
                type="button"
                onClick={() => handleSocialLogin("google")}
                disabled={!!socialLoading}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-60"
              >
                {socialLoading === "google" ? (
                  <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : <GoogleIcon />}
                Continue with Google
              </button>

              {/* Microsoft button */}
              <button
                type="button"
                onClick={() => handleSocialLogin("microsoft")}
                disabled={!!socialLoading}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-60"
              >
                {socialLoading === "microsoft" ? (
                  <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : <MicrosoftIcon />}
                Continue with Microsoft
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or sign in with email</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-4" noValidate>

              {/* Unverified email banner */}
              {unverified && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Email not verified</p>
                  <p className="text-xs text-amber-700 leading-relaxed mb-3">
                    Please verify your email before signing in. Check your inbox for the verification link.
                  </p>
                  {resendSuccess ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      ✓ A new verification link has been sent.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading}
                      className="text-xs font-semibold text-[#0a66c2] hover:underline disabled:opacity-60"
                    >
                      {resendLoading ? "Sending…" : "Resend verification email →"}
                    </button>
                  )}
                </div>
              )}

              {/* Generic error */}
              {error && !unverified && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); setUnverified(false); }}
                  placeholder="you@example.com"
                  className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 outline-none transition-all"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Password
                  </label>
                  <Link href="/recruit/forgot-password" className="text-xs text-[#0a66c2] hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); setUnverified(false); }}
                    placeholder="••••••••"
                    className="w-full h-11 rounded-xl border border-slate-200 px-3.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)] hover:shadow-[0_4px_16px_rgba(10,102,194,0.36)] hover:-translate-y-px active:translate-y-0 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </>
                ) : "Sign in"}
              </button>

            </form>

            {/* Footer */}
            <div className="px-8 pb-7 text-center">
              <p className="text-xs text-slate-400">
                Don't have an account?{" "}
                <Link href="/recruit/signup" className="font-semibold text-[#0a66c2] hover:underline">
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
