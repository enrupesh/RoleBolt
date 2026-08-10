"use client";

import { useMemo, useState, useEffect } from "react";
import { apiUrl, readApiJson } from "@/lib/api";
import type { AgentMode } from "./jobDetailTypes";
import {
  simulateCandidateScore,
  zoneFor,
  currentPct,
  type RubricCriteria,
  type SimCandidate,
  type Zone,
} from "@/lib/whatIfSimulation";

export type { RubricCriteria };

export default function WhatIfSimulator({
  jobId,
  token,
  rubric,
  agentMode,
  candidates,
  onRubricApplied,
  onAgentModeUpdate,
  onRescoreComplete,
}: {
  jobId: string;
  token: string;
  rubric: RubricCriteria[];
  agentMode?: AgentMode;
  candidates: SimCandidate[];
  onRubricApplied: (rubric: RubricCriteria[]) => void;
  onAgentModeUpdate: (mode: AgentMode) => void;
  onRescoreComplete: () => void;
}) {
  const am = agentMode ?? {
    enabled: false,
    shortlistThreshold: 75,
    rejectThreshold: 40,
    autoEmailShortlist: true,
    autoEmailReject: false,
    autoSendAssessment: false,
    emailReviewZoneCandidates: false,
  };

  const [open, setOpen] = useState(false);
  const [draftRubric, setDraftRubric] = useState<RubricCriteria[]>(rubric);
  const [shortlist, setShortlist] = useState(am.shortlistThreshold);
  const [reject, setReject] = useState(am.rejectThreshold);
  const [saving, setSaving] = useState<"idle" | "thresholds" | "rubric" | "rescore">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftRubric(rubric);
  }, [rubric]);

  useEffect(() => {
    setShortlist(am.shortlistThreshold);
    setReject(am.rejectThreshold);
  }, [am.shortlistThreshold, am.rejectThreshold]);

  const scoredPool = useMemo(
    () => candidates.filter(c => !["hired", "rejected"].includes(c.stage)),
    [candidates],
  );

  const projection = useMemo(() => {
    let before = { shortlist: 0, review: 0, reject: 0, unscored: 0 };
    let after = { shortlist: 0, review: 0, reject: 0, unscored: 0 };
    const movers: Array<{
      id: string;
      name: string;
      from: Zone;
      to: Zone;
      beforePct: number | null;
      afterPct: number | null;
    }> = [];

    for (const c of scoredPool) {
      const beforePct = currentPct(c);
      const sim = simulateCandidateScore(c, draftRubric);
      const afterPct = sim?.pct ?? beforePct;
      const from = zoneFor(beforePct, am.shortlistThreshold, am.rejectThreshold);
      const to = zoneFor(afterPct, shortlist, reject);
      before[from]++;
      after[to]++;
      if (from !== to) {
        movers.push({
          id: c._id,
          name: c.name,
          from,
          to,
          beforePct,
          afterPct,
        });
      }
    }

    return { before, after, movers, total: scoredPool.length };
  }, [scoredPool, draftRubric, shortlist, reject, am.shortlistThreshold, am.rejectThreshold]);

  const dirtyRubric = JSON.stringify(draftRubric.map(r => ({ n: r.name, w: r.weight })))
    !== JSON.stringify(rubric.map(r => ({ n: r.name, w: r.weight })));
  const dirtyThresholds = shortlist !== am.shortlistThreshold || reject !== am.rejectThreshold;

  function reset() {
    setDraftRubric(rubric);
    setShortlist(am.shortlistThreshold);
    setReject(am.rejectThreshold);
    setMessage(null);
    setError(null);
  }

  async function applyThresholds() {
    setSaving("thresholds");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shortlistThreshold: shortlist, rejectThreshold: reject }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to update thresholds.");
      onAgentModeUpdate(data.agentMode);
      setMessage("Agent thresholds updated. New applicants will use these zones.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save thresholds.");
    } finally {
      setSaving("idle");
    }
  }

  async function applyRubric(andRescore: boolean) {
    setSaving(andRescore ? "rescore" : "rubric");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rubric: draftRubric }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to update rubric.");
      onRubricApplied(data.job?.rubric ?? draftRubric);

      if (dirtyThresholds) {
        const tRes = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ shortlistThreshold: shortlist, rejectThreshold: reject }),
        });
        const tData = await readApiJson(tRes);
        if (tRes.ok && tData.agentMode) onAgentModeUpdate(tData.agentMode);
      }

      if (!andRescore) {
        setMessage("Rubric weights saved. Existing scores are unchanged until you re-score.");
        return;
      }

      const early = candidates.filter(c =>
        ["applied", "review_zone", "screened", "rejected"].includes(c.stage) && !c.scoringFailed && (c.scoreBreakdown?.length ?? 0) > 0,
      );
      let ok = 0;
      let fail = 0;
      for (const c of early) {
        try {
          const r = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}/retry-score`), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r.ok) ok++;
          else fail++;
        } catch {
          fail++;
        }
      }
      onRescoreComplete();
      setMessage(
        `Rubric applied. Re-scored ${ok} candidate${ok !== 1 ? "s" : ""} in early stages${fail ? ` · ${fail} failed` : ""}.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to apply changes.");
    } finally {
      setSaving("idle");
    }
  }

  const ZONE_LABEL: Record<Zone, string> = {
    shortlist: "Shortlist",
    review: "Review",
    reject: "Reject",
    unscored: "Unscored",
  };

  return (
    <div className="rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.07] to-violet-500/[0.04] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
            <span>What-If Simulator</span>
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Unique</span>
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Preview how changing rubric weights or thresholds would reshuffle your current pipeline — before you apply anything.
          </p>
        </div>
        <svg
          className={`shrink-0 text-indigo-500 transition-transform ${open ? "rotate-180" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-indigo-500/15 px-5 py-5 space-y-5">
          {/* Thresholds */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Shortlist if ≥</label>
                <span className="text-sm font-bold text-emerald-600">{shortlist}%</span>
              </div>
              <input type="range" min={50} max={95} step={5} value={shortlist}
                onChange={e => setShortlist(Number(e.target.value))}
                className="w-full accent-emerald-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Reject if &lt;</label>
                <span className="text-sm font-bold text-rose-600">{reject}%</span>
              </div>
              <input type="range" min={10} max={60} step={5} value={reject}
                onChange={e => setReject(Number(e.target.value))}
                className="w-full accent-rose-500" />
            </div>
          </div>

          {/* Rubric weight sliders */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Rubric weights</p>
            {draftRubric.map((r, i) => (
              <div key={r.name + i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-[var(--foreground)] truncate">{r.name}</p>
                  <span className="text-xs font-bold text-indigo-600 shrink-0">{r.weight} pts</span>
                </div>
                <input
                  type="range" min={5} max={50} step={1} value={r.weight}
                  onChange={e => {
                    const w = Number(e.target.value);
                    setDraftRubric(prev => prev.map((x, idx) => idx === i ? { ...x, weight: w } : x));
                  }}
                  className="w-full accent-indigo-500"
                />
                <p className="mt-1 text-[10px] text-[var(--text-muted)] line-clamp-1">{r.description}</p>
              </div>
            ))}
            <p className="text-[11px] text-[var(--text-muted)]">
              Total weight: <strong className="text-[var(--foreground)]">{draftRubric.reduce((s, r) => s + r.weight, 0)}</strong> pts
              {" · "}Simulation reuses each candidate&apos;s existing criterion scores (no AI call until you re-score).
            </p>
          </div>

          {/* Funnel projection */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-bold text-[var(--foreground)] mb-3">
              Pipeline projection · {projection.total} active candidate{projection.total !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["shortlist", "review", "reject", "unscored"] as Zone[]).map(z => {
                const delta = projection.after[z] - projection.before[z];
                return (
                  <div key={z} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{ZONE_LABEL[z]}</p>
                    <p className="text-lg font-bold text-[var(--foreground)]">
                      {projection.after[z]}
                      <span className="ml-1 text-[11px] font-semibold text-[var(--text-muted)]">
                        was {projection.before[z]}
                      </span>
                    </p>
                    {delta !== 0 && (
                      <p className={`text-[11px] font-bold ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {delta > 0 ? "+" : ""}{delta}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {projection.movers.length > 0 ? (
              <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Who would move ({projection.movers.length})
                </p>
                {projection.movers.slice(0, 12).map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="truncate font-medium text-[var(--foreground)]">{m.name}</span>
                    <span className="shrink-0 text-[var(--text-muted)]">
                      {ZONE_LABEL[m.from]} ({m.beforePct ?? "—"}%) → {ZONE_LABEL[m.to]} ({m.afterPct ?? "—"}%)
                    </span>
                  </div>
                ))}
                {projection.movers.length > 12 && (
                  <p className="text-[10px] text-[var(--text-muted)]">+{projection.movers.length - 12} more</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--text-muted)]">No zone changes with current settings.</p>
            )}
          </div>

          {message && (
            <p className="text-xs text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">{message}</p>
          )}
          {error && (
            <p className="text-xs text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving !== "idle" || !dirtyThresholds}
              onClick={applyThresholds}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:border-indigo-500/40 disabled:opacity-40 transition"
            >
              {saving === "thresholds" ? "Saving…" : "Apply thresholds only"}
            </button>
            <button
              type="button"
              disabled={saving !== "idle" || (!dirtyRubric && !dirtyThresholds)}
              onClick={() => applyRubric(false)}
              className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-500/15 disabled:opacity-40 transition"
            >
              {saving === "rubric" ? "Saving…" : "Apply rubric weights"}
            </button>
            <button
              type="button"
              disabled={saving !== "idle" || (!dirtyRubric && !dirtyThresholds)}
              onClick={() => applyRubric(true)}
              className="rounded-xl bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-40 transition"
            >
              {saving === "rescore" ? "Re-scoring…" : "Apply & re-score early stages"}
            </button>
            <button
              type="button"
              disabled={saving !== "idle"}
              onClick={reset}
              className="rounded-xl px-3.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)] transition"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
