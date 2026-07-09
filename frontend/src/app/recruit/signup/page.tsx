"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { apiUrl } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";

function RecruitSignupForm() {
  const router = useRouter();
  const { refreshProfile } = useRecruitAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setupRecruitProfile(displayName?: string) {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    const res = await fetch(apiUrl("/recruit/auth/profile"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: "creator", name: displayName ?? user.displayName ?? "", email: user.email ?? "" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to set up profile");
    }
    await refreshProfile();
    router.replace("/recruit/dashboard");
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      // Send verification email — profile setup happens after verification
      await sendEmailVerification(cred.user);
      router.replace("/recruit/verify-email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError(null);
    setGoogleLoading(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await setupRecruitProfile(cred.user.displayName ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up with Google.");
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
            <RoleboltLogo size="sm" className="group-hover:shadow-[0_3px_12px_rgba(10,102,194,0.36)] group-hover:scale-105 transition-all" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <p className="text-xs text-slate-400">Already have an account? <Link href="/recruit/login" className="font-semibold text-[#0a66c2] hover:underline">Sign in</Link></p>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Create your account</h1>
            <p className="mt-2 text-sm text-slate-500">Start hiring smarter — completely free</p>
          </div>

          {/* Benefits */}
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0a66c2] mb-2">What you get</p>
            <ul className="space-y-1.5">
              {["AI-generated job descriptions", "Resume scoring & candidate ranking", "Async assessments & interview briefs", "Talent pool & analytics dashboard"].map(f => (
                <li key={f} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="p-7">
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-red-500 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                </div>
              )}

              <form onSubmit={handleEmailSignup} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5">Full name</label>
                  <input
                    id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 transition-all placeholder:text-slate-400"
                    placeholder="Your name" autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
                  <input
                    id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 transition-all placeholder:text-slate-400"
                    placeholder="john@example.com" autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                  <input
                    id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 transition-all placeholder:text-slate-400"
                    placeholder="Min. 6 characters" autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="mt-1 h-11 w-full rounded-xl bg-[#0a66c2] text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,102,194,0.28)] hover:bg-[#004182] hover:shadow-[0_4px_16px_rgba(10,102,194,0.36)] hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Creating account…
                    </span>
                  ) : "Create free account"}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <button
                type="button" onClick={handleGoogleSignup} disabled={googleLoading}
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
                Already have an account?{" "}
                <Link href="/recruit/login" className="font-semibold text-[#0a66c2] hover:underline">Sign in</Link>
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

export default function RecruitSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fafc]" />}>
      <RecruitSignupForm />
    </Suspense>
  );
}
