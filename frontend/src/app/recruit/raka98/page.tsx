"use client";

import { useState, useEffect, useCallback } from "react";

const ADMIN_PASSWORD = "raka@9800";

// ─── Types ─────────────────────────────────────────────────────────────────────

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
    geminiMesh:    Provider;
    geminiPrimary: Provider;
    nvidia:        Provider;
  };
  features: Feature[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
  if (id === "geminiMesh")    return "Mesh API Gateway";
  if (id === "geminiPrimary") return "Gemini Direct";
  if (id === "nvidia")        return "NVIDIA NIM API";
  return id ?? "—";
}
function providerColor(id: string | null) {
  if (id === "geminiMesh")    return "text-blue-400";
  if (id === "geminiPrimary") return "text-indigo-400";
  if (id === "nvidia")        return "text-green-400";
  return "text-white/50";
}
function shortModel(m: string) {
  return m.split("/").pop() ?? m;
}

// ─── Dot ───────────────────────────────────────────────────────────────────────

function Dot({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span className={`relative flex ${dim} shrink-0`}>
      {status === "operational" && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60`} />
      )}
      <span className={`relative inline-flex rounded-full ${dim} ${statusColor(status)}`} />
    </span>
  );
}

// ─── Fallback Alert Cards (shown when any provider is in fallback) ──────────────

function FallbackAlerts({ data }: { data: RoutingData }) {
  const alerts: { providerName: string; affectedCount: number; nvidiaModel: string }[] = [];

  if (data.providers.geminiMesh.routingState === "fallback-nvidia") {
    const count = data.features.filter(f => f.primaryProvider === "geminiMesh" && f.inFallback).length;
    const nModel = data.providers.nvidia.activeModel ?? data.providers.nvidia.primaryModel;
    alerts.push({ providerName: "Mesh API Gateway", affectedCount: count, nvidiaModel: nModel });
  }
  if (data.providers.geminiPrimary.routingState === "fallback-nvidia") {
    const count = data.features.filter(f => f.primaryProvider === "geminiPrimary" && f.inFallback).length;
    const nModel = data.providers.nvidia.activeModel ?? data.providers.nvidia.primaryModel;
    alerts.push({ providerName: "Google Gemini Direct", affectedCount: count, nvidiaModel: nModel });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <div key={alert.providerName}
          className="rounded-xl border border-amber-500/30 bg-amber-500/6 px-5 py-4 flex items-start gap-4">
          <div className="mt-0.5 text-amber-400 text-lg shrink-0">⚡</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-400 text-sm">
              {alert.providerName} is unavailable — Automatic fallback active
            </div>
            <div className="text-amber-300/70 text-xs mt-1 leading-relaxed">
              {alert.affectedCount > 0 && (
                <><span className="font-medium text-amber-300">{alert.affectedCount} feature{alert.affectedCount !== 1 ? "s" : ""}</span> ha{alert.affectedCount !== 1 ? "ve" : "s"} automatically rerouted to </>
              )}
              <span className="font-medium text-green-400">NVIDIA API</span>.
              {" "}Currently serving via:{" "}
              <span className="font-mono text-white/80 bg-white/8 px-1.5 py-0.5 rounded text-[11px]">
                {alert.nvidiaModel}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Model Chain Stepper ───────────────────────────────────────────────────────

function ModelChainStepper({
  primaryModel,
  fallbackModels,
  activeModel,
  ultimateFallback,
  providerDown,
}: {
  primaryModel: string;
  fallbackModels: string[];
  activeModel: string | null;
  ultimateFallback: string | null;
  providerDown: boolean;
}) {
  const chain = [primaryModel, ...fallbackModels];
  const activeShort = activeModel
    ? activeModel.replace(" (via NVIDIA fallback)", "")
    : null;

  return (
    <div className="mt-3">
      <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Model Chain</div>
      <div className="flex items-center gap-1 flex-wrap">
        {chain.map((m, i) => {
          const short = shortModel(m);
          const isActive = activeShort && (shortModel(activeShort) === short || activeShort === m);
          const isStruckOut = providerDown;
          return (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/15 text-[10px]">›</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono transition-all ${
                isActive && !providerDown
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold"
                  : isStruckOut
                  ? "bg-red-500/8 text-red-400/50 border-red-500/15 line-through opacity-60"
                  : "bg-white/4 text-white/35 border-white/8"
              }`}>
                {short}
              </span>
            </div>
          );
        })}
        {ultimateFallback && (
          <>
            <span className="text-white/15 text-[10px]">›</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${
              providerDown && activeModel && activeModel.includes("via NVIDIA")
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30 font-semibold"
                : "bg-orange-500/8 text-orange-400/60 border-orange-500/15"
            }`}>
              NVIDIA fallback
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Provider Card ─────────────────────────────────────────────────────────────

function ProviderCard({
  provId,
  prov,
  expanded,
  onToggle,
  data,
}: {
  provId: string;
  prov: Provider;
  expanded: boolean;
  onToggle: () => void;
  data: RoutingData;
}) {
  const isFallback   = prov.routingState === "fallback-nvidia";
  const isUnavail    = prov.status === "unavailable";
  const nvidiaActive = isFallback && data.providers.nvidia.activeModel;

  // Features that primarily use this provider
  const usedBy = data.features.filter(f => f.primaryProvider === provId);
  const usedByFallback = data.features.filter(
    f => f.primaryProvider !== provId && (f.fallbackChain.length > 0 || f.ultimateFallback === provId)
  );
  void usedByFallback; // referenced for future use

  const cleanActiveModel = prov.activeModel
    ? prov.activeModel.replace(" (via NVIDIA fallback)", "")
    : null;

  return (
    <div className={`rounded-xl border transition-colors ${
      isFallback   ? "border-amber-500/25 bg-amber-500/3" :
      isUnavail    ? "border-red-500/20 bg-red-500/3" :
                     "border-white/8 bg-white/2"
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5"><Dot status={prov.status} size="lg" /></div>
          <div className="flex-1 min-w-0">

            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white/90">{prov.label}</span>
              <span className="text-xs text-white/30">{prov.sublabel}</span>
              <span className="text-[10px] font-mono text-white/25">{prov.endpoint}</span>
              {isFallback && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">
                  ⚡ Routing to NVIDIA
                </span>
              )}
              {!prov.keyConfigured && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/12 text-red-400 border border-red-500/20 font-medium">
                  No API key
                </span>
              )}
            </div>

            {/* Key metrics row */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Status</div>
                <div className={`text-xs font-semibold ${statusTextColor(prov.status)}`}>
                  {statusLabel(prov.status)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Latency</div>
                <div className="text-xs text-white/65">
                  {prov.keyConfigured && prov.responseTimeMs > 0 ? `${prov.responseTimeMs} ms` : "—"}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">
                  Active Model
                  {isFallback && <span className="text-amber-400 ml-1">· via NVIDIA</span>}
                </div>
                <div className={`text-xs font-mono font-medium truncate ${
                  isFallback ? "text-amber-400" :
                  isUnavail  ? "text-red-400/60" :
                               "text-emerald-400"
                }`} title={cleanActiveModel ?? "—"}>
                  {isFallback && nvidiaActive
                    ? shortModel(data.providers.nvidia.activeModel!)
                    : cleanActiveModel
                    ? shortModel(cleanActiveModel)
                    : "—"}
                </div>
                {isFallback && nvidiaActive && (
                  <div className="text-[10px] text-white/30 font-mono mt-0.5 truncate">
                    {data.providers.nvidia.activeModel}
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {prov.error && (
              <div className="mt-2 text-[11px] text-red-400/80 font-mono bg-red-500/8 rounded px-2 py-1">
                {prov.error}
              </div>
            )}

            {/* Model chain stepper */}
            <ModelChainStepper
              primaryModel={prov.primaryModel}
              fallbackModels={prov.fallbackModels}
              activeModel={isFallback ? data.providers.nvidia.activeModel : prov.activeModel}
              ultimateFallback={prov.ultimateFallback}
              providerDown={isUnavail}
            />

            {/* Features using this provider */}
            {usedBy.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">
                  Primary Provider For ({usedBy.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {usedBy.map(f => (
                    <span key={f.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      f.inFallback
                        ? "bg-amber-500/8 text-amber-400/60 border-amber-500/15 line-through"
                        : "bg-white/4 text-white/45 border-white/8"
                    }`}>
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Full Model Registry</div>
          <div className="space-y-2">
            {prov.modelRegistry.map((m) => {
              const shortActive = cleanActiveModel ? shortModel(cleanActiveModel) : null;
              const isActiveNow = !isUnavail && (shortModel(m.id) === shortActive || m.id === cleanActiveModel);
              return (
                <div key={m.id} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ${
                  isActiveNow ? "bg-emerald-500/8 border border-emerald-500/15" : "border border-transparent"
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                      m.role === "primary"
                        ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/20"
                        : m.role.startsWith("fallback")
                        ? "bg-amber-500/12 text-amber-400 border-amber-500/20"
                        : "bg-white/5 text-white/35 border-white/8"
                    }`}>
                      {m.role === "primary" ? "Primary" : m.role.startsWith("fallback") ? m.role.replace("fallback-", "FB ") : "Available"}
                    </span>
                    <span className="text-xs text-white/70 font-mono truncate">{m.id}</span>
                    {isActiveNow && (
                      <span className="text-[10px] text-emerald-400 shrink-0">← active</span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/30 shrink-0">{m.provider}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Provider Usage Map ────────────────────────────────────────────────────────

function ProviderUsageMap({ features, providers }: { features: Feature[]; providers: RoutingData["providers"] }) {
  const providerIds = ["geminiMesh", "geminiPrimary", "nvidia"] as const;

  const provInfo: Record<string, { label: string; color: string; icon: string }> = {
    geminiMesh:    { label: "Mesh API Gateway",    color: "border-blue-500/25 bg-blue-500/4",    icon: "M" },
    geminiPrimary: { label: "Google Gemini Direct", color: "border-indigo-500/25 bg-indigo-500/4", icon: "G" },
    nvidia:        { label: "NVIDIA NIM API",       color: "border-green-500/25 bg-green-500/4",  icon: "N" },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {providerIds.map(pid => {
        const info = provInfo[pid];
        const primary   = features.filter(f => f.primaryProvider === pid);
        const fallback  = features.filter(f => f.ultimateFallback === pid && f.primaryProvider !== pid);
        const prov      = providers[pid];

        return (
          <div key={pid} className={`rounded-xl border p-4 ${info.color}`}>
            <div className="flex items-center gap-2 mb-3">
              <Dot status={prov.status} />
              <span className="text-xs font-semibold text-white/80">{info.label}</span>
            </div>

            {primary.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-white/35 uppercase tracking-wide mb-1.5">
                  Primary provider for
                </div>
                <div className="space-y-1">
                  {primary.map(f => (
                    <div key={f.id} className="flex items-center gap-1.5">
                      <span className={`w-1 h-1 rounded-full shrink-0 ${f.inFallback ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <span className="text-[11px] text-white/55">{f.label}</span>
                      {f.inFallback && <span className="text-[9px] text-amber-400">(fallback)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fallback.length > 0 && (
              <div>
                <div className="text-[10px] text-white/35 uppercase tracking-wide mb-1.5">
                  Ultimate fallback for
                </div>
                <div className="space-y-1">
                  {fallback.map(f => (
                    <div key={f.id} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full shrink-0 bg-orange-400/60" />
                      <span className="text-[11px] text-white/40">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {primary.length === 0 && fallback.length === 0 && (
              <div className="text-[11px] text-white/25 italic">No direct feature assignment</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Fallback Flow Diagram ─────────────────────────────────────────────────────

function FallbackFlowDiagram({ data }: { data: RoutingData }) {
  const { geminiMesh, geminiPrimary, nvidia } = data.providers;

  function ProvNode({ prov, label }: { prov: Provider; label: string }) {
    return (
      <div className={`rounded-lg border px-3 py-2 text-center min-w-[90px] ${
        prov.status === "unavailable" ? "border-red-500/30 bg-red-500/8" :
        prov.status === "degraded"    ? "border-amber-500/30 bg-amber-500/8" :
                                        "border-emerald-500/20 bg-emerald-500/6"
      }`}>
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <Dot status={prov.status} />
          <span className="text-[11px] font-medium text-white/80">{label}</span>
        </div>
        <div className={`text-[10px] ${statusTextColor(prov.status)}`}>{statusLabel(prov.status)}</div>
      </div>
    );
  }

  function Arrow({ active }: { active: boolean }) {
    return (
      <svg className={`w-4 h-4 shrink-0 ${active ? "text-amber-400" : "text-white/12"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    );
  }

  function ModelBox({ title, models, highlight }: { title: string; models: string[]; highlight?: boolean }) {
    return (
      <div className={`rounded-lg border px-3 py-2 text-center ${highlight ? "border-amber-500/25 bg-amber-500/6" : "border-white/8 bg-white/2"}`}>
        <div className={`text-[10px] mb-1 ${highlight ? "text-amber-400" : "text-indigo-400"}`}>{title}</div>
        {models.map((m, i) => (
          <div key={i} className="text-[10px] text-white/40 font-mono">{shortModel(m)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-5">
      {/* Most features: GoogleM → internal fallbacks → NVIDIA */}
      <div>
        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-3">
          Most Features (Resume Scoring, Copilot, Form Scoring, etc.)
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ProvNode prov={geminiMesh} label="Mesh API Gateway" />
          <Arrow active={geminiMesh.status !== "operational"} />
          <ModelBox
            title="Internal fallbacks"
            models={geminiMesh.fallbackModels}
            highlight={geminiMesh.status !== "operational"}
          />
          <Arrow active={geminiMesh.status !== "operational"} />
          <ProvNode prov={nvidia} label="NVIDIA NIM API" />
          {geminiMesh.status !== "operational" && nvidia.activeModel && (
            <div className="w-full mt-1 text-[10px] text-amber-400/70 pl-1">
              → Currently using NVIDIA:{" "}
              <span className="font-mono text-amber-300">{nvidia.activeModel}</span>
            </div>
          )}
        </div>
      </div>

      {/* JD generation: Google Gemini → gemini chain → NVIDIA */}
      <div className="border-t border-white/6 pt-4">
        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-3">
          Job Description Generation
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ProvNode prov={geminiPrimary} label="Gemini Direct" />
          <Arrow active={geminiPrimary.status !== "operational"} />
          <ModelBox
            title="Gemini chain"
            models={geminiPrimary.fallbackModels}
            highlight={geminiPrimary.status !== "operational"}
          />
          <Arrow active={geminiPrimary.status !== "operational"} />
          <ProvNode prov={nvidia} label="NVIDIA NIM API" />
          {geminiPrimary.status !== "operational" && nvidia.activeModel && (
            <div className="w-full mt-1 text-[10px] text-amber-400/70 pl-1">
              → Currently using NVIDIA:{" "}
              <span className="font-mono text-amber-300">{nvidia.activeModel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Feature Routing Table ─────────────────────────────────────────────────────

function FeatureRoutingTable({ features }: { features: Feature[] }) {
  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
        <span className="text-[10px] text-white/30 uppercase tracking-wide">Feature Routing — Live State</span>
        <span className="text-[10px] text-white/20">
          {features.filter(f => f.inFallback).length > 0
            ? `${features.filter(f => f.inFallback).length} in fallback`
            : "All normal"}
        </span>
      </div>
      <div className="divide-y divide-white/4">
        {features.map((f) => (
          <div key={f.id} className={`px-4 py-3 ${f.inFallback ? "bg-amber-500/2" : ""}`}>
            <div className="flex items-start gap-3 flex-wrap">
              {/* Feature name */}
              <div className="flex-1 min-w-[140px]">
                <div className="text-xs text-white/80 font-medium">{f.label}</div>
                <div className="text-[10px] text-white/30 mt-0.5 font-mono">{f.id}</div>
              </div>

              {/* Routing state */}
              <div className="flex items-center gap-4 flex-wrap text-[11px]">
                <div>
                  <span className="text-white/25">Primary: </span>
                  <span className={`font-medium ${f.inFallback ? "text-red-400/60 line-through" : providerColor(f.primaryProvider)}`}>
                    {providerKey(f.primaryProvider)}
                  </span>
                </div>
                {f.inFallback && (
                  <>
                    <span className="text-amber-400/40">→</span>
                    <div>
                      <span className="text-white/25">Active: </span>
                      <span className="font-medium text-amber-400">
                        {providerKey(f.activeProvider)}
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-white/25">Model: </span>
                  <span className="font-mono text-white/55">
                    {f.activeModel ? shortModel(f.activeModel.replace(" (via NVIDIA fallback)", "")) : "—"}
                  </span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  f.inFallback
                    ? "bg-amber-500/12 text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/8 text-emerald-400 border-emerald-500/15"
                }`}>
                  {f.inFallback ? "⚡ Fallback" : "✓ Normal"}
                </span>
              </div>
            </div>

            {/* Fallback chain pills */}
            {f.fallbackChain.length > 0 && (
              <div className="mt-2 flex items-center gap-1 flex-wrap pl-0">
                <span className="text-[9px] text-white/20 uppercase tracking-wide mr-1">Chain:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400/70 border border-indigo-500/15 font-mono">
                  {shortModel(f.primaryModel)}
                </span>
                {f.fallbackChain.map((m, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/4 text-white/30 border border-white/6 font-mono">
                    {shortModel(m)}
                  </span>
                ))}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/8 text-orange-400/60 border border-orange-500/12 font-mono">
                  NVIDIA
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow({ data }: { data: RoutingData }) {
  const { geminiMesh, geminiPrimary, nvidia } = data.providers;
  const providersUp = [geminiMesh, geminiPrimary, nvidia].filter(p => p.status !== "unavailable").length;
  const inFallback  = data.features.filter(f => f.inFallback).length;
  const nvidiaRole  = data.providers.geminiMesh.routingState === "fallback-nvidia" ||
                      data.providers.geminiPrimary.routingState === "fallback-nvidia"
    ? "Active Fallback"
    : "Standby";

  const stats = [
    { label: "Providers Online",     value: `${providersUp} / 3`,                    alert: providersUp < 3 },
    { label: "Features in Fallback", value: `${inFallback} / ${data.features.length}`, alert: inFallback > 0 },
    { label: "Mesh API Latency",     value: geminiMesh.keyConfigured    && geminiMesh.responseTimeMs    > 0 ? `${geminiMesh.responseTimeMs} ms`    : "—", alert: false },
    { label: "Gemini Direct Latency",value: geminiPrimary.keyConfigured && geminiPrimary.responseTimeMs > 0 ? `${geminiPrimary.responseTimeMs} ms` : "—", alert: false },
    { label: "NVIDIA Latency",       value: nvidia.keyConfigured        && nvidia.responseTimeMs        > 0 ? `${nvidia.responseTimeMs} ms`        : "—", alert: false },
    { label: "NVIDIA Role",          value: nvidiaRole,                               alert: nvidiaRole === "Active Fallback" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map(s => (
        <div key={s.label} className={`rounded-lg border px-4 py-3 ${s.alert ? "border-amber-500/20 bg-amber-500/4" : "border-white/8 bg-white/2"}`}>
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">{s.label}</div>
          <div className={`text-base font-semibold ${s.alert ? "text-amber-400" : "text-white/75"}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Routing Mode Banner ────────────────────────────────────────────────────────

function RoutingModeBanner({ data }: { data: RoutingData }) {
  const { routingMode } = data;
  const color = routingMode === "normal"   ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5"
              : routingMode === "degraded" ? "text-amber-400 border-amber-500/25 bg-amber-500/5"
              :                              "text-red-400 border-red-500/25 bg-red-500/5";
  const icon  = routingMode === "normal" ? "✓" : routingMode === "degraded" ? "⚡" : "✗";
  const title = routingMode === "normal"   ? "All Systems Normal"
              : routingMode === "degraded" ? "Degraded — Fallback Routing Active"
              :                              "Critical — Multiple Providers Down";
  const body  = routingMode === "normal"
    ? "All three AI providers are operational. Requests are routing through primary models."
    : routingMode === "degraded"
    ? "One or more providers are unavailable. Automatic fallback is active — review the alerts below."
    : "Multiple AI providers are unavailable. Service may be severely degraded. Check all providers.";

  return (
    <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${color}`}>
      <div className="text-xl shrink-0">{icon}</div>
      <div className="flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs opacity-70 mt-0.5">{body}</div>
      </div>
      <div className="text-xs opacity-40 shrink-0">
        {new Date(data.checkedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ─── Main Admin Page ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [input, setInput]   = useState("");
  const [error, setError]   = useState(false);
  const [authed, setAuthed] = useState(false);

  const [data, setData]           = useState<RoutingData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [countdown, setCountdown]   = useState(30);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const r    = await fetch("/api/ai-routing", { cache: "no-store" });
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
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [authed, fetchData]);

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

  // ── Login gate ─────────────────────────────────────────────────────────────
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
              autoComplete="current-password"
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

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0f]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-white/8 flex items-center justify-center">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <span>Updated {lastFetch} · {countdown}s</span>
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

        {fetchError && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-400">
            ⚠ Could not reach backend: {fetchError}
          </div>
        )}

        {loading && !data && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-white/3 border border-white/6 animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* 1 — Overall routing mode */}
            <RoutingModeBanner data={data} />

            {/* 2 — Fallback alerts (only shown when a provider is in fallback) */}
            <FallbackAlerts data={data} />

            {/* 3 — Stats */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-3">
                Infrastructure Summary
              </h2>
              <StatsRow data={data} />
            </section>

            {/* 4 — Provider cards with active model, chain, and where used */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-3">
                AI Providers — Live Status &amp; Active Models
              </h2>
              <div className="space-y-3">
                {(["geminiMesh", "geminiPrimary", "nvidia"] as const).map(key => (
                  <ProviderCard
                    key={key}
                    provId={key}
                    prov={data.providers[key]}
                    expanded={!!expandedProviders[key]}
                    onToggle={() => toggleProvider(key)}
                    data={data}
                  />
                ))}
              </div>
            </section>

            {/* 5 — Provider usage map */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-3">
                Where Each Provider Is Used
              </h2>
              <ProviderUsageMap features={data.features} providers={data.providers} />
            </section>

            {/* 6 — Fallback flow */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-3">
                Fallback Flow &amp; Routing Logic
              </h2>
              <FallbackFlowDiagram data={data} />
            </section>

            {/* 7 — Feature routing table */}
            <section>
              <h2 className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-3">
                Per-Feature Routing — Current State
              </h2>
              <FeatureRoutingTable features={data.features} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
