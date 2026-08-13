"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";

const REASONS = [
  "Fake or scam job",
  "Misleading job description",
  "Salary is incorrect or misleading",
  "Duplicate listing",
  "Inappropriate content",
  "Other",
];

export default function ReportJobButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) { setError("Please select a reason."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit-public/jobs/${jobId}/report`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      if (!res.ok) throw new Error("Failed to submit report.");
      setSubmitted(true);
    } catch {
      setError("Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700">
        ✓ Report submitted — thank you
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
      >
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 3l18 18M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        Report listing
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 bottom-full mb-2 z-50 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Report this listing</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition text-lg leading-none">×</button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Help us keep the platform safe. Reports are reviewed by our team.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Reason *</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/10 transition bg-white"
                >
                  <option value="">Select a reason…</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Details (optional)</label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Add any details that might help our review…"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/10 transition resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60 transition"
              >
                {submitting ? "Submitting…" : "Submit report"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
