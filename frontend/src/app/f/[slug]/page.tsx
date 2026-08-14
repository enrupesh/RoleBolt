"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";

type QuestionType = "short" | "paragraph" | "number" | "email" | "phone" | "dropdown" | "multiple_choice" | "yes_no" | "file";

type Question = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  placeholder: string;
};

type FormData = {
  _id: string;
  title: string;
  description: string;
  jobDetails?: {
    companyName?: string;
    jobType?: string;
    department?: string;
    seniority?: string;
    location?: string;
    workMode?: "remote" | "onsite" | "hybrid";
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency?: string;
    experienceMin?: number;
    experienceMax?: number;
    openings?: number;
    applicationDeadline?: string;
  };
  slug: string;
  questions: Question[];
};

function QuestionField({ q, value, onChange, onFileChange, fileValue }: {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  onFileChange?: (f: File | null) => void;
  fileValue?: File | null;
}) {
  const base = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300 transition placeholder:text-slate-400";

  if (q.type === "short" || q.type === "email" || q.type === "phone") {
    return (
      <input
        type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={q.placeholder || undefined}
        className={base}
      />
    );
  }

  if (q.type === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={q.placeholder || undefined}
        className={base}
      />
    );
  }

  if (q.type === "paragraph") {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={q.placeholder || undefined}
        rows={4}
        className={`${base} resize-none`}
      />
    );
  }

  if (q.type === "dropdown") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={base}>
        <option value="">Select an option…</option>
        {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  if (q.type === "multiple_choice") {
    return (
      <div className="space-y-2">
        {q.options.map(opt => (
          <label key={opt} className="flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:border-violet-300 hover:bg-violet-50 transition">
            <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition ${value === opt ? "border-violet-500 bg-violet-500" : "border-slate-300"}`}>
              {value === opt && <div className="h-full w-full rounded-full flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-white" /></div>}
            </div>
            <span className="text-sm text-slate-800">{opt}</span>
            <input type="radio" name={q.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="sr-only" />
          </label>
        ))}
      </div>
    );
  }

  if (q.type === "yes_no") {
    return (
      <div className="flex gap-3">
        {["Yes", "No"].map(opt => (
          <label key={opt} className={`flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 py-3 text-sm font-semibold transition ${value === opt ? (opt === "Yes" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-rose-400 bg-rose-50 text-rose-700") : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"}`}>
            <input type="radio" name={q.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="sr-only" />
            {opt === "Yes" ? "✓" : "✕"} {opt}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === "file") {
    return (
      <div>
        <label className={`flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed py-6 transition ${fileValue ? "border-violet-400 bg-violet-50" : "border-slate-300 bg-slate-50 hover:border-violet-300 hover:bg-violet-50"}`}>
          <svg width="20" height="20" fill="none" stroke={fileValue ? "#7c3aed" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {fileValue ? (
            <span className="text-sm font-semibold text-violet-700">{fileValue.name}</span>
          ) : (
            <>
              <span className="text-sm font-semibold text-slate-600">Click to upload resume</span>
              <span className="text-xs text-slate-400">PDF, DOCX, or TXT — max 5MB</span>
            </>
          )}
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            onChange={e => onFileChange?.(e.target.files?.[0] || null)}
          />
        </label>
        {fileValue && (
          <button onClick={() => onFileChange?.(null)} className="mt-2 text-xs text-rose-500 hover:text-rose-700 transition">
            ✕ Remove file
          </button>
        )}
      </div>
    );
  }

  return null;
}

export default function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");

  type ResumeParseState = { parsing: boolean; text: string; error: string; mode: "preview" | "edit"; fileName: string };
  const [resumeParseState, setResumeParseState] = useState<Record<string, ResumeParseState>>({});

  useEffect(() => {
    fetch(apiUrl(`/recruit-public/forms/${slug}`))
      .then(r => readApiJson(r))
      .then(d => {
        if (d.form) setForm(d.form);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  function updateResume(qid: string, patch: Partial<ResumeParseState>) {
    const defaults: ResumeParseState = { parsing: false, text: "", error: "", mode: "preview", fileName: "" };
    setResumeParseState(prev => ({
      ...prev,
      [qid]: { ...defaults, ...(prev[qid] ?? defaults), ...patch },
    }));
  }

  async function handleFileChange(qid: string, file: File | null) {
    setFiles(prev => ({ ...prev, [qid]: file }));
    if (!file) {
      updateResume(qid, { text: "", error: "", mode: "preview", fileName: "", parsing: false });
      return;
    }
    updateResume(qid, { parsing: true, error: "", fileName: file.name, text: "", mode: "preview" });
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch(apiUrl("/recruit-public/parse-resume"), { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse resume.");
      updateResume(qid, { parsing: false, text: data.text || "", mode: "preview" });
    } catch (e: unknown) {
      updateResume(qid, {
        parsing: false,
        error: e instanceof Error ? e.message : "Failed to read file. Try a different format.",
      });
    }
  }

  function validate(): boolean {
    if (!form) return false;
    const errs: Record<string, string> = {};
    for (const q of form.questions) {
      if (!q.required) continue;
      if (q.type === "file") {
        if (!files[q.id]) errs[q.id] = "This field is required.";
      } else {
        if (!answers[q.id]?.trim()) errs[q.id] = "This field is required.";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    // Block submission if any resume is still being parsed
    const anyParsing = form.questions.filter(q => q.type === "file").some(q => resumeParseState[q.id]?.parsing);
    if (anyParsing) {
      setGlobalError("Please wait for the resume to finish processing.");
      return;
    }

    if (!validate()) return;

    setSubmitting(true);
    setGlobalError("");

    try {
      const fd = new FormData();

      // Build answers array
      const answersArr = form.questions
        .filter(q => q.type !== "file")
        .map(q => ({
          questionId: q.id,
          label: q.label,
          value: answers[q.id] || "",
        }));
      fd.append("answers", JSON.stringify(answersArr));

      // Attach first file found (resume)
      const fileQ = form.questions.find(q => q.type === "file");
      if (fileQ && files[fileQ.id]) {
        fd.append("resume", files[fileQ.id]!);
      }

      // Send the extracted (and possibly edited) resume text so the backend
      // uses the reviewed version instead of re-parsing the file.
      const editedText = fileQ ? resumeParseState[fileQ.id]?.text?.trim() : "";
      if (editedText) {
        fd.append("resumeText", editedText);
      }

      const res = await fetch(apiUrl(`/recruit-public/forms/${slug}/submit`), {
        method: "POST",
        body: fd,
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.message || data.error || "Submission failed.");
      setSubmitted(true);
    } catch (err: any) {
      setGlobalError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 animate-[rb-fade-in_0.3s_ease_both]">
        <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
          {/* Header bar skeleton */}
          <div className="mb-8 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg rb-skeleton" />
            <div className="h-4 w-20 rounded-full rb-skeleton" />
          </div>
          {/* Form card skeleton */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            {/* Title + description */}
            <div className="space-y-2 pb-4 border-b border-slate-100">
              <div className="h-6 w-3/4 rounded-lg rb-skeleton" />
              <div className="h-3.5 w-full rounded-full rb-skeleton" />
              <div className="h-3.5 w-4/5 rounded-full rb-skeleton" />
            </div>
            {/* Question skeletons */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3.5 w-2/5 rounded-full rb-skeleton" />
                <div className="h-11 w-full rounded-xl rb-skeleton" />
              </div>
            ))}
            {/* Submit button skeleton */}
            <div className="h-11 w-full rounded-xl rb-skeleton mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mx-auto">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Form not found</h1>
        <p className="mt-2 text-sm text-slate-500">This form may have been closed or removed.</p>
        <Link href="/" className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition">
          Go to Rolebolt →
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-sm">
          <div className="flex h-20 w-20 mx-auto mb-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Application submitted!</h1>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            Your response has been recorded. The recruiter will review it shortly. Good luck! 🤞
          </p>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">You applied to</p>
            <p className="text-sm font-bold text-slate-900">{form?.title}</p>
          </div>
          <Link
            href={`/f/${slug}/status`}
            className="mt-4 inline-block text-sm font-semibold text-violet-600 hover:text-violet-800 hover:underline"
          >
            Check your application status →
          </Link>
          <Link href="/" className="mt-6 inline-block text-xs text-slate-400 hover:text-slate-600 transition">
            Powered by Rolebolt <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="inline -mt-0.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="mx-auto max-w-xl">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <img src="/rolebolt-icon.png" alt="Rolebolt" className="h-7 w-7 rounded-lg object-cover" />
            <span className="text-sm font-bold text-slate-700">Rolebolt</span>
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-xl px-4 py-8 pb-20">
        {/* Form header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900">{form!.title}</h1>
          {form!.description && (
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{form!.description}</p>
          )}
          {form!.jobDetails && Object.values(form!.jobDetails).some(Boolean) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                form!.jobDetails.companyName,
                form!.jobDetails.location,
                form!.jobDetails.workMode && ({ remote: "Remote", hybrid: "Hybrid", onsite: "On-site" } as const)[form!.jobDetails.workMode],
                form!.jobDetails.jobType,
                form!.jobDetails.seniority,
                form!.jobDetails.department,
                form!.jobDetails.experienceMin !== undefined && `${form!.jobDetails.experienceMin}${form!.jobDetails.experienceMax !== undefined ? `–${form!.jobDetails.experienceMax}` : "+"} years`,
                form!.jobDetails.openings !== undefined && `${form!.jobDetails.openings} opening${form!.jobDetails.openings === 1 ? "" : "s"}`,
                (form!.jobDetails.salaryMin !== undefined || form!.jobDetails.salaryMax !== undefined) &&
                  `${form!.jobDetails.salaryCurrency || ""} ${form!.jobDetails.salaryMin ?? ""}${form!.jobDetails.salaryMax !== undefined ? `–${form!.jobDetails.salaryMax}` : "+"}`,
              ].filter(Boolean).map((detail, index) => (
                <span key={index} className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700">{detail}</span>
              ))}
            </div>
          )}
        </div>

        {globalError && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {form!.questions.map(q => {
            const rs = q.type === "file" ? resumeParseState[q.id] : undefined;
            return (
              <div key={q.id}>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  {q.label}
                  {q.required && <span className="ml-1 text-rose-500">*</span>}
                </label>
                <QuestionField
                  q={q}
                  value={answers[q.id] || ""}
                  onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                  onFileChange={f => handleFileChange(q.id, f)}
                  fileValue={files[q.id]}
                />
                {errors[q.id] && (
                  <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                    {errors[q.id]}
                  </p>
                )}

                {/* Resume extraction preview / edit — only for file questions */}
                {q.type === "file" && rs?.parsing && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                    <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Extracting text from your resume…
                  </div>
                )}

                {q.type === "file" && rs?.error && !rs.parsing && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                    {rs.error}
                  </div>
                )}

                {q.type === "file" && rs?.text && !rs.parsing && rs.mode === "preview" && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Extracted text preview</p>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">
                      {rs.text.slice(0, 300)}{rs.text.length > 300 ? "…" : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => updateResume(q.id, { mode: "edit" })}
                      className="mt-2 text-[11px] font-bold text-violet-600 hover:underline"
                    >
                      Edit extracted text →
                    </button>
                  </div>
                )}

                {q.type === "file" && rs?.text && !rs.parsing && rs.mode === "edit" && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Resume text — review and edit before submitting
                    </p>
                    <textarea
                      value={rs.text}
                      onChange={e => updateResume(q.id, { text: e.target.value })}
                      rows={8}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300 transition resize-none leading-relaxed"
                      placeholder="Your extracted resume text…"
                    />
                    <button
                      type="button"
                      onClick={() => updateResume(q.id, { mode: "preview" })}
                      className="text-[11px] font-bold text-violet-600 hover:underline"
                    >
                      ← Back to preview
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 disabled:opacity-60 transition active:scale-95"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Submitting…
              </span>
            ) : "Submit Application →"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="inline-flex items-center gap-1 font-semibold text-violet-500 hover:text-violet-700 transition">Rolebolt <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></Link>
        </p>
      </main>
    </div>
  );
}
