"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/trackEvent";
import { apiUrl, readApiJson } from "@/lib/api";

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

export default function ApplyForm({ jobId, jobTitle, companyName }: { jobId: string; jobTitle?: string; companyName?: string }) {
  const [form, setForm] = useState<Form>({
    name: "", email: "", phone: "", location: "",
    currentStatus: "", educationLevel: "", currentClassYear: "",
    availability: "", linkedinUrl: "", coverLetter: "", resumeText: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [savedProfileDetected, setSavedProfileDetected] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const email = localStorage.getItem("recruit_applicant_email");
      const name = localStorage.getItem("recruit_applicant_name");
      const phone = localStorage.getItem("recruit_applicant_phone");
      const resume = localStorage.getItem("recruit_resume_text");
      const location = localStorage.getItem("recruit_applicant_location");
      const currentStatus = localStorage.getItem("recruit_applicant_currentStatus");
      const educationLevel = localStorage.getItem("recruit_applicant_educationLevel");
      const availability = localStorage.getItem("recruit_applicant_availability");
      const linkedinUrl = localStorage.getItem("recruit_applicant_linkedin");
      setSavedProfileDetected(Boolean(email || name || phone || resume));
      setForm(prev => ({
        ...prev,
        email: email || prev.email,
        name: name || prev.name,
        phone: phone || prev.phone,
        resumeText: resume || prev.resumeText,
        location: location || prev.location,
        currentStatus: currentStatus || prev.currentStatus,
        educationLevel: educationLevel || prev.educationLevel,
        availability: availability || prev.availability,
        linkedinUrl: linkedinUrl || prev.linkedinUrl,
      }));
    } catch { /* ignore */ }
  }, []);

  function update<K extends keyof Form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const isStudent = form.currentStatus === "Student" || form.educationLevel === "Currently pursuing degree";

  const requiredFilled = [
    form.name.trim(),
    form.email.trim(),
    form.resumeText.trim(),
  ].filter(Boolean).length;

  const detailFilled = [
    form.location.trim(),
    form.currentStatus,
    form.educationLevel,
    form.availability,
  ].filter(Boolean).length;

  const totalFilled = requiredFilled + detailFilled;
  const totalFields = 7;

  async function apply() {
    if (!form.name.trim()) { setError("Please enter your full name."); return; }
    if (!form.email.trim()) { setError("Please enter your email so recruiters can contact you."); return; }
    if (!form.resumeText.trim()) { setError("Please paste your resume or work history."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit-public/jobs/${jobId}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "Plyndrox Jobs" }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Application failed. Please try again.");
      try {
        if (form.email) localStorage.setItem("recruit_applicant_email", form.email);
        if (form.name) localStorage.setItem("recruit_applicant_name", form.name);
        if (form.phone) localStorage.setItem("recruit_applicant_phone", form.phone);
        if (form.resumeText) localStorage.setItem("recruit_resume_text", form.resumeText);
        if (form.location) localStorage.setItem("recruit_applicant_location", form.location);
        if (form.currentStatus) localStorage.setItem("recruit_applicant_currentStatus", form.currentStatus);
        if (form.educationLevel) localStorage.setItem("recruit_applicant_educationLevel", form.educationLevel);
        if (form.availability) localStorage.setItem("recruit_applicant_availability", form.availability);
        if (form.linkedinUrl) localStorage.setItem("recruit_applicant_linkedin", form.linkedinUrl);
      } catch { /* ignore */ }
      trackEvent("application_submitted", { jobId });
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 sm:p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✅</div>
        <h3 className="font-bold text-lg text-slate-900">Application sent!</h3>
        <p className="mt-2 text-sm text-slate-600 max-w-xs mx-auto">
          The recruiter will review your profile and AI match score shortly.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/recruit/my-applications" className="rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition text-center">
            Track applications
          </Link>
          <Link href="/recruit/opportunities" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition text-center">
            Browse more jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[#0a66c2] to-[#004182] p-4 sm:p-5">
        <h2 className="text-base font-bold text-white">Apply now</h2>
        {(jobTitle || companyName) && (
          <p className="mt-0.5 text-xs text-blue-200 truncate">
            {jobTitle}{companyName ? ` at ${companyName}` : ""}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(totalFilled / totalFields) * 100}%` }} />
          </div>
          <span className="text-[11px] text-blue-100 font-semibold">{totalFilled}/{totalFields} filled</span>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {savedProfileDetected && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-[#0a66c2]">
            Saved details pre-filled from your last application. Review and submit.
          </div>
        )}

        <div className="space-y-3.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contact Info</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Full name *</label>
              <input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Your full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Email *</label>
              <input value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@email.com" type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</label>
              <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</label>
              <input value={form.location} onChange={e => update("location", e.target.value)} placeholder="e.g. Mumbai, Maharashtra"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 text-xs font-semibold text-[#0a66c2] hover:text-[#004182] transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
            {expanded ? "Hide background details" : "Add background details (recommended)"}
          </button>

          {expanded && (
            <div className="space-y-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Background Info</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Status</label>
                  <select value={form.currentStatus} onChange={e => update("currentStatus", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
                    <option value="">Select status…</option>
                    {CURRENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Education Level</label>
                  <select value={form.educationLevel} onChange={e => update("educationLevel", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
                    <option value="">Select level…</option>
                    {EDUCATION_LEVEL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {isStudent && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Year / Semester</label>
                    <select value={form.currentClassYear} onChange={e => update("currentClassYear", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
                      <option value="">Select year…</option>
                      {STUDENT_YEARS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Availability</label>
                  <select value={form.availability} onChange={e => update("availability", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
                    <option value="">Select availability…</option>
                    {AVAILABILITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={isStudent ? "sm:col-span-2" : ""}>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">LinkedIn Profile URL</label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition bg-white">
                    <svg width="13" height="13" fill="currentColor" className="text-[#0a66c2] shrink-0" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                    <input value={form.linkedinUrl} onChange={e => update("linkedinUrl", e.target.value)}
                      placeholder="linkedin.com/in/yourname"
                      className="flex-1 text-sm outline-none bg-transparent" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Cover Letter / Why you're interested</label>
                <textarea value={form.coverLetter} onChange={e => update("coverLetter", e.target.value)}
                  placeholder="Tell the recruiter why you're a great fit for this specific role…"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition resize-none bg-white" />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resume / Work history *</label>
            <Link href="/recruit/profile" className="text-[11px] text-[#0a66c2] hover:underline">Set up profile →</Link>
          </div>
          <textarea value={form.resumeText} onChange={e => update("resumeText", e.target.value)}
            placeholder="Paste your resume text, LinkedIn summary, or work history. Include skills, experience, education and achievements for the best AI match score…"
            rows={7}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition resize-none" />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <button onClick={apply} disabled={submitting}
          className="w-full rounded-full bg-[#0a66c2] px-5 py-3 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-[0.98]">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting…
            </span>
          ) : "Submit application"}
        </button>

        <p className="text-center text-xs text-slate-400">
          Applied before?{" "}
          <Link href="/recruit/my-applications" className="text-[#0a66c2] hover:underline">Track your applications</Link>
        </p>
        <p className="text-center text-[11px] text-slate-400">
          Free to apply. Your details are sent only to the recruiter for this role.
        </p>
      </div>
    </div>
  );
}
