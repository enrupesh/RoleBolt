"use client";

import { useEffect, useState } from "react";

const TOUR_KEY = "recruit_job_page_tour_v1";

type Step = {
  id: string;
  title: string;
  body: string;
  /** CSS selector for highlight target; tour still works if missing */
  target?: string;
};

const STEPS: Step[] = [
  {
    id: "agent",
    title: "Triage Agent",
    body: "Toggle the Agent to auto-shortlist, reject, or park mid-score applicants in Review Zone. Open the gear for thresholds and email settings.",
    target: "[data-tour='agent-toggle']",
  },
  {
    id: "pipeline",
    title: "Pipeline",
    body: "Your candidates live here by stage. Use filters, sort, and bulk actions to move people through hiring.",
    target: "[data-tour='pipeline-tab']",
  },
  {
    id: "autopilot",
    title: "Autopilot hub",
    body: "Rules, health alerts, and the agent log live under Autopilot — one place to see what automation is doing.",
    target: "[data-tour='autopilot-tab']",
  },
];

export function markJobTourSeen() {
  try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* ignore */ }
}

export function shouldShowJobTour(): boolean {
  try { return localStorage.getItem(TOUR_KEY) !== "1"; } catch { return false; }
}

export default function JobPageTour({
  onGoAutopilot,
}: {
  onGoAutopilot?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (shouldShowJobTour()) setOpen(true);
  }, []);

  function finish() {
    markJobTourSeen();
    setOpen(false);
  }

  function next() {
    if (step >= STEPS.length - 1) {
      onGoAutopilot?.();
      finish();
      return;
    }
    setStep(s => s + 1);
  }

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-tour-title"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl p-5"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Quick tour · {step + 1}/{STEPS.length}
          </p>
          <button type="button" onClick={finish} className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)]">
            Skip
          </button>
        </div>
        <h2 id="job-tour-title" className="text-base font-semibold text-[var(--foreground)]">{current.title}</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{current.body}</p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i === step ? "bg-indigo-500" : "bg-[var(--border)]"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400 transition"
          >
            {step >= STEPS.length - 1 ? "Open Autopilot" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
