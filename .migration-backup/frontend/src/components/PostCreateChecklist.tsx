"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const CHECKLIST_KEY = "recruit_post_create_checklist";

export type ChecklistEntry = {
  jobId: string;
  jobTitle: string;
  createdAt: string;
  shared?: boolean;
  autopilotEnabled?: boolean;
  reviewedApplicant?: boolean;
  dismissed?: boolean;
};

function loadEntries(): ChecklistEntry[] {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: ChecklistEntry[]) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(entries.slice(0, 8)));
  } catch { /* ignore */ }
}

/** Call after a Standard Job is created successfully. */
export function registerPostCreateChecklist(jobId: string, jobTitle: string) {
  try {
    const entries = loadEntries().filter(e => e.jobId !== jobId && !e.dismissed);
    entries.unshift({
      jobId,
      jobTitle,
      createdAt: new Date().toISOString(),
    });
    saveEntries(entries);
  } catch { /* ignore */ }
}

export function markChecklistStep(jobId: string, step: "shared" | "autopilotEnabled" | "reviewedApplicant") {
  try {
    const entries = loadEntries();
    const next = entries.map(e => (e.jobId === jobId ? { ...e, [step]: true } : e));
    saveEntries(next);
  } catch { /* ignore */ }
}

export default function PostCreateChecklist({
  jobs,
}: {
  jobs: Array<{ _id: string; title: string; agentMode?: { enabled?: boolean }; candidateCount?: number }>;
}) {
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);

  useEffect(() => {
    const stored = loadEntries();
    // Enrich from live job data (agent on, has applicants)
    const enriched = stored
      .filter(e => !e.dismissed)
      .map(e => {
        const job = jobs.find(j => j._id === e.jobId);
        if (!job) return e;
        return {
          ...e,
          jobTitle: job.title || e.jobTitle,
          autopilotEnabled: e.autopilotEnabled || job.agentMode?.enabled === true,
          reviewedApplicant: e.reviewedApplicant || (job.candidateCount ?? 0) > 0,
        };
      });
    setEntries(enriched);
    if (enriched.length !== stored.length || enriched.some((e, i) => JSON.stringify(e) !== JSON.stringify(stored[i]))) {
      saveEntries(enriched);
    }
  }, [jobs]);

  const active = useMemo(() => entries.find(e => {
    const done = (e.shared ? 1 : 0) + (e.autopilotEnabled ? 1 : 0) + (e.reviewedApplicant ? 1 : 0);
    return done < 3;
  }), [entries]);

  if (!active) return null;

  const steps = [
    {
      key: "shared" as const,
      label: "Share job",
      done: !!active.shared,
      href: `/recruit/jobs/${active.jobId}?tab=post`,
      hint: "Copy the public apply link",
    },
    {
      key: "autopilotEnabled" as const,
      label: "Enable Autopilot",
      done: !!active.autopilotEnabled,
      href: `/recruit/jobs/${active.jobId}?tab=autopilot&section=agent`,
      hint: "Turn on Triage Agent",
    },
    {
      key: "reviewedApplicant" as const,
      label: "Review first applicant",
      done: !!active.reviewedApplicant,
      href: `/recruit/jobs/${active.jobId}?tab=pipeline`,
      hint: "Open the pipeline when someone applies",
    },
  ];

  const completed = steps.filter(s => s.done).length;

  function dismiss() {
    const next = loadEntries().map(e =>
      e.jobId === active!.jobId ? { ...e, dismissed: true } : e,
    );
    saveEntries(next);
    setEntries(next.filter(e => !e.dismissed));
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#dcd4ef] bg-gradient-to-br from-[#eee9fc] via-[#f7f4ff] to-white p-4 shadow-[0_5px_16px_rgba(62,44,87,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#654bb2]">Standard Job setup</p>
          <h2 className="mt-0.5 text-sm font-extrabold text-[#322d41]">
            Finish setup for {active.jobTitle}
          </h2>
          <p className="mt-1 text-[12px] text-[#766d83]">
            Share job → Enable Autopilot → Review first applicant · {completed}/3 done
          </p>
        </div>
        <button type="button" onClick={dismiss} className="text-[11px] font-semibold text-[#9a91a5] hover:text-[#4e4658]">
          Dismiss
        </button>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={s.href}
              onClick={() => {
                if (s.key === "shared") markChecklistStep(active.jobId, "shared");
              }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                s.done
                  ? "border-emerald-200 bg-emerald-50/80"
                   : "border-[#e3ddec] bg-white/90 hover:border-[#c6b8ef] hover:bg-[#faf8ff]"
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                 s.done ? "bg-emerald-500 text-white" : "bg-[#f0edf5] text-[#766d83]"
              }`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-[13px] font-semibold ${s.done ? "text-emerald-800" : "text-[#3b3448]"}`}>
                  {s.label}
                </span>
                <span className="block text-[11px] text-[#877e92]">{s.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
