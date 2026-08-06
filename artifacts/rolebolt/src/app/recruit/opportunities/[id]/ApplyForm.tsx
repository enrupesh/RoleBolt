"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Script from "next/script";
import { trackEvent } from "@/lib/trackEvent";
import { apiUrl, readApiJson } from "@/lib/api";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

// Execute reCAPTCHA v3 and return a token (returns "" if not configured)
async function getRecaptchaToken(action: string): Promise<string> {
  if (!RECAPTCHA_SITE_KEY) return "";
  try {
    return await (window as any).grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
  } catch {
    return "";
  }
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CURRENT_STATUS_OPTIONS = [
  "Employed full-time",
  "Employed part-time",
  "Self-employed / Freelancer",
  "Student",
  "Recent graduate",
  "Looking for work",
  "Taking a break",
];

const EDUCATION_LEVEL_OPTIONS = [
  "High School / 12th Pass",
  "Currently pursuing degree",
  "Diploma / Certificate",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD / Doctorate",
  "Professional certification",
  "Other",
];

const AVAILABILITY_OPTIONS = [
  "Immediately available",
  "Within 2 weeks",
  "Within 1 month",
  "Within 2 months",
  "More than 2 months notice",
];

const STUDENT_YEARS = [
  "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Final Year",
  "1st Semester", "2nd Semester", "3rd Semester", "4th Semester",
  "5th Semester", "6th Semester", "7th Semester", "8th Semester",
];

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Form = {
  name: string;
  email: string;
  phone: string;
  location: string;
  currentStatus: string;
  educationLevel: string;
  currentClassYear: string;
  availability: string;
  linkedinUrl: string;
  coverLetter: string;
  resumeText: string;
};

const EMPTY: Form = {
  name: "", email: "", phone: "", location: "",
  currentStatus: "", educationLevel: "", currentClassYear: "",
  availability: "", linkedinUrl: "", coverLetter: "", resumeText: "",
};

type Step = 1 | 2 | 3 | 4;

/* ─── Step config ────────────────────────────────────────────────────────── */
const STEPS = [
  { n: 1 as Step, label: "Contact" },
  { n: 2 as Step, label: "Background" },
  { n: 3 as Step, label: "Resume" },
  { n: 4 as Step, label: "Review" },
];

/* ─── Shared input styles ────────────────────────────────────────────────── */
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition placeholder:text-slate-400";
const inputErrorCls =
  "w-full rounded-xl border border-red-300 bg-red-50/40 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition placeholder:text-slate-400";
const selectCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0a66c2] transition";
const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400";
const fieldErrCls = "mt-1 text-[11px] font-medium text-red-600";

/* ─── Validation helpers ──────────────────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

// Normalize first (strip everything but leading "+" and digits), then validate the
// canonical form. This keeps input permissive (any spacing/parens/hyphens are fine)
// while the underlying rule stays simple: optional leading "+", 7-15 digits.
function normalizePhone(v: string): string {
  const trimmed = v.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return (hasPlus ? "+" : "") + digits;
}

function isValidPhone(v: string): boolean {
  const trimmed = v.trim();
  if (!trimmed) return true; // phone is optional — only validate format if provided
  const normalized = normalizePhone(trimmed);
  const digitCount = normalized.replace(/[^0-9]/g, "").length;
  return /^\+?[0-9]+$/.test(normalized) && digitCount >= 7 && digitCount <= 15;
}

/* ─── Helper: extract name suggestion from LinkedIn URL ──────────────────── */
function suggestNameFromLinkedIn(url: string): string {
  try {
    const clean = url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/^linkedin\.com\/in\//, "");
    const slug = clean.split(/[/?#]/)[0].replace(/-\d+$/, "");
    if (!slug || slug.length < 2) return "";
    return slug
      .split("-")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-0 px-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-all duration-300 ${
                s.n < step
                  ? "bg-[#0a66c2] text-white"
                  : s.n === step
                  ? "bg-[#0a66c2] text-white shadow-md shadow-blue-300 ring-4 ring-blue-100"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.n < step ? (
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : s.n}
            </div>
            <span className={`text-[10px] font-semibold hidden sm:block ${s.n <= step ? "text-[#0a66c2]" : "text-slate-400"}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition-all duration-500 ${s.n < step ? "bg-[#0a66c2]" : "bg-slate-100"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="w-24 sm:w-28 shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400 pt-0.5">{label}</span>
      <span className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap flex-1 min-w-0 break-words">{value}</span>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      <svg className="shrink-0 mt-0.5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m10.29 3.86-8.58 14.86A1 1 0 0 0 2.57 20h18.86a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>{msg}</span>
    </div>
  );
}

/* ─── Resume Upload Zone ─────────────────────────────────────────────────── */
function ResumeUploadZone({
  onText,
  disabled,
}: {
  onText: (text: string, fileName: string) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedFile, setUploadedFile] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    setUploadError("");
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PDF, DOCX, or TXT files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Please upload a file under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch(apiUrl("/recruit-public/parse-resume"), {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse file.");
      onText(data.text, file.name);
      setUploadedFile(file.name);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Failed to read file. Try pasting manually.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-label="Upload resume file. Drag and drop or press Enter to browse."
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && fileRef.current?.click()}
        onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && !disabled && !uploading) { e.preventDefault(); fileRef.current?.click(); } }}
        className={`relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2] focus-visible:ring-offset-2
          ${dragOver ? "border-[#0a66c2] bg-blue-50 scale-[1.01]" : "border-slate-200 bg-slate-50 hover:border-[#0a66c2] hover:bg-blue-50/40"}
          ${disabled || uploading ? "opacity-60 cursor-not-allowed" : ""}
          ${uploadedFile ? "border-green-400 bg-green-50" : ""}
        `}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          disabled={disabled || uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
        />

        {uploading ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg className="animate-spin h-6 w-6 text-[#0a66c2]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">Extracting text from your resume…</p>
          </>
        ) : uploadedFile ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600"><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <div className="text-center">
              <p className="text-sm font-bold text-green-700">Resume uploaded!</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">{uploadedFile}</p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setUploadedFile(""); fileRef.current?.click(); }}
              className="text-[11px] font-bold text-[#0a66c2] hover:underline"
            >
              Change file
            </button>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl">📄</div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                Drag &amp; drop your resume here
              </p>
              <p className="text-xs text-slate-400 mt-1">or click to browse</p>
            </div>
            <span className="rounded-full bg-[#0a66c2] px-5 py-2 text-xs font-bold text-white pointer-events-none">
              Choose File
            </span>
            <p className="text-[11px] text-slate-400">PDF, DOCX, DOC, or TXT · Max 5 MB</p>
          </>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
          <svg className="shrink-0" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m10.29 3.86-8.58 14.86A1 1 0 0 0 2.57 20h18.86a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {uploadError}
        </div>
      )}
    </div>
  );
}

/* ─── Draft saved indicator ──────────────────────────────────────────────── */
function DraftBadge({ saved }: { saved: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-semibold transition-all duration-500 ${saved ? "text-emerald-600" : "text-slate-300"}`}>
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
      </svg>
      {saved ? "Draft saved" : "Saving…"}
    </div>
  );
}

/* ─── Success Screen ─────────────────────────────────────────────────────── */
function SuccessScreen({ jobTitle, companyName }: { jobTitle?: string; companyName?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      {/* Animated checkmark */}
      <div className="relative mb-6">
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl shadow-green-200 animate-[bounce_0.6s_ease-out_once]">
          <svg width="44" height="44" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-yellow-400 flex items-center justify-center shadow text-yellow-900"><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      </div>

      <h2 className="text-2xl font-black text-slate-900 leading-tight">
        Application Submitted!
      </h2>
      <p className="mt-2 text-sm text-slate-600 max-w-xs">
        Your application for{" "}
        <span className="font-semibold text-slate-800">
          {jobTitle ? `"${jobTitle}"` : "this role"}
        </span>
        {companyName ? ` at ${companyName}` : ""} has been sent.
      </p>

      {/* What happens next */}
      <div className="mt-6 w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">What happens next</p>
        {[
          { icon: "🤖", text: "Our AI is scoring your profile against the job requirements right now." },
          { icon: "👀", text: "The recruiter will review your application and AI match score." },
          { icon: "📧", text: "You'll hear back via the email you provided." },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
            <p className="text-xs text-slate-600 leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link
          href="/recruit/opportunities"
          className="flex-1 rounded-full bg-[#0a66c2] px-5 py-3 text-sm font-bold text-white hover:bg-[#004182] transition text-center"
        >
          Browse more jobs
        </Link>
        <Link
          href="/recruit/opportunities"
          className="flex-1 rounded-full border-2 border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition text-center"
        >
          Back to listings
        </Link>
      </div>

      <p className="mt-5 text-[11px] text-slate-400">
        Good luck! We're rooting for you 🤞
      </p>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function ApplyForm({
  jobId,
  jobTitle,
  companyName,
}: {
  jobId: string;
  jobTitle?: string;
  companyName?: string;
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [resumeMode, setResumeMode] = useState<"upload" | "type">("upload");
  const [linkedinSuggestion, setLinkedinSuggestion] = useState("");
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* Pre-fill from localStorage */
  useEffect(() => {
    try {
      const stored: Partial<Form> = {
        name: localStorage.getItem("recruit_applicant_name") || "",
        email: localStorage.getItem("recruit_applicant_email") || "",
        phone: localStorage.getItem("recruit_applicant_phone") || "",
        location: localStorage.getItem("recruit_applicant_location") || "",
        currentStatus: localStorage.getItem("recruit_applicant_currentStatus") || "",
        educationLevel: localStorage.getItem("recruit_applicant_educationLevel") || "",
        availability: localStorage.getItem("recruit_applicant_availability") || "",
        linkedinUrl: localStorage.getItem("recruit_applicant_linkedin") || "",
        resumeText: localStorage.getItem("recruit_resume_text") || "",
      };
      setForm(prev => ({ ...prev, ...Object.fromEntries(Object.entries(stored).filter(([, v]) => v)) }));
      if (stored.resumeText) setResumeMode("type");
    } catch { /* ignore */ }
  }, []);

  /* Auto-save draft to localStorage with UI feedback */
  const saveDraft = useCallback((f: Form) => {
    try {
      if (f.name) localStorage.setItem("recruit_applicant_name", f.name);
      if (f.email) localStorage.setItem("recruit_applicant_email", f.email);
      if (f.phone) localStorage.setItem("recruit_applicant_phone", f.phone);
      if (f.location) localStorage.setItem("recruit_applicant_location", f.location);
      if (f.currentStatus) localStorage.setItem("recruit_applicant_currentStatus", f.currentStatus);
      if (f.educationLevel) localStorage.setItem("recruit_applicant_educationLevel", f.educationLevel);
      if (f.availability) localStorage.setItem("recruit_applicant_availability", f.availability);
      if (f.linkedinUrl) localStorage.setItem("recruit_applicant_linkedin", f.linkedinUrl);
      if (f.resumeText) localStorage.setItem("recruit_resume_text", f.resumeText);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2500);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveDraft(form), 800);
    return () => clearTimeout(draftTimer.current);
  }, [form, saveDraft]);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError("");
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function validateField(key: keyof Form, value: string): string {
    switch (key) {
      case "name":
        return value.trim() ? "" : "Full name is required.";
      case "email":
        if (!value.trim()) return "Email address is required.";
        return isValidEmail(value) ? "" : "Please enter a valid email address (e.g. name@example.com).";
      case "phone":
        return isValidPhone(value) ? "" : "Please enter a valid phone number (digits only, 7–15 digits, optional + country code).";
      default:
        return "";
    }
  }

  function handleBlur(key: keyof Form) {
    const msg = validateField(key, form[key]);
    setFieldErrors(prev => ({ ...prev, [key]: msg || undefined }));
  }

  function handlePhoneChange(value: string) {
    // Only allow digits, spaces, +, -, ( ) — block letters/other special characters at input time.
    // Keep a leading "+" only; strip any "+" that appears elsewhere in the string.
    let cleaned = value.replace(/[^0-9+\s\-()]/g, "");
    const hasLeadingPlus = cleaned.startsWith("+");
    cleaned = (hasLeadingPlus ? "+" : "") + cleaned.replace(/\+/g, "");
    set("phone", cleaned);
  }

  /* LinkedIn URL auto-suggest name */
  function handleLinkedinChange(url: string) {
    set("linkedinUrl", url);
    const suggestion = suggestNameFromLinkedIn(url);
    setLinkedinSuggestion(suggestion && !form.name ? suggestion : "");
  }

  function applyLinkedinSuggestion() {
    if (linkedinSuggestion) {
      set("name", linkedinSuggestion);
      setLinkedinSuggestion("");
    }
  }

  const isStudent =
    form.currentStatus === "Student" ||
    form.educationLevel === "Currently pursuing degree";

  /* ── Validation per step ── */
  function validateStep(s: Step): string {
    if (s === 1) {
      const nameErr = validateField("name", form.name);
      const emailErr = validateField("email", form.email);
      const phoneErr = validateField("phone", form.phone);
      setFieldErrors(prev => ({ ...prev, name: nameErr || undefined, email: emailErr || undefined, phone: phoneErr || undefined }));
      if (nameErr) return nameErr;
      if (emailErr) return emailErr;
      if (phoneErr) return phoneErr;
    }
    if (s === 3) {
      if (!form.resumeText.trim()) {
        setFieldErrors(prev => ({ ...prev, resumeText: "Please add your resume or work history." }));
        return "Please upload your resume or type/paste your work history — recruiters need this.";
      }
      setFieldErrors(prev => ({ ...prev, resumeText: undefined }));
    }
    return "";
  }

  function goNext() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError("");
    setStep(s => (s + 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError("");
    setStep(s => (s - 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const step1Err = validateStep(1);
    if (step1Err) { setError(step1Err); setStep(1); return; }
    const step3Err = validateStep(3);
    if (step3Err) { setError(step3Err); setStep(3); return; }
    setSubmitting(true);
    setError("");
    try {
      // Google reCAPTCHA v3 — get invisible bot-check token before submitting
      const recaptchaToken = await getRecaptchaToken("apply");

      const res = await fetch(apiUrl(`/recruit-public/jobs/${jobId}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "Rolebolt Jobs", recaptchaToken }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Application failed. Please try again.");
      trackEvent("application_submitted", { jobId });
      // Clear draft from localStorage
      try {
        ["recruit_resume_text"].forEach(k => localStorage.removeItem(k));
      } catch { /* ignore */ }
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-4">
          <p className="text-sm font-bold text-white opacity-90">Application received ✓</p>
        </div>
        <SuccessScreen jobTitle={jobTitle} companyName={companyName} />
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <>
    {/* Google reCAPTCHA v3 — invisible bot protection, no billing required */}
    {RECAPTCHA_SITE_KEY && (
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
      />
    )}
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a66c2] to-[#004182] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">Applying for</p>
            <h2 className="mt-0.5 text-base font-bold text-white truncate">
              {jobTitle || "This role"}{companyName ? ` · ${companyName}` : ""}
            </h2>
          </div>
          <DraftBadge saved={draftSaved} />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <ProgressBar step={step} />

        {/* ── Step 1: Contact Info ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Contact information</h3>
              <p className="mt-0.5 text-xs text-slate-500">This is how the recruiter will reach you.</p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className={labelCls}>Full name <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  placeholder="Rahul Sharma"
                  className={fieldErrors.name ? inputErrorCls : inputCls}
                  autoFocus
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && <p className={fieldErrCls}>{fieldErrors.name}</p>}
              </div>

              <div>
                <label className={labelCls}>Email address <span className="text-red-400">*</span></label>
                <input
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  placeholder="rahul@email.com"
                  type="email"
                  className={fieldErrors.email ? inputErrorCls : inputCls}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email && <p className={fieldErrCls}>{fieldErrors.email}</p>}
              </div>

              <div>
                <label className={labelCls}>Phone number</label>
                <input
                  value={form.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  onBlur={() => handleBlur("phone")}
                  placeholder="+91 98765 43210"
                  type="tel"
                  className={fieldErrors.phone ? inputErrorCls : inputCls}
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone && <p className={fieldErrCls}>{fieldErrors.phone}</p>}
              </div>

              <div>
                <label className={labelCls}>Current location</label>
                <input
                  value={form.location}
                  onChange={e => set("location", e.target.value)}
                  placeholder="e.g. Mumbai, Maharashtra"
                  className={inputCls}
                  autoComplete="address-level2"
                />
              </div>
            </div>

            <ErrorMsg msg={error} />

            <button
              onClick={goNext}
              className="w-full rounded-full bg-[#0a66c2] py-3 text-sm font-bold text-white hover:bg-[#004182] active:scale-[0.98] transition"
            >
              Next — Background details →
            </button>
            <p className="text-center text-[11px] text-slate-400">Step 1 of 4 · Your info is shared only with this recruiter</p>
          </div>
        )}

        {/* ── Step 2: Background Details ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Background details</h3>
              <p className="mt-0.5 text-xs text-slate-500">Help the recruiter understand where you&apos;re coming from.</p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className={labelCls}>Current status</label>
                <select value={form.currentStatus} onChange={e => set("currentStatus", e.target.value)} className={selectCls}>
                  <option value="">Select status…</option>
                  {CURRENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Education level</label>
                <select value={form.educationLevel} onChange={e => set("educationLevel", e.target.value)} className={selectCls}>
                  <option value="">Select level…</option>
                  {EDUCATION_LEVEL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {isStudent && (
                <div>
                  <label className={labelCls}>Current year / semester</label>
                  <select value={form.currentClassYear} onChange={e => set("currentClassYear", e.target.value)} className={selectCls}>
                    <option value="">Select year…</option>
                    {STUDENT_YEARS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Availability to join</label>
                <select value={form.availability} onChange={e => set("availability", e.target.value)} className={selectCls}>
                  <option value="">Select availability…</option>
                  {AVAILABILITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>LinkedIn profile URL</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                  <svg width="13" height="13" fill="currentColor" className="text-[#0a66c2] shrink-0" viewBox="0 0 24 24">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                  <input
                    value={form.linkedinUrl}
                    onChange={e => handleLinkedinChange(e.target.value)}
                    placeholder="linkedin.com/in/yourname"
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400 min-w-0"
                    autoComplete="off"
                  />
                </div>
                {/* LinkedIn name suggestion */}
                {linkedinSuggestion && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs">
                    <span className="text-blue-700 flex-1">
                      <svg className="shrink-0 text-blue-500" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Name detected: <strong>{linkedinSuggestion}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={applyLinkedinSuggestion}
                      className="rounded-full bg-[#0a66c2] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#004182] transition shrink-0"
                    >
                      Use this name
                    </button>
                  </div>
                )}
              </div>
            </div>

            <ErrorMsg msg={error} />

            <div className="flex gap-2">
              <button onClick={goBack} className="flex-1 rounded-full border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition">
                ← Back
              </button>
              <button onClick={goNext} className="flex-[2] rounded-full bg-[#0a66c2] py-3 text-sm font-bold text-white hover:bg-[#004182] active:scale-[0.98] transition">
                Next — Resume →
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-400">Step 2 of 4 · All fields optional</p>
          </div>
        )}

        {/* ── Step 3: Resume & Cover Letter ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Resume &amp; work history</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Your resume is used for the AI match score. Upload a file or type/paste below.
              </p>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
              <button
                type="button"
                onClick={() => setResumeMode("upload")}
                className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition ${resumeMode === "upload" ? "bg-[#0a66c2] text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setResumeMode("type")}
                className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition ${resumeMode === "type" ? "bg-[#0a66c2] text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Type / Paste
              </button>
            </div>

            {resumeMode === "upload" ? (
              <div className="space-y-3">
                <ResumeUploadZone
                  onText={(text) => {
                    set("resumeText", text);
                  }}
                />
                {form.resumeText && resumeMode === "upload" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Extracted text preview</p>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{form.resumeText.slice(0, 300)}…</p>
                    <button
                      type="button"
                      onClick={() => { setResumeMode("type"); }}
                      className="mt-2 text-[11px] font-bold text-[#0a66c2] hover:underline"
                    >
                      Edit extracted text →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className={labelCls}>Resume / Work history <span className="text-red-400">*</span></label>
                <textarea
                  value={form.resumeText}
                  onChange={e => set("resumeText", e.target.value)}
                  onBlur={() => setFieldErrors(prev => ({ ...prev, resumeText: form.resumeText.trim() ? undefined : "Please add your resume or work history." }))}
                  placeholder="Paste your resume, LinkedIn summary, or work history here. Include skills, experience, education and achievements for the best AI match score…"
                  rows={9}
                  className={`${fieldErrors.resumeText ? inputErrorCls : inputCls} resize-none leading-relaxed`}
                  autoFocus
                  aria-invalid={Boolean(fieldErrors.resumeText)}
                />
                {fieldErrors.resumeText && <p className={fieldErrCls}>{fieldErrors.resumeText}</p>}
                <p className="mt-1 text-[11px] text-slate-400">
                  Tip: Copy-paste from your LinkedIn &quot;About&quot; + &quot;Experience&quot; for a quick fill.
                </p>
              </div>
            )}

            <div>
              <label className={labelCls}>Cover letter <span className="text-slate-300">(optional)</span></label>
              <textarea
                value={form.coverLetter}
                onChange={e => set("coverLetter", e.target.value)}
                placeholder="Tell the recruiter why you're a great fit for this specific role…"
                rows={4}
                className={`${inputCls} resize-none leading-relaxed`}
              />
            </div>

            <ErrorMsg msg={error} />

            <div className="flex gap-2">
              <button onClick={goBack} className="flex-1 rounded-full border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition">
                ← Back
              </button>
              <button onClick={goNext} className="flex-[2] rounded-full bg-[#0a66c2] py-3 text-sm font-bold text-white hover:bg-[#004182] active:scale-[0.98] transition">
                Review application →
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-400">Step 3 of 4</p>
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Review &amp; submit</h3>
              <p className="mt-0.5 text-xs text-slate-500">Everything looks right? Hit submit — or go back to edit.</p>
            </div>

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {/* Contact section */}
              <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact</p>
                <button onClick={() => { setStep(1); setError(""); }} className="text-[11px] font-bold text-[#0a66c2] hover:underline">Edit</button>
              </div>
              <div className="px-4 py-1 bg-white">
                <ReviewRow label="Name" value={form.name || "—"} />
                <ReviewRow label="Email" value={form.email || "—"} />
                <ReviewRow label="Phone" value={form.phone || "Not provided"} />
                <ReviewRow label="Location" value={form.location || "Not provided"} />
              </div>

              {/* Background section */}
              <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Background</p>
                <button onClick={() => { setStep(2); setError(""); }} className="text-[11px] font-bold text-[#0a66c2] hover:underline">Edit</button>
              </div>
              <div className="px-4 py-1 bg-white">
                <ReviewRow label="Status" value={form.currentStatus || "Not provided"} />
                <ReviewRow label="Education" value={form.educationLevel || "Not provided"} />
                {form.currentClassYear && <ReviewRow label="Year" value={form.currentClassYear} />}
                <ReviewRow label="Availability" value={form.availability || "Not provided"} />
                <ReviewRow label="LinkedIn" value={form.linkedinUrl || "Not provided"} />
              </div>

              {/* Resume section */}
              <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resume</p>
                <button onClick={() => { setStep(3); setError(""); }} className="text-[11px] font-bold text-[#0a66c2] hover:underline">Edit</button>
              </div>
              <div className="px-4 py-1 bg-white">
                <ReviewRow
                  label="Resume"
                  value={form.resumeText.length > 200 ? form.resumeText.slice(0, 200) + "…" : form.resumeText}
                />
                {form.coverLetter && (
                  <ReviewRow
                    label="Cover"
                    value={form.coverLetter.length > 150 ? form.coverLetter.slice(0, 150) + "…" : form.coverLetter}
                  />
                )}
              </div>
            </div>

            {/* Privacy note */}
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5">
              <span className="text-base shrink-0">🔒</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Your application is shared only with the recruiter for this role. Free to apply — no account required.
              </p>
            </div>

            <ErrorMsg msg={error} />

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-full bg-[#0a66c2] py-3.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 active:scale-[0.98] transition"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting your application…
                </span>
              ) : (
                "Submit application ✓"
              )}
            </button>
            <div className="flex items-center justify-between">
              <button onClick={goBack} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
                ← Back to edit
              </button>
              <p className="text-[11px] text-slate-400">Step 4 of 4 · Free to apply</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
