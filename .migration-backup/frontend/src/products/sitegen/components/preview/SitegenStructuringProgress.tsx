"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { label: "Analyzing your resume…", afterMs: 0 },
  { label: "Structuring your profile…", afterMs: 8_000 },
  { label: "Preparing your website…", afterMs: 22_000 },
] as const;

const SLOW_MESSAGE_AFTER_MS = 20_000;
/** UI-only cap — does not cancel the NVIDIA request. */
const PROGRESS_CAP_PERCENT = 92;

type SitegenStructuringProgressProps = {
  active: boolean;
  hasResume?: boolean;
};

function resolveStepLabel(elapsedMs: number, hasResume: boolean): string {
  if (elapsedMs < STEPS[1].afterMs && !hasResume) {
    return "Reviewing your information…";
  }
  const step = [...STEPS].reverse().find((item) => elapsedMs >= item.afterMs) ?? STEPS[0];
  return step.label;
}

export function SitegenStructuringProgress({ active, hasResume = false }: SitegenStructuringProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - started), 400);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  const stepLabel = resolveStepLabel(elapsedMs, hasResume);
  const progressPercent = Math.min(PROGRESS_CAP_PERCENT, 10 + (elapsedMs / 150_000) * 82);
  const showSlowMessage = elapsedMs >= SLOW_MESSAGE_AFTER_MS;

  return (
    <div
      className="rounded-[2rem] border border-violet-400/25 bg-violet-500/10 p-8 sm:p-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-violet-300/20 border-t-violet-200" />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-violet-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m18.7 5.6-2.1 2.1" /><path d="m7.7 16.3-2.1 2.1" />
            </svg>
          </div>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">NVIDIA AI processing</p>
        <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">{stepLabel}</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-violet-100/70">
          We&apos;re organizing your information into professional website sections. Please keep this tab open.
        </p>

        <div className="mt-8 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300 transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {showSlowMessage ? (
          <p className="mt-5 text-sm font-medium text-amber-100/90">
            This may take a little longer while we prepare your website.
          </p>
        ) : null}
      </div>
    </div>
  );
}
