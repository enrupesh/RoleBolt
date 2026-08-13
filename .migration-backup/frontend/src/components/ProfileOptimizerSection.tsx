"use client";

import { useState } from "react";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";

type Improvement = {
  priority: "high" | "medium" | "low";
  action: string;
  impact: string;
  howTo: string;
};

type OptimizeResult = {
  profileScore: number;
  grade: string;
  improvements: Improvement[];
  inDemandSkills: string[];
  missingFromProfile: string[];
  salaryInsight: string;
};

const PRIORITY_META = {
  high:   { color: "border-rose-400/40 bg-rose-50 text-rose-700",    badge: "bg-rose-100 text-rose-700",    label: "High Priority" },
  medium: { color: "border-amber-400/40 bg-amber-50 text-amber-700", badge: "bg-amber-100 text-amber-700",  label: "Medium" },
  low:    { color: "border-slate-200 bg-slate-50 text-slate-600",    badge: "bg-slate-100 text-slate-600",  label: "Low" },
};

export function ProfileOptimizerSection({
  token,
  resumeText,
  skills,
  targetRole,
}: {
  token: string;
  resumeText: string;
  skills: string[];
  targetRole?: string;
}) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<OptimizeResult | null>(null);
  const [error, setError]       = useState<unknown>("");
  const [expanded, setExpanded] = useState(false);

  async function handleAnalyze() {
    if (!resumeText.trim()) { setError("Please add your resume text to the profile first."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(apiUrl("/recruit/seeker/profile/optimize"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText, currentSkills: skills, targetRole: targetRole || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, data, "Analysis failed.");
      setResult(data);
      setExpanded(true);
    } catch (e: unknown) { setError(e); }
    finally { setLoading(false); }
  }

  return (
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-xl">🔍</span>
          <div>
            <h2 className="font-bold text-slate-900">AI Profile Audit</h2>
            <p className="text-xs text-slate-500">AI analyzes your profile against thousands of job listings</p>
          </div>
        </div>
        <button
          onClick={result ? () => setExpanded(v => !v) : handleAnalyze}
          disabled={loading}
          className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Analyzing…
            </span>
          ) : result ? (expanded ? "Hide Results" : "Show Results") : "Analyze My Profile"}
        </button>
      </div>

      <SeekerErrorNotice error={error} className="mt-3" />

      {result && expanded && (
        <div className="mt-6 space-y-5 animate-[rb-fade-in_0.3s_ease_both]">
          {/* Score */}
          <div className="flex items-center gap-6 rounded-2xl bg-white border border-slate-100 p-5">
            <div className="text-center">
              <p className="text-5xl font-black text-indigo-600">{result.grade}</p>
              <p className="text-xs text-slate-400 mt-1">{result.profileScore}/100</p>
            </div>
            <div className="flex-1">
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${result.profileScore}%` }} />
              </div>
              {result.salaryInsight && (
                <p className="mt-2 text-xs text-slate-600 font-medium">💰 {result.salaryInsight}</p>
              )}
            </div>
          </div>

          {/* Improvements */}
          {result.improvements.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Recommended Actions</p>
              {result.improvements.map((imp, i) => {
                const meta = PRIORITY_META[imp.priority] ?? PRIORITY_META.low;
                return (
                  <div key={i} className={`rounded-2xl border p-4 ${meta.color}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>{meta.label}</span>
                          <span className="text-xs font-bold text-green-700">{imp.impact}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{imp.action}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{imp.howTo}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* In-demand skills */}
          {result.inDemandSkills.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-100 p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">🔥 In-demand skills to add</p>
              <div className="flex flex-wrap gap-2">
                {result.inDemandSkills.map(s => (
                  <span key={s} className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${result.missingFromProfile.includes(s) ? "bg-rose-100 text-rose-700" : "bg-green-100 text-green-700"}`}>
                    {result.missingFromProfile.includes(s) ? "✗ " : "✓ "}{s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
