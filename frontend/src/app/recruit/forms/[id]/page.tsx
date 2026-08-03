"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import { apiErrorFromPayload, apiUrl, readApiJson } from "@/lib/api";
import { FORM_STAGE_FILTERS, matchesFormStageFilter, type FormPageTab, type FormStageFilter } from "@/lib/formTypes";
import { isFormStageEmailNotifyStage, type FormStageEmailNotifyStage } from "@/lib/formStageEmailTemplates";
import FormStageEmailFlow, { type FormEmailLogEntry } from "./FormStageEmailFlow";
import FormApplicantTimeline from "./FormApplicantTimeline";
import FormNeedsAttention from "./FormNeedsAttention";
import FormTabNav from "./FormTabNav";
import FormTopPicks from "./FormTopPicks";
import FormPostCreateChecklist, { markFormChecklistStep } from "@/components/FormPostCreateChecklist";
import FormCopilotDrawer from "./FormCopilotDrawer";
import { FormErrorNotice } from "@/components/FormErrorNotice";
import { CreatorEmailComposer, type CreatorEmailRecipient } from "@/components/CreatorEmailComposer";

type Stage =
  | "new"
  | "scored"
  | "review_zone"
  | "shortlisted"
  | "assessment"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

const STAGES: { id: Stage; label: string; color: string; bg: string }[] = [
  { id: "new", label: "New", color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
  { id: "scored", label: "Scored", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  { id: "review_zone", label: "Review zone", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  { id: "shortlisted", label: "Shortlisted", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  { id: "assessment", label: "Assessment", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  { id: "interview", label: "Interview", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  { id: "offer", label: "Offer", color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  { id: "hired", label: "Hired", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  { id: "rejected", label: "Rejected", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
  { id: "withdrawn", label: "Withdrawn", color: "text-slate-500", bg: "bg-slate-100 border-slate-300" },
];

type QuestionType =
  | "short" | "paragraph" | "number" | "email"
  | "phone" | "dropdown" | "multiple_choice" | "yes_no" | "file";

type FormQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  placeholder: string;
};

type Answer = { questionId: string; label: string; value: string };

type AnswerSignal = {
  questionId: string;
  signal: "strong" | "ok" | "thin";
  note: string;
};

type QuestionScore = {
  questionId: string;
  score: number; // 0-10
  strengths: string[];
  weaknesses: string[];
  feedback: string;
};

type EmailLogEntry = {
  type: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
};

type AgentAction = "shortlisted" | "rejected" | "review_zone";

type AgentLogEntry = {
  action: AgentAction;
  score: number;
  reason: string;
  emailSent: boolean;
  emailStatus: "sent" | "failed" | "skipped" | "disabled";
  timestamp: string;
};

type StageHistoryEntry = {
  fromStage: string;
  toStage: string;
  actor: "recruiter" | "agent" | "rule" | "system";
  actorUid?: string;
  reason?: string;
  timestamp: string;
};

type AgentMode = {
  enabled: boolean;
  shortlistThreshold: number;
  rejectThreshold: number;
  autoEmailShortlist: boolean;
  autoEmailReject: boolean;
  emailReviewZoneCandidates: boolean;
};

type RuleCondition = "score_above" | "score_below" | "stage_age_days";
type RuleAction =
  | "move_to_scored"
  | "move_to_review_zone"
  | "move_to_shortlisted"
  | "move_to_assessment"
  | "move_to_interview"
  | "move_to_offer"
  | "move_to_hired"
  | "move_to_withdrawn"
  | "move_to_rejected";

type PipelineRule = {
  id: string;
  condition: RuleCondition;
  threshold: number;
  fromStage?: string;
  action: RuleAction;
  enabled: boolean;
  triggerCount: number;
};

type FormResponse = {
  _id: string;
  formId: string;
  answers: Answer[];
  aiScore: number;
  aiSummary: string;
  strengths: string[];
  redFlags: string[];
  answerSignals: AnswerSignal[];
  questionScores: QuestionScore[];
  interviewQuestions: string[];
  scoringFailed: boolean;
  stage: Stage;
  submittedName: string;
  submittedEmail: string;
  submittedPhone: string;
  resumeText?: string;
  emailLog: EmailLogEntry[];
  agentLog?: AgentLogEntry[];
  notes?: string;
  source?: string;
  stageMovedAt?: string;
  stageHistory?: StageHistoryEntry[];
  assessmentStatus?: "not_sent" | "sent" | "in_progress" | "completed";
  assessmentToken?: string;
  assessmentSentAt?: string;
  assessmentCompletedAt?: string;
  assessmentQuestions?: { id: string; text: string }[];
  assessmentScore?: number;
  assessmentSummary?: string;
  assessmentStrengths?: string[];
  assessmentWeaknesses?: string[];
  assessmentScoringStatus?: "not_started" | "pending" | "completed" | "failed";
  createdAt: string;
};

type Form = {
  _id: string;
  title: string;
  description: string;
  slug: string;
  status: "active" | "closed";
  responseCount: number;
  questions: FormQuestion[];
  jobDetails?: { companyName?: string };
  agentMode?: AgentMode;
  pipelineRules?: PipelineRule[];
  createdAt: string;
};

type FormAnalysis = {
  generatedAt: string;
  overview: {
    total: number;
    scored: number;
    pending: number;
    failed: number;
    averageScore: number;
    medianScore: number;
    shortlistRate: number;
    interviewRate: number;
    hireRate: number;
  };
  funnel: { stage: string; count: number }[];
  scoreDistribution: { label: string; count: number }[];
  timeline: { date: string; applications: number; averageScore: number | null }[];
  sources: { source: string; applications: number; averageScore: number | null }[];
  agentActions: {
    shortlisted: number;
    rejected: number;
    review_zone: number;
    emailsSent: number;
    failed: number;
  };
  questionPerformance: {
    questionId: string;
    label: string;
    answered: number;
    strongSignals: number;
    thinSignals: number;
    averageScore: number | null;
    signalRate: number;
  }[];
  stageAging: { stage: string; candidates: number; averageDays: number }[];
};

type FormHiringSummary = {
  generatedAt: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  highSignalQuestions: string[];
  lowSignalQuestions: string[];
  priorityCandidates: { responseId: string; reason: string }[];
};

type FormAssessmentAnalytics = {
  formTitle: string;
  totalResponses: number;
  sent: number;
  started: number;
  completed: number;
  pending: number;
  scoringPending: number;
  scoringFailed: number;
  passThreshold: number;
  passed: number;
  passRate: number;
  completionRate: number;
  assessmentToInterviewRate: number;
  averageCompletionMinutes: number | null;
  questionPerformance: {
    questionId: string;
    text: string;
    shown: number;
    answered: number;
    answerRate: number;
    averageTimeSeconds: number | null;
  }[];
};

const DEFAULT_AGENT_MODE: AgentMode = {
  enabled: false,
  shortlistThreshold: 75,
  rejectThreshold: 35,
  autoEmailShortlist: true,
  autoEmailReject: false,
  emailReviewZoneCandidates: false,
};

const AGENT_ACTION_LABEL: Record<AgentAction, string> = {
  shortlisted: "Auto-shortlisted",
  rejected: "Auto-rejected",
  review_zone: "Review zone",
};

const AGENT_ACTION_STYLE: Record<AgentAction, string> = {
  shortlisted: "bg-blue-50 text-blue-600 border-blue-200",
  rejected: "bg-rose-50 text-rose-600 border-rose-200",
  review_zone: "bg-amber-50 text-amber-700 border-amber-200",
};

const RULE_CONDITION_LABEL: Record<RuleCondition, string> = {
  score_above: "AI score is at or above",
  score_below: "AI score is below",
  stage_age_days: "Days sitting in the same stage reaches",
};

const RULE_ACTION_LABEL: Record<RuleAction, string> = {
  move_to_scored: "Move to Scored",
  move_to_review_zone: "Move to Review zone",
  move_to_shortlisted: "Move to Shortlisted",
  move_to_assessment: "Move to Assessment",
  move_to_interview: "Move to Interview",
  move_to_offer: "Move to Offer",
  move_to_hired: "Move to Hired",
  move_to_withdrawn: "Move to Withdrawn",
  move_to_rejected: "Move to Rejected",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(pct: number) {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-rose-500";
}

function scoreBarColor(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-rose-400";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function SparkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ─── Answer signal badge ──────────────────────────────────────────────────────

function SignalBadge({ signal, note }: { signal: "strong" | "ok" | "thin"; note: string }) {
  if (signal === "strong") {
    return (
      <span title={note} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        Strong
      </span>
    );
  }
  if (signal === "thin") {
    return (
      <span title={note} className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 shrink-0">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Thin
      </span>
    );
  }
  return null; // "ok" — no badge, keep UI clean
}

// Dark-theme signal badge (for the info modal)
function SignalBadgeDark({ signal, note }: { signal: "strong" | "ok" | "thin"; note: string }) {
  if (signal === "strong") {
    return (
      <span title={note} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-400 shrink-0">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        Strong
      </span>
    );
  }
  if (signal === "thin") {
    return (
      <span title={note} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-400 shrink-0">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Thin
      </span>
    );
  }
  return null;
}

// ─── Scoring Criteria Card ─────────────────────────────────────────────────────

const CONTACT_KEYWORDS = ["name", "email", "phone", "mobile", "contact", "address"];
const STRUCTURAL_TYPES: QuestionType[] = ["email", "phone", "number", "file"];

function isContactQuestion(q: FormQuestion): boolean {
  const lbl = q.label.toLowerCase();
  return (
    STRUCTURAL_TYPES.includes(q.type) ||
    CONTACT_KEYWORDS.some(k => lbl.includes(k))
  );
}

function buildCriteriaFromQuestions(questions: FormQuestion[], formTitle: string): string[] {
  const criteria: string[] = [];

  const hasResume = questions.some(q => q.type === "file");
  const evalQuestions = questions.filter(q => !isContactQuestion(q));

  if (evalQuestions.length === 0 && !hasResume) {
    criteria.push(`Overall relevance and fit for "${formTitle}"`);
    return criteria;
  }

  for (const q of evalQuestions) {
    const lbl = q.label;
    if (q.type === "paragraph" || q.type === "short") {
      criteria.push(`"${lbl}" — depth, specificity, and relevance of the answer`);
    } else if (q.type === "yes_no") {
      criteria.push(`"${lbl}" — whether the response meets the requirement`);
    } else if (q.type === "dropdown" || q.type === "multiple_choice") {
      criteria.push(`"${lbl}" — alignment of the selected option with role needs`);
    } else {
      criteria.push(`"${lbl}"`);
    }
  }

  if (hasResume) {
    criteria.push("Resume quality — experience and skills relevant to the role");
  }

  return criteria;
}

function ScoringCriteriaCard({ questions, formTitle }: { questions: FormQuestion[]; formTitle: string }) {
  const [open, setOpen] = useState(false);
  const criteria = buildCriteriaFromQuestions(questions, formTitle);
  const hasResume = questions.some(q => q.type === "file");

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-100/60 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-violet-500"><SparkIcon /></span>
          <span className="text-xs font-bold text-violet-700">What the AI looks for</span>
          <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-600">{criteria.length} dimension{criteria.length !== 1 ? "s" : ""}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-violet-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-violet-100">
          <p className="text-[11px] text-violet-500/80 pt-3 leading-5">
            The AI evaluates every response against these dimensions and assigns an overall score from 0–100.
            {hasResume && " Resume quality is factored in alongside the form answers."}
          </p>

          <div className="space-y-1.5">
            {criteria.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-violet-800">
                <span className="mt-0.5 text-violet-400 shrink-0">·</span>
                <span>{c}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-violet-200/60 bg-white/60 px-3 py-2.5 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1.5">Score tiers</p>
            {[
              { range: "80–100", label: "Strong fit", color: "text-emerald-600" },
              { range: "60–79", label: "Good candidate, minor gaps", color: "text-blue-600" },
              { range: "40–59", label: "Partial match, unclear fit", color: "text-amber-600" },
              { range: "0–39", label: "Significant mismatch or thin answers", color: "text-rose-500" },
            ].map(t => (
              <div key={t.range} className="flex items-center gap-2 text-[11px]">
                <span className={`font-bold w-12 shrink-0 ${t.color}`}>{t.range}</span>
                <span className="text-slate-500">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Email modals ──────────────────────────────────────────────────────────────

function FormComposeEmailModal({
  candidateName, candidateEmail, formId, responseId, token, onClose, onSent,
}: {
  candidateName: string; candidateEmail: string;
  formId: string; responseId: string; token: string;
  onClose: () => void;
  onSent: (entry: EmailLogEntry) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (!subject.trim() || !body.trim()) { setError("Subject and body are required."); return; }
    setSending(true); setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${responseId}/send-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "custom", subject: subject.trim(), body: body.trim() }),
      });
      const data = await readApiJson(res);
      // If SMTP failed, backend still returns logEntry — show it in history before displaying error
      if (data.logEntry) onSent(data.logEntry);
      if (!res.ok) throw new Error(data.error || "Send failed.");
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Compose Email</h2>
            <p className="text-xs text-slate-500 mt-0.5">To: <strong>{candidateName}</strong> · {candidateEmail}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Subject</label>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Message</label>
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Type your message…"
              rows={7}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none transition"
            />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button
            onClick={send}
            disabled={sending}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 transition disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRejectionEmailModal({
  initialEmail, candidateName, candidateEmail, formId, responseId, token, onClose, onSent, deleteMode, onDeleted,
}: {
  initialEmail: string; candidateName: string; candidateEmail: string;
  formId: string; responseId: string; token: string;
  onClose: () => void;
  onSent: (entry: EmailLogEntry) => void;
  deleteMode?: boolean;
  onDeleted?: () => void;
}) {
  const [body, setBody] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const subject = `Update on your application`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (!body.trim()) { setError("Email body cannot be empty."); return; }
    setSending(true); setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${responseId}/send-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "rejected", subject, body: body.trim() }),
      });
      const data = await readApiJson(res);
      if (data.logEntry) onSent(data.logEntry);
      if (!res.ok) throw new Error(data.error || "Send failed.");
      if (deleteMode) {
        onDeleted?.();
      }
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{deleteMode ? "Send Email & Remove" : "Rejection Email"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">To: <strong>{candidateName}</strong> · {candidateEmail}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-3">
          {deleteMode && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] text-amber-800 leading-5">
                <span className="font-bold">Why send this email?</span> This lets the applicant know they were not selected, so they can move on and apply elsewhere instead of waiting indefinitely for a response.
              </p>
            </div>
          )}
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">AI-Generated · Edit before sending</p>
          <textarea
            value={body} onChange={e => setBody(e.target.value)}
            rows={deleteMode ? 7 : 8}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 resize-none transition"
          />
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button
            onClick={send}
            disabled={sending}
            className="rounded-xl bg-rose-500 px-5 py-2 text-sm font-bold text-white hover:bg-rose-600 transition disabled:opacity-60"
          >
            {sending ? "Sending…" : deleteMode ? "Send & Remove" : "Send Rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Share modal ───────────────────────────────────────────────────────────────

function ShareModal({ slug, title, onClose }: { slug: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://www.rolebolt.tech"}/f/${slug}`;
  const embedCode = `<iframe src="${link}" width="100%" height="720" frameborder="0" style="border:1px solid #e2e8f0;border-radius:12px;" title="${title.replace(/"/g, "&quot;")}"></iframe>`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode).catch(() => {});
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  }

  function copy() {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareText = encodeURIComponent(`Apply for: ${title}\n${link}`);
  const socials = [
    { name: "WhatsApp", href: `https://wa.me/?text=${shareText}`, color: "bg-[#25d366] hover:opacity-90", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, color: "bg-[#1877f2] hover:opacity-90", icon: <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`, color: "bg-[#2aabee] hover:opacity-90", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
    { name: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${shareText}`, color: "bg-[#000000] hover:opacity-90", icon: <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, color: "bg-[#0a66c2] hover:opacity-90", icon: <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
    { name: "Email", href: `mailto:?subject=${encodeURIComponent(`Apply: ${title}`)}&body=${shareText}`, color: "bg-[#6366f1] hover:opacity-90", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
    { name: "SMS", href: `sms:?&body=${shareText}`, color: "bg-[#10b981] hover:opacity-90", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7a2 2 0 0 1 1.72 2.02z"/></svg> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Share form</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">{title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 transition">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Form Link</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="flex-1 text-xs text-slate-600 truncate font-mono">{link}</p>
              <button onClick={copy} className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${copied ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Embed on your site</p>
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="flex-1 text-[10px] text-slate-500 font-mono leading-5 line-clamp-3">{embedCode}</p>
              <button onClick={copyEmbed} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${copiedEmbed ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                {copiedEmbed ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div>
            <button type="button" onClick={() => setShowQr(v => !v)} className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">
              QR code {showQr ? "▲" : "▼"}
            </button>
            {showQr && (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR code for form link" width={180} height={180} className="rounded-lg" />
                <p className="text-[10px] text-slate-400 text-center">Print or share for in-person events</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Share on</p>
            <div className="grid grid-cols-4 gap-2">
              {socials.map(s => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-white transition active:scale-95 ${s.color}`} title={s.name}>
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="text-[9px] font-bold leading-none">{s.name.split(" ")[0]}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Resume section (for info modal) ──────────────────────────────────────────

function FormResumeSection({ resumeText }: { resumeText: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const PREVIEW_CHARS = 600;
  const isLong = resumeText.length > PREVIEW_CHARS;
  const displayed = expanded || !isLong ? resumeText : resumeText.slice(0, PREVIEW_CHARS) + "…";

  function copyResume() {
    navigator.clipboard.writeText(resumeText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Resume</p>
        <button
          onClick={copyResume}
          className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-gray-400 hover:bg-white/[0.09] transition"
          title="Copy full resume text"
        >
          {copied ? (
            <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Copied</>
          ) : (
            <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
          )}
        </button>
      </div>
      <pre className="text-[11px] text-gray-300 leading-5 whitespace-pre-wrap break-words font-sans">{displayed}</pre>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 text-[11px] font-semibold text-sky-500 hover:text-sky-400 transition"
        >
          {expanded ? "Show less ↑" : "Show full resume ↓"}
        </button>
      )}
    </div>
  );
}

// ─── Question score row ───────────────────────────────────────────────────────

function QuestionScoreRow({
  idx,
  answer,
  qs,
  signal,
}: {
  idx: number;
  answer: Answer;
  qs: QuestionScore | undefined;
  signal: AnswerSignal | undefined;
}) {
  const [open, setOpen] = useState(false);

  const scoreColor = !qs
    ? "text-gray-400"
    : qs.score >= 8
    ? "text-emerald-400"
    : qs.score >= 6
    ? "text-sky-400"
    : qs.score >= 4
    ? "text-amber-400"
    : "text-rose-400";

  const scoreBg = !qs
    ? "bg-white/[0.04]"
    : qs.score >= 8
    ? "bg-emerald-500/10 border-emerald-500/20"
    : qs.score >= 6
    ? "bg-sky-500/10 border-sky-500/20"
    : qs.score >= 4
    ? "bg-amber-500/10 border-amber-500/20"
    : "bg-rose-500/10 border-rose-500/20";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition"
      >
        {/* Question number */}
        <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-gray-400">
          {idx}
        </span>

        <div className="flex-1 min-w-0">
          {/* Label */}
          <p className="text-[11px] font-semibold text-gray-300 leading-snug">{answer.label}</p>
          {/* Answer preview (single line) */}
          <p className="mt-0.5 text-[10px] text-gray-500 truncate">{answer.value}</p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {/* Score pill */}
          {qs && (
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${scoreBg} ${scoreColor}`}>
              {qs.score.toFixed(1)}/10
            </span>
          )}
          {/* Signal (for legacy responses without questionScores) */}
          {!qs && signal && <SignalBadgeDark signal={signal.signal} note={signal.note} />}
          {/* Chevron */}
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
          {/* Candidate answer */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Candidate&apos;s Answer</p>
            <p className="text-xs text-gray-200 leading-5 whitespace-pre-wrap">{answer.value}</p>
          </div>

          {qs ? (
            <>
              {/* Score */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded-lg border px-2.5 py-1 text-sm font-bold ${scoreBg} ${scoreColor}`}>
                  {qs.score.toFixed(1)} / 10
                </span>
              </div>

              {/* AI Feedback */}
              {qs.feedback && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">AI Feedback</p>
                  <p className="text-xs text-gray-300 leading-5 italic">&ldquo;{qs.feedback}&rdquo;</p>
                </div>
              )}

              {/* Strengths + Weaknesses side by side on larger screens */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {qs.strengths.length > 0 && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1.5">Strengths</p>
                    <ul className="space-y-1">
                      {qs.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-300">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {qs.weaknesses.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-1.5">Areas for Improvement</p>
                    <ul className="space-y-1">
                      {qs.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-300">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          ) : signal?.note ? (
            // Legacy fallback: show signal note
            <p className="text-[10px] text-gray-500 italic">{signal.note}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Assessment Analysis section ─────────────────────────────────────────────

function AssessmentAnalysisSection({
  r,
  textAnswers,
  signalMap,
  scoreMap,
}: {
  r: FormResponse;
  textAnswers: Answer[];
  signalMap: Record<string, AnswerSignal>;
  scoreMap: Record<string, QuestionScore>;
}) {
  const [open, setOpen] = useState(true);

  // Overall score bar stats
  const scored = (r.questionScores || []).filter(qs => qs.score > 0);
  const avgScore = scored.length > 0
    ? scored.reduce((sum, qs) => sum + qs.score, 0) / scored.length
    : null;

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-500/[0.06] transition"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="text-xs font-bold text-violet-300">Assessment Analysis</span>
          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-400">
            {textAnswers.length} question{textAnswers.length !== 1 ? "s" : ""}
          </span>
          {avgScore !== null && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
              avg {avgScore.toFixed(1)}/10
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-violet-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-violet-500/15 px-3 pb-3 pt-2 space-y-2">
          {textAnswers.length === 0 ? (
            <p className="px-1 py-2 text-xs text-gray-500">No text answers to analyse.</p>
          ) : (
            textAnswers.map((a, i) => (
              <QuestionScoreRow
                key={a.questionId}
                idx={i + 1}
                answer={a}
                qs={scoreMap[a.questionId]}
                signal={signalMap[a.questionId]}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Info modal ────────────────────────────────────────────────────────────────

function FormResponseInfoModal({ r, onClose }: { r: FormResponse; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<"email" | "phone" | null>(null);

  const displayName = r.submittedName || r.answers.find(a => a.label.toLowerCase().includes("name"))?.value || "Candidate";
  const displayEmail = r.submittedEmail || r.answers.find(a => a.label.toLowerCase().includes("email"))?.value || "";
  const appliedDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  const textAnswers = r.answers.filter(a => a.value && a.value.trim() && a.value !== "__file_uploaded__");

  const signalMap: Record<string, AnswerSignal> = {};
  for (const s of (r.answerSignals || [])) signalMap[s.questionId] = s;

  const scoreMap: Record<string, QuestionScore> = {};
  for (const qs of (r.questionScores || [])) scoreMap[qs.questionId] = qs;

  function copy(text: string, field: "email" | "phone") {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-info-title"
        className="w-full max-w-md rounded-[2rem] border border-white/[0.08] bg-[#0a0a0f] shadow-2xl max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 id="form-info-title" className="text-sm font-bold text-white truncate">{displayName}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Applicant Details</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            {!r.scoringFailed && (
              <div className="text-right">
                <p className={`text-base font-bold leading-none ${r.aiScore >= 75 ? "text-emerald-400" : r.aiScore >= 50 ? "text-amber-400" : "text-rose-400"}`}>{r.aiScore}%</p>
                <p className="text-[10px] text-gray-500 mt-0.5">AI score</p>
              </div>
            )}
            {appliedDate && (
              <div className="text-right">
                <p className="text-[10px] text-gray-400 leading-none">Applied</p>
                <p className="text-[11px] font-semibold text-gray-300 mt-0.5">{appliedDate}</p>
              </div>
            )}
            <button onClick={onClose} aria-label="Close" className="ml-1 text-gray-400 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">

          {/* Email */}
          {displayEmail && (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.09] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/70 mb-2">Email Address</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-sky-300 break-all leading-snug">{displayEmail}</p>
                <button
                  onClick={() => copy(displayEmail, "email")}
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-bold text-sky-400 hover:bg-sky-500/20 transition"
                >
                  {copiedField === "email" ? (
                    <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Copied</>
                  ) : (
                    <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                  )}
                </button>
              </div>
              <p className="mt-2.5 text-[11px] text-sky-500/60 italic">Use the Email button on the card to send emails.</p>
            </div>
          )}

          {/* Phone */}
          {r.submittedPhone && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Phone</p>
                <a href={`tel:${r.submittedPhone}`} className="text-sm font-bold text-white hover:text-sky-300 transition">{r.submittedPhone}</a>
              </div>
              <button
                onClick={() => copy(r.submittedPhone, "phone")}
                className="shrink-0 flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-gray-400 hover:bg-white/[0.09] transition"
              >
                {copiedField === "phone" ? (
                  <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Copied</>
                ) : (
                  <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                )}
              </button>
            </div>
          )}

          {/* AI Summary */}
          {r.aiSummary && !r.scoringFailed && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">AI Assessment</p>
              <p className="text-xs text-gray-300 leading-5">{r.aiSummary}</p>
            </div>
          )}

          {/* Strengths */}
          {r.strengths.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mb-2">Strengths</p>
              <ul className="space-y-1.5">
                {r.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-emerald-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red flags */}
          {r.redFlags.length > 0 && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-2">Red Flags</p>
              <ul className="space-y-1.5">
                {r.redFlags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-rose-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pipeline audit trail */}
          {(r.stageHistory || []).length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pipeline activity</p>
                <span className="text-[10px] text-gray-600">{r.stageHistory?.length} event{r.stageHistory?.length === 1 ? "" : "s"}</span>
              </div>
              <div className="space-y-3">
                {[...(r.stageHistory || [])].reverse().slice(0, 8).map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="text-xs font-semibold text-gray-200">
                          {entry.fromStage ? `${entry.fromStage} → ${entry.toStage}` : `Application → ${entry.toStage}`}
                        </p>
                        <time className="text-[10px] text-gray-600">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""}
                        </time>
                      </div>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        {entry.actor === "recruiter" ? "Recruiter" : entry.actor === "agent" ? "AI Agent" : entry.actor === "rule" ? "Pipeline rule" : "System"}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assessment Analysis — per-question scores + expandable details */}
          {!r.scoringFailed && textAnswers.length > 0 && (
            <AssessmentAnalysisSection
              r={r}
              textAnswers={textAnswers}
              signalMap={signalMap}
              scoreMap={scoreMap}
            />
          )}

          {/* Resume */}
          {r.resumeText?.trim() ? (
            <FormResumeSection resumeText={r.resumeText} />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Resume</p>
              <p className="text-xs text-gray-600">No resume was submitted with this application.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-white/[0.07] px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-xl bg-zinc-800 px-5 py-2 text-sm font-bold text-white hover:bg-zinc-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Response card ─────────────────────────────────────────────────────────────

function ResponseCard({ r, token, formId, formTitle, companyName, onUpdate, onDelete, recipientPool }: {
  r: FormResponse; token: string; formId: string; formTitle: string; companyName: string;
  onUpdate: (id: string, patch: Partial<FormResponse>) => void;
  onDelete: (id: string) => void;
  recipientPool: CreatorEmailRecipient[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<"email" | "phone" | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [loadingRetry, setLoadingRetry] = useState(false);
  const [retryError, setRetryError] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [showQuestions, setShowQuestions] = useState(false);

  // ── Email state ──────────────────────────────────────────────────────────────
  const [localEmailLog, setLocalEmailLog] = useState<EmailLogEntry[]>(r.emailLog || []);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionDraft, setRejectionDraft] = useState("");
  const [loadingReject, setLoadingReject] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentRetryLoading, setAssessmentRetryLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const [assessmentUrl, setAssessmentUrl] = useState("");
  const [pendingStageEmail, setPendingStageEmail] = useState<FormStageEmailNotifyStage | null>(null);
  const { authUser } = useRecruitAuth();

  async function updateStage(stage: Stage) {
    const prevStage = r.stage;
    if (stage === prevStage) return;
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage, skipAutoEmail: true }),
      });
      if (res.ok) {
        onUpdate(r._id, { stage, stageMovedAt: new Date().toISOString() });
        if (isFormStageEmailNotifyStage(stage)) {
          setPendingStageEmail(stage);
        }
      }
    } catch { /* silent */ }
  }

  async function sendAssessment() {
    setAssessmentLoading(true);
    setAssessmentError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}/assessment/send`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Could not send assessment.");
      setAssessmentUrl(data.assessmentUrl || "");
      onUpdate(r._id, {
        stage: "assessment",
        assessmentStatus: data.status || "sent",
        assessmentToken: data.assessmentUrl?.split("/").pop()?.split("?")[0],
        assessmentQuestions: data.questions || r.assessmentQuestions,
        assessmentSentAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setAssessmentError(e.message || "Could not send assessment.");
    } finally {
      setAssessmentLoading(false);
    }
  }

  async function retryAssessmentScore() {
    setAssessmentRetryLoading(true);
    setAssessmentError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}/assessment/retry-score`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Could not retry assessment scoring.");
      onUpdate(r._id, { assessmentScoringStatus: "pending" });
    } catch (e: any) {
      setAssessmentError(e.message || "Could not retry assessment scoring.");
    } finally {
      setAssessmentRetryLoading(false);
    }
  }

  async function generateRejectionEmail(forDelete = false) {
    setLoadingReject(true);
    if (forDelete) setDeleteMode(true);
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}/reject-email`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error);
      setRejectionDraft(data.email);
      setShowRejectModal(true);
    } catch (e: any) {
      if (forDelete) setDeleteMode(false);
      alert(e.message || "Failed to generate rejection email.");
    } finally {
      setLoadingReject(false);
    }
  }

  async function deleteResponseRecord() {
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) onDelete(r._id);
    } catch { /* silent */ }
  }

  async function handleRemove() {
    if (!displayEmail) {
      if (!confirm(`Remove ${displayName} from this form?`)) return;
      await deleteResponseRecord();
      return;
    }
    await generateRejectionEmail(true);
  }

  async function retryScoring() {
    setLoadingRetry(true);
    setRetryError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}/retry-score`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Retry failed.");
      const updated = data.response;
      onUpdate(r._id, {
        aiScore: updated.aiScore,
        aiSummary: updated.aiSummary,
        strengths: updated.strengths,
        redFlags: updated.redFlags,
        answerSignals: updated.answerSignals,
        questionScores: updated.questionScores || [],
        scoringFailed: updated.scoringFailed,
      });
    } catch (e: any) {
      setRetryError(e.message || "Retry failed. Please try again.");
    } finally {
      setLoadingRetry(false);
    }
  }

  async function generateInterviewQuestions() {
    // If already cached on the response, just toggle display
    if ((r.interviewQuestions || []).length > 0) {
      setShowQuestions(q => !q);
      return;
    }
    setLoadingQuestions(true);
    setQuestionsError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}/interview-questions`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to generate questions.");
      const qs: string[] = Array.isArray(data.questions) ? data.questions : [];
      if (qs.length === 0) throw new Error("AI returned no questions. Please try again.");
      onUpdate(r._id, { interviewQuestions: qs });
      setShowQuestions(true);
    } catch (e: any) {
      setQuestionsError(e.message || "Generation failed. Please try again.");
    } finally {
      setLoadingQuestions(false);
    }
  }

  function copy(text: string, field: "email" | "phone") {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  const stageStyle = STAGES.find(s => s.id === r.stage) || STAGES[0];
  const displayName = r.submittedName || r.answers.find(a => a.label.toLowerCase().includes("name"))?.value || "Candidate";
  const displayEmail = r.submittedEmail || r.answers.find(a => a.label.toLowerCase().includes("email"))?.value || "";
  const textAnswers = r.answers.filter(a => a.value && a.value.trim() && a.value !== "__file_uploaded__");

  // Build a map from questionId → signal for O(1) lookup
  const signalMap: Record<string, AnswerSignal> = {};
  for (const s of (r.answerSignals || [])) signalMap[s.questionId] = s;

  const lastAgentAction = r.agentLog?.length ? r.agentLog[r.agentLog.length - 1] : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-slate-900 truncate">{displayName}</h3>
              {lastAgentAction && (
                <span
                  title={lastAgentAction.reason}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${AGENT_ACTION_STYLE[lastAgentAction.action]}`}
                >
                  {AGENT_ACTION_LABEL[lastAgentAction.action]} by AI
                </span>
              )}
              {r.redFlags.length > 0 && (
                <span className="flex items-center gap-0.5 text-rose-400 text-[10px] font-semibold">
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {r.redFlags.length} flag{r.redFlags.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {displayEmail && <p className="text-xs text-slate-500">{displayEmail}</p>}
            <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(r.createdAt)}</p>
          </div>
          {!r.scoringFailed ? (
            <div className="text-right shrink-0">
              <p className={`text-xl font-bold leading-none ${scoreColor(r.aiScore)}`}>{r.aiScore}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">AI score</p>
            </div>
          ) : (
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-amber-500 leading-snug">Scoring<br/>unavailable</p>
            </div>
          )}
        </div>

        {/* Score bar */}
        {!r.scoringFailed && (
          <div className="mb-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scoreBarColor(r.aiScore)}`} style={{ width: `${r.aiScore}%` }} />
          </div>
        )}

        {/* AI Summary / scoring failed notice */}
        {r.aiSummary && !r.scoringFailed && (
          <p className="text-xs text-slate-600 leading-5 line-clamp-2 mb-3">{r.aiSummary}</p>
        )}
        {r.scoringFailed && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs text-amber-700">AI scoring unavailable — click &ldquo;Retry Scoring&rdquo; to try again.</p>
            {retryError && <p className="mt-1 text-[11px] text-rose-500">{retryError}</p>}
          </div>
        )}
        {r.assessmentSummary && r.assessmentScoringStatus === "completed" && (
          <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Assessment score</p>
              <p className="text-sm font-bold text-indigo-700">{r.assessmentScore ?? 0}%</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-indigo-900 line-clamp-2">{r.assessmentSummary}</p>
          </div>
        )}
        {assessmentError && <p className="mb-2 text-[11px] text-rose-500">{assessmentError}</p>}
        {assessmentUrl && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
            <a href={assessmentUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[11px] font-medium text-indigo-700 hover:underline">
              Candidate assessment link
            </a>
            <button onClick={() => navigator.clipboard.writeText(assessmentUrl)} className="shrink-0 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800">Copy</button>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={r.stage}
            onChange={e => updateStage(e.target.value as Stage)}
            className={`rounded-xl border text-[11px] font-semibold px-2.5 py-1.5 outline-none cursor-pointer bg-transparent ${stageStyle.bg} ${stageStyle.color}`}
          >
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            {expanded ? "Collapse" : "View Answers"}
          </button>

          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-600 hover:bg-violet-100 transition"
          >
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Info
          </button>

          {displayEmail && (
            <button
              onClick={() => setShowComposeModal(true)}
              className="flex items-center gap-1 rounded-xl border border-[#0a66c2]/20 bg-[#0a66c2]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#0a66c2] hover:bg-[#0a66c2]/15 transition"
            >
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              Send Email
            </button>
          )}

          {r.assessmentStatus === "completed" ? (
            r.assessmentScoringStatus === "failed" ? (
              <button
                onClick={retryAssessmentScore}
                disabled={assessmentRetryLoading}
                className="flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
              >
                {assessmentRetryLoading ? <SpinnerIcon /> : <RetryIcon />}
                {assessmentRetryLoading ? "Retrying…" : "Retry assessment score"}
              </button>
            ) : (
              <span className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold ${
                r.assessmentScoringStatus === "pending"
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}>
                {r.assessmentScoringStatus === "pending"
                  ? "Assessment scoring…"
                  : `Assessment completed${r.assessmentScoringStatus === "completed" ? ` · ${r.assessmentScore ?? 0}%` : ""}`}
              </span>
            )
          ) : (
            <button
              onClick={sendAssessment}
              disabled={assessmentLoading || r.assessmentStatus === "sent" || r.assessmentStatus === "in_progress"}
              className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-50"
            >
              {assessmentLoading ? <SpinnerIcon /> : <SparkIcon />}
              {assessmentLoading ? "Preparing…" : r.assessmentStatus === "sent" || r.assessmentStatus === "in_progress" ? "Assessment pending" : "Send assessment"}
            </button>
          )}

          {displayEmail && r.stage !== "rejected" && (
            <button
              onClick={() => generateRejectionEmail()}
              disabled={loadingReject}
              className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 transition disabled:opacity-50"
            >
              {loadingReject ? <SpinnerIcon /> : (
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              )}
              {loadingReject ? "Generating…" : "Reject"}
            </button>
          )}

          {!r.scoringFailed && (
            <button
              onClick={generateInterviewQuestions}
              disabled={loadingQuestions}
              className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-50"
            >
              {loadingQuestions ? <SpinnerIcon /> : <SparkIcon />}
              {loadingQuestions
                ? "Generating…"
                : (r.interviewQuestions || []).length > 0
                  ? (showQuestions ? "Hide Questions" : "Interview Qs")
                  : "Interview Qs"}
            </button>
          )}

          {r.scoringFailed && (
            <button
              onClick={retryScoring}
              disabled={loadingRetry}
              className="flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
            >
              {loadingRetry ? <SpinnerIcon /> : <RetryIcon />}
              {loadingRetry ? "Retrying…" : "Retry Scoring"}
            </button>
          )}

          {/* Remove button — opens email flow if email is available */}
          <button
            onClick={handleRemove}
            disabled={loadingReject && deleteMode}
            title="Remove applicant"
            className="ml-auto flex items-center justify-center h-6 w-6 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition disabled:opacity-50"
          >
            {loadingReject && deleteMode
              ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            }
          </button>
        </div>

        {/* Interview questions panel */}
        {questionsError && (
          <p className="mt-2 text-[11px] text-rose-500 px-1">{questionsError}</p>
        )}
        {showQuestions && (r.interviewQuestions || []).length > 0 && (
          <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-3 flex items-center gap-1">
              <SparkIcon /> Interview Questions
            </p>
            <ol className="space-y-2.5">
              {r.interviewQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-[9px] font-bold text-indigo-700">
                    {i + 1}
                  </span>
                  <p className="text-xs text-indigo-900 leading-5">{q}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Email history */}
        <FormApplicantTimeline response={r} />

        <div className="mt-3">
          <button
            onClick={() => setShowEmailHistory(v => !v)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition"
          >
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
            Emails sent ({localEmailLog.length})
            <span className="ml-0.5 text-[9px]">{showEmailHistory ? "▲" : "▼"}</span>
          </button>
          {showEmailHistory && (
            localEmailLog.length === 0 ? (
              <p className="mt-1.5 text-[11px] text-slate-400 pl-1">No emails sent yet for this applicant.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {[...localEmailLog].reverse().map((entry, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full mt-0.5 ${entry.status === "sent" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-slate-700 capitalize">{entry.type.replace(/_/g, " ")}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">→ {entry.to}</span>
                          <p className="text-[10px] text-slate-400 truncate">{entry.subject}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                        {new Date(entry.sentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        {" "}
                        {new Date(entry.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {entry.status === "failed" && (
                      <p className="text-[10px] text-rose-500 mt-1 pl-3">Failed: {entry.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <NotesSection
          formId={formId}
          responseId={r._id}
          token={token}
          initialNotes={r.notes || ""}
          onSaved={notes => onUpdate(r._id, { notes })}
        />
      </div>

      {/* Modals */}
      {showInfo && <FormResponseInfoModal r={r} onClose={() => setShowInfo(false)} />}
      {showComposeModal && displayEmail && (
        <CreatorEmailComposer
          open={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          channel="form"
          contextId={formId}
          token={token}
          billingCategory="creator_form"
          initialRecipientIds={[r._id]}
          recipientPool={recipientPool}
          senderPreview={{
            username: authUser?.username,
            email: authUser?.email,
            companyName,
          }}
          onSent={() => {
            setLocalEmailLog((prev) => [
              ...prev,
              {
                type: "creator_premium",
                to: displayEmail,
                subject: "Creator email",
                body: "",
                sentAt: new Date().toISOString(),
                status: "sent",
              },
            ]);
          }}
        />
      )}
      {showRejectModal && rejectionDraft && displayEmail && (
        <FormRejectionEmailModal
          initialEmail={rejectionDraft}
          candidateName={displayName}
          candidateEmail={displayEmail}
          formId={formId}
          responseId={r._id}
          token={token}
          onClose={() => { setShowRejectModal(false); setDeleteMode(false); }}
          onSent={(entry) => setLocalEmailLog(prev => [...prev, entry])}
          deleteMode={deleteMode}
          onDeleted={deleteResponseRecord}
        />
      )}
      {pendingStageEmail && (
        <FormStageEmailFlow
          stage={pendingStageEmail}
          responseId={r._id}
          candidateName={displayName}
          candidateEmail={displayEmail}
          formId={formId}
          formTitle={formTitle}
          companyName={companyName}
          token={token}
          onClose={() => setPendingStageEmail(null)}
          onSent={(entry: FormEmailLogEntry) => setLocalEmailLog(prev => [...prev, entry])}
        />
      )}

      {/* Expanded: contact + answers */}
      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50/60">
          {/* Contact details */}
          {(displayEmail || r.submittedPhone) && (
            <div className="space-y-2">
              {displayEmail && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500 mb-0.5">Email</p>
                    <p className="text-sm font-bold text-sky-700">{displayEmail}</p>
                  </div>
                  <button onClick={() => copy(displayEmail, "email")} className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold transition ${copied === "email" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-600 hover:bg-sky-200"}`}>
                    {copied === "email" ? "✓" : "Copy"}
                  </button>
                </div>
              )}
              {r.submittedPhone && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Phone</p>
                    <a href={`tel:${r.submittedPhone}`} className="text-sm font-bold text-slate-800 hover:text-violet-600 transition">{r.submittedPhone}</a>
                  </div>
                  <button onClick={() => copy(r.submittedPhone, "phone")} className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold transition ${copied === "phone" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {copied === "phone" ? "✓" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Strengths / Red flags */}
          {r.strengths.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5">Strengths</p>
              <ul className="space-y-1">
                {r.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.redFlags.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-1.5">Red Flags</p>
              <ul className="space-y-1">
                {r.redFlags.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-rose-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All answers with per-answer signals */}
          {textAnswers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Form Answers</p>
              <div className="space-y-2">
                {textAnswers.map(a => {
                  const sig = signalMap[a.questionId];
                  return (
                    <div key={a.questionId} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[10px] font-bold text-slate-400">{a.label}</p>
                        {sig && <SignalBadge signal={sig.signal} note={sig.note} />}
                      </div>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{a.value}</p>
                      {sig?.note && sig.signal !== "ok" && (
                        <p className="mt-1 text-[10px] text-slate-400 italic">{sig.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, hint, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-violet-600" : "bg-slate-300"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-700">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400 leading-4">{hint}</span>}
      </span>
    </label>
  );
}

function AgentModeCard({ formId, token, agentMode, responses, onSaved }: {
  formId: string;
  token: string;
  agentMode: AgentMode;
  responses: FormResponse[];
  onSaved: (mode: AgentMode) => void;
}) {
  const [draft, setDraft] = useState<AgentMode>(agentMode);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setDraft(agentMode); }, [agentMode]);

  const handled = responses.flatMap(r => r.agentLog ?? []);
  const shortlisted = handled.filter(e => e.action === "shortlisted").length;
  const rejected = handled.filter(e => e.action === "rejected").length;
  const reviewZone = handled.filter(e => e.action === "review_zone").length;
  const emailsSent = handled.filter(e => e.emailSent).length;

  const invalid = draft.rejectThreshold >= draft.shortlistThreshold;

  async function save(patch: Partial<AgentMode>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (next.rejectThreshold >= next.shortlistThreshold) {
      setError("Reject threshold must be lower than the shortlist threshold.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/agent-mode`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const data = await readApiJson(res);
      if (!res.ok) { setError(data.error || "Could not save agent settings."); return; }
      onSaved(data.agentMode);
    } catch {
      setError("Could not save agent settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-violet-600"><SparkIcon /></span>
            <h2 className="text-sm font-bold text-slate-900">AI Agent Mode</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${draft.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              {draft.enabled ? "Active" : "Manual"}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Triages every new response the moment it&rsquo;s scored — shortlist, reject, or leave in the review zone for you.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Toggle checked={draft.enabled} onChange={v => save({ enabled: v })} label="" />
          <button
            onClick={() => setOpen(o => !o)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            {open ? "Hide" : "Settings"}
          </button>
        </div>
      </div>

      {handled.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
          {[
            { label: "Auto-shortlisted", value: shortlisted, accent: "text-blue-600" },
            { label: "Auto-rejected", value: rejected, accent: "text-rose-500" },
            { label: "Review zone", value: reviewZone, accent: "text-amber-600" },
            { label: "Emails sent", value: emailsSent, accent: "text-slate-700" },
          ].map(s => (
            <div key={s.label} className="bg-white px-4 py-3">
              <p className={`text-lg font-bold leading-none ${s.accent}`}>{s.value}</p>
              <p className="mt-1 text-[10px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Balanced", shortlist: 75, reject: 40, enabled: true },
                { label: "Strict", shortlist: 85, reject: 50, enabled: true },
                { label: "Generous", shortlist: 65, reject: 30, enabled: true },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => save({
                    enabled: preset.enabled,
                    shortlistThreshold: preset.shortlist,
                    rejectThreshold: preset.reject,
                    autoEmailShortlist: true,
                    autoEmailReject: false,
                  })}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Shortlist at or above</span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="range" min={0} max={100} value={draft.shortlistThreshold}
                  onChange={e => setDraft({ ...draft, shortlistThreshold: Number(e.target.value) })}
                  onMouseUp={e => save({ shortlistThreshold: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={e => save({ shortlistThreshold: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-violet-600"
                />
                <span className="w-10 text-right text-xs font-bold text-slate-800">{draft.shortlistThreshold}%</span>
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Reject below</span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="range" min={0} max={100} value={draft.rejectThreshold}
                  onChange={e => setDraft({ ...draft, rejectThreshold: Number(e.target.value) })}
                  onMouseUp={e => save({ rejectThreshold: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={e => save({ rejectThreshold: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-rose-500"
                />
                <span className="w-10 text-right text-xs font-bold text-slate-800">{draft.rejectThreshold}%</span>
              </div>
            </label>
          </div>

          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-4 text-slate-500">
            Responses scoring between <strong>{draft.rejectThreshold}%</strong> and <strong>{draft.shortlistThreshold}%</strong> stay in
            the review zone for you to decide. Form answers are thinner evidence than a full resume, so keep auto-reject conservative.
          </p>

          <div className="space-y-3">
            <Toggle
              checked={draft.autoEmailShortlist}
              onChange={v => save({ autoEmailShortlist: v })}
              label="Email shortlisted applicants"
              hint="Sends the standard 'you've been shortlisted' email."
            />
            <Toggle
              checked={draft.autoEmailReject}
              onChange={v => save({ autoEmailReject: v })}
              label="Email auto-rejected applicants"
              hint="Off by default — nothing is sent until you turn this on."
            />
            <Toggle
              checked={draft.emailReviewZoneCandidates}
              onChange={v => save({ emailReviewZoneCandidates: v })}
              label="Email review-zone applicants"
              hint="Acknowledges that their application is still under review."
            />
          </div>

          {(error || invalid) && (
            <p className="text-[11px] font-medium text-rose-500">{error || "Reject threshold must be lower than the shortlist threshold."}</p>
          )}
          {saving && <p className="text-[11px] text-slate-400">Saving…</p>}
        </div>
      )}
    </div>
  );
}

function PipelineRulesCard({ formId, token, rules, onChange }: {
  formId: string;
  token: string;
  rules: PipelineRule[];
  onChange: (rules: PipelineRule[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<RuleCondition>("score_above");
  const [threshold, setThreshold] = useState(80);
  const [fromStage, setFromStage] = useState<"" | Stage>("");
  const [action, setAction] = useState<RuleAction>("move_to_shortlisted");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>("");

  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  async function addRule() {
    if (rules.length >= 3) {
      setError("Maximum 3 automation rules — remove one to add another.");
      return;
    }
    setBusy(true); setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/pipeline-rules`), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ condition, threshold, fromStage, action }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        setError(apiErrorFromPayload(res.status, data, data.message || data.error || "Could not add rule."));
        return;
      }
      onChange(data.rules);
    } catch (err) {
      setError(err);
    }
    finally { setBusy(false); }
  }

  async function toggleRule(rule: PipelineRule) {
    const res = await fetch(apiUrl(`/recruit/forms/${formId}/pipeline-rules/${rule.id}`), {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ enabled: !rule.enabled }),
    });
    const data = await readApiJson(res);
    if (res.ok) onChange(data.rules);
    else setError(apiErrorFromPayload(res.status, data, data.message || data.error || "Could not update rule."));
  }

  async function removeRule(rule: PipelineRule) {
    const res = await fetch(apiUrl(`/recruit/forms/${formId}/pipeline-rules/${rule.id}`), {
      method: "DELETE", headers: authHeaders,
    });
    const data = await readApiJson(res);
    if (res.ok) onChange(data.rules);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-3 p-5 text-left">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Pipeline Rules</h2>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Up to 3 rules to keep the middle of the funnel moving — they run when a response is scored and when its stage changes.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {rules.filter(r => r.enabled).length} active
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-4">
          {rules.length > 0 && (
            <ul className="space-y-2">
              {rules.map(rule => (
                <li key={rule.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700">
                      When {RULE_CONDITION_LABEL[rule.condition]} {rule.threshold}
                      {rule.condition === "stage_age_days" ? " days" : "%"}
                      {rule.fromStage ? ` (in ${rule.fromStage})` : ""} → {RULE_ACTION_LABEL[rule.action]}
                    </p>
                    <p className="text-[10px] text-slate-400">Fired {rule.triggerCount} time{rule.triggerCount !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${rule.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                  >
                    {rule.enabled ? "On" : "Off"}
                  </button>
                  <button onClick={() => removeRule(rule)} className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 transition">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={condition} onChange={e => setCondition(e.target.value as RuleCondition)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none">
                {(Object.keys(RULE_CONDITION_LABEL) as RuleCondition[]).map(c => (
                  <option key={c} value={c}>{RULE_CONDITION_LABEL[c]}</option>
                ))}
              </select>
              <input
                type="number" min={0} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                aria-label={condition === "stage_age_days" ? "Days" : "Score percentage"}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none"
              />
              <select value={fromStage} onChange={e => setFromStage(e.target.value as "" | Stage)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none">
                <option value="">Any stage</option>
                {STAGES.map(s => <option key={s.id} value={s.id}>Only in {s.label}</option>)}
              </select>
              <select value={action} onChange={e => setAction(e.target.value as RuleAction)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none">
                {(Object.keys(RULE_ACTION_LABEL) as RuleAction[]).map(a => (
                  <option key={a} value={a}>{RULE_ACTION_LABEL[a]}</option>
                ))}
              </select>
            </div>
            {error ? <FormErrorNotice error={error} className="text-[11px]" /> : null}
            <button
              onClick={addRule}
              disabled={busy}
              className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add rule"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotesSection({ formId, responseId, token, initialNotes, onSaved }: {
  formId: string;
  responseId: string;
  token: string;
  initialNotes: string;
  onSaved: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    if (notes === initialNotes) return;
    setStatus("saving");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${responseId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) { setStatus("error"); return; }
      onSaved(notes);
      setStatus("saved");
    } catch { setStatus("error"); }
  }

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Private notes</p>
        <span className="text-[10px] text-slate-400">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Could not save" : ""}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setStatus("idle"); }}
        onBlur={save}
        rows={3}
        placeholder="Only you can see this — interview impressions, follow-ups, salary expectations…"
        className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-violet-300"
      />
    </div>
  );
}

function FormAnalysisPanel({ formId, token }: { formId: string; token: string }) {
  const [analysis, setAnalysis] = useState<FormAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAnalysis = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/analysis`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.analysis) {
        throw new Error(data.error || "Could not load analysis.");
      }
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err?.message || "Could not load analysis.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formId, token]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

  if (loading) {
    return (
      <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-28 rounded-full rb-skeleton" />
            <div className="h-3 w-52 rounded-full rb-skeleton" />
          </div>
          <div className="h-8 w-20 rounded-lg rb-skeleton" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl rb-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-rose-700">Analysis unavailable</p>
            <p className="mt-1 text-xs text-rose-600">{error}</p>
          </div>
          <button
            onClick={() => loadAnalysis(true)}
            disabled={refreshing}
            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {refreshing ? "Retrying…" : "Retry"}
          </button>
        </div>
      </section>
    );
  }

  if (!analysis) return null;

  const { overview, funnel, scoreDistribution, timeline, sources, agentActions, questionPerformance, stageAging } = analysis;
  const maxScoreBucket = Math.max(1, ...scoreDistribution.map(bucket => bucket.count));
  const maxTimelineApplications = Math.max(1, ...timeline.map(point => point.applications));
  const maxQuestionAnswers = Math.max(1, ...questionPerformance.map(question => question.answered));
  const stageLabel: Record<string, string> = {
    new: "New",
    shortlisted: "Shortlisted",
    interview: "Interview",
    hired: "Hired",
    rejected: "Rejected",
  };
  const scoreColorFor = (score: number) => score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-500";

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="m7 15 3-3 3 2 6-7"/></svg>
            </span>
            <h2 className="text-sm font-bold text-slate-900">Analyze</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Real funnel, scoring, source, and question-signal performance.</p>
        </div>
        <button
          onClick={() => loadAnalysis(true)}
          disabled={refreshing}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh analysis"}
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Applications", value: overview.total, accent: "text-slate-900" },
            { label: "Scored", value: overview.scored, accent: "text-violet-700" },
            { label: "Average score", value: overview.scored ? `${overview.averageScore}%` : "—", accent: scoreColorFor(overview.averageScore) },
            { label: "Scoring failed", value: overview.failed, accent: overview.failed ? "text-rose-600" : "text-slate-500" },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className={`text-xl font-bold ${item.accent}`}>{item.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>

        {overview.total === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Analysis will appear after responses arrive</p>
            <p className="mt-1 text-xs text-slate-400">Share this form to start building a real hiring funnel.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pipeline funnel</h3>
                  <span className="text-[10px] text-slate-400">Current stage</span>
                </div>
                <div className="mt-4 space-y-3">
                  {funnel.map(item => {
                    const width = overview.total ? Math.max(3, Math.round((item.count / overview.total) * 100)) : 3;
                    return (
                      <div key={item.stage} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs text-slate-600">{stageLabel[item.stage] || item.stage}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${width}%` }} />
                        </div>
                        <span className="w-7 text-right text-xs font-bold text-slate-700">{item.count}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                  <div><p className="text-sm font-bold text-blue-600">{overview.shortlistRate}%</p><p className="text-[10px] text-slate-400">shortlist rate</p></div>
                  <div><p className="text-sm font-bold text-amber-600">{overview.interviewRate}%</p><p className="text-[10px] text-slate-400">interview rate</p></div>
                  <div><p className="text-sm font-bold text-emerald-600">{overview.hireRate}%</p><p className="text-[10px] text-slate-400">hire rate</p></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Score distribution</h3>
                  <span className="text-[10px] text-slate-400">Failed scores excluded</span>
                </div>
                <div className="mt-4 flex h-32 items-end justify-around gap-3">
                  {scoreDistribution.map(bucket => (
                    <div key={bucket.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-[11px] font-bold text-slate-600">{bucket.count}</span>
                      <div className="flex w-full max-w-10 items-end rounded-t-md bg-violet-100" style={{ height: `${Math.max(8, (bucket.count / maxScoreBucket) * 88)}px` }}>
                        <div className="w-full rounded-t-md bg-violet-500" style={{ height: "100%" }} />
                      </div>
                      <span className="text-[10px] text-slate-400">{bucket.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">Median score <b className="text-slate-800">{overview.medianScore || "—"}%</b></span>
                  <span className="text-slate-500">Pending <b className="text-amber-600">{overview.pending}</b></span>
                </div>
              </div>
            </div>

            {timeline.length > 0 && (
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Applications over time</h3>
                  <span className="text-[10px] text-slate-400">Last {timeline.length} active days</span>
                </div>
                <div className="mt-4 flex min-h-24 items-end gap-1.5 overflow-x-auto pb-5">
                  {timeline.map(point => (
                    <div key={point.date} className="group flex min-w-7 flex-1 flex-col items-center justify-end gap-1">
                      <span className="invisible text-[9px] text-slate-500 group-hover:visible">{point.applications}</span>
                      <div className="w-full rounded-t bg-violet-400 transition-colors group-hover:bg-violet-600" style={{ height: `${Math.max(8, (point.applications / maxTimelineApplications) * 68)}px` }} />
                      <span className="text-[9px] text-slate-400">{point.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">AI Agent activity</h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    ["Shortlisted", agentActions.shortlisted, "text-blue-600"],
                    ["Review zone", agentActions.review_zone, "text-amber-600"],
                    ["Rejected", agentActions.rejected, "text-rose-600"],
                    ["Emails sent", agentActions.emailsSent, "text-violet-600"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                {agentActions.failed > 0 && <p className="mt-3 text-[11px] text-rose-600">{agentActions.failed} agent action{agentActions.failed === 1 ? "" : "s"} failed and need attention.</p>}
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Application sources</h3>
                {sources.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-400">No source data yet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {sources.slice(0, 5).map(source => (
                      <div key={source.source}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium text-slate-700">{source.source}</span>
                          <span className="text-slate-500">{source.applications} · {source.averageScore == null ? "—" : `${source.averageScore}% avg`}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.max(4, (source.applications / Math.max(1, sources[0].applications)) * 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Question signal performance</h3>
                  <p className="mt-1 text-[11px] text-slate-400">Which questions are separating strong answers from thin ones.</p>
                </div>
                <span className="hidden text-[10px] text-slate-400 sm:block">Strong signal rate</span>
              </div>
              {questionPerformance.length === 0 ? (
                <p className="mt-4 text-xs text-slate-400">Question insights appear after candidates are scored.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {questionPerformance.slice(0, 8).map(question => (
                    <div key={question.questionId}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-xs font-medium text-slate-700">{question.label}</p>
                        <span className={`shrink-0 text-xs font-bold ${question.signalRate >= 60 ? "text-emerald-600" : question.thinSignals > question.strongSignals ? "text-amber-600" : "text-slate-600"}`}>
                          {question.signalRate}%
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(2, (question.answered / maxQuestionAnswers) * 100)}%` }} /></div>
                        <span className="w-28 text-right text-[10px] text-slate-400">{question.strongSignals} strong · {question.thinSignals} thin</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {stageAging.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {stageAging.map(item => (
                  <span key={item.stage} className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
                    {stageLabel[item.stage] || item.stage}: <b className="text-slate-700">{item.averageDays}d avg</b>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {analysis.generatedAt && (
          <p className="text-right text-[10px] text-slate-400">
            Updated {new Date(analysis.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
      </div>
    </section>
  );
}

function FormAssessmentAnalyticsPanel({ formId, token }: { formId: string; token: string }) {
  const [analytics, setAnalytics] = useState<FormAssessmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!token) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/assessment-analytics`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.analytics) throw new Error(data.error || "Could not load assessment analytics.");
      setAnalytics(data.analytics);
    } catch (err: any) {
      setError(err?.message || "Could not load assessment analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="h-5 w-48 rounded rb-skeleton" /><div className="mt-4 h-20 rounded-xl rb-skeleton" /></section>;
  }
  if (error) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs text-rose-500">{error}</p></section>;
  }
  if (!analytics || analytics.sent === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Assessment analytics</h2>
            <p className="mt-1 text-xs text-slate-500">Send an assessment to see completion, scoring, and question-level performance.</p>
          </div>
          <button onClick={() => load(true)} disabled={refreshing} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-300 disabled:opacity-50">
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>
    );
  }

  const statItems = [
    { label: "Sent", value: analytics.sent, tone: "text-indigo-700" },
    { label: "Started", value: analytics.started, tone: "text-violet-700" },
    { label: "Completed", value: analytics.completed, tone: "text-emerald-700" },
    { label: "Passed", value: `${analytics.passed} · ${analytics.passRate}%`, tone: "text-blue-700" },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Assessment analytics</h2>
          <p className="mt-1 text-xs text-slate-500">Persisted candidate progress and assessment outcomes.</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-300 disabled:opacity-50">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statItems.map(item => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className={`text-lg font-bold ${item.tone}`}>{item.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="text-lg font-bold text-slate-800">{analytics.completionRate}%</p>
            <p className="text-[11px] text-slate-500">Completion rate</p>
          </div>
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="text-lg font-bold text-slate-800">{analytics.assessmentToInterviewRate}%</p>
            <p className="text-[11px] text-slate-500">Assessment → interview</p>
          </div>
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="text-lg font-bold text-slate-800">{analytics.averageCompletionMinutes ?? "—"}<span className="ml-1 text-xs font-medium">min</span></p>
            <p className="text-[11px] text-slate-500">Average completion time</p>
          </div>
        </div>
        {(analytics.pending > 0 || analytics.scoringPending > 0 || analytics.scoringFailed > 0) && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {analytics.pending > 0 && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">{analytics.pending} pending</span>}
            {analytics.scoringPending > 0 && <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">{analytics.scoringPending} scoring</span>}
            {analytics.scoringFailed > 0 && <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">{analytics.scoringFailed} scoring failed</span>}
          </div>
        )}
        {analytics.questionPerformance.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Question drop-off</h3>
              <span className="text-[10px] text-slate-400">Answer rate</span>
            </div>
            <div className="space-y-2">
              {analytics.questionPerformance.map((question, index) => (
                <div key={question.questionId} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-[10px] font-bold text-slate-400">Q{index + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-xs text-slate-600">{question.text}</p>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${question.answerRate}%` }} />
                  </div>
                  <span className="w-9 text-right text-[11px] font-bold text-slate-700">{question.answerRate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FormHiringSummaryPanel({ formId, token }: { formId: string; token: string }) {
  const [summary, setSummary] = useState<FormHiringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async (refresh = false) => {
    if (!token) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const path = refresh
        ? `/recruit/forms/${formId}/ai-summary/refresh`
        : `/recruit/forms/${formId}/ai-summary`;
      const res = await fetch(apiUrl(path), {
        method: refresh ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (data.summary) setSummary(data.summary);
      if (!res.ok && !data.summary) throw new Error(data.error || "Could not load AI summary.");
      if (!res.ok) setError(data.error || "AI refresh failed. Showing the last saved summary.");
    } catch (err: any) {
      setError(err?.message || "Could not load AI summary.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formId, token]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 space-y-3">
        <div className="h-4 w-40 rounded-full rb-skeleton" />
        <div className="h-3 w-3/4 rounded-full rb-skeleton" />
        <div className="h-3 w-1/2 rounded-full rb-skeleton" />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
              <SparkIcon />
            </span>
            <h2 className="text-sm font-bold text-slate-900">AI Hiring Summary</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Evidence-based guidance from this form’s real responses.</p>
        </div>
        <button
          onClick={() => loadSummary(true)}
          disabled={refreshing}
          className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : summary ? "Refresh summary" : "Generate summary"}
        </button>
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {error}
          </div>
        )}
        {!summary ? (
          <div className="rounded-xl border border-dashed border-violet-200 bg-white/70 px-5 py-7 text-center">
            <p className="text-sm font-semibold text-slate-700">No AI summary saved yet</p>
            <p className="mt-1 text-xs text-slate-500">Generate one after responses have been scored.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-700">{summary.summary}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: "What’s working", items: summary.strengths, color: "border-emerald-200 bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-500" },
                { title: "Risks to watch", items: summary.risks, color: "border-amber-200 bg-amber-50", text: "text-amber-800", dot: "bg-amber-500" },
                { title: "Recommended next steps", items: summary.recommendations, color: "border-sky-200 bg-sky-50", text: "text-sky-800", dot: "bg-sky-500" },
              ].map(group => (
                <div key={group.title} className={`rounded-xl border p-3 ${group.color}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wide ${group.text}`}>{group.title}</p>
                  {group.items.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No clear signal yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {group.items.map((item, index) => (
                        <li key={`${group.title}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-700">
                          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${group.dot}`} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {(summary.highSignalQuestions.length > 0 || summary.lowSignalQuestions.length > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { title: "High-signal questions", items: summary.highSignalQuestions, color: "text-emerald-700" },
                  { title: "Questions to review", items: summary.lowSignalQuestions, color: "text-amber-700" },
                ].map(group => (
                  <div key={group.title} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${group.color}`}>{group.title}</p>
                    {group.items.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {group.items.map((item, index) => <li key={index} className="text-xs leading-5 text-slate-600">{item}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">Not enough evidence yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-right text-[10px] text-slate-400">
              Generated {new Date(summary.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function FormResponsesContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSaved = searchParams.get("saved") === "1";

  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(justSaved);
  const [stageFilter, setStageFilter] = useState<FormStageFilter>("all");
  const [activeTab, setActiveTab] = useState<FormPageTab>("responses");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>("");
  const [showCopilot, setShowCopilot] = useState(false);

  const emailRecipients = useMemo<CreatorEmailRecipient[]>(
    () =>
      responses
        .filter((response) => response.submittedEmail?.trim())
        .map((response) => ({
          id: response._id,
          name: response.submittedName || "Applicant",
          email: response.submittedEmail!.trim(),
        })),
    [responses],
  );

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (sessionToken) setToken(sessionToken);
  }, [sessionToken]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [formRes, respRes] = await Promise.all([
        fetch(apiUrl(`/recruit/forms/${id}`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl(`/recruit/forms/${id}/responses`), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const fd = await readApiJson(formRes);
      const rd = await readApiJson(respRes);
      if (fd.form) setForm(fd.form);
      if (rd.responses) setResponses(rd.responses);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function onUpdate(responseId: string, patch: Partial<FormResponse>) {
    setResponses(prev => prev.map(r => r._id === responseId ? { ...r, ...patch } : r));
  }

  function onDelete(responseId: string) {
    setResponses(prev => prev.filter(r => r._id !== responseId));
  }

  async function exportResponses(format: "csv" | "json") {
    if (!token) return;
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${id}/export?format=${format}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await readApiJson(res).catch(() => ({}));
        throw apiErrorFromPayload(res.status, data, data.message || data.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(form?.title || "form").replace(/[^a-z0-9]/gi, "_")}_responses.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err);
    }
    finally { setExporting(false); }
  }

  const filtered = responses.filter(r => matchesFormStageFilter(r.stage, stageFilter));
  const companyName = form?.jobDetails?.companyName?.trim() || "";

  function scrollToResponse(responseId: string) {
    setActiveTab("responses");
    setHighlightId(responseId);
    setTimeout(() => {
      document.getElementById(`form-response-${responseId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightId(null), 2500);
    }, 100);
  }

  function handleShare() {
    markFormChecklistStep(id, "shared");
    setShowShare(true);
  }

  const stats = [
    { label: "Total", value: responses.length, accent: "text-slate-800" },
    { label: "Shortlisted", value: responses.filter(r => r.stage === "shortlisted").length, accent: "text-blue-600" },
    { label: "Interview", value: responses.filter(r => r.stage === "interview").length, accent: "text-amber-600" },
    { label: "Hired", value: responses.filter(r => r.stage === "hired").length, accent: "text-emerald-600" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 animate-[rb-fade-in_0.3s_ease_both]">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="h-4 w-20 rounded-full rb-skeleton" />
              <div className="h-4 w-32 rounded-full rb-skeleton" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded-lg rb-skeleton" />
              <div className="h-8 w-24 rounded-lg rb-skeleton" />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2">
                <div className="h-6 w-10 rounded-lg rb-skeleton" />
                <div className="h-3 w-20 rounded-full rb-skeleton" />
              </div>
            ))}
          </div>
          {/* Response list */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
            <div className="h-4 w-32 rounded-full rb-skeleton mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100">
                <div className="h-10 w-10 rounded-full rb-skeleton shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-36 rounded-full rb-skeleton" />
                  <div className="h-3 w-24 rounded-full rb-skeleton" />
                </div>
                <div className="h-6 w-12 rounded-lg rb-skeleton" />
                <div className="h-6 w-16 rounded-full rb-skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4">
        <p className="text-slate-500">Form not found.</p>
        <Link href="/recruit/dashboard?tab=forms" className="mt-4 text-sm text-violet-600 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {showShare && (
        <ShareModal slug={form.slug} title={form.title} onClose={() => setShowShare(false)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/recruit/dashboard?tab=forms" className="shrink-0 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
              Dashboard
            </Link>
            <span className="text-slate-300 shrink-0">|</span>
            <span className="text-sm font-semibold text-slate-900 truncate">{form.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCopilot(true)}
              className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition"
              title="Ask Copilot about this form"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
              </svg>
              Copilot
            </button>
            <Link
              href={`/recruit/copilot?workspace=form&formId=${id}`}
              className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Full Copilot
            </Link>
            <Link
              href={`/recruit/forms/new?edit=${id}`}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Edit Form
            </Link>
            <button
              onClick={() => exportResponses("csv")}
              disabled={exporting || responses.length === 0}
              title="Download all responses as CSV"
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
              Share
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-5">
        {exportError ? <FormErrorNotice error={exportError} /> : null}
        <FormTabNav active={activeTab} onChange={setActiveTab} responseCount={responses.length} />

        <FormPostCreateChecklist
          formId={id}
          formTitle={form.title}
          responseCount={responses.length}
          agentEnabled={form.agentMode?.enabled === true}
          onShare={handleShare}
          onOpenAutopilot={() => setActiveTab("autopilot")}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {activeTab === "insights" && (
          <>
            <FormAnalysisPanel formId={id} token={token!} />
            <FormAssessmentAnalyticsPanel formId={id} token={token!} />
            <FormHiringSummaryPanel formId={id} token={token!} />
          </>
        )}

        {activeTab === "autopilot" && (
          <>
            <AgentModeCard
              formId={id}
              token={token!}
              agentMode={form.agentMode ?? DEFAULT_AGENT_MODE}
              responses={responses}
              onSaved={mode => setForm(f => (f ? { ...f, agentMode: mode } : f))}
            />
            <PipelineRulesCard
              formId={id}
              token={token!}
              rules={form.pipelineRules ?? []}
              onChange={rules => setForm(f => (f ? { ...f, pipelineRules: rules } : f))}
            />
            {form.questions && form.questions.length > 0 && (
              <ScoringCriteriaCard questions={form.questions} formTitle={form.title} />
            )}
          </>
        )}

        {activeTab === "responses" && (
          <>
            <FormNeedsAttention responses={responses} onSelectResponse={scrollToResponse} />
            <FormTopPicks responses={responses} onSelect={scrollToResponse} />

            <div className="flex flex-wrap gap-2 items-center">
              {FORM_STAGE_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setStageFilter(f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    stageFilter === f.id
                      ? "bg-violet-600 text-white shadow"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400">{filtered.length} response{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-sm font-semibold text-slate-700">
                  {responses.length === 0 ? "No responses yet" : `No ${stageFilter} responses`}
                </p>
                <p className="mt-1.5 text-xs text-slate-400 max-w-xs">
                  {responses.length === 0 ? "Share your form link to start receiving applications." : "Try a different filter."}
                </p>
                {responses.length === 0 && (
                  <button onClick={handleShare} className="mt-5 flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition">
                    Share Form Link
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map(r => (
                  <div
                    key={r._id}
                    id={`form-response-${r._id}`}
                    className={highlightId === r._id ? "ring-2 ring-violet-400 ring-offset-2 rounded-3xl transition" : ""}
                  >
                    <ResponseCard
                      r={r}
                      token={token!}
                      formId={id}
                      formTitle={form.title}
                      companyName={companyName}
                      onUpdate={(responseId, patch) => {
                        markFormChecklistStep(id, "reviewedApplicant");
                        onUpdate(responseId, patch);
                      }}
                      onDelete={onDelete}
                      recipientPool={emailRecipients}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {token && form && (
        <FormCopilotDrawer
          formId={id}
          formTitle={form.title}
          token={token}
          open={showCopilot}
          onClose={() => setShowCopilot(false)}
        />
      )}
    </div>
  );
}

export default function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RecruitGuard requiredRole="creator"><FormResponsesContent id={id} /></RecruitGuard>;
}
