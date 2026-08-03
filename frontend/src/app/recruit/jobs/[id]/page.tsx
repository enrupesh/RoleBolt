"use client";

import { useState, useEffect, useCallback, useRef, use, Suspense, useMemo } from "react";
import HiringAutopilotHub from "./HiringAutopilotHub";
import type { HubSection } from "./HiringAutopilotHub";
import JobTabNav, { type JobTabId } from "./JobTabNav";
import NeedsAttentionQueue, { buildAttentionItems, type AttentionAction, type AttentionItem } from "./NeedsAttentionQueue";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import { trackEvent } from "@/lib/trackEvent";
import { apiUrl, readApiJson } from "@/lib/api";
import { formatJobDescription } from "@/lib/jobDescription";
import AssessmentAnalyticsTab from "./AssessmentAnalyticsTab";
import LiveAssessmentProgressTab from "./LiveAssessmentProgressTab";
import BulkImportModal from "./BulkImportModal";
import CollaborationTab from "./CollaborationTab";
import AiHiringSummaryTab from "./AiHiringSummaryTab";
import WhatIfSimulator from "./WhatIfSimulator";
import JobAnalysisTab from "./JobAnalysisTab";
import HiringTimeline from "./HiringTimeline";
import JobPageTour from "./JobPageTour";
import CopilotDrawer from "./CopilotDrawer";
import StageEmailFlow, { isStageEmailNotifyStage } from "./StageEmailFlow";
import { markChecklistStep } from "@/components/PostCreateChecklist";
import { CreatorEmailComposer, type CreatorEmailRecipient } from "@/components/CreatorEmailComposer";

function getFrontendUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.rolebolt.tech";
}

type Confidence = "high" | "medium" | "low";
type ScoreBreakdown = { criterion: string; score: number; maxScore: number; reasoning: string; confidence?: Confidence; tier?: 1 | 2 | 3 };
type CandidateStage = "applied" | "review_zone" | "screened" | "assessed" | "interview" | "offer" | "hired" | "rejected";
type AssessmentStatus = "not_sent" | "invited" | "sent" | "completed";
type HiringDecision = "strong_yes" | "maybe" | "no" | null;

type AssessmentImpact = {
  strengths: string[];
  weaknesses: string[];
  reasoning: string;
};

type EmailLogEntry = {
  _id?: string;
  type: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
};

type OfferTemplate = "full_time" | "internship" | "contract" | "remote" | "custom";

type OfferDetails = {
  startDate?: string;
  salary?: string;
  salaryCurrency?: string;
  signingBonus?: string;
  benefits?: string;
  companyName?: string;
  hiringManagerName?: string;
  offerExpiryDate?: string;
  reportingManager?: string;
};

type OfferLogEntry = {
  _id?: string;
  action: string;
  note: string;
  timestamp: string;
};

type Candidate = {
  _id: string;
  name: string;
  email: string;
  totalScore: number;
  maxScore: number;
  scoreBreakdown: ScoreBreakdown[];
  aiSummary: string;
  redFlags: string[];
  strengths: string[];
  stage: CandidateStage;
  stageMovedAt?: string;
  notes: string;
  interviewBrief: string;
  createdAt: string;
  agentLog?: Array<{ action: string; score?: number; reason?: string; timestamp?: string }>;
  assessmentStatus: AssessmentStatus;
  assessmentToken?: string;
  assessmentSentAt?: string;
  assessmentCompletedAt?: string;
  assessmentReminderSentAt?: string;
  previousResumeScore: number;
  hiringDecision: HiringDecision;
  assessmentImpact?: AssessmentImpact;
  scoringFailed?: boolean;
  emailLog?: EmailLogEntry[];
  offerLetter?: string;
  offerStatus?: "none" | "draft" | "approved" | "sent" | "expired";
  offerTemplate?: string;
  offerToken?: string;
  offerCandidateStatus?: "pending" | "viewed" | "accepted" | "declined" | "expired";
  offerDetails?: OfferDetails;
  offerSignature?: { signedAt?: string; signerName?: string; method?: string };
  offerReminderConfig?: {
    enabled: boolean;
    delayDays: number;
    frequencyDays: number;
    maxReminders: number;
    remindersSent: number;
    lastReminderSentAt?: string;
  };
  offerVersions?: Array<{
    versionNumber: number;
    content: string;
    template: string;
    details: OfferDetails;
    editedAt: string;
    changeSummary: string;
  }>;
  offerLog?: OfferLogEntry[];
  inTalentPool?: boolean;
  talentPoolNote?: string;
  pipelineRuleState?: Record<string, string>;
  aiHiringSynthesis?: {
    recommendation: "hire" | "hold" | "pass";
    executiveSummary: string;
    strengths: string[];
    weaknesses: string[];
    riskFactors: string[];
    keyReasons: string[];
    overallFit: string;
    suggestedNextStep: string;
    generatedAt?: string;
    generatedBy?: string;
    recruiterDecision?: "accepted" | "overridden" | "ignored";
    recruiterDecisionNote?: string;
    recruiterDecisionAt?: string;
  };
};

type RubricCriteria = { name: string; weight: number; description: string };
type AgentMode = {
  enabled: boolean;
  shortlistThreshold: number;
  rejectThreshold: number;
  autoEmailShortlist: boolean;
  autoEmailReject: boolean;
  autoSendAssessment: boolean;
  emailReviewZoneCandidates: boolean;
};

type PerformanceAlert = {
  id: string;
  type: "low_applications" | "no_hire_14_days" | "high_reject_rate";
  message: string;
  aiSuggestions: string[];
  createdAt: string;
  dismissed: boolean;
};

type PipelineRule = {
  id: string;
  condition: "score_above" | "score_below" | "assessment_passed" | "assessment_failed" | "stage_age_days";
  threshold: number;
  fromStage?: string;
  action: "move_to_screened" | "move_to_assessed" | "move_to_interview" | "move_to_offer" | "move_to_rejected" | "send_assessment" | "send_reminder";
  enabled: boolean;
  triggerCount: number;
};
type Job = {
  _id: string;
  title: string;
  department: string;
  seniority: string;
  location: string;
  companyName?: string;
  pipelineRules?: PipelineRule[];
  performanceAlerts?: PerformanceAlert[];
  workMode: string;
  status: string;
  generatedJD: string;
  rubric: RubricCriteria[];
  candidateCount: number;
  mustHaveSkills: string;
  createdAt: string;
  agentMode?: AgentMode;
};

const STAGES: { id: CandidateStage; label: string; color: string; bg: string }[] = [
  { id: "applied", label: "Applied", color: "text-slate-700", bg: "bg-slate-200/70 border-slate-400/40" },
  { id: "review_zone", label: "Review", color: "text-amber-800", bg: "bg-amber-100 border-amber-400/40" },
  { id: "screened", label: "Screened", color: "text-blue-700", bg: "bg-blue-100 border-blue-400/40" },
  { id: "assessed", label: "Assessed", color: "text-violet-700", bg: "bg-violet-100 border-violet-400/40" },
  { id: "interview", label: "Interview", color: "text-amber-800", bg: "bg-amber-100 border-amber-400/40" },
  { id: "offer", label: "Offer", color: "text-sky-700", bg: "bg-sky-100 border-sky-400/40" },
  { id: "hired", label: "Hired", color: "text-emerald-700", bg: "bg-emerald-100 border-emerald-400/40" },
  { id: "rejected", label: "Rejected", color: "text-rose-700", bg: "bg-rose-100 border-rose-400/40" },
];

function getStageStyle(stage: CandidateStage) {
  return STAGES.find(s => s.id === stage) ?? STAGES[0];
}

function scoreColor(pct: number) {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-rose-600";
}

function scoreBarColor(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function confidenceStyle(c: Confidence) {
  if (c === "high") return { dot: "bg-emerald-500", text: "text-emerald-600", label: "High confidence", pill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
  if (c === "low")  return { dot: "bg-rose-500",    text: "text-rose-600",    label: "Low confidence",  pill: "bg-rose-500/10 text-rose-600 border-rose-500/20" };
  return               { dot: "bg-amber-500",   text: "text-amber-700",   label: "Med. confidence", pill: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
}

function overallConfidence(breakdown: ScoreBreakdown[]): Confidence {
  if (breakdown.length === 0) return "medium";

  const tier1 = breakdown.filter(b => (b.tier ?? 1) === 1);

  // If any Tier 1 criterion is low, the overall can never be High
  const tier1HasLow = tier1.some(b => (b.confidence ?? "medium") === "low");

  // Weighted score: high=2, medium=1, low=0
  // Tier 1 carries 3× weight, Tier 2 carries 2×, Tier 3 carries 1×
  let totalWeight = 0;
  let weightedScore = 0;
  for (const b of breakdown) {
    const weight = b.tier === 3 ? 1 : b.tier === 2 ? 2 : 3;
    const score  = b.confidence === "high" ? 2 : b.confidence === "low" ? 0 : 1;
    totalWeight  += weight;
    weightedScore += weight * score;
  }

  const avg = totalWeight > 0 ? weightedScore / totalWeight : 1;
  if (avg >= 1.4 && !tier1HasLow) return "high";
  if (avg <= 0.6) return "low";
  return "medium";
}

function decisionBadge(decision: HiringDecision) {
  if (!decision) return null;
  const map = {
    strong_yes: { label: "Strong Yes", icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25" },
    maybe: { label: "Maybe", icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, cls: "bg-amber-500/15 text-amber-700 border-amber-500/25" },
    no: { label: "No", icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, cls: "bg-rose-500/15 text-rose-600 border-rose-500/25" },
  };
  return map[decision] ?? null;
}

function assessmentStatusBadge(status: AssessmentStatus) {
  const map: Record<AssessmentStatus, { label: string; cls: string }> = {
    not_sent: { label: "Not Sent", cls: "bg-zinc-500/10 text-gray-500 border-zinc-500/20" },
    invited: { label: "Invited", cls: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
    sent: { label: "In Progress", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    completed: { label: "Completed", cls: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  };
  return map[status] ?? map.not_sent;
}

function ChevronLeftIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>;
}
function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
}
function SparkIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>;
}
function AlertIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
}
function CheckCircleIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>;
}
function SendIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
}
function CopyIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>;
}
function BellIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
}
function MailIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
}
function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}

function AssessmentLinkModal({ link, candidateName, candidateEmail, emailSent, onClose }: {
  link: string; candidateName: string; candidateEmail: string; emailSent?: boolean; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/[0.09] bg-[#0a0a0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Assessment Ready</h2>
            <p className="text-xs text-gray-400 mt-0.5">For {candidateName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition"><XIcon /></button>
        </div>
        <div className="p-6 space-y-4">
          {!candidateEmail ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5">
              <p className="text-[11px] text-amber-300/80">No email address on file for {candidateName} — share this link manually.</p>
            </div>
          ) : emailSent ? (
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3">
              <span className="text-emerald-400 shrink-0"><CheckIcon /></span>
              <p className="text-[12px] text-emerald-300 leading-5">
                Assessment link emailed to <strong>{candidateEmail}</strong>. The URL below is a backup.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5">
              <p className="text-[11px] text-amber-300/80">
                Email not sent automatically (SMTP may not be configured). Copy this link and share with {candidateName} at <strong>{candidateEmail}</strong>.
              </p>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Assessment URL (backup / share manually)</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-xs text-gray-500 break-all min-w-0">{link}</div>
              <button
                onClick={copy}
                className={`shrink-0 flex items-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                  copied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-500/25"
                }`}
              >
                <CopyIcon /> {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-white/[0.07] px-6 py-4">
          <button onClick={onClose} className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-400 transition">Done</button>
        </div>
      </div>
    </div>
  );
}

function RejectionEmailModal({ email, candidateName, candidateEmail, jobId, candidateId, token, onClose, onSent, deleteMode, onDeleted }: {
  email: string; candidateName: string; candidateEmail: string;
  jobId: string; candidateId: string; token: string;
  onClose: () => void; onSent: (entry: EmailLogEntry) => void;
  deleteMode?: boolean; onDeleted?: () => void;
}) {
  const [body, setBody] = useState(email);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const subject = `Update on your application`;

  async function send() {
    if (!candidateEmail) { setSendError("No email address on file for this candidate."); return; }
    setSending(true); setSendError("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${candidateId}/send-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "rejected", subject, body }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Send failed.");
      onSent({ type: "rejected", to: candidateEmail, subject, body, sentAt: data.sentAt || new Date().toISOString(), status: "sent" });
      if (deleteMode) {
        onDeleted?.();
        onClose();
      } else {
        setSent(true);
      }
    } catch (e: any) {
      setSendError(e.message);
      if (candidateEmail) {
        onSent({ type: "rejected", to: candidateEmail, subject, body, sentAt: new Date().toISOString(), status: "failed", error: e.message });
      }
    }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/[0.09] bg-[#0a0a0f] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{deleteMode ? "Send Email & Remove" : "AI Rejection Email"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">To: {candidateName}{candidateEmail ? ` · ${candidateEmail}` : <span className="inline-flex items-center gap-1 text-amber-500"> · <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m10.29 3.86-8.58 14.86A1 1 0 0 0 2.57 20h18.86a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> no email on file</span>}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition"><XIcon /></button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-3">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
              <p className="text-sm font-semibold text-emerald-400">Email sent to {candidateEmail}</p>
              <p className="text-xs text-gray-400">It will appear in the Email History panel below.</p>
            </div>
          ) : (
            <>
              {deleteMode && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
                  <p className="text-[11px] text-amber-300 leading-5">
                    <span className="font-bold">Why send this email?</span> This lets the applicant know they were not selected, so they can move on and apply elsewhere instead of waiting indefinitely for a response.
                  </p>
                </div>
              )}
              <p className="text-[11px] text-gray-400">Edit the email below before sending. Your edits only affect this send — the AI text is not saved.</p>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={deleteMode ? 10 : 12}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-gray-200 leading-7 placeholder-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none"
              />
              {sendError && <p className="text-xs text-rose-400">{sendError}</p>}
            </>
          )}
        </div>
        <div className="flex justify-between gap-3 border-t border-white/[0.07] px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button
              onClick={send}
              disabled={sending || !body.trim()}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
            >
              {sending ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <SendIcon />}
              {sending ? "Sending…" : deleteMode ? "Send & Remove" : "Send to Candidate"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const SOURCE_OPTIONS = ["LinkedIn", "Indeed", "Naukri", "Referral", "Company Website", "Angel List", "Walk-in", "Other"];

// ── Offer Letter helpers ──────────────────────────────────────────────────────

const OFFER_TEMPLATES: { id: OfferTemplate; label: string; emoji: string }[] = [
  { id: "full_time",  label: "Full-Time",  emoji: "💼" },
  { id: "internship", label: "Internship", emoji: "🎓" },
  { id: "contract",   label: "Contract",   emoji: "📋" },
  { id: "remote",     label: "Remote",     emoji: "🌐" },
  { id: "custom",     label: "Custom",     emoji: "✏️" },
];

function offerStatusPill(status?: string) {
  if (status === "sent")     return { label: "Sent",     cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  if (status === "approved") return { label: "Approved", cls: "bg-sky-500/15 text-sky-400 border-sky-500/25" };
  if (status === "draft")    return { label: "Draft",    cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  if (status === "expired")  return { label: "Expired",  cls: "bg-rose-500/15 text-rose-400 border-rose-500/25" };
  return null;
}

function offerCandidatePill(status?: string) {
  if (status === "accepted") return { label: "Accepted ✓", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  if (status === "declined") return { label: "Declined",   cls: "bg-rose-500/15 text-rose-400 border-rose-500/25" };
  if (status === "viewed")   return { label: "Viewed",     cls: "bg-sky-500/15 text-sky-400 border-sky-500/25" };
  if (status === "expired")  return { label: "Expired",    cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25" };
  if (status === "pending")  return { label: "Pending",    cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  return null;
}

function offerExpiryCountdown(offerExpiryDate?: string): { label: string; urgent: boolean } | null {
  if (!offerExpiryDate) return null;
  const expiry = new Date(offerExpiryDate);
  const now    = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs < 0) return { label: "Expired", urgent: true };
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return { label: "Expires today", urgent: true };
  if (days === 1) return { label: "1 day left",    urgent: true };
  if (days <= 3)  return { label: `${days} days left`, urgent: true };
  return { label: `${days} days left`, urgent: false };
}

function offerActionLabel(action: string) {
  const m: Record<string, string> = {
    draft_generated:          "Draft generated by AI",
    offer_edited:             "Draft edited by recruiter",
    offer_approved:           "Offer approved",
    offer_sent:               "Offer email sent to candidate",
    offer_accepted:           "Candidate accepted the offer",
    offer_declined:           "Candidate declined the offer",
    offer_viewed:             "Candidate viewed the offer",
    offer_expired:            "Offer expired",
    reminder_sent:            "Reminder email sent",
    expiry_warning_sent:      "Expiry warning sent to recruiter",
    version_restored:         "Previous version restored",
    offer_expiry_extended:    "Offer expiry date extended",
    offer_reactivated:        "Offer reactivated with new expiry date",
    offer_extension_notified: "Extension notification sent to candidate",
  };
  return m[action] ?? action.replace(/_/g, " ");
}

function OptLabel() {
  return <span className="text-zinc-700 normal-case tracking-normal font-normal">(optional)</span>;
}

type OfferVersion = { _id?: string; versionNumber: number; content: string; template: string; details: OfferDetails; editedAt: string; changeSummary: string };
type ReminderCfg  = { enabled: boolean; delayDays: number; frequencyDays: number; maxReminders: number; remindersSent: number; lastReminderSentAt?: string };

function OfferLetterModal({ candidate, job, token, onClose, onSent, onUpdate }: {
  candidate: Candidate;
  job: Job;
  token: string;
  onClose: () => void;
  onSent: (entry: EmailLogEntry) => void;
  onUpdate?: (update: Partial<Candidate>) => void;
}) {
  const saved: OfferDetails = candidate.offerDetails || {};

  // ── Form / letter state ────────────────────────────────────────────────────
  const [template, setTemplate]     = useState<OfferTemplate>((candidate.offerTemplate as OfferTemplate) || "full_time");
  const [startDate, setStartDate]   = useState(saved.startDate || "");
  const [salary, setSalary]         = useState(saved.salary || "");
  const [currency, setCurrency]     = useState(saved.salaryCurrency || "INR");
  const [signingBonus, setSigningBonus] = useState(saved.signingBonus || "");
  const [benefits, setBenefits]     = useState(saved.benefits || "");
  const [companyName, setCompanyName] = useState(saved.companyName || "");
  const [hiringMgr, setHiringMgr]   = useState(saved.hiringManagerName || "");
  const [reportingMgr, setReportingMgr] = useState(saved.reportingManager || "");
  const [expiryDate, setExpiryDate] = useState(saved.offerExpiryDate || "");
  const [letter, setLetter]         = useState(candidate.offerLetter || "");
  const [showForm, setShowForm]     = useState(!candidate.offerLetter);
  const [offerStatus, setOfferStatus] = useState<string>(candidate.offerStatus || "none");
  const [candidateStatus, setCandidateStatus] = useState<string>(candidate.offerCandidateStatus || "");
  const [offerToken, setOfferToken] = useState<string>(candidate.offerToken || "");
  const [offerLog, setOfferLog]     = useState<OfferLogEntry[]>((candidate.offerLog as OfferLogEntry[]) || []);

  // ── Version history state ──────────────────────────────────────────────────
  const [versions, setVersions]         = useState<OfferVersion[]>((candidate.offerVersions as OfferVersion[]) || []);
  const [previewVersion, setPreviewVersion] = useState<OfferVersion | null>(null);
  const [restoring, setRestoring]       = useState<string | null>(null);

  // ── Reminder config state ──────────────────────────────────────────────────
  const defaultReminder: ReminderCfg = { enabled: true, delayDays: 2, frequencyDays: 2, maxReminders: 3, remindersSent: 0 };
  const [reminderCfg, setReminderCfg]   = useState<ReminderCfg>((candidate.offerReminderConfig as ReminderCfg) || defaultReminder);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderMsg, setReminderMsg]   = useState("");

  // ── Tab + UI state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<"draft" | "versions" | "settings">("draft");
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState("");
  const [saveMsg, setSaveMsg]           = useState("");
  const [showLog, setShowLog]           = useState(false);
  const [copied, setCopied]             = useState(false);

  // ── Extend / Reactivate state ──────────────────────────────────────────────
  const [showExtendPanel, setShowExtendPanel] = useState(false);
  const [newExpiry, setNewExpiry]             = useState(saved.offerExpiryDate || "");
  const [sendNotif, setSendNotif]             = useState(false);
  const [extendLoading, setExtendLoading]     = useState(false);
  const [extendMsg, setExtendMsg]             = useState("");

  const offerUrl = offerToken ? `${getFrontendUrl()}/recruit/offer/${offerToken}` : "";

  // ── Actions ────────────────────────────────────────────────────────────────
  async function generate(regenerate = false) {
    if (!startDate.trim() || !salary.trim()) { setError("Start date and salary are required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startDate, salary, salaryCurrency: currency, signingBonus, benefits, companyName, hiringManagerName: hiringMgr, reportingManager: reportingMgr, offerExpiryDate: expiryDate, template, regenerate }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to generate offer letter.");
      setLetter(data.offerLetter);
      setOfferStatus(data.offerStatus || "draft");
      if (data.offerLog) setOfferLog(data.offerLog);
      if (data.offerVersions) setVersions(data.offerVersions);
      setShowForm(false);
      onUpdate?.({ offerLetter: data.offerLetter, offerStatus: data.offerStatus, offerTemplate: template, offerDetails: data.offerDetails, offerLog: data.offerLog });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function saveDraft() {
    if (!letter.trim()) return;
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offerLetter: letter }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setOfferStatus(data.offerStatus || "draft");
      if (data.offerLog)      setOfferLog(data.offerLog);
      if (data.offerVersions) setVersions(data.offerVersions);
      setSaveMsg("Saved ✓");
      setTimeout(() => setSaveMsg(""), 2500);
      onUpdate?.({ offerLetter: letter, offerStatus: data.offerStatus, offerLog: data.offerLog, offerVersions: data.offerVersions });
    } catch (e: any) { setSaveMsg(`Error: ${e.message}`); }
    finally { setSaving(false); }
  }

  async function approveAndSend() {
    if (!candidate.email) { setError("No email address on file for this candidate."); return; }
    setSending(true); setError("");
    try {
      await fetch(apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offerLetter: letter }),
      });
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to send offer.");
      setOfferStatus("sent");
      setCandidateStatus("pending");
      if (data.offerToken) setOfferToken(data.offerToken);
      if (data.offerLog)   setOfferLog(data.offerLog);
      // Sync reminder config defaults
      if (!(candidate.offerReminderConfig as any)?.enabled) {
        setReminderCfg({ enabled: true, delayDays: 2, frequencyDays: 2, maxReminders: 3, remindersSent: 0 });
      }
      const entry: EmailLogEntry = {
        type: "offer", to: candidate.email,
        subject: `Job Offer — ${job.title}`, body: letter,
        sentAt: data.sentAt || new Date().toISOString(), status: "sent",
      };
      onSent(entry);
      onUpdate?.({ offerStatus: "sent", offerCandidateStatus: "pending", offerToken: data.offerToken, offerLog: data.offerLog });
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  }

  async function restoreVersion(v: OfferVersion) {
    if (!v._id) return;
    setRestoring(v._id);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter/versions/${v._id}/restore`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Restore failed.");
      setLetter(data.offerLetter);
      setOfferStatus(data.offerStatus || "draft");
      if (data.offerVersions) setVersions(data.offerVersions);
      if (data.offerLog)      setOfferLog(data.offerLog);
      setPreviewVersion(null);
      setActiveTab("draft");
      setShowForm(false);
      onUpdate?.({ offerLetter: data.offerLetter, offerStatus: data.offerStatus, offerVersions: data.offerVersions, offerLog: data.offerLog });
    } catch (e: any) { alert(e.message); }
    finally { setRestoring(null); }
  }

  async function saveReminderConfig() {
    setSavingReminder(true); setReminderMsg("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter/reminder-config`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(reminderCfg),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      if (data.offerReminderConfig) setReminderCfg(data.offerReminderConfig);
      setReminderMsg("Saved ✓");
      setTimeout(() => setReminderMsg(""), 2500);
      onUpdate?.({ offerReminderConfig: data.offerReminderConfig });
    } catch (e: any) { setReminderMsg(`Error: ${e.message}`); }
    finally { setSavingReminder(false); }
  }

  function downloadPdf() {
    const url = apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter/pdf`);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error("PDF generation failed"); return r.blob(); })
      .then(blob => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `offer-letter-${candidate.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      })
      .catch(e => alert(e.message || "Failed to download PDF."));
  }

  function copyLink() {
    if (!offerUrl) return;
    navigator.clipboard.writeText(offerUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function extendExpiry() {
    if (!newExpiry) { setExtendMsg("Please select a new expiry date."); return; }
    const isReactivating = offerStatus === "expired";
    setExtendLoading(true); setExtendMsg("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/candidates/${candidate._id}/offer-letter/extend-expiry`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newExpiryDate: newExpiry, sendNotification: sendNotif }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to extend expiry.");
      if (data.offerStatus)  setOfferStatus(data.offerStatus);
      if (data.offerCandidateStatus) setCandidateStatus(data.offerCandidateStatus);
      if (data.offerLog)     setOfferLog(data.offerLog);
      if (data.offerVersions) setVersions(data.offerVersions);
      // Update the local expiryDate display
      if (data.offerDetails?.offerExpiryDate) setExpiryDate(data.offerDetails.offerExpiryDate);
      setExtendMsg(isReactivating ? "Offer reactivated ✓" : "Expiry extended ✓");
      setTimeout(() => { setExtendMsg(""); setShowExtendPanel(false); }, 2500);
      onUpdate?.({
        offerStatus: data.offerStatus,
        offerCandidateStatus: data.offerCandidateStatus,
        offerDetails: data.offerDetails,
        offerLog: data.offerLog,
        offerVersions: data.offerVersions,
      });
    } catch (e: any) { setExtendMsg(`Error: ${e.message}`); }
    finally { setExtendLoading(false); }
  }

  const pill         = offerStatusPill(offerStatus);
  const candPill     = offerCandidatePill(candidateStatus);
  const expiry       = offerExpiryCountdown(saved.offerExpiryDate || expiryDate);
  const hasDraft     = !!letter.trim();
  const TABS = [
    { id: "draft",    label: "Draft" },
    { id: "versions", label: `Versions${versions.length ? ` (${versions.length})` : ""}` },
    { id: "settings", label: "Reminders" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/[0.09] bg-[#0a0a0f] shadow-2xl max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="border-b border-white/[0.07] px-6 pt-4 pb-0 shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-white">Offer Letter — {candidate.name}</h2>
                {pill && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pill.cls}`}>{pill.label}</span>}
                {candPill && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${candPill.cls}`}>{candPill.label}</span>}
                {expiry && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${expiry.urgent ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-white/10 text-gray-500"}`}>
                    ⏰ {expiry.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{job.title} · AI-generated, recruiter-approved before sending</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition shrink-0 ml-3"><XIcon /></button>
          </div>

          {/* ── Offer URL banner (when sent) ── */}
          {offerStatus === "sent" && offerUrl && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 mb-3">
              <span className="text-[10px] text-emerald-400 font-semibold shrink-0">Offer Link:</span>
              <span className="text-[10px] text-gray-400 truncate flex-1 font-mono">{offerUrl}</span>
              <button onClick={copyLink} className="shrink-0 rounded-lg border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 hover:text-white hover:border-white/25 transition">
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <a href={offerUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] text-indigo-400 hover:text-indigo-300 transition">Preview ↗</a>
            </div>
          )}

          {/* ── Tab bar (shown once there's a draft) ── */}
          {hasDraft && !showForm && (
            <div className="flex gap-1 -mb-px">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`rounded-t-xl px-4 py-2 text-[11px] font-semibold transition border-b-2 ${
                    activeTab === t.id
                      ? "border-indigo-500 text-indigo-300 bg-indigo-500/[0.06]"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        {showForm ? (
          /* ── Phase 1: Details form ── */
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-2">Letter Template</label>
              <div className="flex gap-2 flex-wrap">
                {OFFER_TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setTemplate(t.id)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      template === t.id
                        ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                        : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:text-white hover:border-white/20"
                    }`}
                  ><span>{t.emoji}</span>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Start Date *</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#0a0a0f] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50">
                  {["INR","USD","GBP","EUR","AED","SGD","AUD","CAD"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">{template === "internship" ? "Stipend" : "Annual Salary"} *</label>
              <input type="text" value={salary} onChange={e => setSalary(e.target.value)} placeholder={template === "internship" ? "e.g. 20,000 per month" : "e.g. 12,00,000 or 80,000"} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Company Name <OptLabel /></label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Hiring Manager <OptLabel /></label>
                <input type="text" value={hiringMgr} onChange={e => setHiringMgr(e.target.value)} placeholder="Name on signature" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Reporting Manager <OptLabel /></label>
                <input type="text" value={reportingMgr} onChange={e => setReportingMgr(e.target.value)} placeholder="Direct manager name" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Signing Bonus <OptLabel /></label>
                <input type="text" value={signingBonus} onChange={e => setSigningBonus(e.target.value)} placeholder="e.g. 50,000" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Key Benefits <OptLabel /></label>
                <input type="text" value={benefits} onChange={e => setBenefits(e.target.value)} placeholder="Health, PTO, flexible hours…" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Offer Expiry Date <OptLabel /></label>
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
              </div>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>

        ) : activeTab === "draft" ? (
          /* ── Tab: Draft editor ── */
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <textarea
              value={letter}
              onChange={e => setLetter(e.target.value)}
              rows={18}
              className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-[13px] text-gray-300 leading-7 font-mono resize-none outline-none focus:border-indigo-500/30 transition"
              spellCheck={false}
            />
            {offerLog.length > 0 && (
              <div>
                <button onClick={() => setShowLog(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition">
                  Activity Log ({offerLog.length}) <span className="ml-0.5 text-[9px]">{showLog ? "▲" : "▼"}</span>
                </button>
                {showLog && (
                  <div className="mt-2 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    {[...offerLog].reverse().map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/50" />
                        <span className="text-gray-300 flex-1">{offerActionLabel(entry.action)}</span>
                        <span className="shrink-0 text-gray-600">
                          {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                          {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* ── Extend / Reactivate panel ── */}
            {showExtendPanel && (
              <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.05] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-indigo-300">
                    {offerStatus === "expired" ? "🔄 Reactivate Offer" : "📅 Extend Offer Expiry"}
                  </p>
                  <button onClick={() => { setShowExtendPanel(false); setExtendMsg(""); }} className="text-gray-500 hover:text-white transition text-[11px]">✕</button>
                </div>
                {offerStatus === "expired" && (
                  <p className="text-[11px] text-gray-400">This offer has expired. Setting a new expiry date will reactivate it — no new offer letter will be generated.</p>
                )}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1.5">New Expiry Date</label>
                  <input
                    type="date"
                    value={newExpiry}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setNewExpiry(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendNotif}
                    onChange={e => setSendNotif(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-indigo-500"
                  />
                  <span className="text-[11px] text-gray-400">
                    Send notification email to candidate with new deadline
                  </span>
                </label>
                {extendMsg && (
                  <p className={`text-[11px] font-medium ${extendMsg.startsWith("Error") ? "text-rose-400" : "text-emerald-400"}`}>{extendMsg}</p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={extendExpiry}
                    disabled={extendLoading || !newExpiry}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
                  >
                    {extendLoading
                      ? <><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                      : offerStatus === "expired" ? "Reactivate Offer" : "Save New Expiry"
                    }
                  </button>
                </div>
              </div>
            )}
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>

        ) : activeTab === "versions" ? (
          /* ── Tab: Version history ── */
          <div className="p-6 overflow-y-auto flex-1">
            {versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <p className="text-xs text-gray-500">No saved versions yet.</p>
                <p className="text-[11px] text-gray-600 mt-1">Versions are automatically saved each time you edit and save the draft.</p>
              </div>
            ) : previewVersion ? (
              /* Version preview */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Version {previewVersion.versionNumber}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{previewVersion.changeSummary} · {new Date(previewVersion.editedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPreviewVersion(null)} className="rounded-xl border border-white/[0.08] px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition">← Back</button>
                    <button
                      onClick={() => restoreVersion(previewVersion)}
                      disabled={!!restoring}
                      className="rounded-xl bg-indigo-500 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
                    >
                      {restoring === previewVersion._id ? "Restoring…" : "Restore This Version"}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-[12px] text-gray-400 leading-6 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {previewVersion.content}
                </div>
              </div>
            ) : (
              /* Version list */
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Saved Versions — click to preview and restore</p>
                {[...versions].reverse().map((v) => (
                  <button
                    key={v._id || v.versionNumber}
                    onClick={() => setPreviewVersion(v)}
                    className="w-full text-left rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 hover:border-indigo-500/30 hover:bg-indigo-500/[0.04] transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition">
                          v{v.versionNumber} — {v.changeSummary}
                        </span>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {new Date(v.editedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                          {new Date(v.editedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          {v.template && v.template !== "full_time" && ` · ${v.template}`}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-600 group-hover:text-indigo-400 transition">Preview →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* ── Tab: Reminder settings ── */
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Automatic Reminder Emails</h3>
              <p className="text-[11px] text-gray-500">Configure how the system follows up with candidates who haven't responded to the offer.</p>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-white">Enable reminders</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Automatically email the candidate if they haven't responded</p>
              </div>
              <button
                onClick={() => setReminderCfg(c => ({ ...c, enabled: !c.enabled }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${reminderCfg.enabled ? "bg-indigo-500" : "bg-white/[0.1]"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${reminderCfg.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {reminderCfg.enabled && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1.5">First reminder after</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="14" value={reminderCfg.delayDays} onChange={e => setReminderCfg(c => ({ ...c, delayDays: +e.target.value }))}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
                    <span className="text-xs text-gray-500 shrink-0">days</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1.5">Repeat every</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="14" value={reminderCfg.frequencyDays} onChange={e => setReminderCfg(c => ({ ...c, frequencyDays: +e.target.value }))}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
                    <span className="text-xs text-gray-500 shrink-0">days</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1.5">Max reminders</label>
                  <input type="number" min="1" max="10" value={reminderCfg.maxReminders} onChange={e => setReminderCfg(c => ({ ...c, maxReminders: +e.target.value }))}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
                </div>
              </div>
            )}

            {reminderCfg.remindersSent > 0 && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-4 py-3">
                <p className="text-xs text-sky-400 font-medium">{reminderCfg.remindersSent} of {reminderCfg.maxReminders} reminders sent</p>
                {reminderCfg.lastReminderSentAt && (
                  <p className="text-[10px] text-gray-500 mt-0.5">Last sent: {new Date(reminderCfg.lastReminderSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                )}
              </div>
            )}

            {reminderMsg && (
              <p className={`text-xs ${reminderMsg.startsWith("Error") ? "text-rose-400" : "text-emerald-400"}`}>{reminderMsg}</p>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-6 py-4 shrink-0 flex-wrap">
          {showForm ? (
            <>
              <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-gray-400 hover:text-white transition">Cancel</button>
              <button onClick={() => generate(false)} disabled={loading || !startDate || !salary}
                className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
              >
                {loading ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating…</> : <><SparkIcon /> Generate Offer Letter</>}
              </button>
            </>
          ) : activeTab === "settings" ? (
            <>
              <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-gray-400 hover:text-white transition">Close</button>
              <button onClick={saveReminderConfig} disabled={savingReminder}
                className="rounded-xl bg-indigo-500 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
              >
                {savingReminder ? "Saving…" : "Save Settings"}
              </button>
            </>
          ) : activeTab === "versions" ? (
            <>
              <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-gray-400 hover:text-white transition">Close</button>
              {previewVersion && (
                <button onClick={() => restoreVersion(previewVersion)} disabled={!!restoring}
                  className="rounded-xl bg-indigo-500 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
                >
                  {restoring ? "Restoring…" : "Restore This Version"}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setShowForm(true); setError(""); }} className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-gray-400 hover:text-white transition">
                Edit Details
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => generate(true)} disabled={loading} className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-gray-400 hover:text-white transition disabled:opacity-50">
                  {loading ? "Generating…" : "Regenerate"}
                </button>
                <button onClick={saveDraft} disabled={saving} className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/15 transition disabled:opacity-50">
                  {saveMsg || (saving ? "Saving…" : "Save Draft")}
                </button>
                <button onClick={downloadPdf} className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-gray-300 hover:text-white hover:border-white/20 transition">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  PDF
                </button>
                {offerStatus === "sent" ? (
                  <>
                    <span className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 px-4 py-2 text-xs font-semibold text-emerald-400">
                      <CheckIcon /> Sent ✓
                    </span>
                    <button
                      onClick={() => { setShowExtendPanel(v => !v); setActiveTab("draft"); setExtendMsg(""); }}
                      className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.07] px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-500/15 transition"
                    >
                      📅 Extend Expiry
                    </button>
                  </>
                ) : offerStatus === "expired" ? (
                  <>
                    <button
                      onClick={() => { setShowExtendPanel(v => !v); setActiveTab("draft"); setExtendMsg(""); }}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition"
                    >
                      🔄 Reactivate Offer
                    </button>
                  </>
                ) : (
                  <button onClick={approveAndSend} disabled={sending || !candidate.email || !letter.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
                  >
                    {sending ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <MailIcon />}
                    {sending ? "Sending…" : "Approve & Send"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type PreviousApplication = {
  jobTitle: string;
  stage: string;
  totalScore: number;
  maxScore: number;
  rejectedAt: string;
  aiSummary: string;
};

function AddCandidateModal({ jobId, token, onClose, onAdded }: {
  jobId: string; token: string; onClose: () => void; onAdded: () => void;
}) {
  const [resumeText, setResumeText] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previousApp, setPreviousApp] = useState<PreviousApplication | null>(null);
  const [added, setAdded] = useState(false);

  async function handleSubmit() {
    if (!resumeText.trim()) return;
    setLoading(true);
    setError("");
    setPreviousApp(null);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText, source }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to add candidate.");
      if (data.previousApplication) {
        setPreviousApp(data.previousApplication);
        setAdded(true);
        onAdded();
      } else {
        onAdded();
        onClose();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (previousApp && added) {
    const scorePct = previousApp.maxScore > 0 ? Math.round((previousApp.totalScore / previousApp.maxScore) * 100) : 0;
    const rejectedDate = new Date(previousApp.rejectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-[2rem] border border-amber-500/20 bg-[#0a0a0f] shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-6 py-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Returning Candidate Detected</h2>
              <p className="text-xs text-gray-400 mt-0.5">AI Memory found a previous application on record</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-4 space-y-2">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Previous Application</p>
              <p className="text-sm text-white font-medium">{previousApp.jobTitle}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>Stage reached: <span className="text-gray-600 capitalize">{previousApp.stage}</span></span>
                <span>·</span>
                <span>Score: <span className="text-gray-600">{scorePct}%</span></span>
                <span>·</span>
                <span>{rejectedDate}</span>
              </div>
              {previousApp.aiSummary && (
                <p className="text-xs text-gray-500 pt-1 border-t border-white/[0.06]">{previousApp.aiSummary}</p>
              )}
            </div>
            <p className="text-xs text-gray-400">The candidate has been added to the pipeline. Keep this history in mind during evaluation.</p>
          </div>
          <div className="flex justify-end border-t border-white/[0.07] px-6 py-4">
            <button onClick={onClose} className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-400 transition">Got it</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/[0.09] bg-[#0a0a0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Add Candidate</h2>
            <p className="text-xs text-gray-400 mt-0.5">Paste the resume text — AI will score it automatically</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition"><XIcon /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-2">Resume Text *</label>
            <textarea
              value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              rows={10}
              placeholder="Paste the full resume text here — name, contact info, work experience, skills, education, projects, etc."
              className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none caret-indigo-600"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-2">Source <span className="text-zinc-700 normal-case tracking-normal">(optional)</span></label>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full rounded-2xl border border-white/[0.08] bg-[#0a0a0f] px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
            >
              <option value="">Select source...</option>
              {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.05] px-4 py-3">
            <p className="text-[11px] text-indigo-300/70 flex items-center gap-1">
              <SparkIcon /> AI will score the resume, detect strengths & red flags, and check if this candidate has applied before.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/[0.07] px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !resumeText.trim()}
            className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Scoring...</>
            ) : (
              <><SparkIcon /> Score & Add</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function RetryIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>;
}
function BotIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="16" y1="15" x2="16" y2="15.01"/></svg>;
}
function UserIcon2() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}

// ── AI Agent Mode Toggle ──────────────────────────────────────────────────────
function AgentModeToggle({ job, token, onUpdate, onOpenHub }: {
  job: Job;
  token: string;
  onUpdate: (agentMode: AgentMode) => void;
  onOpenHub?: () => void;
}) {
  const am = job.agentMode ?? { enabled: false, shortlistThreshold: 75, rejectThreshold: 40, autoEmailShortlist: true, autoEmailReject: false, autoSendAssessment: false, emailReviewZoneCandidates: false };
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState<AgentMode>(am);

  useEffect(() => {
    setLocalSettings(job.agentMode ?? {
      enabled: false,
      shortlistThreshold: 75,
      rejectThreshold: 40,
      autoEmailShortlist: true,
      autoEmailReject: false,
      autoSendAssessment: false,
      emailReviewZoneCandidates: false,
    });
  }, [job.agentMode, job._id]);

  // Sync if job prop changes
  const enabled = am.enabled;

  async function toggleEnabled() {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/agent-mode`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await res.json();
      if (res.ok && data.agentMode) {
        onUpdate(data.agentMode);
        setLocalSettings(data.agentMode);
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}/agent-mode`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(localSettings),
      });
      const data = await res.json();
      if (res.ok && data.agentMode) {
        onUpdate(data.agentMode);
        setOpen(false);
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  return (
    <div className="relative" data-tour="agent-toggle">
      {/* ── Master Toggle Button ── */}
      <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition ${
        enabled
          ? "border-indigo-500/40 bg-indigo-500/10"
          : "border-[var(--border)] bg-[var(--surface-muted)]"
      }`}>
        <button
          onClick={toggleEnabled}
          disabled={saving}
          title={enabled ? "Switch to Manual Mode" : "Switch to AI Agent Mode"}
          className={`relative flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
            enabled ? "bg-indigo-500" : "bg-gray-400/40"
          } ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`} />
        </button>

        <div className="flex items-center gap-1.5">
          {enabled ? (
            <span className="text-indigo-400"><BotIcon /></span>
          ) : (
            <span className="text-[var(--text-muted)]"><UserIcon2 /></span>
          )}
          <div>
            <p className={`text-[11px] font-bold leading-none ${enabled ? "text-indigo-300" : "text-[var(--text-secondary)]"}`}>
              {enabled ? "AI Agent" : "Manual"}
            </p>
            <p className="text-[9px] text-[var(--text-muted)] mt-0.5 leading-none">
              {enabled ? "AI handles pipeline" : "You control everything"}
            </p>
          </div>
        </div>

        <button
          onClick={() => (onOpenHub ? onOpenHub() : setOpen(o => !o))}
          className="ml-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition"
          title={onOpenHub ? "Open Hiring Autopilot" : "Configure AI Agent settings"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a1 1 0 0 0-1.41 0l-.71.71A8 8 0 0 0 4.93 17.66l.71.71a1 1 0 0 0 1.41 0L8 17.41A8 8 0 0 0 19.07 4.93z"/>
          </svg>
        </button>
      </div>

      {/* ── Settings Panel ── */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400"><BotIcon /></span>
                <p className="text-sm font-bold text-[var(--foreground)]">AI Agent Settings</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition"><XIcon /></button>
            </div>

            {/* What AI Agent does */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">When AI Agent is ON, it will:</p>
              <p className="text-[11px] text-indigo-200/80">🎯 Auto-shortlist candidates scoring above threshold</p>
              <p className="text-[11px] text-indigo-200/80">❌ Auto-reject candidates scoring below threshold</p>
              <p className="text-[11px] text-indigo-200/80">📧 Send emails automatically (per settings below)</p>
              <p className="text-[11px] text-indigo-200/80">📝 Auto-send assessments to shortlisted candidates (optional)</p>
            </div>

            {/* Shortlist Threshold */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Shortlist if score ≥</label>
                <span className="text-sm font-bold text-emerald-600">{localSettings.shortlistThreshold}%</span>
              </div>
              <input
                type="range" min={50} max={95} step={5}
                value={localSettings.shortlistThreshold}
                onChange={e => setLocalSettings(s => ({ ...s, shortlistThreshold: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-0.5">
                <span>50% (Lenient)</span><span>95% (Strict)</span>
              </div>
            </div>

            {/* Reject Threshold */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Reject if score &lt;</label>
                <span className="text-sm font-bold text-rose-600">{localSettings.rejectThreshold}%</span>
              </div>
              <input
                type="range" min={10} max={60} step={5}
                value={localSettings.rejectThreshold}
                onChange={e => setLocalSettings(s => ({ ...s, rejectThreshold: Number(e.target.value) }))}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-0.5">
                <span>10% (Rare)</span><span>60% (Aggressive)</span>
              </div>
            </div>

            {/* Email Options */}
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Automatic Emails</p>

              {/* Auto shortlist email */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-[12px] text-[var(--text-secondary)]">Email shortlisted candidates</p>
                  <p className="text-[10px] text-[var(--text-muted)]">&quot;You&apos;ve been shortlisted&quot; email</p>
                </div>
                <button
                  onClick={() => setLocalSettings(s => ({ ...s, autoEmailShortlist: !s.autoEmailShortlist }))}
                  className={`relative flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors ${
                    localSettings.autoEmailShortlist ? "bg-emerald-500" : "bg-gray-400/30"
                  }`}
                >
                  <span className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    localSettings.autoEmailShortlist ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>

              {/* Auto reject email */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-[12px] text-[var(--text-secondary)]">Email rejected candidates</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Polite rejection email</p>
                </div>
                <button
                  onClick={() => setLocalSettings(s => ({ ...s, autoEmailReject: !s.autoEmailReject }))}
                  className={`relative flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors ${
                    localSettings.autoEmailReject ? "bg-rose-500" : "bg-gray-400/30"
                  }`}
                >
                  <span className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    localSettings.autoEmailReject ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>

              {/* Review zone email */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-[12px] text-[var(--text-secondary)]">Email review zone candidates</p>
                  <p className="text-[10px] text-[var(--text-muted)]">&quot;Your application is under review&quot;</p>
                </div>
                <button
                  onClick={() => setLocalSettings(s => ({ ...s, emailReviewZoneCandidates: !s.emailReviewZoneCandidates }))}
                  className={`relative flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors ${
                    localSettings.emailReviewZoneCandidates ? "bg-amber-500" : "bg-gray-400/30"
                  }`}
                >
                  <span className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    localSettings.emailReviewZoneCandidates ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>

              {/* Auto assessment */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-[12px] text-[var(--text-secondary)]">Auto-send assessment to shortlisted</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Sends AI assessment immediately after shortlist</p>
                </div>
                <button
                  onClick={() => setLocalSettings(s => ({ ...s, autoSendAssessment: !s.autoSendAssessment }))}
                  className={`relative flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors ${
                    localSettings.autoSendAssessment ? "bg-indigo-500" : "bg-gray-400/30"
                  }`}
                >
                  <span className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    localSettings.autoSendAssessment ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Score Zones</p>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="flex-1 rounded-l-full bg-rose-500/20 px-2 py-1 text-center text-rose-600 font-semibold">
                  0–{localSettings.rejectThreshold-1}% → Reject
                </span>
                <span className="flex-1 bg-amber-500/10 px-2 py-1 text-center text-amber-700 font-semibold">
                  {localSettings.rejectThreshold}–{localSettings.shortlistThreshold-1}% → Review
                </span>
                <span className="flex-1 rounded-r-full bg-emerald-500/20 px-2 py-1 text-center text-emerald-700 font-semibold">
                  {localSettings.shortlistThreshold}%+ → Shortlist
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition">
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
              >
                {saving ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : null}
                {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ResumeSection({ resumeText }: { resumeText: string }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_CHARS = 600;
  const isLong = resumeText.length > PREVIEW_CHARS;
  const displayed = expanded || !isLong ? resumeText : resumeText.slice(0, PREVIEW_CHARS) + "…";

  function copyResume() {
    navigator.clipboard.writeText(resumeText).catch(() => {});
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
          <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
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

type CandidateAppInfo = {
  name: string; email: string; phone?: string;
  location?: string; currentStatus?: string; educationLevel?: string;
  currentClassYear?: string; availability?: string; coverLetter?: string; linkedinUrl?: string;
  resumeText?: string;
};

function ApplicantDetailsModal({ c, jobId, token, onClose }: {
  c: Candidate; jobId: string; token: string; onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [appData, setAppData] = useState<CandidateAppInfo | null>(null);
  const [copied, setCopied] = useState<"email" | "phone" | null>(null);

  useEffect(() => {
    fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}/seeker-profile`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => readApiJson(r))
      .then(d => { if (d.candidate) setAppData(d.candidate); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [c._id, jobId, token]);

  function copyToClipboard(text: string, field: "email" | "phone") {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  const pct = (!c.scoringFailed && c.maxScore > 0) ? Math.round((c.totalScore / c.maxScore) * 100) : null;
  const appliedDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  const hasExtraDetails = appData?.phone || appData?.linkedinUrl || appData?.location || appData?.coverLetter || appData?.currentStatus || appData?.educationLevel || appData?.availability || appData?.resumeText;

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicant-details-title"
        className="w-full max-w-md rounded-[2rem] border border-white/[0.08] bg-[#0a0a0f] shadow-2xl max-h-[88vh] flex flex-col"
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 id="applicant-details-title" className="text-sm font-bold text-white truncate">{c.name}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Applicant Details</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            {pct !== null && (
              <div className="text-right">
                <p className={`text-base font-bold leading-none ${scoreColor(pct)}`}>{pct}%</p>
                <p className="text-[10px] text-gray-500 mt-0.5">match score</p>
              </div>
            )}
            {appliedDate && (
              <div className="text-right">
                <p className="text-[10px] text-gray-400 leading-none">Applied</p>
                <p className="text-[11px] font-semibold text-gray-300 mt-0.5">{appliedDate}</p>
              </div>
            )}
            <Link
              href={`/recruit/copilot?jobId=${jobId}&candidateId=${c._id}`}
              className="shrink-0 flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/50 transition"
              title="Ask Rolebolt AI about this candidate"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
              </svg>
              Ask Rolebolt
            </Link>
            <button onClick={onClose} aria-label="Close applicant details" className="ml-1 text-gray-400 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <>
              {/* ── Email — always shown, highlighted at top ── */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.09] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/70 mb-2">Email Address</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-sky-300 break-all leading-snug">{c.email}</p>
                  <button
                    onClick={() => copyToClipboard(c.email, "email")}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-bold text-sky-400 hover:bg-sky-500/20 transition"
                  >
                    {copied === "email" ? (
                      <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Copied</>
                    ) : (
                      <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                    )}
                  </button>
                </div>
                <a
                  href={`mailto:${c.email}`}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-500/80 hover:text-sky-400 transition"
                >
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
                  Send email →
                </a>
              </div>

              {/* ── Phone ── */}
              {appData?.phone && (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Phone</p>
                    <a href={`tel:${appData.phone}`} className="text-sm font-bold text-white hover:text-sky-300 transition">{appData.phone}</a>
                  </div>
                  <button
                    onClick={() => copyToClipboard(appData!.phone!, "phone")}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-gray-400 hover:bg-white/[0.09] transition"
                  >
                    {copied === "phone" ? (
                      <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Copied</>
                    ) : (
                      <><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                    )}
                  </button>
                </div>
              )}

              {/* ── LinkedIn ── */}
              {appData?.linkedinUrl && (
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">LinkedIn</p>
                  <a
                    href={appData.linkedinUrl.startsWith("http") ? appData.linkedinUrl : `https://${appData.linkedinUrl}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition"
                  >
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                    View LinkedIn Profile →
                  </a>
                </div>
              )}

              {/* ── Details grid: location, status, education, availability, applied date ── */}
              {(appData?.location || appData?.currentStatus || appData?.educationLevel || appData?.availability || appliedDate) && (
                <div className="grid grid-cols-2 gap-2">
                  {appData?.location && (
                    <div className="col-span-2 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <div>
                        <p className="text-[10px] text-gray-500">Location</p>
                        <p className="text-xs font-semibold text-gray-200">{appData.location}</p>
                      </div>
                    </div>
                  )}
                  {appData?.currentStatus && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="text-[10px] text-gray-500 mb-0.5">Current Status</p>
                      <p className="text-xs font-semibold text-gray-200">{appData.currentStatus}</p>
                    </div>
                  )}
                  {appData?.availability && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="text-[10px] text-gray-500 mb-0.5">Availability</p>
                      <p className="text-xs font-semibold text-gray-200">{appData.availability}</p>
                    </div>
                  )}
                  {appData?.educationLevel && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="text-[10px] text-gray-500 mb-0.5">Education</p>
                      <p className="text-xs font-semibold text-gray-200">{appData.educationLevel}{appData.currentClassYear ? ` · ${appData.currentClassYear}` : ""}</p>
                    </div>
                  )}
                  {appliedDate && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="text-[10px] text-gray-500 mb-0.5">Applied On</p>
                      <p className="text-xs font-semibold text-gray-200">{appliedDate}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Cover letter ── */}
              {appData?.coverLetter && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Cover Letter</p>
                  <p className="text-xs text-gray-400 leading-5 whitespace-pre-line">{appData.coverLetter}</p>
                </div>
              )}

              {/* ── Resume ── */}
              {appData?.resumeText ? (
                <ResumeSection resumeText={appData.resumeText} />
              ) : (
                !loading && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Resume</p>
                    <p className="text-xs text-gray-600">No resume was submitted with this application.</p>
                  </div>
                )
              )}

              {/* ── Empty state ── */}
              {!loading && !hasExtraDetails && (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-5 text-center">
                  <p className="text-xs text-gray-500">No additional contact details were provided.</p>
                  <p className="text-[11px] text-gray-600 mt-1">Email is the only contact info available.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-white/[0.07] px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-xl bg-zinc-800 px-5 py-2 text-sm font-bold text-white hover:bg-zinc-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AI Recommendation Badge + Hover Popover ──────────────────────────────*/
const AI_REC_CONFIG = {
  hire: { emoji: "🤖", label: "Hire", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  hold: { emoji: "⏳", label: "Hold", cls: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  pass: { emoji: "❌", label: "Pass", cls: "border-rose-500/40 bg-rose-500/10 text-rose-400" },
} as const;

function AiRecommendationBadge({
  synthesis,
  jobId,
  candidateId,
}: {
  synthesis?: Candidate["aiHiringSynthesis"];
  jobId: string;
  candidateId: string;
}) {
  const [hovered, setHovered] = useState(false);

  if (!synthesis) {
    return (
      <div className="mb-3">
        <span className="flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] w-fit">
          ⏳ AI Recommendation Pending
        </span>
      </div>
    );
  }

  const cfg = AI_REC_CONFIG[synthesis.recommendation];
  const pct = Math.round(
    (synthesis.strengths.length / Math.max(synthesis.strengths.length + synthesis.weaknesses.length, 1)) * 100
  );

  return (
    <div className="relative mb-3" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${cfg.cls}`}
        aria-haspopup="true"
        aria-expanded={hovered}
      >
        {cfg.emoji} AI: {cfg.label}
        {synthesis.recruiterDecision && (
          <span className="ml-0.5 text-[9px] opacity-70">· {synthesis.recruiterDecision}</span>
        )}
      </button>

      {hovered && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-black/20 ring-1 ring-[var(--border)]">
          {/* Recommendation header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">AI Recommendation</p>
              <p className={`text-base font-extrabold mt-0.5 ${
                synthesis.recommendation === "hire" ? "text-emerald-400" :
                synthesis.recommendation === "hold" ? "text-amber-400" : "text-rose-400"
              }`}>
                {cfg.emoji} {cfg.label}
              </p>
            </div>
            <a
              href={`/recruit/jobs/${jobId}?tab=ai-hiring`}
              className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-400 hover:bg-indigo-500/20 transition whitespace-nowrap"
              onClick={e => e.stopPropagation()}
            >
              Full Summary →
            </a>
          </div>

          {/* Executive summary */}
          {synthesis.executiveSummary && (
            <p className="text-[11px] leading-5 text-[var(--text-secondary)] mb-3 line-clamp-3">
              {synthesis.executiveSummary}
            </p>
          )}

          {/* Strengths */}
          {synthesis.strengths.slice(0, 3).length > 0 && (
            <div className="mb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/80 mb-1">Top Strengths</p>
              <ul className="space-y-0.5">
                {synthesis.strengths.slice(0, 3).map((s, i) => (
                  <li key={i} className="text-[10px] leading-4 text-[var(--text-secondary)] flex gap-1.5">
                    <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {synthesis.weaknesses.slice(0, 3).length > 0 && (
            <div className="mb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/80 mb-1">Concerns</p>
              <ul className="space-y-0.5">
                {synthesis.weaknesses.slice(0, 3).map((w, i) => (
                  <li key={i} className="text-[10px] leading-4 text-[var(--text-secondary)] flex gap-1.5">
                    <span className="text-rose-500 shrink-0 mt-0.5">·</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Overall fit */}
          {synthesis.overallFit && (
            <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Overall Fit</p>
              <p className="text-[10px] leading-4 text-[var(--text-secondary)] line-clamp-2">{synthesis.overallFit}</p>
            </div>
          )}

          {/* Footer: generated info */}
          {synthesis.generatedAt && (
            <p className="mt-2 text-[9px] text-[var(--text-muted)]">
              Generated {new Date(synthesis.generatedAt).toLocaleDateString()}
              {synthesis.generatedBy ? ` by ${synthesis.generatedBy}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ c, jobId, job, token, onUpdate, onDelete, highlighted, selected, onToggleSelect, recipientPool }: {
  c: Candidate; jobId: string; job: Job; token: string;
  onUpdate: (id: string, update: Partial<Candidate>) => void;
  onDelete: (id: string) => void;
  highlighted?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  recipientPool: CreatorEmailRecipient[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [brief, setBrief] = useState(c.interviewBrief || "");
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessmentLink, setAssessmentLink] = useState<string | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [rejectionEmail, setRejectionEmail] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [loadingReminder, setLoadingReminder] = useState(false);
  const [loadingRetry, setLoadingRetry] = useState(false);
  const [retryError, setRetryError] = useState("");
  const [showOfferLetterModal, setShowOfferLetterModal] = useState(false);
  const [showApplicantDetails, setShowApplicantDetails] = useState(false);
  const [localEmailLog, setLocalEmailLog] = useState<EmailLogEntry[]>(c.emailLog || []);
  const [assessmentEmailSent, setAssessmentEmailSent] = useState(false);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [togglingPool, setTogglingPool] = useState(false);
  const [interviewFeedback, setInterviewFeedback] = useState<Array<{
    body?: string;
    rating?: number;
    ratings?: Record<string, number>;
    author?: { name?: string };
    createdAt?: string;
  }> | null>(null);
  const [pendingStageEmail, setPendingStageEmail] = useState<CandidateStage | null>(null);
  const [showCreatorEmail, setShowCreatorEmail] = useState(false);
  const { authUser } = useRecruitAuth();

  useEffect(() => {
    if (!expanded || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          apiUrl(`/recruit/collaboration/jobs/${jobId}/candidates/${c._id}/collaboration`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (!cancelled && res.ok) {
          setInterviewFeedback(data.collaboration?.interviewFeedback ?? []);
        }
      } catch {
        if (!cancelled) setInterviewFeedback([]);
      }
    })();
    return () => { cancelled = true; };
  }, [expanded, c._id, jobId, token]);
  // Using c._id as the key so we only reset when the candidate identity changes, not on every render
  const prevCandidateId = useRef(c._id);
  useEffect(() => {
    if (prevCandidateId.current !== c._id) {
      prevCandidateId.current = c._id;
      setLocalEmailLog(c.emailLog || []);
    } else if (c.emailLog && c.emailLog.length > localEmailLog.length) {
      // Parent has more entries (e.g. after refetch) — merge without losing local additions
      setLocalEmailLog(c.emailLog);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c._id, c.emailLog?.length]);

  const scoringFailed = c.scoringFailed === true;
  const pct = (!scoringFailed && c.maxScore > 0) ? Math.round((c.totalScore / c.maxScore) * 100) : 0;
  const prevPct = c.maxScore > 0 && c.previousResumeScore ? Math.round((c.previousResumeScore / c.maxScore) * 100) : null;
  const stageStyle = getStageStyle(c.stage);
  const decision = decisionBadge(c.hiringDecision);
  const assessBadge = assessmentStatusBadge(c.assessmentStatus ?? "not_sent");
  const scoreChanged = c.assessmentStatus === "completed" && prevPct !== null && prevPct !== pct;

  async function updateStage(stage: CandidateStage) {
    if (stage === c.stage) return;
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage, skipAutoEmail: true }),
      });
      if (res.ok) {
        onUpdate(c._id, { stage });
        if (c.email && isStageEmailNotifyStage(stage)) {
          setPendingStageEmail(stage);
        }
      }
    } catch { /* silent */ }
  }

  async function fetchBrief() {
    if (brief) { setExpanded(true); return; }
    setLoadingBrief(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}/brief`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      setBrief(data.brief ?? "");
    } catch { /* silent */ }
    finally { setLoadingBrief(false); setExpanded(true); }
  }

  async function sendAssessment() {
    setLoadingAssessment(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}/assessment/send`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error);
      const link = data.assessmentUrl;
      setAssessmentLink(link);
      setAssessmentEmailSent(Boolean(data.emailSent));
      setShowAssessmentModal(true);
      onUpdate(c._id, { assessmentStatus: "invited", assessmentSentAt: new Date().toISOString(), stage: "screened" });
      if (data.emailSent && c.email) {
        setLocalEmailLog(prev => [...prev, {
          type: "assessment", to: c.email, subject: `Complete your assessment`, body: "",
          sentAt: new Date().toISOString(), status: "sent",
        }]);
      }
    } catch (e: any) {
      alert(e.message || "Failed to send assessment.");
    } finally {
      setLoadingAssessment(false);
    }
  }

  async function sendReminder() {
    setLoadingReminder(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}/reminder`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error);
      setAssessmentLink(data.assessmentUrl);
      setAssessmentEmailSent(Boolean(data.emailSent));
      setShowAssessmentModal(true);
      onUpdate(c._id, { assessmentReminderSentAt: new Date().toISOString() });
      if (data.emailSent && c.email) {
        setLocalEmailLog(prev => [...prev, {
          type: "assessment_reminder", to: c.email, subject: `Assessment reminder`, body: "",
          sentAt: new Date().toISOString(), status: "sent",
        }]);
      }
    } catch (e: any) {
      alert(e.message || "Failed to send reminder.");
    } finally {
      setLoadingReminder(false);
    }
  }

  async function generateRejectionEmail() {
    setLoadingReject(true);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}/reject-email`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error);
      setRejectionEmail(data.email);
      setShowRejectModal(true);
    } catch (e: any) {
      setDeleteMode(false); // reset delete mode if generation failed
      alert(e.message || "Failed to generate rejection email.");
    } finally {
      setLoadingReject(false);
    }
  }

  async function retryScoring() {
    setLoadingRetry(true);
    setRetryError("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}/retry-score`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Retry failed.");
      onUpdate(c._id, {
        name: data.candidate.name,
        email: data.candidate.email,
        totalScore: data.candidate.totalScore,
        maxScore: data.candidate.maxScore,
        scoreBreakdown: data.candidate.scoreBreakdown,
        aiSummary: data.candidate.aiSummary,
        redFlags: data.candidate.redFlags,
        strengths: data.candidate.strengths,
        scoringFailed: data.candidate.scoringFailed,
        stage: data.candidate.stage,
        stageMovedAt: data.candidate.stageMovedAt,
        agentLog: data.candidate.agentLog,
      });
    } catch (e: any) {
      setRetryError(e.message || "Retry failed. Please try again.");
    } finally {
      setLoadingRetry(false);
    }
  }

  async function handleDelete() {
    // If candidate has an email, send a rejection email first then remove
    if (c.email) {
      setDeleteMode(true);
      await generateRejectionEmail();
      return;
    }
    // No email on file — fall back to direct removal
    if (!confirm(`Remove ${c.name} from this pipeline?`)) return;
    try {
      await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      onDelete(c._id);
    } catch { /* silent */ }
  }

  async function deleteCandidateRecord() {
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) onDelete(c._id);
    } catch { /* silent */ }
  }

  async function toggleTalentPool() {
    setTogglingPool(true);
    try {
      const next = !c.inTalentPool;
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${c._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inTalentPool: next }),
      });
      if (res.ok) onUpdate(c._id, { inTalentPool: next });
    } catch { /* silent */ }
    finally { setTogglingPool(false); }
  }

  return (
    <>
      {showAssessmentModal && assessmentLink && (
        <AssessmentLinkModal
          link={assessmentLink}
          candidateName={c.name}
          candidateEmail={c.email}
          emailSent={assessmentEmailSent}
          onClose={() => setShowAssessmentModal(false)}
        />
      )}
      {showRejectModal && rejectionEmail && (
        <RejectionEmailModal
          email={rejectionEmail}
          candidateName={c.name}
          candidateEmail={c.email}
          jobId={jobId}
          candidateId={c._id}
          token={token}
          onClose={() => { setShowRejectModal(false); setDeleteMode(false); }}
          onSent={(entry) => setLocalEmailLog(prev => [...prev, entry])}
          deleteMode={deleteMode}
          onDeleted={deleteCandidateRecord}
        />
      )}
      {showOfferLetterModal && (
        <OfferLetterModal
          candidate={c}
          job={job}
          token={token}
          onClose={() => setShowOfferLetterModal(false)}
          onSent={(entry) => setLocalEmailLog(prev => [...prev, entry])}
          onUpdate={(update) => onUpdate(c._id, update)}
        />
      )}
      <CreatorEmailComposer
        open={showCreatorEmail}
        onClose={() => setShowCreatorEmail(false)}
        channel="standard"
        contextId={jobId}
        token={token}
        billingCategory="creator_standard"
        initialRecipientIds={[c._id]}
        recipientPool={recipientPool}
        senderPreview={{
          username: authUser?.username,
          email: authUser?.email,
          companyName: job.companyName,
        }}
        onSent={() => {
          setLocalEmailLog((prev) => [
            ...prev,
            {
              type: "creator_premium",
              to: c.email || "",
              subject: "Creator email",
              body: "",
              sentAt: new Date().toISOString(),
              status: "sent",
            },
          ]);
        }}
      />
      {showApplicantDetails && (
        <ApplicantDetailsModal
          c={c}
          jobId={jobId}
          token={token}
          onClose={() => setShowApplicantDetails(false)}
        />
      )}
      {pendingStageEmail && isStageEmailNotifyStage(pendingStageEmail) && (
        <StageEmailFlow
          stage={pendingStageEmail}
          candidateId={c._id}
          candidateName={c.name}
          candidateEmail={c.email}
          jobId={jobId}
          jobTitle={job.title}
          companyName={job.companyName || ""}
          token={token}
          onClose={() => setPendingStageEmail(null)}
          onSent={(entry) => setLocalEmailLog(prev => [...prev, entry])}
          onOpenOfferLetter={() => setShowOfferLetterModal(true)}
        />
      )}

      <div
        id={`candidate-${c._id}`}
        className={`rounded-3xl border bg-[var(--surface)] shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)] overflow-hidden ${
          highlighted ? "border-indigo-500 ring-2 ring-indigo-500/30" : selected ? "border-indigo-400/60 ring-1 ring-indigo-400/20" : "border-[var(--border)]"
        }`}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            {onToggleSelect && (
              <button
                type="button"
                onClick={() => onToggleSelect(c._id)}
                aria-label={selected ? "Deselect candidate" : "Select candidate"}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                  selected
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-[var(--border-strong)] bg-[var(--surface-muted)] text-transparent hover:border-indigo-400"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">{c.name}</h3>
                {decision && (
                  <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${decision.cls}`}>
                    {decision.icon} {decision.label}
                  </span>
                )}
                {c.redFlags.length > 0 && (
                  <span className="flex items-center gap-1 text-rose-400 text-[10px]"><AlertIcon /> {c.redFlags.length} flag{c.redFlags.length > 1 ? "s" : ""}</span>
                )}
              </div>
              {c.email && <p className="text-[11px] text-[var(--text-muted)]">{c.email}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                {scoringFailed ? (
                  <p className="text-sm font-semibold leading-none text-amber-400">Scoring<br/>unavailable</p>
                ) : (
                  <>
                    <p className={`text-lg font-bold leading-none ${scoreColor(pct)}`}>{pct}%</p>
                    {scoreChanged && prevPct !== null && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        <span className="line-through text-[var(--text-muted)]">{prevPct}%</span>
                        <span className={pct > prevPct ? " text-emerald-600" : " text-rose-600"}>
                          {" "}{pct > prevPct ? "▲" : "▼"}
                        </span>
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{c.totalScore}/{c.maxScore} pts</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mb-2 h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
            {!scoringFailed && (
              <div className={`h-full rounded-full transition-all ${scoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
            )}
          </div>
          {!scoringFailed && c.scoreBreakdown.length > 0 && (() => {
            const conf = overallConfidence(c.scoreBreakdown);
            const cs = confidenceStyle(conf);
            return (
              <div className="mb-3 flex items-center gap-1.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${cs.dot}`} />
                <span className={`text-[10px] font-medium ${cs.text}`}>{cs.label}</span>
              </div>
            );
          })()}

          {scoringFailed ? (
            <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
              <p className="text-[11px] text-amber-300/80 leading-5">Scoring temporarily unavailable — the AI couldn&apos;t analyze this resume. Use &ldquo;Retry Scoring&rdquo; to try again.</p>
              {retryError && <p className="mt-1 text-[11px] text-rose-400">{retryError}</p>}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] leading-5 line-clamp-2 mb-3">{c.aiSummary}</p>
          )}

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${assessBadge.cls}`}>
              Assessment: {assessBadge.label}
            </span>
            {c.assessmentSentAt && (c.assessmentStatus === "sent" || c.assessmentStatus === "invited") && (
              <span className="text-[10px] text-[var(--text-muted)]">
                Sent {new Date(c.assessmentSentAt).toLocaleDateString()}
              </span>
            )}
            {c.assessmentCompletedAt && (
              <span className="text-[10px] text-[var(--text-muted)]">
                Completed {new Date(c.assessmentCompletedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* ── AI Hiring Recommendation Badge ── */}
          <AiRecommendationBadge synthesis={c.aiHiringSynthesis} jobId={jobId} candidateId={c._id} />

          {/* ── Live Offer Response Status badge (offer / hired stage only) ── */}
          {(c.stage === "offer" || c.stage === "hired") && c.offerCandidateStatus && (() => {
            const statusMap: Record<string, { icon: string; label: string; cls: string }> = {
              pending:  { icon: "⏳", label: "Pending",  cls: "border-amber-500/30  bg-amber-500/10  text-amber-400"  },
              viewed:   { icon: "👀", label: "Viewed",   cls: "border-sky-500/30    bg-sky-500/10    text-sky-400"    },
              accepted: { icon: "✅", label: "Accepted", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
              declined: { icon: "❌", label: "Declined", cls: "border-rose-500/30   bg-rose-500/10   text-rose-400"   },
              expired:  { icon: "⌛", label: "Expired",  cls: "border-zinc-500/30   bg-zinc-500/10   text-zinc-400"   },
            };
            const s = statusMap[c.offerCandidateStatus];
            if (!s) return null;
            return (
              <div className="flex items-center gap-2 mb-3">
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>
                  <span>{s.icon}</span>
                  <span>Offer: {s.label}</span>
                </span>
                {c.offerCandidateStatus === "pending" && (
                  <span className="flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={c.stage}
              onChange={e => updateStage(e.target.value as CandidateStage)}
              className={`rounded-xl border text-[11px] font-semibold px-3 py-1.5 outline-none cursor-pointer bg-transparent ${stageStyle.bg} ${stageStyle.color}`}
            >
              {STAGES.map(s => (
                <option key={s.id} value={s.id} className="bg-[var(--surface)] text-[var(--foreground)]">{s.label}</option>
              ))}
            </select>

            <button
              onClick={() => setShowApplicantDetails(true)}
              className="flex items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/[0.07] px-3 py-1.5 text-[11px] text-sky-400 hover:bg-sky-500/15 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Info
            </button>

            {c.email && (
              <button
                onClick={() => setShowCreatorEmail(true)}
                className="flex items-center gap-1 rounded-xl border border-[#0a66c2]/25 bg-[#0a66c2]/10 px-3 py-1.5 text-[11px] font-semibold text-[#7cc0ff] hover:bg-[#0a66c2]/15 transition"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Send Email
              </button>
            )}

            <button
              onClick={() => setExpanded(e => !e)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition"
            >
              {expanded ? "Collapse" : "Details"}
            </button>

            <button
              onClick={fetchBrief}
              className="flex items-center gap-1 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.07] px-3 py-1.5 text-[11px] text-indigo-400 hover:bg-indigo-500/15 transition"
            >
              {loadingBrief ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <SparkIcon />}
              Brief
            </button>

            {c.assessmentStatus === "not_sent" && (
              <button
                onClick={sendAssessment}
                disabled={loadingAssessment}
                className="flex items-center gap-1 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3 py-1.5 text-[11px] text-violet-400 hover:bg-violet-500/15 transition disabled:opacity-50"
              >
                {loadingAssessment ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <SendIcon />}
                Send Assessment
              </button>
            )}

            {(c.assessmentStatus === "sent" || c.assessmentStatus === "invited") && (
              <button
                onClick={sendReminder}
                disabled={loadingReminder}
                className="flex items-center gap-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-1.5 text-[11px] text-amber-400 hover:bg-amber-500/15 transition disabled:opacity-50"
              >
                {loadingReminder ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <BellIcon />}
                Reminder
              </button>
            )}

            <button
              onClick={generateRejectionEmail}
              disabled={loadingReject}
              className="flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/15 transition disabled:opacity-50"
            >
              {loadingReject ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <XIcon />}
              Reject
            </button>

            {(c.stage === "offer" || c.stage === "hired") && (() => {
              const ofPill = offerStatusPill(c.offerStatus);
              return (
                <button
                  onClick={() => setShowOfferLetterModal(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/15 transition"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Offer Letter
                  {ofPill && <span className={`rounded-full border px-1.5 py-0 text-[9px] font-semibold ${ofPill.cls}`}>{ofPill.label}</span>}
                </button>
              );
            })()}

            {scoringFailed && (
              <button
                onClick={retryScoring}
                disabled={loadingRetry}
                className="flex items-center gap-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-1.5 text-[11px] text-amber-400 hover:bg-amber-500/15 transition disabled:opacity-50"
              >
                {loadingRetry ? <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <RetryIcon />}
                {loadingRetry ? "Retrying…" : "Retry Scoring"}
              </button>
            )}

            <button onClick={handleDelete} className="ml-auto text-[var(--text-muted)] hover:text-rose-500 transition"><XIcon /></button>
          </div>

          {/* ── Email History ── */}
          {localEmailLog.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <button
                onClick={() => setShowEmailHistory(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--foreground)] transition mb-2"
              >
                <MailIcon />
                Emails sent ({localEmailLog.length})
                <span className="ml-1 text-[9px]">{showEmailHistory ? "▲" : "▼"}</span>
              </button>
              {showEmailHistory && (
                <div className="space-y-2">
                  {[...localEmailLog].reverse().map((entry, i) => (
                    <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full mt-0.5 ${entry.status === "sent" ? "bg-emerald-500" : "bg-rose-500"}`} />
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-[var(--foreground)] capitalize">{entry.type.replace(/_/g, " ")}</span>
                            <span className="text-[10px] text-[var(--text-muted)] ml-1.5">→ {entry.to}</span>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">{entry.subject}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0 whitespace-nowrap">
                          {new Date(entry.sentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          {" "}
                          {new Date(entry.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {entry.status === "failed" && (
                        <p className="text-[10px] text-rose-400 mt-1 pl-3">Failed: {entry.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {expanded && (
          <div className="border-t border-[var(--border)] p-5 space-y-4">
            {c.assessmentStatus === "completed" && c.assessmentImpact && (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/70 mb-2 flex items-center gap-1"><SparkIcon /> Assessment Impact</p>
                {scoreChanged && prevPct !== null && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-[var(--text-secondary)]">{prevPct}%</span>
                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M1 6h16M13 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className={`text-lg font-bold ${scoreColor(pct)}`}>{pct}%</span>
                    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${pct > prevPct ? "bg-emerald-500/15 text-emerald-600" : pct < prevPct ? "bg-rose-500/15 text-rose-600" : "bg-zinc-500/15 text-[var(--text-secondary)]"}`}>
                      {pct > prevPct ? `+${pct - prevPct}%` : pct < prevPct ? `-${prevPct - pct}%` : "No change"}
                    </span>
                  </div>
                )}
                <p className="text-xs text-[var(--text-secondary)] leading-5 mb-3">{c.assessmentImpact.reasoning}</p>
                {c.assessmentImpact.strengths.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {c.assessmentImpact.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-400">
                        <CheckCircleIcon /> {s}
                      </div>
                    ))}
                  </div>
                )}
                {c.assessmentImpact.weaknesses.length > 0 && (
                  <div className="space-y-1">
                    {c.assessmentImpact.weaknesses.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                        <AlertIcon /> {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {c.strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mb-2">Resume Strengths</p>
                <div className="space-y-1">
                  {c.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="text-emerald-600 mt-0.5"><CheckCircleIcon /></span>{s}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {c.redFlags.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500/70 mb-2">Red Flags</p>
                <div className="space-y-1">
                  {c.redFlags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="text-rose-500 mt-0.5"><AlertIcon /></span>{f}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {c.scoreBreakdown.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Score Breakdown</p>
                  {(() => {
                    const conf = overallConfidence(c.scoreBreakdown);
                    const cs = confidenceStyle(conf);
                    const fullLabel = conf === "high" ? "High Confidence" : conf === "low" ? "Low Confidence" : "Medium Confidence";
                    return (
                      <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cs.pill}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${cs.dot}`} />
                        {fullLabel}
                      </span>
                    );
                  })()}
                </div>
                <div className="space-y-3">
                  {c.scoreBreakdown.map((b, i) => {
                    const bPct = b.maxScore > 0 ? Math.round((b.score / b.maxScore) * 100) : 0;
                    const conf = b.confidence ?? "medium";
                    const cs = confidenceStyle(conf);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cs.dot}`} title={cs.label} />
                            <span className="text-xs text-[var(--text-secondary)] truncate">{b.criterion}</span>
                          </div>
                          <span className={`ml-2 shrink-0 text-xs font-semibold ${scoreColor(bPct)}`}>{b.score}/{b.maxScore}</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-[var(--border)]">
                          <div className={`h-full rounded-full ${scoreBarColor(bPct)}`} style={{ width: `${bPct}%` }} />
                        </div>
                        <div className="mt-1 flex items-start justify-between gap-2">
                          <p className="text-[10px] text-[var(--text-muted)] leading-4">{b.reasoning}</p>
                          <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide ${cs.text}`}>{conf}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {brief && (
              <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.05] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/80 mb-2 flex items-center gap-1"><SparkIcon /> Interview Brief</p>
                <p className="text-xs text-[var(--text-secondary)] leading-6 whitespace-pre-wrap">{brief}</p>
              </div>
            )}

            <HiringTimeline
              candidate={{
                ...c,
                interviewFeedback: interviewFeedback ?? undefined,
              }}
              jobTitle={job.title}
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={togglingPool}
                onClick={toggleTalentPool}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                  c.inTalentPool
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                {c.inTalentPool ? "★ In Talent Pool" : "☆ Add to Talent Pool"}
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

function JobDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const validTabs = ["pipeline", "autopilot", "jd", "rubric", "post", "assessment-analytics", "live", "collaboration", "ai-hiring", "job-analysis"] as const;
  type JobTab = JobTabId;
  const tabFromUrl = searchParams.get("tab");
  const sectionFromUrl = searchParams.get("section");
  const legacyAutopilotSection: HubSection | undefined =
    tabFromUrl === "rules" ? "rules"
    : tabFromUrl === "performance" ? "health"
    : tabFromUrl === "agent-log" ? "log"
    : sectionFromUrl === "agent" || sectionFromUrl === "rules" || sectionFromUrl === "health" || sectionFromUrl === "log" || sectionFromUrl === "overview"
      ? sectionFromUrl
      : undefined;
  const resolvedTab: JobTab =
    tabFromUrl === "rules" || tabFromUrl === "performance" || tabFromUrl === "agent-log"
      ? "autopilot"
      : validTabs.includes(tabFromUrl as JobTab)
        ? (tabFromUrl as JobTab)
        : "pipeline";
  const initialTab: JobTab = resolvedTab;
  const initialAutopilotSection: HubSection = legacyAutopilotSection ?? "overview";
  const highlightCandidateId = searchParams.get("candidate");
  const [focusCandidateId, setFocusCandidateId] = useState<string | null>(highlightCandidateId);

  const [token, setToken] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<JobTab>(initialTab);
  const [autopilotSection, setAutopilotSection] = useState<HubSection>(initialAutopilotSection);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [pipelineRules, setPipelineRules] = useState<PipelineRule[]>([]);
  const [perfAlerts, setPerfAlerts] = useState<PerformanceAlert[]>([]);
  const [agentLogCount, setAgentLogCount] = useState(0);
  const [checkingPerf, setCheckingPerf] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [stageFilter, setStageFilter] = useState<CandidateStage | "all">("all");
  const [aiRecFilter, setAiRecFilter] = useState<"all" | "hire" | "hold" | "pass" | "pending">("all");
  const [pipelineSort, setPipelineSort] = useState<"score_desc" | "score_asc" | "newest" | "oldest" | "stage_age" | "name">("score_desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [showCopilot, setShowCopilot] = useState(false);

  const emailRecipients = useMemo<CreatorEmailRecipient[]>(
    () =>
      candidates
        .filter((candidate) => candidate.email?.trim())
        .map((candidate) => ({
          id: candidate._id,
          name: candidate.name,
          email: candidate.email!.trim(),
        })),
    [candidates],
  );

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (sessionToken) setToken(sessionToken);
  }, [sessionToken]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFetchError(null);
    try {
      const [jobRes, candRes, rulesRes, agentLogRes] = await Promise.all([
        fetch(apiUrl(`/recruit/jobs/${id}`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl(`/recruit/jobs/${id}/candidates`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl(`/recruit/jobs/${id}/pipeline-rules`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl(`/recruit/jobs/${id}/agent-log`), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!jobRes.ok) {
        const errData = await jobRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load job.");
      }
      const jobData = await readApiJson(jobRes);
      const candData = await readApiJson(candRes);
      const rulesData = rulesRes.ok ? await readApiJson(rulesRes) : { rules: jobData.job?.pipelineRules ?? [] };
      const agentLogData = agentLogRes.ok ? await readApiJson(agentLogRes) : { total: 0 };
      setJob(jobData.job ?? null);
      setCandidates(candData.candidates ?? []);
      setPipelineRules(rulesData.rules ?? jobData.job?.pipelineRules ?? []);
      setPerfAlerts(jobData.job?.performanceAlerts?.filter((a: PerformanceAlert) => !a.dismissed) ?? []);
      setAgentLogCount(agentLogData.total ?? 0);
    } catch (err: any) {
      setFetchError(err.message || "Failed to load job data.");
    }
    finally { setLoading(false); }
  }, [token, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!focusCandidateId || loading) return;
    const el = document.getElementById(`candidate-${focusCandidateId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusCandidateId, loading, candidates.length, activeTab, stageFilter]);

  function handleAttentionAction(action: AttentionAction, _item: AttentionItem) {
    if (action.type === "pipeline") {
      if (action.stage) setStageFilter(action.stage);
      setAiRecFilter("all");
      setActiveTab("pipeline");
      if (action.candidateId) setFocusCandidateId(action.candidateId);
      return;
    }
    if (action.type === "autopilot") {
      setActiveTab("autopilot");
      setAutopilotSection(action.section ?? "overview");
      return;
    }
    if (action.type === "tab") {
      setActiveTab(action.tab as JobTab);
      if (action.section) setAutopilotSection(action.section as HubSection);
    }
  }

  function toggleSelectCandidate(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sortCandidatesList(list: Candidate[]): Candidate[] {
    const scoreOf = (c: Candidate) =>
      (!c.scoringFailed && c.maxScore > 0) ? c.totalScore / c.maxScore : -1;
    const ageOf = (c: Candidate) =>
      new Date(c.stageMovedAt || c.createdAt).getTime();
    return [...list].sort((a, b) => {
      switch (pipelineSort) {
        case "score_asc": return scoreOf(a) - scoreOf(b);
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "stage_age": return ageOf(a) - ageOf(b);
        case "name": return a.name.localeCompare(b.name);
        case "score_desc":
        default: return scoreOf(b) - scoreOf(a);
      }
    });
  }

  async function runBulkStageMove(stage: CandidateStage) {
    if (!token || selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMessage(null);
    let ok = 0;
    let fail = 0;
    for (const cid of selectedIds) {
      try {
        const res = await fetch(apiUrl(`/recruit/jobs/${id}/candidates/${cid}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stage, skipAutoEmail: true }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.candidate) handleUpdate(cid, data.candidate);
          else handleUpdate(cid, { stage });
          ok++;
        } else fail++;
      } catch { fail++; }
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    setBulkMessage(`Moved ${ok} candidate${ok !== 1 ? "s" : ""} to ${stage}${fail ? ` · ${fail} failed` : ""} · compose emails individually from each card`);
  }

  async function runBulkSendAssessment() {
    if (!token || selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMessage(null);
    let ok = 0;
    let fail = 0;
    let skipped = 0;
    for (const cid of selectedIds) {
      const c = candidates.find(x => x._id === cid);
      if (!c || c.assessmentStatus !== "not_sent") { skipped++; continue; }
      try {
        const res = await fetch(apiUrl(`/recruit/jobs/${id}/candidates/${cid}/assessment/send`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          handleUpdate(cid, { assessmentStatus: "sent", assessmentSentAt: new Date().toISOString() });
          ok++;
        } else fail++;
      } catch { fail++; }
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    setBulkMessage(`Sent ${ok} assessment${ok !== 1 ? "s" : ""}${skipped ? ` · ${skipped} skipped` : ""}${fail ? ` · ${fail} failed` : ""}`);
  }

  // ── AI synthesis polling ───────────────────────────────────────────────────
  // Poll every 30 s when on the pipeline tab to keep recommendation badges current.
  useEffect(() => {
    if (!token || !id || activeTab !== "pipeline") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/recruit/jobs/${id}/candidates`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const fresh: Candidate[] = data.candidates ?? [];
        if (!fresh.length) return;
        setCandidates(prev => prev.map(c => {
          const f = fresh.find(x => x._id === c._id);
          if (!f) return c;
          // Only update aiHiringSynthesis to avoid overwriting local state
          if (JSON.stringify(f.aiHiringSynthesis) === JSON.stringify(c.aiHiringSynthesis)) return c;
          return { ...c, aiHiringSynthesis: f.aiHiringSynthesis };
        }));
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [token, id, activeTab]);

  // ── Live offer status polling ──────────────────────────────────────────────
  // Poll every 20 s when any offer-stage candidate still has a non-terminal status
  // (pending or viewed). Stops automatically once all responses are terminal.
  useEffect(() => {
    if (!token || !id) return;
    const hasLiveOffer = candidates.some(
      c => (c.stage === "offer" || c.stage === "hired") &&
           (c.offerCandidateStatus === "pending" || c.offerCandidateStatus === "viewed")
    );
    if (!hasLiveOffer) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/recruit/jobs/${id}/offer-statuses`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const statuses: Array<{ _id: string; offerStatus: string; offerCandidateStatus: string; offerExpiryDate: string }> = data.statuses ?? [];
        if (!statuses.length) return;
        setCandidates(prev => prev.map(c => {
          const s = statuses.find(x => x._id === c._id);
          if (!s) return c;
          // Only update if something actually changed to avoid spurious re-renders
          if (s.offerStatus === c.offerStatus && s.offerCandidateStatus === c.offerCandidateStatus) return c;
          return {
            ...c,
            offerStatus:          s.offerStatus          as Candidate["offerStatus"],
            offerCandidateStatus: s.offerCandidateStatus as Candidate["offerCandidateStatus"],
            offerDetails:         s.offerExpiryDate
              ? { ...(c.offerDetails || {}), offerExpiryDate: s.offerExpiryDate }
              : c.offerDetails,
          };
        }));
      } catch { /* silent — polling errors must not surface to recruiter */ }
    }, 20_000);

    return () => clearInterval(interval);
  // Re-evaluate whenever the set of live offers changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, candidates.filter(c => c.stage === "offer" || c.stage === "hired").map(c => c.offerCandidateStatus).join(",")]);

  function handleUpdate(cid: string, update: Partial<Candidate>) {
    setCandidates(prev => prev.map(c => c._id === cid ? { ...c, ...update } : c));
  }

  function handleDelete(cid: string) {
    setCandidates(prev => prev.filter(c => c._id !== cid));
    setJob(prev => prev ? { ...prev, candidateCount: Math.max(0, prev.candidateCount - 1) } : null);
  }

  function handleAgentModeUpdate(agentMode: AgentMode) {
    setJob(prev => prev ? { ...prev, agentMode } : null);
    if (agentMode.enabled) markChecklistStep(id, "autopilotEnabled");
  }

  useEffect(() => {
    if (candidates.length > 0) markChecklistStep(id, "reviewedApplicant");
  }, [candidates.length, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] animate-[rb-fade-in_0.3s_ease_both]">
        {/* Header skeleton */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="h-4 w-20 rounded-full rb-skeleton" />
              <div className="h-4 w-32 rounded-full rb-skeleton" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded-lg rb-skeleton" />
              <div className="h-8 w-24 rounded-lg rb-skeleton" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
          {/* Job title card */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-6 w-64 rounded-lg rb-skeleton" />
                <div className="h-3.5 w-48 rounded-full rb-skeleton" />
              </div>
              <div className="h-7 w-20 rounded-full rb-skeleton" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-24 rounded-full rb-skeleton" />
              <div className="h-5 w-20 rounded-full rb-skeleton" />
              <div className="h-5 w-16 rounded-full rb-skeleton" />
            </div>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2">
                <div className="h-6 w-10 rounded-lg rb-skeleton" />
                <div className="h-3 w-20 rounded-full rb-skeleton" />
              </div>
            ))}
          </div>
          {/* Candidate list */}
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

  if (!loading && fetchError) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-rose-600">{fetchError}</p>
        <button
          type="button"
          onClick={() => fetchData()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>Job not found.</p>
        <Link href="/recruit/dashboard" className="text-indigo-400 text-sm hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const topCandidates = [...candidates].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
  const byStage: Record<CandidateStage, Candidate[]> = {
    applied: [], review_zone: [], screened: [], assessed: [], interview: [], offer: [], hired: [], rejected: [],
  };
  candidates.forEach(c => { if (byStage[c.stage]) byStage[c.stage].push(c); });
  const attentionCount = buildAttentionItems({
    candidates,
    perfAlerts,
    agentMode: job.agentMode,
  }).length;

  const strongYesCount = candidates.filter(c => c.hiringDecision === "strong_yes").length;
  const maybeCount = candidates.filter(c => c.hiringDecision === "maybe").length;
  const assessedCount = candidates.filter(c => c.assessmentStatus === "completed").length;

  return (
    <div className="min-h-screen bg-[#f4f1f8] text-[var(--foreground)]">
      

      {showBulkModal && job && (
        <BulkImportModal
          jobId={id}
          token={token!}
          jobTitle={job.title}
          onClose={() => setShowBulkModal(false)}
          onImported={(count) => {
            setShowBulkModal(false);
            // Refresh candidate list
            fetch(apiUrl(`/recruit/jobs/${id}/candidates`), { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.json())
              .then(d => { if (d.candidates) setCandidates(d.candidates); })
              .catch(() => {});
          }}
        />
      )}

      {showAddModal && (
        <AddCandidateModal
          jobId={id}
          token={token!}
          onClose={() => setShowAddModal(false)}
          onAdded={fetchData}
        />
      )}

      <header className="sticky top-0 z-20 border-b border-[#e4dfe8] bg-[#fffdfd]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/recruit/dashboard" aria-label="Back to dashboard" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2dce8] bg-white text-[var(--text-muted)] transition hover:border-[#b9a9eb] hover:text-[#5b45ad]">
              <ChevronLeftIcon />
            </Link>
            <div className="hidden h-5 w-px bg-[#ddd6e2] sm:block" />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#654bb2]">Standard Job</p>
              <p className="truncate text-xs font-semibold text-[var(--text-secondary)] sm:max-w-xs">{job.title}</p>
            </div>
          </div>
          <div className="flex max-w-[68%] flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2">
            <button
              type="button"
              onClick={() => setShowCopilot(true)}
              className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-2 text-[11px] font-bold text-violet-700 transition hover:bg-violet-500/20 sm:gap-1.5 sm:px-3 sm:text-xs"
              title="Ask Copilot about this pipeline"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
              </svg>
              Copilot
            </button>
            <button
              onClick={() => {
                const url = `${getFrontendUrl()}/recruit/opportunities/${id}`;
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                });
                markChecklistStep(id, "shared");
                trackEvent("recruiter_profile_viewed", { jobId: id, action: "share_link_copied" });
              }}
              className={`flex items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition sm:gap-1.5 sm:px-3 sm:text-xs ${
                linkCopied
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)]"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {linkCopied ? "Link Copied!" : "Share Listing"}
            </button>
            {candidates.length > 0 && (
              <a
                href={apiUrl(`/recruit/jobs/${id}/export?format=csv`)}
                download
                onClick={async (e) => {
                  e.preventDefault();
                  const res = await fetch(apiUrl(`/recruit/jobs/${id}/export?format=csv`), {
                    headers: { Authorization: `Bearer ${token!}` },
                  });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `${job.title.replace(/[^a-z0-9]/gi, "_")}_candidates.csv`;
                  a.click(); URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-2 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:text-[var(--foreground)] hover:border-[var(--accent)] sm:gap-1.5 sm:px-3 sm:text-xs"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </a>
            )}
            {token && (
              <AgentModeToggle
                job={job}
                token={token}
                onUpdate={handleAgentModeUpdate}
                onOpenHub={() => {
                  setActiveTab("autopilot");
                  setAutopilotSection("agent");
                }}
              />
            )}
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-[11px] font-bold text-[var(--text-secondary)] transition hover:text-[var(--foreground)] hover:border-indigo-500/40 sm:gap-1.5 sm:px-3 sm:text-xs"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              Bulk Import
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
        <div className="mb-6 rounded-[26px] border border-[#e5e0ea] bg-[#fffdfd] p-5 shadow-[0_8px_22px_rgba(62,44,87,0.055)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#e9e2fb] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#654bb2]">
                  Hiring command center
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#3f927f]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#49a891]" />
                  {job.status || "Open"}
                </span>
              </div>
              <h1 className="text-[27px] font-extrabold tracking-[-0.055em] text-[#2e283e] sm:text-[32px]">{job.title}</h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {job.seniority}
                {job.department ? ` · ${job.department}` : ""}
                {" · "}{job.location}
                {" · "}{job.workMode}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6d59c8] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_7px_15px_rgba(109,89,200,.22)] transition hover:bg-[#5e4ab6]"
              >
                <PlusIcon /> Add candidate
              </button>
              {assessedCount > 0 && (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.07] px-4 py-2">
                  <p className="text-[10px] text-[var(--text-muted)]">Assessed</p>
                  <p className="text-sm font-bold text-violet-600">{assessedCount}</p>
                </div>
              )}
              {strongYesCount > 0 && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2">
                  <p className="text-[10px] text-[var(--text-muted)]">Strong Yes</p>
                  <p className="text-sm font-bold text-emerald-600">{strongYesCount}</p>
                </div>
              )}
              {maybeCount > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-2">
                  <p className="text-[10px] text-[var(--text-muted)]">Maybe</p>
                  <p className="text-sm font-bold text-amber-700">{maybeCount}</p>
                </div>
              )}
              {topCandidates.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2">
                  <p className="text-[10px] text-[var(--text-muted)]">Top Score</p>
                  <p className="text-sm font-bold text-emerald-600">
                    {topCandidates[0] ? `${Math.round((topCandidates[0].totalScore / topCandidates[0].maxScore) * 100)}%` : "—"}
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2">
                <p className="text-[10px] text-[var(--text-muted)]">Candidates</p>
                <p className="text-sm font-bold text-[var(--foreground)]">{candidates.length}</p>
              </div>
            </div>
          </div>
        </div>

        <NeedsAttentionQueue
          candidates={candidates}
          perfAlerts={perfAlerts}
          agentMode={job.agentMode}
          onAction={handleAttentionAction}
        />

        <JobTabNav
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab === "autopilot") setAutopilotSection("overview");
          }}
          badges={{
            pipeline: attentionCount > 0 ? (
              <span className="rounded-full bg-[var(--foreground)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--surface)] leading-none">
                {attentionCount}
              </span>
            ) : undefined,
            autopilot: perfAlerts.length > 0 ? (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {perfAlerts.length}
              </span>
            ) : undefined,
          }}
        />

        {activeTab === "pipeline" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0">
            {candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[26px] border border-dashed border-[#d8d0e1] bg-[#fffdfd] px-5 py-20 text-center shadow-[0_5px_16px_rgba(62,44,87,0.04)]">
                <p className="text-[var(--text-secondary)] text-sm mb-2">No candidates yet</p>
                <p className="text-[var(--text-muted)] text-xs mb-6 max-w-sm">
                  Add your first candidate — paste a resume and the AI will score it against your rubric.
                  {!job.agentMode?.enabled && " Set up Autopilot so new applicants are triaged automatically."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 rounded-xl bg-[#6d59c8] px-5 py-2.5 text-sm font-bold text-white shadow-[0_7px_15px_rgba(109,89,200,.22)] transition hover:bg-[#5e4ab6]"
                  >
                    <PlusIcon /> Add First Candidate
                  </button>
                  {!job.agentMode?.enabled && (
                    <button
                      onClick={() => { setActiveTab("autopilot"); setAutopilotSection("overview"); }}
                      className="flex items-center gap-2 rounded-xl border border-[#d8c9f4] bg-[#f7f3ff] px-5 py-2.5 text-sm font-semibold text-[#624cae] transition hover:bg-[#eee9fc]"
                    >
                      Set up Autopilot
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Stage + AI Recommendation + Sort filters */}
                <div className="mb-4 flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Stage</span>
                  <div className="relative">
                    <select
                      value={stageFilter}
                      onChange={e => { setStageFilter(e.target.value as CandidateStage | "all"); setSelectedIds(new Set()); }}
                      className="appearance-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] pl-4 pr-9 py-2 text-[12px] font-semibold text-[var(--foreground)] shadow-[var(--shadow-xs)] outline-none cursor-pointer transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]"
                    >
                      <option value="all">All stages ({candidates.length})</option>
                      {STAGES.map(stage => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label} ({byStage[stage.id].length})
                        </option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">AI Rec</span>
                  <div className="relative">
                    <select
                      value={aiRecFilter}
                      onChange={e => { setAiRecFilter(e.target.value as typeof aiRecFilter); setSelectedIds(new Set()); }}
                      className="appearance-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] pl-4 pr-9 py-2 text-[12px] font-semibold text-[var(--foreground)] shadow-[var(--shadow-xs)] outline-none cursor-pointer transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]"
                    >
                      <option value="all">All recommendations</option>
                      <option value="hire">Hire</option>
                      <option value="hold">Hold</option>
                      <option value="pass">Pass</option>
                      <option value="pending">Pending</option>
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Sort</span>
                  <div className="relative">
                    <select
                      value={pipelineSort}
                      onChange={e => setPipelineSort(e.target.value as typeof pipelineSort)}
                      className="appearance-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] pl-4 pr-9 py-2 text-[12px] font-semibold text-[var(--foreground)] shadow-[var(--shadow-xs)] outline-none cursor-pointer transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]"
                    >
                      <option value="score_desc">Score · high → low</option>
                      <option value="score_asc">Score · low → high</option>
                      <option value="newest">Newest applied</option>
                      <option value="oldest">Oldest applied</option>
                      <option value="stage_age">Longest in stage</option>
                      <option value="name">Name A–Z</option>
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>

                {bulkMessage && (
                  <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 flex items-center justify-between gap-2">
                    <span>{bulkMessage}</span>
                    <button type="button" onClick={() => setBulkMessage(null)} className="font-bold opacity-70 hover:opacity-100">Dismiss</button>
                  </div>
                )}

                {(() => {
                  const stage = stageFilter !== "all" ? STAGES.find(s => s.id === stageFilter)! : null;
                  const stageFiltered = stage ? byStage[stageFilter as CandidateStage] : candidates;
                  const filtered = aiRecFilter === "all" ? stageFiltered : stageFiltered.filter(c => {
                    if (aiRecFilter === "pending") return !c.aiHiringSynthesis;
                    return c.aiHiringSynthesis?.recommendation === aiRecFilter;
                  });
                  const visibleCandidates = sortCandidatesList(filtered);
                  const allVisibleSelected = visibleCandidates.length > 0 && visibleCandidates.every(c => selectedIds.has(c._id));

                  return (
                    <div>
                      {visibleCandidates.length > 0 && (
                        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (allVisibleSelected) {
                                setSelectedIds(prev => {
                                  const next = new Set(prev);
                                  visibleCandidates.forEach(c => next.delete(c._id));
                                  return next;
                                });
                              } else {
                                setSelectedIds(prev => {
                                  const next = new Set(prev);
                                  visibleCandidates.forEach(c => next.add(c._id));
                                  return next;
                                });
                              }
                            }}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition"
                          >
                            {allVisibleSelected ? "Deselect all" : "Select all visible"}
                          </button>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select cards for bulk actions"}
                          </span>

                          {selectedIds.size > 0 && (
                            <>
                              <div className="relative">
                                <select
                                  disabled={bulkBusy}
                                  defaultValue=""
                                  onChange={e => {
                                    const v = e.target.value as CandidateStage | "";
                                    if (v) runBulkStageMove(v);
                                    e.target.value = "";
                                  }}
                                  className="appearance-none rounded-lg border border-indigo-500/30 bg-indigo-500/10 pl-2.5 pr-7 py-1 text-[11px] font-bold text-indigo-700 outline-none disabled:opacity-50"
                                >
                                  <option value="" disabled>Move to…</option>
                                  {STAGES.filter(s => s.id !== "hired").map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                disabled={bulkBusy}
                                onClick={() => runBulkStageMove("rejected")}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 disabled:opacity-50"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                disabled={bulkBusy}
                                onClick={runBulkSendAssessment}
                                className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-700 disabled:opacity-50"
                              >
                                Send assessment
                              </button>
                              <button
                                type="button"
                                disabled={bulkBusy}
                                onClick={() => setSelectedIds(new Set())}
                                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)]"
                              >
                                Clear
                              </button>
                              {bulkBusy && <span className="text-[11px] text-indigo-600 font-semibold">Working…</span>}
                            </>
                          )}
                        </div>
                      )}

                      {stage && (
                        <div className="flex items-center gap-3 mb-4">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${stage.bg} ${stage.color}`}>
                            {stage.label}
                          </span>
                          <span className="text-xs font-medium text-[var(--text-secondary)]">{visibleCandidates.length} candidate{visibleCandidates.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {visibleCandidates.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-10 text-center text-xs font-medium text-[var(--text-secondary)]">
                          No candidates {stage ? `at the ${stage.label} stage` : "yet"}
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {visibleCandidates.map(c => (
                            <CandidateCard
                              key={c._id}
                              c={c}
                              jobId={id}
                              job={job}
                              token={token!}
                              onUpdate={handleUpdate}
                              onDelete={handleDelete}
                              highlighted={focusCandidateId === c._id}
                              selected={selectedIds.has(c._id)}
                              onToggleSelect={toggleSelectCandidate}
                              recipientPool={emailRecipients}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </section>
          <aside className="space-y-5">
            <section className="rounded-2xl border border-[#e5e0ea] bg-[#fffdfd] p-4 shadow-[0_8px_22px_rgba(62,44,87,0.055)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600"><AlertIcon /></span>
                    <h2 className="text-[13px] font-extrabold text-[#393144]">Next decision</h2>
                  </div>
                  <p className="mt-2 text-[12px] font-bold leading-5 text-[#4f465e]">
                    {topCandidates[0] ? `Review ${topCandidates[0].name}` : "Review your pipeline"}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-[#958c9e]">
                    {attentionCount > 0
                      ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need a recruiter decision.`
                      : "Your pipeline is clear. Keep moving strong candidates forward."}
                  </p>
                </div>
                <span className="rounded-full bg-[#fff0d6] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#a26e22]">
                  Today
                </span>
              </div>
              {topCandidates[0] && (
                <button
                  type="button"
                  onClick={() => setFocusCandidateId(topCandidates[0]._id)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#332d43] px-3 py-2.5 text-[11px] font-extrabold text-white transition hover:bg-[#4b425b]"
                >
                  Open review <span aria-hidden="true">→</span>
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-[#e5e0ea] bg-[#fffdfd] p-4 shadow-[0_8px_22px_rgba(62,44,87,0.055)]">
              <h2 className="text-[13px] font-extrabold text-[#393144]">Pipeline health</h2>
              <div className="mt-4 space-y-3">
                {STAGES.filter(stage => !["hired", "rejected"].includes(stage.id)).map(stage => (
                  <button
                    type="button"
                    key={stage.id}
                    onClick={() => setStageFilter(stage.id)}
                    className="group flex w-full items-center gap-2.5 text-left"
                  >
                    <span className="w-[68px] text-[10px] font-bold text-[#7d7488]">{stage.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#eeeaf1]">
                      <span
                        className="block h-full rounded-full bg-[#8670d3] transition group-hover:bg-[#6d59c8]"
                        style={{ width: `${Math.max(8, Math.min(100, (byStage[stage.id].length / Math.max(candidates.length, 1)) * 100))}%` }}
                      />
                    </span>
                    <span className="w-5 text-right text-[11px] font-extrabold text-[#484052]">{byStage[stage.id].length}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#eee9f0] pt-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#948ca0]">Decision zone</p>
                  <p className="mt-1 text-[16px] font-extrabold text-[#322d41]">{byStage.review_zone.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#948ca0]">Scored</p>
                  <p className="mt-1 text-[16px] font-extrabold text-[#322d41]">{candidates.filter(c => !c.scoringFailed).length}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#dcd4ef] bg-[#eee9fc] p-4">
              <p className="text-[12px] font-extrabold text-[#4c3a88]">Why this is a Standard Job</p>
              <p className="mt-2 text-[11px] leading-5 text-[#685b91]">
                Rubric signals, stage movement, assessments, and human decisions stay connected in one hiring command center.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("rubric")}
                className="mt-3 text-[10px] font-extrabold text-[#604ab0] hover:underline"
              >
                View scoring rubric →
              </button>
            </section>
          </aside>
          </div>
        )}

        {activeTab === "jd" && (
          <JDTab
            jobId={id}
            token={token!}
            initialJD={formatJobDescription(job.generatedJD)}
            onSaved={(newJD) => setJob(j => j ? { ...j, generatedJD: newJD } : j)}
          />
        )}

        {activeTab === "rubric" && (
          <div className="space-y-5">
            {token && (
              <WhatIfSimulator
                jobId={id}
                token={token}
                rubric={job.rubric}
                agentMode={job.agentMode}
                candidates={candidates}
                onRubricApplied={(rubric) => setJob(j => j ? { ...j, rubric } : j)}
                onAgentModeUpdate={handleAgentModeUpdate}
                onRescoreComplete={fetchData}
              />
            )}
            <div className="space-y-4">
              {job.rubric.map((r, i) => (
                <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">{r.name}</h3>
                    <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600">{r.weight} pts</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-5">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "post" && (
          <PostToBoardsTab job={job} />
        )}

        {activeTab === "autopilot" && token && (
          <HiringAutopilotHub
            jobId={id}
            token={token}
            agentMode={job.agentMode ?? { enabled: false, shortlistThreshold: 75, rejectThreshold: 40, autoEmailShortlist: true, autoEmailReject: false, autoSendAssessment: false, emailReviewZoneCandidates: false }}
            onAgentModeUpdate={handleAgentModeUpdate}
            pipelineRules={pipelineRules}
            onRulesChange={setPipelineRules}
            perfAlerts={perfAlerts}
            agentLogCount={agentLogCount}
            initialSection={autopilotSection}
            onGoToPipeline={(stage) => {
              setStageFilter(stage);
              setActiveTab("pipeline");
            }}
            rulesPanel={
              <PipelineRulesTab
                jobId={id}
                token={token}
                rules={pipelineRules}
                onChange={setPipelineRules}
              />
            }
            healthPanel={
              <PerformanceTab
                jobId={id}
                token={token}
                alerts={perfAlerts}
                checking={checkingPerf}
                agentEnabled={job.agentMode?.enabled ?? false}
                hideAgentStats
                onGoToStage={(stage) => {
                  setStageFilter(stage);
                  setActiveTab("pipeline");
                }}
                onDismiss={(alertId) => setPerfAlerts(a => a.filter(x => x.id !== alertId))}
                onApplied={(newJD) => setJob(j => j ? { ...j, generatedJD: newJD } : j)}
                onRefresh={async () => {
                  setCheckingPerf(true);
                  try {
                    const res = await fetch(apiUrl(`/recruit/jobs/${id}/performance`), {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    setPerfAlerts(data.alerts ?? []);
                  } finally { setCheckingPerf(false); }
                }}
              />
            }
            logPanel={
              <AgentLogTab
                jobId={id}
                token={token}
                agentEnabled={job.agentMode?.enabled ?? false}
                onCountChange={setAgentLogCount}
              />
            }
          />
        )}

        {activeTab === "assessment-analytics" && (
          <AssessmentAnalyticsTab
            jobId={id}
            token={token!}
            jobTitle={job.title}
          />
        )}

        {activeTab === "live" && (
          <LiveAssessmentProgressTab
            jobId={id}
            token={token!}
          />
        )}

        {activeTab === "collaboration" && token && (
          <CollaborationTab
            jobId={id}
            token={token}
            candidates={candidates}
            onRefresh={fetchData}
          />
        )}

        {activeTab === "ai-hiring" && token && (
          <AiHiringSummaryTab
            jobId={id}
            token={token}
            candidates={candidates}
          />
        )}

        {activeTab === "job-analysis" && token && (
          <JobAnalysisTab
            jobId={id}
            token={token}
            jobTitle={job.title}
            candidates={candidates}
          />
        )}
      </main>

      <JobPageTour
        onGoAutopilot={() => {
          setActiveTab("autopilot");
          setAutopilotSection("overview");
        }}
      />

      {token && (
        <CopilotDrawer
          jobId={id}
          jobTitle={job.title}
          token={token}
          open={showCopilot}
          onClose={() => setShowCopilot(false)}
        />
      )}
    </div>
  );
}

// ── Agent Log Tab ─────────────────────────────────────────────────────────────
type AgentLogEntry = {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  action: "shortlisted" | "rejected" | "review_zone";
  score: number;
  reason: string;
  emailSent: boolean;
  emailStatus: "sent" | "failed" | "skipped" | "disabled";
  timestamp: string;
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function AgentLogTab({
  jobId, token, agentEnabled, onCountChange,
}: {
  jobId: string;
  token: string;
  agentEnabled: boolean;
  onCountChange: (n: number) => void;
}) {
  const [entries, setEntries]   = useState<AgentLogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "shortlisted" | "rejected" | "review_zone">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-log`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const list: AgentLogEntry[] = data.entries ?? [];
        setEntries(list);
        onCountChange(list.length);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [jobId, token, onCountChange]);

  const filtered = filter === "all" ? entries : entries.filter(e => e.action === filter);
  const totalShortlisted = entries.filter(e => e.action === "shortlisted").length;
  const totalRejected    = entries.filter(e => e.action === "rejected").length;
  const totalReviewZone  = entries.filter(e => e.action === "review_zone").length;
  const totalEmailed     = entries.filter(e => e.emailSent).length;

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl rb-skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-indigo-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
              </svg>
            </span>
            Agent Activity Log
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Every action taken by the AI Agent — shortlist, reject, and Review Zone triage with reasons.
          </p>
        </div>

        {/* Agent status pill */}
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
          agentEnabled
            ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
            : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${agentEnabled ? "bg-indigo-400 animate-pulse" : "bg-gray-400"}`} />
          {agentEnabled ? "Agent Active" : "Agent Paused"}
        </div>
      </div>

      {/* ── Stats row ── */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalShortlisted}</p>
            <p className="text-[11px] text-emerald-700/70 mt-0.5">Shortlisted</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{totalReviewZone}</p>
            <p className="text-[11px] text-amber-800/70 mt-0.5">Review Zone</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-rose-600">{totalRejected}</p>
            <p className="text-[11px] text-rose-700/70 mt-0.5">Rejected</p>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalEmailed}</p>
            <p className="text-[11px] text-blue-700/70 mt-0.5">Emails Sent</p>
          </div>
        </div>
      )}

      {/* ── Filter tabs ── */}
      {entries.length > 0 && (
        <div className="flex gap-1">
          {(["all", "shortlisted", "review_zone", "rejected"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === f
                  ? f === "all"
                    ? "bg-indigo-500 text-white"
                    : f === "shortlisted"
                      ? "bg-emerald-500 text-white"
                      : f === "review_zone"
                        ? "bg-amber-500 text-white"
                        : "bg-rose-500 text-white"
                  : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {f === "all"
                ? `All (${entries.length})`
                : f === "shortlisted"
                  ? `✅ Shortlisted (${totalShortlisted})`
                  : f === "review_zone"
                    ? `⏳ Review Zone (${totalReviewZone})`
                    : `❌ Rejected (${totalRejected})`}
            </button>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>
              <path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)]">No agent actions yet</p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] max-w-xs">
            {agentEnabled
              ? "The agent is active. Actions will appear here as new candidates apply."
              : "Turn on the AI Agent to let it automatically shortlist and reject candidates."}
          </p>
        </div>
      )}

      {/* ── Log entries ── */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((entry, idx) => {
            const key = `${entry.candidateId}-${idx}`;
            const isOpen = expandedId === key;
            const isShortlisted = entry.action === "shortlisted";
            const isReviewZone = entry.action === "review_zone";
            const rowStyle = isShortlisted
              ? "border-emerald-500/20 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]"
              : isReviewZone
                ? "border-amber-500/20 bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"
                : "border-rose-500/20 bg-rose-500/[0.03] hover:bg-rose-500/[0.06]";

            return (
              <div
                key={key}
                className={`rounded-2xl border transition-all ${rowStyle}`}
              >
                {/* ── Row summary ── */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  {/* Action icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                    isShortlisted
                      ? "bg-emerald-100 text-emerald-600"
                      : isReviewZone
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-600"
                  }`}>
                    {isShortlisted ? "✅" : isReviewZone ? "⏳" : "❌"}
                  </div>

                  {/* Candidate info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">{entry.candidateName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isShortlisted
                          ? "bg-emerald-500/15 text-emerald-700"
                          : isReviewZone
                            ? "bg-amber-500/15 text-amber-800"
                            : "bg-rose-500/15 text-rose-700"
                      }`}>
                        {isShortlisted ? "Shortlisted" : isReviewZone ? "Review Zone" : "Rejected"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{entry.reason}</p>
                  </div>

                  {/* Score + time */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-sm font-bold ${
                      entry.score >= 75 ? "text-emerald-600" : entry.score >= 40 ? "text-amber-600" : "text-rose-600"
                    }`}>
                      {entry.score}%
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(entry.timestamp)}</span>
                  </div>

                  {/* Expand chevron */}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {/* ── Expanded detail ── */}
                {isOpen && (
                  <div className="border-t border-[var(--border)]/50 px-4 py-3 space-y-3">
                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Candidate</p>
                        <p className="text-[var(--foreground)] font-medium">{entry.candidateName}</p>
                        {entry.candidateEmail && (
                          <p className="text-[var(--text-muted)]">{entry.candidateEmail}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Score</p>
                        <p className={`font-bold text-sm ${
                          entry.score >= 75 ? "text-emerald-600" : entry.score >= 40 ? "text-amber-600" : "text-rose-600"
                        }`}>{entry.score}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Decision</p>
                        <p className={`font-semibold ${isShortlisted ? "text-emerald-600" : "text-rose-600"}`}>
                          {isShortlisted ? "Auto-Shortlisted" : "Auto-Rejected"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Time</p>
                        <p className="text-[var(--foreground)]">{new Date(entry.timestamp).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}</p>
                      </div>
                    </div>

                    {/* Email status */}
                    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
                      entry.emailStatus === "sent"
                        ? "bg-blue-500/5 border border-blue-500/20"
                        : entry.emailStatus === "failed"
                          ? "bg-rose-500/5 border border-rose-500/20"
                          : "bg-[var(--surface-muted)] border border-[var(--border)]"
                    }`}>
                      <span className="text-base">
                        {entry.emailStatus === "sent" ? "📧" : entry.emailStatus === "failed" ? "⚠️" : "🔕"}
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">
                          {entry.emailStatus === "sent" ? "Email sent to candidate"
                            : entry.emailStatus === "failed" ? "Email failed to send"
                            : entry.emailStatus === "skipped" ? "Email skipped (no address)"
                            : "Email disabled in settings"}
                        </p>
                        {entry.emailStatus === "disabled" && (
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            Turn on auto-email in Agent Settings to notify candidates.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Link to candidate */}
                    <a
                      href={`/recruit/jobs/${jobId}?tab=pipeline&candidate=${entry.candidateId}`}
                      className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-3 py-2 text-xs font-semibold text-indigo-500 hover:bg-indigo-500/10 transition"
                    >
                      View {entry.candidateName.split(" ")[0]}&apos;s Profile
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

// ── JD Regenerate Tab ─────────────────────────────────────────────────────────
type JDVariant = "conservative" | "bold" | "seo_optimized";
const JD_VARIANTS: { value: JDVariant; label: string; desc: string; icon: string }[] = [
  { value: "conservative", label: "Conservative", desc: "Formal & structured — great for enterprise, finance, healthcare", icon: "🏛️" },
  { value: "bold",         label: "Bold",         desc: "Punchy & energetic — great for startups & high-growth roles",   icon: "⚡" },
  { value: "seo_optimized",label: "SEO Optimized",desc: "Keyword-rich for job boards & search engine visibility",        icon: "🔍" },
];

function JDTab({
  jobId, token, initialJD, onSaved,
}: { jobId: string; token: string; initialJD: string; onSaved: (jd: string) => void }) {
  const [currentJD, setCurrentJD] = useState(initialJD);
  const [variant, setVariant] = useState<JDVariant>("bold");
  const [newJD, setNewJD] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [comparing, setComparing] = useState(false);

  async function handleRegenerate() {
    setLoading(true); setError(""); setNewJD(""); setComparing(false);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/regenerate-jd`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variant, save: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setNewJD(data.newJD);
      setComparing(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    setSaving(true); setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/regenerate-jd`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variant, save: true, newJD }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCurrentJD(d.newJD ?? newJD);
      onSaved(d.newJD ?? newJD);
      setComparing(false); setNewJD("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Variant selector + regenerate */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--foreground)]">✨ Regenerate Job Description</p>
          {comparing && (
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-0.5 text-[11px] font-bold text-indigo-600">Comparing variants</span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {JD_VARIANTS.map(v => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVariant(v.value)}
              className={`rounded-2xl border p-3 text-left transition ${
                variant === v.value
                  ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-indigo-200"
              }`}
            >
              <p className="text-base mb-0.5">{v.icon}</p>
              <p className="text-xs font-bold">{v.label}</p>
              <p className="text-[10px] leading-4 mt-0.5 opacity-70">{v.desc}</p>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
        >
          {loading ? (
            <><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Generating…</>
          ) : (
            <>✨ Generate {JD_VARIANTS.find(v2 => v2.value === variant)?.label} variant</>
          )}
        </button>
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>

      {/* Side-by-side comparison */}
      {comparing && newJD ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Current */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Current</p>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-7 whitespace-pre-wrap">{currentJD}</p>
          </div>
          {/* New variant */}
          <div className="rounded-3xl border border-indigo-300 bg-indigo-50/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                {JD_VARIANTS.find(v => v.value === variant)?.icon} {JD_VARIANTS.find(v => v.value === variant)?.label} variant
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setComparing(false); setNewJD(""); }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                  {saving ? "Saving…" : "✓ Use this"}
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">{newJD}</p>
          </div>
        </div>
      ) : (
        /* Default: current JD only */
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-6 sm:p-8">
          <p className="text-sm text-[var(--text-secondary)] leading-8 whitespace-pre-wrap">{currentJD}</p>
        </div>
      )}
    </div>
  );
}

// ── AI Agent Stats Card ───────────────────────────────────────────────────────
type AgentStatsPeriod = "today" | "week" | "month" | "all";
type AgentStatsData = {
  shortlisted: number;
  rejected: number;
  reviewZone: number;
  emailsSent: number;
  avgScore: number | null;
  totalProcessed: number;
};

function AgentStatsCard({
  jobId, token, agentEnabled, onGoToStage,
}: {
  jobId: string;
  token: string;
  agentEnabled: boolean;
  onGoToStage: (stage: CandidateStage | "all") => void;
}) {
  const [period, setPeriod] = useState<AgentStatsPeriod>("week");
  const [stats, setStats]   = useState<AgentStatsData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const PERIOD_LABELS: Record<AgentStatsPeriod, string> = {
    today: "Today", week: "This Week", month: "This Month", all: "All Time",
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res  = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-stats?period=${period}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled) {
          setStats(data.stats ?? null);
          setInsights(data.insights ?? []);
        }
      } catch {
        if (!cancelled) setError("Could not load stats.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [jobId, token, period]);

  if (!agentEnabled) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-8 text-center mb-5">
        <p className="text-2xl mb-2">⚡</p>
        <p className="text-sm font-semibold text-[var(--foreground)]">AI Agent Stats</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Enable the AI Agent to start tracking agent performance stats.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 mb-5 space-y-4">
      {/* Header + period filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">⚡ AI Agent Stats</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Agent performance for this job</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5">
          {(["today", "week", "month", "all"] as AgentStatsPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition ${
                period === p
                  ? "bg-indigo-500 text-white shadow"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl rb-skeleton" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/5 px-4 py-3 text-xs text-rose-500">{error}</div>
      ) : !stats || stats.totalProcessed === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-8 text-center">
          <p className="text-2xl mb-1">📭</p>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">No agent activity {period === "all" ? "yet" : `for ${PERIOD_LABELS[period].toLowerCase()}`}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Stats will appear once the AI Agent processes candidates.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Shortlisted */}
            <button
              onClick={() => onGoToStage("screened")}
              className="group flex flex-col gap-1 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-left transition hover:border-emerald-400/40 hover:bg-emerald-500/10"
              title="View shortlisted candidates"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">✅ Shortlisted</span>
              <span className="text-2xl font-bold text-emerald-600">{stats.shortlisted}</span>
            </button>

            {/* Rejected */}
            <button
              onClick={() => onGoToStage("rejected")}
              className="group flex flex-col gap-1 rounded-2xl border border-rose-400/20 bg-rose-500/5 px-4 py-3 text-left transition hover:border-rose-400/40 hover:bg-rose-500/10"
              title="View rejected candidates"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">❌ Rejected</span>
              <span className="text-2xl font-bold text-rose-600">{stats.rejected}</span>
            </button>

            {/* In Review */}
            <button
              onClick={() => onGoToStage("review_zone")}
              className="group flex flex-col gap-1 rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-left transition hover:border-amber-400/40 hover:bg-amber-500/10"
              title="View candidates in Review Zone"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">⏳ Review Zone</span>
              <span className="text-2xl font-bold text-amber-700">{stats.reviewZone}</span>
            </button>

            {/* Emails Sent */}
            <button
              onClick={() => onGoToStage("all")}
              className="group flex flex-col gap-1 rounded-2xl border border-indigo-400/20 bg-indigo-500/5 px-4 py-3 text-left transition hover:border-indigo-400/40 hover:bg-indigo-500/10"
              title="View all candidates"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">📧 Emails Sent</span>
              <span className="text-2xl font-bold text-indigo-600">{stats.emailsSent}</span>
            </button>

            {/* Avg Score */}
            <div className="flex flex-col gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">⚡ Avg Score</span>
              <span className="text-2xl font-bold text-[var(--foreground)]">
                {stats.avgScore !== null ? `${stats.avgScore}%` : "—"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-muted)]">
            {stats.totalProcessed} candidate{stats.totalProcessed !== 1 ? "s" : ""} processed — click a metric to view in Pipeline
          </p>

          {/* AI Insights */}
          {insights.length > 0 && (
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">🤖 AI Insights</p>
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-2xl border border-indigo-400/20 bg-indigo-500/5 px-4 py-2.5">
                  <span className="mt-0.5 text-indigo-400 shrink-0">💡</span>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ALERT_META: Record<PerformanceAlert["type"], { label: string; color: string; icon: string }> = {
  low_applications: { label: "Low Applications",  color: "border-amber-400/40 bg-amber-500/5",  icon: "📉" },
  no_hire_14_days:  { label: "No Hire (14+ days)", color: "border-orange-400/40 bg-orange-500/5", icon: "⏳" },
  high_reject_rate: { label: "High Rejection Rate", color: "border-rose-400/40 bg-rose-500/5",   icon: "⚠️" },
};

function PerformanceTab({
  jobId, token, alerts, checking, onDismiss, onApplied, onRefresh, agentEnabled, onGoToStage, hideAgentStats,
}: {
  jobId: string;
  token: string;
  alerts: PerformanceAlert[];
  checking: boolean;
  onDismiss: (alertId: string) => void;
  onApplied: (newJD: string) => void;
  onRefresh: () => Promise<void>;
  agentEnabled: boolean;
  onGoToStage: (stage: CandidateStage | "all") => void;
  hideAgentStats?: boolean;
}) {
  const [applyingMap, setApplyingMap]   = useState<Record<string, boolean>>({});
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [successMap, setSuccessMap]     = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  async function handleApply(alertId: string, suggestion: string) {
    const key = `${alertId}:${suggestion}`;
    setApplyingMap(m => ({ ...m, [key]: true }));
    setErrorMsg(null);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/performance/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suggestion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply suggestion.");
      onApplied(data.newJD);
      setSuccessMap(m => ({ ...m, [key]: "✓ Applied — JD updated!" }));
      setTimeout(() => setSuccessMap(m => { const n = { ...m }; delete n[key]; return n; }), 3000);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setApplyingMap(m => ({ ...m, [key]: false }));
    }
  }

  async function handleDismiss(alertId: string) {
    setDismissingId(alertId);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/performance/dismiss/${alertId}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) onDismiss(alertId);
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="space-y-5 py-2">
      {!hideAgentStats && (
        <AgentStatsCard
          jobId={jobId}
          token={token}
          agentEnabled={agentEnabled}
          onGoToStage={onGoToStage}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">Job Health Monitor</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            AI monitors this job and flags issues automatically. Click &ldquo;Check Now&rdquo; to run a fresh analysis.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={checking}
          className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
        >
          {checking ? (
            <><span className="animate-spin">⟳</span> Checking…</>
          ) : (
            <><span>🔍</span> Check Now</>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {errorMsg}
        </div>
      )}

      {/* No alerts */}
      {!checking && alerts.length === 0 && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center">
          <p className="text-3xl">✅</p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">All good — no issues detected</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            AI checks for low applications, stalled pipelines, and high rejection rates.
          </p>
        </div>
      )}

      {/* Alert cards */}
      {alerts.map(alert => {
        const meta = ALERT_META[alert.type];
        return (
          <div key={alert.id} className={`rounded-3xl border p-5 ${meta.color}`}>
            {/* Alert header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{meta.icon}</span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">{meta.label}</span>
                  <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{alert.message}</p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(alert.id)}
                disabled={dismissingId === alert.id}
                className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--foreground)] disabled:opacity-50"
              >
                {dismissingId === alert.id ? "…" : "Dismiss"}
              </button>
            </div>

            {/* AI Suggestions */}
            {alert.aiSuggestions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  AI Suggestions — click to apply:
                </p>
                <div className="space-y-2">
                  {alert.aiSuggestions.map((suggestion, i) => {
                    const key = `${alert.id}:${suggestion}`;
                    const applying = applyingMap[key];
                    const success  = successMap[key];
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                        <p className="text-sm text-[var(--foreground)]">{suggestion}</p>
                        <button
                          onClick={() => handleApply(alert.id, suggestion)}
                          disabled={!!applying}
                          className="shrink-0 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
                        >
                          {success ? success : applying ? "Applying…" : "Apply →"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="mt-3 text-[11px] text-[var(--text-muted)]">
              Detected {new Date(alert.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Pipeline Rules Tab ────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<PipelineRule["condition"], string> = {
  score_above:       "Resume score is above",
  score_below:       "Resume score is below",
  assessment_passed: "Assessment passed (Strong Yes)",
  assessment_failed: "Assessment failed (No)",
  stage_age_days:    "Candidate has been in stage for",
};

const ACTION_LABELS: Record<PipelineRule["action"], string> = {
  move_to_screened:  "Move to Screened",
  move_to_assessed:  "Move to Assessed",
  move_to_interview: "Move to Interview",
  move_to_offer:     "Move to Offer",
  move_to_rejected:  "Move to Rejected",
  send_assessment:   "Send Assessment",
  send_reminder:     "Send Reminder Email",
};

const CONDITION_NEEDS_THRESHOLD: Record<PipelineRule["condition"], boolean> = {
  score_above: true, score_below: true, stage_age_days: true,
  assessment_passed: false, assessment_failed: false,
};

function ruleDescription(rule: PipelineRule): string {
  const cond = CONDITION_LABELS[rule.condition];
  const act  = ACTION_LABELS[rule.action];
  const thresh = CONDITION_NEEDS_THRESHOLD[rule.condition]
    ? ` ${rule.threshold}${rule.condition === "stage_age_days" ? " days" : "%"}`
    : "";
  const from = rule.fromStage ? ` (when in "${rule.fromStage}")` : "";
  return `${cond}${thresh}${from} → ${act}`;
}

const BLANK_FORM = {
  condition: "score_above" as PipelineRule["condition"],
  threshold: 80,
  fromStage: "",
  action: "move_to_interview" as PipelineRule["action"],
};

function PipelineRulesTab({
  jobId, token, rules, onChange,
}: {
  jobId: string;
  token: string;
  rules: PipelineRule[];
  onChange: (rules: PipelineRule[]) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK_FORM>({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openAddModal() {
    setEditingId(null);
    setForm({ ...BLANK_FORM });
    setError(null);
    setShowModal(true);
  }

  function openEditModal(rule: PipelineRule) {
    setEditingId(rule.id);
    setForm({ condition: rule.condition, threshold: rule.threshold, fromStage: rule.fromStage || "", action: rule.action });
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        condition: form.condition,
        threshold: CONDITION_NEEDS_THRESHOLD[form.condition] ? Number(form.threshold) : 0,
        fromStage: form.fromStage || "",
        action: form.action,
      };
      if (editingId) {
        const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/pipeline-rules/${editingId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update rule.");
        onChange(rules.map(r => r.id === editingId ? { ...r, ...body } : r));
      } else {
        const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/pipeline-rules`), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create rule.");
        onChange([...rules, data.rule]);
      }
      setShowModal(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: PipelineRule) {
    setTogglingId(rule.id);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/pipeline-rules/${rule.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) onChange(rules.map(r => r.id === rule.id ? { ...r, enabled: !rule.enabled } : r));
    } finally { setTogglingId(null); }
  }

  async function handleDelete(ruleId: string) {
    setDeletingId(ruleId);
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/pipeline-rules/${ruleId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) onChange(rules.filter(r => r.id !== ruleId));
    } finally { setDeletingId(null); }
  }

  const needsThreshold = CONDITION_NEEDS_THRESHOLD[form.condition];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">AI Pipeline Rules</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)] max-w-lg">
            Define rules that automatically move candidates through stages or trigger actions — AI executes them instantly whenever a candidate matches the condition.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Rule
        </button>
      </div>

      {/* How it works callout */}
      <div className="mb-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex gap-3">
        <svg className="mt-0.5 shrink-0 text-indigo-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p className="text-xs text-indigo-700 leading-5">
          Rules run after the AI Agent on every individual application, and also after assessments and stage changes. First matching rule wins. Score-based rules are skipped when AI scoring failed. (Bulk import runs rules only — not the Agent.)
        </p>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-6 py-16 text-center">
          <svg className="mx-auto mb-3 text-[var(--text-muted)]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <p className="text-sm font-medium text-[var(--text-secondary)]">No rules yet</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Add your first rule to let AI automatically manage this pipeline.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-2xl border bg-[var(--surface)] p-4 transition ${
                rule.enabled ? "border-[var(--border)]" : "border-[var(--border)] opacity-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Enabled toggle */}
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={togglingId === rule.id}
                    className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      rule.enabled ? "bg-indigo-500" : "bg-slate-300"
                    }`}
                    title={rule.enabled ? "Disable rule" : "Enable rule"}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                      rule.enabled ? "translate-x-4" : "translate-x-1"
                    }`} />
                  </button>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{ruleDescription(rule)}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      Fired <span className="font-semibold text-[var(--text-secondary)]">{rule.triggerCount}</span> time{rule.triggerCount !== 1 ? "s" : ""}
                      {!rule.enabled && <span className="ml-2 text-amber-600 font-medium">· Disabled</span>}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => openEditModal(rule)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--foreground)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    disabled={deletingId === rule.id}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/10"
                  >
                    {deletingId === rule.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <h3 className="mb-5 text-base font-bold text-[var(--foreground)]">
              {editingId ? "Edit Rule" : "Add Pipeline Rule"}
            </h3>

            <div className="space-y-4">
              {/* Condition */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Condition</label>
                <select
                  value={form.condition}
                  onChange={e => setForm(f => ({ ...f, condition: e.target.value as PipelineRule["condition"] }))}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                >
                  {(Object.entries(CONDITION_LABELS) as [PipelineRule["condition"], string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Threshold — only when needed */}
              {needsThreshold && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    {form.condition === "stage_age_days" ? "Days in stage" : "Score threshold (%)"}
                  </label>
                  <input
                    type="number"
                    min={form.condition === "stage_age_days" ? 1 : 1}
                    max={form.condition === "stage_age_days" ? 365 : 100}
                    value={form.threshold}
                    onChange={e => setForm(f => ({ ...f, threshold: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  />
                </div>
              )}

              {/* From stage (optional) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Only apply when in stage <span className="font-normal text-[var(--text-muted)] normal-case">(optional)</span>
                </label>
                <select
                  value={form.fromStage}
                  onChange={e => setForm(f => ({ ...f, fromStage: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                >
                  <option value="">Any stage</option>
                  <option value="applied">Applied</option>
                  <option value="review_zone">Review Zone</option>
                  <option value="screened">Screened</option>
                  <option value="assessed">Assessed</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                </select>
              </div>

              {/* Action */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Then do this</label>
                <select
                  value={form.action}
                  onChange={e => setForm(f => ({ ...f, action: e.target.value as PipelineRule["action"] }))}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                >
                  {(Object.entries(ACTION_LABELS) as [PipelineRule["action"], string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
                <p className="text-[11px] text-indigo-600 font-medium">Rule preview</p>
                <p className="mt-0.5 text-xs text-indigo-700">
                  {CONDITION_LABELS[form.condition]}
                  {needsThreshold ? ` ${form.threshold}${form.condition === "stage_age_days" ? " days" : "%"}` : ""}
                  {form.fromStage ? ` (when in "${form.fromStage}")` : ""} → {ACTION_LABELS[form.action]}
                </p>
              </div>

              {error && <p className="text-xs text-rose-600">{error}</p>}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white shadow shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-60"
              >
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostToBoardsTab({ job }: { job: Job }) {
  const [copiedBoard, setCopiedBoard] = useState<string | null>(null);
  const [linkCopiedPost, setLinkCopiedPost] = useState(false);
  const roleboltUrl = `${getFrontendUrl()}/recruit/opportunities/${job._id}`;
  const jobDescription = formatJobDescription(job.generatedJD);

  const linkedinPost = `🚀 We're Hiring: ${job.title}

${job.seniority ? `Seniority: ${job.seniority}` : ""}
📍 Location: ${job.location} (${job.workMode})
${job.department ? `🏢 Department: ${job.department}` : ""}

${jobDescription}

Interested? Apply by clicking the link in our bio or DM us directly.

#Hiring #${job.title.replace(/\s+/g, "")} #Jobs #Careers #NowHiring`;

  const indeedPost = `${job.title}

${jobDescription}

Job Type: Full-time
Location: ${job.location}
Work Mode: ${job.workMode}
${job.department ? `Department: ${job.department}` : ""}
Seniority: ${job.seniority || "Mid-level"}`;

  const naukariPost = `Position: ${job.title}
Location: ${job.location}
Work Mode: ${job.workMode}
Experience Level: ${job.seniority || "Mid-level"}
${job.department ? `Department: ${job.department}` : ""}

${jobDescription}`;

  const boards = [
    {
      id: "linkedin",
      name: "LinkedIn",
      color: "border-blue-500/20 bg-blue-500/[0.04]",
      badge: "text-blue-400 bg-blue-500/15 border-blue-500/20",
      content: linkedinPost,
      instructions: [
        "Go to LinkedIn → Jobs → Post a free job",
        "Paste the content below into the job description field",
        "Set location, employment type, and seniority",
        "Add your company page and publish",
      ],
      applyUrl: "https://www.linkedin.com/jobs/post/",
    },
    {
      id: "indeed",
      name: "Indeed",
      color: "border-violet-500/20 bg-violet-500/[0.04]",
      badge: "text-violet-400 bg-violet-500/15 border-violet-500/20",
      content: indeedPost,
      instructions: [
        "Go to Indeed Employer → Post a Job",
        "Enter the job title and location",
        "Paste the content below into the job description",
        "Choose sponsored or free posting and publish",
      ],
      applyUrl: "https://employers.indeed.com/",
    },
    {
      id: "naukri",
      name: "Naukri",
      color: "border-amber-500/20 bg-amber-500/[0.04]",
      badge: "text-amber-400 bg-amber-500/15 border-amber-500/20",
      content: naukariPost,
      instructions: [
        "Log in to Naukri RMS → Post a Job",
        "Fill in the role title, location, and experience level",
        "Paste the content below into the job description box",
        "Review and publish",
      ],
      applyUrl: "https://www.naukri.com/recruiter/",
    },
  ];

  function copyContent(boardId: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedBoard(boardId);
    setTimeout(() => setCopiedBoard(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-indigo-600 mb-1">Share your Rolebolt listing</p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed break-all">{roleboltUrl}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(roleboltUrl).then(() => {
                setLinkCopiedPost(true);
                setTimeout(() => setLinkCopiedPost(false), 2000);
              });
            }}
            className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              linkCopiedPost
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-indigo-500/25 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
            }`}
          >
            <CopyIcon />
            {linkCopiedPost ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Your AI-generated job description is ready to post. Copy the formatted content for each platform below — each version is optimized for that board&apos;s format and character style.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Note: Direct API posting to LinkedIn, Indeed, and Naukri requires OAuth credentials from each platform&apos;s developer program. Until those are connected, use the copy buttons below to paste into each platform.
        </p>
      </div>

      {boards.map(board => (
        <div key={board.id} className={`rounded-3xl border p-5 ${board.color}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${board.badge}`}>{board.name}</span>
              <a href={board.applyUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-500 transition">
                Open {board.name}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
            <button
              onClick={() => copyContent(board.id, board.content)}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-1.5 text-xs font-semibold transition ${board.badge} hover:opacity-80`}
            >
              {copiedBoard === board.id ? "Copied!" : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy for {board.name}</>
              )}
            </button>
          </div>

          <div className="mb-4">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">How to post on {board.name}:</p>
            <ol className="space-y-1">
              {board.instructions.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 max-h-52 overflow-y-auto">
            <p className="text-xs text-[var(--text-secondary)] leading-6 whitespace-pre-wrap font-mono">{board.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RecruitGuard requiredRole="creator">
      <Suspense fallback={<div className="p-10 text-center text-sm text-[var(--text-muted)]">Loading job…</div>}>
        <JobDetailContent params={params} />
      </Suspense>
    </RecruitGuard>
  );
}
