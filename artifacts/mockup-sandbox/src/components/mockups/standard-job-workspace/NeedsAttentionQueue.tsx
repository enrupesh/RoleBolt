import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

export type AttentionAction = { type: "pipeline" | "tab" | "autopilot"; candidateId?: string; stage?: string; tab?: string; section?: string };
export type AttentionItem = { id: string; priority: number; severity: "critical" | "high" | "medium"; title: string; detail: string; cta: string; action: AttentionAction; candidateId?: string };

type AttentionCandidate = {
  _id: string;
  name: string;
  stage: string;
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
  aiHiringSynthesis?: { recommendation?: "hire" | "hold" | "pass"; recruiterDecision?: "accepted" | "overridden" | "ignored" };
  agentLog?: Array<{ action: string; timestamp?: string }>;
};

function buildAttentionItems({ candidates }: { candidates: AttentionCandidate[] }): AttentionItem[] {
  return candidates.slice(0, 3).map((c, i) => ({
    id: c._id,
    priority: i + 1,
    severity: i === 0 ? "critical" : i === 1 ? "high" : "medium",
    title: `${c.name} needs review`,
    detail: c.scoringFailed ? "Scoring failed and needs a retry." : "Candidate requires recruiter attention.",
    cta: "Open",
    action: { type: "pipeline", candidateId: c._id, stage: c.stage },
    candidateId: c._id,
  }));
}

export default function NeedsAttentionQueue({
  candidates,
}: {
  candidates: AttentionCandidate[];
  perfAlerts: Array<{ id: string; type: string; message: string; aiSuggestions?: string[]; createdAt?: string; dismissed?: boolean }>;
  agentMode?: { enabled: boolean; shortlistThreshold?: number; rejectThreshold?: number; autoEmailShortlist?: boolean; autoEmailReject?: boolean; autoSendAssessment?: boolean; emailReviewZoneCandidates?: boolean };
  onAction: (action: AttentionAction, item: AttentionItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const items = useMemo(() => buildAttentionItems({ candidates }), [candidates]);
  if (items.length === 0) return null;
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.06]">
      <button type="button" onClick={() => setExpanded(v => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm">⚡</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--foreground)]">Needs attention <span className="ml-2 rounded-full bg-[var(--foreground)]/90 px-2 py-0.5 text-[10px] font-bold text-[var(--surface)]">{items.length}</span></p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">Items that need a recruiter decision today</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? <div className="divide-y divide-[var(--border)]/50 border-t border-[var(--border)]/60">{items.map(item => <div key={item.id} className="flex items-start gap-3 px-4 py-3"><span className="rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">{item.severity}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.title}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{item.detail}</p></div><button type="button" className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold">{item.cta} →</button></div>)}</div> : null}
    </div>
  );
}

export { buildAttentionItems };