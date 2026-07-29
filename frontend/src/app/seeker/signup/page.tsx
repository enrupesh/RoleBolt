"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { apiUrl } from "@/lib/api";

export default function SeekerSignupPage() {
  const router = useRouter();
  const { authUser, recruitProfile, loading, signInWithToken } = useRecruitAuth();

  useEffect(() => {
    if (!loading && authUser && recruitProfile?.role === "seeker") {
      router.replace("/seeker/dashboard");
    }
  }, [loading, authUser, recruitProfile, router]);

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [showPw, setShowPw]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      // 1. Create account
      const res = await fetch(apiUrl("/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Signup failed."); return; }

      const token = data.token;

      // 2. Set role to seeker
      await fetch(apiUrl("/recruit/auth/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: "seeker", name, email }),
      });

      // 3. Create initial seeker profile
      await fetch(apiUrl("/recruit/seeker/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, email }),
      });

      // 4. Sync context
      await signInWithToken(token);
      router.replace("/seeker/profile?onboarding=1");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <RoleboltLogo size="lg" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Find your next job with AI-powered tools</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Full name</label>
              <input
                type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition"
              />
            </div>
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
