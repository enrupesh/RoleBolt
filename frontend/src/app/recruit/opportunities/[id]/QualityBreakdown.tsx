"use client";

import { useState } from "react";
import { computeJobQuality } from "@/lib/jobQuality";

type Job = {
  salaryMin?: number | null;
  salaryMax?: number | null;
  verifiedCompany?: boolean;
  generatedJD?: string;
  mustHaveSkills?: string;
  workMode?: string;
  freshersAllowed?: boolean;
  experienceMin?: number | null;
  experienceMax?: number | null;
  companyName?: string;
  noticePeriod?: string;
};

export default function QualityBreakdown({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const quality = computeJobQuality(job);

  const tierConfig = {
    high: { icon: "★", ringColor: "text-green-600", track: "bg-green-100", fill: "bg-green-500", badge: "bg-green-50 border-green-200 text-green-700" },
    standard: { icon: "◆", ringColor: "text-blue-600", track: "bg-blue-100", fill: "bg-[#0a66c2]", badge: "bg-blue-50 border-blue-100 text-[#0a66c2]" },
    basic: { icon: "·", ringColor: "text-slate-400", track: "bg-slate-100", fill: "bg-slate-400", badge: "bg-slate-50 border-slate-200 text-slate-500" },
  };
  const cfg = tierConfig[quality.tier];
  const pct = quality.score;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#f1f5f9" strokeWidth="5" />
              <circle
                cx="28" cy="28" r="22"
                fill="none"
                stroke={quality.tier === "high" ? "#22c55e" : quality.tier === "standard" ? "#0a66c2" : "#94a3b8"}
                strokeWidth="5"
                strokeDasharray={`${(pct / 100) * 138.2} 138.2`}
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
            </svg>
            <span className={`text-sm font-black ${cfg.ringColor}`}>{pct}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{cfg.icon} {quality.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">Listing quality score</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-[#0a66c2] hover:underline"
        >
          {expanded ? "Hide" : "See breakdown"}
          <svg
            width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Quality signals</p>
          {quality.signals.map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${s.present ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                {s.present ? "✓" : "–"}
              </div>
              <span className={`text-xs font-medium ${s.present ? "text-slate-700" : "text-slate-400"}`}>{s.label}</span>
            </div>
          ))}
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">
              {quality.tier === "high"
                ? "This listing meets all key quality standards — salary, skills, work mode, and company info are all provided."
                : quality.tier === "standard"
                ? "This listing has most key details. Missing signals may be filled by the recruiter over time."
                : "This is a basic listing. Key details like salary or company description may be missing. Apply with caution."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
