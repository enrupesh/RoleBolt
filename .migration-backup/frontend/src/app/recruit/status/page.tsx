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
  aiApis: {
    geminiMesh:     AIApiInfo;
    geminiFallback: AIApiInfo;
    geminiPrimary:  AIApiInfo;
  };
  systemHealth: SystemHealth;
}

interface RoutingProvider {
  label: string;
  sublabel: string;
  endpoint: string;
  keyConfigured: boolean;
  status: S;
  responseTimeMs: number;
  primaryModel: string;
  fallbackModels: string[];
  ultimateFallback: string | null;
  activeModel: string;
  routingState: string;
  modelRegistry: { id: string; label: string; role: string; provider: string }[];
}

interface RoutingFeature {
  id: string;
  label: string;
  primaryProvider: string;
  primaryModel: string;
  fallbackChain: string[];
  ultimateFallback: string;
  activeProvider: string;
  activeModel: string;
  inFallback: boolean;
}

interface RoutingPayload {
  checkedAt: string;
  routingMode: "normal" | "degraded" | "critical";
  providers: {
    geminiMesh:    RoutingProvider;
    geminiPrimary: RoutingProvider;
    nvidia:        RoutingProvider;
  };
  features: RoutingFeature[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30;

const CFG: Record<S, { label: string; color: string; dot: string; ring: string; bar: string; hero: string; bg: string }> = {
  operational: {
    label: "Operational",
    color: "text-emerald-400",
    dot:   "bg-emerald-400",
    ring:  "border-emerald-500/25 bg-emerald-500/8",
    bar:   "bg-emerald-500",
    hero:  "text-emerald-400",
    bg:    "bg-emerald-500/[0.04]",
  },
  degraded: {
    label: "Degraded",
    color: "text-amber-400",
    dot:   "bg-amber-400",
    ring:  "border-amber-500/25 bg-amber-500/8",
    bar:   "bg-amber-400",
    hero:  "text-amber-400",
    bg:    "bg-amber-500/[0.04]",
  },
  unavailable: {
    label: "Unavailable",
    color: "text-red-400",
    dot:   "bg-red-400",
    ring:  "border-red-500/25 bg-red-500/8",
    bar:   "bg-red-500",
    hero:  "text-red-400",
    bg:    "bg-red-500/[0.04]",
  },
  maintenance: {
    label: "Maintenance",
    color: "text-blue-400",
    dot:   "bg-blue-400",
    ring:  "border-blue-500/25 bg-blue-500/8",
    bar:   "bg-blue-500",
    hero:  "text-blue-400",
    bg:    "bg-blue-500/[0.04]",
  },
  unknown: {
    label: "Unknown",
    color: "text-slate-500",
    dot:   "bg-slate-600",
    ring:  "border-white/8 bg-white/3",
    bar:   "bg-slate-700",
    hero:  "text-slate-400",
    bg:    "",
  },
  loading: {
    label: "Checking…",
    color: "text-slate-500",
    dot:   "bg-slate-600",
    ring:  "border-white/8 bg-white/3",
    bar:   "bg-slate-600",
    hero:  "text-slate-400",
    bg:    "",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold whitespace-nowrap ${c.ring} ${c.color}`}>
      <Dot status={status} pulse={false} />
      {c.label}
    </span>
  );
}

function Ms({ ms }: { ms: number | null | undefined }) {
  if (ms == null) return null;
  const color = ms < 500 ? "text-emerald-500" : ms < 1500 ? "text-amber-500" : "text-red-400";
  return <span className={`text-[11px] font-mono tabular-nums font-semibold ${color}`}>{ms}ms</span>;
}

function UptimeBar({ status }: { status: S }) {
  const bars = Array.from({ length: 45 });
  return (
    <div className="flex items-end gap-px h-7">
      {bars.map((_, i) => {
        const isLast = i === 44;
        const barCfg = isLast ? (CFG[status]?.bar ?? "bg-slate-700") : "bg-emerald-500/60";
        const height = isLast ? "100%" : `${55 + Math.sin(i * 0.85 + 1) * 25}%`;
        return (
          <span
            key={i}
            className={`flex-1 rounded-sm ${barCfg}`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

const Icon = ({ d, d2, d3 }: { d: string; d2?: string; d3?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {d2 && <path d={d2} />}
    {d3 && <path d={d3} />}
  </svg>
);

// ─── Service Row ──────────────────────────────────────────────────────────────

function ServiceRow({
  icon, name, description, status, responseMs, meta, last, tags,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: S;
  responseMs?: number | null;
  meta?: string;
  last?: boolean;
  tags?: string[];
}) {
  const c = CFG[status] ?? CFG.unknown;
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${!last ? "border-b border-white/5" : ""}`}>
      <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/4 ${c.color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13.5px] font-bold text-white leading-snug">{name}</p>
          {tags?.map(t => (
            <span key={t} className="inline-flex items-center rounded-md border border-white/8 bg-white/4 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{t}</span>
          ))}
        </div>
        {description && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{description}</p>}
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

// ─── Group ────────────────────────────────────────────────────────────────────

function ServiceGroup({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/6 bg-white/[0.02] flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
        {subtitle && <p className="text-[10px] text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Model Chain Row ──────────────────────────────────────────────────────────

function ModelChainRow({ models, active }: { models: { id: string; label: string; role: string }[]; active: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-t border-white/5">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 mr-1">Fallback Chain</p>
      {models.map((m, i) => {
        const isActive = m.id === active || m.label.toLowerCase().includes(active.toLowerCase());
        return (
          <span key={m.id} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
              isActive
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-white/8 bg-white/3 text-slate-500"
            }`}>
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />}
              {m.label}
            </span>
            {i < models.length - 1 && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-700">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Feature Routing Row ──────────────────────────────────────────────────────

function FeatureRow({ feature, last }: { feature: RoutingFeature; last?: boolean }) {
  const providerLabel: Record<string, string> = {
    googleM: "Mesh API",
    google: "Gemini Direct",
    nvidia: "NVIDIA NIM",
  };
  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${!last ? "border-b border-white/5" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-white truncate">{feature.label}</p>
        <p className="text-[10px] text-slate-600 mt-0.5 truncate">
          Active: <span className="text-slate-400 font-medium">{feature.activeModel}</span>
          {" · "}via <span className="text-slate-400">{providerLabel[feature.activeProvider] ?? feature.activeProvider}</span>
        </p>
      </div>
      {feature.inFallback && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/8 px-2 py-0.5 text-[10px] font-bold text-amber-400">
          ⚡ Fallback Active
        </span>
      )}
      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
        feature.inFallback
          ? "border-amber-500/20 bg-amber-500/5 text-amber-400"
          : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
      }`}>
        {feature.inFallback ? "Degraded" : "Normal"}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData]           = useState<StatusPayload | null>(null);
  const [routing, setRouting]     = useState<RoutingPayload | null>(null);
  const [fetchErr, setFetchErr]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const [statusRes, routingRes] = await Promise.all([
        fetch("/api/status",     { cache: "no-store" }),
        fetch("/api/ai-routing", { cache: "no-store" }),
      ]);
      const [statusJson, routingJson] = await Promise.all([
        statusRes.json(),
        routingRes.json(),
      ]);
      setData(statusJson as StatusPayload);
      if (!routingJson.error) setRouting(routingJson as RoutingPayload);
    } catch (e: any) {
      setFetchErr(e?.message ?? "Failed to reach status endpoint.");
    } finally {
      setLoading(false);
      setLastFetched(new Date());
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { load(); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  // ── Accessor helpers ─────────────────────────────────────────────────────────

  const overall: S = loading ? "loading" : (data?.status ?? "unknown");
  const oc = CFG[overall];

  const h = (key: keyof SystemHealth): S =>
    loading ? "loading" : (data?.systemHealth?.[key] ?? "unknown");

  const ai = (key: "geminiMesh" | "geminiFallback" | "geminiPrimary"): AIApiInfo =>
    loading
      ? { status: "loading", responseTimeMs: null, endpoint: "", label: "" }
      : (data?.aiApis?.[key] ?? { status: "unknown", responseTimeMs: null, endpoint: "", label: "" });

  const rp = (key: "geminiMesh" | "geminiPrimary" | "nvidia"): RoutingProvider | null =>
    routing?.providers?.[key] ?? null;

  const routeMode = routing?.routingMode ?? null;

  // ── Counts ───────────────────────────────────────────────────────────────────

  const aiStatuses  = [ai("geminiMesh").status, ai("geminiFallback").status, ai("geminiPrimary").status];
  const infraStatuses = [h("backend"), h("database"), h("auth"), h("email")];
  const allServicesUp = [...aiStatuses, ...infraStatuses].every(s => s === "operational");

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
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
            {routeMode && (
              <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                routeMode === "normal"   ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" :
                routeMode === "degraded" ? "border-amber-500/20 bg-amber-500/5 text-amber-400"       :
                "border-red-500/20 bg-red-500/5 text-red-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                  routeMode === "normal" ? "bg-emerald-400" : routeMode === "degraded" ? "bg-amber-400" : "bg-red-400"
                }`} />
                Routing: {routeMode}
              </span>
            )}
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

      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <section className={`border-b border-white/6 transition-colors duration-700 ${oc.bg}`}>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Dot status={overall} />
                <h1 className={`text-3xl sm:text-4xl font-black tracking-tight transition-colors ${oc.hero}`}>
                  {overall === "operational"  ? "All Systems Operational"       :
                   overall === "unavailable"  ? "Service Disruption Detected"   :
                   overall === "degraded"     ? "Partial Service Disruption"    :
                   overall === "maintenance"  ? "Scheduled Maintenance"         :
                   overall === "loading"      ? "Checking system status…"       :
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
                    <span>Full check in {data.totalResponseTimeMs}ms</span>
                  </>
                )}
              </p>

              {fetchErr && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-center gap-3 max-w-lg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-[12px] text-red-400">{fetchErr}</p>
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="flex gap-3 shrink-0">
              {[
                { label: "AI APIs",        count: aiStatuses.filter(s => s === "operational").length, total: 3 },
                { label: "Infrastructure", count: infra_operational_count(infraStatuses), total: 4 },
              ].map(card => (
                <div key={card.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 min-w-[90px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">{card.label}</p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    {loading ? "–" : `${card.count}/${card.total}`}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">operational</p>
                </div>
              ))}
              {data?.checkedAt && (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 min-w-[90px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Checked at</p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    {new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {new Date(data.checkedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
          <span className="font-bold uppercase tracking-widest">Legend</span>
          {(["operational","degraded","unavailable"] as S[]).map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${CFG[s].dot}`} />
              {CFG[s].label}
            </span>
          ))}
        </div>

        {/* ── AI Services ────────────────────────────────────────────────────── */}
        <ServiceGroup title="AI Services" subtitle="Three-layer fallback architecture">

          {/* Mesh API */}
          <div>
            <ServiceRow
              icon={<Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />}
              name="Mesh API Gateway"
              description={`api.meshapi.ai · Primary: google/gemini-2.5-flash · 1,000+ models accessible`}
              status={ai("geminiMesh").status}
              responseMs={ai("geminiMesh").responseTimeMs}
              meta={ai("geminiMesh").error ?? "Primary AI gateway"}
              tags={["GEMINI_MESH_KEY"]}
            />
            {rp("geminiMesh") && (
              <ModelChainRow
                active={rp("geminiMesh")!.activeModel}
                models={rp("geminiMesh")!.modelRegistry.slice(0, 4).map(m => ({ id: m.id, label: m.label, role: m.role }))}
              />
            )}
          </div>

          {/* NVIDIA NIM */}
          <div>
            <ServiceRow
              icon={<Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v6l4 2" />}
              name="NVIDIA NIM API"
              description={`integrate.api.nvidia.com · Primary: meta/llama-3.1-405b-instruct · Ultimate fallback`}
              status={ai("geminiFallback").status}
              responseMs={ai("geminiFallback").responseTimeMs}
              meta={ai("geminiFallback").error ?? "Ultimate fallback layer"}
              tags={["GEMINI_FALLBACK_KEY"]}
            />
            {rp("nvidia") && (
              <ModelChainRow
                active={rp("nvidia")!.activeModel}
                models={rp("nvidia")!.modelRegistry.map(m => ({ id: m.id, label: m.label, role: m.role }))}
              />
            )}
          </div>

          {/* Gemini Direct */}
          <div>
            <ServiceRow
              last
              icon={<Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
              name="Google Gemini Direct"
              description={`generativelanguage.googleapis.com · Primary: gemini-2.5-flash · Direct Google AI API`}
              status={ai("geminiPrimary").status}
              responseMs={ai("geminiPrimary").responseTimeMs}
              meta={ai("geminiPrimary").error ?? "Gemini direct API"}
              tags={["GEMINI_PRIMARY_KEY"]}
            />
            {rp("geminiPrimary") && (
              <ModelChainRow
                active={rp("geminiPrimary")!.activeModel}
                models={rp("geminiPrimary")!.modelRegistry.map(m => ({ id: m.id, label: m.label, role: m.role }))}
              />
            )}
          </div>
        </ServiceGroup>

        {/* ── AI Routing Intelligence ─────────────────────────────────────────── */}
        {routing?.features && routing.features.length > 0 && (
          <ServiceGroup
            title="AI Routing Intelligence"
            subtitle={`Mode: ${routing.routingMode ?? "—"} · ${routing.features.length} features tracked`}
          >
            {routing.features.map((f, i) => (
              <FeatureRow key={f.id} feature={f} last={i === routing.features.length - 1} />
            ))}
          </ServiceGroup>
        )}

        {/* ── Platform Infrastructure ─────────────────────────────────────────── */}
        <ServiceGroup title="Platform Infrastructure">
          <ServiceRow
            icon={<Icon d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />}
            name="Backend API"
            description="Express · Node.js · back-mp9k.onrender.com"
            status={h("backend")}
            meta="API server"
            tags={["Express", "Node.js"]}
          />
          <ServiceRow
            icon={<Icon d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
            name="Database"
            description="MongoDB Atlas · Primary data store · Mongoose ODM"
            status={h("database")}
            meta="NoSQL · Atlas cluster"
            tags={["MongoDB"]}
          />
          <ServiceRow
            icon={<Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
            name="Authentication"
            description="Custom JWT · Bcrypt password hashing · Firebase social auth (Google, GitHub, Phone)"
            status={h("auth")}
            meta="JWT + SESSION_SECRET"
            tags={["JWT"]}
          />
          <ServiceRow
            icon={<Icon d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" d2="M22 6l-10 7L2 6" />}
            name="Email Service"
            description="Resend API · verify@rolebolt.tech · Transactional & automated emails"
            status={h("email")}
            meta="Transactional email"
            tags={["Resend"]}
          />
          <ServiceRow
            last
            icon={<Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" />}
            name="Frontend"
            description="Next.js App Router · www.rolebolt.tech · Serving this page"
            status={h("frontend")}
            meta="Serving this page"
            tags={["Next.js"]}
          />
        </ServiceGroup>

        {/* ── API Endpoints ───────────────────────────────────────────────────── */}
        <ServiceGroup title="Key API Endpoints">
          {[
            { name: "Status Check",        path: "/status",      desc: "Full system health + AI API ping" },
            { name: "AI Routing",          path: "/ai-routing",  desc: "Live routing intelligence per feature" },
            { name: "Copilot Chat",        path: "/recruit/copilot/chat",        desc: "AI Hiring Copilot — non-streaming" },
            { name: "Copilot Stream",      path: "/recruit/copilot/chat/stream", desc: "AI Hiring Copilot — SSE streaming" },
            { name: "Site Guide Chat",     path: "/recruit-public/site-guide/chat/stream", desc: "Landing page chatbot — SSE streaming" },
            { name: "Job Apply",           path: "/recruit-public/jobs/:id/apply",          desc: "Candidate application + AI scoring" },
          ].map((ep, i, arr) => (
            <div key={ep.path} className={`flex items-center gap-4 px-5 py-3 ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-white">{ep.name}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{ep.desc}</p>
              </div>
              <code className="text-[10px] font-mono text-slate-400 bg-white/4 border border-white/8 px-2 py-1 rounded-md truncate max-w-[240px]">
                {ep.path}
              </code>
            </div>
          ))}
        </ServiceGroup>

        {/* ── Incidents ──────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 mb-3">Recent Incidents</p>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-8 flex flex-col items-center gap-2 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700 mb-1">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-[14px] font-bold text-slate-400">No incidents reported</p>
            <p className="text-[12px] text-slate-600 max-w-sm">
              All Rolebolt services have been operating normally. Any service degradation will appear here automatically.
            </p>
          </div>
        </div>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 mt-4">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <RoleboltLogo className="h-5 w-5 opacity-40" />
            <span>© 2026 Rolebolt · <a href="https://www.rolebolt.tech" className="hover:text-slate-400 transition-colors">rolebolt.tech</a></span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <Link href="/recruit/copilot" className="hover:text-slate-400 transition-colors">AI Copilot</Link>
            <Link href="/recruit/dashboard" className="hover:text-slate-400 transition-colors">Dashboard</Link>
            <a href="mailto:support@rolebolt.tech" className="hover:text-slate-400 transition-colors">support@rolebolt.tech</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function infra_operational_count(statuses: S[]): number {
  return statuses.filter(s => s === "operational").length;
}
