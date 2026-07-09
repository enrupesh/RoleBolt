"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
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

type Answer = { questionId: string; label: string; value: string };

type FormResponse = {
  _id: string;
  formId: string;
  answers: Answer[];
  aiScore: number;
  aiSummary: string;
  strengths: string[];
  redFlags: string[];
  scoringFailed: boolean;
  stage: Stage;
  submittedName: string;
  submittedEmail: string;
  submittedPhone: string;
  resumeText?: string;
  createdAt: string;
};

type Form = {
  _id: string;
  title: string;
  description: string;
  slug: string;
  status: "active" | "closed";
  responseCount: number;
  createdAt: string;
};

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
    { name: "WhatsApp", href: `https://wa.me/?text=${shareText}`, color: "bg-green-500 hover:bg-green-600", icon: "💬" },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, color: "bg-blue-700 hover:bg-blue-800", icon: "in" },
    { name: "Twitter", href: `https://twitter.com/intent/tweet?text=${shareText}`, color: "bg-slate-800 hover:bg-slate-900", icon: "𝕏" },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`, color: "bg-sky-500 hover:bg-sky-600", icon: "✈" },
    { name: "Email", href: `mailto:?subject=${encodeURIComponent(`Apply: ${title}`)}&body=${shareText}`, color: "bg-slate-500 hover:bg-slate-600", icon: "✉" },
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
            <div className="grid grid-cols-5 gap-2">
              {socials.map(s => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-white transition ${s.color}`} title={s.name}>
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

function FormResponseInfoModal({ r, onClose }: { r: FormResponse; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<"email" | "phone" | null>(null);

  const displayName = r.submittedName || r.answers.find(a => a.label.toLowerCase().includes("name"))?.value || "Candidate";
  const displayEmail = r.submittedEmail || r.answers.find(a => a.label.toLowerCase().includes("email"))?.value || "";
  const appliedDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  const textAnswers = r.answers.filter(a => a.value && a.value.trim() && a.value !== "__file_uploaded__");

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
              <a href={`mailto:${displayEmail}`} className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-500/80 hover:text-sky-400 transition">
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
                Send email →
              </a>
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

          {/* Form answers */}
          {textAnswers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">Form Answers</p>
              {textAnswers.map(a => (
                <div key={a.questionId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold text-gray-500 mb-1.5">{a.label}</p>
                  <p className="text-xs text-gray-200 leading-5 whitespace-pre-wrap">{a.value}</p>
                </div>
              ))}
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

function ResponseCard({ r, token, formId, onUpdate }: {
  r: FormResponse; token: string; formId: string;
  onUpdate: (id: string, patch: Partial<FormResponse>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<"email" | "phone" | null>(null);
  const [showInfo, setShowInfo] = useState(false);

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

  function copy(text: string, field: "email" | "phone") {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  const stageStyle = STAGES.find(s => s.id === r.stage) || STAGES[0];
  const displayName = r.submittedName || r.answers.find(a => a.label.toLowerCase().includes("name"))?.value || "Candidate";
  const displayEmail = r.submittedEmail || r.answers.find(a => a.label.toLowerCase().includes("email"))?.value || "";
  const textAnswers = r.answers.filter(a => a.value && a.value.trim() && a.value !== "__file_uploaded__");

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
          {!r.scoringFailed && (
            <div className="text-right shrink-0">
              <p className={`text-xl font-bold leading-none ${scoreColor(r.aiScore)}`}>{r.aiScore}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">AI score</p>
            </div>
          )}
        </div>

        {/* Score bar */}
        {!r.scoringFailed && (
          <div className="mb-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scoreBarColor(r.aiScore)}`} style={{ width: `${r.aiScore}%` }} />
          </div>
        )}

        {/* AI Summary */}
        {r.aiSummary && !r.scoringFailed && (
          <p className="text-xs text-slate-600 leading-5 line-clamp-2 mb-3">{r.aiSummary}</p>
        )}
        {r.scoringFailed && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
            AI scoring unavailable for this response.
          </p>
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
            <a href={`mailto:${displayEmail}`} className="flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-600 hover:bg-sky-100 transition">
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              Email
            </a>
          )}
        </div>
      </div>

      {/* Info modal */}
      {showInfo && <FormResponseInfoModal r={r} onClose={() => setShowInfo(false)} />}

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

          {/* All answers */}
          {textAnswers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Form Answers</p>
              <div className="space-y-2">
                {textAnswers.map(a => (
                  <div key={a.questionId} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                    <p className="text-[10px] font-bold text-slate-400 mb-0.5">{a.label}</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{a.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");

  useEffect(() => {
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

  const filtered = stageFilter === "all" ? responses : responses.filter(r => r.stage === stageFilter);

  const stats = [
    { label: "Total", value: responses.length, accent: "text-slate-800" },
    { label: "Shortlisted", value: responses.filter(r => r.stage === "shortlisted").length, accent: "text-blue-600" },
    { label: "Interview", value: responses.filter(r => r.stage === "interview").length, accent: "text-amber-600" },
    { label: "Hired", value: responses.filter(r => r.stage === "hired").length, accent: "text-emerald-600" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
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
              <ResponseCard key={r._id} r={r} token={token!} formId={id} onUpdate={onUpdate} />
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
