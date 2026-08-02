"use client";

import { useMemo, useState } from "react";
import type { FormStage } from "@/lib/formTypes";
import type { FormPageTab } from "@/lib/formTypes";

export type FormAttentionResponse = {
  _id: string;
  submittedName?: string;
  stage: FormStage;
  aiScore?: number;
  scoringFailed?: boolean;
  assessmentStatus?: string;
  assessmentSentAt?: string;
  assessmentCompletedAt?: string;
  stageMovedAt?: string;
  createdAt?: string;
  emailLog?: Array<{ type: string; sentAt?: string }>;
};

export type FormAttentionItem = {
  id: string;
  priority: number;
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  cta: string;
  responseId: string;
  tab?: FormPageTab;
};

function daysSince(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

export function buildFormAttentionItems(responses: FormAttentionResponse[]): FormAttentionItem[] {
  const items: FormAttentionItem[] = [];

  for (const r of responses) {
    const name = r.submittedName || "Applicant";

    if (r.scoringFailed && !["hired", "rejected", "withdrawn"].includes(r.stage)) {
      items.push({
        id: `score-${r._id}`,
        priority: 10,
        severity: "critical",
        title: `${name} — scoring failed`,
        detail: "Retry AI scoring before shortlisting or rejecting.",
        cta: "Review",
        responseId: r._id,
      });
    }

    if (
      r.aiScore !== undefined && r.aiScore >= 80 &&
      ["new", "scored", "review_zone"].includes(r.stage) &&
      !r.scoringFailed
    ) {
      items.push({
        id: `top-${r._id}`,
        priority: 15,
        severity: "high",
        title: `${name} — strong match (${r.aiScore}%)`,
        detail: "High AI score but still in early stage. Consider shortlisting.",
        cta: "Review",
        responseId: r._id,
      });
    }

    if (r.assessmentStatus === "completed" && ["assessment", "shortlisted", "review_zone"].includes(r.stage)) {
      const days = daysSince(r.assessmentCompletedAt);
      items.push({
        id: `assess-${r._id}`,
        priority: 12,
        severity: "high",
        title: `${name} — assessment done`,
        detail: days >= 1 ? `Completed ${Math.floor(days)}d ago. Advance or send update.` : "Review assessment and decide next step.",
        cta: "Review",
        responseId: r._id,
      });
    }

    if ((r.assessmentStatus === "sent" || r.assessmentStatus === "in_progress") && daysSince(r.assessmentSentAt) >= 3) {
      items.push({
        id: `assess-stale-${r._id}`,
        priority: 28,
        severity: "medium",
        title: `${name} — assessment pending`,
        detail: "Sent 3+ days ago with no completion. Follow up or move on.",
        cta: "Review",
        responseId: r._id,
      });
    }

    if (["shortlisted", "interview", "offer"].includes(r.stage) && daysSince(r.stageMovedAt || r.createdAt) >= 5) {
      const emails = r.emailLog?.length ?? 0;
      if (emails === 0) {
        items.push({
          id: `stale-${r._id}`,
          priority: 20,
          severity: "medium",
          title: `${name} — no email sent`,
          detail: `In ${r.stage.replace("_", " ")} for 5+ days without contacting applicant.`,
          cta: "Send email",
          responseId: r._id,
        });
      }
    }
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

export default function FormNeedsAttention({
  responses,
  onSelectResponse,
}: {
  responses: FormAttentionResponse[];
  onSelectResponse: (responseId: string) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const items = useMemo(() => buildFormAttentionItems(responses).filter(i => !dismissed.has(i.id)), [responses, dismissed]);

  if (items.length === 0) return null;

  const severityStyle = {
    critical: "border-rose-200 bg-rose-50/80",
    high: "border-amber-200 bg-amber-50/60",
    medium: "border-slate-200 bg-white",
  };

  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Needs attention</h2>
          <p className="text-[11px] text-slate-500">{items.length} item{items.length !== 1 ? "s" : ""} waiting on you</p>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${severityStyle[item.severity]}`}>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">{item.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-4">{item.detail}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => onSelectResponse(item.responseId)}
                className="rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
              >
                {item.cta}
              </button>
              <button
                type="button"
                onClick={() => setDismissed(prev => new Set(prev).add(item.id))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
