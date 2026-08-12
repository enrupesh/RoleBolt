"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { UsernameField } from "@/components/UsernameField";
import { validateUsername } from "@/lib/username";
import { apiUrl } from "@/lib/api";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebaseClient";
import { signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { markSignupWelcome } from "@/lib/signupWelcome";

type Step = "form" | "check-email";
type PhoneStep = "idle" | "entering" | "otp";

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
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699.678 1.852.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.09 6.09l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 1 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default function SeekerSignupPage() {
  const router = useRouter();
  const { authUser, recruitProfile, loading, signInWithToken } = useRecruitAuth();

  useEffect(() => {
    if (!loading && authUser && recruitProfile?.role === "seeker") {
      router.replace(authUser.username?.trim()
        ? "/seeker/dashboard"
        : "/recruit/choose-username?role=seeker&next=%2Fseeker%2Fprofile%3Fonboarding%3D1");
    }
  }, [loading, authUser, recruitProfile, router]);

  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [usernameOk, setUsernameOk] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  async function ensureSeekerProfile(token: string, profile?: { username?: string; email?: string }) {
    const existingRes = await fetch(apiUrl("/recruit/auth/profile"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const existingData = existingRes.ok ? await existingRes.json().catch(() => ({})) : {};
    const patchBody: Record<string, string | undefined> = {
      email: profile?.email,
      username: profile?.username,
    };
    if (existingData.role !== "creator") patchBody.role = "seeker";

    await fetch(apiUrl("/recruit/auth/profile"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patchBody),
    });
    await fetch(apiUrl("/recruit/seeker/profile"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: profile?.username, email: profile?.email }),
    });
  }

  function routeAfterSocialLogin(username?: string) {
    router.replace(username?.trim()
      ? "/seeker/profile?onboarding=1"
      : "/recruit/choose-username?role=seeker&next=%2Fseeker%2Fprofile%3Fonboarding%3D1");
  }

  async function handleGoogleSignup() {
    if (socialLoading) return;
    setError("");
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
        setError(data.error ?? "Google sign-up failed. Please try again.");
        return;
      }
      await ensureSeekerProfile(data.token, {
        username: data.user?.username,
        email: data.user?.email ?? result.user.email ?? "",
      });
      const session = await signInWithToken(data.token);
      if (session.error) throw new Error(session.error);
      if (data.isNewAccount !== false) markSignupWelcome("seeker");
      routeAfterSocialLogin(session.username);
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled or failed. Please try again.");
      }
    } finally {
      setSocialLoading(null);
    }
  }

  function handleGitHubSignup() {
    if (socialLoading) return;
    setSocialLoading("github");
    window.location.href = apiUrl("/auth/github?target=seeker&intent=signup");
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
        setPhoneError(data.error ?? "Phone sign-up failed.");
        return;
      }
      await ensureSeekerProfile(data.token, { username: data.user?.username, email: data.user?.email ?? "" });
      const session = await signInWithToken(data.token);
      if (session.error) throw new Error(session.error);
      if (data.isNewAccount !== false) markSignupWelcome("seeker");
      routeAfterSocialLogin(session.username);
    } catch (err: any) {
      setPhoneError(err?.code === "auth/invalid-verification-code"
        ? "Incorrect OTP. Please try again."
        : (err?.message ?? "Verification failed."));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const usernameError = validateUsername(username);
    if (usernameError) { setError(usernameError); return; }
    if (!usernameOk) { setError("Please choose an available username."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, role: "seeker" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setStep("check-email");
          return;
        }
        setError(data.error ?? "Signup failed.");
        return;
      }
      markSignupWelcome("seeker");
      if (data.verificationRequired === false && data.token) {
        await ensureSeekerProfile(data.token, {
          username: data.user?.username,
          email: data.user?.email ?? email.trim(),
        });
        const session = await signInWithToken(data.token);
        if (session.error) {
          setError(session.error);
          return;
        }
        routeAfterSocialLogin(session.username);
      } else {
        setStep("check-email");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (step === "check-email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)] text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100">
            <svg width="28" height="28" fill="none" stroke="#4f46e5" strokeWidth="2" viewBox="0 0 24 24">
              <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-slate-950 mb-2">Check your inbox</h2>
          <p className="text-sm text-slate-500 mb-1">We sent a verification link to</p>
          <p className="text-sm font-semibold text-slate-800 mb-4 break-all">{email}</p>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Verify your email to activate <strong>@{username}</strong>. The link expires in 24 hours.
          </p>
          <Link
            href="/seeker/login"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div id="recaptcha-container" />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <RoleboltLogo size="lg" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Find your next job with AI-powered tools</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={!!socialLoading || phoneStep !== "idle" || submitting}
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
              onClick={handleGitHubSignup}
              disabled={!!socialLoading || phoneStep !== "idle" || submitting}
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
                disabled={!!socialLoading || submitting}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                <PhoneIcon />
                Continue with phone number
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Phone sign-up</p>
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
                        {phoneLoading ? "Verifying…" : "Verify"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">or sign up with email</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <UsernameField value={username} onChange={setUsername} onValidChange={setUsernameOk} accent="seeker" />

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Email address</label>
              <input
                type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Min 8 characters"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            <button
              type="submit" disabled={submitting}
              className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create free account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/seeker/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Sign in</Link>
          </p>
          <p className="mt-2 text-center text-xs text-slate-400">
            Looking to hire?{" "}
            <Link href="/recruit/signup" className="text-slate-500 hover:text-slate-700 underline">Recruiter sign up →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
