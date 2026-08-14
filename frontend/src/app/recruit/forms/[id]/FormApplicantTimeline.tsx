"use client";

import { useMemo, useState } from "react";
import type { FormStage } from "@/lib/formTypes";

type TimelineResponse = {
  _id: string;
  submittedName?: string;
  submittedEmail?: string;
  stage: FormStage | string;
  createdAt?: string;
  stageMovedAt?: string;
  aiScore?: number;
  scoringFailed?: boolean;
  aiSummary?: string;
  assessmentStatus?: string;
  assessmentSentAt?: string;
  assessmentCompletedAt?: string;
  assessmentScore?: number;
  agentLog?: Array<{
    action: string;
    score?: number;
    reason?: string;
    emailSent?: boolean;
    emailStatus?: string;
    timestamp?: string;
  }>;
  emailLog?: Array<{ type: string; subject?: string; status?: string; sentAt?: string }>;
  stageHistory?: Array<{
    fromStage: string;
    toStage: string;
    actor: string;
    reason?: string;
    timestamp: string;
  }>;
};

export type FormTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: "intake" | "score" | "agent" | "stage" | "assessment" | "email" | "other";
};

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  scored: "Scored",
  review_zone: "Review",
  shortlisted: "Shortlisted",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function buildFormApplicantTimeline(r: TimelineResponse): FormTimelineEvent[] {
  const events: FormTimelineEvent[] = [];
  const name = r.submittedName || "Applicant";
  const created = r.createdAt || new Date().toISOString();

  events.push({
    id: "applied",
    at: created,
    title: "Application received",
    detail: `${name}${r.submittedEmail ? ` · ${r.submittedEmail}` : ""}`,
    kind: "intake",
  });

  if (r.scoringFailed) {
    events.push({
      id: "score-fail",
      at: created,
      title: "AI scoring unavailable",
      detail: "Retry scoring before acting on score thresholds.",
      kind: "score",
    });
  } else if (typeof r.aiScore === "number" && r.aiScore > 0) {
    events.push({
      id: "score",
      at: created,
      title: `Scored ${r.aiScore}%`,
      detail: r.aiSummary?.slice(0, 160) || "AI reviewed application responses.",
      kind: "score",
    });
  }

  for (const [i, entry] of (r.agentLog ?? []).entries()) {
    const actionLabel =
      entry.action === "shortlisted" ? "AI shortlisted"
      : entry.action === "rejected" ? "AI rejected"
      : entry.action === "review_zone" ? "AI moved to review"
      : `AI: ${entry.action}`;
    events.push({
      id: `agent-${i}`,
      at: entry.timestamp || created,
      title: actionLabel,
      detail: [entry.reason, entry.emailSent ? `Email ${entry.emailStatus}` : ""].filter(Boolean).join(" · "),
      kind: "agent",
    });
  }

  for (const [i, h] of (r.stageHistory ?? []).entries()) {
    if (!h.toStage || h.toStage === "new") continue;
    const actor =
      h.actor === "recruiter" ? "You"
      : h.actor === "agent" ? "AI Agent"
      : h.actor === "rule" ? "Automation rule"
      : "System";
    events.push({
      id: `stage-${i}`,
      at: h.timestamp,
      title: `Moved to ${STAGE_LABELS[h.toStage] || h.toStage}`,
      detail: [actor, h.reason].filter(Boolean).join(" · "),
      kind: "stage",
    });
  }

  if (r.assessmentSentAt) {
    events.push({
      id: "assess-sent",
      at: r.assessmentSentAt,
      title: "Assessment sent",
      detail: "Written assessment link emailed to applicant.",
      kind: "assessment",
    });
  }
  if (r.assessmentCompletedAt) {
    events.push({
      id: "assess-done",
      at: r.assessmentCompletedAt,
      title: "Assessment completed",
      detail: typeof r.assessmentScore === "number" ? `Score: ${r.assessmentScore}%` : "Awaiting review.",
      kind: "assessment",
    });
  }

  for (const [i, e] of (r.emailLog ?? []).entries()) {
    events.push({
      id: `email-${i}`,
      at: e.sentAt || created,
      title: e.type.replace(/_/g, " "),
      detail: [e.subject, e.status === "failed" ? "Failed to send" : "Sent"].filter(Boolean).join(" · "),
      kind: "email",
    });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export default function FormApplicantTimeline({ response }: { response: TimelineResponse }) {
  const [open, setOpen] = useState(false);
  const events = useMemo(() => buildFormApplicantTimeline(response), [response]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition"
      >
        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Timeline ({events.length})
        <span className="text-[9px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        events.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-slate-400 pl-1">No activity yet.</p>
        ) : (
          <ol className="mt-2 space-y-0 border-l-2 border-slate-100 ml-1 pl-4">
            {events.map(ev => (
              <li key={ev.id} className="relative pb-3 last:pb-0">
                <span className={`absolute -left-[1.3rem] top-1 h-2 w-2 rounded-full ${
                  ev.kind === "email" ? "bg-indigo-400"
                  : ev.kind === "agent" ? "bg-violet-400"
                  : ev.kind === "assessment" ? "bg-cyan-400"
                  : ev.kind === "score" ? "bg-amber-400"
                  : "bg-slate-300"
                }`} />
                <p className="text-[11px] font-semibold text-slate-700">{ev.title}</p>
                <p className="text-[10px] text-slate-500 leading-4">{ev.detail}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {new Date(ev.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
