"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_PASSWORD = "raka@9800";

export default function AdminPage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a1a2e] border border-white/10 mb-4">
              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-white text-xl font-semibold tracking-tight">Admin Access</h1>
            <p className="text-white/40 text-sm mt-1">Enter password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              placeholder="Password"
              autoFocus
              className={`w-full bg-[#111118] border ${error ? "border-red-500/60" : "border-white/10"} rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-white/30 transition-colors`}
            />
            {error && (
              <p className="text-red-400 text-xs px-1">Incorrect password.</p>
            )}
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-white/80">Admin Panel</span>
        </div>
        <button
          onClick={() => setAuthed(false)}
          className="text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          Lock
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-white/40 text-sm">Admin panel content coming soon.</p>
      </div>
    </div>
  );
}
