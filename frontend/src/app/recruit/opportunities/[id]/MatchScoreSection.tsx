"use client";

import { useState } from "react";
import Link from "next/link";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";

type MatchResult = {
  matchScore: number;
  matchReasons: string[];
  missingSkills: string[];
  profileSuggestions: string[];
};

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 55 ? "#f59e0b" : score >= 35 ? "#f97316" : "#ef4444";
  const label = score >= 75 ? "Strong Match" : score >= 55 ? "Good Match" : score >= 35 ? "Moderate Match" : "Weak Match";
  const r = 36, c = 40, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x={c} y={c + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize="16" fontWeight="800" fill={color}>{score}%</text>
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

export default function MatchScoreSection({ jobId }: { jobId: string }) {
  const { sessionToken } = useRecruitAuth();
  const [resumeText, setResumeText] = useState("");
  const [result, setResult]         = useState<MatchResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<unknown>("");
  const [expanded, setExpanded]     = useState(false);

  async function handleCheck() {
    if (!sessionToken) {
      setError("Sign in to check your match score. This uses your Job Seeker AI quota.");
      return;
    }
    if (!resumeText.trim()) { setError("Please paste your resume text first."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(apiUrl(`/recruit-public/jobs/${jobId}/match`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ resumeText }),
      });
      const data = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, data, "Match check failed.");
      setResult(data);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 text-lg">🎯</span>
          <div className="text-left">
            <p className="font-bold text-slate-900">Check Your Match Score</p>
            <p className="text-xs text-slate-500">Paste your resume to see how well you match this job</p>
          </div>
        </div>
        <span className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>

      {expanded && (
        <div className="mt-5 space-y-4">
          {!sessionToken && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold">Sign in required</p>
              <p className="mt-1 text-xs text-slate-500">Match analysis uses your Job Seeker AI quota.</p>
              <Link href="/recruit/login" className="mt-2 inline-block text-xs font-bold text-indigo-700 hover:text-indigo-800">
                Sign in to continue →
              </Link>
            </div>
          )}

          <textarea
            rows={5}
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            placeholder="Paste your resume text here…"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition resize-none"
          />

          {error ? <SeekerErrorNotice error={error} /> : null}

          <button
            onClick={handleCheck}
            disabled={loading || !sessionToken}
            className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Analyzing your match…
              </span>
            ) : "Check Match →"}
          </button>

          {result && (
            <div className="mt-2 space-y-5 animate-[rb-fade-in_0.3s_ease_both]">
              <div className="flex items-center justify-center gap-8 rounded-2xl bg-white p-5 border border-slate-100">
                <ScoreCircle score={result.matchScore} />
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-slate-900 mb-2">Match breakdown</p>
                  {result.matchReasons.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-green-500">✓</span>
                      <span className="text-slate-700">{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {result.missingSkills.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">Skills gap</p>
                  <div className="flex flex-wrap gap-2">
                    {result.missingSkills.map(s => (
                      <span key={s} className="rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">✗ {s}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.profileSuggestions.length > 0 && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2">How to improve your match</p>
                  <ul className="space-y-1.5">
                    {result.profileSuggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-indigo-900">
                        <span className="mt-0.5 shrink-0 text-indigo-400">→</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <Link href={`/recruit/opportunities/${jobId}/apply`}
                  className="flex-1 rounded-2xl bg-indigo-600 py-3 text-center text-sm font-bold text-white transition hover:bg-indigo-700">
                  Apply Now →
                </Link>
                <Link href="/seeker/resume"
                  className="flex-1 rounded-2xl border border-indigo-200 py-3 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50">
                  Improve Resume →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
