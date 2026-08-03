"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { apiUrl, readApiJson } from "@/lib/api";
import {
  type AgentMode,
  type HiringMode,
  type PipelineRule,
  type PerformanceAlert,
  type CandidateStage,
  DEFAULT_AGENT_MODE,
} from "./jobDetailTypes";

// ─── Suggested rules for quick-setup wizard ───────────────────────────────────

const WIZARD_RULE_TEMPLATES: Array<{
  id: string;
  label: string;
  description: string;
  body: { condition: string; threshold: number; fromStage: string; action: string };
}> = [
  {
    id: "assessment",
    label: "Send assessment to shortlisted candidates",
    description: "When score ≥ 75% and candidate is Screened, auto-send the AI assessment.",
    body: { condition: "score_above", threshold: 75, fromStage: "screened", action: "send_assessment" },
  },
  {
    id: "interview",
    label: "Move strong assessments to Interview",
    description: "When assessment result is Strong Yes, advance to Interview stage.",
    body: { condition: "assessment_passed", threshold: 0, fromStage: "", action: "move_to_interview" },
  },
  {
    id: "stale",
    label: "Nudge after 5 days in Applied",
    description: "If a candidate sits in Applied for 5+ days, send an assessment reminder email.",
    body: { condition: "stage_age_days", threshold: 5, fromStage: "applied", action: "send_reminder" },
  },
];

export type HubSection = "overview" | "agent" | "rules" | "health" | "log";

type AgentStatsData = {
  shortlisted: number;
  rejected: number;
  reviewZone: number;
  emailsSent: number;
  avgScore: number | null;
  totalProcessed: number;
};

function deriveHiringMode(agentMode: AgentMode, enabledRulesCount: number): HiringMode {
  if (agentMode.enabled) return "autopilot";
  if (enabledRulesCount > 0) return "assisted";
  return "manual";
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
    </svg>
  );
}

// ─── Expanded agent settings (always visible in hub) ─────────────────────────

function AgentSettingsPanel({
  jobId,
  token,
  agentMode,
  onUpdate,
}: {
  jobId: string;
  token: string;
  agentMode: AgentMode;
  onUpdate: (mode: AgentMode) => void;
}) {
  const [local, setLocal] = useState<AgentMode>(agentMode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocal(agentMode);
  }, [agentMode]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(local),
      });
      const data = await readApiJson(res);
      if (res.ok && data.agentMode) {
        onUpdate(data.agentMode);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-[var(--foreground)]">Triage thresholds</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)] leading-5">
          When Autopilot is on, every new applicant is scored and sorted into zones below. Pipeline Rules run right after.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Shortlist if score ≥</label>
            <span className="text-sm font-bold text-emerald-600">{local.shortlistThreshold}%</span>
          </div>
          <input
            type="range" min={50} max={95} step={5}
            value={local.shortlistThreshold}
            onChange={e => setLocal(s => ({ ...s, shortlistThreshold: Number(e.target.value) }))}
            className="w-full accent-emerald-500"
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Reject if score &lt;</label>
            <span className="text-sm font-bold text-rose-600">{local.rejectThreshold}%</span>
          </div>
          <input
            type="range" min={10} max={60} step={5}
            value={local.rejectThreshold}
            onChange={e => setLocal(s => ({ ...s, rejectThreshold: Number(e.target.value) }))}
            className="w-full accent-rose-500"
          />
        </div>
      </div>

      <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Score zones</p>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="flex-1 rounded-l-full bg-rose-500/20 px-2 py-1 text-center text-rose-600 font-semibold">
            0–{local.rejectThreshold - 1}% Reject
          </span>
          <span className="flex-1 bg-amber-500/10 px-2 py-1 text-center text-amber-700 font-semibold">
            {local.rejectThreshold}–{local.shortlistThreshold - 1}% Review
          </span>
          <span className="flex-1 rounded-r-full bg-emerald-500/20 px-2 py-1 text-center text-emerald-700 font-semibold">
            {local.shortlistThreshold}%+ Shortlist
          </span>
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Automatic actions</p>
        {(
          [
            { key: "autoEmailShortlist" as const, label: "Email shortlisted candidates", hint: "Shortlist confirmation email" },
            { key: "autoEmailReject" as const, label: "Email rejected candidates", hint: "Polite rejection email" },
            { key: "emailReviewZoneCandidates" as const, label: "Email review-zone candidates", hint: "Under review notice" },
            { key: "autoSendAssessment" as const, label: "Auto-send assessment when shortlisted", hint: "Sends AI assessment immediately" },
          ]
        ).map(({ key, label, hint }) => (
          <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">{label}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>
            </div>
            <button
              type="button"
              onClick={() => setLocal(s => ({ ...s, [key]: !s[key] }))}
              className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                local[key] ? "bg-indigo-500" : "bg-gray-400/30"
              }`}
            >
              <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                local[key] ? "translate-x-4" : "translate-x-0.5"
              }`} />
            </button>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : "Save agent settings"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>}
      </div>
    </div>
  );
}

// ─── Quick setup wizard ───────────────────────────────────────────────────────

function SetupWizard({
  jobId,
  token,
  existingRules,
  onComplete,
  onAgentUpdate,
  onRulesChange,
}: {
  jobId: string;
  token: string;
  existingRules: PipelineRule[];
  onComplete: () => void;
  onAgentUpdate: (mode: AgentMode) => void;
  onRulesChange: (rules: PipelineRule[]) => void;
}) {
  const [step, setStep] = useState(0);
  const [selectedRules, setSelectedRules] = useState<Record<string, boolean>>({
    assessment: true,
    interview: true,
    stale: false,
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setRunning(true);
    setError(null);
    try {
      const agentRes = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...DEFAULT_AGENT_MODE,
          enabled: true,
          shortlistThreshold: 75,
          rejectThreshold: 40,
          autoEmailShortlist: true,
          autoSendAssessment: selectedRules.assessment,
        }),
      });
      const agentData = await readApiJson(agentRes);
      if (!agentRes.ok) throw new Error(agentData.error || "Failed to enable AI Agent.");
      onAgentUpdate(agentData.agentMode);

      const newRules = [...existingRules];
      for (const tpl of WIZARD_RULE_TEMPLATES) {
        if (!selectedRules[tpl.id]) continue;
        const duplicate = newRules.some(
          r => r.condition === tpl.body.condition && r.action === tpl.body.action && r.threshold === tpl.body.threshold,
        );
        if (duplicate) continue;
        const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/pipeline-rules`), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(tpl.body),
        });
        const data = await readApiJson(res);
        if (res.ok && data.rule) newRules.push(data.rule);
      }
      onRulesChange(newRules);
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Setup failed.");
    } finally {
      setRunning(false);
    }
  }

  if (step === 0) {
    return (
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-white">
            <BotIcon />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--foreground)]">Set up Hiring Autopilot</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-6 max-w-xl">
              Turn on AI triage and pipeline rules in under a minute. Autopilot scores every applicant, shortlists strong
              fits, rejects clear mismatches, and runs your rules — while you stay in control.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">1.</span> AI Agent triages new applicants by score</li>
              <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">2.</span> Pipeline Rules handle assessments, interviews, and reminders</li>
              <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">3.</span> Performance Monitor flags low apps or stalled pipelines</li>
            </ul>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-6 rounded-2xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition"
            >
              Start setup →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-indigo-500/30 bg-[var(--surface)] p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-[var(--foreground)]">Choose your default rules</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">You can edit or add more rules anytime. Agent will use 75% shortlist / 40% reject thresholds.</p>
      </div>
      <div className="space-y-3">
        {WIZARD_RULE_TEMPLATES.map(tpl => (
          <label
            key={tpl.id}
            className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition ${
              selectedRules[tpl.id] ? "border-indigo-500/40 bg-indigo-500/5" : "border-[var(--border)] bg-[var(--surface-muted)]"
            }`}
          >
            <input
              type="checkbox"
              checked={!!selectedRules[tpl.id]}
              onChange={() => setSelectedRules(s => ({ ...s, [tpl.id]: !s[tpl.id] }))}
              className="mt-1 accent-indigo-500"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{tpl.label}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-5">{tpl.description}</p>
            </div>
          </label>
        ))}
      </div>
      {error && (
        <p className="text-xs text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep(0)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]">
          Back
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={running}
          className="flex-1 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {running ? "Enabling Autopilot…" : "Enable Autopilot ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

export default function HiringAutopilotHub({
  jobId,
  token,
  agentMode,
  onAgentModeUpdate,
  pipelineRules,
  onRulesChange,
  perfAlerts,
  agentLogCount,
  initialSection = "overview",
  onGoToPipeline,
  rulesPanel,
  healthPanel,
  logPanel,
}: {
  jobId: string;
  token: string;
  agentMode: AgentMode;
  onAgentModeUpdate: (mode: AgentMode) => void;
  pipelineRules: PipelineRule[];
  onRulesChange: (rules: PipelineRule[]) => void;
  perfAlerts: PerformanceAlert[];
  agentLogCount: number;
  initialSection?: HubSection;
  onGoToPipeline: (stage: CandidateStage | "all") => void;
  rulesPanel: ReactNode;
  healthPanel: ReactNode;
  logPanel: ReactNode;
}) {
  const enabledRules = pipelineRules.filter(r => r.enabled !== false);
  const rulesFiredTotal = pipelineRules.reduce((sum, r) => sum + (r.triggerCount ?? 0), 0);
  const hiringMode = deriveHiringMode(agentMode, enabledRules.length);

  const [section, setSection] = useState<HubSection>(initialSection);
  const [showWizard, setShowWizard] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  const [stats, setStats] = useState<AgentStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const needsSetup = !agentMode.enabled && enabledRules.length === 0 && agentLogCount === 0;

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-stats?period=week`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (res.ok) setStats(data.stats ?? null);
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  }, [jobId, token]);

  useEffect(() => {
    loadStats();
  }, [loadStats, agentMode.enabled, agentLogCount]);

  async function applyHiringMode(mode: HiringMode) {
    setModeSaving(true);
    try {
      if (mode === "autopilot") {
        if (!agentMode.enabled && enabledRules.length === 0) {
          setShowWizard(true);
          return;
        }
        const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enabled: true }),
        });
        const data = await readApiJson(res);
        if (res.ok && data.agentMode) onAgentModeUpdate(data.agentMode);
      } else if (mode === "assisted") {
        if (agentMode.enabled) {
          const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ enabled: false }),
          });
          const data = await readApiJson(res);
          if (res.ok && data.agentMode) onAgentModeUpdate(data.agentMode);
        }
        if (enabledRules.length === 0) setSection("rules");
      } else {
        if (agentMode.enabled) {
          const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ enabled: false }),
          });
          const data = await readApiJson(res);
          if (res.ok && data.agentMode) onAgentModeUpdate(data.agentMode);
        }
      }
    } finally {
      setModeSaving(false);
    }
  }

  const MODE_CARDS: Array<{ id: HiringMode; title: string; subtitle: string; icon: string }> = [
    {
      id: "manual",
      title: "Manual",
      subtitle: "You score and move every candidate yourself.",
      icon: "👤",
    },
    {
      id: "assisted",
      title: "Assisted",
      subtitle: "AI scores and recommends — you decide every move.",
      icon: "✨",
    },
    {
      id: "autopilot",
      title: "Autopilot",
      subtitle: "Agent triages applicants + rules automate the pipeline.",
      icon: "🚀",
    },
  ];

  const SECTIONS: Array<{ id: HubSection; label: string; badge?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "agent", label: "Triage Agent" },
    { id: "rules", label: "Pipeline Rules", badge: enabledRules.length || undefined },
    { id: "health", label: "Job Health", badge: perfAlerts.length || undefined },
    { id: "log", label: "Activity Log", badge: agentLogCount || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-indigo-500"><BotIcon /></span>
          <h2 className="text-lg font-bold text-[var(--foreground)]">Hiring Autopilot</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)] max-w-2xl leading-6">
          One place to control how AI handles this job — triage on apply, automated pipeline steps, and health monitoring.
        </p>
      </div>

      {/* Setup wizard */}
      {(needsSetup || showWizard) && !agentMode.enabled && (
        <SetupWizard
          jobId={jobId}
          token={token}
          existingRules={pipelineRules}
          onComplete={() => { setShowWizard(false); loadStats(); }}
          onAgentUpdate={onAgentModeUpdate}
          onRulesChange={onRulesChange}
        />
      )}

      {/* Hiring mode selector */}
      {!showWizard && (
        <div className="grid gap-3 sm:grid-cols-3">
          {MODE_CARDS.map(card => {
            const active = hiringMode === card.id;
            return (
              <button
                key={card.id}
                type="button"
                disabled={modeSaving}
                onClick={() => applyHiringMode(card.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-indigo-500/50 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                    : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-indigo-500/30"
                }`}
              >
                <span className="text-2xl">{card.icon}</span>
                <p className="mt-2 text-sm font-bold text-[var(--foreground)]">{card.title}</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-4">{card.subtitle}</p>
                {active && (
                  <span className="mt-2 inline-block rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Status strip */}
      {!showWizard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Agent</p>
            <p className={`mt-1 text-sm font-bold ${agentMode.enabled ? "text-indigo-600" : "text-[var(--text-muted)]"}`}>
              {agentMode.enabled ? "On" : "Off"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Active rules</p>
            <p className="mt-1 text-sm font-bold text-[var(--foreground)]">{enabledRules.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Rules fired</p>
            <p className="mt-1 text-sm font-bold text-[var(--foreground)]">{rulesFiredTotal}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Health alerts</p>
            <p className={`mt-1 text-sm font-bold ${perfAlerts.length ? "text-amber-600" : "text-emerald-600"}`}>
              {perfAlerts.length ? `${perfAlerts.length} open` : "All clear"}
            </p>
          </div>
        </div>
      )}

      {/* How it works (overview quick ref) */}
      {!showWizard && section === "overview" && (
        <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-4">
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">How Autopilot works</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-900/80">
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium">① Applicant applies</span>
            <span>→</span>
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium">② AI scores resume</span>
            <span>→</span>
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium">③ Agent triages</span>
            <span>→</span>
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium">④ Rules fire</span>
            <span>→</span>
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium">⑤ You review edge cases</span>
          </div>
        </div>
      )}

      {/* Section nav */}
      {!showWizard && (
        <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto -mb-px">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm transition border-b-2 -mb-px flex items-center gap-1.5 ${
                section === s.id
                  ? "border-indigo-500 text-[var(--foreground)] font-medium"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {s.label}
              {s.badge !== undefined && s.badge > 0 && (
                <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Section content */}
      {!showWizard && section === "overview" && (
        <div className="space-y-5 pt-2">
          {agentMode.enabled && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <p className="text-sm font-bold text-[var(--foreground)] mb-3">This week&apos;s triage activity</p>
              {statsLoading ? (
                <div className="h-20 rounded-2xl rb-skeleton" />
              ) : stats && stats.totalProcessed > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button type="button" onClick={() => onGoToPipeline("screened")} className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-left hover:bg-emerald-500/10 transition">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Shortlisted</p>
                    <p className="text-xl font-bold text-emerald-600">{stats.shortlisted}</p>
                  </button>
                  <button type="button" onClick={() => onGoToPipeline("rejected")} className="rounded-2xl border border-rose-400/20 bg-rose-500/5 px-3 py-2 text-left hover:bg-rose-500/10 transition">
                    <p className="text-[10px] font-bold text-rose-600 uppercase">Rejected</p>
                    <p className="text-xl font-bold text-rose-600">{stats.rejected}</p>
                  </button>
                  <button type="button" onClick={() => onGoToPipeline("review_zone")} className="rounded-2xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-left hover:bg-amber-500/10 transition">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">In review</p>
                    <p className="text-xl font-bold text-amber-700">{stats.reviewZone}</p>
                  </button>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Emails sent</p>
                    <p className="text-xl font-bold text-[var(--foreground)]">{stats.emailsSent}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">No agent activity this week yet. Activity appears after applicants are scored.</p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setSection("agent")} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-indigo-500/30 transition">
              <p className="text-sm font-semibold text-[var(--foreground)]">Configure triage agent →</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Thresholds, emails, auto-assessment</p>
            </button>
            <button type="button" onClick={() => setSection("rules")} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-indigo-500/30 transition">
              <p className="text-sm font-semibold text-[var(--foreground)]">Manage pipeline rules →</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{enabledRules.length} active · {rulesFiredTotal} total fires</p>
            </button>
            <button type="button" onClick={() => setSection("health")} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-indigo-500/30 transition">
              <p className="text-sm font-semibold text-[var(--foreground)]">Check job health →</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{perfAlerts.length ? `${perfAlerts.length} alert(s) need attention` : "No issues detected"}</p>
            </button>
            <button type="button" onClick={() => setSection("log")} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-indigo-500/30 transition">
              <p className="text-sm font-semibold text-[var(--foreground)]">View activity log →</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{agentLogCount} agent action(s) recorded</p>
            </button>
          </div>

          {!agentMode.enabled && enabledRules.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-900 leading-5">
              <strong>Assisted mode:</strong> Pipeline Rules are active but the triage agent is off — candidates won&apos;t be auto-shortlisted or rejected on apply. Rules still run after scoring.
            </div>
          )}
        </div>
      )}

      {!showWizard && section === "agent" && (
        <div className="pt-2 space-y-4">
          {!agentMode.enabled && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-900">
              Agent is off — settings below apply when you enable Autopilot or turn the agent on from the header toggle.
            </div>
          )}
          <AgentSettingsPanel
            jobId={jobId}
            token={token}
            agentMode={agentMode}
            onUpdate={onAgentModeUpdate}
          />
        </div>
      )}

      {!showWizard && section === "rules" && <div className="pt-2">{rulesPanel}</div>}
      {!showWizard && section === "health" && <div className="pt-2">{healthPanel}</div>}
      {!showWizard && section === "log" && <div className="pt-2">{logPanel}</div>}
    </div>
  );
}
