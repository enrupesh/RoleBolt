"use client";

import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/trackEvent";

type Props = {
  jobId: string; title: string; companyName?: string; location?: string;
  workMode?: string; jobType?: string; niche?: string;
};

function BookmarkFilledIcon() {
  return <svg width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>;
}

function BookmarkIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>;
}

export default function ClientSaveButton({ jobId, title, companyName, location, workMode, jobType, niche }: Props) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("recruit_saved_jobs");
      if (raw) {
        const jobs = JSON.parse(raw);
        setSaved(jobs.some((j: any) => j.jobId === jobId));
      }
    } catch { /* ignore */ }
  }, [jobId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = localStorage.getItem("recruit_saved_jobs");
      let jobs = raw ? JSON.parse(raw) : [];
      if (saved) {
        jobs = jobs.filter((j: any) => j.jobId !== jobId);
        setSaved(false);
        trackEvent("job_unsaved", { jobId, niche });
      } else {
        jobs = [{ jobId, title, companyName, location, workMode, jobType, niche, savedAt: new Date().toISOString() }, ...jobs];
        setSaved(true);
        trackEvent("job_saved", { jobId, niche });
      }
      localStorage.setItem("recruit_saved_jobs", JSON.stringify(jobs));
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={toggle}
      title={saved ? "Remove from saved" : "Save job"}
      className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${saved ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]" : "border-slate-200 text-slate-400 hover:border-[#0a66c2] hover:text-[#0a66c2] bg-white"}`}
    >
      {saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}
    </button>
  );
}
