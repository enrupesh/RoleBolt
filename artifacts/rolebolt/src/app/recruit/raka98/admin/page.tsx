"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VerificationAdminPanel } from "@/components/VerificationAdminPanel";
import { PlanGrantAdminPanel } from "@/components/PlanGrantAdminPanel";
import { FeedbackAdminPanel } from "@/components/FeedbackAdminPanel";
import { ReviewAdminPanel } from "@/components/ReviewAdminPanel";
import { RAKA98_ADMIN_PASSWORD, RAKA98_ADMIN_SESSION_KEY } from "@/lib/raka98Admin";

type AdminTab = "verification" | "plans" | "feedback" | "reviews";

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (input === RAKA98_ADMIN_PASSWORD) {
      sessionStorage.setItem(RAKA98_ADMIN_SESSION_KEY, "1");
      setError(false);
      onSuccess();
      return;
    }
    setError(true);
    setInput("");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a1a2e] border border-white/10 mb-4">
            <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-white text-xl font-semibold tracking-tight">Rolebolt Admin</h1>
          <p className="text-white/40 text-sm mt-1">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError(false);
            }}
            placeholder="Password"
            autoComplete="current-password"
            autoFocus
            className={`w-full bg-[#111118] border ${
              error ? "border-red-500/60" : "border-white/10"
            } rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-white/30 transition-colors`}
          />
          {error && <p className="text-red-400 text-xs px-1">Incorrect password.</p>}
          <button
            type="submit"
            className="w-full bg-white text-black font-medium text-sm py-3 rounded-lg hover:bg-white/90 transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminShell({ onLock }: { onLock: () => void }) {
  const [tab, setTab] = useState<AdminTab>("verification");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0f]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-white/8 flex items-center justify-center">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-white/80">Rolebolt Admin</span>
          <span className="text-white/20">·</span>
          <span className="text-xs text-white/40">Control Panel</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/recruit/raka98"
            className="text-xs text-white/35 hover:text-white/65 transition-colors"
          >
            AI Infrastructure
          </Link>
          <button
            type="button"
            onClick={onLock}
            className="text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            Lock
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("verification")}
            className={`rounded-full px-4 py-2 text-xs font-semibold border transition ${
              tab === "verification"
                ? "bg-white text-black border-white"
                : "border-white/10 text-white/45 hover:border-white/20"
            }`}
          >
            Verification
          </button>
          <button
            type="button"
            onClick={() => setTab("plans")}
            className={`rounded-full px-4 py-2 text-xs font-semibold border transition ${
              tab === "plans"
                ? "bg-white text-black border-white"
                : "border-white/10 text-white/45 hover:border-white/20"
            }`}
          >
            Plan grants
          </button>
          <button
            type="button"
            onClick={() => setTab("feedback")}
            className={`rounded-full px-4 py-2 text-xs font-semibold border transition ${
              tab === "feedback"
                ? "bg-white text-black border-white"
                : "border-white/10 text-white/45 hover:border-white/20"
            }`}
          >
            Feedback
          </button>
          <button
            type="button"
            onClick={() => setTab("reviews")}
            className={`rounded-full px-4 py-2 text-xs font-semibold border transition ${
              tab === "reviews"
                ? "bg-white text-black border-white"
                : "border-white/10 text-white/45 hover:border-white/20"
            }`}
          >
            Reviews
          </button>
        </div>

        {tab === "verification" ? <VerificationAdminPanel /> : tab === "plans" ? <PlanGrantAdminPanel /> : tab === "feedback" ? <FeedbackAdminPanel /> : <ReviewAdminPanel />}
      </main>
    </div>
  );
}

export default function Raka98AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(RAKA98_ADMIN_SESSION_KEY) === "1");
    setReady(true);
  }, []);

  function lock() {
    sessionStorage.removeItem(RAKA98_ADMIN_SESSION_KEY);
    setAuthed(false);
  }

  if (!ready) {
    return <div className="min-h-screen bg-[#0a0a0f]" />;
  }

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return <AdminShell onLock={lock} />;
}
