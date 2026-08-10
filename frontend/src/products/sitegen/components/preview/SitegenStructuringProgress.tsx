"use client";

import { useEffect, useMemo, useState } from "react";

const STEPS = [
  { id: "analyze", label: "Analyzing your information", afterMs: 0 },
  { id: "structure", label: "Structuring your profile", afterMs: 6_000 },
  { id: "design", label: "Designing your website", afterMs: 18_000 },
  { id: "preview", label: "Preparing your preview", afterMs: 35_000 },
] as const;

const STATUS_MESSAGES = [
  { afterMs: 0, text: "Reading your saved profile and resume details…" },
  { afterMs: 5_000, text: "Identifying the strongest sections to highlight…" },
  { afterMs: 14_000, text: "Organizing experience, skills, and contact details…" },
  { afterMs: 28_000, text: "Matching your content to a professional theme…" },
  { afterMs: 45_000, text: "Almost there — finalizing your website preview…" },
  { afterMs: 75_000, text: "AI is still working. Large resumes can take a bit longer — please keep this tab open." },
] as const;

const SLOW_MESSAGE_AFTER_MS = 45_000;
const CLIENT_TIMEOUT_MS = 150_000;
/** UI-only cap — does not cancel the NVIDIA request. */
const PROGRESS_CAP_PERCENT = 94;

type SitegenStructuringProgressProps = {
  active: boolean;
  completing?: boolean;
  hasResume?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

function resolveActiveStepIndex(elapsedMs: number): number {
  const step = [...STEPS].reverse().find((item) => elapsedMs >= item.afterMs) ?? STEPS[0];
  return STEPS.findIndex((item) => item.id === step.id);
}

function resolveStatusMessage(elapsedMs: number, hasResume: boolean): string {
  if (elapsedMs < 4_000 && hasResume) {
    return "Parsing your resume and cross-checking profile details…";
  }
  const message = [...STATUS_MESSAGES].reverse().find((item) => elapsedMs >= item.afterMs) ?? STATUS_MESSAGES[0];
  return message.text;
}

function PreviewSkeleton() {
  return (
    <div className="mt-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-white/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-3 w-full animate-pulse rounded bg-white/10" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-white/10" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="h-16 animate-pulse rounded-xl bg-white/10" />
        <div className="h-16 animate-pulse rounded-xl bg-white/10" />
        <div className="h-16 animate-pulse rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

export function SitegenStructuringProgress({
  active,
  completing = false,
  hasResume = false,
  error = null,
  onRetry,
}: SitegenStructuringProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - started), 350);
    return () => window.clearInterval(id);
  }, [active]);

  const activeStepIndex = useMemo(() => resolveActiveStepIndex(elapsedMs), [elapsedMs]);
  const statusMessage = useMemo(() => resolveStatusMessage(elapsedMs, hasResume), [elapsedMs, hasResume]);
  const progressPercent = completing
    ? 100
    : Math.min(PROGRESS_CAP_PERCENT, 8 + (elapsedMs / CLIENT_TIMEOUT_MS) * 86);
  const showSlowMessage = !completing && elapsedMs >= SLOW_MESSAGE_AFTER_MS;
  const timedOut = !completing && !error && elapsedMs >= CLIENT_TIMEOUT_MS;

  if (!active && !error) return null;

  if (error) {
    return (
      <div
        className="rounded-[2rem] border border-red-400/25 bg-red-500/10 p-8 sm:p-10"
        role="alert"
        aria-live="assertive"
      >
        <h2 className="text-xl font-semibold text-white">We couldn&apos;t finish structuring</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-red-100/85">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] hover:bg-violet-50"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="rounded-[2rem] border border-violet-400/25 bg-violet-500/10 p-8 sm:p-10"
      role="status"
      aria-live="polite"
      aria-busy={!completing}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className={`absolute inset-0 rounded-full border-2 border-violet-300/20 border-t-violet-200 ${completing ? "" : "animate-spin"}`} />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-violet-100">
            {completing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m18.7 5.6-2.1 2.1" /><path d="m7.7 16.3-2.1 2.1" />
              </svg>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
          {completing ? "Preview ready" : "AI processing"}
        </p>
        <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
          {completing ? "Opening your preview…" : STEPS[activeStepIndex]?.label}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-violet-100/70">
          {completing ? "Your structured content is ready. Loading the preview now." : statusMessage}
        </p>

        <ol className="mt-8 flex w-full max-w-xl flex-wrap justify-center gap-2 sm:gap-3">
          {STEPS.map((step, index) => {
            const state = completing || index < activeStepIndex
              ? "done"
              : index === activeStepIndex
                ? "active"
                : "pending";
            return (
              <li
                key={step.id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  state === "done"
                    ? "bg-emerald-500/20 text-emerald-100"
                    : state === "active"
                      ? "bg-white/15 text-white"
                      : "bg-white/5 text-violet-100/45"
                }`}
              >
                {step.label.replace("…", "")}
              </li>
            );
          })}
        </ol>

        <div className="mt-8 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300 transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {showSlowMessage ? (
          <p className="mt-5 text-sm font-medium text-amber-100/90">
            This can take up to a couple of minutes for detailed resumes. We&apos;re still processing — no need to refresh.
          </p>
        ) : null}

        {timedOut ? (
          <div className="mt-5 max-w-lg rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            This is taking longer than usual. AI may still be working — you can wait a bit longer or try again.
            {onRetry ? (
              <button type="button" onClick={onRetry} className="mt-3 block w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1a1033]">
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        <PreviewSkeleton />
      </div>
    </div>
  );
}
