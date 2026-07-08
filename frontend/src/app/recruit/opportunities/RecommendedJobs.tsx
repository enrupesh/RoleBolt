"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";

type Job = {
  _id: string;
  title: string;
  companyName?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  freshersAllowed?: boolean;
  verifiedCompany?: boolean;
  mustHaveSkills?: string;
  createdAt?: string;
  niche?: string;
  seniority?: string;
};

type SeekerPrefs = {
  niche: string;
  workMode: string;
  location: string;
  freshersAllowed: boolean;
  skills: string;
};

function formatSalary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const min = job.salaryMin ? job.salaryMin.toLocaleString("en-IN") : "0";
  const max = job.salaryMax ? `–${job.salaryMax.toLocaleString("en-IN")}` : "+";
  return `${job.salaryCurrency || "₹"} ${min}${max}`;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function loadPrefsFromStorage(): SeekerPrefs | null {
  try {
    const raw = localStorage.getItem("recruit_seeker_prefs");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function RecommendedJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [prefs, setPrefs] = useState<SeekerPrefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedPrefs = loadPrefsFromStorage();
    if (!savedPrefs || (!savedPrefs.niche && !savedPrefs.workMode && !savedPrefs.skills && !savedPrefs.location)) {
      setLoading(false);
      return;
    }
    setPrefs(savedPrefs);
    const params = new URLSearchParams();
    if (savedPrefs.niche) params.set("niche", savedPrefs.niche);
    if (savedPrefs.workMode) params.set("workMode", savedPrefs.workMode);
    if (savedPrefs.location) params.set("location", savedPrefs.location);
    if (savedPrefs.freshersAllowed) params.set("freshersAllowed", "true");
    if (savedPrefs.skills) params.set("skills", savedPrefs.skills);
    fetch(apiUrl(`/recruit-public/recommended-jobs?${params.toString()}`))
      .then(r => readApiJson(r))
      .then(d => setJobs(d.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !prefs || jobs.length === 0) return null;

  const nicheLabel = prefs.niche ? prefs.niche.split(",")[0].trim() : "";

  return (
    <div className="rounded-2xl border border-[#0a66c2]/20 bg-blue-50/30 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#0a66c2] text-white text-sm">✦</span>
          <div>
            <p className="text-xs font-bold text-[#0a66c2] uppercase tracking-wide">Recommended for you</p>
            {nicheLabel && <p className="text-xs text-slate-500">{nicheLabel}{prefs.workMode ? ` · ${prefs.workMode}` : ""}</p>}
          </div>
        </div>
        <Link href="/recruit/profile" className="text-xs font-semibold text-[#0a66c2] hover:underline">
          Update prefs
        </Link>
      </div>
      <div className="space-y-2">
        {jobs.map(job => {
          const salary = formatSalary(job);
          return (
            <Link
              key={job._id}
              href={`/recruit/opportunities/${job._id}`}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-[#0a66c2]/30 hover:shadow-md transition-all"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-xs font-black text-[#0a66c2]">
                {(job.companyName || job.title).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-[#0a66c2] transition leading-snug">{job.title}</p>
                  {job.verifiedCompany && <span className="rounded-full bg-green-50 border border-green-200 px-1.5 py-0.5 text-[9px] font-bold text-green-700">✓</span>}
                  {job.freshersAllowed && <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Freshers</span>}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {job.companyName} · {job.location} · <span className="capitalize">{job.workMode}</span>
                </p>
                {salary && <p className="text-xs font-semibold text-slate-700 mt-0.5">{salary}</p>}
              </div>
              <span className="shrink-0 text-[10px] text-slate-400 mt-0.5">{timeAgo(job.createdAt)}</span>
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Link
          href={`/recruit/opportunities?${prefs.niche ? `niche=${encodeURIComponent(prefs.niche)}&` : ""}${prefs.workMode ? `workMode=${prefs.workMode}` : ""}`}
          className="text-xs font-bold text-[#0a66c2] hover:underline"
        >
          See all matching jobs →
        </Link>
        <button
          onClick={() => { localStorage.removeItem("recruit_seeker_prefs"); setPrefs(null); setJobs([]); }}
          className="text-[11px] text-slate-400 hover:text-slate-600 transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
