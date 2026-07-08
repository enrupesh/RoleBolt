import Link from "next/link";
import { Suspense } from "react";
import RecruitHeader from "@/components/RecruitHeader";
import ClientSaveButton from "./SaveButton";
import FilterToggle from "./FilterToggle";
import RecentlyViewedJobs from "./RecentlyViewedJobs";
import ProfileNudge from "./ProfileNudge";
import { computeJobQuality } from "@/lib/jobQuality";
import RecommendedJobs from "./RecommendedJobs";
import SavedSearches from "./SavedSearches";
import PageTracker from "@/components/PageTracker";
import { apiUrl, readApiJson } from "@/lib/api";

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

type PageSearchParams = Record<string, string | string[] | undefined>;

type Job = {
  _id: string;
  title: string;
  niche?: string;
  companyName?: string;
  companyType?: string;
  jobType?: string;
  department?: string;
  seniority?: string;
  location?: string;
  workMode?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  experienceMin?: number;
  experienceMax?: number;
  educationRequirement?: string;
  noticePeriod?: string;
  freshersAllowed?: boolean;
  verifiedCompany?: boolean;
  candidateCount?: number;
  mustHaveSkills?: string;
  generatedJD?: string;
  createdAt?: string;
};

function paramValue(params: PageSearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatSalary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return "Salary not disclosed";
  const min = job.salaryMin ? job.salaryMin.toLocaleString("en-IN") : "0";
  const max = job.salaryMax ? job.salaryMax.toLocaleString("en-IN") : "";
  return `${job.salaryCurrency || "INR"} ${min}${max ? `–${max}` : "+"}`;
}

function buildQuery(params: PageSearchParams) {
  const query = new URLSearchParams();
  const keys = ["q", "niche", "workMode", "jobType", "seniority", "companyType", "minSalary", "noticePeriod", "educationRequirement", "postedAfterDays", "freshersAllowed", "verifiedCompany"];
  keys.forEach(key => {
    const value = paramValue(params, key);
    if (value && value !== "all") query.set(key, value);
  });
  return query;
}

async function loadJobs(params: PageSearchParams) {
  try {
    const query = buildQuery(params);
    const response = await fetch(apiUrl(`/recruit-public/jobs?${query.toString()}`), { cache: "no-store" });
    if (!response.ok) return [];
    const data = await readApiJson(response);
    return (data.jobs ?? []) as Job[];
  } catch {
    return [];
  }
}

function checkedLink(params: PageSearchParams, key: "freshersAllowed" | "verifiedCompany") {
  const query = buildQuery(params);
  if (paramValue(params, key) === "true") query.delete(key);
  else query.set(key, "true");
  const qs = query.toString();
  return `/recruit/opportunities${qs ? `?${qs}` : ""}`;
}

function quickFilterLink(params: PageSearchParams, updates: Record<string, string>) {
  const query = buildQuery(params);
  Object.entries(updates).forEach(([key, value]) => {
    if (value) query.set(key, value);
    else query.delete(key);
  });
  const qs = query.toString();
  return `/recruit/opportunities${qs ? `?${qs}` : ""}`;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return "Just now";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default async function RecruitOpportunitiesPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const params = await searchParams;
  const jobs = await loadJobs(params);
  const q = paramValue(params, "q");
  const niche = paramValue(params, "niche") || "all";
  const workMode = paramValue(params, "workMode") || "all";
  const jobType = paramValue(params, "jobType") || "all";
  const seniority = paramValue(params, "seniority") || "all";
  const companyType = paramValue(params, "companyType") || "all";
  const minSalary = paramValue(params, "minSalary");
  const noticePeriod = paramValue(params, "noticePeriod") || "all";
  const educationRequirement = paramValue(params, "educationRequirement") || "all";
  const postedAfterDays = paramValue(params, "postedAfterDays") || "";
  const freshersAllowed = paramValue(params, "freshersAllowed") === "true";
  const verifiedCompany = paramValue(params, "verifiedCompany") === "true";

  const hasFilters = q || niche !== "all" || workMode !== "all" || jobType !== "all" ||
    seniority !== "all" || companyType !== "all" || minSalary ||
    noticePeriod !== "all" || educationRequirement !== "all" || postedAfterDays ||
    freshersAllowed || verifiedCompany;

  const activeChips = [
    q ? `Search: ${q}` : "",
    niche !== "all" ? niche : "",
    workMode !== "all" ? `${workMode.charAt(0).toUpperCase()}${workMode.slice(1)} jobs` : "",
    jobType !== "all" ? jobType : "",
    seniority !== "all" ? seniority : "",
    companyType !== "all" ? companyType : "",
    minSalary ? `₹${Number(minSalary).toLocaleString("en-IN")}+` : "",
    noticePeriod !== "all" ? `${noticePeriod} notice` : "",
    educationRequirement !== "all" ? educationRequirement : "",
    postedAfterDays ? `Last ${postedAfterDays} day${postedAfterDays === "1" ? "" : "s"}` : "",
    freshersAllowed ? "Freshers ok" : "",
    verifiedCompany ? "Verified companies" : "",
  ].filter(Boolean);

  const filterPanel = (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Filters</h2>
        {hasFilters && (
          <Link href="/recruit/opportunities" className="text-xs font-semibold text-[#0a66c2] hover:underline">Clear all</Link>
        )}
      </div>
      <form className="p-4 space-y-4" action="/recruit/opportunities">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Search</label>
          <input name="q" defaultValue={q} placeholder="Role, skill, company, city…" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition" />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Niche</label>
          <select name="niche" defaultValue={niche} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
            <option value="all">All niches</option>
            {NICHES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Work mode</label>
            <select name="workMode" defaultValue={workMode} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
              <option value="all">All</option>
              {WORK_MODES.map(item => <option key={item} value={item} className="capitalize">{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Job type</label>
            <select name="jobType" defaultValue={jobType} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
              <option value="all">All</option>
              {JOB_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Seniority</label>
            <select name="seniority" defaultValue={seniority} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
              <option value="all">Any</option>
              {SENIORITY_LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</label>
            <select name="companyType" defaultValue={companyType} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
              <option value="all">Any</option>
              {COMPANY_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Min salary (₹/yr)</label>
          <input type="number" name="minSalary" defaultValue={minSalary} placeholder="e.g. 600000" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Notice period</label>
            <select name="noticePeriod" defaultValue={noticePeriod} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
              <option value="all">Any</option>
              {NOTICE_PERIODS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Education</label>
            <select name="educationRequirement" defaultValue={educationRequirement} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
              <option value="all">Any</option>
              {EDUCATION_LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Posted within</label>
          <select name="postedAfterDays" defaultValue={postedAfterDays} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
            {POSTED_WITHIN.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <button className="w-full rounded-lg bg-[#0a66c2] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#004182] active:scale-95 transition">
          Search jobs
        </button>

        <div className="grid grid-cols-2 gap-2">
          <Link href={checkedLink(params, "freshersAllowed")} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${freshersAllowed ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
            {freshersAllowed ? "✓" : ""} Freshers ok
          </Link>
          <Link href={checkedLink(params, "verifiedCompany")} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${verifiedCompany ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
            {verifiedCompany ? "✓" : ""} Verified only
          </Link>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageTracker event="opportunity_list_viewed" />
      <RecruitHeader />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0a66c2]">Free India-first job search</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Find roles that fit your skills faster</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Browse fresh jobs, save interesting roles, and apply with your saved profile in a few steps.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/recruit/profile" className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:inline-flex">
                Complete profile
              </Link>
              <FilterToggle hasFilters={!!hasFilters} />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link href={quickFilterLink(params, { postedAfterDays: "7" })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#0a66c2]/40 hover:text-[#0a66c2]">
              Fresh jobs this week
            </Link>
            <Link href={quickFilterLink(params, { freshersAllowed: "true" })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#0a66c2]/40 hover:text-[#0a66c2]">
              Freshers-friendly roles
            </Link>
            <Link href={quickFilterLink(params, { workMode: "remote" })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#0a66c2]/40 hover:text-[#0a66c2]">
              Remote opportunities
            </Link>
          </div>

          <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
              <span className="font-bold text-slate-900">Free to apply</span>
              <p className="mt-0.5">No payment or subscription needed.</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
              <span className="font-bold text-slate-900">Saved profile support</span>
              <p className="mt-0.5">Reuse your details across jobs.</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
              <span className="font-bold text-slate-900">Trust-first filters</span>
              <p className="mt-0.5">Find freshers-friendly and verified roles.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
              {jobs.length} role{jobs.length === 1 ? "" : "s"} found
            </span>
            {activeChips.map(chip => (
              <span key={chip} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0a66c2]">
                {chip}
              </span>
            ))}
            {hasFilters && (
              <Link href="/recruit/opportunities" className="rounded-full px-3 py-1 text-xs font-bold text-slate-500 underline-offset-2 hover:text-[#0a66c2] hover:underline">
                Clear filters
              </Link>
            )}
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6">
          <aside className="hidden lg:block h-fit sticky top-20">
            {filterPanel}
          </aside>

          <div id="filter-panel-mobile" className="lg:hidden mb-4 hidden">
            {filterPanel}
          </div>

          <section className="space-y-3">
            <ProfileNudge />
            <Suspense fallback={null}>
              <SavedSearches />
            </Suspense>
            <RecommendedJobs />
            <RecentlyViewedJobs />
            {jobs.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl">🔍</div>
                <h3 className="text-lg font-bold text-slate-900">No jobs match this search yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Try fewer filters, search a nearby city, or save your profile so you can apply quickly when new roles appear.
                </p>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href="/recruit/opportunities" className="rounded-full bg-[#0a66c2] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#004182]">
                    Clear all filters
                  </Link>
                  <Link href="/recruit/profile" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    Complete profile
                  </Link>
                </div>
              </div>
            ) : (
              jobs.map(job => {
                const quality = computeJobQuality(job);
                return (
                <div key={job._id} className="group relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition-all hover:border-[#0a66c2]/30 hover:shadow-md">
                  <Link href={`/recruit/opportunities/${job._id}`} className="absolute inset-0 rounded-2xl z-0" aria-label={`View ${job.title}`} />
                  <div className="flex gap-3 sm:gap-4">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-base font-black text-[#0a66c2]">
                      {(job.companyName || job.title).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                        <h2 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition leading-snug">{job.title}</h2>
                        <div className="flex flex-wrap gap-1">
                          {job.verifiedCompany && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">✓ Verified</span>
                          )}
                          {job.freshersAllowed && (
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">Freshers ok</span>
                          )}
                          {quality.tier === "high" && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${quality.color} ${quality.bg} ${quality.border}`}>★ High quality</span>
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500 truncate">
                        <span className="font-medium text-slate-700">{job.companyName || "Company"}</span>
                        {job.companyType ? ` · ${job.companyType}` : ""}
                        {" · "}{job.location || "India"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 capitalize">
                        {job.workMode || "Flexible"} · {job.jobType || "Full-time"}
                        {job.niche ? ` · ${job.niche.split(",")[0].trim()}` : ""}
                      </p>
                      {job.mustHaveSkills && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {job.mustHaveSkills.split(",").slice(0, 5).map(s => s.trim()).filter(Boolean).map(s => (
                            <span key={s} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">{s}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{formatSalary(job)}</span>
                        <span>{job.experienceMin ?? 0}{job.experienceMax ? `–${job.experienceMax}` : "+"} yrs</span>
                        {job.seniority && <span>{job.seniority}</span>}
                        {job.noticePeriod && <span>{job.noticePeriod} notice</span>}
                        {job.createdAt && <span className="ml-auto text-slate-400">{timeAgo(job.createdAt)}</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#0a66c2]">Apply free</span>
                        {(job.salaryMin || job.salaryMax) && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">₹ Salary visible</span>
                        )}
                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Save for later</span>
                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Track after applying</span>
                      </div>
                    </div>
                    <div className="relative z-10 shrink-0 self-start pt-0.5">
                      <ClientSaveButton
                        jobId={job._id}
                        title={job.title}
                        companyName={job.companyName}
                        location={job.location}
                        workMode={job.workMode}
                        jobType={job.jobType}
                        niche={job.niche}
                      />
                    </div>
                  </div>
                </div>
              ); })
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
