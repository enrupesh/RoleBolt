"use client";

import { useState } from "react";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";

export function JobAlertsSignup() {
  const [email, setEmail]       = useState("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<unknown>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch(apiUrl("/recruit-public/job-alerts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, keywords, location, workMode }),
      });
      const data = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, data, "Failed to subscribe.");
      setSuccess(true);
    } catch (e: unknown) { setError(e); }
    finally { setLoading(false); }
  }

  return (
    <div className="rounded-3xl border border-[#0a66c2]/20 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <button onClick={() => setExpanded(v => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-lg">🔔</span>
          <div className="text-left">
            <p className="font-bold text-slate-900">Get Job Alerts</p>
            <p className="text-xs text-slate-500">AI-ranked alerts delivered to your inbox</p>
          </div>
        </div>
        <span className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>

      {expanded && (
        <div className="mt-5">
          {success ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-semibold text-green-800">You&apos;re subscribed!</p>
              <p className="mt-1 text-sm text-green-700">We&apos;ll send you AI-ranked job matches to <span className="font-semibold">{email}</span></p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Email *</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Keywords</label>
                  <input value={keywords} onChange={e => setKeywords(e.target.value)}
                    placeholder="React, Python, Finance…"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Location</label>
                  <input value={location} onChange={e => setLocation(e.target.value)}
                    placeholder="New York, Remote…"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Work mode</label>
                  <select value={workMode} onChange={e => setWorkMode(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition">
                    <option value="">Any</option>
                    <option>Remote</option><option>Hybrid</option><option>On-site</option>
                  </select>
                </div>
              </div>
              {error ? <SeekerErrorNotice error={error} /> : null}
              <button type="submit" disabled={loading}
                className="w-full rounded-2xl bg-[#0a66c2] py-3 text-sm font-bold text-white transition hover:bg-[#004182] disabled:opacity-60">
                {loading ? "Subscribing…" : "🔔 Subscribe to Job Alerts"}
              </button>
              <p className="text-center text-[11px] text-slate-400">AI ranks each job against your profile before sending. Unsubscribe anytime.</p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
