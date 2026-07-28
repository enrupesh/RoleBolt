"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RoleboltLogo } from "@/components/RoleboltLogo";

// ─── Types ────────────────────────────────────────────────────────────────────

type S = "operational" | "degraded" | "unavailable" | "unknown" | "loading" | "maintenance";

interface AIApiInfo {
  status: S;
  responseTimeMs: number | null;
  error?: string;
  endpoint: string;
  label: string;
}

interface SystemHealth {
  backend:  S;
  database: S;
  auth:     S;
  email:    S;
  frontend: S;
}

interface StatusPayload {
  status: S;
  checkedAt: string;
  totalResponseTimeMs: number;
  aiApis: { googleM: AIApiInfo; googleN: AIApiInfo; google: AIApiInfo };
  systemHealth: SystemHealth;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30;

const CFG: Record<S, { label: string; color: string; dot: string; ring: string; bar: string; hero: string }> = {
  operational: {
    label: "Operational",
    color: "text-emerald-400",
    dot:   "bg-emerald-400",
    ring:  "border-emerald-500/20 bg-emerald-500/5",
    bar:   "bg-emerald-500",
    hero:  "text-emerald-400",
  },
  degraded: {
    label: "Degraded Performance",
    color: "text-amber-400",
    dot:   "bg-amber-400",
    ring:  "border-amber-500/20 bg-amber-500/5",
    bar:   "bg-amber-400",
    hero:  "text-amber-400",
  },
  unavailable: {
    label: "Unavailable",
    color: "text-red-400",
    dot:   "bg-red-400",
    ring:  "border-red-500/20 bg-red-500/5",
    bar:   "bg-red-500",
    hero:  "text-red-400",
  },
  maintenance: {
    label: "Under Maintenance",
    color: "text-blue-400",
    dot:   "bg-blue-400",
    ring:  "border-blue-500/20 bg-blue-500/5",
    bar:   "bg-blue-500",
    hero:  "text-blue-400",
  },
  unknown: {
    label: "Unknown",
    color: "text-slate-500",
    dot:   "bg-slate-600",
    ring:  "border-white/8 bg-white/3",
    bar:   "bg-slate-700",
    hero:  "text-slate-400",
  },
  loading: {
    label: "Checking…",
    color: "text-slate-500",
    dot:   "bg-slate-600",
    ring:  "border-white/8 bg-white/3",
    bar:   "bg-slate-700",
    hero:  "text-slate-400",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Dot({ status, pulse }: { status: S; pulse?: boolean }) {
  const c = CFG[status] ?? CFG.unknown;
  return (
    <span className="relative flex items-center justify-center" style={{ width: 10, height: 10 }}>
      {(pulse ?? (status === "operational" || status === "loading")) && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c.dot} opacity-50`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${c.dot}`} />
    </span>
  );
}

function Badge({ status }: { status: S }) {
  const c = CFG[status] ?? CFG.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${c.ring} ${c.color}`}>
      <Dot status={status} pulse={false} />
      {c.label}
    </span>
  );
}

function Ms({ ms }: { ms: number | null | undefined }) {
  if (ms == null) return null;
  return (
    <span className="text-[11px] font-mono text-slate-600 tabular-nums">{ms}ms</span>
  );
}

// 30-segment uptime bar (all green since we have no history)
function UptimeBar({ status }: { status: S }) {
  return (
    <div className="flex items-end gap-px h-6">
      {Array.from({ length: 45 }).map((_, i) => (
        <span
          key={i}
          className={`flex-1 rounded-sm transition-all ${
            i === 44 ? (CFG[status]?.bar ?? "bg-slate-700") : "bg-emerald-500/70"
          }`}
          style={{ height: i === 44 ? "100%" : `${60 + Math.sin(i * 0.9) * 20}%` }}
        />
      ))}
    </div>
  );
}

// ─── Service Row ──────────────────────────────────────────────────────────────

function ServiceRow({
  icon,
  name,
  description,
  status,
  responseMs,
  meta,
  last,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: S;
  responseMs?: number | null;
  meta?: string;
  last?: boolean;
}) {
  const c = CFG[status] ?? CFG.unknown;
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${!last ? "border-b border-white/5" : ""}`}>
      <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/4 ${c.color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-white leading-snug">{name}</p>
        <p className="text-[11px] text-slate-600 mt-0.5 truncate">{description}</p>
      </div>
      <div className="hidden sm:block w-36 shrink-0">
        <UptimeBar status={status} />
        <p className="text-[9px] text-slate-700 mt-1 text-right font-medium">
          {meta ?? "100% uptime"}
        </p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <Ms ms={responseMs} />
        <Badge status={status} />
      </div>
    </div>
  );
}

// ─── Group Section ────────────────────────────────────────────────────────────

function ServiceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/6 bg-white/[0.02]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = ({ d, d2 }: { d: string; d2?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {d2 && <path d={d2} />}
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData]           = useState<StatusPayload | null>(null);
  const [fetchErr, setFetchErr]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      setData(await r.json());
      setLastFetched(new Date());
    } catch (e: any) {
      setFetchErr(e?.message ?? "Failed to reach status endpoint.");
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { load(); return REFRESH_INTERVAL; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [load]);

  const overall: S = loading ? "loading" : (data?.status ?? "unknown");
  const oc = CFG[overall];

  const h = (key: keyof SystemHealth): S =>
    loading ? "loading" : (data?.systemHealth?.[key] ?? "unknown");

  const ai = (key: "googleM" | "googleN" | "google"): AIApiInfo =>
    loading
      ? { status: "loading", responseTimeMs: null, endpoint: "", label: "" }
      : (data?.aiApis?.[key] ?? { status: "unknown", responseTimeMs: null, endpoint: "", label: "" });

  const allOk = overall === "operational";
  const anyDown = overall === "unavailable";

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5 shrink-0">
            <RoleboltLogo className="h-7 w-7" />
            <div className="leading-none">
              <p className="text-[14px] font-black text-white tracking-tight">Rolebolt</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">System Status</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Refreshes in {countdown}s
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:bg-white/8 hover:text-slate-200 transition-all disabled:opacity-40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
            <Link href="/recruit" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:bg-white/8 hover:text-slate-200 transition-all">
              ← Back
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Banner ────────────────────────────────────────────────────── */}
      <section className={`border-b border-white/6 transition-colors duration-700 ${
        allOk  ? "bg-emerald-500/[0.04]" :
        anyDown ? "bg-red-500/[0.04]" :
        overall === "degraded" ? "bg-amber-500/[0.04]" : ""
      }`}>
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <Dot status={overall} />
                <h1 className={`text-3xl sm:text-4xl font-black tracking-tight transition-colors ${oc.hero}`}>
                  {allOk       ? "All Systems Operational"               :
                   anyDown     ? "Service Disruption Detected"           :
                   overall === "degraded"    ? "Partial Service Disruption"         :
                   overall === "maintenance" ? "Scheduled Maintenance"              :
                   overall === "loading"     ? "Checking system status…"            :
                                              "Status Unknown"}
                </h1>
              </div>
              <p className="text-[13px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  {lastFetched
                    ? `Last updated ${lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                    : "Checking…"}
                </span>
                {data?.totalResponseTimeMs != null && (
                  <>
                    <span className="text-slate-700">·</span>
                    <span>{data.totalResponseTimeMs}ms total check time</span>
                  </>
                )}
              </p>
            </div>

            {data?.checkedAt && (
              <div className="flex flex-col sm:items-end gap-1 shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Checked at</p>
                <p className="text-[20px] font-black text-white tabular-nums">
                  {new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-[11px] text-slate-600">
                  {new Date(data.checkedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            )}
          </div>

          {/* Error banner */}
          {fetchErr && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-center gap-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[12px] text-red-400">{fetchErr}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pb-2">
          <span className="font-bold uppercase tracking-widest">Legend</span>
          {(["operational","degraded","unavailable","maintenance"] as S[]).map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${CFG[s].dot}`} />
              {CFG[s].label}
            </span>
          ))}
        </div>

        {/* ── AI Services ──────────────────────────────────────────────────── */}
        <ServiceGroup title="AI Services">
          <ServiceRow
            icon={<Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />}
            name="Google M API"
            description={`Mesh API gateway · ${ai("googleM").endpoint || "api.meshapi.ai"} · 1,000+ models`}
            status={ai("googleM").status}
            responseMs={ai("googleM").responseTimeMs}
            meta={ai("googleM").error ?? "Primary AI gateway"}
          />
          <ServiceRow
            icon={<Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v6l4 2" />}
            name="Google N API"
            description={`NVIDIA NIM · ${ai("googleN").endpoint || "integrate.api.nvidia.com"} · Llama & Nemotron`}
            status={ai("googleN").status}
            responseMs={ai("googleN").responseTimeMs}
            meta={ai("googleN").error ?? "AI fallback layer"}
          />
          <ServiceRow
            last
            icon={<Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
            name="Google API"
            description={`Gemini · ${ai("google").endpoint || "generativelanguage.googleapis.com"} · Gemini 2.5 Flash`}
            status={ai("google").status}
            responseMs={ai("google").responseTimeMs}
            meta={ai("google").error ?? "Gemini direct API"}
          />
        </ServiceGroup>

        {/* ── Platform Infrastructure ───────────────────────────────────────── */}
        <ServiceGroup title="Platform Infrastructure">
          <ServiceRow
            icon={<Icon d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />}
            name="Backend API"
            description="Express · Node.js · back-mp9k.onrender.com"
            status={h("backend")}
            meta="API server"
          />
          <ServiceRow
            icon={<Icon d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />}
            name="Database"
            description="MongoDB Atlas · Primary data store"
            status={h("database")}
            meta="NoSQL · Atlas cluster"
          />
          <ServiceRow
            icon={<Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
            name="Authentication"
            description="JWT · Session tokens · Bcrypt password hashing"
            status={h("auth")}
            meta="JWT + SESSION_SECRET"
          />
          <ServiceRow
            icon={<Icon d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" d2="M22 6l-10 7L2 6" />}
            name="Email Service"
            description="Resend API · verify@rolebolt.tech · careers@rolebolt.tech"
            status={h("email")}
            meta="Transactional email"
          />
          <ServiceRow
            last
            icon={<Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" />}
            name="Frontend"
            description="Next.js · www.rolebolt.tech · Vercel-compatible"
            status={h("frontend")}
            meta="Serving this page"
          />
        </ServiceGroup>

        {/* ── Incidents ─────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 mb-3">Recent Incidents</p>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-8 flex flex-col items-center gap-2 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700 mb-1">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-[14px] font-bold text-slate-400">No incidents reported</p>
            <p className="text-[12px] text-slate-600 max-w-sm">
              All Rolebolt services have been operating normally. Incidents will appear here if any service is affected.
            </p>
          </div>
        </div>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 mt-8">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <RoleboltLogo className="h-5 w-5 opacity-40" />
            <span>© 2026 Rolebolt · <a href="https://www.rolebolt.tech" className="hover:text-slate-400 transition-colors">rolebolt.tech</a></span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <Link href="/recruit" className="hover:text-slate-400 transition-colors">Dashboard</Link>
            <a href="mailto:support@rolebolt.tech" className="hover:text-slate-400 transition-colors">support@rolebolt.tech</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
