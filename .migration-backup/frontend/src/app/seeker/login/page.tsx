"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { LoginMethodSwitch } from "@/components/LoginMethodSwitch";
import { normalizeUsernameInput } from "@/lib/username";
import { apiUrl } from "@/lib/api";
import { isJudgeReviewerEmail } from "@/lib/judgeReviewer";
import { ensureSeekerProfileReady } from "@/lib/ensureSeekerProfileReady";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebaseClient";
import { signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.09 6.09l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

type PhoneStep = "idle" | "entering" | "otp";

function SeekerLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/seeker/dashboard";
  const { authUser, recruitProfile, loading, signInWithToken, signIn } = useRecruitAuth();

  function goAfterLogin() {
    router.replace(redirectTo.startsWith("/") ? redirectTo : "/seeker/dashboard");
  }

  useEffect(() => {
    if (!loading && authUser && recruitProfile) {
      if (
        recruitProfile.role === "creator" &&
        !isJudgeReviewerEmail(authUser.email)
      ) {
        router.replace("/recruit/dashboard");
      } else if (authUser.username?.trim()) {
        goAfterLogin();
      } else {
        router.replace(`/recruit/choose-username?role=seeker&next=${encodeURIComponent(redirectTo.startsWith("/") ? redirectTo : "/seeker/dashboard")}`);
      }
    }
  }, [loading, authUser, recruitProfile, router, redirectTo]);

  const [loginMode, setLoginMode] = useState<"email" | "username">("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const emailRef = useRef(email);
  emailRef.current = email;

  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  async function syncSeekerSession(token: string, profile?: { username?: string; email?: string }) {
    await ensureSeekerProfileReady(token, profile);
    const result = await signInWithToken(token);
    if (result.error) {
      throw new Error(result.error);
    }
  }

  async function handleGoogleLogin() {
    if (socialLoading) return;
    setError("");
    setUnverified(false);
    setResendSuccess(false);
    setSocialLoading("google");

    try {
      const result = await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
      const idToken = await result.user.getIdToken(true);
      const res = await fetch(apiUrl("/auth/social"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, provider: "google", role: "seeker" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Google sign-in failed. Please try again.");
        return;
      }

      await ensureSeekerProfileReady(data.token, {
        username: data.user?.username,
        email: data.user?.email ?? result.user.email ?? "",
      });
      const session = await signInWithToken(data.token);
      if (session.error) throw new Error(session.error);
      if (!session.username?.trim()) {
        router.replace(`/recruit/choose-username?role=seeker&next=${encodeURIComponent(redirectTo.startsWith("/") ? redirectTo : "/seeker/dashboard")}`);
      } else {
        goAfterLogin();
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
    setError("");
    setUnverified(false);
    setResendSuccess(false);
    setSocialLoading("github");
    window.location.href = apiUrl("/auth/github?target=seeker&intent=login");
  }

  async function handleSendOtp() {
    setPhoneError("");
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setPhoneError("Enter your phone number.");
      return;
    }
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
    if (!otp.trim()) {
      setPhoneError("Enter the OTP.");
      return;
    }
    if (!confirmationRef.current) {
      setPhoneError("Session expired. Please start over.");
      setPhoneStep("entering");
      return;
    }

    setPhoneLoading(true);
    try {
      const result = await confirmationRef.current.confirm(otp.trim());
      const idToken = await result.user.getIdToken(true);
      const res = await fetch(apiUrl("/auth/social"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, provider: "phone", role: "seeker" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneError(data.error ?? "Phone sign-in failed.");
        return;
      }

      await ensureSeekerProfileReady(data.token, { username: data.user?.username, email: data.user?.email ?? "" });
      const session = await signInWithToken(data.token);
      if (session.error) throw new Error(session.error);
      if (!session.username?.trim()) {
        router.replace(`/recruit/choose-username?role=seeker&next=${encodeURIComponent(redirectTo.startsWith("/") ? redirectTo : "/seeker/dashboard")}`);
      } else {
        goAfterLogin();
      }
    } catch (err: any) {
      setPhoneError(err?.code === "auth/invalid-verification-code" ? "Incorrect OTP. Please try again." : (err?.message ?? "Verification failed."));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setUnverified(false);
    setResendSuccess(false);
    setSubmitting(true);
    setError("");
    try {
      const result = await signIn(
        loginMode === "email"
          ? { email: email.trim(), password, role: "seeker" }
          : { username: normalizeUsernameInput(username), password, role: "seeker" },
      );
      if (result.error) {
        if (result.code === "EMAIL_NOT_VERIFIED") {
          if (result.email) {
            setEmail(result.email);
            emailRef.current = result.email;
          }
          setUnverified(true);
        } else {
          setError(result.error);
        }
        return;
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("rb_auth_token") : null;
      if (token) {
        const meRes = await fetch(apiUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
        const me = meRes.ok ? await meRes.json() : {};
        await ensureSeekerProfileReady(token, { username: me.username, email: me.email });
      }

      goAfterLogin();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendLoading || resendSuccess) return;
    setResendLoading(true);
    try {
      await fetch(apiUrl("/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRef.current.trim(), role: "seeker" }),
      });
      setResendSuccess(true);
    } catch {
      setResendSuccess(true);
    } finally {
      setResendLoading(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex flex-col">
      <div id="recaptcha-container" />

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <RoleboltLogo size="sm" className="group-hover:scale-105 transition-all" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <p className="text-xs text-slate-400">
            New here?{" "}
            <Link href="/seeker/signup" className="font-semibold text-indigo-600 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
            <div className="border-b border-slate-100 px-8 pt-8 pb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to your job seeker account</p>
            </div>

            <div className="space-y-3 px-8 pt-6 pb-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={!!socialLoading || phoneStep !== "idle"}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                {socialLoading === "google" ? (
                  <svg className="h-4 w-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : <GoogleIcon />}
                Continue with Google
              </button>

              <button
                type="button"
                onClick={handleGitHubLogin}
                disabled={!!socialLoading || phoneStep !== "idle"}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                {socialLoading === "github" ? (
                  <svg className="h-4 w-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : <GitHubIcon />}
                Continue with GitHub
              </button>

              {phoneStep === "idle" ? (
                <button
                  type="button"
                  onClick={() => setPhoneStep("entering")}
                  disabled={!!socialLoading}
                  className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                >
                  <PhoneIcon />
                  Continue with phone number
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Phone sign-in</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneStep("idle");
                        setPhoneError("");
                        setPhoneNumber("");
                        setOtp("");
                        recaptchaVerifierRef.current = null;
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  {phoneError && <p className="text-xs font-medium text-red-600">{phoneError}</p>}

                  {phoneStep === "entering" && (
                    <>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value);
                          setPhoneError("");
                        }}
                        placeholder="+919876543210"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                      />
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={phoneLoading}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {phoneLoading ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : null}
                        {phoneLoading ? "Sending…" : "Send OTP"}
                      </button>
                    </>
                  )}

                  {phoneStep === "otp" && (
                    <>
                      <p className="text-xs text-slate-500">
                        OTP sent to <span className="font-semibold text-slate-700">{phoneNumber}</span>
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value.replace(/\D/g, ""));
                          setPhoneError("");
                        }}
                        placeholder="Enter 6-digit OTP"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm tracking-widest text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneStep("entering");
                            setOtp("");
                            setPhoneError("");
                          }}
                          className="h-10 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100"
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={phoneLoading}
                          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {phoneLoading ? (
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : null}
                          {phoneLoading ? "Verifying…" : "Verify"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">or sign in with email</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-8 pb-6" noValidate>
              {unverified && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-1 text-sm font-semibold text-amber-800">Email not verified</p>
                  <p className="mb-3 text-xs leading-relaxed text-amber-700">
                    Please verify your email before signing in. Check your inbox for the verification link.
                  </p>
                  {resendSuccess ? (
                    <p className="text-xs font-semibold text-emerald-700">A new verification link has been sent.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading}
                      className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-60"
                    >
                      {resendLoading ? "Sending…" : "Resend verification email →"}
                    </button>
                  )}
                </div>
              )}

              {error && !unverified && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <LoginMethodSwitch mode={loginMode} onChange={setLoginMode} accent="seeker" />

              {loginMode === "email" ? (
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                      setUnverified(false);
                    }}
                    placeholder="you@example.com"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Username
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">@</span>
                    <input
                      id="username"
                      type="text"
                      required
                      autoComplete="username"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => {
                        setUsername(normalizeUsernameInput(e.target.value));
                        setError("");
                        setUnverified(false);
                      }}
                      placeholder="alexsharma"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-8 pr-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Password
                  </label>
                  <Link href="/recruit/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                      setUnverified(false);
                    }}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 pr-11 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </>
                ) : "Sign in"}
              </button>
            </form>

            <div className="px-8 pb-7 text-center">
              <p className="text-xs text-slate-400">
                Don&apos;t have an account?{" "}
                <Link href="/seeker/signup" className="font-semibold text-indigo-600 hover:underline">
                  Create one free
                </Link>
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Looking to hire?{" "}
                <Link href="/recruit/login" className="text-slate-500 underline hover:text-slate-700">
                  Recruiter login →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SeekerLoginPage() {
  return (
    <Suspense fallback={null}>
      <SeekerLoginPageContent />
    </Suspense>
  );
}
