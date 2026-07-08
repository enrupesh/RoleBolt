"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ViewedJob = {
  jobId: string;
  title: string;
  companyName?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
};

export default function RecentlyViewedJobs() {
  const [jobs, setJobs] = useState<ViewedJob[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("recruit_recently_viewed_jobs");
      const parsed = raw ? JSON.parse(raw) : [];
      setJobs(Array.isArray(parsed) ? parsed.slice(0, 4) : []);
    } catch {
      setJobs([]);
    }
  }, []);

  if (!jobs.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Recently viewed</h2>
          <p className="text-xs text-slate-500">Continue from jobs you opened earlier.</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem("recruit_recently_viewed_jobs");
            setJobs([]);
          }}
          className="text-xs font-semibold text-slate-400 transition hover:text-slate-700"
        >
          Clear
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {jobs.map(job => (
          <Link
            key={job.jobId}
            href={`/recruit/opportunities/${job.jobId}`}
            className="rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-[#0a66c2]/40 hover:bg-blue-50/40"
          >
            <p className="truncate text-sm font-bold text-slate-900">{job.title}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {job.companyName || "Company"} · {job.location || "India"}
            </p>
            <p className="mt-1 text-[11px] capitalize text-slate-400">
              {job.workMode || "Flexible"} · {job.jobType || "Full-time"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}