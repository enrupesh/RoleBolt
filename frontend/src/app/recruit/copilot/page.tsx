"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { apiUrl } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContextMode = "job" | "candidate" | "global";

interface Job {
  _id: string;
  title: string;
  department?: string;
  status: string;
  candidateCount: number;
}

interface CopilotSource {
  type: string;
  label: string;
  candidateId?: string;
  candidateName?: string;
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
  context?: { level: string };
  selectedJobId?: string;
  selectedJobTitle?: string;
  selectedCandidateId?: string;
  selectedCandidateName?: string;
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
  if (c >= 80) return "#4ade80";
  if (c >= 60) return "#fbbf24";
  return "#f87171";
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
  if (d === "strong_yes") return { text: "Strong Yes", color: "#4ade80" };
  if (d === "maybe") return { text: "Maybe", color: "#fbbf24" };
  if (d === "no") return { text: "No", color: "#f87171" };
  return null;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IcSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
  </svg>
);
const IcPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5v14" />
  </svg>
);
const IcChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const IcBack = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IcTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);
const IcSparkle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
  </svg>
);
const IcBriefcase = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);
const IcUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IcPerson = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
);
const IcDoc = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const IcGlobe = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

// ─── Source chip ──────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  resume: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  assessment: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  interview_brief: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  score_breakdown: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  candidate_profile: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  job_description: "bg-rose-500/15 text-rose-300 border-rose-500/20",
};

function SourceChip({ src }: { src: CopilotSource }) {
  const color = SOURCE_COLORS[src.type] ?? "bg-white/10 text-white/60 border-white/10";
  const inner = (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${color}`}
      title={src.detail ?? src.label}
    >
      <IcDoc />
      {src.label}
      {src.detail && <span className="opacity-60">· {src.detail}</span>}
    </span>
  );
  return src.candidateId
    ? <Link href={`/recruit/jobs`}>{inner}</Link>
    : inner;
}

// ─── Recommendation card ──────────────────────────────────────────────────────

function RecommendationCard({ recommendation, confidence, reasoning }: {
  recommendation: string; confidence: number; reasoning: string;
}) {
  const color = confColor(confidence);
  return (
    <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Recommendation</p>
          <p className="text-[#e5e5e5] font-semibold text-[0.9rem] leading-snug">{recommendation}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Confidence</p>
          <div className="flex items-center gap-1.5 justify-end">
            <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${confidence}%`, background: color }} />
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>{confidence}%</span>
          </div>
        </div>
      </div>
      {reasoning && (
        <p className="text-[0.8rem] text-white/40 leading-relaxed border-t border-white/[0.06] pt-2.5">{reasoning}</p>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onQuickAction }: {
  msg: UIMessage; onQuickAction: (text: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%] bg-[#1e1e2e] border border-white/[0.07] rounded-2xl rounded-tr-md px-4 py-3 text-[0.875rem] text-[#e5e5e5] leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
          <IcSparkle />
        </div>
        <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">Rolebolt AI</span>
        {msg.isStreaming && (
          <span className="flex gap-0.5 items-center ml-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        )}
      </div>

      <div className="text-[0.875rem] leading-relaxed text-[#d4d4d4] copilot-markdown ml-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        {msg.isStreaming && <span className="inline-block w-0.5 h-4 bg-indigo-400 align-middle ml-0.5 animate-pulse" />}
      </div>

      {!msg.isStreaming && msg.recommendation && (
        <div className="ml-8">
          <RecommendationCard
            recommendation={msg.recommendation}
            confidence={msg.confidence ?? 0}
            reasoning={msg.reasoning ?? ""}
          />
        </div>
      )}

      {!msg.isStreaming && msg.sources && msg.sources.length > 0 && (
        <div className="ml-8 mt-3 flex flex-wrap gap-1.5">
          {msg.sources.map((src, i) => <SourceChip key={i} src={src} />)}
        </div>
      )}

      {!msg.isStreaming && msg.quickActions && msg.quickActions.length > 0 && (
        <div className="ml-8 mt-3 flex flex-wrap gap-2">
          {msg.quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => onQuickAction(action)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-white/[0.1] text-white/50 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white/80 hover:border-white/20 transition-all"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

const JOB_PROMPTS = [
  { icon: "🎯", text: "Who should I interview first?" },
  { icon: "⚖️", text: "Compare my top candidates" },
  { icon: "🔍", text: "Which candidates are missing required skills?" },
  { icon: "📋", text: "Generate interview questions for the top candidate" },
  { icon: "⚡", text: "Show candidates ready to join immediately" },
  { icon: "📊", text: "Why is the top candidate ranked #1?" },
];

const CANDIDATE_PROMPTS = [
  { icon: "📋", text: "Summarize this candidate" },
  { icon: "🔢", text: "Explain the AI score" },
  { icon: "❓", text: "Generate interview questions" },
  { icon: "🔍", text: "Show missing skills" },
  { icon: "🤔", text: "Should I hire this candidate?" },
  { icon: "📄", text: "Compare against the job description" },
];

const GLOBAL_PROMPTS = [
  { icon: "🧭", text: "What should I prioritize today?" },
  { icon: "🏆", text: "Which job has the strongest candidates?" },
  { icon: "🚧", text: "Which role is hardest to hire for?" },
  { icon: "🔍", text: "Find candidates with React and Docker" },
  { icon: "⚖️", text: "Compare all active jobs" },
  { icon: "🕳️", text: "Where are candidates dropping off?" },
];

function WelcomeScreen({ recruiterName, jobSelected, contextMode, candidateName, onPrompt, loadingInsights }: {
  recruiterName?: string;
  jobSelected: boolean;
  contextMode: ContextMode;
  candidateName?: string;
  onPrompt: (t: string) => void;
  loadingInsights?: boolean;
}) {
  const firstName = recruiterName?.split(" ")[0] ?? "there";
  const prompts = contextMode === "candidate" ? CANDIDATE_PROMPTS : contextMode === "global" ? GLOBAL_PROMPTS : JOB_PROMPTS;
  const canChat = contextMode === "candidate" ? !!candidateName : contextMode === "global" ? true : jobSelected;

  if (contextMode === "global" && loadingInsights) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-24">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(124,58,237,0.3)] animate-pulse">
          <IcSparkle />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{hourGreeting()}, {firstName} 👋</h1>
        <p className="text-[#8b8b8b] text-[0.9rem]">Pulling together today's hiring overview…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-24">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(124,58,237,0.3)]">
        <IcSparkle />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">
        {hourGreeting()}, {firstName} 👋
      </h1>

      {contextMode === "candidate" && candidateName ? (
        <>
          <p className="text-[#8b8b8b] text-[0.9rem] max-w-sm leading-relaxed mb-2">
            I'm focused on <span className="text-white font-semibold">{candidateName}</span>. Ask me anything about this candidate.
          </p>
          <p className="text-[#5a5a5a] text-xs mb-8">Select a prompt or type your own question below</p>
        </>
      ) : contextMode === "global" ? (
        <>
          <p className="text-[#8b8b8b] text-[0.9rem] max-w-sm leading-relaxed mb-2">
            I'm looking across your entire hiring organization — every job, every candidate, every pipeline. Ask me anything, no filtering needed.
          </p>
          <p className="text-[#5a5a5a] text-xs mb-8">Select a prompt or type your own question below</p>
        </>
      ) : (
        <>
          <p className="text-[#8b8b8b] text-[0.9rem] max-w-sm leading-relaxed mb-2">
            I'm Rolebolt AI. I can help you compare candidates, explain scores, generate interview questions, and recommend who to interview next.
          </p>
          {!jobSelected && (
            <p className="text-amber-400/70 text-xs font-medium mb-6 flex items-center gap-1.5">
              <span>↑</span> Select a job from the left sidebar to get started
            </p>
          )}
          {jobSelected && (
            <p className="text-[#5a5a5a] text-xs mb-8">Select a prompt or type your own question below</p>
          )}
        </>
      )}

      {canChat && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => onPrompt(p.text)}
              className="flex items-center gap-3 text-left px-4 py-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all group"
            >
              <span className="text-lg shrink-0">{p.icon}</span>
              <span className="text-[13px] text-[#a3a3a3] group-hover:text-[#e5e5e5] transition-colors">{p.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Job context panel (right sidebar) ───────────────────────────────────────

function JobContextPanel({ job, candidates }: { job: Job | null; candidates: CandidateStat[] }) {
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
          <IcBriefcase />
        </div>
        <p className="text-[12px] text-white/20">Select a job to see context</p>
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">Current Context</p>
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Job</p>
          </div>
          <p className="text-[0.875rem] font-semibold text-white leading-snug">{job.title}</p>
          {job.department && <p className="text-[11px] text-white/30 mt-0.5">{job.department}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">Candidates</p>
          <p className="text-xl font-bold text-white tabular-nums">{job.candidateCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">Avg Score</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: avgScore ? confColor(avgScore) : "#555" }}>
            {avgScore ?? "—"}
          </p>
        </div>
      </div>

      {top3.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2.5">Top Candidates</p>
          <div className="space-y-1.5">
            {top3.map((c, i) => {
              const pct = c.maxScore ? Math.round((c.totalScore / c.maxScore) * 100) : 0;
              return (
                <div key={c._id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <span className="text-[10px] font-bold text-white/20 w-3 shrink-0">#{i + 1}</span>
                  <span className="flex-1 text-[12px] text-[#d4d4d4] truncate font-medium">{c.name}</span>
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
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/[0.07] text-[12px] font-medium text-white/40 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.04] transition-all"
          >
            <IcUsers />
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
        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3 animate-pulse">
          <IcGlobe />
        </div>
        <p className="text-[12px] text-white/20">Loading organization data…</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
          <IcGlobe />
        </div>
        <p className="text-[12px] text-white/20">No organization data yet</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 overflow-y-auto h-full scrollbar-none">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">Organization Context</p>
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Global</p>
          </div>
          <p className="text-[0.875rem] font-semibold text-white leading-snug mt-1">Every job, every candidate</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Active Jobs" value={stats.activeJobs} />
        <StatTile label="Total Candidates" value={stats.totalCandidates} />
        <StatTile label="Interview Ready" value={stats.interviewReady} />
        <StatTile label="Offers Sent" value={stats.offersSent} />
        <StatTile label="Avg Fit Score" value={stats.avgFitScorePct !== null ? `${stats.avgFitScorePct}%` : "—"} color={stats.avgFitScorePct ? confColor(stats.avgFitScorePct) : undefined} />
        <StatTile label="Open Positions" value={stats.openPositions} />
      </div>

      {stats.topPipeline && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">Top Hiring Pipeline</p>
          <p className="text-[0.85rem] font-semibold text-white">{stats.topPipeline.title}</p>
          {stats.topPipeline.avgScorePct !== null && (
            <p className="text-[11px] mt-0.5" style={{ color: confColor(stats.topPipeline.avgScorePct) }}>
              {stats.topPipeline.avgScorePct}% avg fit · {stats.topPipeline.candidateCount} candidates
            </p>
          )}
        </div>
      )}

      {stats.highestRatedCandidate && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">Highest Rated Candidate</p>
          <p className="text-[0.85rem] font-semibold text-white">{stats.highestRatedCandidate.name}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{stats.highestRatedCandidate.jobTitle} · <span style={{ color: confColor(stats.highestRatedCandidate.scorePct) }}>{stats.highestRatedCandidate.scorePct}%</span></p>
        </div>
      )}

      {stats.mostCommonMissingSkills.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Commonly Missing Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.mostCommonMissingSkills.map((s, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">{s}</span>
            ))}
          </div>
        </div>
      )}

      {stats.recentActivity.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Recent Activity</p>
          <div className="space-y-1.5">
            {stats.recentActivity.map((a, i) => (
              <div key={i} className="text-[12px] text-[#a3a3a3] p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">{a}</div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300/70 mb-1">AI Recommendation</p>
        <p className="text-[12px] text-violet-100 leading-relaxed">{stats.recommendation}</p>
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums" style={{ color: color ?? "#fff" }}>{value}</p>
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
        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
          <IcPerson />
        </div>
        <p className="text-[12px] text-white/20">No candidate selected</p>
      </div>
    );
  }

  const pct = candidate.maxScore > 0 ? Math.round((candidate.totalScore / candidate.maxScore) * 100) : null;
  const decision = hiringDecisionLabel(candidate.hiringDecision);
  const assessmentPct = candidate.assessmentImpact
    ? null // We don't have a numeric assessment score here, just impact
    : null;

  return (
    <div className="px-4 py-5 space-y-4 overflow-y-auto h-full scrollbar-none">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">Candidate Focus</p>

        {/* Name + score */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Candidate</p>
              </div>
              <p className="text-[0.875rem] font-semibold text-white leading-snug">{candidate.name}</p>
              {candidate.stage && (
                <p className="text-[11px] text-white/30 mt-0.5 capitalize">{candidate.stage}</p>
              )}
            </div>
            {pct !== null && (
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">Fit Score</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: confColor(pct) }}>{pct}%</p>
              </div>
            )}
          </div>

          {pct !== null && (
            <div className="mt-2.5">
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: confColor(pct) }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decision badge */}
      {decision && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1.5">Current Recommendation</p>
          <span className="text-sm font-bold" style={{ color: decision.color }}>{decision.text}</span>
        </div>
      )}

      {/* Assessment status */}
      {candidate.assessmentStatus && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1.5">Assessment</p>
          <span className={`text-[12px] font-semibold capitalize ${
            candidate.assessmentStatus === "completed" ? "text-emerald-400" :
            candidate.assessmentStatus === "sent" ? "text-amber-400" :
            "text-white/30"
          }`}>
            {candidate.assessmentStatus === "not_sent" ? "Not sent" : candidate.assessmentStatus}
          </span>
        </div>
      )}

      {/* Top strengths */}
      {candidate.strengths && candidate.strengths.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Top Strengths</p>
          <div className="space-y-1">
            {candidate.strengths.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-[#a3a3a3]">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Red flags */}
      {candidate.redFlags && candidate.redFlags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Red Flags</p>
          <div className="space-y-1">
            {candidate.redFlags.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-[#a3a3a3]">
                <span className="text-rose-400 mt-0.5 shrink-0">⚠</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Availability */}
      {candidate.availability && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">Notice Period / Availability</p>
          <p className="text-[12px] text-[#d4d4d4]">{candidate.availability}</p>
        </div>
      )}

      {/* Switch to job view */}
      {job && (
        <div className="pt-1 space-y-2">
          <button
            onClick={onSwitchToJob}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/[0.07] text-[12px] font-medium text-white/40 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.04] transition-all"
          >
            <IcBriefcase />
            Switch to Job View
          </button>
          <Link
            href={`/recruit/jobs/${job._id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/[0.07] text-[12px] font-medium text-white/40 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.04] transition-all"
          >
            <IcUsers />
            View all candidates
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function CopilotPageContent() {
  const { firebaseUser, recruitProfile } = useRecruitAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);

  // Context mode: "global" (no job/candidate selected — Organization Intelligence),
  // "job" = talking about one job, "candidate" = focused on one candidate.
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

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [candidates, setCandidates] = useState<CandidateStat[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Auth token ─────────────────────────────────────────────────────────────
  const getToken = useCallback(async () => {
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  // ── Read URL params on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlJobId = params.get("jobId");
    const urlCandidateId = params.get("candidateId");
    if (urlJobId) {
      setPendingJobId(urlJobId);
      setContextMode("job");
    }
    if (urlCandidateId) {
      setPendingCandidateId(urlCandidateId);
      setContextMode("candidate");
    }
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

  // ── Apply pending job ID after jobs load ───────────────────────────────────
  useEffect(() => {
    if (!pendingJobId || jobs.length === 0) return;
    const job = jobs.find(j => j._id === pendingJobId);
    if (job) setSelectedJob(job);
    setPendingJobId(null);
  }, [pendingJobId, jobs]);

  // ── Load organization-wide stats (Global Context Panel) ────────────────────
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

  useEffect(() => {
    if (contextMode === "global") loadGlobalStats();
  }, [contextMode, loadGlobalStats]);

  // ── Auto-generate the "Good morning" insights card when Global Context ─────
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

  useEffect(() => {
    if (contextMode === "global" && messages.length === 0 && !activeConvId && !insightsRequestedRef.current) {
      insightsRequestedRef.current = true;
      loadInsights();
    }
  }, [contextMode, messages.length, activeConvId, loadInsights]);

  // ── Load conversations ─────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/recruit/copilot/conversations"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {}
  }, [getToken]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

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
        setCandidates(list.slice(0, 20));

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

      // Restore job
      if (data.selectedJobId || data.context?.jobId) {
        const jobId = data.selectedJobId || data.context?.jobId;
        const matchJob = jobs.find(j => j._id === jobId);
        if (matchJob) setSelectedJob(matchJob);
      }

      // Restore candidate context
      if (data.selectedCandidateId && data.context?.level === "candidate") {
        setContextMode("candidate");
        setSelectedCandidateId(data.selectedCandidateId);
        // The candidate will be found once candidates load for the job
      } else if (data.context?.level === "global") {
        setContextMode("global");
        setSelectedJob(null);
        setSelectedCandidateId(null);
        setSelectedCandidate(null);
      } else {
        setContextMode("job");
        setSelectedCandidateId(null);
        setSelectedCandidate(null);
      }
    } catch {}
  }, [getToken, jobs]);

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
    if (resetToGlobal) {
      setContextMode("global");
      setSelectedJob(null);
      setSelectedCandidateId(null);
      setSelectedCandidate(null);
    }
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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
    if (!trimmed || isStreaming) return;
    if (contextMode !== "global" && !selectedJob) return;

    // In candidate mode, we need a selected candidate
    const isCandidateMode = contextMode === "candidate" && !!selectedCandidateId;

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

    const controller = new AbortController();
    abortRef.current = controller;

    const chatContext = isCandidateMode
      ? { level: "candidate" as const, jobId: selectedJob!._id, candidateId: selectedCandidateId! }
      : contextMode === "global"
      ? { level: "global" as const }
      : { level: "job" as const, jobId: selectedJob!._id };

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
    }
  }, [isStreaming, selectedJob, selectedCandidateId, contextMode, getToken, activeConvId, loadConversations]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Input placeholder text ─────────────────────────────────────────────────
  const inputPlaceholder = (() => {
    if (contextMode === "global") return "Ask about your entire hiring organization…";
    if (!selectedJob) return "Select a job first…";
    if (contextMode === "candidate") {
      if (!selectedCandidate) return "Loading candidate…";
      return `Ask about ${selectedCandidate.name.split(" ")[0]}…`;
    }
    return `Ask about ${selectedJob.title}…`;
  })();

  const inputDisabled = isStreaming ||
    (contextMode !== "global" && !selectedJob) ||
    (contextMode === "candidate" && !selectedCandidate);

  // ── Grouped conversations ──────────────────────────────────────────────────
  const grouped = groupConvos(conversations);
  const groupOrder = ["Today", "Yesterday", "This week", "Older"];

  // ── Context panel ─────────────────────────────────────────────────────────
  const contextPanel = contextMode === "candidate"
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0f0f0f", color: "#e5e5e5" }}>

      {/* Mobile overlays */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {contextOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setContextOpen(false)} />
      )}

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto
          flex flex-col w-64 shrink-0 border-r
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ background: "#171717", borderColor: "rgba(255,255,255,0.06)" }}
      >
        {/* Logo + back */}
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Link href="/recruit/dashboard" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-[13px] font-medium">
            <IcBack />
            Dashboard
          </Link>
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <IcSparkle />
          </div>
        </div>

        {/* New chat */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => newChat(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.14]"
          >
            <IcPlus />
            New conversation
          </button>
        </div>

        {/* Job selector */}
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => setJobDropdownOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              {contextMode === "global" ? <IcGlobe /> : <IcBriefcase />}
              <span className="truncate text-white/70">
                {contextMode === "global" ? "Organization (all jobs)" : selectedJob ? selectedJob.title : "Select a job"}
              </span>
            </div>
            <IcChevronDown />
          </button>

          {jobDropdownOpen && (
            <div
              className="absolute left-3 right-3 top-full mt-1 z-10 rounded-xl border overflow-hidden shadow-2xl max-h-80 overflow-y-auto"
              style={{ background: "#222", borderColor: "rgba(255,255,255,0.1)" }}
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
                className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-white/[0.07] transition-colors flex items-center gap-2 border-b ${contextMode === "global" ? "text-sky-400 font-semibold" : "text-white/60"}`}
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <IcGlobe />
                Organization (all jobs)
              </button>
              {jobs.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-white/30">No jobs found</div>
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
                    className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-white/[0.07] transition-colors ${selectedJob?._id === job._id ? "text-indigo-400 font-semibold" : "text-white/60"}`}
                  >
                    {job.title}
                    <span className="ml-2 text-[11px] text-white/25">{job.candidateCount} candidates</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-3 pb-4 space-y-4 mt-1">
          {groupOrder.filter(g => grouped[g]?.length).map(group => (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 px-2 mb-1.5">{group}</p>
              <div className="space-y-0.5">
                {grouped[group].map(c => (
                  <div
                    key={c.id}
                    onClick={() => { openConversation(c.id); setSidebarOpen(false); }}
                    className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      activeConvId === c.id
                        ? "bg-white/[0.08] text-white"
                        : "hover:bg-white/[0.04] text-white/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate leading-snug">{c.title}</p>
                      {/* Show candidate name for candidate-context conversations, job for job-context */}
                      {c.selectedCandidateName ? (
                        <p className="text-[10px] text-violet-400/50 truncate mt-0.5 flex items-center gap-1">
                          <IcPerson /> {c.selectedCandidateName}
                        </p>
                      ) : c.selectedJobTitle ? (
                        <p className="text-[10px] text-white/25 truncate mt-0.5">{c.selectedJobTitle}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={(e) => deleteConversation(c.id, e)}
                      disabled={deletingId === c.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-white/25 hover:text-rose-400 transition-all"
                    >
                      <IcTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-[11px] text-white/20 text-center pt-4 px-2">Your conversations will appear here</p>
          )}
        </div>
      </aside>

      {/* ── Center chat area ─────────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-w-0 relative">

        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0f0f0f" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <IcSparkle />
              </div>
              <span className="text-[13px] font-semibold text-white/60">Ask Rolebolt</span>
            </div>

            {/* Context breadcrumb */}
            {contextMode === "candidate" && selectedCandidate ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-white/20 text-xs">·</span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
                  <IcPerson />
                  <span className="text-[11px] font-medium text-violet-300">{selectedCandidate.name}</span>
                </div>
              </div>
            ) : selectedJob ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.07]">
                <IcBriefcase />
                <span className="text-[11px] font-medium text-white/50">{selectedJob.title}</span>
              </div>
            ) : contextMode === "global" ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
                <IcGlobe />
                <span className="text-[11px] font-medium text-sky-300">Organization</span>
              </div>
            ) : null}
          </div>
          <button
            onClick={() => setContextOpen(o => !o)}
            className="lg:hidden p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition"
          >
            {contextMode === "candidate" ? <IcPerson /> : contextMode === "global" ? <IcGlobe /> : <IcUsers />}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {messages.length === 0 ? (
            <WelcomeScreen
              recruiterName={recruitProfile?.name}
              jobSelected={!!selectedJob}
              contextMode={contextMode}
              candidateName={selectedCandidate?.name}
              onPrompt={sendMessage}
              loadingInsights={insightsLoading}
            />
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-8">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onQuickAction={sendMessage} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="shrink-0 border-t px-4 py-4"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0f0f0f" }}
        >
          <div className="max-w-2xl mx-auto">
            {!selectedJob && (
              <p className="text-center text-[12px] text-amber-400/50 mb-2">Select a job from the sidebar to start chatting</p>
            )}
            {selectedJob && contextMode === "candidate" && !selectedCandidate && (
              <p className="text-center text-[12px] text-violet-400/50 mb-2">Loading candidate context…</p>
            )}
            <div
              className="flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all"
              style={{
                background: "#1a1a1a",
                borderColor: isStreaming ? "rgba(129,140,248,0.3)" : "rgba(255,255,255,0.09)",
                boxShadow: isStreaming ? "0 0 0 1px rgba(129,140,248,0.15)" : "none",
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                disabled={inputDisabled}
                rows={1}
                className="flex-1 bg-transparent text-[0.875rem] text-[#e5e5e5] placeholder-white/20 resize-none outline-none leading-relaxed disabled:opacity-40"
                style={{ maxHeight: "160px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || inputDisabled}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                style={{
                  background: input.trim() && !inputDisabled ? "linear-gradient(135deg,#7c3aed,#4338ca)" : "rgba(255,255,255,0.07)",
                  color: input.trim() && !inputDisabled ? "#fff" : "rgba(255,255,255,0.3)",
                }}
              >
                {isStreaming ? (
                  <span className="w-3 h-3 rounded-sm bg-white/40" />
                ) : (
                  <IcSend />
                )}
              </button>
            </div>
            <p className="text-center text-[10px] text-white/15 mt-2">
              Rolebolt AI can make mistakes. Always verify important decisions.
            </p>
          </div>
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
        style={{ background: "#171717", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
            {contextMode === "candidate" ? "Candidate Context" : "Hiring Context"}
          </p>
          <button onClick={() => setContextOpen(false)} className="lg:hidden text-white/30 hover:text-white/60 transition">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
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
