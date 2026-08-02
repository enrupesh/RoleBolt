"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { UsernameField } from "@/components/UsernameField";
import { validateUsername } from "@/lib/username";
import { apiUrl } from "@/lib/api";

type Step = "form" | "check-email";

export default function SeekerSignupPage() {
  const router = useRouter();
  const { authUser, recruitProfile, loading } = useRecruitAuth();

  useEffect(() => {
    if (!loading && authUser && recruitProfile?.role === "seeker") {
      router.replace("/seeker/dashboard");
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
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
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
      setStep("check-email");
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
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <RoleboltLogo size="lg" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Find your next job with AI-powered tools</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
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
