"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { apiUrl } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  selectedJobId?: string;
  selectedJobTitle?: string;
  lastActiveAt: string;
  totalMessages: number;
}

interface CandidateStat {
  _id: string;
  name: string;
  totalScore: number;
  maxScore: number;
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
const IcDoc = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
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
  const href = src.candidateId
    ? src.type === "assessment"
      ? `/recruit/recruiter/${src.candidateId}`
      : `/recruit/recruiter/${src.candidateId}`
    : undefined;

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

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Recommendation card ──────────────────────────────────────────────────────

function RecommendationCard({
  recommendation, confidence, reasoning,
}: {
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

function MessageBubble({
  msg, onQuickAction,
}: {
  msg: UIMessage; onQuickAction: (text: string) => void;
}) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%] bg-[#1e1e2e] border border-white/[0.07] rounded-2xl rounded-tr-md px-4 py-3 text-[0.875rem] text-[#e5e5e5] leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rb-animate-fade-up">
      {/* AI logo */}
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

      {/* Markdown content */}
      <div className="text-[0.875rem] leading-relaxed text-[#d4d4d4] copilot-markdown ml-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        {msg.isStreaming && <span className="inline-block w-0.5 h-4 bg-indigo-400 align-middle ml-0.5 animate-pulse" />}
      </div>

      {/* Recommendation card */}
      {!msg.isStreaming && msg.recommendation && (
        <div className="ml-8">
          <RecommendationCard
            recommendation={msg.recommendation}
            confidence={msg.confidence ?? 0}
            reasoning={msg.reasoning ?? ""}
          />
        </div>
      )}

      {/* Sources */}
      {!msg.isStreaming && msg.sources && msg.sources.length > 0 && (
        <div className="ml-8 mt-3 flex flex-wrap gap-1.5">
          {msg.sources.map((src, i) => <SourceChip key={i} src={src} />)}
        </div>
      )}

      {/* Quick actions */}
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

const STARTER_PROMPTS = [
  { icon: "🎯", text: "Who should I interview first?" },
  { icon: "⚖️", text: "Compare my top candidates" },
  { icon: "🔍", text: "Which candidates are missing Docker?" },
  { icon: "📋", text: "Generate interview questions" },
  { icon: "⚡", text: "Show candidates ready to join immediately" },
  { icon: "📊", text: "Why is the top candidate ranked #1?" },
];

function WelcomeScreen({
  recruiterName, jobSelected, onPrompt,
}: {
  recruiterName?: string; jobSelected: boolean; onPrompt: (t: string) => void;
}) {
  const firstName = recruiterName?.split(" ")[0] ?? "there";
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-24 rb-animate-fade-up">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(124,58,237,0.3)]">
        <IcSparkle />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">
        {hourGreeting()}, {firstName} 👋
      </h1>
      <p className="text-[#8b8b8b] text-[0.9rem] max-w-sm leading-relaxed mb-2">
        I'm Rolebolt AI. I can help you compare candidates, explain scores, generate interview questions, and recommend who to interview next.
      </p>
      {!jobSelected && (
        <p className="text-amber-400/70 text-xs font-medium mb-6 flex items-center gap-1.5">
          <span>↑</span> Select a job from the left sidebar to get started
        </p>
      )}
      {jobSelected && (
        <>
          <p className="text-[#5a5a5a] text-xs mb-8">Select a prompt or type your own question below</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
            {STARTER_PROMPTS.map((p, i) => (
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
        </>
      )}
    </div>
  );
}

// ─── Context panel (right sidebar) ───────────────────────────────────────────

function ContextPanel({
  job, candidates,
}: {
  job: Job | null; candidates: CandidateStat[];
}) {
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
                <div key={c._id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors">
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
            href={`/recruit/recruiter/${job._id}`}
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

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [candidates, setCandidates] = useState<CandidateStat[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

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

  // ── Load jobs ──────────────────────────────────────────────────────────────
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
        const active = (data.jobs ?? []).filter((j: Job) => j.status === "active");
        setJobs(active);
        if (active.length > 0) setSelectedJob(active[0]);
      } catch {}
    }
    load();
  }, [getToken]);

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

  // ── Load candidates for context panel ─────────────────────────────────────
  useEffect(() => {
    if (!selectedJob) { setCandidates([]); return; }
    async function load() {
      const token = await getToken();
      if (!token) return;
      setLoadingCandidates(true);
      try {
        const res = await fetch(apiUrl(`/recruit/jobs/${selectedJob!._id}/candidates`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setCandidates((data.candidates ?? []).slice(0, 10));
      } catch {} finally {
        setLoadingCandidates(false);
      }
    }
    load();
  }, [selectedJob, getToken]);

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
      // Restore selected job from conversation context
      if (data.context?.jobId) {
        const matchJob = jobs.find(j => j._id === data.context.jobId);
        if (matchJob) setSelectedJob(matchJob);
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
  function newChat() {
    if (abortRef.current) abortRef.current.abort();
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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
    if (!selectedJob) return;

    const token = await getToken();
    if (!token) return;

    // Append user message
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

    try {
      const res = await fetch(apiUrl("/recruit/copilot/chat/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          context: { level: "job", jobId: selectedJob._id },
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
                    ...m, isStreaming: false, content: evt.error || "Something went wrong. Please try again.",
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
  }, [isStreaming, selectedJob, getToken, activeConvId, loadConversations]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Grouped conversations ──────────────────────────────────────────────────
  const grouped = groupConvos(conversations);
  const groupOrder = ["Today", "Yesterday", "This week", "Older"];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0f0f0f", color: "#e5e5e5" }}>

      {/* ── Mobile overlay ─────────────────────────────────────────────── */}
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
          flex flex-col w-64 shrink-0
          border-r transition-transform duration-300 ease-in-out
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
            onClick={newChat}
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
              <IcBriefcase />
              <span className="truncate text-white/70">{selectedJob ? selectedJob.title : "Select a job"}</span>
            </div>
            <IcChevronDown />
          </button>

          {jobDropdownOpen && (
            <div
              className="absolute left-3 right-3 top-full mt-1 z-10 rounded-xl border overflow-hidden shadow-2xl"
              style={{ background: "#222", borderColor: "rgba(255,255,255,0.1)" }}
            >
              {jobs.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-white/30">No active jobs</div>
              ) : (
                jobs.map(job => (
                  <button
                    key={job._id}
                    onClick={() => { setSelectedJob(job); setJobDropdownOpen(false); newChat(); }}
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
                      {c.selectedJobTitle && (
                        <p className="text-[10px] text-white/25 truncate mt-0.5">{c.selectedJobTitle}</p>
                      )}
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
            {/* Mobile sidebar toggle */}
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
            {selectedJob && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.07]">
                <IcBriefcase />
                <span className="text-[11px] font-medium text-white/50">{selectedJob.title}</span>
              </div>
            )}
          </div>
          {/* Mobile context toggle */}
          <button
            onClick={() => setContextOpen(o => !o)}
            className="lg:hidden p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition"
          >
            <IcUsers />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {messages.length === 0 ? (
            <WelcomeScreen
              recruiterName={recruitProfile?.name}
              jobSelected={!!selectedJob}
              onPrompt={sendMessage}
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
                placeholder={selectedJob ? `Ask about ${selectedJob.title}…` : "Select a job first…"}
                disabled={!selectedJob || isStreaming}
                rows={1}
                className="flex-1 bg-transparent text-[0.875rem] text-[#e5e5e5] placeholder-white/20 resize-none outline-none leading-relaxed disabled:opacity-40"
                style={{ maxHeight: "160px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || !selectedJob || isStreaming}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                style={{
                  background: input.trim() && selectedJob && !isStreaming ? "linear-gradient(135deg,#7c3aed,#4338ca)" : "rgba(255,255,255,0.07)",
                  color: input.trim() && selectedJob && !isStreaming ? "#fff" : "rgba(255,255,255,0.3)",
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Hiring Context</p>
          <button onClick={() => setContextOpen(false)} className="lg:hidden text-white/30 hover:text-white/60 transition">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ContextPanel job={selectedJob} candidates={candidates} />
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
