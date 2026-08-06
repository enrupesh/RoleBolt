"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Plus,
  ChevronDown,
  ArrowLeft,
  Trash2,
  Briefcase,
  Users,
  User,
  FileText,
  Globe,
  Send,
  Mail,
  Star,
  Search,
  X,
  Menu,
  MessageSquare,
  Home,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Target,
  Award,
  ClipboardCheck,
  Moon,
  SunMedium,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { apiUrl } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";
import WorkspacePicker from "./WorkspacePicker";
import {
  type CopilotWorkspace,
  type CopilotContextLevel,
  buildApiContext,
  inferWorkspace,
  defaultContextMode,
  workspaceLabel,
} from "@/lib/copilotWorkspace";

// ─── Theme ──────────────────────────────────────────────────────────────────
// Soft light "premium AI product" theme — see UI/UX polish brief.

const T = {
  bg: "var(--rb-bg)",
  card: "var(--rb-card)",
  border: "var(--rb-border)",
  accent: "var(--rb-accent)",
  text: "var(--rb-text)",
  textSecondary: "var(--rb-text-secondary)",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ContextMode = CopilotContextLevel;

interface FormApplicantStat {
  _id: string;
  submittedName: string;
  submittedEmail?: string;
  aiScore: number;
  scoringFailed?: boolean;
  stage?: string;
  aiSummary?: string;
  strengths?: string[];
  redFlags?: string[];
  assessmentStatus?: string;
  assessmentScore?: number;
}

interface FormGlobalStats {
  activeForms: number;
  totalApplicants: number;
  avgAiScorePct: number | null;
  shortlisted: number;
  interviewStage: number;
  hired: number;
  assessmentCompleted: number;
  topForm?: { formId: string; title: string; responseCount: number; avgScorePct: number | null } | null;
  highestRatedApplicant?: { id: string; name: string; formTitle: string; scorePct: number } | null;
}

interface Job {
  _id: string;
  title: string;
  department?: string;
  status: string;
  candidateCount: number;
}

interface Form {
  _id: string;
  title: string;
  status: string;
  responseCount?: number;
}

interface CopilotSource {
  type: string;
  label: string;
  candidateId?: string;
  candidateName?: string;
  /** Looked up server-side from the database — never invented by the AI */
  candidateEmail?: string;
  /** Fit score % looked up server-side — never invented by the AI */
  candidateFitScorePct?: number;
  jobId?: string;
  jobTitle?: string;
  page?: number;
  sectionId?: string;
  detail?: string;
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendation?: string;
  confidence?: number;
  reasoning?: string;
  sources?: CopilotSource[];
  quickActions?: string[];
  isStreaming?: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  context?: { level: string; formId?: string };
  selectedJobId?: string;
  selectedJobTitle?: string;
  selectedCandidateId?: string;
  selectedCandidateName?: string;
  selectedFormId?: string;
  selectedFormTitle?: string;
  selectedResponseId?: string;
  selectedResponseName?: string;
  lastActiveAt: string;
  totalMessages: number;
}

interface CandidateStat {
  _id: string;
  name: string;
  totalScore: number;
  maxScore: number;
  strengths?: string[];
  redFlags?: string[];
  stage?: string;
  assessmentStatus?: string;
  assessmentImpact?: { strengths: string[]; weaknesses: string[]; reasoning: string };
  hiringDecision?: string | null;
  availability?: string;
  currentStatus?: string;
  educationLevel?: string;
  scoreBreakdown?: Array<{ criterion: string; score: number; maxScore: number }>;
}

interface JobPipelineStat {
  jobId: string;
  title: string;
  department?: string;
  candidateCount: number;
  avgScorePct: number | null;
}

interface GlobalStats {
  activeJobs: number;
  openPositions: number;
  totalCandidates: number;
  interviewReady: number;
  offersSent: number;
  avgFitScorePct: number | null;
  topPipeline: JobPipelineStat | null;
  weakestPipeline: JobPipelineStat | null;
  highestRatedCandidate: { id: string; name: string; jobTitle: string; scorePct: number } | null;
  mostCommonMissingSkills: string[];
  recentActivity: string[];
  recommendation: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hourGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function confColor(c: number) {
  if (c >= 80) return "var(--rb-success)";
  if (c >= 60) return "var(--rb-warning)";
  return "var(--rb-danger)";
}

function groupConvos(list: ConversationSummary[]) {
  const groups: Record<string, ConversationSummary[]> = {};
  const now = Date.now();
  for (const c of list) {
    const diff = Math.floor((now - new Date(c.lastActiveAt).getTime()) / 86400000);
    const label = diff === 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? "This week" : "Older";
    (groups[label] ??= []).push(c);
  }
  return groups;
}

function hiringDecisionLabel(d?: string | null) {
  if (d === "strong_yes") return { text: "Strong Yes", color: "var(--rb-success)" };
  if (d === "maybe") return { text: "Maybe", color: "var(--rb-warning)" };
  if (d === "no") return { text: "No", color: "var(--rb-danger)" };
  return null;
}

// ─── Streaming placeholder (premium loading experience) ───────────────────────

const LOADING_PHRASES = ["Analyzing resumes…", "Comparing candidates…", "Generating recommendation…"];

function StreamingPlaceholder() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % LOADING_PHRASES.length), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="copilot-dot w-1.5 h-1.5 rounded-full"
            style={{ background: T.accent, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span key={idx} className="copilot-loading-text text-[13px] font-medium" style={{ color: T.textSecondary }}>
        {LOADING_PHRASES[idx]}
      </span>
    </div>
  );
}

// ─── Candidate Identity ────────────────────────────────────────────────────────
//
// Reusable name + email + fit score pairing shown whenever the Copilot
// references a specific candidate. Email and score always come from the
// database (attached server-side) — never from the AI — and are simply
// omitted if unknown. Visually separated from the response body.

function CandidateIdentity({ name, email, fitScorePct, onNavigate }: {
  name: string; email?: string; fitScorePct?: number; onNavigate?: () => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all hover:shadow-sm"
      style={{ background: "var(--rb-subtle)", borderColor: T.border }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
        style={{ background: `linear-gradient(135deg, ${T.accent}, var(--rb-accent-dark))` }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex flex-col leading-tight min-w-0 gap-0.5">
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="text-left text-[13px] font-semibold truncate hover:underline"
            style={{ color: T.text }}
          >
            {name}
          </button>
        ) : (
          <span className="text-[13px] font-semibold truncate" style={{ color: T.text }}>{name}</span>
        )}
        <div className="flex items-center gap-2.5">
          {email && (
            <a
              href={`mailto:${email}`}
              className="text-[11.5px] inline-flex items-center gap-1 truncate hover:underline"
              style={{ color: T.accent }}
              title={`Email ${name}`}
            >
              <Mail size={11} strokeWidth={2.2} />
              {email}
            </a>
          )}
          {typeof fitScorePct === "number" && (
            <span className="text-[11.5px] font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: confColor(fitScorePct) }}>
              <Star size={11} strokeWidth={2.2} fill={confColor(fitScorePct)} />
              {fitScorePct}% Fit
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Unique candidates referenced anywhere in a message's sources, in first-seen order. */
function uniqueCandidatesFromSources(sources?: CopilotSource[]): CopilotSource[] {
  if (!sources || sources.length === 0) return [];
  const seen = new Set<string>();
  const result: CopilotSource[] = [];
  for (const src of sources) {
    if (!src.candidateId || !src.candidateName) continue;
    if (seen.has(src.candidateId)) continue;
    seen.add(src.candidateId);
    result.push(src);
  }
  return result;
}

// ─── Source chip ──────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  resume: { bg: "var(--rb-src-resume-bg)", text: "var(--rb-src-resume-text)", border: "var(--rb-src-resume-border)" },
  assessment: { bg: "var(--rb-src-assessment-bg)", text: "var(--rb-src-assessment-text)", border: "var(--rb-src-assessment-border)" },
  interview_brief: { bg: "var(--rb-src-interview-bg)", text: "var(--rb-src-interview-text)", border: "var(--rb-src-interview-border)" },
  score_breakdown: { bg: "var(--rb-warning-soft-bg)", text: "var(--rb-warning-soft-text)", border: "var(--rb-warning-soft-border)" },
  candidate_profile: { bg: "var(--rb-src-profile-bg)", text: "var(--rb-src-profile-text)", border: "var(--rb-src-profile-border)" },
  job_description: { bg: "var(--rb-src-job-bg)", text: "var(--rb-src-job-text)", border: "var(--rb-src-job-border)" },
};

function SourceChip({ src, onNavigate }: { src: CopilotSource; onNavigate?: (src: CopilotSource) => void }) {
  const c = SOURCE_COLORS[src.type] ?? { bg: "var(--rb-disabled-bg)", text: T.textSecondary, border: T.border };
  const navigable = !!onNavigate && (!!src.candidateId || (!!src.jobId && src.type === "job_description"));
  const inner = (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${navigable ? "cursor-pointer hover:shadow-sm" : ""}`}
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
      title={navigable ? "Jump to this candidate's context" : (src.detail ?? src.label)}
    >
      <FileText size={10} strokeWidth={2.2} />
      {src.label}
      {src.detail && <span className="opacity-60">· {src.detail}</span>}
    </span>
  );
  if (!navigable) return inner;
  return (
    <button type="button" onClick={() => onNavigate!(src)} className="inline-flex">
      {inner}
    </button>
  );
}

// ─── Source card ──────────────────────────────────────────────────────────────
// Clean, self-contained card for a single cited source — replaces the plain
// chip so recruiters can see at a glance what type of document was used,
// which candidate it belongs to, and jump straight to it.

function SourceCard({ src, onNavigate }: { src: CopilotSource; onNavigate?: (src: CopilotSource) => void }) {
  const c = SOURCE_COLORS[src.type] ?? { bg: "var(--rb-disabled-bg)", text: T.textSecondary, border: T.border };
  const navigable = !!onNavigate && (!!src.candidateId || (!!src.jobId && src.type === "job_description"));
  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-3 transition-all hover:shadow-sm"
      style={{ background: T.card, borderColor: T.border }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: c.bg, color: c.text }}
      >
        <FileText size={14} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
          style={{ background: c.bg, color: c.text, borderColor: c.border }}
        >
          {src.label}
        </span>
        {src.candidateName && (
          <p className="text-[12.5px] font-semibold mt-1.5 truncate" style={{ color: T.text }}>{src.candidateName}</p>
        )}
        {src.candidateEmail && (
          <p className="text-[11.5px] mt-0.5 flex items-center gap-1 truncate" style={{ color: T.textSecondary }}>
            <Mail size={10} strokeWidth={2.2} />
            {src.candidateEmail}
          </p>
        )}
        {src.detail && !src.candidateName && (
          <p className="text-[11.5px] mt-1 truncate" style={{ color: T.textSecondary }}>{src.detail}</p>
        )}
      </div>
      {navigable && (
        <button
          type="button"
          onClick={() => onNavigate!(src)}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all hover:shadow-sm"
          style={{ color: T.accent, background: "var(--rb-accent-soft-bg)" }}
          title="Open this source"
        >
          <ExternalLink size={11} strokeWidth={2.2} />
          Open
        </button>
      )}
    </div>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────

function RecommendationCard({ recommendation, confidence, reasoning }: {
  recommendation: string; confidence: number; reasoning: string;
}) {
  const color = confColor(confidence);
  return (
    <div className="mt-4 rounded-2xl border p-4 space-y-3" style={{ background: "var(--rb-subtle)", borderColor: T.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Target size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: T.accent }} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: T.textSecondary }}>Recommendation</p>
            <p className="font-semibold text-[0.9rem] leading-snug" style={{ color: T.text }}>{recommendation}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: T.textSecondary }}>Confidence</p>
          <div className="flex items-center gap-1.5 justify-end">
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${confidence}%`, background: color }} />
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>{confidence}%</span>
          </div>
        </div>
      </div>
      {reasoning && (
        <p className="text-[0.8rem] leading-relaxed border-t pt-2.5" style={{ color: T.textSecondary, borderColor: T.border }}>{reasoning}</p>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onQuickAction, onSourceNavigate, onCopied }: {
  msg: UIMessage; onQuickAction: (text: string) => void; onSourceNavigate?: (src: CopilotSource) => void; onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(msg.content);
    } catch {
      // Fallback for browsers/contexts without Clipboard API permission
      const ta = document.createElement("textarea");
      ta.value = msg.content;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 1600);
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-7 rb-animate-fade-in">
        <div
          className="max-w-[78%] rounded-[22px] rounded-tr-md px-4 py-3 text-[0.9rem] leading-relaxed"
          style={{
            background: "var(--rb-accent)",
            color: "#fff",
            boxShadow: "0 8px 18px -12px var(--rb-accent)",
          }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  const mentioned = uniqueCandidatesFromSources(msg.sources);
  const showEmptyLoading = !!msg.isStreaming && !msg.content;

  return (
    <div className="mb-8 rb-animate-fade-in">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${T.accent}, var(--rb-accent-dark))`, boxShadow: "0 5px 14px -8px var(--rb-accent)" }}
        >
          <Sparkles size={13} strokeWidth={2.4} color="#fff" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: T.textSecondary }}>Rolebolt AI</span>
            {!showEmptyLoading && msg.content && (
              <button
                type="button"
                onClick={handleCopy}
                title="Copy response"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-all hover:bg-[var(--rb-subtle)]"
                style={copied
                  ? { color: "var(--rb-success)" }
                  : { color: "var(--rb-muted)" }}
              >
                {copied ? <Check size={11} strokeWidth={2.4} /> : <Copy size={11} strokeWidth={2.2} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <div
            className="rounded-2xl border px-4 py-3.5"
            style={{ background: T.card, borderColor: T.border, boxShadow: "0 1px 2px var(--rb-shadow-color)" }}
          >
            {showEmptyLoading ? (
              <StreamingPlaceholder />
            ) : (
              <div className="text-[0.9rem] leading-relaxed copilot-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                {msg.isStreaming && (
                  <span className="inline-block w-[2px] h-4 align-middle ml-0.5 rb-cursor-blink" style={{ background: T.accent }} />
                )}
              </div>
            )}

            {!msg.isStreaming && mentioned.length > 0 && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-2" style={{ borderColor: T.border }}>
                {mentioned.map((src) => (
                  <CandidateIdentity
                    key={src.candidateId}
                    name={src.candidateName!}
                    email={src.candidateEmail}
                    fitScorePct={src.candidateFitScorePct}
                    onNavigate={onSourceNavigate ? () => onSourceNavigate(src) : undefined}
                  />
                ))}
              </div>
            )}

            {!msg.isStreaming && msg.recommendation && (
              <RecommendationCard
                recommendation={msg.recommendation}
                confidence={msg.confidence ?? 0}
                reasoning={msg.reasoning ?? ""}
              />
            )}

            {!msg.isStreaming && msg.sources && msg.sources.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: T.border }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: T.textSecondary }}>
                  Sources
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {msg.sources.map((src, i) => <SourceCard key={i} src={src} onNavigate={onSourceNavigate} />)}
                </div>
              </div>
            )}

            {!msg.isStreaming && msg.quickActions && msg.quickActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {msg.quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => onQuickAction(action)}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-full border transition-all hover:shadow-sm"
                    style={{ borderColor: T.border, color: T.textSecondary, background: "var(--rb-subtle)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; e.currentTarget.style.borderColor = "var(--rb-accent-hover-border)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.textSecondary; e.currentTarget.style.borderColor = T.border; }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

const JOB_PROMPTS = [
  { Icon: Target, text: "Who should I interview first?" },
  { Icon: TrendingUp, text: "Compare my top candidates" },
  { Icon: Search, text: "Which candidates are missing required skills?" },
  { Icon: ClipboardCheck, text: "Generate interview questions for the top candidate" },
  { Icon: CheckCircle2, text: "Show candidates ready to join immediately" },
  { Icon: Award, text: "Why is the top candidate ranked #1?" },
];

const CANDIDATE_PROMPTS = [
  { Icon: ClipboardCheck, text: "Summarize this candidate" },
  { Icon: Target, text: "Explain the AI score" },
  { Icon: FileText, text: "Generate interview questions" },
  { Icon: Search, text: "Show missing skills" },
  { Icon: CheckCircle2, text: "Should I hire this candidate?" },
  { Icon: Briefcase, text: "Compare against the job description" },
];

const GLOBAL_PROMPTS = [
  { Icon: Target, text: "What should I prioritize today?" },
  { Icon: Award, text: "Which job has the strongest candidates?" },
  { Icon: AlertTriangle, text: "Which role is hardest to hire for?" },
  { Icon: Search, text: "Find candidates with React and Docker" },
  { Icon: TrendingUp, text: "Compare all active jobs" },
  { Icon: Users, text: "Where are candidates dropping off?" },
];

const FORM_GLOBAL_PROMPTS = [
  { Icon: Target, text: "What should I prioritize across my forms today?" },
  { Icon: Award, text: "Who are my top applicants overall?" },
  { Icon: TrendingUp, text: "Which form has the strongest pipeline?" },
  { Icon: AlertTriangle, text: "Which applicants are stuck in review?" },
  { Icon: ClipboardCheck, text: "Assessment completion across all forms" },
  { Icon: Users, text: "Compare my active forms" },
];

const FORM_APPLICANT_PROMPTS = [
  { Icon: ClipboardCheck, text: "Summarize this applicant" },
  { Icon: Target, text: "Should I shortlist them?" },
  { Icon: Search, text: "What are their strengths and weaknesses?" },
  { Icon: FileText, text: "How did they answer the key questions?" },
  { Icon: CheckCircle2, text: "What stage should they move to next?" },
  { Icon: Mail, text: "Draft a shortlist email" },
];

const FORM_PROMPTS = [
  { Icon: Award, text: "Who are the top applicants for this form?" },
  { Icon: Target, text: "Which applicants should I shortlist?" },
  { Icon: TrendingUp, text: "Summarize the overall applicant quality" },
  { Icon: AlertTriangle, text: "Which applicants have red flags?" },
  { Icon: ClipboardCheck, text: "How is our assessment completion rate?" },
  { Icon: Users, text: "Which stage has the most dropoff?" },
];

function WelcomeScreen({ recruiterName, jobSelected, contextMode, candidateName, formTitle, applicantName, workspace, onPrompt, loadingInsights }: {
  recruiterName?: string;
  jobSelected: boolean;
  contextMode: ContextMode;
  candidateName?: string;
  formTitle?: string;
  applicantName?: string;
  workspace: CopilotWorkspace;
  onPrompt: (t: string) => void;
  loadingInsights?: boolean;
}) {
  const handle = recruiterName?.trim() || "there";
  const isFormWorkspace = workspace === "form";
  const prompts =
    contextMode === "candidate" ? CANDIDATE_PROMPTS
    : contextMode === "form_applicant" ? FORM_APPLICANT_PROMPTS
    : contextMode === "form_global" ? FORM_GLOBAL_PROMPTS
    : contextMode === "global" ? GLOBAL_PROMPTS
    : contextMode === "form" ? FORM_PROMPTS
    : JOB_PROMPTS;
  const canChat =
    contextMode === "candidate" ? !!candidateName
    : contextMode === "form_applicant" ? !!applicantName
    : contextMode === "form_global" || contextMode === "global" ? true
    : contextMode === "form" ? !!formTitle
    : jobSelected;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 sm:py-14">
      <div
        className="w-14 h-14 rounded-[18px] flex items-center justify-center mb-5"
        style={{
          background: isFormWorkspace
            ? "linear-gradient(135deg, #a78bfa, #6d5df6)"
            : `linear-gradient(135deg, ${T.accent}, var(--rb-accent-dark))`,
          boxShadow: "0 12px 30px -16px var(--rb-accent)",
        }}
      >
        <Sparkles size={20} color="#fff" />
      </div>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3"
        style={{ color: isFormWorkspace ? "#7c3aed" : T.accent }}
      >
        {isFormWorkspace ? "Form Job Copilot" : "Standard Job Copilot"}
      </p>
      <h1 className="text-[1.8rem] tracking-[-0.04em] font-semibold mb-2" style={{ color: T.text }}>
        {hourGreeting()}, {handle}
      </h1>

      {contextMode === "candidate" && candidateName ? (
        <>
          <p className="text-[0.9rem] max-w-sm leading-relaxed mb-2" style={{ color: T.textSecondary }}>
            I'm focused on <span className="font-semibold" style={{ color: T.text }}>{candidateName}</span>. Ask me anything about this candidate.
          </p>
          <p className="text-xs mb-8" style={{ color: "var(--rb-muted)" }}>Select a prompt or type your own question below</p>
        </>
      ) : contextMode === "global" ? (
        <>
          <p className="text-[0.9rem] max-w-sm leading-relaxed mb-2" style={{ color: T.textSecondary }}>
            I'm looking across your entire Standard Job organization — every job, every candidate.
          </p>
          <p className="text-xs mb-8" style={{ color: "var(--rb-muted)" }}>Select a prompt or type your own question below</p>
        </>
      ) : contextMode === "form_global" ? (
        <>
          <p className="text-[0.9rem] max-w-sm leading-relaxed mb-2" style={{ color: T.textSecondary }}>
            Form Job workspace — all forms and applicants. Standard Job data is not included here.
          </p>
          <p className="text-xs mb-8" style={{ color: "var(--rb-muted)" }}>Select a prompt or type your own question below</p>
        </>
      ) : contextMode === "form_applicant" && applicantName ? (
        <>
          <p className="text-[0.9rem] max-w-sm leading-relaxed mb-2" style={{ color: T.textSecondary }}>
            Focused on applicant <span className="font-semibold" style={{ color: T.text }}>{applicantName}</span>
            {formTitle ? <> on <span className="font-semibold" style={{ color: T.text }}>{formTitle}</span></> : null}.
          </p>
          <p className="text-xs mb-8" style={{ color: "var(--rb-muted)" }}>Select a prompt or type your own question below</p>
        </>
      ) : contextMode === "form" && formTitle ? (
        <>
          <p className="text-[0.9rem] max-w-sm leading-relaxed mb-2" style={{ color: T.textSecondary }}>
            I'm focused on the form <span className="font-semibold" style={{ color: T.text }}>{formTitle}</span>. Ask me about applicants, scores, assessments, or pipeline.
          </p>
          <p className="text-xs mb-8" style={{ color: "var(--rb-muted)" }}>Select a prompt or type your own question below</p>
        </>
      ) : contextMode === "form" ? (
        <>
          <p className="text-[0.9rem] max-w-sm leading-relaxed mb-2" style={{ color: T.textSecondary }}>
            I can analyse any application form — applicant scores, pipeline health, assessments, and who to shortlist.
          </p>
          <p className="text-xs font-medium mb-6 flex items-center gap-1.5" style={{ color: "var(--rb-warning)" }}>
            <span>↑</span> Select a form from the left sidebar to get started
          </p>
        </>
      ) : (
        <>
          <p className="text-[0.9rem] max-w-sm leading-relaxed mb-2" style={{ color: T.textSecondary }}>
            I'm Rolebolt AI. I can help you compare candidates, explain scores, generate interview questions, and recommend who to interview next.
          </p>
          {!jobSelected && (
            <p className="text-xs font-medium mb-6 flex items-center gap-1.5" style={{ color: "var(--rb-warning)" }}>
              <span>↑</span> Select a job from the left sidebar to get started
            </p>
          )}
          {jobSelected && (
            <p className="text-xs mb-8" style={{ color: "var(--rb-muted)" }}>Select a prompt or type your own question below</p>
          )}
        </>
      )}

      {loadingInsights && (contextMode === "global" || contextMode === "form_global") && (
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]"
          style={{
            background: "var(--rb-accent-softer-bg)",
            borderColor: "var(--rb-accent-soft-border)",
            color: T.textSecondary,
          }}
        >
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: T.accent }} />
            <span className="h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:120ms]" style={{ background: T.accent }} />
            <span className="h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:240ms]" style={{ background: T.accent }} />
          </span>
          Preparing a quick hiring overview — you can start chatting now
        </div>
      )}

      {canChat && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl">
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => onPrompt(p.text)}
              className="group flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{
                background: T.card,
                borderColor: T.border,
                boxShadow: "0 1px 2px var(--rb-shadow-color)",
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: isFormWorkspace ? "rgba(124,58,237,0.1)" : "var(--rb-accent-soft-bg)",
                  color: isFormWorkspace ? "#7c3aed" : T.accent,
                }}
              >
                <p.Icon size={15} strokeWidth={2.2} />
              </span>
              <span className="text-[13px] leading-5 transition-colors group-hover:text-[var(--rb-text)]" style={{ color: T.textSecondary }}>{p.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Metric card (right context panels) ────────────────────────────────────────

function MetricCard({ label, value, color, icon: Icon }: {
  label: string; value: string | number; color?: string; icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={12} strokeWidth={2.2} />}
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.textSecondary }}>{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color: color ?? T.text }}>{value}</p>
    </div>
  );
}

function PanelSectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--rb-muted)" }}>{children}</p>;
}

// ─── Job context panel (right sidebar) ───────────────────────────────────────

function JobContextPanel({ job, candidates }: { job: Job | null; candidates: CandidateStat[] }) {
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3" style={{ background: T.card, borderColor: T.border }}>
          <Briefcase size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>Select a job to see context</p>
      </div>
    );
  }

  const scored = candidates.filter(c => c.maxScore > 0);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, c) => s + Math.round((c.totalScore / c.maxScore) * 100), 0) / scored.length)
    : null;
  const top3 = [...candidates]
    .sort((a, b) => (b.maxScore ? b.totalScore / b.maxScore : 0) - (a.maxScore ? a.totalScore / a.maxScore : 0))
    .slice(0, 5);

  return (
    <div className="px-4 py-5 space-y-5 overflow-y-auto h-full scrollbar-none">
      <div>
        <PanelSectionLabel>Current Context</PanelSectionLabel>
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--rb-success)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.textSecondary }}>Job</p>
          </div>
          <p className="text-[0.9rem] font-semibold leading-snug" style={{ color: T.text }}>{job.title}</p>
          {job.department && <p className="text-[11px] mt-0.5" style={{ color: T.textSecondary }}>{job.department}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Candidates" value={job.candidateCount} icon={Users} />
        <MetricCard label="Avg Score" value={avgScore ?? "—"} color={avgScore ? confColor(avgScore) : undefined} icon={Target} />
      </div>

      {top3.length > 0 && (
        <div>
          <PanelSectionLabel>Top Candidates</PanelSectionLabel>
          <div className="space-y-1.5">
            {top3.map((c, i) => {
              const pct = c.maxScore ? Math.round((c.totalScore / c.maxScore) * 100) : 0;
              return (
                <div key={c._id} className="flex items-center gap-2.5 p-2.5 rounded-xl border" style={{ background: "var(--rb-subtle)", borderColor: T.border }}>
                  <span className="text-[10px] font-bold w-3 shrink-0" style={{ color: "var(--rb-muted)" }}>#{i + 1}</span>
                  <span className="flex-1 text-[12px] truncate font-medium" style={{ color: T.text }}>{c.name}</span>
                  <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: confColor(pct) }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {job && (
        <div className="pt-1">
          <Link
            href={`/recruit/jobs/${job._id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[12px] font-medium transition-all hover:shadow-sm"
            style={{ borderColor: T.border, color: T.textSecondary, background: T.card }}
          >
            <Users size={13} strokeWidth={2} />
            View all candidates
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Global / Organization context panel (right sidebar) ─────────────────────

function GlobalContextPanel({ stats, loading }: { stats: GlobalStats | null; loading: boolean }) {
  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3 animate-pulse" style={{ background: T.card, borderColor: T.border }}>
          <Globe size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>Loading organization data…</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3" style={{ background: T.card, borderColor: T.border }}>
          <Globe size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>No organization data yet</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 overflow-y-auto h-full scrollbar-none">
      <div>
        <PanelSectionLabel>Organization Context</PanelSectionLabel>
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--rb-info)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.textSecondary }}>Global</p>
          </div>
          <p className="text-[0.9rem] font-semibold leading-snug mt-1" style={{ color: T.text }}>Every job, every candidate</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Active Jobs" value={stats.activeJobs} icon={Briefcase} />
        <MetricCard label="Total Candidates" value={stats.totalCandidates} icon={Users} />
        <MetricCard label="Interview Ready" value={stats.interviewReady} icon={CheckCircle2} />
        <MetricCard label="Offers Sent" value={stats.offersSent} icon={Mail} />
        <MetricCard label="Avg Fit Score" value={stats.avgFitScorePct !== null ? `${stats.avgFitScorePct}%` : "—"} color={stats.avgFitScorePct ? confColor(stats.avgFitScorePct) : undefined} icon={Target} />
        <MetricCard label="Open Positions" value={stats.openPositions} icon={Briefcase} />
      </div>

      {stats.topPipeline && (
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <PanelSectionLabel>Top Hiring Pipeline</PanelSectionLabel>
          <p className="text-[0.85rem] font-semibold" style={{ color: T.text }}>{stats.topPipeline.title}</p>
          {stats.topPipeline.avgScorePct !== null && (
            <p className="text-[11px] mt-0.5" style={{ color: confColor(stats.topPipeline.avgScorePct) }}>
              {stats.topPipeline.avgScorePct}% avg fit · {stats.topPipeline.candidateCount} candidates
            </p>
          )}
        </div>
      )}

      {stats.highestRatedCandidate && (
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <PanelSectionLabel>Highest Rated Candidate</PanelSectionLabel>
          <p className="text-[0.85rem] font-semibold" style={{ color: T.text }}>{stats.highestRatedCandidate.name}</p>
          <p className="text-[11px] mt-0.5" style={{ color: T.textSecondary }}>
            {stats.highestRatedCandidate.jobTitle} · <span style={{ color: confColor(stats.highestRatedCandidate.scorePct) }}>{stats.highestRatedCandidate.scorePct}%</span>
          </p>
        </div>
      )}

      {stats.mostCommonMissingSkills.length > 0 && (
        <div>
          <PanelSectionLabel>Commonly Missing Skills</PanelSectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {stats.mostCommonMissingSkills.map((s, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border" style={{ background: "var(--rb-warning-soft-bg)", color: "var(--rb-warning-soft-text)", borderColor: "var(--rb-warning-soft-border)" }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {stats.recentActivity.length > 0 && (
        <div>
          <PanelSectionLabel>Recent Activity</PanelSectionLabel>
          <div className="space-y-1.5">
            {stats.recentActivity.map((a, i) => (
              <div key={i} className="text-[12px] p-2.5 rounded-xl border" style={{ background: "var(--rb-subtle)", borderColor: T.border, color: T.textSecondary }}>{a}</div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3.5 rounded-2xl border" style={{ background: "var(--rb-accent-softer-bg)", borderColor: "var(--rb-accent-soft-border)" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={12} strokeWidth={2.2} style={{ color: T.accent }} />
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.accent }}>AI Recommendation</p>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--rb-accent-dark)" }}>{stats.recommendation}</p>
      </div>
    </div>
  );
}

// ─── Candidate context panel (right sidebar) ──────────────────────────────────

function CandidateContextPanel({ candidate, job, onSwitchToJob }: {
  candidate: CandidateStat | null;
  job: Job | null;
  onSwitchToJob: () => void;
}) {
  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3" style={{ background: T.card, borderColor: T.border }}>
          <User size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>No candidate selected</p>
      </div>
    );
  }

  const pct = candidate.maxScore > 0 ? Math.round((candidate.totalScore / candidate.maxScore) * 100) : null;
  const decision = hiringDecisionLabel(candidate.hiringDecision);

  return (
    <div className="px-4 py-5 space-y-4 overflow-y-auto h-full scrollbar-none">
      <div>
        <PanelSectionLabel>Candidate Focus</PanelSectionLabel>

        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: T.accent }} />
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.textSecondary }}>Candidate</p>
              </div>
              <p className="text-[0.9rem] font-semibold leading-snug" style={{ color: T.text }}>{candidate.name}</p>
              {candidate.stage && (
                <p className="text-[11px] mt-0.5 capitalize" style={{ color: T.textSecondary }}>{candidate.stage}</p>
              )}
            </div>
            {pct !== null && (
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: T.textSecondary }}>Fit Score</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: confColor(pct) }}>{pct}%</p>
              </div>
            )}
          </div>

          {pct !== null && (
            <div className="mt-2.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: confColor(pct) }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {decision && (
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <PanelSectionLabel>Current Recommendation</PanelSectionLabel>
          <span className="text-sm font-bold" style={{ color: decision.color }}>{decision.text}</span>
        </div>
      )}

      {candidate.assessmentStatus && (
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <PanelSectionLabel>Assessment</PanelSectionLabel>
          <span className="text-[12px] font-semibold capitalize" style={{
            color: candidate.assessmentStatus === "completed" ? "var(--rb-success)" :
              candidate.assessmentStatus === "sent" ? "var(--rb-warning)" : T.textSecondary
          }}>
            {candidate.assessmentStatus === "not_sent" ? "Not sent" : candidate.assessmentStatus}
          </span>
        </div>
      )}

      {candidate.strengths && candidate.strengths.length > 0 && (
        <div>
          <PanelSectionLabel>Top Strengths</PanelSectionLabel>
          <div className="space-y-1.5">
            {candidate.strengths.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: T.textSecondary }}>
                <CheckCircle2 size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: "var(--rb-success)" }} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidate.redFlags && candidate.redFlags.length > 0 && (
        <div>
          <PanelSectionLabel>Red Flags</PanelSectionLabel>
          <div className="space-y-1.5">
            {candidate.redFlags.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: T.textSecondary }}>
                <AlertTriangle size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: "var(--rb-danger)" }} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidate.availability && (
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <PanelSectionLabel>Notice Period / Availability</PanelSectionLabel>
          <p className="text-[12px]" style={{ color: T.text }}>{candidate.availability}</p>
        </div>
      )}

      {job && (
        <div className="pt-1 space-y-2">
          <button
            onClick={onSwitchToJob}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[12px] font-medium transition-all hover:shadow-sm"
            style={{ borderColor: T.border, color: T.textSecondary, background: T.card }}
          >
            <Briefcase size={13} strokeWidth={2} />
            Switch to Job View
          </button>
          <Link
            href={`/recruit/jobs/${job._id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[12px] font-medium transition-all hover:shadow-sm"
            style={{ borderColor: T.border, color: T.textSecondary, background: T.card }}
          >
            <Users size={13} strokeWidth={2} />
            View all candidates
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Form context panel (right sidebar) ──────────────────────────────────────

function FormContextPanel({ form }: { form: Form | null }) {
  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3" style={{ background: T.card, borderColor: T.border }}>
          <FileText size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>Select a form to see context</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 overflow-y-auto h-full scrollbar-none">
      <div>
        <PanelSectionLabel>Current Context</PanelSectionLabel>
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--rb-success)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.textSecondary }}>Application Form</p>
          </div>
          <p className="text-[0.9rem] font-semibold leading-snug" style={{ color: T.text }}>{form.title}</p>
          <p className="text-[11px] mt-0.5 capitalize" style={{ color: T.textSecondary }}>{form.status}</p>
        </div>
      </div>

      {form.responseCount !== undefined && (
        <MetricCard label="Applicants" value={form.responseCount} icon={Users} />
      )}

      <div className="pt-1">
        <Link
          href={`/recruit/forms/${form._id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[12px] font-medium transition-all hover:shadow-sm"
          style={{ borderColor: T.border, color: T.textSecondary, background: T.card }}
        >
          <FileText size={13} strokeWidth={2} />
          Open form
        </Link>
      </div>
    </div>
  );
}

function FormGlobalContextPanel({ stats, loading }: { stats: FormGlobalStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3 animate-pulse" style={{ background: T.card, borderColor: T.border }}>
          <FileText size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>Loading form organization data…</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3" style={{ background: T.card, borderColor: T.border }}>
          <FileText size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>No form data yet</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 overflow-y-auto h-full scrollbar-none">
      <div>
        <PanelSectionLabel>Form Job Context</PanelSectionLabel>
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--rb-info)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.textSecondary }}>All Forms</p>
          </div>
          <p className="text-[0.9rem] font-semibold leading-snug mt-1" style={{ color: T.text }}>Every form, every applicant</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Active Forms" value={stats.activeForms} icon={FileText} />
        <MetricCard label="Total Applicants" value={stats.totalApplicants} icon={Users} />
        <MetricCard label="Shortlisted" value={stats.shortlisted} icon={CheckCircle2} />
        <MetricCard label="In Interview" value={stats.interviewStage} icon={Users} />
        <MetricCard label="Hired" value={stats.hired} icon={Award} />
        <MetricCard label="Avg AI Score" value={stats.avgAiScorePct !== null ? `${stats.avgAiScorePct}%` : "—"} color={stats.avgAiScorePct ? confColor(stats.avgAiScorePct) : undefined} icon={Target} />
      </div>

      {stats.topForm && (
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <PanelSectionLabel>Top Form Pipeline</PanelSectionLabel>
          <p className="text-[0.85rem] font-semibold" style={{ color: T.text }}>{stats.topForm.title}</p>
          {stats.topForm.avgScorePct !== null && (
            <p className="text-[11px] mt-0.5" style={{ color: confColor(stats.topForm.avgScorePct) }}>
              {stats.topForm.avgScorePct}% avg score · {stats.topForm.responseCount} applicants
            </p>
          )}
        </div>
      )}

      {stats.highestRatedApplicant && (
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <PanelSectionLabel>Highest Rated Applicant</PanelSectionLabel>
          <p className="text-[0.85rem] font-semibold" style={{ color: T.text }}>{stats.highestRatedApplicant.name}</p>
          <p className="text-[11px] mt-0.5" style={{ color: T.textSecondary }}>
            {stats.highestRatedApplicant.formTitle} · <span style={{ color: confColor(stats.highestRatedApplicant.scorePct) }}>{stats.highestRatedApplicant.scorePct}%</span>
          </p>
        </div>
      )}
    </div>
  );
}

function FormApplicantContextPanel({ applicant, form, onSwitchToForm }: {
  applicant: FormApplicantStat | null;
  form: Form | null;
  onSwitchToForm: () => void;
}) {
  if (!applicant) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-3" style={{ background: T.card, borderColor: T.border }}>
          <User size={16} strokeWidth={2} style={{ color: "var(--rb-faint)" }} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--rb-muted)" }}>No applicant selected</p>
      </div>
    );
  }

  const pct = applicant.scoringFailed ? null : Math.round(applicant.aiScore);

  return (
    <div className="px-4 py-5 space-y-4 overflow-y-auto h-full scrollbar-none">
      <div>
        <PanelSectionLabel>Applicant Focus</PanelSectionLabel>
        <div className="p-3.5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: T.accent }} />
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.textSecondary }}>Applicant</p>
              </div>
              <p className="text-[0.9rem] font-semibold leading-snug" style={{ color: T.text }}>{applicant.submittedName}</p>
              {applicant.stage && (
                <p className="text-[11px] mt-0.5 capitalize" style={{ color: T.textSecondary }}>{applicant.stage.replace(/_/g, " ")}</p>
              )}
            </div>
            {pct !== null && (
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: T.textSecondary }}>AI Score</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: confColor(pct) }}>{pct}%</p>
              </div>
            )}
          </div>
          {pct !== null && (
            <div className="mt-2.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: confColor(pct) }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {applicant.aiSummary && (
        <div>
          <PanelSectionLabel>AI Summary</PanelSectionLabel>
          <p className="text-[12px] leading-relaxed p-3 rounded-xl border" style={{ background: "var(--rb-subtle)", borderColor: T.border, color: T.textSecondary }}>{applicant.aiSummary}</p>
        </div>
      )}

      {applicant.strengths && applicant.strengths.length > 0 && (
        <div>
          <PanelSectionLabel>Strengths</PanelSectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {applicant.strengths.map((s, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border" style={{ background: "var(--rb-success-soft-bg)", color: "var(--rb-success-soft-text)", borderColor: "var(--rb-success-soft-border)" }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {applicant.redFlags && applicant.redFlags.length > 0 && (
        <div>
          <PanelSectionLabel>Red Flags</PanelSectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {applicant.redFlags.map((s, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border" style={{ background: "var(--rb-danger-soft-bg)", color: "var(--rb-danger-soft-text)", borderColor: "var(--rb-danger-soft-border)" }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {form && (
        <div className="pt-1 space-y-2">
          <button
            onClick={onSwitchToForm}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[12px] font-medium transition-all hover:shadow-sm"
            style={{ borderColor: T.border, color: T.textSecondary, background: T.card }}
          >
            <FileText size={13} strokeWidth={2} />
            Switch to Form View
          </button>
          <Link
            href={`/recruit/forms/${form._id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[12px] font-medium transition-all hover:shadow-sm"
            style={{ borderColor: T.border, color: T.textSecondary, background: T.card }}
          >
            <ExternalLink size={13} strokeWidth={2} />
            Open form
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function CopilotPageContent() {
  const { sessionToken, recruitProfile } = useRecruitAuth();

  const [workspace, setWorkspace] = useState<CopilotWorkspace | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [candidateDropdownOpen, setCandidateDropdownOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");

  // Form state
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [formDropdownOpen, setFormDropdownOpen] = useState(false);
  const [applicantDropdownOpen, setApplicantDropdownOpen] = useState(false);
  const [formApplicants, setFormApplicants] = useState<FormApplicantStat[]>([]);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [selectedApplicant, setSelectedApplicant] = useState<FormApplicantStat | null>(null);
  const [formGlobalStats, setFormGlobalStats] = useState<FormGlobalStats | null>(null);
  const [formGlobalStatsLoading, setFormGlobalStatsLoading] = useState(false);

  const [contextMode, setContextMode] = useState<ContextMode>("global");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateStat | null>(null);

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [globalStatsLoading, setGlobalStatsLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const insightsRequestedRef = useRef(false);

  // Pending URL params (applied after data loads)
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);
  const [pendingResponseId, setPendingResponseId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [candidates, setCandidates] = useState<CandidateStat[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const toggleTheme = useCallback(() => setTheme(isDark ? "white" : "dark"), [isDark, setTheme]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Auth token ─────────────────────────────────────────────────────────────
  const getToken = useCallback(async () => {
    return sessionToken ?? null;
  }, [sessionToken]);

  // ── Read URL params on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ws = params.get("workspace") as CopilotWorkspace | null;
    if (ws === "form" || ws === "standard") {
      setWorkspace(ws);
      setContextMode(defaultContextMode(ws));
    }
    const urlJobId = params.get("jobId");
    const urlCandidateId = params.get("candidateId");
    const urlFormId = params.get("formId");
    const urlResponseId = params.get("responseId");
    if (urlJobId) {
      setPendingJobId(urlJobId);
      setWorkspace("standard");
      setContextMode(urlCandidateId ? "candidate" : "job");
    }
    if (urlCandidateId) setPendingCandidateId(urlCandidateId);
    if (urlFormId) {
      setPendingFormId(urlFormId);
      setWorkspace("form");
      setContextMode(urlResponseId ? "form_applicant" : "form");
    }
    if (urlResponseId) setPendingResponseId(urlResponseId);
  }, []);

  // ── Load jobs ──────────────────────────────────────────────────────────────
  // No auto-selection: with no job/candidate selected, Rolebolt defaults to
  // Global Context (Organization Intelligence) — no manual filtering required.
  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(apiUrl("/recruit/jobs"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setJobs(data.jobs ?? []);
      } catch {}
    }
    load();
  }, [getToken]);

  // ── Load forms ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(apiUrl("/recruit/forms"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setForms(data.forms ?? []);
      } catch {}
    }
    load();
  }, [getToken]);

  // ── Apply pending job ID after jobs load ───────────────────────────────────
  useEffect(() => {
    if (!pendingJobId || jobs.length === 0) return;
    const job = jobs.find(j => j._id === pendingJobId);
    if (job) setSelectedJob(job);
    setPendingJobId(null);
  }, [pendingJobId, jobs]);

  // ── Load organization-wide stats (Global Context Panel) ────────────────────
  useEffect(() => {
    if (!pendingFormId || forms.length === 0) return;
    const form = forms.find(f => f._id === pendingFormId);
    if (form) setSelectedForm(form);
    setPendingFormId(null);
  }, [pendingFormId, forms]);

  const loadGlobalStats = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setGlobalStatsLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/copilot/global-stats"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setGlobalStats(data.stats ?? null);
    } catch {} finally {
      setGlobalStatsLoading(false);
    }
  }, [getToken]);

  const loadFormGlobalStats = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setFormGlobalStatsLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/copilot/form-global-stats"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setFormGlobalStats(data.stats ?? null);
    } catch {} finally {
      setFormGlobalStatsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (contextMode === "global" && workspace === "standard") loadGlobalStats();
    if (contextMode === "form_global" && workspace === "form") loadFormGlobalStats();
  }, [contextMode, workspace, loadGlobalStats, loadFormGlobalStats]);

  // ── Auto-generate insights card when global context opens ─────────────────
  // opens with no active conversation — the AI doesn't wait for a question.
  const loadInsights = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setInsightsLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/copilot/insights"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveConvId(data.conversationId);
      setMessages([{
        id: `insights-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        recommendation: data.recommendation,
        confidence: data.confidence,
        reasoning: data.reasoning,
        sources: data.sources ?? [],
        quickActions: data.quickActions ?? [],
      }]);
      loadConversations();
    } catch {} finally {
      setInsightsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  const loadFormInsights = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setInsightsLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/copilot/form-insights"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveConvId(data.conversationId);
      setMessages([{
        id: `form-insights-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        recommendation: data.recommendation,
        confidence: data.confidence,
        reasoning: data.reasoning,
        sources: data.sources ?? [],
        quickActions: data.quickActions ?? [],
      }]);
      loadConversations();
    } catch {} finally {
      setInsightsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  useEffect(() => {
    if (messages.length > 0 || activeConvId || insightsRequestedRef.current || !workspace) return;
    if (workspace === "standard" && contextMode === "global") {
      insightsRequestedRef.current = true;
      loadInsights();
    }
    if (workspace === "form" && contextMode === "form_global") {
      insightsRequestedRef.current = true;
      loadFormInsights();
    }
  }, [workspace, contextMode, messages.length, activeConvId, loadInsights, loadFormInsights]);

  // ── Load conversations ─────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const token = await getToken();
    if (!token || !workspace) return;
    try {
      const res = await fetch(apiUrl(`/recruit/copilot/conversations?workspace=${workspace}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {}
  }, [getToken, workspace]);

  useEffect(() => { if (workspace) loadConversations(); }, [loadConversations, workspace]);

  // ── Load form applicants when a form is selected ───────────────────────────
  useEffect(() => {
    if (workspace !== "form" || !selectedForm) {
      setFormApplicants([]);
      return;
    }
    async function load() {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(apiUrl(`/recruit/forms/${selectedForm!._id}/responses`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: FormApplicantStat[] = (data.responses ?? []).map((r: any) => ({
          _id: r._id,
          submittedName: r.submittedName || "Applicant",
          submittedEmail: r.submittedEmail,
          aiScore: r.aiScore ?? 0,
          scoringFailed: r.scoringFailed,
          stage: r.stage,
          aiSummary: r.aiSummary,
          strengths: r.strengths,
          redFlags: r.redFlags,
          assessmentStatus: r.assessmentStatus,
          assessmentScore: r.assessmentScore,
        }));
        setFormApplicants(list);
        if (pendingResponseId) {
          const a = list.find(x => x._id === pendingResponseId);
          if (a) {
            setSelectedApplicant(a);
            setSelectedResponseId(a._id);
            setContextMode("form_applicant");
          }
          setPendingResponseId(null);
        }
      } catch {}
    }
    load();
  }, [workspace, selectedForm, getToken, pendingResponseId]);

  useEffect(() => {
    if (!selectedResponseId || formApplicants.length === 0) return;
    const a = formApplicants.find(x => x._id === selectedResponseId);
    if (a) setSelectedApplicant(a);
  }, [selectedResponseId, formApplicants]);

  // ── Load candidates for context panel + apply pending candidateId ──────────
  useEffect(() => {
    if (!selectedJob) { setCandidates([]); return; }
    async function load() {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(apiUrl(`/recruit/jobs/${selectedJob!._id}/candidates`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: CandidateStat[] = data.candidates ?? [];
        setCandidates(list);

        // Apply pending candidateId from URL once candidates are loaded
        if (pendingCandidateId) {
          const c = list.find(c => c._id === pendingCandidateId);
          if (c) {
            setSelectedCandidate(c);
            setSelectedCandidateId(c._id);
          }
          setPendingCandidateId(null);
        }
      } catch {}
    }
    load();
  }, [selectedJob, getToken, pendingCandidateId]);

  // ── Keep selectedCandidate in sync when candidates list refreshes ──────────
  useEffect(() => {
    if (!selectedCandidateId || candidates.length === 0) return;
    const c = candidates.find(c => c._id === selectedCandidateId);
    if (c) setSelectedCandidate(c);
  }, [selectedCandidateId, candidates]);

  // ── Load a conversation ────────────────────────────────────────────────────
  const openConversation = useCallback(async (id: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/recruit/copilot/conversations/${id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveConvId(id);
      setMessages(
        (data.messages ?? []).map((m: any, i: number) => ({
          id: `${id}-${i}`,
          role: m.role,
          content: m.content,
          recommendation: m.recommendation,
          confidence: m.confidence,
          reasoning: m.reasoning,
          sources: m.sources ?? [],
          quickActions: m.quickActions ?? [],
        }))
      );

      // Restore workspace + context
      const ws = inferWorkspace(data.context ?? {});
      setWorkspace(ws);
      const level = (data.context?.level || defaultContextMode(ws)) as ContextMode;
      setContextMode(level);

      if (ws === "form") {
        setSelectedJob(null);
        setSelectedCandidateId(null);
        setSelectedCandidate(null);
        const formId = data.selectedFormId || data.context?.formId;
        if (formId) setSelectedForm(forms.find(f => f._id === formId) ?? null);
        if (data.selectedResponseId || data.context?.responseId) {
          setSelectedResponseId(data.selectedResponseId || data.context?.responseId);
        }
      } else if (data.selectedJobId || data.context?.jobId) {
        const jobId = data.selectedJobId || data.context?.jobId;
        const matchJob = jobs.find(j => j._id === jobId);
        if (matchJob) setSelectedJob(matchJob);
        setSelectedForm(null);
        setSelectedResponseId(null);
        setSelectedApplicant(null);
        if (data.selectedCandidateId && level === "candidate") {
          setSelectedCandidateId(data.selectedCandidateId);
        }
      } else if (level === "global") {
        setSelectedJob(null);
        setSelectedCandidateId(null);
        setSelectedCandidate(null);
        setSelectedForm(null);
      }
    } catch {}
  }, [getToken, jobs, forms]);

  // ── Deep-link navigation from an AI source citation ────────────────────────
  // Clicking a candidate/job source chip switches the whole Copilot UI into
  // that candidate's (or job's) context in place — no page reload, no lost
  // conversation. If the source belongs to a different job than the one
  // currently selected, we switch jobs first via the same pendingCandidateId
  // flow already used for URL deep links.
  const handleSourceNavigate = useCallback((src: CopilotSource) => {
    if (workspace === "form") {
      if (src.candidateId) {
        const formId = src.jobId;
        if (formId && formId !== selectedForm?._id) {
          const form = forms.find(f => f._id === formId);
          if (form) setSelectedForm(form);
        }
        setContextMode("form_applicant");
        setSelectedResponseId(src.candidateId);
        setPendingResponseId(src.candidateId);
      } else if ((src.type === "form_description" || src.type === "job_description") && src.jobId) {
        const form = forms.find(f => f._id === src.jobId);
        if (form) {
          setSelectedForm(form);
          setContextMode("form");
          setSelectedResponseId(null);
          setSelectedApplicant(null);
        }
      }
      return;
    }
    if (src.candidateId) {
      const targetJobId = src.jobId;
      // Resolve the job context this candidate lives under. If the source
      // didn't carry a jobId (older messages, or the AI omitted it) we can
      // only navigate when we're already sitting inside that job/candidate's
      // context — otherwise there's nothing to fetch the candidate from.
      if (targetJobId && targetJobId !== selectedJob?._id) {
        const job = jobs.find(j => j._id === targetJobId);
        if (!job) return; // job not in the loaded list (e.g. archived) — can't resolve
        setSelectedJob(job);
      } else if (!targetJobId && !selectedJob) {
        return; // no job context to resolve the candidate against
      }
      setContextMode("candidate");
      setSelectedCandidateId(src.candidateId);
      setPendingCandidateId(src.candidateId);
    } else if (src.type === "job_description" && src.jobId) {
      const job = jobs.find(j => j._id === src.jobId);
      if (job) {
        setSelectedJob(job);
        setContextMode("job");
        setSelectedCandidateId(null);
        setSelectedCandidate(null);
      }
    }
  }, [workspace, forms, selectedForm, jobs, selectedJob]);

  function selectWorkspace(ws: CopilotWorkspace) {
    setWorkspace(ws);
    setContextMode(defaultContextMode(ws));
    newChat(true);
    insightsRequestedRef.current = false;
    setSelectedJob(null);
    setSelectedForm(null);
    setSelectedCandidateId(null);
    setSelectedCandidate(null);
    setSelectedResponseId(null);
    setSelectedApplicant(null);
  }

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Textarea auto-height ───────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  // ── New chat ───────────────────────────────────────────────────────────────
  // Starting a fresh conversation with no job/candidate selected returns to
  // Global Context — mirrors "no manual filtering required".
  function newChat(resetToGlobal = true) {
    if (abortRef.current) abortRef.current.abort();
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
    insightsRequestedRef.current = false;
    if (resetToGlobal && workspace) {
      setContextMode(defaultContextMode(workspace));
      setSelectedJob(null);
      setSelectedCandidateId(null);
      setSelectedCandidate(null);
      setSelectedForm(null);
      setSelectedResponseId(null);
      setSelectedApplicant(null);
    }
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  // ── Delete conversation ────────────────────────────────────────────────────
  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const token = await getToken();
    if (!token) return;
    setDeletingId(id);
    try {
      await fetch(apiUrl(`/recruit/copilot/conversations/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (activeConvId === id) newChat();
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch {} finally {
      setDeletingId(null);
    }
  }

  // ── Send message (streaming) ───────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !workspace) return;
    if (workspace === "form") {
      if (contextMode === "form" && !selectedForm) return;
      if (contextMode === "form_applicant" && (!selectedForm || !selectedResponseId)) return;
    } else {
      if (contextMode !== "global" && !selectedJob) return;
      if (contextMode === "candidate" && !selectedCandidateId) return;
    }

    const token = await getToken();
    if (!token) return;

    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: "user", content: trimmed },
      { id: aiMsgId, role: "assistant", content: "", isStreaming: true },
    ]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsStreaming(true);
    requestAnimationFrame(() => textareaRef.current?.focus());

    const controller = new AbortController();
    abortRef.current = controller;

    const chatContext = buildApiContext({
      workspace,
      mode: contextMode,
      jobId: selectedJob?._id,
      candidateId: selectedCandidateId,
      formId: selectedForm?._id,
      responseId: selectedResponseId,
    });

    try {
      const res = await fetch(apiUrl("/recruit/copilot/chat/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          context: chatContext,
          conversationId: activeConvId,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "token") {
                setMessages(prev =>
                  prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + evt.token } : m)
                );
              } else if (evt.type === "done") {
                setActiveConvId(evt.conversationId);
                setMessages(prev =>
                  prev.map(m => m.id === aiMsgId ? {
                    ...m,
                    isStreaming: false,
                    recommendation: evt.recommendation,
                    confidence: evt.confidence,
                    reasoning: evt.reasoning,
                    sources: evt.sources ?? [],
                    quickActions: evt.quickActions ?? [],
                  } : m)
                );
                loadConversations();
              } else if (evt.type === "error") {
                setMessages(prev =>
                  prev.map(m => m.id === aiMsgId ? {
                    ...m, isStreaming: false,
                    content: evt.error || "Something went wrong. Please try again.",
                  } : m)
                );
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages(prev =>
          prev.map(m => m.id === aiMsgId ? {
            ...m, isStreaming: false, content: "Something went wrong. Please try again.",
          } : m)
        );
      }
    } finally {
      setIsStreaming(false);
      // Restore focus/cursor after the response finishes so the recruiter can
      // keep chatting without touching the mouse.
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isStreaming, workspace, selectedJob, selectedCandidateId, selectedForm, selectedResponseId, contextMode, getToken, activeConvId, loadConversations]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
    // Shift+Enter falls through to the textarea's default behavior (newline).
  }

  // ── Input placeholder text ─────────────────────────────────────────────────
  const inputPlaceholder = (() => {
    if (contextMode === "global") return "Ask about your entire Standard Job organization…";
    if (contextMode === "form_global") return "Ask about all your forms and applicants…";
    if (contextMode === "form") {
      if (!selectedForm) return "Select a form first…";
      return `Ask about ${selectedForm.title}…`;
    }
    if (contextMode === "form_applicant") {
      if (!selectedApplicant) return "Loading applicant…";
      return `Ask about ${selectedApplicant.submittedName.split(" ")[0]}…`;
    }
    if (!selectedJob) return "Select a job first…";
    if (contextMode === "candidate") {
      if (!selectedCandidate) return "Loading candidate…";
      return `Ask about ${selectedCandidate.name.split(" ")[0]}…`;
    }
    return `Ask about ${selectedJob.title}…`;
  })();

  const textDisabled =
    (workspace === "form" && contextMode === "form" && !selectedForm) ||
    (workspace === "form" && contextMode === "form_applicant" && !selectedApplicant) ||
    (workspace === "standard" && contextMode !== "global" && !selectedJob) ||
    (workspace === "standard" && contextMode === "candidate" && !selectedCandidate);
  const sendDisabled = isStreaming || textDisabled;

  // ── Grouped conversations ──────────────────────────────────────────────────
  const grouped = groupConvos(conversations);
  const groupOrder = ["Today", "Yesterday", "This week", "Older"];

  // ── Context panel ─────────────────────────────────────────────────────────
  const contextPanel =
    workspace === "form"
      ? contextMode === "form_applicant"
        ? (
          <FormApplicantContextPanel
            applicant={selectedApplicant}
            form={selectedForm}
            onSwitchToForm={() => {
              setContextMode("form");
              setSelectedResponseId(null);
              setSelectedApplicant(null);
              newChat(false);
            }}
          />
        )
        : contextMode === "form_global"
        ? (
          <FormGlobalContextPanel stats={formGlobalStats} loading={formGlobalStatsLoading} />
        )
        : (
          <FormContextPanel form={selectedForm} />
        )
      : contextMode === "candidate"
      ? (
        <CandidateContextPanel
          candidate={selectedCandidate}
          job={selectedJob}
          onSwitchToJob={() => {
            setContextMode("job");
            setSelectedCandidateId(null);
            setSelectedCandidate(null);
            newChat(false);
          }}
        />
      )
      : contextMode === "global"
      ? (
        <GlobalContextPanel stats={globalStats} loading={globalStatsLoading} />
      )
      : (
        <JobContextPanel job={selectedJob} candidates={candidates} />
      );

  function switchWorkspace() {
    if (abortRef.current) abortRef.current.abort();
    setWorkspace(null);
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    insightsRequestedRef.current = false;
    setSelectedJob(null);
    setSelectedForm(null);
    setSelectedCandidateId(null);
    setSelectedCandidate(null);
    setSelectedResponseId(null);
    setSelectedApplicant(null);
  }

  if (!workspace) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: T.bg, color: T.text }}>
        <WorkspacePicker onSelect={selectWorkspace} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: T.bg, color: T.text }}>

      {/* Mobile overlays */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {contextOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setContextOpen(false)} />
      )}

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto
          flex flex-col w-64 shrink-0 border-r
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ background: T.card, borderColor: T.border }}
      >
        {/* Logo + back */}
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: T.border }}>
          <Link
            href="/recruit/dashboard"
            className="flex items-center gap-2 transition-colors text-[13px] font-medium"
            style={{ color: T.textSecondary }}
          >
            <Home size={14} strokeWidth={2.2} />
            Dashboard
          </Link>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.accent}, var(--rb-accent-dark))` }}>
            <Sparkles size={12} strokeWidth={2.4} color="#fff" />
          </div>
        </div>

        {/* New chat */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => newChat(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all border hover:shadow-sm"
            style={{ borderColor: T.border, color: T.text, background: T.card }}
          >
            <Plus size={15} strokeWidth={2.4} style={{ color: T.accent }} />
            New conversation
          </button>
        </div>

        {/* Workspace badge */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={switchWorkspace}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all hover:shadow-sm"
            style={{ borderColor: T.border, background: "var(--rb-accent-softer-bg)", color: T.accent }}
            title="Switch between Standard Job and Form Job"
          >
            <span className="truncate">{workspaceLabel(workspace)} workspace</span>
            <ArrowLeft size={12} strokeWidth={2.2} className="rotate-180 shrink-0" />
          </button>
        </div>

        {workspace === "standard" && (
          <>
        {/* Job selector */}
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => { setJobDropdownOpen(o => !o); setCandidateDropdownOpen(false); setFormDropdownOpen(false); }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] border transition-all hover:shadow-sm"
            style={{ borderColor: T.border, background: "var(--rb-subtle)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {contextMode === "global" ? <Globe size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} /> : <Briefcase size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />}
              <span className="truncate" style={{ color: T.text }}>
                {contextMode === "global" ? "Organization (all jobs)" : selectedJob ? selectedJob.title : "Select a job"}
              </span>
            </div>
            <ChevronDown size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />
          </button>

          {jobDropdownOpen && (
            <div
              className="absolute left-3 right-3 top-full mt-1 z-10 rounded-xl border overflow-hidden shadow-lg max-h-80 overflow-y-auto"
              style={{ background: T.card, borderColor: T.border }}
            >
              <button
                onClick={() => {
                  setJobDropdownOpen(false);
                  setContextMode("global");
                  setSelectedJob(null);
                  setSelectedCandidateId(null);
                  setSelectedCandidate(null);
                  newChat(false);
                }}
                className="w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center gap-2 border-b hover:bg-[var(--rb-subtle)]"
                style={{ borderColor: T.border, color: contextMode === "global" ? T.accent : T.textSecondary, fontWeight: contextMode === "global" ? 600 : 400 }}
              >
                <Globe size={14} strokeWidth={2.2} />
                Organization (all jobs)
              </button>
              {jobs.length === 0 ? (
                <div className="px-4 py-3 text-[12px]" style={{ color: "var(--rb-muted)" }}>No jobs found</div>
              ) : (
                jobs.map(job => (
                  <button
                    key={job._id}
                    onClick={() => {
                      setSelectedJob(job);
                      setJobDropdownOpen(false);
                      setContextMode("job");
                      setSelectedCandidateId(null);
                      setSelectedCandidate(null);
                      newChat(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--rb-subtle)]"
                    style={{ color: selectedJob?._id === job._id ? T.accent : T.textSecondary, fontWeight: selectedJob?._id === job._id ? 600 : 400 }}
                  >
                    {job.title}
                    <span className="ml-2 text-[11px]" style={{ color: "var(--rb-muted)" }}>{job.candidateCount} candidates</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Candidate selector — becomes active once a job is selected */}
        {selectedJob && (
          <div className="px-3 pb-2 relative">
            <button
              onClick={() => { setCandidateDropdownOpen(o => !o); setJobDropdownOpen(false); setFormDropdownOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] border transition-all hover:shadow-sm"
              style={{ borderColor: T.border, background: "var(--rb-subtle)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {contextMode === "candidate" ? <User size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} /> : <Users size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />}
                <span className="truncate" style={{ color: T.text }}>
                  {contextMode === "candidate" && selectedCandidate ? selectedCandidate.name : "All Candidates"}
                </span>
              </div>
              <ChevronDown size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />
            </button>

            {candidateDropdownOpen && (
              <div
                className="absolute left-3 right-3 top-full mt-1 z-10 rounded-xl border overflow-hidden shadow-lg flex flex-col"
                style={{ background: T.card, borderColor: T.border, maxHeight: "22rem" }}
              >
                <div className="p-2 border-b" style={{ borderColor: T.border }}>
                  <div className="relative">
                    <Search size={13} strokeWidth={2.2} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--rb-muted)" }} />
                    <input
                      autoFocus
                      value={candidateSearch}
                      onChange={e => setCandidateSearch(e.target.value)}
                      placeholder="Search candidates…"
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-[12px] border outline-none"
                      style={{ background: "var(--rb-subtle)", borderColor: T.border, color: T.text }}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto">
                  <button
                    onClick={() => {
                      setCandidateDropdownOpen(false);
                      setCandidateSearch("");
                      setContextMode("job");
                      setSelectedCandidateId(null);
                      setSelectedCandidate(null);
                      newChat(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center gap-2 border-b hover:bg-[var(--rb-subtle)]"
                    style={{ borderColor: T.border, color: contextMode === "job" ? T.accent : T.textSecondary, fontWeight: contextMode === "job" ? 600 : 400 }}
                  >
                    <Users size={14} strokeWidth={2.2} />
                    All Candidates
                    <span className="ml-auto text-[11px]" style={{ color: "var(--rb-muted)" }}>Job context</span>
                  </button>
                  {(() => {
                    const filtered = candidates.filter(c =>
                      c.name.toLowerCase().includes(candidateSearch.trim().toLowerCase())
                    );
                    if (candidates.length === 0) {
                      return <div className="px-4 py-3 text-[12px]" style={{ color: "var(--rb-muted)" }}>No candidates yet</div>;
                    }
                    if (filtered.length === 0) {
                      return <div className="px-4 py-3 text-[12px]" style={{ color: "var(--rb-muted)" }}>No matches for "{candidateSearch}"</div>;
                    }
                    return filtered.map(c => {
                      const pct = c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : null;
                      return (
                        <button
                          key={c._id}
                          onClick={() => {
                            setContextMode("candidate");
                            setSelectedCandidateId(c._id);
                            setSelectedCandidate(c);
                            setCandidateDropdownOpen(false);
                            setCandidateSearch("");
                            newChat(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center justify-between gap-2 hover:bg-[var(--rb-subtle)]"
                          style={{ color: selectedCandidateId === c._id ? T.accent : T.textSecondary, fontWeight: selectedCandidateId === c._id ? 600 : 400 }}
                        >
                          <span className="truncate">{c.name}</span>
                          {pct !== null && (
                            <span className="text-[11px] font-bold shrink-0" style={{ color: confColor(pct) }}>{pct}%</span>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}

        {workspace === "form" && (
          <>
        {/* Form selector */}
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => { setFormDropdownOpen(o => !o); setJobDropdownOpen(false); setCandidateDropdownOpen(false); setApplicantDropdownOpen(false); }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] border transition-all hover:shadow-sm"
            style={{ borderColor: T.border, background: "var(--rb-subtle)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {contextMode === "form_global" ? <Globe size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} /> : <FileText size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />}
              <span className="truncate" style={{ color: T.text }}>
                {contextMode === "form_global" ? "All forms" : selectedForm ? selectedForm.title : "Select a form"}
              </span>
            </div>
            <ChevronDown size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />
          </button>

          {formDropdownOpen && (
            <div
              className="absolute left-3 right-3 top-full mt-1 z-10 rounded-xl border overflow-hidden shadow-lg max-h-72 overflow-y-auto"
              style={{ background: T.card, borderColor: T.border }}
            >
              <button
                onClick={() => {
                  setFormDropdownOpen(false);
                  setContextMode("form_global");
                  setSelectedForm(null);
                  setSelectedResponseId(null);
                  setSelectedApplicant(null);
                  newChat(false);
                }}
                className="w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center gap-2 border-b hover:bg-[var(--rb-subtle)]"
                style={{ borderColor: T.border, color: contextMode === "form_global" ? T.accent : T.textSecondary, fontWeight: contextMode === "form_global" ? 600 : 400 }}
              >
                <Globe size={14} strokeWidth={2.2} />
                All forms
              </button>
              {forms.length === 0 ? (
                <div className="px-4 py-3 text-[12px]" style={{ color: "var(--rb-muted)" }}>No forms found</div>
              ) : (
                forms.map(form => (
                  <button
                    key={form._id}
                    onClick={() => {
                      setSelectedForm(form);
                      setFormDropdownOpen(false);
                      setContextMode("form");
                      setSelectedResponseId(null);
                      setSelectedApplicant(null);
                      newChat(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--rb-subtle)] flex items-center justify-between"
                    style={{ color: selectedForm?._id === form._id && contextMode !== "form_global" ? T.accent : T.textSecondary, fontWeight: selectedForm?._id === form._id && contextMode !== "form_global" ? 600 : 400 }}
                  >
                    <span className="truncate">{form.title}</span>
                    {form.responseCount !== undefined && (
                      <span className="ml-2 text-[11px] shrink-0" style={{ color: "var(--rb-muted)" }}>{form.responseCount} responses</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Applicant selector — active once a form is selected */}
        {selectedForm && (
          <div className="px-3 pb-2 relative">
            <button
              onClick={() => { setApplicantDropdownOpen(o => !o); setFormDropdownOpen(false); setJobDropdownOpen(false); setCandidateDropdownOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] border transition-all hover:shadow-sm"
              style={{ borderColor: T.border, background: "var(--rb-subtle)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {contextMode === "form_applicant" ? <User size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} /> : <Users size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />}
                <span className="truncate" style={{ color: T.text }}>
                  {contextMode === "form_applicant" && selectedApplicant ? selectedApplicant.submittedName : "All Applicants"}
                </span>
              </div>
              <ChevronDown size={14} strokeWidth={2.2} style={{ color: T.textSecondary }} />
            </button>

            {applicantDropdownOpen && (
              <div
                className="absolute left-3 right-3 top-full mt-1 z-10 rounded-xl border overflow-hidden shadow-lg flex flex-col"
                style={{ background: T.card, borderColor: T.border, maxHeight: "22rem" }}
              >
                <div className="p-2 border-b" style={{ borderColor: T.border }}>
                  <div className="relative">
                    <Search size={13} strokeWidth={2.2} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--rb-muted)" }} />
                    <input
                      autoFocus
                      value={candidateSearch}
                      onChange={e => setCandidateSearch(e.target.value)}
                      placeholder="Search applicants…"
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-[12px] border outline-none"
                      style={{ background: "var(--rb-subtle)", borderColor: T.border, color: T.text }}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto">
                  <button
                    onClick={() => {
                      setApplicantDropdownOpen(false);
                      setCandidateSearch("");
                      setContextMode("form");
                      setSelectedResponseId(null);
                      setSelectedApplicant(null);
                      newChat(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center gap-2 border-b hover:bg-[var(--rb-subtle)]"
                    style={{ borderColor: T.border, color: contextMode === "form" ? T.accent : T.textSecondary, fontWeight: contextMode === "form" ? 600 : 400 }}
                  >
                    <Users size={14} strokeWidth={2.2} />
                    All Applicants
                    <span className="ml-auto text-[11px]" style={{ color: "var(--rb-muted)" }}>Form context</span>
                  </button>
                  {(() => {
                    const filtered = formApplicants.filter(a =>
                      a.submittedName.toLowerCase().includes(candidateSearch.trim().toLowerCase())
                    );
                    if (formApplicants.length === 0) {
                      return <div className="px-4 py-3 text-[12px]" style={{ color: "var(--rb-muted)" }}>No applicants yet</div>;
                    }
                    if (filtered.length === 0) {
                      return <div className="px-4 py-3 text-[12px]" style={{ color: "var(--rb-muted)" }}>No matches for "{candidateSearch}"</div>;
                    }
                    return filtered.map(a => {
                      const pct = a.scoringFailed ? null : Math.round(a.aiScore);
                      return (
                        <button
                          key={a._id}
                          onClick={() => {
                            setContextMode("form_applicant");
                            setSelectedResponseId(a._id);
                            setSelectedApplicant(a);
                            setApplicantDropdownOpen(false);
                            setCandidateSearch("");
                            newChat(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center justify-between gap-2 hover:bg-[var(--rb-subtle)]"
                          style={{ color: selectedResponseId === a._id ? T.accent : T.textSecondary, fontWeight: selectedResponseId === a._id ? 600 : 400 }}
                        >
                          <span className="truncate">{a.submittedName}</span>
                          {pct !== null && (
                            <span className="text-[11px] font-bold shrink-0" style={{ color: confColor(pct) }}>{pct}%</span>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-3 pb-4 space-y-4 mt-1">
          {groupOrder.filter(g => grouped[g]?.length).map(group => (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5 flex items-center gap-1.5" style={{ color: "var(--rb-muted)" }}>
                <MessageSquare size={10} strokeWidth={2.2} />
                {group}
              </p>
              <div className="space-y-1">
                {grouped[group].map(c => (
                  <div
                    key={c.id}
                    onClick={() => { openConversation(c.id); setSidebarOpen(false); }}
                    className="group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border"
                    style={{
                      background: activeConvId === c.id ? "var(--rb-src-resume-bg)" : T.card,
                      borderColor: activeConvId === c.id ? "var(--rb-accent-active-border)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (activeConvId !== c.id) e.currentTarget.style.background = "var(--rb-subtle)"; }}
                    onMouseLeave={(e) => { if (activeConvId !== c.id) e.currentTarget.style.background = T.card; }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium truncate leading-snug" style={{ color: activeConvId === c.id ? T.accent : T.text }}>{c.title}</p>
                      {/* Show candidate name for candidate-context conversations, job for job-context */}
                      {c.selectedCandidateName ? (
                        <p className="text-[10.5px] truncate mt-0.5 flex items-center gap-1" style={{ color: "var(--rb-muted)" }}>
                          <User size={9} strokeWidth={2.2} /> {c.selectedCandidateName}
                        </p>
                      ) : c.selectedResponseName ? (
                        <p className="text-[10.5px] truncate mt-0.5 flex items-center gap-1" style={{ color: "var(--rb-muted)" }}>
                          <User size={9} strokeWidth={2.2} /> {c.selectedResponseName}
                        </p>
                      ) : c.selectedJobTitle ? (
                        <p className="text-[10.5px] truncate mt-0.5" style={{ color: "var(--rb-muted)" }}>{c.selectedJobTitle}</p>
                      ) : c.selectedFormTitle ? (
                        <p className="text-[10.5px] truncate mt-0.5 flex items-center gap-1" style={{ color: "var(--rb-muted)" }}>
                          <FileText size={9} strokeWidth={2.2} /> {c.selectedFormTitle}
                        </p>
                      ) : null}
                    </div>
                    <button
                      onClick={(e) => deleteConversation(c.id, e)}
                      disabled={deletingId === c.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: "var(--rb-faint)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--rb-danger)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--rb-faint)"; }}
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-[11px] text-center pt-4 px-2" style={{ color: "var(--rb-faint)" }}>Your conversations will appear here</p>
          )}
        </div>
      </aside>

      {/* ── Center chat area ─────────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-w-0 relative">

        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: T.border, background: T.card }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden p-1.5 rounded-lg transition"
              style={{ color: T.textSecondary }}
            >
              <Menu size={16} strokeWidth={2.2} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.accent}, var(--rb-accent-dark))` }}>
                <Sparkles size={11} strokeWidth={2.4} color="#fff" />
              </div>
              <span className="text-[13px] font-semibold" style={{ color: T.text }}>Ask Rolebolt</span>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"
              style={{
                background: workspace === "form" ? "rgba(124,58,237,0.08)" : "var(--rb-accent-soft-bg)",
                borderColor: workspace === "form" ? "rgba(124,58,237,0.18)" : "var(--rb-accent-soft-border)",
                color: workspace === "form" ? "#7c3aed" : T.accent,
              }}
            >
              {workspace === "form" ? <FileText size={11} strokeWidth={2.2} /> : <Briefcase size={11} strokeWidth={2.2} />}
              <span className="text-[10px] font-semibold tracking-wide">{workspace === "form" ? "FORM JOB" : "STANDARD JOB"}</span>
            </div>

            {/* Context breadcrumb */}
            <div className="hidden md:flex items-center gap-1">
              <span className="text-xs mr-0.5" style={{ color: "var(--rb-faint)" }}>·</span>

              {workspace === "standard" ? (
                <>
                  <button
                    onClick={() => {
                      setContextMode("global");
                      setSelectedJob(null);
                      setSelectedCandidateId(null);
                      setSelectedCandidate(null);
                      newChat(false);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors"
                    style={contextMode === "global"
                      ? { background: "var(--rb-src-profile-bg)", borderColor: "var(--rb-src-profile-border)", color: "var(--rb-src-profile-text)" }
                      : { background: "var(--rb-subtle)", borderColor: T.border, color: T.textSecondary }}
                  >
                    <Globe size={11} strokeWidth={2.2} />
                    <span className="text-[11px] font-medium">Organization</span>
                  </button>

                  {selectedJob && (
                    <>
                      <span className="text-xs" style={{ color: "var(--rb-border)" }}>/</span>
                      <button
                        onClick={() => {
                          setContextMode("job");
                          setSelectedCandidateId(null);
                          setSelectedCandidate(null);
                          newChat(false);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors max-w-[10rem]"
                        style={contextMode === "job"
                          ? { background: "var(--rb-src-resume-bg)", borderColor: "var(--rb-src-resume-border)", color: "var(--rb-src-resume-text)" }
                          : { background: "var(--rb-subtle)", borderColor: T.border, color: T.textSecondary }}
                      >
                        <Briefcase size={11} strokeWidth={2.2} />
                        <span className="text-[11px] font-medium truncate">{selectedJob.title}</span>
                      </button>
                    </>
                  )}

                  {contextMode === "candidate" && selectedCandidate && (
                    <>
                      <span className="text-xs" style={{ color: "var(--rb-border)" }}>/</span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full max-w-[10rem]" style={{ background: "var(--rb-accent-soft-bg)", border: "1px solid var(--rb-accent-chip-border)" }}>
                        <User size={11} strokeWidth={2.2} style={{ color: T.accent }} />
                        <span className="text-[11px] font-medium truncate" style={{ color: T.accent }}>{selectedCandidate.name}</span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setContextMode("form_global");
                      setSelectedForm(null);
                      setSelectedResponseId(null);
                      setSelectedApplicant(null);
                      newChat(false);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors"
                    style={contextMode === "form_global"
                      ? { background: "var(--rb-src-profile-bg)", borderColor: "var(--rb-src-profile-border)", color: "var(--rb-src-profile-text)" }
                      : { background: "var(--rb-subtle)", borderColor: T.border, color: T.textSecondary }}
                  >
                    <Globe size={11} strokeWidth={2.2} />
                    <span className="text-[11px] font-medium">All Forms</span>
                  </button>

                  {selectedForm && (
                    <>
                      <span className="text-xs" style={{ color: "var(--rb-border)" }}>/</span>
                      <button
                        onClick={() => {
                          setContextMode("form");
                          setSelectedResponseId(null);
                          setSelectedApplicant(null);
                          newChat(false);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors max-w-[10rem]"
                        style={contextMode === "form"
                          ? { background: "var(--rb-src-resume-bg)", borderColor: "var(--rb-src-resume-border)", color: "var(--rb-src-resume-text)" }
                          : { background: "var(--rb-subtle)", borderColor: T.border, color: T.textSecondary }}
                      >
                        <FileText size={11} strokeWidth={2.2} />
                        <span className="text-[11px] font-medium truncate">{selectedForm.title}</span>
                      </button>
                    </>
                  )}

                  {contextMode === "form_applicant" && selectedApplicant && (
                    <>
                      <span className="text-xs" style={{ color: "var(--rb-border)" }}>/</span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full max-w-[10rem]" style={{ background: "var(--rb-accent-soft-bg)", border: "1px solid var(--rb-accent-chip-border)" }}>
                        <User size={11} strokeWidth={2.2} style={{ color: T.accent }} />
                        <span className="text-[11px] font-medium truncate" style={{ color: T.accent }}>{selectedApplicant.submittedName}</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              aria-label="Toggle color theme"
              className="p-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95"
              style={{ borderColor: T.border, background: T.card, color: T.textSecondary }}
            >
              {isDark ? <SunMedium size={15} strokeWidth={2.2} /> : <Moon size={15} strokeWidth={2.2} />}
            </button>
            <button
              onClick={() => setContextOpen(o => !o)}
              className="lg:hidden p-1.5 rounded-lg transition"
              style={{ color: T.textSecondary }}
            >
              {contextMode === "candidate" || contextMode === "form_applicant" ? <User size={16} strokeWidth={2.2} />
                : contextMode === "global" || contextMode === "form_global" ? <Globe size={16} strokeWidth={2.2} />
                : workspace === "form" ? <FileText size={16} strokeWidth={2.2} />
                : <Users size={16} strokeWidth={2.2} />}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-none" style={{ background: T.bg }}>
          {messages.length === 0 ? (
            <WelcomeScreen
              recruiterName={recruitProfile?.username ?? recruitProfile?.name}
              jobSelected={!!selectedJob}
              contextMode={contextMode}
              workspace={workspace}
              candidateName={selectedCandidate?.name}
              formTitle={selectedForm?.title}
              applicantName={selectedApplicant?.submittedName}
              onPrompt={sendMessage}
              loadingInsights={insightsLoading}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onQuickAction={sendMessage}
                  onSourceNavigate={handleSourceNavigate}
                  onCopied={() => showToast("✓ Copied to clipboard")}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="shrink-0 px-4 pb-5 pt-3"
          style={{ background: `linear-gradient(to top, ${T.bg} 80%, transparent)` }}
        >
          <div className="max-w-3xl mx-auto">
            {workspace === "standard" && !selectedJob && contextMode !== "global" && (
              <p className="text-center text-[12px] mb-2" style={{ color: "var(--rb-warning)" }}>Select a job from the sidebar to start chatting</p>
            )}
            {workspace === "form" && contextMode === "form" && !selectedForm && (
              <p className="text-center text-[12px] mb-2" style={{ color: "var(--rb-warning)" }}>Select a form from the sidebar to start chatting</p>
            )}
            {workspace === "standard" && selectedJob && contextMode === "candidate" && !selectedCandidate && (
              <p className="text-center text-[12px] mb-2" style={{ color: T.accent }}>Loading candidate context…</p>
            )}
            {workspace === "form" && contextMode === "form_applicant" && !selectedApplicant && (
              <p className="text-center text-[12px] mb-2" style={{ color: T.accent }}>Loading applicant context…</p>
            )}
            <div
              className="relative flex items-end gap-2 rounded-[24px] border px-4 py-2.5 transition-all duration-200 ease-out"
              style={{
                background: T.card,
                borderColor: isStreaming
                  ? "var(--rb-accent-streaming-border)"
                  : inputFocused
                  ? "var(--rb-accent-hover-border)"
                  : T.border,
                boxShadow: isStreaming
                  ? "0 0 0 3px var(--rb-accent-soft-bg), 0 8px 24px -8px var(--rb-shadow-color)"
                  : inputFocused
                  ? "0 0 0 3px var(--rb-accent-soft-bg), 0 10px 28px -10px var(--rb-shadow-color)"
                  : "0 8px 26px -18px var(--rb-shadow-color)",
              }}
            >
              <div
                className="mb-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:flex"
                style={{
                  background: workspace === "form" ? "rgba(124,58,237,0.1)" : "var(--rb-accent-soft-bg)",
                  color: workspace === "form" ? "#7c3aed" : T.accent,
                }}
              >
                {workspace === "form" ? <FileText size={13} /> : <Sparkles size={13} />}
              </div>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={inputPlaceholder}
                disabled={textDisabled}
                rows={1}
                className="flex-1 bg-transparent text-[0.925rem] resize-none appearance-none border-none outline-none focus:outline-none focus:ring-0 focus:border-none leading-relaxed tracking-[-0.01em] disabled:opacity-40 py-1"
                style={{ maxHeight: "160px", color: T.text, boxShadow: "none" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sendDisabled}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 ease-out disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:scale-105 active:enabled:scale-90"
                style={{
                  background: input.trim() && !sendDisabled ? `linear-gradient(135deg, ${T.accent}, var(--rb-accent-dark))` : "var(--rb-disabled-bg)",
                  color: input.trim() && !sendDisabled ? "#fff" : "var(--rb-muted)",
                  boxShadow: input.trim() && !sendDisabled ? "0 4px 14px -4px var(--rb-accent-hover-border)" : "none",
                }}
              >
                {isStreaming ? (
                  <span className="w-3 h-3 rounded-[3px]" style={{ background: "rgba(255,255,255,0.5)" }} />
                ) : (
                  <Send size={16} strokeWidth={2.3} className="-translate-x-px translate-y-px" />
                )}
              </button>
            </div>
            <p className="text-center text-[10px] mt-2" style={{ color: "var(--rb-faint)" }}>
              Rolebolt AI can make mistakes. Verify important hiring decisions.
            </p>
          </div>
        </div>

        {/* Copy success toast */}
        <div
          className={`pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ease-out ${
            toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          {toast && (
            <div
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium border shadow-lg"
              style={{ background: T.card, borderColor: T.border, color: T.text }}
            >
              {toast}
            </div>
          )}
        </div>
      </main>

      {/* ── Right context panel ──────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:relative inset-y-0 right-0 z-30 lg:z-auto
          flex flex-col w-72 shrink-0 border-l
          transition-transform duration-300 ease-in-out
          ${contextOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}
        style={{ background: T.card, borderColor: T.border }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b shrink-0" style={{ borderColor: T.border }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--rb-muted)" }}>
            {contextMode === "candidate" ? "Candidate Context"
              : contextMode === "form_applicant" ? "Applicant Context"
              : workspace === "form" ? "Form Context"
              : "Hiring Context"}
          </p>
          <button onClick={() => setContextOpen(false)} className="lg:hidden transition" style={{ color: "var(--rb-muted)" }}>
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
        {contextPanel}
      </aside>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function CopilotPage() {
  return (
    <RecruitGuard requiredRole="creator">
      <CopilotPageContent />
    </RecruitGuard>
  );
}
