"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function StickyActions({
  jobId,
  jobTitle,
  companyName,
}: {
  jobId: string;
  jobTitle: string;
  companyName?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in after a short delay so it doesn't flash on load
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-50 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {/* Glass bar */}
      <div className="border-t border-slate-200 bg-white/90 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* Job context — hidden on very small screens */}
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-bold text-slate-900">{jobTitle}</p>
            {companyName && (
              <p className="truncate text-xs text-slate-500">{companyName}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Link
              href={`/recruit/recruiter/${jobId}`}
              className="flex-1 rounded-full border-2 border-[#0a66c2] px-4 py-2.5 text-center text-sm font-bold text-[#0a66c2] transition hover:bg-blue-50 sm:flex-none sm:px-6"
            >
              View Recruiter Profile
            </Link>
            <Link
              href={`/recruit/opportunities/${jobId}/apply`}
              className="flex-1 rounded-full bg-[#0a66c2] px-4 py-2.5 text-center text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-[#004182] active:scale-95 sm:flex-none sm:px-8"
            >
              Apply Now →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
