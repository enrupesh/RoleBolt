"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiUrl } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InProgressCandidate {
  _id: string;
  name: string;
  email: string;
  stage: string;
  assessmentSentAt: string | null;
  assessmentStartedAt: string | null;
  currentQuestionIndex: number | null;
  totalQuestions: number;
  elapsedSeconds: number | null;
  progressPct: number | null;
  started: boolean;
}

interface CompletedCandidate {
  _id: string;
  name: string;
  email: string;
  stage: string;
  assessmentSentAt: string | null;
  assessmentStartedAt: string | null;
  assessmentCompletedAt: string | null;
  scorePct: number | null;
  hiringDecision: "strong_yes" | "maybe" | "no" | null;
  durationSeconds: number | null;
}

interface LiveData {
  jobTitle: string;
  inProgress: InProgressCandidate[];
  completedToday: CompletedCandidate[];
  summary: {
    inProgressCount: number;
    completedTodayCount: number;
    awaitingCount: number;
    avgCurrentProgress: number | null;
    avgCompletionSeconds: number | null;
  };
  lastUpdated: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtElapsed(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function decisionBadge(d: "strong_yes" | "maybe" | "no" | null) {
  if (!d) return null;
  const map = {
    strong_yes: { label: "Strong Yes", cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
    maybe: { label: "Maybe", cls: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
    no: { label: "No", cls: "bg-red-500/20 text-red-400 border border-red-500/30" },
  };
  const { label, cls } = map[d];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}

// Live elapsed counter ticking every second client-side
function ElapsedTicker({ startedAt, baseSeconds }: { startedAt: string | null; baseSeconds: number | null }) {
  const [elapsed, setElapsed] = useState(baseSeconds);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span>{fmtElapsed(elapsed)}</span>;
}

// ─── Candidate detail modal ───────────────────────────────────────────────────
function CandidateModal({
  candidate,
  onClose,
}: {
  candidate: InProgressCandidate | CompletedCandidate;
  onClose: () => void;
}) {
  const isInProgress = "currentQuestionIndex" in candidate;
  const ip = isInProgress ? (candidate as InProgressCandidate) : null;
  const done = !isInProgress ? (candidate as CompletedCandidate) : null;

  // Close on outside click
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (backdropRef.current && e.target === backdropRef.current) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
            {isInProgress ? "In Progress" : "Completed"}
          </p>
          <h2 className="text-lg font-bold text-[var(--foreground)]">{candidate.name}</h2>
          <p className="text-sm text-[var(--text-muted)]">{candidate.email}</p>
        </div>

        <div className="space-y-3">
          <Row label="Sent at" value={fmtTime(candidate.assessmentSentAt)} />
          <Row label="Started at" value={fmtTime(candidate.assessmentStartedAt)} />

          {ip && (
            <>
              {ip.started ? (
                <>
                  <Row label="Current question" value={
                    ip.currentQuestionIndex !== null
                      ? `Question ${ip.currentQuestionIndex + 1} of ${ip.totalQuestions}`
                      : "—"
                  } />
                  <Row label="Progress" value={ip.progressPct !== null ? `${ip.progressPct}%` : "—"} />
                  <Row label="Time elapsed" value={
                    <ElapsedTicker startedAt={ip.assessmentStartedAt} baseSeconds={ip.elapsedSeconds} />
                  } />
                  {ip.progressPct !== null && (
                    <div className="mt-2">
                      <div className="h-2 w-full rounded-full bg-[var(--surface-muted)]">
                        <div
                          className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${ip.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
                  Candidate hasn't started the assessment yet.
                </div>
              )}
              <div className="mt-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 text-xs text-indigo-400">
                🔒 Answers are hidden until the candidate submits to preserve assessment integrity.
              </div>
            </>
          )}

          {done && (
            <>
              <Row label="Completed at" value={fmtTime(done.assessmentCompletedAt)} />
              <Row label="Score" value={done.scorePct !== null ? `${done.scorePct}%` : "—"} />
              <Row label="Duration" value={fmtElapsed(done.durationSeconds)} />
              <Row label="AI Decision" value={decisionBadge(done.hiringDecision) ?? "—"} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)]">{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const POLL_INTERVAL = 15; // seconds

export default function LiveAssessmentProgressTab({
  jobId,
  token,
}: {
  jobId: string;
  token: string;
}) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const [selected, setSelected] = useState<InProgressCandidate | CompletedCandidate | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/live-assessment-progress`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setData(json);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load live data");
    } finally {
      setLoading(false);
    }
  }, [jobId, token]);

  // Initial fetch + polling every 15 s
  useEffect(() => {
    fetchData();

    const pollId = setInterval(() => {
      fetchData();
      setCountdown(POLL_INTERVAL);
    }, POLL_INTERVAL * 1000);

    return () => clearInterval(pollId);
  }, [fetchData]);

  // Countdown ticker
  useEffect(() => {
    setCountdown(POLL_INTERVAL);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? POLL_INTERVAL : c - 1));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-400">
        {error}
      </div>
    );
  }

  const { inProgress, completedToday, summary } = data!;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">Live Assessment Progress</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Last updated {new Date(data!.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">Refreshing in {countdown}s</span>
          <button
            onClick={() => { fetchData(); setCountdown(POLL_INTERVAL); }}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="In Progress"
          value={summary.inProgressCount}
          accent="indigo"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard
          label="Completed Today"
          value={summary.completedTodayCount}
          accent="emerald"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>}
        />
        <StatCard
          label="Awaiting Assessment"
          value={summary.awaitingCount}
          accent="zinc"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>}
        />
        <StatCard
          label="Avg Progress"
          value={summary.avgCurrentProgress !== null ? `${summary.avgCurrentProgress}%` : "—"}
          accent="violet"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>}
        />
      </div>

      {/* ── Live candidates ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-bold text-[var(--foreground)]">Currently Taking Assessment</h3>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{inProgress.length} candidate{inProgress.length !== 1 ? "s" : ""}</span>
        </div>

        {inProgress.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
            <svg className="mb-3 text-[var(--text-muted)]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p className="text-sm text-[var(--text-secondary)]">No assessments in progress</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Candidates who open their assessment link will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {inProgress.map(c => (
              <InProgressCard key={c._id} candidate={c} onClick={() => setSelected(c)} />
            ))}
          </div>
        )}
      </section>

      {/* ── Completed today ── */}
      {completedToday.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <svg className="text-emerald-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <h3 className="text-sm font-bold text-[var(--foreground)]">Completed Today</h3>
            <span className="ml-auto text-xs text-[var(--text-muted)]">{completedToday.length} candidate{completedToday.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {completedToday.map(c => (
              <CompletedCard key={c._id} candidate={c} onClick={() => setSelected(c)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Activity feed ── */}
      <section>
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">Activity Feed</h3>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] divide-y divide-[var(--border)]">
          {[
            ...inProgress.filter(c => c.started).map(c => ({
              id: `ip-${c._id}`,
              time: c.assessmentStartedAt,
              label: `${c.name} started the assessment`,
              icon: "start" as const,
            })),
            ...completedToday.map(c => ({
              id: `done-${c._id}`,
              time: c.assessmentCompletedAt,
              label: `${c.name} submitted the assessment`,
              icon: "done" as const,
            })),
          ]
            .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""))
            .slice(0, 20)
            .map(ev => (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-0.5 rounded-full p-1.5 ${ev.icon === "done" ? "bg-emerald-500/15 text-emerald-400" : "bg-indigo-500/15 text-indigo-400"}`}>
                  {ev.icon === "done"
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--foreground)]">{ev.label}</p>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0">{fmtTime(ev.time)}</span>
              </div>
            ))}

          {inProgress.filter(c => c.started).length === 0 && completedToday.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">No events yet today</div>
          )}
        </div>
      </section>

      {/* ── Candidate detail modal ── */}
      {selected && (
        <CandidateModal candidate={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, accent, icon,
}: {
  label: string;
  value: number | string;
  accent: "indigo" | "emerald" | "zinc" | "violet";
  icon: React.ReactNode;
}) {
  const colors = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    zinc: "text-zinc-400 bg-zinc-500/10",
    violet: "text-violet-400 bg-violet-500/10",
  };
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 flex items-start gap-3">
      <div className={`rounded-lg p-2 ${colors[accent]}`}>{icon}</div>
      <div>
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

function InProgressCard({
  candidate: c,
  onClick,
}: {
  candidate: InProgressCandidate;
  onClick: () => void;
}) {
  const hasStarted = c.started && c.currentQuestionIndex !== null;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3.5 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-400">
              {c.name.charAt(0).toUpperCase()}
            </div>
            {hasStarted && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[var(--surface-muted)]" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-indigo-400 transition">{c.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{c.email}</p>
          </div>
        </div>
        <svg className="text-[var(--text-muted)] group-hover:text-indigo-400 transition mt-1 flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </div>

      {hasStarted ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">
              Question {(c.currentQuestionIndex ?? 0) + 1} of {c.totalQuestions}
            </span>
            <span className="font-semibold text-indigo-400">{c.progressPct}% complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--surface)]">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all duration-700"
              style={{ width: `${c.progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>Started {fmtTime(c.assessmentStartedAt)}</span>
            <span>Elapsed: <ElapsedTicker startedAt={c.assessmentStartedAt} baseSeconds={c.elapsedSeconds} /></span>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Link opened — not yet started
          </span>
        </div>
      )}
    </button>
  );
}

function CompletedCard({
  candidate: c,
  onClick,
}: {
  candidate: CompletedCandidate;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3.5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-emerald-400 transition">{c.name}</p>
            <p className="text-xs text-[var(--text-muted)]">Completed {fmtTime(c.assessmentCompletedAt)} · {fmtElapsed(c.durationSeconds)} taken</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {c.scorePct !== null && (
            <span className="text-sm font-bold text-emerald-400">{c.scorePct}%</span>
          )}
          {decisionBadge(c.hiringDecision)}
          <svg className="text-[var(--text-muted)] group-hover:text-emerald-400 transition" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </button>
  );
}
