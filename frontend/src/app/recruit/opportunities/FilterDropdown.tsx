"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const NICHES = [
  "AI, Data, Software & Product Tech",
  "Sales, Business Development & Revenue Roles",
  "Finance, Accounting, Banking & Fintech",
  "Healthcare, Pharma & Allied Medical Workforce",
  "Skilled Blue-Collar, Logistics & Industrial Workforce",
  "Creative, Marketing, Media & Design",
];
const WORK_MODES = ["remote", "hybrid", "onsite"];
const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const SENIORITY_LEVELS = ["Fresher", "Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP", "C-Level"];
const COMPANY_TYPES = ["Startup", "MNC", "Agency", "Product Company", "Consultancy", "Hospital", "Fintech", "Government", "NGO"];
const NOTICE_PERIODS = ["Immediate", "15 days", "30 days", "60 days", "90 days"];
const EDUCATION_LEVELS = ["10th / Diploma", "12th / Higher Secondary", "Bachelor's", "Master's", "MBA", "PhD", "Any"];
const POSTED_WITHIN = [
  { label: "Any time", value: "" },
  { label: "Last 24 hours", value: "1" },
  { label: "Last 3 days", value: "3" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
];

type Props = {
  hasFilters: boolean;
  defaults: {
    q: string; niche: string; workMode: string; jobType: string;
    seniority: string; companyType: string; minSalary: string;
    noticePeriod: string; educationRequirement: string;
    postedAfterDays: string; freshersAllowed: boolean; verifiedCompany: boolean;
  };
};

export default function FilterDropdown({ hasFilters, defaults }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(defaults.q);
  const [niche, setNiche] = useState(defaults.niche);
  const [workMode, setWorkMode] = useState(defaults.workMode);
  const [jobType, setJobType] = useState(defaults.jobType);
  const [seniority, setSeniority] = useState(defaults.seniority);
  const [companyType, setCompanyType] = useState(defaults.companyType);
  const [minSalary, setMinSalary] = useState(defaults.minSalary);
  const [noticePeriod, setNoticePeriod] = useState(defaults.noticePeriod);
  const [educationRequirement, setEducationRequirement] = useState(defaults.educationRequirement);
  const [postedAfterDays, setPostedAfterDays] = useState(defaults.postedAfterDays);
  const [freshersAllowed, setFreshersAllowed] = useState(defaults.freshersAllowed);
  const [verifiedCompany, setVerifiedCompany] = useState(defaults.verifiedCompany);
  const ref = useRef<HTMLDivElement>(null);

  // Sync local state when URL-driven defaults change (quick chips, back/forward)
  useEffect(() => {
    setQ(defaults.q);
    setNiche(defaults.niche);
    setWorkMode(defaults.workMode);
    setJobType(defaults.jobType);
    setSeniority(defaults.seniority);
    setCompanyType(defaults.companyType);
    setMinSalary(defaults.minSalary);
    setNoticePeriod(defaults.noticePeriod);
    setEducationRequirement(defaults.educationRequirement);
    setPostedAfterDays(defaults.postedAfterDays);
    setFreshersAllowed(defaults.freshersAllowed);
    setVerifiedCompany(defaults.verifiedCompany);
  }, [defaults.q, defaults.niche, defaults.workMode, defaults.jobType, defaults.seniority,
      defaults.companyType, defaults.minSalary, defaults.noticePeriod, defaults.educationRequirement,
      defaults.postedAfterDays, defaults.freshersAllowed, defaults.verifiedCompany]);

  // Count active filters for badge
  const activeCount = [
    q, niche !== "all" ? niche : "", workMode !== "all" ? workMode : "",
    jobType !== "all" ? jobType : "", seniority !== "all" ? seniority : "",
    companyType !== "all" ? companyType : "", minSalary,
    noticePeriod !== "all" ? noticePeriod : "",
    educationRequirement !== "all" ? educationRequirement : "",
    postedAfterDays, freshersAllowed ? "1" : "", verifiedCompany ? "1" : "",
  ].filter(Boolean).length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function buildUrl() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (niche && niche !== "all") params.set("niche", niche);
    if (workMode && workMode !== "all") params.set("workMode", workMode);
    if (jobType && jobType !== "all") params.set("jobType", jobType);
    if (seniority && seniority !== "all") params.set("seniority", seniority);
    if (companyType && companyType !== "all") params.set("companyType", companyType);
    if (minSalary) params.set("minSalary", minSalary);
    if (noticePeriod && noticePeriod !== "all") params.set("noticePeriod", noticePeriod);
    if (educationRequirement && educationRequirement !== "all") params.set("educationRequirement", educationRequirement);
    if (postedAfterDays) params.set("postedAfterDays", postedAfterDays);
    if (freshersAllowed) params.set("freshersAllowed", "true");
    if (verifiedCompany) params.set("verifiedCompany", "true");
    const qs = params.toString();
    return `/recruit/opportunities${qs ? `?${qs}` : ""}`;
  }

  function handleApply() {
    router.push(buildUrl());
    setOpen(false);
  }

  function handleClear() {
    setQ(""); setNiche("all"); setWorkMode("all"); setJobType("all");
    setSeniority("all"); setCompanyType("all"); setMinSalary("");
    setNoticePeriod("all"); setEducationRequirement("all");
    setPostedAfterDays(""); setFreshersAllowed(false); setVerifiedCompany(false);
    router.push("/recruit/opportunities");
    setOpen(false);
  }

  const selectCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition";
  const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400";

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
          open || hasFilters
            ? "border-[#0a66c2] bg-[#0a66c2] text-white shadow-sm"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${open || hasFilters ? "bg-white text-[#0a66c2]" : "bg-[#0a66c2] text-white"}`}>
            {activeCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[min(96vw,780px)] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <span className="text-sm font-bold text-slate-900">Filter jobs</span>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <button onClick={handleClear} className="text-xs font-semibold text-slate-500 hover:text-red-500 transition">
                  Clear all
                </button>
              )}
              <button onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition text-lg leading-none">×</button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Search */}
            <div>
              <label className={labelCls}>Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleApply()}
                  placeholder="Role, skill, company, city…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition"
                />
              </div>
            </div>

            {/* Niche */}
            <div>
              <label className={labelCls}>Niche / Industry</label>
              <select value={niche} onChange={e => setNiche(e.target.value)} className={selectCls}>
                <option value="all">All niches</option>
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Work mode</label>
                <select value={workMode} onChange={e => setWorkMode(e.target.value)} className={selectCls}>
                  <option value="all">Any</option>
                  {WORK_MODES.map(w => <option key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Job type</label>
                <select value={jobType} onChange={e => setJobType(e.target.value)} className={selectCls}>
                  <option value="all">Any</option>
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Seniority</label>
                <select value={seniority} onChange={e => setSeniority(e.target.value)} className={selectCls}>
                  <option value="all">Any</option>
                  {SENIORITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Company type</label>
                <select value={companyType} onChange={e => setCompanyType(e.target.value)} className={selectCls}>
                  <option value="all">Any</option>
                  {COMPANY_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Min salary (₹/yr)</label>
                <input
                  type="number"
                  value={minSalary}
                  onChange={e => setMinSalary(e.target.value)}
                  placeholder="e.g. 600000"
                  className={selectCls}
                />
              </div>
              <div>
                <label className={labelCls}>Notice period</label>
                <select value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} className={selectCls}>
                  <option value="all">Any</option>
                  {NOTICE_PERIODS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Education</label>
                <select value={educationRequirement} onChange={e => setEducationRequirement(e.target.value)} className={selectCls}>
                  <option value="all">Any</option>
                  {EDUCATION_LEVELS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Posted within</label>
                <select value={postedAfterDays} onChange={e => setPostedAfterDays(e.target.value)} className={selectCls}>
                  {POSTED_WITHIN.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Toggle chips */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFreshersAllowed(f => !f)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  freshersAllowed
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {freshersAllowed && <span>✓</span>} Freshers welcome
              </button>
              <button
                type="button"
                onClick={() => setVerifiedCompany(v => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  verifiedCompany
                    ? "border-green-400 bg-green-50 text-green-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {verifiedCompany && <span>✓</span>} Verified companies only
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
            <span className="text-xs text-slate-400">
              {activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active` : "No filters applied"}
            </span>
            <button
              onClick={handleApply}
              className="rounded-full bg-[#0a66c2] px-6 py-2 text-sm font-bold text-white hover:bg-[#004182] transition active:scale-95"
            >
              Show results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
