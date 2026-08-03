"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Metrics = {
  totalSent: number;
  totalCompleted: number;
  completionRate: number;
  avgScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  avgTimeTakenSeconds: number | null;
  passCount: number;
  maybeCount: number;
  failCount: number;
  passRate: number | null;
  failRate: number | null;
  awaitingCount: number;
  takingCount: number;
  totalCandidates: number;
};

type TrendPoint  = { date: string; sent: number; completed: number };
type ScoreBucket = { range: string; count: number };
type ScorePoint  = { date: string; avgScore: number; count: number };
type DecisionBreakdown = { strongYes: number; maybe: number; no: number };

type DrillCandidate = {
  _id: string;
  name: string;
  email: string;
  scorePct: number | null;
  assessmentStatus: string;
  assessmentSentAt: string | null;
  assessmentCompletedAt: string | null;
  hiringDecision: "strong_yes" | "maybe" | "no" | null;
  stage: string;
  timeTakenSeconds: number;
};

type ActivityEvent = {
  type: "sent" | "completed" | "alert";
  candidateName: string;
  candidateId: string;
  timestamp: string;
  scorePct?: number | null;
  hiringDecision?: string | null;
  // alert-specific
  completionRate?: number;
  threshold?: number;
};

type AlertLogEntry = {
  triggeredAt: string;
  completionRate: number;
  threshold: number;
  totalSent: number;
  totalCompleted: number;
};

type AssessmentAlertData = {
  enabled: boolean;
  threshold: number;
  alertActive: boolean;
  bannerDismissed: boolean;
  alertFired: boolean;
  allTimeCompletionRate: number;
  allTimeSent: number;
  allTimeCompleted: number;
  alertLog: AlertLogEntry[];
};

type AnalyticsData = {
  metrics: Metrics;
  charts: {
    completionTrend: TrendPoint[];
    scoreDistribution: ScoreBucket[];
    decisionBreakdown: DecisionBreakdown;
    avgScoreOverTime: ScorePoint[];
  };
  candidates: {
    topScorers: DrillCandidate[];
    lowScorers: DrillCandidate[];
    incomplete: DrillCandidate[];
    taking: DrillCandidate[];
    awaiting: DrillCandidate[];
  };
  activityFeed: ActivityEvent[];
  assessmentAlert: AssessmentAlertData;
};

type DatePreset = "today" | "week" | "month" | "all" | "custom";

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function presetRange(preset: DatePreset): { from: string; to: string } | null {
  if (preset === "all" || preset === "custom") return null;
  const now = new Date();
  const today = startOfDay(now);
  if (preset === "today") return { from: today.toISOString(), to: now.toISOString() };
  if (preset === "week") {
    const w = new Date(today);
    w.setDate(today.getDate() - 6);
    return { from: w.toISOString(), to: now.toISOString() };
  }
  if (preset === "month") {
    const m = new Date(today);
    m.setDate(today.getDate() - 29);
    return { from: m.toISOString(), to: now.toISOString() };
  }
  return null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// ── Mini SVG line chart ────────────────────────────────────────────────────────

function LineChart({
  points,
  color,
  label,
  height = 80,
  secondaryPoints,
  secondaryColor,
}: {
  points: { x: number; y: number; label: string; value: number }[];
  color: string;
  label: string;
  height?: number;
  secondaryPoints?: { x: number; y: number; label: string; value: number }[];
  secondaryColor?: string;
}) {
  const W = 320;
  const H = height;
  const PAD = { top: 8, right: 8, bottom: 24, left: 32 };

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-gray-400" style={{ height: H + 32 }}>
        No data for this period
      </div>
    );
  }

  const allY = [
    ...points.map(p => p.y),
    ...(secondaryPoints ?? []).map(p => p.y),
  ];
  const maxY = Math.max(...allY, 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  function toSVG(p: { x: number; y: number }) {
    const px = PAD.left + (p.x / (points.length - 1 || 1)) * innerW;
    const py = PAD.top + innerH - (p.y / maxY) * innerH;
    return { px, py };
  }

  const mainPolyline = points.map(p => {
    const { px, py } = toSVG(p);
    return `${px},${py}`;
  }).join(" ");

  const secondPolyline = secondaryPoints?.map((p, i) => {
    const { px, py } = { px: PAD.left + (i / (points.length - 1 || 1)) * innerW, py: PAD.top + innerH - (p.y / maxY) * innerH };
    return `${px},${py}`;
  }).join(" ");

  // Y-axis labels (0 and max)
  const yLabels = [0, Math.round(maxY / 2), maxY].filter((v, i, a) => a.indexOf(v) === i);

  // X-axis: show first, middle, last label only
  const xLabels = points.length <= 3
    ? points
    : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {/* Subtle grid lines */}
        {yLabels.map(v => {
          const y = PAD.top + innerH - (v / maxY) * innerH;
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#ffffff12" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#6b7280">{v}</text>
            </g>
          );
        })}

        {/* Area fill */}
        {points.length > 1 && (
          <polygon
            points={`${PAD.left},${PAD.top + innerH} ${mainPolyline} ${PAD.left + innerW},${PAD.top + innerH}`}
            fill={color}
            opacity="0.08"
          />
        )}

        {/* Secondary line */}
        {secondaryPoints && secondaryPoints.length > 1 && (
          <polyline points={secondPolyline} fill="none" stroke={secondaryColor ?? "#f59e0b"} strokeWidth="1.5" strokeDasharray="4,2" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Main line */}
        {points.length > 1 && (
          <polyline points={mainPolyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Dots */}
        {points.map((p, i) => {
          const { px, py } = toSVG(p);
          return (
            <g key={i}>
              <title>{`${p.label}: ${p.value}`}</title>
              <circle cx={px} cy={py} r="3.5" fill={color} stroke="#0a0a0f" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((p) => {
          const { px } = toSVG(p);
          return (
            <text key={p.label} x={px} y={H - 2} textAnchor="middle" fontSize="8" fill="#6b7280">{p.label}</text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Horizontal bar chart ───────────────────────────────────────────────────────

function HBarChart({ data }: { data: { range: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

  if (data.every(d => d.count === 0)) {
    return <p className="text-xs text-gray-500 py-4">No completed assessments yet</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.range} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-bold text-gray-400">{d.range}</span>
          <div className="flex-1 h-5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.count / max) * 100}%`, backgroundColor: colors[i] }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-[11px] font-bold text-gray-300">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Pass/Fail segmented bar ────────────────────────────────────────────────────

function DecisionBar({ breakdown }: { breakdown: DecisionBreakdown }) {
  const total = breakdown.strongYes + breakdown.maybe + breakdown.no;
  if (total === 0) {
    return <p className="text-xs text-gray-500 py-4">No completed assessments with decisions yet</p>;
  }

  const pctYes   = Math.round((breakdown.strongYes / total) * 100);
  const pctMaybe = Math.round((breakdown.maybe     / total) * 100);
  const pctNo    = 100 - pctYes - pctMaybe;

  return (
    <div className="space-y-3">
      <div className="flex h-7 w-full overflow-hidden rounded-full">
        {pctYes > 0 && (
          <div className="h-full bg-emerald-500 flex items-center justify-center" style={{ width: `${pctYes}%` }}>
            {pctYes > 10 && <span className="text-[10px] font-bold text-white">{pctYes}%</span>}
          </div>
        )}
        {pctMaybe > 0 && (
          <div className="h-full bg-amber-500 flex items-center justify-center" style={{ width: `${pctMaybe}%` }}>
            {pctMaybe > 10 && <span className="text-[10px] font-bold text-white">{pctMaybe}%</span>}
          </div>
        )}
        {pctNo > 0 && (
          <div className="h-full bg-rose-500 flex items-center justify-center" style={{ width: `${pctNo}%` }}>
            {pctNo > 10 && <span className="text-[10px] font-bold text-white">{pctNo}%</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Strong Yes ({breakdown.strongYes})</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Maybe ({breakdown.maybe})</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> No ({breakdown.no})</span>
      </div>
    </div>
  );
}

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color,
  onClick,
  badge,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  onClick?: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition ${
        onClick ? "hover:bg-white/[0.06] hover:border-white/[0.12] cursor-pointer group" : "cursor-default"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 leading-none">{label}</p>
      <p className={`text-2xl font-bold leading-none ${color ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[11px] text-gray-500">{sub}</p>}
      {badge && (
        <span className="mt-2 inline-block rounded-full bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 text-[9px] font-bold text-violet-400 uppercase tracking-wide">
          {badge}
        </span>
      )}
      {onClick && (
        <p className="mt-2 text-[10px] text-gray-600 group-hover:text-gray-400 transition">Click to see candidates →</p>
      )}
    </button>
  );
}

// ── Drill-down panel ───────────────────────────────────────────────────────────

type DrillType = "topScorers" | "lowScorers" | "incomplete" | "taking" | "awaiting" | null;

const DRILL_LABELS: Record<NonNullable<DrillType>, string> = {
  topScorers:  "Highest-Scoring Candidates",
  lowScorers:  "Lowest-Scoring Candidates",
  incomplete:  "Incomplete Assessments",
  taking:      "Currently Taking Assessment",
  awaiting:    "Awaiting Assessment",
};

function hiringDecisionBadge(d: string | null) {
  if (d === "strong_yes") return <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Strong Yes</span>;
  if (d === "maybe")      return <span className="rounded-full bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-400">Maybe</span>;
  if (d === "no")         return <span className="rounded-full bg-rose-500/15 border border-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-400">No</span>;
  return null;
}

function DrillPanel({
  drillType,
  candidates,
  onClose,
  jobId,
}: {
  drillType: DrillType;
  candidates: Record<NonNullable<DrillType>, DrillCandidate[]>;
  onClose: () => void;
  jobId: string;
}) {
  if (!drillType) return null;
  const list = candidates[drillType] ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-[2rem] border border-white/[0.08] bg-[#0a0a0f] shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">{DRILL_LABELS[drillType]}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{list.length} candidate{list.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {list.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-500">No candidates in this group</p>
          ) : (
            list.map(c => (
              <a
                key={c._id}
                href={`/recruit/jobs/${jobId}#candidate-${c._id}`}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.05] transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                  {c.email && <p className="text-[11px] text-gray-500 truncate">{c.email}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                    {c.assessmentCompletedAt && (
                      <span className="text-[10px] text-gray-500">Completed {fmtDate(c.assessmentCompletedAt)}</span>
                    )}
                    {c.assessmentSentAt && !c.assessmentCompletedAt && (
                      <span className="text-[10px] text-gray-500">Sent {fmtDate(c.assessmentSentAt)}</span>
                    )}
                    {c.timeTakenSeconds > 0 && (
                      <span className="text-[10px] text-gray-600">· {fmtSeconds(c.timeTakenSeconds)}</span>
                    )}
                    {hiringDecisionBadge(c.hiringDecision)}
                  </div>
                </div>
                {c.scorePct !== null && (
                  <div className={`shrink-0 text-right`}>
                    <p className={`text-lg font-bold leading-none ${c.scorePct >= 75 ? "text-emerald-400" : c.scorePct >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                      {c.scorePct}%
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">score</p>
                  </div>
                )}
              </a>
            ))
          )}
        </div>
        <div className="border-t border-white/[0.07] px-6 py-4 shrink-0">
          <button onClick={onClose} className="w-full rounded-xl bg-zinc-800 py-2 text-sm font-bold text-white hover:bg-zinc-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? events : events.slice(0, 8);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Activity Feed</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-500">No assessment activity yet</p>
        ) : (
          visible.map((e, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              {e.type === "completed" ? (
                <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
              ) : e.type === "alert" ? (
                <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </span>
              ) : (
                <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </span>
              )}
              <div className="flex-1 min-w-0">
                {e.type === "alert" ? (
                  <p className="text-xs text-amber-300">
                    <span className="font-semibold">Completion rate alert triggered</span>
                    {e.completionRate !== undefined && e.threshold !== undefined && (
                      <span className="text-amber-400/80"> — {e.completionRate}% dropped below {e.threshold}% threshold</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-gray-200">
                    <span className="font-semibold">{e.candidateName}</span>
                    {e.type === "sent" ? " was sent an assessment" : " completed the assessment"}
                    {e.type === "completed" && e.scorePct !== null && e.scorePct !== undefined && (
                      <span className={` — ${e.scorePct >= 75 ? "text-emerald-400" : e.scorePct >= 50 ? "text-amber-400" : "text-rose-400"} font-bold`}> {e.scorePct}%</span>
                    )}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 mt-0.5">{fmtDateTime(e.timestamp)}</p>
              </div>
              {e.type === "completed" && e.hiringDecision && hiringDecisionBadge(e.hiringDecision)}
            </div>
          ))
        )}
      </div>
      {events.length > 8 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full border-t border-white/[0.07] py-3 text-[11px] font-semibold text-gray-500 hover:text-gray-300 transition"
        >
          {showAll ? "Show less ↑" : `Show ${events.length - 8} more ↓`}
        </button>
      )}
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

type ExportCandidate = {
  name: string;
  email: string;
  assessmentStatus: string;
  scorePct: number | null;
  passFailStatus: string;
  timeTakenSeconds: number;
  assessmentCompletedAt: string | null;
  stage: string;
  hiringDecision: string | null;
};

async function fetchExportCandidates(
  jobId: string,
  token: string,
  range: { from: string; to: string } | null,
): Promise<{ jobTitle: string; candidates: ExportCandidate[] }> {
  const params = new URLSearchParams();
  if (range) { params.set("from", range.from); params.set("to", range.to); }
  const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/assessment-analytics/export?${params}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch export data");
  return res.json();
}

function buildCSV(candidates: ExportCandidate[]): string {
  const headers = [
    "Candidate Name",
    "Email",
    "Assessment Status",
    "Assessment Score (%)",
    "Pass / Fail Status",
    "Time Taken",
    "Assessment Completion Date",
    "Current Pipeline Stage",
  ];

  function fmtTime(s: number): string {
    if (s <= 0) return "—";
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }

  function escapeCSV(val: string | number | null | undefined): string {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const rows = candidates.map(c => [
    escapeCSV(c.name),
    escapeCSV(c.email),
    escapeCSV(c.assessmentStatus),
    escapeCSV(c.scorePct !== null ? c.scorePct : "—"),
    escapeCSV(c.passFailStatus),
    escapeCSV(fmtTime(c.timeTakenSeconds)),
    escapeCSV(c.assessmentCompletedAt
      ? new Date(c.assessmentCompletedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "—"),
    escapeCSV(c.stage || "—"),
  ].join(","));

  return [headers.join(","), ...rows].join("\r\n");
}

async function exportPDF(
  jobId: string,
  token: string,
  jobTitle: string,
  data: AnalyticsData,
  range: { from: string; to: string } | null,
  presetLabel: string,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const { metrics, charts } = data;
  const { candidates } = await fetchExportCandidates(jobId, token, range);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = margin;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 10, 30);
  doc.rect(0, 0, pageW, 40, "F");

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Assessment Analytics Report", margin, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 160, 220);
  doc.text(`Job: ${jobTitle}`, margin, 27);
  doc.text(`Period: ${presetLabel}   ·   Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 34);

  y = 50;

  // ── Summary Metrics ──────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 20, 80);
  doc.text("Summary Metrics", margin, y);
  y += 5;

  const metricRows: [string, string][] = [
    ["Total Assessments Sent",      String(metrics.totalSent)],
    ["Total Assessments Completed", String(metrics.totalCompleted)],
    ["Completion Rate",             `${metrics.completionRate}%`],
    ["Average Score",               metrics.avgScore !== null ? `${metrics.avgScore}%` : "—"],
    ["Highest Score",               metrics.highestScore !== null ? `${metrics.highestScore}%` : "—"],
    ["Lowest Score",                metrics.lowestScore !== null ? `${metrics.lowestScore}%` : "—"],
    ["Pass Rate (Strong Yes)",      metrics.passRate !== null ? `${metrics.passRate}%` : "—"],
    ["Fail Rate",                   metrics.failRate !== null ? `${metrics.failRate}%` : "—"],
    ["Average Time Taken",          metrics.avgTimeTakenSeconds !== null
      ? (() => { const m = Math.floor(metrics.avgTimeTakenSeconds! / 60); const s = metrics.avgTimeTakenSeconds! % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; })()
      : "—"],
    ["Awaiting Assessment",         String(metrics.awaitingCount)],
    ["Incomplete Assessments",      String(metrics.takingCount)],
    ["Total Candidates",            String(metrics.totalCandidates)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: metricRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [80, 40, 160], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 }, 1: { cellWidth: 60 } },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Score Distribution ───────────────────────────────────────────────────────
  if (y + 50 > pageH - 20) { doc.addPage(); y = margin; }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 20, 80);
  doc.text("Score Distribution", margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["Score Range", "Number of Candidates"]],
    body: charts.scoreDistribution.map(b => [b.range, String(b.count)]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [80, 40, 160], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 245, 255] },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Assessment Completion Trend ──────────────────────────────────────────────
  if (charts.completionTrend.length > 0) {
    if (y + 50 > pageH - 20) { doc.addPage(); y = margin; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 20, 80);
    doc.text("Assessment Completion Trend", margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Sent", "Completed"]],
      body: charts.completionTrend.map(p => [
        new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        String(p.sent),
        String(p.completed),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [80, 40, 160], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 245, 255] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Average Score Over Time ──────────────────────────────────────────────────
  if (charts.avgScoreOverTime.length > 0) {
    if (y + 50 > pageH - 20) { doc.addPage(); y = margin; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 20, 80);
    doc.text("Average Score Over Time", margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Avg Score (%)", "Assessments"]],
      body: charts.avgScoreOverTime.map(p => [
        new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        String(p.avgScore),
        String(p.count),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [80, 40, 160], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 245, 255] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Candidate Details ────────────────────────────────────────────────────────
  if (candidates.length > 0) {
    if (y + 50 > pageH - 20) { doc.addPage(); y = margin; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 20, 80);
    doc.text("Candidate Assessment Details", margin, y);
    y += 5;

    function fmtTime(s: number): string {
      if (s <= 0) return "—";
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
    }

    autoTable(doc, {
      startY: y,
      head: [["Candidate", "Status", "Score", "Pass/Fail", "Time Taken", "Completed", "Stage"]],
      body: candidates.map(c => [
        c.name,
        c.assessmentStatus,
        c.scorePct !== null ? `${c.scorePct}%` : "—",
        c.passFailStatus,
        fmtTime(c.timeTakenSeconds),
        c.assessmentCompletedAt
          ? new Date(c.assessmentCompletedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "—",
        c.stage || "—",
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [80, 40, 160], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 245, 255] },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 26 },
        2: { cellWidth: 16 },
        3: { cellWidth: 18 },
        4: { cellWidth: 20 },
        5: { cellWidth: 24 },
        6: { cellWidth: 28 },
      },
    });
  }

  // ── Footer on each page ──────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 140, 170);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 8, { align: "right" });
    doc.text("Recruit — Assessment Analytics", margin, pageH - 8);
  }

  const safeTitle = jobTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`assessment-analytics-${safeTitle}.pdf`);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AssessmentAnalyticsTab({
  jobId,
  token,
  jobTitle,
}: {
  jobId: string;
  token: string;
  jobTitle: string;
}) {
  const [preset, setPreset]         = useState<DatePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [data, setData]             = useState<AnalyticsData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [drill, setDrill]           = useState<DrillType>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting]   = useState<"pdf" | "csv" | null>(null);
  const exportRef                   = useRef<HTMLDivElement>(null);

  // Alert settings UI state
  const [alertEnabled, setAlertEnabled]   = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(50);
  const [alertSaving, setAlertSaving]     = useState(false);
  const [alertSettingsDirty, setAlertSettingsDirty] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const range = preset === "custom"
        ? (customFrom && customTo ? { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() } : null)
        : presetRange(preset);

      const params = new URLSearchParams();
      if (range) {
        params.set("from", range.from);
        params.set("to",   range.to);
      }

      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/assessment-analytics?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to load analytics");
      }
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [jobId, token, preset, customFrom, customTo]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Sync alert settings from loaded data
  useEffect(() => {
    if (data?.assessmentAlert) {
      setAlertEnabled(data.assessmentAlert.enabled);
      setAlertThreshold(data.assessmentAlert.threshold);
      setAlertSettingsDirty(false);
    }
  }, [data?.assessmentAlert]);

  // Close export dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function getRange(): { from: string; to: string } | null {
    return preset === "custom"
      ? (customFrom && customTo ? { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() } : null)
      : presetRange(preset);
  }

  function getPresetLabel(): string {
    if (preset === "today")  return "Today";
    if (preset === "week")   return "This Week";
    if (preset === "month")  return "This Month";
    if (preset === "all")    return "All Time";
    if (preset === "custom" && customFrom && customTo) {
      return `${new Date(customFrom).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(customTo).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return "Custom";
  }

  async function handleDismissBanner() {
    try {
      await fetch(apiUrl(`/recruit/jobs/${jobId}/assessment-alert/dismiss-banner`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Optimistically update local state
      if (data) {
        setData({ ...data, assessmentAlert: { ...data.assessmentAlert, bannerDismissed: true } });
      }
    } catch {}
  }

  async function handleSaveAlertSettings() {
    setAlertSaving(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/assessment-alert`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: alertEnabled, threshold: alertThreshold }),
      });
      if (res.ok) {
        setAlertSettingsDirty(false);
        // Refresh data to get updated alertActive state
        fetchAnalytics();
      }
    } catch {} finally {
      setAlertSaving(false);
    }
  }

  async function handleExportCSV() {
    if (!data) return;
    setExportOpen(false);
    setExporting("csv");
    try {
      const { candidates: exportCandidates } = await fetchExportCandidates(jobId, token, getRange());
      const csv = buildCSV(exportCandidates);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTitle = jobTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      a.href = url;
      a.download = `assessment-analytics-${safeTitle}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export CSV. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPDF() {
    if (!data) return;
    setExportOpen(false);
    setExporting("pdf");
    try {
      await exportPDF(jobId, token, jobTitle, data, getRange(), getPresetLabel());
    } catch (e) {
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="text-sm text-gray-400">Loading assessment analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-6 text-center">
        <p className="text-sm font-semibold text-rose-400 mb-2">Failed to load analytics</p>
        <p className="text-xs text-rose-400/70 mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="rounded-xl bg-rose-500/15 border border-rose-500/25 px-4 py-2 text-sm font-bold text-rose-400 hover:bg-rose-500/25 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, charts, candidates, activityFeed } = data;

  // Build chart data structures
  const completionPoints = charts.completionTrend.map((p, i) => ({
    x: i,
    y: p.completed,
    label: fmtDate(p.date),
    value: p.completed,
  }));
  const sentPoints = charts.completionTrend.map((p, i) => ({
    x: i,
    y: p.sent,
    label: fmtDate(p.date),
    value: p.sent,
  }));
  const avgScorePoints = charts.avgScoreOverTime.map((p, i) => ({
    x: i,
    y: p.avgScore,
    label: fmtDate(p.date),
    value: p.avgScore,
  }));

  const PRESETS: { id: DatePreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week",  label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "all",   label: "All Time" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Assessment Analytics</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Real-time insights for <span className="font-medium text-[var(--text-secondary)]">{jobTitle}</span>
            {lastRefreshed && (
              <span className="ml-2 text-[var(--text-muted)]">· Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
            </svg>
            Refresh
          </button>

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(o => !o)}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-400 hover:bg-violet-500/20 transition disabled:opacity-50"
            >
              {exporting ? (
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {exporting === "pdf" ? "Generating PDF…" : exporting === "csv" ? "Generating CSV…" : "Export"}
              {!exporting && (
                <svg className="w-3 h-3 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              )}
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl border border-white/[0.1] bg-[#0f0a1e] shadow-2xl overflow-hidden z-30">
                <div className="px-3 pt-3 pb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Export options</p>
                </div>
                <button
                  onClick={handleExportPDF}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-gray-200 hover:bg-white/[0.06] transition"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </span>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white">Export as PDF</p>
                    <p className="text-[10px] text-gray-500">Full report with charts</p>
                  </div>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 mb-1.5 text-xs font-semibold text-gray-200 hover:bg-white/[0.06] transition"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
                    </svg>
                  </span>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white">Export as CSV</p>
                    <p className="text-[10px] text-gray-500">Candidate-level data</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Period</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
                preset === p.id
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-400"
                  : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-violet-400"
            />
            <span className="text-xs text-[var(--text-muted)]">to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-violet-400"
            />
          </div>
        )}
      </div>

      {/* ── Completion Rate Alert Banner ── */}
      {data.assessmentAlert?.alertActive && !data.assessmentAlert?.bannerDismissed && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
          <span className="mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Low Assessment Completion Rate</p>
            <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
              The all-time completion rate is <span className="font-bold text-amber-300">{data.assessmentAlert.allTimeCompletionRate}%</span> — below your configured threshold of <span className="font-bold">{data.assessmentAlert.threshold}%</span>.{" "}
              {data.assessmentAlert.allTimeSent > 0 && (
                <span>{data.assessmentAlert.allTimeCompleted} of {data.assessmentAlert.allTimeSent} assessments completed.</span>
              )}{" "}
              Consider sending reminder emails or reviewing the assessment experience.
            </p>
          </div>
          <button
            onClick={handleDismissBanner}
            className="shrink-0 rounded-lg p-1.5 text-amber-500/60 hover:text-amber-300 hover:bg-amber-500/10 transition"
            title="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}

      {/* ── Completion Rate Alert Settings ── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setAlertEnabled(e => !e); setAlertSettingsDirty(true); }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${alertEnabled ? "bg-amber-500" : "bg-white/10"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${alertEnabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </button>
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Completion Rate Alert</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {alertEnabled ? `Alert when rate drops below ${alertThreshold}%` : "Enable to get notified of low completion rates"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {alertEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Threshold</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={alertThreshold}
                    onChange={e => { setAlertThreshold(Math.min(100, Math.max(1, Number(e.target.value)))); setAlertSettingsDirty(true); }}
                    className="w-16 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-2 py-1.5 text-center text-xs font-bold text-[var(--foreground)] outline-none focus:border-amber-400"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
            )}
            {alertSettingsDirty && (
              <button
                onClick={handleSaveAlertSettings}
                disabled={alertSaving}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/25 transition disabled:opacity-50"
              >
                {alertSaving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Metrics grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard
          label="Assessments Sent"
          value={metrics.totalSent}
          sub={`of ${metrics.totalCandidates} total candidates`}
          color="text-sky-400"
          onClick={() => setDrill("incomplete")}
        />
        <MetricCard
          label="Completed"
          value={metrics.totalCompleted}
          sub={`${metrics.completionRate}% completion rate`}
          color="text-violet-400"
          onClick={() => setDrill("topScorers")}
        />
        <MetricCard
          label="Avg Score"
          value={metrics.avgScore !== null ? `${metrics.avgScore}%` : "—"}
          sub={metrics.highestScore !== null ? `High ${metrics.highestScore}% · Low ${metrics.lowestScore}%` : "No scores yet"}
          color={metrics.avgScore !== null ? (metrics.avgScore >= 75 ? "text-emerald-400" : metrics.avgScore >= 50 ? "text-amber-400" : "text-rose-400") : "text-gray-500"}
        />
        <MetricCard
          label="Avg Time Taken"
          value={metrics.avgTimeTakenSeconds !== null ? fmtSeconds(metrics.avgTimeTakenSeconds) : "—"}
          sub="per assessment"
          color="text-gray-200"
        />
        <MetricCard
          label="Pass Rate"
          value={metrics.passRate !== null ? `${metrics.passRate}%` : "—"}
          sub={`${metrics.passCount} strong yes`}
          color={metrics.passRate !== null && metrics.passRate >= 50 ? "text-emerald-400" : "text-amber-400"}
          badge="Strong Yes"
          onClick={metrics.passCount > 0 ? () => setDrill("topScorers") : undefined}
        />
        <MetricCard
          label="Fail Rate"
          value={metrics.failRate !== null ? `${metrics.failRate}%` : "—"}
          sub={`${metrics.failCount} no decisions`}
          color={metrics.failRate !== null && metrics.failRate >= 50 ? "text-rose-400" : "text-gray-300"}
          onClick={metrics.failCount > 0 ? () => setDrill("lowScorers") : undefined}
        />
        <MetricCard
          label="Awaiting"
          value={metrics.awaitingCount}
          sub="not sent yet"
          color="text-gray-300"
          onClick={metrics.awaitingCount > 0 ? () => setDrill("awaiting") : undefined}
        />
        <MetricCard
          label="Pending"
          value={metrics.takingCount}
          sub="sent, not completed"
          color={metrics.takingCount > 0 ? "text-amber-400" : "text-gray-300"}
          onClick={metrics.takingCount > 0 ? () => setDrill("taking") : undefined}
        />
      </div>

      {/* Highest / Lowest score callouts */}
      {(metrics.highestScore !== null || metrics.lowestScore !== null) && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDrill("topScorers")}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-left hover:bg-emerald-500/[0.09] transition group"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1">Highest Score</p>
            <p className="text-3xl font-bold text-emerald-400">{metrics.highestScore}%</p>
            {candidates.topScorers[0] && (
              <p className="mt-1 text-[11px] text-emerald-500/70 truncate">{candidates.topScorers[0].name}</p>
            )}
            <p className="mt-1 text-[10px] text-emerald-600 group-hover:text-emerald-400 transition">See top scorers →</p>
          </button>
          <button
            onClick={() => setDrill("lowScorers")}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-4 text-left hover:bg-rose-500/[0.09] transition group"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-1">Lowest Score</p>
            <p className="text-3xl font-bold text-rose-400">{metrics.lowestScore}%</p>
            {candidates.lowScorers[0] && (
              <p className="mt-1 text-[11px] text-rose-400/70 truncate">
                {candidates.lowScorers[candidates.lowScorers.length - 1]?.name}
              </p>
            )}
            <p className="mt-1 text-[10px] text-rose-600 group-hover:text-rose-400 transition">See low scorers →</p>
          </button>
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Completion Trend */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Assessment Completion Trend</p>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-violet-500" /> Completed</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-sky-500 opacity-60" /> Sent</span>
            </div>
          </div>
          {completionPoints.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">No data for this period</p>
          ) : (
            <LineChart
              points={completionPoints}
              color="#8b5cf6"
              label=""
              height={90}
              secondaryPoints={sentPoints}
              secondaryColor="#38bdf8"
            />
          )}
        </div>

        {/* Score Distribution */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Score Distribution</p>
          <HBarChart data={charts.scoreDistribution} />
        </div>

        {/* Pass vs Fail Ratio */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Pass vs Fail Ratio</p>
          <DecisionBar breakdown={charts.decisionBreakdown} />
        </div>

        {/* Avg Score Over Time */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Average Score Over Time</p>
          {avgScorePoints.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">No score data for this period</p>
          ) : (
            <LineChart
              points={avgScorePoints}
              color="#10b981"
              label=""
              height={90}
            />
          )}
        </div>
      </div>

      {/* ── Candidate Insights ── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Candidate Insights</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              { key: "topScorers",  label: "Top Scorers",          icon: "▲", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { key: "lowScorers",  label: "Low Scorers",          icon: "▼", color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
              { key: "incomplete",  label: "Incomplete",           icon: "○", color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
              { key: "taking",      label: "Currently Taking",     icon: "◎", color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
              { key: "awaiting",    label: "Awaiting Send",        icon: "◷", color: "text-gray-400",    bg: "bg-white/[0.04] border-white/[0.07]" },
            ] as const
          ).map(item => {
            const count = candidates[item.key].length;
            return (
              <button
                key={item.key}
                onClick={() => setDrill(item.key as DrillType)}
                className={`rounded-2xl border p-3 text-left transition hover:opacity-80 ${item.bg}`}
              >
                <p className={`text-xl font-bold leading-none ${item.color}`}>{count}</p>
                <p className="mt-1.5 text-[10px] font-semibold text-gray-400">{item.label}</p>
                <p className="mt-0.5 text-[9px] text-gray-600">View list →</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Activity Feed ── */}
      <ActivityFeed events={activityFeed} />

      {/* Drill-down modal */}
      {drill && (
        <DrillPanel
          drillType={drill}
          candidates={candidates}
          onClose={() => setDrill(null)}
          jobId={jobId}
        />
      )}
    </div>
  );
}
