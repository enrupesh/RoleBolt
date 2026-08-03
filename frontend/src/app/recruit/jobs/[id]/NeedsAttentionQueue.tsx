"use client";

import { useMemo, useState } from "react";
import type { CandidateStage, PerformanceAlert, AgentMode } from "./jobDetailTypes";

export type AttentionCandidate = {
  _id: string;
  name: string;
  stage: CandidateStage;
  totalScore: number;
  maxScore: number;
  scoringFailed?: boolean;
  assessmentStatus?: string;
  assessmentSentAt?: string;
  assessmentCompletedAt?: string;
  hiringDecision?: "strong_yes" | "maybe" | "no" | null;
  stageMovedAt?: string;
  createdAt?: string;
  offerStatus?: string;
  offerCandidateStatus?: string;
  offerDetails?: { offerExpiryDate?: string };
  aiHiringSynthesis?: {
    recommendation?: "hire" | "hold" | "pass";
    recruiterDecision?: "accepted" | "overridden" | "ignored";
  };
  agentLog?: Array<{ action: string; timestamp?: string }>;
};

export type AttentionAction =
  | { type: "pipeline"; candidateId?: string; stage?: CandidateStage | "all" }
  | { type: "tab"; tab: string; section?: string }
  | { type: "autopilot"; section?: "overview" | "agent" | "rules" | "health" | "log" };

export type AttentionItem = {
  id: string;
  priority: number; // lower = more urgent
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  cta: string;
  action: AttentionAction;
  candidateId?: string;
};

function daysSince(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function scorePct(c: AttentionCandidate): number {
  if (c.scoringFailed || !(c.maxScore > 0)) return 0;
  return Math.round((c.totalScore / c.maxScore) * 100);
}

export function buildAttentionItems(args: {
  candidates: AttentionCandidate[];
  perfAlerts: PerformanceAlert[];
  agentMode?: AgentMode;
}): AttentionItem[] {
  const { candidates, perfAlerts, agentMode } = args;
  const items: AttentionItem[] = [];
  const shortlist = agentMode?.shortlistThreshold ?? 75;
  const reject = agentMode?.rejectThreshold ?? 40;

  for (const alert of perfAlerts) {
    items.push({
      id: `health-${alert.id}`,
      priority: alert.type === "high_reject_rate" ? 15 : 20,
      severity: alert.type === "high_reject_rate" ? "high" : "medium",
      title: alert.type === "low_applications"
        ? "Low applications"
        : alert.type === "no_hire_14_days"
          ? "No hire in 14+ days"
          : "High rejection rate",
      detail: alert.message,
      cta: "Review health",
      action: { type: "autopilot", section: "health" },
    });
  }

  for (const c of candidates) {
    if (c.scoringFailed === true && !["hired", "rejected"].includes(c.stage)) {
      items.push({
        id: `score-fail-${c._id}`,
        priority: 10,
        severity: "critical",
        title: `${c.name} — scoring failed`,
        detail: "AI could not score this resume. Retry scoring before acting on the candidate.",
        cta: "Open candidate",
        action: { type: "pipeline", candidateId: c._id, stage: c.stage },
        candidateId: c._id,
      });
    }

    if (
      c.assessmentStatus === "completed" &&
      ["assessed", "screened"].includes(c.stage) &&
      (c.hiringDecision === "strong_yes" || c.hiringDecision === "maybe")
    ) {
      const days = daysSince(c.assessmentCompletedAt);
      items.push({
        id: `assess-done-${c._id}`,
        priority: c.hiringDecision === "strong_yes" ? 12 : 18,
        severity: c.hiringDecision === "strong_yes" ? "high" : "medium",
        title: `${c.name} — assessment ready`,
        detail: c.hiringDecision === "strong_yes"
          ? `Strong Yes${days >= 1 ? ` · completed ${Math.floor(days)}d ago` : ""}. Advance to interview or decide next step.`
          : `Maybe result${days >= 1 ? ` · completed ${Math.floor(days)}d ago` : ""}. Review and decide.`,
        cta: "Review",
        action: { type: "pipeline", candidateId: c._id, stage: c.stage },
        candidateId: c._id,
      });
    }

    if (c.assessmentStatus === "sent" || c.assessmentStatus === "invited") {
      items.push({
        id: `assess-stale-${c._id}`,
        priority: 25,
        severity: "medium",
        title: `${c.name} — assessment overdue`,
        detail: `Assessment sent ${Math.floor(daysSince(c.assessmentSentAt))} days ago with no completion.`,
        cta: "Follow up",
        action: { type: "pipeline", candidateId: c._id, stage: c.stage },
        candidateId: c._id,
      });
    }

    if (
      (c.stage === "offer" || c.offerStatus === "sent") &&
      (c.offerCandidateStatus === "pending" || c.offerCandidateStatus === "viewed")
    ) {
      const expiry = c.offerDetails?.offerExpiryDate;
      const daysToExpiry = expiry ? (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null;
      const urgent = daysToExpiry !== null && daysToExpiry <= 2;
      items.push({
        id: `offer-${c._id}`,
        priority: urgent ? 8 : 14,
        severity: urgent ? "critical" : "high",
        title: `${c.name} — offer awaiting response`,
        detail: urgent && daysToExpiry !== null
          ? `Offer expires in ${Math.max(0, Math.ceil(daysToExpiry))} day(s).`
          : c.offerCandidateStatus === "viewed"
            ? "Candidate viewed the offer but has not responded."
            : "Offer sent — waiting for candidate decision.",
        cta: "View offer",
        action: { type: "pipeline", candidateId: c._id, stage: "offer" },
        candidateId: c._id,
      });
    }

    const stageAge = daysSince(c.stageMovedAt || c.createdAt);
    // Explicit Review Zone stage OR legacy mid-score still sitting in Applied
    if (c.stage === "review_zone" && stageAge >= 3 && !c.scoringFailed) {
      const pct = scorePct(c);
      items.push({
        id: `stale-rz-${c._id}`,
        priority: 22,
        severity: "medium",
        title: `${c.name} — stuck in Review Zone`,
        detail: `${Math.floor(stageAge)} days awaiting a human decision${pct ? ` · score ${pct}%` : ""}.`,
        cta: "Review",
        action: { type: "pipeline", candidateId: c._id, stage: "review_zone" },
        candidateId: c._id,
      });
    } else if (c.stage === "applied" && stageAge >= 5 && !c.scoringFailed) {
      const pct = scorePct(c);
      const inReviewZone = pct >= reject && pct < shortlist;
      const latestAgent = [...(c.agentLog ?? [])].reverse().find(a => a.action);
      const isReviewZone = latestAgent?.action === "review_zone" || inReviewZone;
      items.push({
        id: `stale-${c._id}`,
        priority: isReviewZone ? 22 : 28,
        severity: "medium",
        title: `${c.name} — stuck in ${isReviewZone ? "review zone" : "Applied"}`,
        detail: `${Math.floor(stageAge)} days without a stage change${pct ? ` · score ${pct}%` : ""}.`,
        cta: "Review",
        action: { type: "pipeline", candidateId: c._id, stage: isReviewZone ? "review_zone" : "applied" },
        candidateId: c._id,
      });
    }

    if (
      c.aiHiringSynthesis?.recommendation &&
      !c.aiHiringSynthesis.recruiterDecision &&
      !["hired", "rejected"].includes(c.stage)
    ) {
      items.push({
        id: `ai-rec-${c._id}`,
        priority: c.aiHiringSynthesis.recommendation === "hire" ? 16 : 30,
        severity: c.aiHiringSynthesis.recommendation === "hire" ? "high" : "medium",
        title: `${c.name} — AI recommends ${c.aiHiringSynthesis.recommendation}`,
        detail: "Accept, override, or ignore the AI hiring recommendation.",
        cta: "Decide",
        action: { type: "tab", tab: "ai-hiring" },
        candidateId: c._id,
      });
    }
  }

  // Deduplicate by candidate keeping highest priority (lowest number) item per candidate for pipeline noise,
  // but keep all job-level health alerts. Cap at 8 items.
  items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

  const seenCandidates = new Set<string>();
  const capped: AttentionItem[] = [];
  for (const item of items) {
    if (item.candidateId) {
      if (seenCandidates.has(item.candidateId)) continue;
      // Allow scoring_failed + one other? Prefer first (highest priority) only.
      seenCandidates.add(item.candidateId);
    }
    capped.push(item);
    if (capped.length >= 8) break;
  }
  return capped;
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-rose-500/30",
    bg: "bg-rose-500/[0.06]",
    badge: "bg-rose-500 text-white",
    label: "Urgent",
  },
  high: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.06]",
    badge: "bg-amber-500 text-white",
    label: "High",
  },
  medium: {
    border: "border-sky-500/25",
    bg: "bg-sky-500/[0.05]",
    badge: "bg-sky-500/15 text-sky-700",
    label: "Soon",
  },
};

export default function NeedsAttentionQueue({
  candidates,
  perfAlerts,
  agentMode,
  onAction,
}: {
  candidates: AttentionCandidate[];
  perfAlerts: PerformanceAlert[];
  agentMode?: AgentMode;
  onAction: (action: AttentionAction, item: AttentionItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const items = useMemo(
    () => buildAttentionItems({ candidates, perfAlerts, agentMode }),
    [candidates, perfAlerts, agentMode],
  );

  if (items.length === 0) return null;

  const urgentCount = items.filter(i => i.severity === "critical" || i.severity === "high").length;

  return (
    <div className={`mb-6 overflow-hidden rounded-2xl border ${SEVERITY_STYLES[items[0].severity].border} ${SEVERITY_STYLES[items[0].severity].bg} shadow-[0_4px_14px_rgba(62,44,87,0.04)]`}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-amber-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3 2.8 20h18.4L12 3Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[var(--foreground)]">
              Needs attention
              <span className="ml-2 rounded-md bg-[var(--foreground)]/90 px-1.5 py-0.5 text-[10px] font-bold text-[var(--surface)]">
                {items.length}
              </span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              {urgentCount > 0
                ? `${urgentCount} high-priority decision${urgentCount !== 1 ? "s" : ""} waiting`
                : "Items that need a recruiter decision today"}
            </p>
          </div>
        </div>
        <svg
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)]/60 divide-y divide-[var(--border)]/50">
          {items.map(item => {
            const s = SEVERITY_STYLES[item.severity];
            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--surface)]/40 transition">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${s.badge}`}>
                  {s.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)] leading-4">{item.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onAction(item.action, item)}
                  className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--foreground)] transition hover:border-indigo-500/40 hover:text-indigo-600"
                >
                  {item.cta} →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
