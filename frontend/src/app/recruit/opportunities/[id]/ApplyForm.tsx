"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/trackEvent";
import { apiUrl, readApiJson } from "@/lib/api";

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

type Step = 1 | 2 | 3 | 4; // 4 = review

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
const selectCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0a66c2] transition";
const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400";

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-0 px-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                s.n < step
                  ? "bg-[#0a66c2] text-white"
                  : s.n === step
                  ? "bg-[#0a66c2] text-white shadow-md shadow-blue-300"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.n < step ? (
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                s.n
              )}
            </div>
            <span
              className={`text-[10px] font-semibold ${
                s.n <= step ? "text-[#0a66c2]" : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition ${
                s.n < step ? "bg-[#0a66c2]" : "bg-slate-100"
              }`}
            />
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
      <span className="w-28 shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400 pt-0.5">{label}</span>
      <span className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap flex-1">{value}</span>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      <span>⚠️</span> {msg}
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
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    } catch { /* ignore */ }
  }, []);

  /* Auto-save draft to localStorage on each change */
  useEffect(() => {
    try {
      if (form.name) localStorage.setItem("recruit_applicant_name", form.name);
      if (form.email) localStorage.setItem("recruit_applicant_email", form.email);
      if (form.phone) localStorage.setItem("recruit_applicant_phone", form.phone);
      if (form.location) localStorage.setItem("recruit_applicant_location", form.location);
      if (form.currentStatus) localStorage.setItem("recruit_applicant_currentStatus", form.currentStatus);
      if (form.educationLevel) localStorage.setItem("recruit_applicant_educationLevel", form.educationLevel);
      if (form.availability) localStorage.setItem("recruit_applicant_availability", form.availability);
      if (form.linkedinUrl) localStorage.setItem("recruit_applicant_linkedin", form.linkedinUrl);
      if (form.resumeText) localStorage.setItem("recruit_resume_text", form.resumeText);
    } catch { /* ignore */ }
  }, [form]);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError("");
  }

  const isStudent =
    form.currentStatus === "Student" ||
    form.educationLevel === "Currently pursuing degree";

  /* ── Validation per step ── */
  function validateStep(s: Step): string {
    if (s === 1) {
      if (!form.name.trim()) return "Please enter your full name.";
      if (!form.email.trim()) return "Please enter your email address.";
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        return "Please enter a valid email address.";
    }
    if (s === 3) {
      if (!form.resumeText.trim())
        return "Please paste your resume or work history — recruiters need this to evaluate you.";
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
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit-public/jobs/${jobId}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "Rolebolt Jobs" }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Application failed. Please try again.");
      trackEvent("application_submitted", { jobId });
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
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</div>
        <h3 className="text-lg font-bold text-slate-900">Application sent!</h3>
        <p className="mt-2 text-sm text-slate-600 max-w-xs mx-auto">
          The recruiter will review your profile and AI match score shortly. We wish you the best!
        </p>
        <Link
          href="/recruit/opportunities"
          className="mt-6 inline-block rounded-full bg-[#0a66c2] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition"
        >
          Browse more jobs
        </Link>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a66c2] to-[#004182] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">Applying for</p>
        <h2 className="mt-0.5 text-base font-bold text-white truncate">
          {jobTitle || "This role"}{companyName ? ` · ${companyName}` : ""}
        </h2>
      </div>

      <div className="p-5 sm:p-6">
        <ProgressBar step={step} />

        {/* ── Step 1: Contact Info ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Contact information</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                This is how the recruiter will reach you.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className={labelCls}>Full name <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Rahul Sharma"
                  className={inputCls}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelCls}>Email address <span className="text-red-400">*</span></label>
                <input
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="rahul@email.com"
                  type="email"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Phone number</label>
                <input
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                  type="tel"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Current location</label>
                <input
                  value={form.location}
                  onChange={e => set("location", e.target.value)}
                  placeholder="e.g. Mumbai, Maharashtra"
                  className={inputCls}
                />
              </div>
            </div>

            <ErrorMsg msg={error} />

            <button onClick={goNext} className="w-full rounded-full bg-[#0a66c2] py-3 text-sm font-bold text-white hover:bg-[#004182] transition active:scale-[0.98]">
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
              <p className="mt-0.5 text-xs text-slate-500">
                Help the recruiter understand where you're coming from.
              </p>
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
                    onChange={e => set("linkedinUrl", e.target.value)}
                    placeholder="linkedin.com/in/yourname"
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            <ErrorMsg msg={error} />

            <div className="flex gap-2">
              <button onClick={goBack} className="flex-1 rounded-full border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition">
                ← Back
              </button>
              <button onClick={goNext} className="flex-[2] rounded-full bg-[#0a66c2] py-3 text-sm font-bold text-white hover:bg-[#004182] transition active:scale-[0.98]">
                Next — Resume & history →
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
                Paste your resume or a summary — this is used for the AI match score.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className={labelCls}>Resume / Work history <span className="text-red-400">*</span></label>
                <textarea
                  value={form.resumeText}
                  onChange={e => set("resumeText", e.target.value)}
                  placeholder="Paste your resume text, LinkedIn summary, or work history. Include skills, experience, education and achievements for the best AI match score…"
                  rows={8}
                  className={`${inputCls} resize-none leading-relaxed`}
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Tip: Copy-paste from your LinkedIn &quot;About&quot; + &quot;Experience&quot; sections for a quick fill.
                </p>
              </div>

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
            </div>

            <ErrorMsg msg={error} />

            <div className="flex gap-2">
              <button onClick={goBack} className="flex-1 rounded-full border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition">
                ← Back
              </button>
              <button onClick={goNext} className="flex-[2] rounded-full bg-[#0a66c2] py-3 text-sm font-bold text-white hover:bg-[#004182] transition active:scale-[0.98]">
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
              <p className="mt-0.5 text-xs text-slate-500">
                Everything looks right? Hit submit — or go back to edit.
              </p>
            </div>

            {/* Review sections */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-white">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact</p>
                  <button onClick={() => { setStep(1); setError(""); }} className="text-[11px] font-bold text-[#0a66c2] hover:underline">Edit</button>
                </div>
              </div>
              <div className="px-4 py-1">
                <ReviewRow label="Name" value={form.name || "—"} />
                <ReviewRow label="Email" value={form.email || "—"} />
                <ReviewRow label="Phone" value={form.phone || "Not provided"} />
                <ReviewRow label="Location" value={form.location || "Not provided"} />
              </div>

              <div className="px-4 py-2.5 bg-white">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Background</p>
                  <button onClick={() => { setStep(2); setError(""); }} className="text-[11px] font-bold text-[#0a66c2] hover:underline">Edit</button>
                </div>
              </div>
              <div className="px-4 py-1">
                <ReviewRow label="Status" value={form.currentStatus || "Not provided"} />
                <ReviewRow label="Education" value={form.educationLevel || "Not provided"} />
                {form.currentClassYear && <ReviewRow label="Year" value={form.currentClassYear} />}
                <ReviewRow label="Availability" value={form.availability || "Not provided"} />
                <ReviewRow label="LinkedIn" value={form.linkedinUrl || "Not provided"} />
              </div>

              <div className="px-4 py-2.5 bg-white">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resume</p>
                  <button onClick={() => { setStep(3); setError(""); }} className="text-[11px] font-bold text-[#0a66c2] hover:underline">Edit</button>
                </div>
              </div>
              <div className="px-4 py-1">
                <ReviewRow
                  label="Resume"
                  value={form.resumeText.length > 200 ? form.resumeText.slice(0, 200) + "…" : form.resumeText}
                />
                {form.coverLetter && (
                  <ReviewRow
                    label="Cover letter"
                    value={form.coverLetter.length > 150 ? form.coverLetter.slice(0, 150) + "…" : form.coverLetter}
                  />
                )}
              </div>
            </div>

            <ErrorMsg msg={error} />

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-full bg-[#0a66c2] py-3.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-[0.98]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </span>
              ) : "Submit application ✓"}
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
  );
}
