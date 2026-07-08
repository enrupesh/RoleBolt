"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { apiUrl } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";

type Role = "seeker" | "creator";

function RecruitSignupForm() {
  const router = useRouter();
  const { refreshProfile } = useRecruitAuth();
  const [role, setRole] = useState<Role>("seeker");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setupRecruitProfile(role: Role, displayName?: string): Promise<Role> {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    const res = await fetch(apiUrl("/recruit/auth/profile"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role,
        name: displayName ?? user.displayName ?? "",
        email: user.email ?? "",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to set up recruit profile");
    }
    const profile = await res.json();
    await refreshProfile();
    return profile.role as Role;
  }

  function redirectByRole(r: Role) {
    if (r === "creator") {
      router.replace("/recruit/dashboard");
    } else {
      router.replace("/recruit/opportunities");
    }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      const assignedRole = await setupRecruitProfile(role, name.trim());
      redirectByRole(assignedRole);
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
      await signInWithPopup(auth, new GoogleAuthProvider());
      const assignedRole = await setupRecruitProfile(role);
      redirectByRole(assignedRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up with Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6f8] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Link href="/recruit" className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-xl bg-[#0a66c2] text-sm font-black text-white">R</span>
            <span>
              <span className="block text-base font-bold leading-tight text-slate-900">Plyndrox Recruit AI</span>
              <span className="block text-[11px] text-slate-500 leading-tight">Plyndrox Jobs Network</span>
            </span>
          </Link>
          <p className="mt-2 text-center text-sm text-slate-500">Create your Plyndrox Recruit AI account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-500">I am a</p>
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setRole("seeker")}
              className={`rounded-lg py-2.5 text-sm font-bold transition ${
                role === "seeker"
                  ? "bg-[#0a66c2] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Job Seeker
            </button>
            <button
              type="button"
              onClick={() => setRole("creator")}
              className={`rounded-lg py-2.5 text-sm font-bold transition ${
                role === "creator"
                  ? "bg-[#0a66c2] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Job Creator
            </button>
          </div>

          <p className="mb-4 text-center text-[11px] text-slate-400">
            {role === "seeker"
              ? "Find jobs, apply, and track your applications"
              : "Post jobs, evaluate candidates, and manage hiring"}
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20 transition"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20 transition"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20 transition"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] transition disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] uppercase tracking-widest text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
            </svg>
            {googleLoading ? "Please wait…" : "Sign up with Google"}
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link href="/recruit/login" className="font-semibold text-[#0a66c2] hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          <Link href="/recruit" className="hover:underline">← Back to Plyndrox Recruit AI</Link>
        </p>
      </div>
    </div>
  );
}

export default function RecruitSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f3f6f8]" />}>
      <RecruitSignupForm />
    </Suspense>
  );
}
