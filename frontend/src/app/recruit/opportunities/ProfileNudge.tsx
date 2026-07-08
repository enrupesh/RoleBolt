"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProfileNudge() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const wasDismissed = sessionStorage.getItem("recruit_nudge_dismissed") === "1";
      if (wasDismissed) return;
      const hasResume = Boolean(localStorage.getItem("recruit_resume_text")?.trim());
      const hasSkills = (() => {
        try {
          const raw = localStorage.getItem("recruit_seeker_profile");
          if (!raw) return false;
          const p = JSON.parse(raw);
          return Array.isArray(p.skills) && p.skills.length > 0;
        } catch { return false; }
      })();
      if (!hasResume && !hasSkills) setShow(true);
    } catch { /* ignore */ }
  }, []);

  function dismiss() {
    try { sessionStorage.setItem("recruit_nudge_dismissed", "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  if (!show || dismissed) return null;

  return (
    <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-white text-sm">✨</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">Unlock AI match scores for every job</p>
          <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
            Set up your profile once — add skills, experience level, and preferences — and see exactly how well each job fits you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/recruit/profile"
              className="inline-flex rounded-full bg-[#0a66c2] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#004182] transition"
            >
              Set up profile
            </Link>
            <button
              onClick={dismiss}
              className="inline-flex rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
