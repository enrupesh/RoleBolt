"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { RecruitGuard } from "@/components/RecruitGuard";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import Link from "next/link";
import { computeJobQuality } from "@/lib/jobQuality";
import { apiUrl, readApiJson } from "@/lib/api";

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const STEPS = ["Role Basics", "Skills & Scope", "Compensation", "Review & Generate"];
const SENIORITY_OPTIONS = ["Intern", "Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP"];
const NICHES = [
  "AI, Data, Software & Product Tech",
  "Sales, Business Development & Revenue Roles",
  "Finance, Accounting, Banking & Fintech",
  "Healthcare, Pharma & Allied Medical Workforce",
  "Skilled Blue-Collar, Logistics & Industrial Workforce",
  "Creative, Marketing, Media & Design",
];
const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const COMPANY_TYPES = ["Startup", "MNC", "Agency", "Hospital", "Fintech", "Manufacturing", "Recruitment Firm", "Other"];
const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

type FormData = {
  title: string;
  niche: string;
  companyName: string;
  companyType: string;
  jobType: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  responsibilities: string;
  mustHaveSkills: string;
  niceToHaveSkills: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  experienceMin: string;
  experienceMax: string;
  educationRequirement: string;
  noticePeriod: string;
  freshersAllowed: boolean;
  verifiedCompany: boolean;
  publicVisibility: boolean;
};

const DEFAULT: FormData = {
  title: "", niche: NICHES[0], companyName: "", companyType: "Startup", jobType: "Full-time",
  department: "", seniority: "Mid-level", location: "",
  workMode: "remote", responsibilities: "", mustHaveSkills: "",
  niceToHaveSkills: "", salaryMin: "", salaryMax: "", salaryCurrency: "INR",
  experienceMin: "", experienceMax: "", educationRequirement: "", noticePeriod: "",
  freshersAllowed: false, verifiedCompany: false, publicVisibility: true,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400">{children}</span>;
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500/50 focus:bg-gray-50 focus:ring-1 focus:ring-indigo-500/30"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500/50 focus:bg-gray-50 focus:ring-1 focus:ring-indigo-500/30 resize-none"
    />
  );
}

function NewJobContent() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<{ id: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) setToken(await u.getIdToken());
      else router.push("/login");
    });
    return () => unsub();
  }, [router]);

  function update(key: keyof FormData) {
    return (val: string) => setForm(prev => ({ ...prev, [key]: val }));
  }

  function canProceed() {
    if (step === 0) return form.title.trim().length > 0 && form.location.trim().length > 0;
    if (step === 1) return form.responsibilities.trim().length > 10 && form.mustHaveSkills.trim().length > 5;
    return true;
  }

  async function handleSubmit() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/recruit/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
          salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to create job.");
      setCreatedJob({ id: data.job._id, title: form.title });
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  if (createdJob) {
    const publicUrl = `//recruit/opportunities/${createdJob.id}`;
    const whatsappMsg = encodeURIComponent(`We're hiring! Check out this job: ${createdJob.title}\n${publicUrl}`);

    function copyLink() {
      navigator.clipboard.writeText(publicUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }

    return (
      <div className="min-h-screen bg-white text-[#1d2226] flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/15 border border-emerald-500/25 mx-auto mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Job Posted!</h1>
          <p className="text-gray-500 text-sm mb-8">
            <span className="text-white font-semibold">{createdJob.title}</span> is live. Share the link to start getting applicants.
          </p>

          <div className="rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-left mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Public Job Link</p>
            <p className="text-sm text-gray-600 break-all">{publicUrl}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={copyLink}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition border ${
                copied
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                  : "bg-gray-50 text-white border-white/[0.1] hover:bg-white/[0.1]"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <a
              href={`https://wa.me/?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/25 hover:bg-[#25d366]/25 transition"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share on WhatsApp
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={`/recruit/jobs/${createdJob.id}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-3 text-sm font-bold text-white hover:bg-indigo-400 transition"
            >
              View Pipeline & Candidates
            </Link>
            <Link
              href="/recruit/dashboard"
              className="text-xs text-gray-400 hover:text-gray-500 transition py-2"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1d2226]">
      

      <header className="relative z-10 border-b border-white/[0.07] bg-gray-100 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link href="/recruit/dashboard" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
            <ChevronLeftIcon /> Dashboard
          </Link>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-gray-500 font-medium">New Job Posting</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/8 px-3 py-1 text-[11px] font-semibold text-indigo-300 mb-4">
            <SparkIcon /> AI Job Description Generator
          </div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Create a New Job Posting</h1>
          <p className="mt-2 text-sm text-gray-400">Answer a few questions. The AI generates a full JD and scoring rubric automatically.</p>
        </div>

        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  i < step ? "bg-indigo-500 text-white cursor-pointer"
                  : i === step ? "border-2 border-indigo-500 text-indigo-400"
                  : "border border-gray-200 text-gray-400"
                }`}
              >
                {i < step ? <CheckIcon /> : i + 1}
              </button>
              <span className={`hidden text-xs sm:block truncate ${i === step ? "text-white font-medium" : "text-gray-400"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-indigo-500/40" : "bg-gray-50"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-white mb-6">Role Basics</h2>
              <div>
                <FieldLabel>Job Title *</FieldLabel>
                <Input value={form.title} onChange={update("title")} placeholder="e.g. Senior Frontend Engineer" />
              </div>
              <div>
                <FieldLabel>Niche *</FieldLabel>
                <select
                  value={form.niche}
                  onChange={e => update("niche")(e.target.value)}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                >
                  {NICHES.map(n => <option key={n} value={n} className="bg-gray-50">{n}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Company Name</FieldLabel>
                  <Input value={form.companyName} onChange={update("companyName")} placeholder="e.g. Plyndrox" />
                </div>
                <div>
                  <FieldLabel>Company Type</FieldLabel>
                  <select
                    value={form.companyType}
                    onChange={e => update("companyType")(e.target.value)}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                  >
                    {COMPANY_TYPES.map(t => <option key={t} value={t} className="bg-gray-50">{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <FieldLabel>Department</FieldLabel>
                <Input value={form.department} onChange={update("department")} placeholder="e.g. Engineering, Marketing, Sales" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Seniority Level</FieldLabel>
                  <select
                    value={form.seniority}
                    onChange={e => update("seniority")(e.target.value)}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                  >
                    {SENIORITY_OPTIONS.map(s => <option key={s} value={s} className="bg-gray-50">{s}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Job Type</FieldLabel>
                  <select
                    value={form.jobType}
                    onChange={e => update("jobType")(e.target.value)}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                  >
                    {JOB_TYPES.map(t => <option key={t} value={t} className="bg-gray-50">{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Work Mode</FieldLabel>
                  <div className="flex gap-2">
                    {WORK_MODES.map(m => (
                      <button
                        key={m.value}
                        onClick={() => update("workMode")(m.value)}
                        className={`flex-1 rounded-2xl border py-3 text-xs font-semibold transition ${
                          form.workMode === m.value
                            ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300"
                            : "border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <FieldLabel>Location *</FieldLabel>
                <Input value={form.location} onChange={update("location")} placeholder="e.g. Bangalore, India or Anywhere" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Min Experience</FieldLabel>
                  <Input type="number" value={form.experienceMin} onChange={update("experienceMin")} placeholder="0" />
                </div>
                <div>
                  <FieldLabel>Max Experience</FieldLabel>
                  <Input type="number" value={form.experienceMax} onChange={update("experienceMax")} placeholder="5" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-white mb-6">Skills & Responsibilities</h2>
              <div>
                <FieldLabel>Key Responsibilities * <span className="text-gray-400 normal-case font-normal">(what they'll actually do)</span></FieldLabel>
                <Textarea
                  rows={5}
                  value={form.responsibilities}
                  onChange={update("responsibilities")}
                  placeholder="e.g. Lead architecture decisions for our React frontend, mentor junior developers, collaborate with design and product to ship new features bi-weekly..."
                />
              </div>
              <div>
                <FieldLabel>Must-Have Skills * <span className="text-gray-400 normal-case font-normal">(non-negotiable)</span></FieldLabel>
                <Textarea
                  rows={3}
                  value={form.mustHaveSkills}
                  onChange={update("mustHaveSkills")}
                  placeholder="e.g. 4+ years React, TypeScript, REST API experience, strong communication skills..."
                />
              </div>
              <div>
                <FieldLabel>Nice-to-Have Skills <span className="text-gray-400 normal-case font-normal">(preferred but not required)</span></FieldLabel>
                <Textarea
                  rows={3}
                  value={form.niceToHaveSkills}
                  onChange={update("niceToHaveSkills")}
                  placeholder="e.g. Next.js experience, prior startup experience, familiarity with Figma..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Education Requirement</FieldLabel>
                  <Input value={form.educationRequirement} onChange={update("educationRequirement")} placeholder="e.g. Any graduate, B.Tech preferred" />
                </div>
                <div>
                  <FieldLabel>Notice Period</FieldLabel>
                  <Input value={form.noticePeriod} onChange={update("noticePeriod")} placeholder="e.g. Immediate to 30 days" />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  ["freshersAllowed", "Freshers allowed"],
                  ["publicVisibility", "Show on public job board"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key as keyof FormData] }))}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      form[key as keyof FormData] ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300" : "border-white/[0.08] text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">
                ✓ <span className="text-gray-400">Verified company badge</span> — automatically added when your company is verified.{" "}
                <a href="/recruit/company-profile" className="text-indigo-400 hover:underline">Request verification →</a>
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-white mb-2">Compensation</h2>
              <p className="text-xs text-gray-400 mb-6">Adding a salary range helps attract better-fit candidates and reduces time wasted on mismatched expectations. You can skip this.</p>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {CURRENCIES.map(c => (
                    <button
                      key={c}
                      onClick={() => update("salaryCurrency")(c)}
                      className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                        form.salaryCurrency === c
                          ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300"
                          : "border-white/[0.08] text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Minimum (per year)</FieldLabel>
                  <Input type="number" value={form.salaryMin} onChange={update("salaryMin")} placeholder="e.g. 800000" />
                </div>
                <div>
                  <FieldLabel>Maximum (per year)</FieldLabel>
                  <Input type="number" value={form.salaryMax} onChange={update("salaryMax")} placeholder="e.g. 1400000" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs text-gray-400">
                  Salary information is used only by the AI to write better job descriptions. It is not shown publicly unless you paste the generated JD on a job board.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-white mb-6">Review & Generate</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Role", `${form.seniority} ${form.title}`],
                  ["Niche", form.niche],
                  ["Company", form.companyName || "—"],
                  ["Job Type", form.jobType],
                  ["Department", form.department || "—"],
                  ["Work Mode", form.workMode],
                  ["Location", form.location],
                  ["Salary", form.salaryMin && form.salaryMax ? `${form.salaryCurrency} ${Number(form.salaryMin).toLocaleString()} – ${Number(form.salaryMax).toLocaleString()}` : "Not disclosed"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{k}</p>
                    <p className="mt-1 text-sm text-white">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Must-Have Skills</p>
                <p className="text-sm text-gray-600 leading-6">{form.mustHaveSkills}</p>
              </div>

              {(() => {
                const q = computeJobQuality({
                  salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
                  salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
                  verifiedCompany: form.verifiedCompany,
                  mustHaveSkills: form.mustHaveSkills,
                  workMode: form.workMode,
                  freshersAllowed: form.freshersAllowed,
                  experienceMin: form.experienceMin ? Number(form.experienceMin) : null,
                  companyName: form.companyName,
                });
                const pct = q.score;
                const ringColor = q.tier === "high" ? "#22c55e" : q.tier === "standard" ? "#818cf8" : "#6b7280";
                return (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Listing quality preview</p>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                        <svg width="56" height="56" viewBox="0 0 56 56" className="absolute inset-0">
                          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                          <circle cx="28" cy="28" r="22" fill="none" stroke={ringColor} strokeWidth="5"
                            strokeDasharray={`${(pct / 100) * 138.2} 138.2`} strokeLinecap="round" transform="rotate(-90 28 28)" />
                        </svg>
                        <span className="text-sm font-black text-white">{pct}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{q.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Based on what you've filled in so far</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {q.signals.filter(s => s.label !== "Full job description" && s.label !== "Verified company").map(s => (
                        <div key={s.label} className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold ${s.present ? "text-green-400" : "text-gray-400"}`}>{s.present ? "✓" : "–"}</span>
                          <span className={`text-[11px] ${s.present ? "text-gray-600" : "text-gray-400"}`}>{s.label}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-400">✦</span>
                        <span className="text-[11px] text-indigo-400">Full JD — AI will generate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400">✦</span>
                        <span className="text-[11px] text-gray-400">Verified company — by Plyndrox</span>
                      </div>
                    </div>
                    {q.tier !== "high" && (
                      <p className="mt-3 text-[11px] text-gray-400">
                        {!form.salaryMin && !form.salaryMax && "Adding a salary range +20 pts · "}
                        {!form.mustHaveSkills.trim() && "Skills listed +15 pts · "}
                        {!form.companyName.trim() && "Company name +5 pts"}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
                <div className="flex items-center gap-2 text-indigo-300 mb-2">
                  <SparkIcon />
                  <span className="text-xs font-semibold">What the AI will generate</span>
                </div>
                <ul className="space-y-1 text-xs text-gray-500">
                  <li>✦ Full job description (400–600 words, bias-reduced)</li>
                  <li>✦ 4–6 criterion scoring rubric with descriptions</li>
                  <li>✦ Rubric automatically used to score every future candidate</li>
                </ul>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : router.push("/recruit/dashboard")}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm text-gray-500 transition hover:text-white"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="rounded-2xl bg-indigo-500 px-7 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl bg-indigo-500 px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating JD...
                </>
              ) : (
                <><SparkIcon /> Generate Job Posting</>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function NewJobPage() {
  return <RecruitGuard requiredRole="creator"><NewJobContent /></RecruitGuard>;
}
