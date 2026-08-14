"use client";

import { useState } from "react";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";

export default function JobAlertSubscribe() {
  const [email, setEmail]       = useState("");
  const [keywords, setKeywords] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<unknown>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true); setError(null); setSuccess(false);
    try {
      const res = await fetch(apiUrl("/recruit-public/job-alerts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), keywords, workMode }),
      });
      const data = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, data, "Subscription failed.");
      setSuccess(true);
      setEmail(""); setKeywords(""); setWorkMode("");
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition";

  return (
    <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 text-lg">🔔</span>
          <div className="text-left">
            <p className="font-bold text-slate-900">Get Job Alerts</p>
            <p className="text-xs text-slate-500">AI-ranked new jobs sent straight to your inbox</p>
          </div>
        </div>
        <span className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>

      {expanded && (
        <form onSubmit={handleSubscribe} className="mt-5 space-y-3">
          {success ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-sm font-bold text-green-800">You&apos;re subscribed!</p>
              <p className="text-xs text-green-600 mt-0.5">We&apos;ll email you when matching jobs are posted.</p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Add another alert
              </button>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Keywords</label>
                  <input
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder="React, Remote, Frontend…"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Work mode preference</label>
                <select
                  value={workMode}
                  onChange={e => setWorkMode(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Any</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>

              {error ? <SeekerErrorNotice error={error} /> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Subscribing…
                  </span>
                ) : "Subscribe to alerts →"}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                Free. No spam. Unsubscribe anytime.
              </p>
            </>
          )}
        </form>
      )}
    </div>
  );
}
