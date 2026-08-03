"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import { apiErrorFromPayload, apiUrl, readApiJson } from "@/lib/api";
import { FORM_ROLE_TEMPLATES } from "@/lib/formRoleTemplates";
import { registerFormPostCreateChecklist } from "@/components/FormPostCreateChecklist";
import { FormErrorNotice } from "@/components/FormErrorNotice";

type QuestionType = "short" | "paragraph" | "number" | "email" | "phone" | "dropdown" | "multiple_choice" | "yes_no" | "file";

const QUESTION_TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: "short", label: "Short Answer", icon: "─" },
  { value: "paragraph", label: "Paragraph", icon: "≡" },
  { value: "email", label: "Email", icon: "@" },
  { value: "phone", label: "Phone", icon: "☎" },
  { value: "number", label: "Number", icon: "#" },
  { value: "dropdown", label: "Dropdown", icon: "▾" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "◉" },
  { value: "yes_no", label: "Yes / No", icon: "◐" },
  { value: "file", label: "File Upload", icon: "📎" },
];

type Question = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  placeholder: string;
};

type JobDetails = {
  companyName: string;
  jobType: string;
  department: string;
  seniority: string;
  location: string;
  workMode: "remote" | "onsite" | "hybrid";
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  experienceMin: string;
  experienceMax: string;
  openings: string;
  applicationDeadline: string;
};

function genId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_QUESTIONS: Question[] = [
  { id: genId(), label: "Your full name", type: "short", required: true, options: [], placeholder: "e.g. Rahul Sharma" },
  { id: genId(), label: "Email address", type: "email", required: true, options: [], placeholder: "e.g. rahul@example.com" },
  { id: genId(), label: "Phone number", type: "phone", required: false, options: [], placeholder: "e.g. +91 9876543210" },
  { id: genId(), label: "Upload your resume", type: "file", required: true, options: [], placeholder: "" },
];

function ShareModal({ slug, title, onClose }: { slug: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://www.rolebolt.tech"}/f/${slug}`;

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
      <div role="dialog" aria-modal="true" aria-labelledby="share-modal-title" className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="share-modal-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
                Form is live!
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Share your form link anywhere</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 transition">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Link copy */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Form Link</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="flex-1 text-xs text-slate-600 truncate font-mono">{link}</p>
              <button onClick={copy} className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${copied ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Social share */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Share on</p>
            <div className="grid grid-cols-4 gap-2">
              {socials.map(s => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-white transition active:scale-95 ${s.color}`}
                  title={s.name}>
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="text-[9px] font-bold leading-none">{s.name.split(" ")[0]}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <Link href="/recruit/dashboard?tab=forms" className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
            View Dashboard
          </Link>
          <button onClick={onClose} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-violet-700 transition shadow-[0_2px_8px_rgba(124,58,237,0.30)]">
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({ q, index, total, onChange, onDelete, onMove }: {
  q: Question; index: number; total: number;
  onChange: (q: Question) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [optionInput, setOptionInput] = useState("");
  const needsOptions = q.type === "dropdown" || q.type === "multiple_choice";

  function addOption() {
    const val = optionInput.trim();
    if (!val) return;
    onChange({ ...q, options: [...q.options, val] });
    setOptionInput("");
  }

  function removeOption(i: number) {
    onChange({ ...q, options: q.options.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="group relative rounded-2xl bg-white border border-black/[0.06] p-5 transition-all duration-200
      shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]
      hover:shadow-[0_6px_22px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.05)]">
      {/* Violet top-accent on hover */}
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      <div className="flex items-start gap-3 mb-3.5">
        <span className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 border border-violet-200/70">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <input
            value={q.label}
            onChange={e => onChange({ ...q, label: e.target.value })}
            placeholder="Question label..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition"
          />
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button onClick={() => onMove("up")} disabled={index === 0} aria-label="Move up" className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button onClick={() => onMove("down")} disabled={index === total - 1} aria-label="Move down" className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <button onClick={onDelete} aria-label="Delete question" className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 ml-9">
        {/* Type selector */}
        <select
          value={q.type}
          onChange={e => onChange({ ...q, type: e.target.value as QuestionType, options: [] })}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
        >
          {QUESTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>

        {/* Required toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <div
            onClick={() => onChange({ ...q, required: !q.required })}
            className={`relative h-4 w-7 rounded-full transition ${q.required ? "bg-violet-600" : "bg-slate-300"}`}
          >
            <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${q.required ? "translate-x-3" : "translate-x-0.5"}`} />
          </div>
          <span className="text-[11px] font-bold text-slate-500">Required</span>
        </label>

        {/* Placeholder (for short/paragraph) */}
        {(q.type === "short" || q.type === "paragraph" || q.type === "number" || q.type === "email" || q.type === "phone") && (
          <input
            value={q.placeholder}
            onChange={e => onChange({ ...q, placeholder: e.target.value })}
            placeholder="Placeholder text (optional)"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
          />
        )}
      </div>

      {/* Options for dropdown/multiple choice */}
      {needsOptions && (
        <div className="ml-9 mt-3.5 space-y-2 border-t border-slate-100 pt-3.5">
          {q.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 w-4 text-right shrink-0">{i + 1}.</span>
              <span className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700">{opt}</span>
              <button onClick={() => removeOption(i)} className="text-slate-400 hover:text-rose-500 transition" aria-label="Remove option">
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={optionInput}
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
              placeholder="Add option..."
              className="flex-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
            />
            <button onClick={addOption} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition">+ Add</button>
          </div>
        </div>
      )}

      {q.type === "yes_no" && (
        <div className="ml-9 mt-3 flex gap-2 border-t border-slate-100 pt-3">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Yes</span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">No</span>
        </div>
      )}

      {q.type === "file" && (
        <p className="ml-9 mt-2.5 text-[11px] font-medium text-slate-400">Accepts PDF, DOCX, TXT — max 5MB</p>
      )}
    </div>
  );
}

function FormBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [token, setToken] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails>({
    companyName: "", jobType: "", department: "", seniority: "", location: "",
    workMode: "remote", salaryMin: "", salaryMax: "", salaryCurrency: "INR",
    experienceMin: "", experienceMax: "", openings: "", applicationDeadline: "",
  });
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>("");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (sessionToken) setToken(sessionToken);
  }, [sessionToken]);

  // Load form for editing
  useEffect(() => {
    if (!editId || !token) return;
    setLoadingEdit(true);
    fetch(apiUrl(`/recruit/forms/${editId}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => readApiJson(r))
      .then(d => {
        if (d.form) {
          setTitle(d.form.title || "");
          setDescription(d.form.description || "");
          const details = d.form.jobDetails || {};
          setJobDetails(prev => ({
            ...prev,
            ...details,
            salaryMin: details.salaryMin?.toString() || "",
            salaryMax: details.salaryMax?.toString() || "",
            experienceMin: details.experienceMin?.toString() || "",
            experienceMax: details.experienceMax?.toString() || "",
            openings: details.openings?.toString() || "",
            applicationDeadline: details.applicationDeadline ? String(details.applicationDeadline).slice(0, 10) : "",
          }));
          setQuestions(d.form.questions || []);
          setSavedSlug(d.form.slug || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEdit(false));
  }, [editId, token]);

  function addQuestion() {
    setQuestions(prev => [
      ...prev,
      { id: genId(), label: "", type: "short", required: false, options: [], placeholder: "" }
    ]);
  }

  function updateQuestion(id: string, updated: Question) {
    setQuestions(prev => prev.map(q => q.id === id ? updated : q));
  }

  function deleteQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  function moveQuestion(index: number, dir: "up" | "down") {
    setQuestions(prev => {
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const save = useCallback(async (andShare = false) => {
    if (!token) return;
    if (!title.trim()) { setError("Please add a form title."); return; }
    if (questions.length === 0) { setError("Add at least one question."); return; }
    for (const q of questions) {
      if (!q.label.trim()) { setError("All questions need a label."); return; }
    }

    setError("");
    setSaving(true);
    try {
      const body = { title: title.trim(), description: description.trim(), questions, jobDetails };
      let res: Response;
      if (editId && savedSlug) {
        res = await fetch(apiUrl(`/recruit/forms/${editId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(apiUrl("/recruit/forms"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }
      const data = await readApiJson(res);
      if (!res.ok) {
        throw apiErrorFromPayload(res.status, data, data.message || data.error || "Failed to save form.");
      }
      const slug = data.form?.slug || savedSlug;
      setSavedSlug(slug);
      if (!editId && data.form?._id) {
        registerFormPostCreateChecklist(data.form._id, title.trim());
      }
      if (andShare) setShowShare(true);
      else router.push(`/recruit/forms/${data.form?._id}?saved=1`);
    } catch (e: any) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }, [token, title, description, questions, jobDetails, editId, savedSlug, router]);

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-400 text-sm">
          <svg className="animate-spin h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading form…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {showShare && savedSlug && (
        <ShareModal slug={savedSlug} title={title} onClose={() => setShowShare(false)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-black/[0.07] shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link href="/recruit/new" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
              Back
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-[13px] font-bold text-slate-900">{editId ? "Edit Form" : "New Form"}</span>
          </div>
          <div className="flex items-center gap-2">
            {savedSlug && (
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-bold text-violet-700 hover:bg-violet-100 transition"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
                Share
              </button>
            )}
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white transition
                shadow-[0_2px_8px_rgba(124,58,237,0.30)]
                hover:bg-violet-700 hover:shadow-[0_4px_16px_rgba(124,58,237,0.40)] hover:-translate-y-px disabled:opacity-60 disabled:translate-y-0"
            >
              {saving ? (
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
              )}
              {saving ? "Saving…" : "Save & Share"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-5 pb-20">

        {/* Page title */}
        <div className="mb-1">
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900 leading-tight">{editId ? "Edit Application Form" : "Build an Application Form"}</h1>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">Design a custom form, share the link, and let AI score every response automatically.</p>
        </div>

        {error ? <FormErrorNotice error={error} /> : null}

        {!editId && (
          <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Start from a template</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FORM_ROLE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setTitle(tpl.title);
                    setDescription(tpl.description);
                    setJobDetails(prev => ({ ...prev, jobType: tpl.jobType }));
                    setQuestions(tpl.questions.map(q => ({
                      id: genId(),
                      label: q.label,
                      type: q.type as QuestionType,
                      required: q.required,
                      options: q.options || [],
                      placeholder: q.placeholder || "",
                    })));
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left hover:border-violet-300 hover:bg-violet-50/40 transition"
                >
                  <span className="text-xl">{tpl.emoji}</span>
                  <p className="mt-2 text-sm font-bold text-slate-900">{tpl.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500 leading-4">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form meta */}
        <div className="rounded-2xl bg-white border border-black/[0.06] p-6
          shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="mb-1">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Form Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer – Apply Now"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
          <div className="mt-5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Description <span className="normal-case font-medium text-slate-400">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description shown to candidates at the top of the form..."
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition resize-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Optional job context */}
        <div className="rounded-2xl bg-white border border-black/[0.06] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="mb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Job details <span className="normal-case font-medium tracking-normal">(optional)</span></h2>
            <p className="mt-1 text-xs text-slate-500">Add context candidates should see alongside the screening questions.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["companyName", "Company name", "e.g. Acme Technologies"],
              ["department", "Department", "e.g. Engineering"],
              ["location", "Location", "e.g. Bengaluru or Anywhere"],
              ["jobType", "Job type", "e.g. Full-time"],
              ["seniority", "Seniority", "e.g. Mid-level"],
              ["salaryCurrency", "Currency", "INR"],
            ].map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">{label}</span>
                <input
                  value={jobDetails[key as keyof JobDetails] as string}
                  onChange={e => setJobDetails(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition"
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Work mode</span>
              <select value={jobDetails.workMode} onChange={e => setJobDetails(prev => ({ ...prev, workMode: e.target.value as JobDetails["workMode"] }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition">
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Application deadline</span>
              <input type="date" value={jobDetails.applicationDeadline} onChange={e => setJobDetails(prev => ({ ...prev, applicationDeadline: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition" />
            </label>
            {[
              ["salaryMin", "Minimum salary", "e.g. 800000"],
              ["salaryMax", "Maximum salary", "e.g. 1400000"],
              ["experienceMin", "Minimum experience (years)", "e.g. 2"],
              ["experienceMax", "Maximum experience (years)", "e.g. 6"],
              ["openings", "Number of openings", "e.g. 2"],
            ].map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">{label}</span>
                <input type="number" min="0" value={jobDetails[key as keyof JobDetails] as string} onChange={e => setJobDetails(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition" />
              </label>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-3 px-0.5">
            Questions <span className="text-slate-400 font-semibold normal-case tracking-normal">({questions.length})</span>
          </h2>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionEditor
                key={q.id}
                q={q}
                index={idx}
                total={questions.length}
                onChange={updated => updateQuestion(q.id, updated)}
                onDelete={() => deleteQuestion(q.id)}
                onMove={dir => moveQuestion(idx, dir)}
              />
            ))}
          </div>
        </div>

        {/* Add question button */}
        <button
          onClick={addQuestion}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200/80 bg-white/60 py-4 text-[13px] font-semibold text-slate-500
            shadow-[0_1px_3px_rgba(0,0,0,0.03)]
            hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50/40 transition-all duration-200"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Add Question
        </button>

        {/* Save bar */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-[13px] font-semibold text-slate-700
              shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 transition"
          >
            Save Draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-[13px] font-semibold text-white transition
              shadow-[0_2px_8px_rgba(124,58,237,0.30)]
              hover:bg-violet-700 hover:shadow-[0_4px_16px_rgba(124,58,237,0.40)] hover:-translate-y-px disabled:opacity-60 disabled:translate-y-0"
          >
            {saving ? "Saving…" : "Save & Share →"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function FormBuilderPage() {
  return <RecruitGuard requiredRole="creator"><FormBuilderContent /></RecruitGuard>;
}
