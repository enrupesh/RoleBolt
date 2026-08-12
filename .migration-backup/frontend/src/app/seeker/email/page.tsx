"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { STAGE_COLORS } from "@/lib/seekerTypes";

type ParsedIntel = {
  subject: string;
  summary: string;
  companyName: string;
  jobTitle: string;
  suggestedStage?: string;
  interviewDate?: string | null;
  nextAction?: string;
  followUpDate?: string | null;
};

type TrackerEntryRef = { id: string; title: string; companyName: string };

function EmailIntelContent() {
  const { sessionToken } = useRecruitAuth();
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>("");
  const [result, setResult] = useState<ParsedIntel | null>(null);
  const [trackerEntry, setTrackerEntry] = useState<TrackerEntryRef | null>(null);
  const [history, setHistory] = useState<ParsedIntel[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("seeker_email_intel_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  async function parseEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken || !emailText.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setTrackerEntry(null);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/email/parse"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ emailText }),
      });
      const d = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, d, "Parse failed");
      const intel = d.intel as ParsedIntel;
      setResult(intel);
      if (d.entry?.id) {
        setTrackerEntry({ id: d.entry.id, title: d.entry.title, companyName: d.entry.companyName });
      }
      const next = [intel, ...history].slice(0, 10);
      setHistory(next);
      localStorage.setItem("seeker_email_intel_history", JSON.stringify(next));
      setEmailText("");
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Email Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">
            Paste recruiter emails to extract stage updates, interview dates, and recommended next steps.
          </p>
        </div>

        <form onSubmit={parseEmail} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <label className="block text-sm font-bold text-slate-800 mb-2">Paste recruiter email</label>
          <textarea
            value={emailText}
            onChange={e => setEmailText(e.target.value)}
            placeholder="Paste the full email from a recruiter, hiring manager, or ATS notification…"
            className="w-full min-h-[200px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
          <SeekerErrorNotice error={error} className="mt-2" />
          <button
            type="submit"
            disabled={loading || !emailText.trim()}
            className="mt-4 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 hover:bg-indigo-700"
          >
            {loading ? "Analyzing…" : "Parse email"}
          </button>
        </form>

        {result && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-3">Extracted intelligence</p>
            {result.jobTitle && <p className="font-bold text-slate-900">{result.jobTitle} {result.companyName && `@ ${result.companyName}`}</p>}
            <p className="mt-2 text-sm text-slate-700">{result.summary}</p>
            {result.suggestedStage && (
              <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${STAGE_COLORS[result.suggestedStage] ?? "bg-slate-100"}`}>
                Suggested stage: {result.suggestedStage}
              </span>
            )}
            {result.interviewDate && (
              <p className="mt-2 text-sm font-semibold text-amber-800">📅 Interview: {new Date(result.interviewDate).toLocaleString()}</p>
            )}
            {result.nextAction && (
              <p className="mt-2 text-sm text-indigo-800"><strong>Next action:</strong> {result.nextAction}</p>
            )}
            {trackerEntry ? (
              <Link href="/seeker/tracker" className="mt-4 inline-block text-xs font-bold text-indigo-600">
                View &quot;{trackerEntry.title}&quot; in Application Tracker →
              </Link>
            ) : (
              <Link href="/seeker/tracker" className="mt-4 inline-block text-xs font-bold text-indigo-600">
                View Application Tracker →
              </Link>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-4">Recent parses</h2>
            <div className="space-y-3">
              {history.map((h, i) => (
                <div key={i} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{h.subject || h.jobTitle || "Email"}</p>
                  <p className="text-xs text-slate-500 mt-1">{h.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Tip: Forward hiring emails to yourself and paste them here. Full inbox integration coming soon.
        </p>
      </main>
    </div>
  );
}

export default function EmailIntelPage() {
  return (
    <RecruitGuard requiredRole="seeker">
      <EmailIntelContent />
    </RecruitGuard>
  );
}
