"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { UsernameField } from "@/components/UsernameField";
import { validateUsername } from "@/lib/username";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebaseClient";
import { signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { markSignupWelcome } from "@/lib/signupWelcome";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/recruit/dashboard";
  return raw;
}

function readNextFromUrl(): string {
  if (typeof window === "undefined") return "/recruit/dashboard";
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

type Step = "form" | "check-email";
type PhoneStep = "idle" | "entering" | "otp";

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

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.09 6.09l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

export default function RecruitSignUpPage() {
  const router = useRouter();
  const { authUser, recruitProfile, loading: authLoading, signInWithToken } = useRecruitAuth();
  const [nextPath] = useState(readNextFromUrl);

  useEffect(() => {
    if (!authLoading && authUser && recruitProfile) {
      router.replace(authUser.username?.trim()
        ? nextPath
        : `/recruit/choose-username?next=${encodeURIComponent(nextPath)}`);
    }
  }, [authLoading, authUser, recruitProfile, router, nextPath]);

  const [step, setStep] = useState<Step>("form");
  const [username, setUsername]     = useState("");
  const [usernameOk, setUsernameOk] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  // Phone auth state
  const [phoneStep, setPhoneStep]       = useState<PhoneStep>("idle");
  const [phoneNumber, setPhoneNumber]   = useState("");
  const [otp, setOtp]                   = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError]     = useState("");
  const confirmationRef                 = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef            = useRef<RecaptchaVerifier | null>(null);

  // Password strength
  const hasLength   = password.length >= 8;
  const hasUpper    = /[A-Z]/.test(password);
  const hasNumber   = /[0-9]/.test(password);
  const strength    = [hasLength, hasUpper, hasNumber].filter(Boolean).length;
  const strengthLabel = strength === 0 ? "" : strength === 1 ? "Weak" : strength === 2 ? "Fair" : "Strong";
  const strengthColor = strength === 1 ? "bg-red-400" : strength === 2 ? "bg-amber-400" : "bg-emerald-500";

  async function handleGoogleLogin() {
    if (socialLoading) return;
    setError("");
    setSocialLoading("google");
    try {
      const result = await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
      const idToken = await result.user.getIdToken(true);
      const res = await fetch(apiUrl("/auth/social"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, provider: "google", role: "creator" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Google sign-up failed. Please try again."); return; }
      const session = await signInWithToken(data.token);
      if (session.error) { setError(session.error); return; }
      if (data.isNewAccount !== false) markSignupWelcome("creator");
      if (!session.username?.trim()) {
        router.replace(`/recruit/choose-username?next=${encodeURIComponent(nextPath)}`);
      } else {
        router.replace(nextPath);
      }
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled or failed. Please try again.");
      }
    } finally {
      setSocialLoading(null);
    }
  }

  function handleGitHubLogin() {
    if (socialLoading) return;
    setSocialLoading("github");
    window.location.href = apiUrl("/auth/github?target=recruit&intent=signup");
  }

  async function handleSendOtp() {
    setPhoneError("");
    const trimmed = phoneNumber.trim();
    if (!trimmed) { setPhoneError("Enter your phone number."); return; }
    if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      setPhoneError("Use full international format, e.g. +919876543210");
      return;
    }
    setPhoneLoading(true);
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(getFirebaseAuth(), "recaptcha-container", { size: "invisible" });
      }
      confirmationRef.current = await signInWithPhoneNumber(getFirebaseAuth(), trimmed, recaptchaVerifierRef.current);
      setPhoneStep("otp");
    } catch (err: any) {
      setPhoneError(err?.message ?? "Failed to send OTP. Please try again.");
      recaptchaVerifierRef.current = null;
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setPhoneError("");
    if (!otp.trim()) { setPhoneError("Enter the OTP."); return; }
    if (!confirmationRef.current) { setPhoneError("Session expired. Please start over."); setPhoneStep("entering"); return; }
    setPhoneLoading(true);
    try {
      const result = await confirmationRef.current.confirm(otp.trim());
      const idToken = await result.user.getIdToken(true);
      const res = await fetch(apiUrl("/auth/social"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, provider: "phone", role: "creator" }),
      });
      const data = await res.json();
      if (!res.ok) { setPhoneError(data.error ?? "Phone sign-up failed."); return; }
      const session = await signInWithToken(data.token);
      if (session.error) { setPhoneError(session.error); return; }
      if (data.isNewAccount !== false) markSignupWelcome("creator");
      router.replace(session.username?.trim()
        ? nextPath
        : `/recruit/choose-username?next=${encodeURIComponent(nextPath)}`);
    } catch (err: any) {
      setPhoneError(err?.code === "auth/invalid-verification-code" ? "Incorrect OTP. Please try again." : (err?.message ?? "Verification failed."));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!email.trim()) { setError("Email is required."); return; }
    if (!password)     { setError("Password is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    const usernameError = validateUsername(username);
    if (usernameError) { setError(usernameError); return; }
    if (!usernameOk) { setError("Please choose an available username."); return; }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, username: username.trim(), role: "creator" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setStep("check-email");
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      markSignupWelcome("creator");
      if (data.verificationRequired === false && data.token) {
        const session = await signInWithToken(data.token);
        if (session.error) {
          setError(session.error);
          return;
        }
        router.replace(session.username?.trim()
          ? nextPath
          : `/recruit/choose-username?next=${encodeURIComponent(nextPath)}`);
      } else {
        setStep("check-email");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Check-email confirmation screen ───────────────────────────────────────
  if (step === "check-email") {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0a66c2]/10">
              <svg width="28" height="28" fill="none" stroke="#0a66c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-slate-950 tracking-tight mb-2">Check your inbox</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-1">We sent a verification link to</p>
            <p className="text-sm font-semibold text-slate-800 mb-5 break-all">{email}</p>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Click the link in the email to activate your account. The link expires in 24 hours. Check your spam folder if you don't see it.
            </p>
            <Link
              href="/recruit/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* invisible reCAPTCHA container */}
      <div id="recaptcha-container" />

      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/recruit" className="flex items-center gap-2 group">
            <RoleboltLogo size="sm" className="group-hover:scale-105 transition-all" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <p className="text-xs text-slate-400">
            Already have an account?{" "}
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

            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-slate-100">
              <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Create your account</h1>
              <p className="text-sm text-slate-500 mt-1">Free forever. No credit card needed.</p>
            </div>

            <div className="px-8 pt-6 pb-2 space-y-3">
              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={!!socialLoading || phoneStep !== "idle"}
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

              {/* GitHub */}
              <button
                type="button"
                onClick={handleGitHubLogin}
                disabled={!!socialLoading || phoneStep !== "idle"}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-60"
              >
                {socialLoading === "github" ? (
                  <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : <GitHubIcon />}
                Continue with GitHub
              </button>

              {/* Phone */}
              {phoneStep === "idle" ? (
                <button
                  type="button"
                  onClick={() => setPhoneStep("entering")}
                  disabled={!!socialLoading}
                  className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-60"
                >
                  <PhoneIcon />
                  Continue with phone number
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Phone sign-up</p>
                    <button
                      type="button"
                      onClick={() => { setPhoneStep("idle"); setPhoneError(""); setPhoneNumber(""); setOtp(""); recaptchaVerifierRef.current = null; }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  {phoneError && (
                    <p className="text-xs text-red-600 font-medium">{phoneError}</p>
                  )}

                  {phoneStep === "entering" && (
                    <>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={e => { setPhoneNumber(e.target.value); setPhoneError(""); }}
                        placeholder="+919876543210"
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={phoneLoading}
                        className="w-full h-10 rounded-lg bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                      >
                        {phoneLoading ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : null}
                        {phoneLoading ? "Sending…" : "Send OTP"}
                      </button>
                    </>
                  )}

                  {phoneStep === "otp" && (
                    <>
                      <p className="text-xs text-slate-500">OTP sent to <span className="font-semibold text-slate-700">{phoneNumber}</span></p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setPhoneError(""); }}
                        placeholder="Enter 6-digit OTP"
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 outline-none transition-all tracking-widest"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setPhoneStep("entering"); setOtp(""); setPhoneError(""); }}
                          className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={phoneLoading}
                          className="flex-1 h-10 rounded-lg bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                        >
                          {phoneLoading ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : null}
                          {phoneLoading ? "Verifying…" : "Verify"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or sign up with email</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-4" noValidate>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <UsernameField value={username} onChange={setUsername} onValidChange={setUsernameOk} accent="recruit" />

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
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@example.com"
                  className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 outline-none transition-all"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    placeholder="Min. 8 characters"
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
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map(n => (
                        <div
                          key={n}
                          className={`h-1 flex-1 rounded-full transition-all ${strength >= n ? strengthColor : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                    {strengthLabel && (
                      <span className={`text-[11px] font-semibold ${strength === 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : "text-emerald-600"}`}>
                        {strengthLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit */}
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
                    Creating account…
                  </>
                ) : "Create account"}
              </button>

            </form>

            {/* Footer */}
            <div className="px-8 pb-7 text-center">
              <p className="text-xs text-slate-400">
                Already have an account?{" "}
                <Link href="/recruit/login" className="font-semibold text-[#0a66c2] hover:underline">
                  Sign in
                </Link>
              </p>
              <Link
                href="/seeker"
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 transition-all hover:border-indigo-300 hover:bg-indigo-100"
              >
                Are you a job seeker? <span className="ml-1.5">Go to seeker →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
