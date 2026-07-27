"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { JudgesTestingKit } from "@/components/JudgesTestingKit";

// ─── Types ────────────────────────────────────────────────────────────────────

type OperationalStatus = "operational" | "degraded" | "unavailable" | "unknown" | "loading";

interface ModelInfo {
  id: string;
  role: string;
  label: string;
  status: OperationalStatus;
}

interface ServiceInfo {
  id: string;
  label: string;
  status: OperationalStatus;
}

interface SystemHealth {
  backend: OperationalStatus;
  meshApi: OperationalStatus;
  database: OperationalStatus;
  auth: OperationalStatus;
}

interface StatusPayload {
  status: OperationalStatus;
  reason?: string;
  responseTimeMs: number | null;
  checkedAt: string;
  meshApiUrl: string;
  apiVersion: string;
  models: ModelInfo[];
  services: ServiceInfo[];
  systemHealth: SystemHealth;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OperationalStatus,
  { label: string; dot: string; badge: string; text: string; icon: string }
> = {
  operational: {
    label: "Operational",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/12 border-emerald-500/25 text-emerald-400",
    text: "text-emerald-400",
    icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  },
  degraded: {
    label: "Degraded",
    dot: "bg-amber-400",
    badge: "bg-amber-500/12 border-amber-500/25 text-amber-400",
    text: "text-amber-400",
    icon: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  },
  unavailable: {
    label: "Unavailable",
    dot: "bg-red-400",
    badge: "bg-red-500/12 border-red-500/25 text-red-400",
    text: "text-red-400",
    icon: "M18 6 6 18M6 6l12 12",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-slate-500",
    badge: "bg-slate-500/12 border-slate-500/25 text-slate-400",
    text: "text-slate-400",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  loading: {
    label: "Checking…",
    dot: "bg-slate-600",
    badge: "bg-slate-600/12 border-slate-600/25 text-slate-500",
    text: "text-slate-500",
    icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
  },
};

function StatusDot({ status, size = "md" }: { status: OperationalStatus; size?: "sm" | "md" | "lg" }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  const sizeMap = { sm: "h-2 w-2", md: "h-2.5 w-2.5", lg: "h-3.5 w-3.5" };
  const pingMap = { sm: "h-2 w-2", md: "h-2.5 w-2.5", lg: "h-3.5 w-3.5" };
  const animate = status === "operational" || status === "loading";
  return (
    <span className="relative flex shrink-0" style={{ width: size === "lg" ? 14 : size === "md" ? 10 : 8, height: size === "lg" ? 14 : size === "md" ? 10 : 8 }}>
      {animate && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
      )}
      <span className={`relative inline-flex rounded-full ${sizeMap[size]} ${cfg.dot}`} />
    </span>
  );
}

function StatusBadge({ status }: { status: OperationalStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.badge}`}>
      <StatusDot status={status} size="sm" />
      {cfg.label}
    </span>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1">{eyebrow}</p>
      <h2 className="text-[18px] font-black text-white tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">{description}</p>}
    </div>
  );
}

const REFRESH_INTERVAL = 30; // seconds

// ─── Component ───────────────────────────────────────────────────────────────

export default function MeshApiStatusPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/mesh-api-status", { cache: "no-store" });
      const json: StatusPayload = await res.json();
      setData(json);
      setLastFetched(new Date());
    } catch (err: any) {
      setFetchError(err?.message ?? "Failed to reach status endpoint.");
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { fetchStatus(); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const overallStatus: OperationalStatus = loading ? "loading" : data?.status ?? "unknown";
  const overallCfg = STATUS_CONFIG[overallStatus];

  const systemComponents: { key: keyof SystemHealth; label: string; icon: string }[] = [
    { key: "backend",  label: "Express Backend",  icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
    { key: "meshApi",  label: "Mesh API Gateway", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    { key: "database", label: "MongoDB Atlas",    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
    { key: "auth",     label: "Auth",             icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5 shrink-0">
            <RoleboltLogo className="h-7 w-7" />
            <div className="leading-none">
              <p className="text-[14px] font-black text-white tracking-tight">Rolebolt</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Mesh API Status</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {/* Live refresh indicator */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Auto-refresh in {countdown}s
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all disabled:opacity-40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
            <Link href="/recruit" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all">
              ← Back
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-white/6 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${overallStatus === "operational" ? "bg-emerald-500/3" : overallStatus === "degraded" ? "bg-amber-500/3" : overallStatus === "unavailable" ? "bg-red-500/3" : ""}`} />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-18 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Integration Health</p>
                  <p className="text-[15px] font-black text-white leading-tight">Mesh API Status</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot status={overallStatus} size="lg" />
                <span className={`text-3xl font-black tracking-tight sm:text-4xl ${overallCfg.text} transition-colors`}>
                  {overallCfg.label}
                </span>
              </div>
              {data?.reason && (
                <p className="mt-2 text-[12px] text-red-400/70 font-medium">{data.reason}</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 sm:flex-col sm:items-end">
              {data?.responseTimeMs != null && (
                <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-center min-w-[96px]">
                  <p className="text-2xl font-black text-white tabular-nums">{data.responseTimeMs}<span className="text-sm font-medium text-slate-500 ml-0.5">ms</span></p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Response time</p>
                </div>
              )}
              {lastFetched && (
                <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-center min-w-[96px]">
                  <p className="text-[15px] font-black text-white tabular-nums">{lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Last checked</p>
                </div>
              )}
            </div>
          </div>

          {/* Error banner */}
          {fetchError && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-center gap-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-[12px] text-red-400">{fetchError}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">

        {/* ── 1. Current Status ──────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            eyebrow="01 / Current Status"
            title="Connection Overview"
            description="Real-time connectivity check against the Mesh API gateway."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Overall Status",
                status: overallStatus,
                icon: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
                detail: loading ? "Checking…" : data?.status === "operational" ? "All systems go" : data?.reason ?? "See details below",
              },
              {
                label: "Connection",
                status: overallStatus === "loading" ? "loading" : data?.responseTimeMs != null ? "operational" : "unavailable" as OperationalStatus,
                icon: "M8.111 16.404a5.5 5.5 0 0 1 7.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
                detail: data?.responseTimeMs != null ? `${data.responseTimeMs}ms latency` : "No response",
              },
              {
                label: "API Availability",
                status: overallStatus === "loading" ? "loading" : data?.status !== "unavailable" ? "operational" : "unavailable" as OperationalStatus,
                icon: "M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-.1-9.999 5.002 5.002 0 0 0-9.78 2.096A4.001 4.001 0 0 0 3 15z",
                detail: data?.meshApiUrl ?? "api.meshapi.ai",
              },
              {
                label: "Operational State",
                status: overallStatus,
                icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
                detail: data?.checkedAt
                  ? `Since ${new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "—",
              },
            ].map((item) => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.unknown;
              return (
                <div key={item.label} className="rounded-2xl border border-white/8 bg-white/3 p-5 flex flex-col gap-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/5 ${cfg.text}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={item.icon} />
                      </svg>
                    </div>
                    <StatusDot status={item.status} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{item.label}</p>
                    <p className={`text-[15px] font-black leading-snug ${cfg.text}`}>{cfg.label}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 2. AI Models ───────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            eyebrow="02 / AI Models"
            title="Available Models"
            description="Mesh API routes requests through a primary model with automatic fallback — if one provider is unavailable, the next is tried immediately."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {(loading
              ? [
                  { id: "openai/gpt-4o-mini", role: "primary", label: "GPT-4o mini", status: "loading" as OperationalStatus },
                  { id: "anthropic/claude-3-haiku", role: "fallback-1", label: "Claude 3 Haiku", status: "loading" as OperationalStatus },
                  { id: "google/gemini-2.5-flash-lite", role: "fallback-2", label: "Gemini 2.5 Flash Lite", status: "loading" as OperationalStatus },
                ]
              : data?.models ?? []
            ).map((model, i) => {
              const cfg = STATUS_CONFIG[model.status] ?? STATUS_CONFIG.unknown;
              const roleLabels: Record<string, { text: string; color: string }> = {
                "primary":    { text: "Primary",    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
                "fallback-1": { text: "Fallback 1", color: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
                "fallback-2": { text: "Fallback 2", color: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
              };
              const rl = roleLabels[model.role] ?? { text: model.role, color: "bg-slate-500/10 border-slate-500/20 text-slate-400" };
              const providerIcons: Record<number, string> = {
                0: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-11h2v6h-2zm0-4h2v2h-2z",
                1: "M12 3C7.58 3 4 5.69 4 9c0 2.12 1.35 4.01 3.5 5.26V17l2.5-1.5L12 17l2-1.24 2.5 1.5v-2.74C18.65 13.01 20 11.12 20 9c0-3.31-3.58-6-8-6z",
                2: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
              };
              return (
                <div key={model.id} className="rounded-2xl border border-white/8 bg-white/3 p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/5 ${cfg.text}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={providerIcons[i] ?? providerIcons[0]} />
                      </svg>
                    </div>
                    <StatusDot status={model.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${rl.color}`}>{rl.text}</span>
                    <StatusBadge status={model.status} />
                  </div>
                  <p className="text-[14px] font-bold text-white leading-snug">{model.label}</p>
                  <p className="text-[11px] font-mono text-slate-600 mt-1 truncate">{model.id}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 3. AI Services ─────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            eyebrow="03 / AI Services"
            title="Powered Features"
            description="Each AI-powered feature in Rolebolt routes its request through Mesh API — status reflects the underlying gateway health."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(loading
              ? [
                  { id: "resumeAnalysis", label: "Resume Analysis", status: "loading" as OperationalStatus },
                  { id: "candidateScoring", label: "Candidate Scoring", status: "loading" as OperationalStatus },
                  { id: "candidateMatching", label: "Candidate Matching", status: "loading" as OperationalStatus },
                  { id: "jobDescriptionGeneration", label: "Job Description Generation", status: "loading" as OperationalStatus },
                  { id: "aiAssistant", label: "AI Recruitment Assistant", status: "loading" as OperationalStatus },
                  { id: "formResponseScoring", label: "Form Response Scoring", status: "loading" as OperationalStatus },
                ]
              : data?.services ?? []
            ).map((svc) => {
              const cfg = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.unknown;
              const icons: Record<string, string> = {
                resumeAnalysis:          "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
                candidateScoring:        "M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2",
                candidateMatching:       "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
                jobDescriptionGeneration:"M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
                aiAssistant:             "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
                formResponseScoring:     "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
              };
              return (
                <div key={svc.id} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors">
                  <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/5 ${cfg.text}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={icons[svc.id] ?? icons.aiAssistant} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-200 leading-snug truncate">{svc.label}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5 font-mono">via Mesh API</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <StatusDot status={svc.status} size="sm" />
                    <span className={`text-[11px] font-bold ${cfg.text}`}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. API Information ─────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            eyebrow="04 / API Information"
            title="Integration Details"
            description="Configuration and runtime metadata for the Mesh API connection."
          />
          <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            {[
              { label: "Provider", value: "Mesh API", mono: false },
              { label: "Endpoint", value: data?.meshApiUrl ?? "https://api.meshapi.ai/v1", mono: true },
              { label: "API Version", value: data?.apiVersion ?? "v1", mono: true },
              { label: "Primary Model", value: "openai/gpt-4o-mini", mono: true },
              { label: "Fallback Chain", value: "claude-3-haiku → gemini-2.5-flash-lite", mono: true },
              { label: "Last Health Check", value: data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—", mono: false },
              { label: "Response Time", value: data?.responseTimeMs != null ? `${data.responseTimeMs} ms` : loading ? "Measuring…" : "—", mono: false },
              { label: "Auto-refresh", value: `Every ${REFRESH_INTERVAL} seconds`, mono: false },
            ].map((row, i, arr) => (
              <div key={row.label} className={`flex items-center justify-between px-5 py-3.5 ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
                <p className="text-[12px] font-semibold text-slate-500 shrink-0 w-36">{row.label}</p>
                <p className={`text-[12px] text-slate-300 text-right truncate ${row.mono ? "font-mono" : "font-medium"}`}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. System Health ───────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            eyebrow="05 / System Health"
            title="Overall System Summary"
            description="Health of each layer in the Rolebolt stack — from authentication through to AI model execution."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {systemComponents.map((comp) => {
              const status: OperationalStatus = loading ? "loading" : (data?.systemHealth?.[comp.key] ?? "unknown");
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
              return (
                <div key={comp.key} className={`rounded-2xl border p-5 transition-colors ${
                  status === "operational" ? "border-emerald-500/15 bg-emerald-500/4" :
                  status === "degraded"    ? "border-amber-500/15 bg-amber-500/4" :
                  status === "unavailable" ? "border-red-500/15 bg-red-500/4" :
                  "border-white/8 bg-white/3"
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/5 ${cfg.text}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {comp.icon.split("M").slice(1).map((d, j) => <path key={j} d={`M${d}`} />)}
                      </svg>
                    </div>
                    <StatusDot status={status} size="md" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{comp.label}</p>
                  <p className={`text-[17px] font-black leading-snug ${cfg.text}`}>{cfg.label}</p>
                </div>
              );
            })}
          </div>

          {/* Summary strip */}
          <div className="mt-4 rounded-xl border border-white/8 bg-white/3 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusDot status={overallStatus} size="md" />
              <span className="text-[13px] font-bold text-slate-300">
                {overallStatus === "operational" && "All systems operational — Mesh API is healthy and responding normally."}
                {overallStatus === "degraded"    && "Degraded performance — some AI features may be slower than usual."}
                {overallStatus === "unavailable" && "Service unavailable — Mesh API is not responding."}
                {overallStatus === "loading"     && "Running health checks…"}
                {overallStatus === "unknown"     && "Status unknown — unable to reach status endpoint."}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {lastFetched ? `Updated ${lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Updating…"}
            </div>
          </div>
        </div>

      </main>

      {/* ── Judges Testing Kit ───────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="border-t border-white/6 pt-12">
          <JudgesTestingKit dark={true} />
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 mt-16">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <RoleboltLogo className="h-5 w-5 opacity-50" />
            <span>© 2026 Rolebolt. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <Link href="/recruit" className="hover:text-slate-400 transition-colors">Home</Link>
            <Link href="/recruit/preview" className="hover:text-slate-400 transition-colors">Product Preview</Link>
            <a href="https://meshapi.ai" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">Mesh API ↗</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
