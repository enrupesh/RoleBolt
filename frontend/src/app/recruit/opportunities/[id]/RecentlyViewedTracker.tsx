"use client";

import { useEffect } from "react";

type ViewedJob = {
  jobId: string;
  title: string;
  companyName?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  niche?: string;
};

export default function RecentlyViewedTracker({ job }: { job: ViewedJob }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem("recruit_recently_viewed_jobs");
      const existing = raw ? JSON.parse(raw) : [];
      const next = [
        { ...job, viewedAt: new Date().toISOString() },
        ...existing.filter((item: ViewedJob) => item.jobId !== job.jobId),
      ].slice(0, 12);
      localStorage.setItem("recruit_recently_viewed_jobs", JSON.stringify(next));
    } catch { /* ignore */ }
  }, [job]);

  return null;
}