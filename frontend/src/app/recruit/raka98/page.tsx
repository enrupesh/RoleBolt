"use client";

import { useState, useEffect, useCallback } from "react";

const ADMIN_PASSWORD = "raka@9800";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  label: string;
  role: string;
  provider: string;
}

interface Provider {
  label: string;
  sublabel: string;
  endpoint: string;
  keyConfigured: boolean;
  status: "operational" | "degraded" | "unavailable";
  responseTimeMs: number;
  error?: string;
  primaryModel: string;
  fallbackModels: string[];
  ultimateFallback: string | null;
  activeModel: string | null;
  routingState: "normal" | "fallback-nvidia" | "unavailable";
  modelRegistry: ModelEntry[];
}

interface Feature {
  id: string;
  label: string;
  primaryProvider: string;
  primaryModel: string;
  fallbackChain: string[];
  ultimateFallback: string;
  activeProvider: string | null;
  activeModel: string | null;
  inFallback: boolean;
}

interface RoutingData {
  checkedAt: string;
  routingMode: "normal" | "degraded" | "critical";
  providers: {
    googleM: Provider;
    google: Provider;
    nvidia: Provider;
  };
  features: Feature[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === "operational") return "bg-emerald-500";
  if (s === "degraded")    return "bg-amber-400";
  return "bg-red-500";
}

function statusTextColor(s: string) {
  if (s === "operational") return "text-emerald-400";
  if (s === "degraded")    return "text-amber-400";
  return "text-red-400";
}

function statusLabel(s: string) {
  if (s === "operational") return "Operational";
  if (s === "degraded")    return "Degraded";
  return "Unavailable";
}

function providerKey(id: string | null) {
  if (id === "googleM") return "Google M API";
  if (id === "google")  return "Google API";
  if (id === "nvidia")  return "NVIDIA API";
  return id ?? "—";
}

function routingModeColor(mode: string) {
  if (mode === "normal")   return "text-emerald-400 border-emerald-500/30 bg-emerald-500/8";
  if (mode === "degraded") return "text-amber-400 border-amber-500/30 bg-amber-500/8";
  return "text-red-400 border-red-500/30 bg-red-500/8";
}

function routingModeLabel(mode: string) {
  if (mode === "normal")   return "All Systems Normal";
  if (mode === "degraded") return "Degraded — Fallback Active";
  return "Critical — Multiple Providers Down";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Dot({ status }: { status: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {status === "operational" && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColor(status)}`} />
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "primary")
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-medium">Primary</span>;
  if (role.startsWith("fallback"))
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-400 border border-amber-500/20 font-medium">Fallback</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8 font-medium">Available</span>;
}

function ProviderCard({
  provId,
  prov,
  expanded,
  onToggle,
}: {
  provId: string;
  prov: Provider;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isFallback = prov.routingState === "fallback-nvidia";

  return (
    <div className={`rounded-xl border transition-colors ${
      isFallback
        ? "border-amber-500/25 bg-amber-500/4"
        : prov.status === "unavailable"
        ? "border-red-500/20 bg-red-500/4"
        : "border-white/8 bg-white/3"
    }`}>
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Dot status={prov.status} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white/90">{prov.label}</span>
              <span className="text-xs text-white/35">{prov.sublabel}</span>
              {isFallback && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">
                  ⚡ Routing to NVIDIA fallback
                </span>
              )}
            </div>
            <div className="text-[11px] text-white/35 font-mono mt-0.5">{prov.endpoint}</div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">Status</div>
                <div className={`text-xs font-medium ${statusTextColor(prov.status)}`}>{statusLabel(prov.status)}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">Response</div>
                <div className="text-xs text-white/70">
                  {prov.keyConfigured
                    ? prov.responseTimeMs > 0 ? `${prov.responseTimeMs} ms` : "—"
                    : "No key"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">Active Model</div>
                <div className="text-xs text-white/70 truncate" title={prov.activeModel ?? "—"}>
                  {prov.activeModel
                    ? prov.activeModel.replace(" (via NVIDIA fallback)", "")
                    : "—"}
                </div>
              </div>
            </div>

            {prov.error && (
              <div className="mt-2 text-[11px] text-red-400/80 font-mono bg-red-500/8 rounded px-2 py-1">
                {prov.error}
              </div>
            )}

            {/* Fallback chain pills */}
            <div className="mt-3 flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-white/30 mr-1">Fallback chain:</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/12 text-indigo-400 border border-indigo-500/15 font-mono">
                {prov.primaryModel.split("/").pop()}
              </span>
              {prov.fallbackModels.map((m, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/8 font-mono">
                  {m.split("/").pop()}
                </span>
              ))}
              {prov.ultimateFallback && (
                <>
                  <span className="text-[10px] text-white/20">→</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/12 text-orange-400 border border-orange-500/15">
                    NVIDIA fallback
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onToggle}
            className="text-[11px] text-white/30 hover:text-white/60 transition-colors shrink-0 flex items-center gap-1 mt-0.5"
          >
            <span>{expanded ? "Hide" : "Models"}</span>
            <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded model registry */}
      {expanded && (
        <div className="border-t border-white/6 px-4 py-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Model Registry</div>
          <div className="space-y-1.5">
            {prov.modelRegistry.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <RoleBadge role={m.role} />
                  <span className="text-xs text-white/70 font-mono truncate">{m.id}</span>
                </div>
                <span className="text-[11px] text-white/30 shrink-0">{m.provider}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FallbackFlowDiagram({ data }: { data: RoutingData }) {
  const { googleM, google, nvidia } = data.providers;

  function ProvNode({ prov, label }: { prov: Provider; label: string }) {
    return (
      <div className={`rounded-lg border px-3 py-2 text-center min-w-[100px] ${
        prov.status === "unavailable" ? "border-red-500/30 bg-red-500/8" :
        prov.status === "degraded"    ? "border-amber-500/30 bg-amber-500/8" :
                                        "border-emerald-500/20 bg-emerald-500/6"
      }`}>
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <Dot status={prov.status} />
          <span className="text-xs font-medium text-white/80">{label}</span>
        </div>
        <div className={`text-[10px] ${statusTextColor(prov.status)}`}>{statusLabel(prov.status)}</div>
      </div>
    );
  }

  function Arrow({ active, label }: { active: boolean; label?: string }) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        {label && <span className="text-[9px] text-white/25 uppercase tracking-wide">{label}</span>}
        <svg className={`w-5 h-5 ${active ? "text-amber-400" : "text-white/15"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/2 p-4">
      <div className="text-[10px] text-white/30 uppercase tracking-wide mb-4">Fallback Chain — Most Features</div>
      <div className="flex items-center gap-2 flex-wrap">
        <ProvNode prov={googleM} label="Google M API" />
        <Arrow active={googleM.status === "unavailable"} label="if down" />
        <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-center">
          <div className="text-[10px] text-indigo-400 mb-0.5">Internal fallbacks</div>
          <div className="text-[10px] text-white/40 font-mono">claude-3-haiku</div>
          <div className="text-[10px] text-white/40 font-mono">gemini-2.5-flash-lite</div>
        </div>
        <Arrow active={googleM.status === "unavailable"} label="if all fail" />
        <ProvNode prov={nvidia} label="NVIDIA API" />
      </div>

      <div className="mt-4 border-t border-white/6 pt-4">
        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-3">Job Description Generation</div>
        <div className="flex items-center gap-2 flex-wrap">
          <ProvNode prov={google} label="Google API" />
          <Arrow active={google.status === "unavailable"} label="if down" />
          <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-center">
            <div className="text-[10px] text-indigo-400 mb-0.5">Gemini chain</div>
            <div className="text-[10px] text-white/40 font-mono">flash → flash-lite</div>
            <div className="text-[10px] text-white/40 font-mono">3.1 → 3.5 → 3.6</div>
          </div>
          <Arrow active={google.status === "unavailable"} label="if all fail" />
          <ProvNode prov={nvidia} label="NVIDIA API" />
        </div>
      </div>
    </div>
  );
}

function FeatureRoutingTable({ features, providers }: { features: Feature[]; providers: RoutingData["providers"] }) {
  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/6">
        <span className="text-[10px] text-white/30 uppercase tracking-wide">Feature Routing — Live State</span>
      </div>
      <div className="divide-y divide-white/4">
        {features.map((f) => (
          <div key={f.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <div className="text-xs text-white/80 font-medium">{f.label}</div>
            </div>

            {/* Primary provider */}
            <div className="flex items-center gap-1.5 min-w-[120px]">
              <span className="text-[10px] text-white/30">Primary:</span>
              <span className={`text-[11px] font-medium ${
                !f.inFallback ? "text-emerald-400" : "text-red-400 line-through opacity-50"
              }`}>
                {providerKey(f.primaryProvider)}
              </span>
            </div>

            {/* Active provider */}
            <div className="flex items-center gap-1.5 min-w-[120px]">
              <span className="text-[10px] text-white/30">Active:</span>
              <span className={`text-[11px] font-semibold ${
                f.activeProvider === f.primaryProvider ? "text-emerald-400" :
                f.activeProvider               ? "text-amber-400" :
                                                 "text-red-400"
              }`}>
                {f.activeProvider ? providerKey(f.activeProvider) : "Unavailable"}
              </span>
            </div>

            {/* Active model */}
            <div className="flex-1 min-w-[160px]">
              <span className="text-[10px] text-white/30">Model: </span>
              <span className="text-[11px] text-white/55 font-mono">
                {f.activeModel ? f.activeModel.replace(" (via NVIDIA fallback)", "") : "—"}
              </span>
            </div>

            {/* Fallback badge */}
            {f.inFallback && f.activeProvider && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-400 border border-amber-500/20 font-medium">
                ⚡ Fallback active
              </span>
            )}
            {!f.inFallback && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 font-medium">
                ✓ Normal
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main admin page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [input, setInput]   = useState("");
  const [error, setError]   = useState(false);
  const [authed, setAuthed] = useState(false);

  const [data, setData]       = useState<RoutingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const r = await fetch("/api/ai-routing", { cache: "no-store" });
      const json = await r.json();
      if (json.error) throw new Error(json.detail || json.error);
      setData(json);
      setLastFetch(new Date().toLocaleTimeString());
      setCountdown(30);
    } catch (e: any) {
      setFetchError(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [authed, fetchData]);

  // Countdown ticker
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1000);
    return () => clearInterval(t);
  }, [authed]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) { setAuthed(true); setError(false); }
    else { setError(true); setInput(""); }
  }

  function toggleProvider(key: string) {
    setExpandedProviders(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Login gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1a1a2e] border border-white/10 mb-4">
              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-white text-xl font-semibold tracking-tight">Admin Access</h1>
            <p className="text-white/40 text-sm mt-1">Enter password to continue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              placeholder="Password"
              autoFocus
              className={`w-full bg-[#111118] border ${error ? "border-red-500/60" : "border-white/10"} rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-white/30 transition-colors`}
            />
            {error && <p className="text-red-400 text-xs px-1">Incorrect password.</p>}
            <button type="submit" className="w-full bg-white text-black font-medium text-sm py-3 rounded-lg hover:bg-white/90 transition-colors">
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0f]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-white/80">Admin Panel</span>
          <span className="text-white/20">·</span>
          <span className="text-xs text-white/40">AI Infrastructure</span>
        </div>

        <div className="flex items-center gap-4">
          {lastFetch && (
            <div className="flex items-center gap-2 text-xs text-white/30">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span>Updated {lastFetch} · refreshes in {countdown}s</span>
            </div>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 disabled:opacity-40"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button onClick={() => setAuthed(false)} className="text-xs text-white/25 hover:text-white/50 transition-colors">
            Lock
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Error banner */}
        {fetchError && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-400">
            ⚠ Could not reach backend: {fetchError}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-white/3 border border-white/6 animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* ── Routing mode banner ────────────────────────────────────────── */}
            <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${routingModeColor(data.routingMode)}`}>
              <div className="text-xl">
                {data.routingMode === "normal" ? "✓" : data.routingMode === "degraded" ? "⚡" : "✗"}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{routingModeLabel(data.routingMode)}</div>
                <div className="text-xs opacity-70 mt-0.5">
                  {data.routingMode === "normal" && "All three AI providers are operational. Requests are routing through primary models."}
                  {data.routingMode === "degraded" && "One or more providers are down. Automatic fallback routing is active — see details below."}
                  {data.routingMode === "critical" && "Multiple AI providers are unavailable. Service may be severely degraded."}
                </div>
              </div>
              <div className="text-xs opacity-50 shrink-0">
                Checked {new Date(data.checkedAt).toLocaleTimeString()}
              </div>
            </div>

            {/* ── Provider cards ─────────────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                AI Providers — Live Status
              </h2>
              <div className="space-y-3">
                {(["googleM", "google", "nvidia"] as const).map(key => (
                  <ProviderCard
                    key={key}
                    provId={key}
                    prov={data.providers[key]}
                    expanded={!!expandedProviders[key]}
                    onToggle={() => toggleProvider(key)}
                  />
                ))}
              </div>
            </section>

            {/* ── Fallback flow diagram ───────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Fallback Flow
              </h2>
              <FallbackFlowDiagram data={data} />
            </section>

            {/* ── Feature routing table ───────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Feature Routing — Current State
              </h2>
              <FeatureRoutingTable features={data.features} providers={data.providers} />
            </section>

            {/* ── Summary stats ───────────────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Infrastructure Summary
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Providers Online", value: [data.providers.googleM, data.providers.google, data.providers.nvidia].filter(p => p.status !== "unavailable").length + " / 3" },
                  { label: "Features in Fallback", value: data.features.filter(f => f.inFallback).length + " / " + data.features.length },
                  { label: "Google M Latency", value: data.providers.googleM.keyConfigured && data.providers.googleM.responseTimeMs > 0 ? data.providers.googleM.responseTimeMs + " ms" : "—" },
                  { label: "NVIDIA Latency", value: data.providers.nvidia.keyConfigured && data.providers.nvidia.responseTimeMs > 0 ? data.providers.nvidia.responseTimeMs + " ms" : "—" },
                ].map(stat => (
                  <div key={stat.label} className="rounded-lg border border-white/8 bg-white/2 px-4 py-3">
                    <div className="text-[10px] text-white/35 uppercase tracking-wide mb-1">{stat.label}</div>
                    <div className="text-lg font-semibold text-white/80">{stat.value}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
