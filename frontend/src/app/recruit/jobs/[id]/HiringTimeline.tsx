"use client";

import { useMemo, useState } from "react";
import type { CandidateStage } from "./jobDetailTypes";

type TimelineCandidate = {
  _id: string;
  name: string;
  email?: string;
  stage: CandidateStage | string;
  createdAt?: string;
  stageMovedAt?: string;
  totalScore: number;
  maxScore: number;
  scoringFailed?: boolean;
  aiSummary?: string;
  assessmentStatus?: string;
  assessmentSentAt?: string;
  assessmentCompletedAt?: string;
  hiringDecision?: string | null;
  agentLog?: Array<{
    action: string;
    score?: number;
    reason?: string;
    emailSent?: boolean;
    emailStatus?: string;
    timestamp?: string;
  }>;
  emailLog?: Array<{ type: string; subject?: string; status?: string; sentAt?: string }>;
  offerLog?: Array<{ action: string; note?: string; timestamp?: string }>;
  offerStatus?: string;
  offerCandidateStatus?: string;
  pipelineRuleState?: Record<string, string>;
  aiHiringSynthesis?: {
    recommendation?: "hire" | "hold" | "pass";
    executiveSummary?: string;
    keyReasons?: string[];
    suggestedNextStep?: string;
    generatedAt?: string;
    recruiterDecision?: "accepted" | "overridden" | "ignored";
    recruiterDecisionNote?: string;
    recruiterDecisionAt?: string;
  };
  inTalentPool?: boolean;
  interviewFeedback?: Array<{
    body?: string;
    rating?: number;
    ratings?: Record<string, number>;
    author?: { name?: string };
    createdAt?: string;
  }>;
};

export type HiringTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: "intake" | "score" | "agent" | "rule" | "assessment" | "email" | "offer" | "ai" | "decision" | "other";
};

function pct(c: TimelineCandidate): number | null {
  if (c.scoringFailed || !(c.maxScore > 0)) return null;
  return Math.round((c.totalScore / c.maxScore) * 100);
}

export function buildHiringTimeline(c: TimelineCandidate): HiringTimelineEvent[] {
  const events: HiringTimelineEvent[] = [];
  const created = c.createdAt || new Date().toISOString();

  events.push({
    id: "applied",
    at: created,
    title: "Application received",
    detail: `${c.name}${c.email ? ` · ${c.email}` : ""} entered the pipeline.`,
    kind: "intake",
  });

  const scorePct = pct(c);
  if (c.scoringFailed) {
    events.push({
      id: "score-fail",
      at: created,
      title: "AI scoring failed",
      detail: "Resume could not be scored. Retry scoring before acting on thresholds.",
      kind: "score",
    });
  } else if (scorePct !== null) {
    events.push({
      id: "score",
      at: created,
      title: `Resume scored ${scorePct}%`,
      detail: c.aiSummary?.slice(0, 180) || `${c.totalScore}/${c.maxScore} points against the rubric.`,
      kind: "score",
    });
  }

  for (const [i, entry] of (c.agentLog ?? []).entries()) {
    const actionLabel =
      entry.action === "shortlisted" ? "Agent shortlisted"
        : entry.action === "rejected" ? "Agent rejected"
          : entry.action === "review_zone" ? "Agent placed in Review Zone"
            : `Agent: ${entry.action}`;
    events.push({
      id: `agent-${i}`,
      at: entry.timestamp || created,
      title: actionLabel,
      detail: [
        entry.reason,
        entry.emailStatus ? `Email: ${entry.emailStatus}` : null,
      ].filter(Boolean).join(" · ") || `Score ${entry.score ?? "—"}%`,
      kind: "agent",
    });
  }

  if (c.assessmentSentAt || c.assessmentStatus === "sent" || c.assessmentStatus === "invited" || c.assessmentStatus === "completed") {
    events.push({
      id: "assess-sent",
      at: c.assessmentSentAt || created,
      title: "Assessment sent",
      detail: "AI assessment link issued to candidate.",
      kind: "assessment",
    });
  }
  if (c.assessmentCompletedAt || c.assessmentStatus === "completed") {
    events.push({
      id: "assess-done",
      at: c.assessmentCompletedAt || created,
      title: "Assessment completed",
      detail: c.hiringDecision
        ? `Hiring decision signal: ${c.hiringDecision.replace("_", " ")}`
        : "Answers evaluated by AI.",
      kind: "assessment",
    });
  }

  for (const [i, fb] of (c.interviewFeedback ?? []).entries()) {
    const author = fb.author?.name ? `${fb.author.name}: ` : "";
    const ratingBits: string[] = [];
    if (typeof fb.rating === "number") ratingBits.push(`overall ${fb.rating}/5`);
    if (fb.ratings && Object.keys(fb.ratings).length > 0) {
      ratingBits.push(
        Object.entries(fb.ratings)
          .slice(0, 4)
          .map(([k, v]) => `${k} ${v}`)
          .join(", "),
      );
    }
    events.push({
      id: `interview-fb-${i}`,
      at: fb.createdAt || c.stageMovedAt || created,
      title: "Interview feedback submitted",
      detail: `${author}${fb.body?.slice(0, 220) || "Feedback recorded."}${ratingBits.length ? ` · ${ratingBits.join(" · ")}` : ""}`,
      kind: "other",
    });
  }

  for (const [ruleId, marker] of Object.entries(c.pipelineRuleState ?? {})) {
    events.push({
      id: `rule-${ruleId}`,
      at: c.stageMovedAt || created,
      title: "Pipeline rule satisfied",
      detail: `Rule ${ruleId.slice(0, 8)}… · marker ${marker}`,
      kind: "rule",
    });
  }

  for (const [i, e] of (c.emailLog ?? []).entries()) {
    if (!e.sentAt) continue;
    events.push({
      id: `email-${i}`,
      at: e.sentAt,
      title: `Email · ${e.type}`,
      detail: `${e.subject || "No subject"} · ${e.status || "sent"}`,
      kind: "email",
    });
  }

  for (const [i, o] of (c.offerLog ?? []).entries()) {
    events.push({
      id: `offer-${i}`,
      at: o.timestamp || created,
      title: `Offer · ${o.action}`,
      detail: o.note || `Status: ${c.offerCandidateStatus || c.offerStatus || "—"}`,
      kind: "offer",
    });
  }

  const syn = c.aiHiringSynthesis;
  if (syn?.recommendation) {
    events.push({
      id: "ai-syn",
      at: syn.generatedAt || created,
      title: `AI hiring recommendation: ${syn.recommendation.toUpperCase()}`,
      detail: syn.executiveSummary?.slice(0, 200)
        || (syn.keyReasons?.slice(0, 2).join("; ") || syn.suggestedNextStep || "Synthesis generated."),
      kind: "ai",
    });
  }
  if (syn?.recruiterDecision) {
    events.push({
      id: "decision",
      at: syn.recruiterDecisionAt || created,
      title: `Recruiter ${syn.recruiterDecision} AI recommendation`,
      detail: syn.recruiterDecisionNote || `Final human decision on AI ${syn.recommendation || "recommendation"}.`,
      kind: "decision",
    });
  }

  if (c.inTalentPool) {
    events.push({
      id: "pool",
      at: c.stageMovedAt || created,
      title: "Added to Talent Pool",
      detail: "Flagged for cross-job reuse.",
      kind: "other",
    });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return events;
}

export function hiringDecisionRecordText(c: TimelineCandidate, jobTitle?: string): string {
  const events = buildHiringTimeline(c);
  const scorePct = pct(c);
  const lines = [
    "HIRING DECISION RECORD",
    `Candidate: ${c.name}${c.email ? ` <${c.email}>` : ""}`,
    jobTitle ? `Job: ${jobTitle}` : null,
    `Current stage: ${c.stage}`,
    `Resume score: ${c.scoringFailed ? "FAILED" : `${scorePct}% (${c.totalScore}/${c.maxScore})`}`,
    c.aiHiringSynthesis?.recommendation
      ? `AI recommendation: ${c.aiHiringSynthesis.recommendation}`
      : null,
    c.aiHiringSynthesis?.recruiterDecision
      ? `Recruiter decision: ${c.aiHiringSynthesis.recruiterDecision}${c.aiHiringSynthesis.recruiterDecisionNote ? ` — ${c.aiHiringSynthesis.recruiterDecisionNote}` : ""}`
      : null,
    "",
    "TIMELINE",
    ...events.map(e => `- [${new Date(e.at).toISOString()}] ${e.title}: ${e.detail}`),
    "",
    `Exported: ${new Date().toISOString()}`,
  ].filter(line => line !== null) as string[];
  return lines.join("\n");
}

const KIND_COLOR: Record<HiringTimelineEvent["kind"], string> = {
  intake: "bg-slate-400",
  score: "bg-indigo-500",
  agent: "bg-violet-500",
  rule: "bg-sky-500",
  assessment: "bg-amber-500",
  email: "bg-emerald-500",
  offer: "bg-teal-500",
  ai: "bg-fuchsia-500",
  decision: "bg-rose-500",
  other: "bg-slate-300",
};

export default function HiringTimeline({
  candidate,
  jobTitle,
  compact = false,
}: {
  candidate: TimelineCandidate;
  jobTitle?: string;
  compact?: boolean;
}) {
  const events = useMemo(() => buildHiringTimeline(candidate), [candidate]);
  const [copied, setCopied] = useState(false);

  function exportRecord() {
    const text = hiringDecisionRecordText(candidate, jobTitle);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hiring-record-${candidate.name.replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyRecord() {
    try {
      await navigator.clipboard.writeText(hiringDecisionRecordText(candidate, jobTitle));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div className={compact ? "space-y-3" : "rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Hiring Timeline</p>
          <p className="text-[11px] text-[var(--text-muted)]">Score → Agent → Rules → Assessment → Interview feedback → AI → Decision</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={copyRecord} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)]">
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={exportRecord} className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-700">
            Export record
          </button>
        </div>
      </div>

      <ol className="relative space-y-0 border-l border-[var(--border)] ml-2 pl-4">
        {events.map(e => (
          <li key={e.id} className="relative pb-4 last:pb-0">
            <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-muted)] ${KIND_COLOR[e.kind]}`} />
            <p className="text-xs font-semibold text-[var(--foreground)]">{e.title}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)] leading-4">{e.detail}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]/80">
              {new Date(e.at).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
