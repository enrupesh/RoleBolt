"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, isFirebaseAvailable } from "@/lib/firebaseClient";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";

type Stage = "new" | "shortlisted" | "interview" | "hired" | "rejected";

const STAGES: { id: Stage; label: string; color: string; bg: string }[] = [
  { id: "new", label: "New", color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
  { id: "shortlisted", label: "Shortlisted", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  { id: "interview", label: "Interview", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  { id: "hired", label: "Hired", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  { id: "rejected", label: "Rejected", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
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

type EmailLogEntry = {
  type: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
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
  interviewQuestions: string[];
  scoringFailed: boolean;
  stage: Stage;
  submittedName: string;
  submittedEmail: string;
  submittedPhone: string;
  resumeText?: string;
  emailLog: EmailLogEntry[];
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
  createdAt: string;
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
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://www.rolebolt.app"}/f/${slug}`;

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

// ─── Info modal ────────────────────────────────────────────────────────────────

function FormResponseInfoModal({ r, onClose }: { r: FormResponse; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<"email" | "phone" | null>(null);

  const displayName = r.submittedName || r.answers.find(a => a.label.toLowerCase().includes("name"))?.value || "Candidate";
  const displayEmail = r.submittedEmail || r.answers.find(a => a.label.toLowerCase().includes("email"))?.value || "";
  const appliedDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  const textAnswers = r.answers.filter(a => a.value && a.value.trim() && a.value !== "__file_uploaded__");

  const signalMap: Record<string, AnswerSignal> = {};
  for (const s of (r.answerSignals || [])) signalMap[s.questionId] = s;

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

          {/* Form answers with per-answer signals */}
          {textAnswers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">Form Answers</p>
              {textAnswers.map(a => {
                const sig = signalMap[a.questionId];
                return (
                  <div key={a.questionId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-[10px] font-bold text-gray-500">{a.label}</p>
                      {sig && <SignalBadgeDark signal={sig.signal} note={sig.note} />}
                    </div>
                    <p className="text-xs text-gray-200 leading-5 whitespace-pre-wrap">{a.value}</p>
                    {sig?.note && (
                      <p className="mt-1.5 text-[10px] text-gray-500 italic">{sig.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
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

function ResponseCard({ r, token, formId, formTitle, onUpdate, onDelete }: {
  r: FormResponse; token: string; formId: string; formTitle: string;
  onUpdate: (id: string, patch: Partial<FormResponse>) => void;
  onDelete: (id: string) => void;
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

  async function updateStage(stage: Stage) {
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${r._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) onUpdate(r._id, { stage });
    } catch { /* silent */ }
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

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-slate-900 truncate">{displayName}</h3>
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
              className="flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-600 hover:bg-sky-100 transition"
            >
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              Email
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
      </div>

      {/* Modals */}
      {showInfo && <FormResponseInfoModal r={r} onClose={() => setShowInfo(false)} />}
      {showComposeModal && displayEmail && (
        <FormComposeEmailModal
          candidateName={displayName}
          candidateEmail={displayEmail}
          formId={formId}
          responseId={r._id}
          token={token}
          onClose={() => setShowComposeModal(false)}
          onSent={(entry) => setLocalEmailLog(prev => [...prev, entry])}
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

function FormResponsesContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSaved = searchParams.get("saved") === "1";

  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(justSaved);
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");

  useEffect(() => {
    if (!isFirebaseAvailable()) return;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/recruit/login"); return; }
      setToken(await u.getIdToken());
    });
    return () => unsub();
  }, [router]);

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

  const filtered = stageFilter === "all" ? responses : responses.filter(r => r.stage === stageFilter);

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
            <Link
              href={`/recruit/forms/new?edit=${id}`}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Edit Form
            </Link>
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
              Share
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Scoring criteria card — only show when there are form questions */}
        {form.questions && form.questions.length > 0 && (
          <ScoringCriteriaCard questions={form.questions} formTitle={form.title} />
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 items-center">
          {(["all", ...STAGES.map(s => s.id)] as (Stage | "all")[]).map(f => (
            <button
              key={f}
              onClick={() => setStageFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                stageFilter === f
                  ? "bg-violet-600 text-white shadow"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {f === "all" ? "All Responses" : STAGES.find(s => s.id === f)?.label ?? f}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">{filtered.length} response{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Response cards */}
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
              <button onClick={() => setShowShare(true)} className="mt-5 flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition">
                Share Form Link
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(r => (
              <ResponseCard key={r._id} r={r} token={token!} formId={id} formTitle={form.title} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RecruitGuard requiredRole="creator"><FormResponsesContent id={id} /></RecruitGuard>;
}
