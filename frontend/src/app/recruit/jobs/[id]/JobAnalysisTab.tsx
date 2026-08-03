"use client";

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type OverviewData = {
  totalCandidates: number;
  activeDays: number;
  jobStatus: "active" | "paused" | "closed";
  openings: number;
  applicationDeadline: string | null;
  avgScore: number | null;
  topScore: number | null;
  hiredCount: number;
  offerSentCount: number;
  offerAcceptedCount: number;
  rejectedCount: number;
  timeToHireDays: number | null;
  weeklyApplicationRate: number;
  totalActive: number;
};

type PipelineStage = {
  stage: string;
  label: string;
  count: number;
  pct: number;
  conversionRate: number | null;
  avgDaysInStage: number | null;
};

type PipelineData = {
  stages: PipelineStage[];
  bottleneck: string | null;
  totalActive: number;
  rejected: number;
};

type QualityData = {
  scoreDistribution: Array<{ range: string; count: number; pct: number }>;
  avgScore: number | null;
  topScore: number | null;
  scoringFailedCount: number;
  candidatesByTier: { excellent: number; good: number; average: number; low: number };
  totalScored: number;
};

type TimelineData = {
  daily: Array<{ date: string; count: number; cumulative: number }>;
  weeklyAvg: number;
  peakDay: string | null;
  peakCount: number;
};

type SourceEntry = {
  source: string;
  count: number;
  pct: number;
  hireCount: number;
  hireRate: number | null;
};

type AssessmentData = {
  sent: number;
  completed: number;
  completionRate: number;
  avgScore: number | null;
  passRate: number | null;
  passCount: number;
  maybeCount: number;
  failCount: number;
};

type OffersData = {
  sent: number;
  accepted: number;
  declined: number;
  pending: number;
  acceptanceRate: number | null;
};

type AiInsight = {
  type: "success" | "warning" | "danger" | "info";
  title: string;
  detail: string;
  action?: string | null;
};

type AiData = {
  healthScore: number;
  healthLabel: string;
  insights: AiInsight[];
};

type AnalysisPayload = {
  overview: OverviewData;
  pipeline: PipelineData;
  quality: QualityData;
  timeline: TimelineData;
  sources: SourceEntry[];
  assessment: AssessmentData;
  offers: OffersData;
  ai: AiData;
};

// ── Colour helpers ────────────────────────────────────────────────────────────

function scoreColor(pct: number | null, as: "text" | "bg" | "border" = "text"): string {
  if (pct === null) return as === "text" ? "text-[var(--text-muted)]" : as === "bg" ? "bg-gray-200" : "border-gray-200";
  if (pct >= 80) return as === "text" ? "text-emerald-600" : as === "bg" ? "bg-emerald-500" : "border-emerald-400/40";
  if (pct >= 60) return as === "text" ? "text-indigo-600" : as === "bg" ? "bg-indigo-500" : "border-indigo-400/40";
  if (pct >= 40) return as === "text" ? "text-amber-600" : as === "bg" ? "bg-amber-500" : "border-amber-400/40";
  return as === "text" ? "text-rose-600" : as === "bg" ? "bg-rose-500" : "border-rose-400/40";
}

function insightMeta(type: AiInsight["type"]) {
  switch (type) {
    case "success": return { icon: "✅", border: "border-emerald-400/30", bg: "bg-emerald-500/5", badge: "bg-emerald-500/10 text-emerald-700", label: "Strength" };
    case "warning": return { icon: "⚠️", border: "border-amber-400/30",   bg: "bg-amber-500/5",   badge: "bg-amber-500/10 text-amber-700",   label: "Attention" };
    case "danger":  return { icon: "🚨", border: "border-rose-400/30",    bg: "bg-rose-500/5",    badge: "bg-rose-500/10 text-rose-700",     label: "Risk" };
    default:        return { icon: "💡", border: "border-indigo-400/20",  bg: "bg-indigo-500/5",  badge: "bg-indigo-500/10 text-indigo-700", label: "Insight" };
  }
}

function healthColor(score: number) {
  if (score >= 80) return { text: "text-emerald-600", ring: "stroke-emerald-500", label: "text-emerald-700" };
  if (score >= 65) return { text: "text-indigo-600",  ring: "stroke-indigo-500",  label: "text-indigo-700" };
  if (score >= 45) return { text: "text-amber-600",   ring: "stroke-amber-500",   label: "text-amber-700" };
  return             { text: "text-rose-600",    ring: "stroke-rose-500",    label: "text-rose-700" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, highlight,
}: { label: string; value: React.ReactNode; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-indigo-400/30 bg-indigo-500/5" : "border-[var(--border)] bg-[var(--surface-muted)]"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-indigo-600" : "text-[var(--foreground)]"}`}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeading({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="mt-0.5 text-indigo-400 shrink-0">{icon}</span>
      <div>
        <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
        {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Health Score Gauge ────────────────────────────────────────────────────────
function HealthGauge({ score, label }: { score: number; label: string }) {
  const c = healthColor(score);
  const r = 52;
  const circumference = 2 * Math.PI * r;
  // Draw a 270° arc (semi-circle-ish gauge)
  const arcFraction = 0.75;
  const filled = (score / 100) * arcFraction * circumference;
  const gap    = circumference - filled;
  // Start at 225° (bottom-left), sweep clockwise
  const rotation = 135; // degrees

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="105" viewBox="0 0 140 105" className="overflow-visible">
        {/* Background track */}
        <circle
          cx="70" cy="75" r={r}
          fill="none"
          className="stroke-[var(--border)]"
          strokeWidth="10"
          strokeDasharray={`${arcFraction * circumference} ${circumference * (1 - arcFraction)}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${rotation} 70 75)`}
        />
        {/* Filled arc */}
        <circle
          cx="70" cy="75" r={r}
          fill="none"
          className={c.ring}
          strokeWidth="10"
          strokeDasharray={`${filled} ${gap + circumference * (1 - arcFraction)}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${rotation} 70 75)`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        {/* Score text */}
        <text x="70" y="72" textAnchor="middle" className={`text-3xl font-black fill-current ${c.text}`}
          style={{ fontSize: "26px", fontWeight: 800 }}>
          {score}
        </text>
        <text x="70" y="88" textAnchor="middle" style={{ fontSize: "10px", fill: "var(--text-muted)" }}>
          out of 100
        </text>
      </svg>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
        score >= 80 ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700"
        : score >= 65 ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-700"
        : score >= 45 ? "border-amber-400/40 bg-amber-500/10 text-amber-700"
        : "border-rose-400/40 bg-rose-500/10 text-rose-700"
      }`}>
        {score >= 80 ? "✅" : score >= 65 ? "👍" : score >= 45 ? "⚠️" : "🚨"} {label}
      </span>
    </div>
  );
}

// ── Pipeline Funnel ───────────────────────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
  applied:      "#6366f1",
  review_zone:  "#f59e0b",
  screened:     "#8b5cf6",
  assessed:     "#a78bfa",
  interview:    "#0ea5e9",
  offer:        "#f59e0b",
  hired:        "#10b981",
};

function PipelineFunnel({ pipeline, total }: { pipeline: PipelineData; total: number }) {
  const maxCount = Math.max(...pipeline.stages.map(s => s.count), 1);

  return (
    <div className="space-y-2">
      {pipeline.stages.map((s, i) => {
        const widthPct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
        const isBottleneck = pipeline.bottleneck === s.stage;
        const color = STAGE_COLORS[s.stage] ?? "#6366f1";

        return (
          <div key={s.stage} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--foreground)]">{s.label}</span>
                {isBottleneck && (
                  <span className="rounded-full bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    Bottleneck
                  </span>
                )}
                {s.avgDaysInStage !== null && (
                  <span className="text-[var(--text-muted)]">~{s.avgDaysInStage}d</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {s.conversionRate !== null && (
                  <span className={`text-[11px] font-medium ${s.conversionRate >= 60 ? "text-emerald-600" : s.conversionRate >= 30 ? "text-amber-600" : "text-rose-600"}`}>
                    {s.conversionRate}% conv.
                  </span>
                )}
                <span className="font-bold text-[var(--foreground)]">{s.count}</span>
              </div>
            </div>
            <div className="h-7 w-full rounded-full bg-[var(--border)]/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(widthPct, s.count > 0 ? 2 : 0)}%`, backgroundColor: color, opacity: 0.9 }}
              />
            </div>
          </div>
        );
      })}

      {pipeline.rejected > 0 && (
        <div className="flex items-center justify-between text-xs mt-1 pt-2 border-t border-[var(--border)]/50">
          <span className="text-[var(--text-muted)]">Rejected</span>
          <span className="font-bold text-rose-500">{pipeline.rejected}</span>
        </div>
      )}
    </div>
  );
}

// ── Score Tier Donut-style ────────────────────────────────────────────────────
function TierBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)] font-medium">{label}</span>
        <span className="font-bold text-[var(--foreground)]">{count} <span className="font-normal text-[var(--text-muted)]">({pct}%)</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--border)]/40">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Custom recharts tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-[var(--text-secondary)] mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[var(--foreground)]">
          <span style={{ color: p.color }}>{p.name}: </span>
          <span className="font-bold">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`rb-skeleton rounded-2xl ${className ?? ""}`} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function JobAnalysisTab({
  jobId, token, jobTitle, candidates,
}: {
  jobId: string;
  token: string;
  jobTitle: string;
  candidates?: Array<{ stage: string }>;
}) {
  const [data, setData]     = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSection, setActiveSection] = useState<"overview" | "pipeline" | "quality" | "timeline" | "sources" | "assessment" | "ai">("overview");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(apiUrl(`/recruit/jobs/${jobId}/job-analysis`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load analysis");
      setData(json as AnalysisPayload);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [jobId, token]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // ── Navigation sections ───────────────────────────────────────────────────
  const SECTIONS = [
    { id: "overview",   label: "Overview",   icon: "📊" },
    { id: "pipeline",   label: "Pipeline",   icon: "🔽" },
    { id: "quality",    label: "Quality",    icon: "⭐" },
    { id: "timeline",   label: "Timeline",   icon: "📈" },
    { id: "sources",    label: "Sources",    icon: "🎯" },
    { id: "assessment", label: "Assessment", icon: "📝" },
    { id: "ai",         label: "AI Insights", icon: "🤖" },
  ] as const;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 py-2 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)]">Analysis unavailable</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{error || "Could not load job analysis."}</p>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="mt-4 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { overview, pipeline, quality, timeline, sources, assessment, offers, ai } = data;
  const hc = healthColor(ai.healthScore);

  return (
    <div className="space-y-6 py-2">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-indigo-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
              </svg>
            </span>
            Job Analysis
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
              overview.jobStatus === "active" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700"
              : overview.jobStatus === "paused" ? "border-amber-400/40 bg-amber-500/10 text-amber-700"
              : "border-gray-400/40 bg-gray-500/10 text-gray-600"
            }`}>
              {overview.jobStatus.charAt(0).toUpperCase() + overview.jobStatus.slice(1)}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Comprehensive analysis for <span className="font-semibold text-[var(--text-secondary)]">{jobTitle}</span>
            {" "}· Posted {overview.activeDays} day{overview.activeDays !== 1 ? "s" : ""} ago
            {overview.openings > 1 && ` · ${overview.openings} openings`}
          </p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-indigo-400/40 transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Health Score + Top KPIs ── */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Gauge */}
          <div className="shrink-0">
            <HealthGauge score={ai.healthScore} label={ai.healthLabel} />
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 w-full">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total</p>
              <p className="text-xl font-black text-[var(--foreground)]">{overview.totalCandidates}</p>
              <p className="text-[10px] text-[var(--text-muted)]">candidates</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Hired</p>
              <p className="text-xl font-black text-emerald-600">{overview.hiredCount}</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {overview.totalCandidates > 0 ? `${Math.round((overview.hiredCount / overview.totalCandidates) * 100)}%` : "0%"} rate
              </p>
            </div>
            <div className={`rounded-2xl border p-3 text-center ${overview.avgScore !== null ? scoreColor(overview.avgScore, "border") + " " + (overview.avgScore >= 60 ? "bg-emerald-500/5" : overview.avgScore >= 40 ? "bg-amber-500/5" : "bg-rose-500/5") : "border-[var(--border)] bg-[var(--surface)]"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Avg Score</p>
              <p className={`text-xl font-black ${scoreColor(overview.avgScore)}`}>
                {overview.avgScore !== null ? `${overview.avgScore}%` : "—"}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">resume quality</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Time to Hire</p>
              <p className="text-xl font-black text-[var(--foreground)]">
                {overview.timeToHireDays !== null ? `${overview.timeToHireDays}d` : "—"}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">average</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Apps/Week</p>
              <p className="text-xl font-black text-[var(--foreground)]">{overview.weeklyApplicationRate}</p>
              <p className="text-[10px] text-[var(--text-muted)]">avg rate</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Active</p>
              <p className="text-xl font-black text-[var(--foreground)]">{overview.totalActive}</p>
              <p className="text-[10px] text-[var(--text-muted)]">in pipeline</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section nav ── */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-0">
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`whitespace-nowrap px-3 py-2 text-xs font-semibold transition border-b-2 -mb-px flex items-center gap-1.5 ${
              activeSection === sec.id
                ? "border-indigo-500 text-[var(--foreground)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <span>{sec.icon}</span> {sec.label}
          </button>
        ))}
      </div>

      {/* ── Section: Overview ─────────────────────────────────────────────── */}
      {activeSection === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Rejected" value={overview.rejectedCount}
              sub={overview.totalCandidates > 0 ? `${Math.round((overview.rejectedCount / overview.totalCandidates) * 100)}% of total` : "0%"} />
            <StatCard label="Offers Sent" value={overview.offerSentCount}
              sub={offers.acceptanceRate !== null ? `${offers.acceptanceRate}% acceptance` : "No offers yet"} />
            <StatCard label="Top Score" value={overview.topScore !== null ? `${overview.topScore}%` : "—"}
              sub="highest resume score" highlight={overview.topScore !== null && overview.topScore >= 75} />
            <StatCard label="Openings" value={overview.openings}
              sub={`${overview.hiredCount} of ${overview.openings} filled`}
              highlight={overview.hiredCount >= overview.openings} />
          </div>

          {/* Pipeline quick summary */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <SectionHeading
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              title="Pipeline Snapshot"
              sub="Current distribution across all hiring stages"
            />
            <PipelineFunnel pipeline={pipeline} total={overview.totalCandidates} />
          </div>

          {/* Offer summary if any */}
          {(offers.sent > 0 || overview.hiredCount > 0) && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <SectionHeading
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>}
                title="Offer Summary"
                sub="Offer letter status across all candidates"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
                  <p className="text-lg font-black text-[var(--foreground)]">{offers.sent}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Sent</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-3 text-center">
                  <p className="text-lg font-black text-emerald-600">{offers.accepted}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Accepted</p>
                </div>
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-3 text-center">
                  <p className="text-lg font-black text-rose-600">{offers.declined}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Declined</p>
                </div>
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-3 text-center">
                  <p className="text-lg font-black text-amber-600">{offers.pending}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Pending</p>
                </div>
              </div>
              {offers.acceptanceRate !== null && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-muted)]">Acceptance rate</span>
                    <span className={`font-bold ${offers.acceptanceRate >= 70 ? "text-emerald-600" : offers.acceptanceRate >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                      {offers.acceptanceRate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--border)]/40">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${offers.acceptanceRate >= 70 ? "bg-emerald-500" : offers.acceptanceRate >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${offers.acceptanceRate}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Section: Pipeline ─────────────────────────────────────────────── */}
      {activeSection === "pipeline" && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <SectionHeading
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              title="Hiring Funnel"
              sub="How candidates flow through each stage — hover bars for conversion detail"
            />
            <PipelineFunnel pipeline={pipeline} total={overview.totalCandidates} />

            {pipeline.bottleneck && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/5 px-4 py-3">
                <span className="text-base shrink-0">⚠️</span>
                <div>
                  <p className="text-xs font-bold text-amber-700">Pipeline Bottleneck Detected</p>
                  <p className="text-xs text-amber-700/80 mt-0.5">
                    The <strong>{pipeline.bottleneck}</strong> stage has the highest candidate concentration.
                    Consider taking action to move candidates forward or increase capacity at this stage.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Conversion table */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <SectionHeading
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>}
              title="Stage Conversion Rates"
              sub="Percentage of candidates who advanced to each stage"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-2 text-left font-semibold text-[var(--text-muted)] pr-4">Stage</th>
                    <th className="pb-2 text-right font-semibold text-[var(--text-muted)] pr-4">Candidates</th>
                    <th className="pb-2 text-right font-semibold text-[var(--text-muted)] pr-4">% of Total</th>
                    <th className="pb-2 text-right font-semibold text-[var(--text-muted)] pr-4">Conversion</th>
                    <th className="pb-2 text-right font-semibold text-[var(--text-muted)]">Avg Days Here</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/50">
                  {pipeline.stages.map(s => (
                    <tr key={s.stage} className={pipeline.bottleneck === s.stage ? "bg-amber-500/5" : ""}>
                      <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">
                        {s.label}
                        {pipeline.bottleneck === s.stage && <span className="ml-2 text-amber-600">⚠</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-bold text-[var(--foreground)]">{s.count}</td>
                      <td className="py-2.5 pr-4 text-right text-[var(--text-secondary)]">{s.pct}%</td>
                      <td className="py-2.5 pr-4 text-right">
                        {s.conversionRate !== null ? (
                          <span className={`font-semibold ${s.conversionRate >= 60 ? "text-emerald-600" : s.conversionRate >= 30 ? "text-amber-600" : "text-rose-600"}`}>
                            {s.conversionRate}%
                          </span>
                        ) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="py-2.5 text-right text-[var(--text-secondary)]">
                        {s.avgDaysInStage !== null ? `${s.avgDaysInStage}d` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Section: Quality ─────────────────────────────────────────────── */}
      {activeSection === "quality" && (
        <div className="space-y-5">
          {/* Score tiers */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <SectionHeading
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
              title="Candidate Quality Tiers"
              sub={`Based on AI resume scoring — ${quality.totalScored} of ${overview.totalCandidates} candidates scored`}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Excellent", count: quality.candidatesByTier.excellent, color: "border-emerald-400/40 bg-emerald-500/5 text-emerald-600", desc: "≥ 80%" },
                { label: "Good",      count: quality.candidatesByTier.good,      color: "border-indigo-400/40 bg-indigo-500/5 text-indigo-600",  desc: "60–79%" },
                { label: "Average",   count: quality.candidatesByTier.average,   color: "border-amber-400/40 bg-amber-500/5 text-amber-600",    desc: "40–59%" },
                { label: "Low",       count: quality.candidatesByTier.low,       color: "border-rose-400/40 bg-rose-500/5 text-rose-600",       desc: "< 40%" },
              ].map(t => (
                <div key={t.label} className={`rounded-2xl border p-3 text-center ${t.color.split(" ").slice(0, 2).join(" ")}`}>
                  <p className={`text-2xl font-black ${t.color.split(" ")[2]}`}>{t.count}</p>
                  <p className="text-[11px] font-bold text-[var(--text-secondary)]">{t.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{t.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              <TierBar label="Excellent (80–100%)" count={quality.candidatesByTier.excellent} total={quality.totalScored} color="#10b981" />
              <TierBar label="Good (60–79%)"      count={quality.candidatesByTier.good}      total={quality.totalScored} color="#6366f1" />
              <TierBar label="Average (40–59%)"   count={quality.candidatesByTier.average}   total={quality.totalScored} color="#f59e0b" />
              <TierBar label="Low (< 40%)"        count={quality.candidatesByTier.low}        total={quality.totalScored} color="#ef4444" />
            </div>

            {quality.scoringFailedCount > 0 && (
              <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                ⚠️ {quality.scoringFailedCount} candidate{quality.scoringFailedCount !== 1 ? "s" : ""} could not be scored due to AI processing errors.
              </p>
            )}
          </div>

          {/* Score distribution bar chart */}
          {quality.totalScored > 0 && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <SectionHeading
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="7" rx="1"/><rect x="12" y="9" width="3" height="11" rx="1"/><rect x="17" y="6" width="3" height="14" rx="1"/></svg>}
                title="Score Distribution"
                sub="How resume scores cluster across all candidates"
              />
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quality.scoreDistribution} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => `${v} candidates`} />} />
                    <Bar dataKey="count" name="Candidates" radius={[6, 6, 0, 0]}>
                      {quality.scoreDistribution.map((entry, i) => {
                        const rangeColors = ["#ef4444", "#f59e0b", "#a78bfa", "#6366f1", "#10b981"];
                        return <Cell key={i} fill={rangeColors[i] ?? "#6366f1"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Avg Score" value={quality.avgScore !== null ? `${quality.avgScore}%` : "—"} sub="across all candidates" highlight={quality.avgScore !== null && quality.avgScore >= 65} />
            <StatCard label="Top Score" value={quality.topScore !== null ? `${quality.topScore}%` : "—"} sub="best resume" highlight={quality.topScore !== null && quality.topScore >= 80} />
          </div>
        </div>
      )}

      {/* ── Section: Timeline ─────────────────────────────────────────────── */}
      {activeSection === "timeline" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Total Days Active" value={`${overview.activeDays}d`} sub="since job was posted" />
            <StatCard label="Weekly Avg" value={overview.weeklyApplicationRate} sub="applications per week" highlight={overview.weeklyApplicationRate >= 5} />
            <StatCard label="Peak Day" value={timeline.peakDay ? new Date(timeline.peakDay).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"} sub={timeline.peakCount > 0 ? `${timeline.peakCount} applications` : "No data"} />
          </div>

          {timeline.daily.length > 1 ? (
            <>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <SectionHeading
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>}
                  title="Daily Applications"
                  sub="New candidates received per day"
                />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline.daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                        tickFormatter={(d: string) => {
                          const date = new Date(d);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} allowDecimals={false} />
                      <Tooltip
                        content={<ChartTooltip formatter={(v: number) => `${v} application${v !== 1 ? "s" : ""}`} />}
                        labelFormatter={(d) => typeof d === "string" ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : String(d)}
                      />
                      <Area type="monotone" dataKey="count" name="Applications" stroke="#6366f1" strokeWidth={2} fill="url(#appGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <SectionHeading
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
                  title="Cumulative Applications"
                  sub="Total candidates accumulated over time"
                />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline.daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                        tickFormatter={(d: string) => {
                          const date = new Date(d);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <Tooltip
                        content={<ChartTooltip formatter={(v: number) => `${v} total`} />}
                        labelFormatter={(d) => typeof d === "string" ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : String(d)}
                      />
                      <Area type="monotone" dataKey="cumulative" name="Total Candidates" stroke="#10b981" strokeWidth={2} fill="url(#cumGrad)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-14 text-center">
              <p className="text-2xl mb-2">📅</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">Not enough data for timeline</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Application timeline will appear as candidates apply over multiple days.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Section: Sources ─────────────────────────────────────────────── */}
      {activeSection === "sources" && (
        <div className="space-y-5">
          {sources.length > 0 ? (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <SectionHeading
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>}
                title="Application Sources"
                sub="Where candidates are coming from and source quality"
              />
              <div className="space-y-3">
                {sources.map((src, i) => (
                  <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--foreground)] truncate max-w-[180px]">{src.source}</span>
                        {src.hireCount > 0 && (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {src.hireCount} hired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-[var(--text-muted)]">{src.count} ({src.pct}%)</span>
                        {src.hireRate !== null && (
                          <span className={`font-bold ${src.hireRate >= 10 ? "text-emerald-600" : src.hireRate > 0 ? "text-amber-600" : "text-[var(--text-muted)]"}`}>
                            {src.hireRate}% hire rate
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--border)]/40">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${src.pct}%`,
                          backgroundColor: ["#6366f1","#8b5cf6","#0ea5e9","#10b981","#f59e0b","#ec4899","#14b8a6","#f97316"][i % 8],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-14 text-center">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">No source data yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Source tracking will appear once candidates have been added with source information.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Section: Assessment ─────────────────────────────────────────── */}
      {activeSection === "assessment" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Assessments Sent" value={assessment.sent} sub="candidates invited" />
            <StatCard label="Completed" value={assessment.completed}
              sub={assessment.sent > 0 ? `${assessment.completionRate}% completion rate` : "0%"}
              highlight={assessment.completionRate >= 60} />
            <StatCard label="Pass Rate" value={assessment.passRate !== null ? `${assessment.passRate}%` : "—"}
              sub="strong yes decisions" highlight={assessment.passRate !== null && assessment.passRate >= 40} />
          </div>

          {assessment.sent > 0 ? (
            <>
              {/* Completion progress */}
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <SectionHeading
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>}
                  title="Assessment Completion"
                  sub="How many candidates completed the assessment"
                />
                <div className="space-y-3">
                  {[
                    { label: "Completed", count: assessment.completed, color: "#10b981" },
                    { label: "In Progress / Sent", count: assessment.sent - assessment.completed, color: "#f59e0b" },
                    { label: "Not Sent", count: overview.totalCandidates - assessment.sent, color: "#e5e7eb" },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)] font-medium">{item.label}</span>
                        <span className="font-bold text-[var(--foreground)]">
                          {item.count}
                          <span className="font-normal text-[var(--text-muted)] ml-1">
                            ({overview.totalCandidates > 0 ? Math.round((item.count / overview.totalCandidates) * 100) : 0}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-[var(--border)]/40">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${overview.totalCandidates > 0 ? (item.count / overview.totalCandidates) * 100 : 0}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision breakdown */}
              {assessment.completed > 0 && (
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                  <SectionHeading
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>}
                    title="Hiring Decision Breakdown"
                    sub="AI-assessed decisions from completed assessments"
                  />
                  <div className="space-y-2.5">
                    {[
                      { label: "Strong Yes", count: assessment.passCount,  color: "#10b981", emoji: "✅" },
                      { label: "Maybe",      count: assessment.maybeCount, color: "#f59e0b", emoji: "🤔" },
                      { label: "No",         count: assessment.failCount,  color: "#ef4444", emoji: "❌" },
                    ].map(d => (
                      <TierBar key={d.label} label={`${d.emoji} ${d.label}`} count={d.count} total={assessment.completed} color={d.color} />
                    ))}
                  </div>

                  {assessment.avgScore !== null && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Assessment Avg Score</p>
                        <p className={`text-xl font-black ${scoreColor(assessment.avgScore)}`}>{assessment.avgScore}%</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-14 text-center">
              <p className="text-2xl mb-2">📝</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">No assessments sent yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Assessment data will appear once you start sending assessments to shortlisted candidates.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Section: AI Insights ─────────────────────────────────────────── */}
      {activeSection === "ai" && (
        <div className="space-y-5">
          {/* Health score card */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <SectionHeading
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>}
              title="AI Job Health Analysis"
              sub="Powered by AI — analyzes pipeline data, candidate quality, conversion rates, and timing"
            />
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <HealthGauge score={ai.healthScore} label={ai.healthLabel} />
              <div className="flex-1 text-sm text-[var(--text-secondary)] leading-relaxed">
                <p>
                  This job&apos;s overall health score is <strong className={hc.text}>{ai.healthScore}/100</strong> ({ai.healthLabel}).
                  The score is computed from pipeline activity, candidate quality, conversion efficiency, and time-to-hire benchmarks.
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Refresh the analysis to get an updated score as your pipeline evolves.
                </p>
              </div>
            </div>
          </div>

          {/* AI insights */}
          {ai.insights.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Recommendations & Observations
              </p>
              {ai.insights.map((ins, i) => {
                const m = insightMeta(ins.type);
                return (
                  <div key={i} className={`rounded-2xl border p-4 ${m.border} ${m.bg}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <p className="text-sm font-bold text-[var(--foreground)]">{ins.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.badge}`}>{m.label}</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{ins.detail}</p>
                        {ins.action && (
                          <div className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/60 px-3 py-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 shrink-0 mt-0.5">
                              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                            </svg>
                            <p className="text-[11px] font-semibold text-indigo-600">{ins.action}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-12 text-center">
              <p className="text-2xl mb-2">🤖</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">AI insights not available</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">AI-generated recommendations will appear here. Try refreshing the analysis.</p>
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 transition"
              >
                Refresh Analysis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
