"use client";

import { useState } from "react";
import { apiUrl, readApiJson } from "@/lib/api";

const REPORT_REASONS = [
  "Fake or spam job",
  "Misleading job description",
  "Salary is not as advertised",
  "Charging candidates to apply",
  "Inappropriate or offensive content",
  "Job already filled / expired",
  "Other",
];

export default function ReportJobButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason) { setError("Please select a reason."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit-public/jobs/${jobId}/report`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      if (!res.ok) {
        const d = await readApiJson(res);
        throw new Error(d.error || "Failed to submit report.");
      }
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setReason("");
    setDetails("");
    setError("");
    setSubmitted(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition font-medium"
        title="Report this job"
      >
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        Report this job
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Report this job</h2>
                <button onClick={close} className="text-slate-400 hover:text-slate-700 transition text-xl leading-none font-bold">&times;</button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Help us keep the platform safe and high quality.</p>
            </div>

            {submitted ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-xl">✓</div>
                <h3 className="font-bold text-slate-900">Report submitted</h3>
                <p className="mt-1 text-sm text-slate-500">Thank you for helping keep Plyndrox safe. Our team will review this job.</p>
                <button onClick={close} className="mt-4 rounded-full bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                  Close
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason *</label>
                  <div className="space-y-2">
                    {REPORT_REASONS.map(r => (
                      <label key={r} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition text-sm font-medium ${reason === r ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}>
                        <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-red-500" />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Additional details (optional)</label>
                  <textarea
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    placeholder="Describe the issue briefly…"
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition resize-none"
                  />
                </div>

                {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button onClick={close} className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting || !reason}
                    className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60 transition"
                  >
                    {submitting ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
