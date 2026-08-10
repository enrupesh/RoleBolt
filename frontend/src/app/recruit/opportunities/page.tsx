import type { Metadata } from "next";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import FilterDropdown from "./FilterDropdown";
import PageTracker from "@/components/PageTracker";
import JobAlertSubscribe from "./JobAlertSubscribe";
import PublicJobsEndMessage from "./PublicJobsEndMessage";
import { apiUrl, readApiJson } from "@/lib/api";
import { buildMetadata } from "@/lib/seo";

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
  openings?: number;
  applicationDeadline?: string;
};

function formatDeadline(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function paramValue(params: PageSearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function fmtNum(n: number, currency: string) {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return n.toLocaleString(locale);
}

function formatSalary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return "Salary not disclosed";
  const cur = job.salaryCurrency || "INR";
  const min = job.salaryMin ? fmtNum(job.salaryMin, cur) : "0";
  const max = job.salaryMax ? fmtNum(job.salaryMax, cur) : "";
  return `${cur} ${min}${max ? `–${max}` : "+"}`;
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

export async function generateMetadata({ searchParams }: { searchParams: Promise<PageSearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const hasQuery = buildQuery(params).size > 0;
  return buildMetadata({
    title: hasQuery ? "Filtered Job Search | Rolebolt" : "Find Jobs & AI-Matched Opportunities | Rolebolt",
    description:
      "Search open jobs by role, skill, location and work mode. Discover public opportunities and apply through Rolebolt's focused job-search experience.",
    path: "/recruit/opportunities",
    keywords: ["find jobs", "AI job matching", "open job opportunities", "remote jobs", "job search platform"],
    noIndex: hasQuery,
  });
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

function quickFilterLink(params: PageSearchParams, updates: Record<string, string>) {
  const query = buildQuery(params);
  Object.entries(updates).forEach(([key, value]) => {
    if (value) query.set(key, value);
    else query.delete(key);
  });
  const qs = query.toString();
  return `/recruit/opportunities${qs ? `?${qs}` : ""}`;
}

// Avatar color based on company name — deterministic, 6 palettes
const AVATAR_PALETTES = [
  "from-blue-50 to-blue-100 text-blue-700",
  "from-violet-50 to-violet-100 text-violet-700",
  "from-emerald-50 to-emerald-100 text-emerald-700",
  "from-amber-50 to-amber-100 text-amber-700",
  "from-rose-50 to-rose-100 text-rose-700",
  "from-indigo-50 to-indigo-100 text-indigo-700",
];
function avatarPalette(name?: string) {
  if (!name) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
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

  const hasFilters = !!(q || niche !== "all" || workMode !== "all" || jobType !== "all" ||
    seniority !== "all" || companyType !== "all" || minSalary ||
    noticePeriod !== "all" || educationRequirement !== "all" || postedAfterDays ||
    freshersAllowed || verifiedCompany);

  const activeChips = [
    q ? `Search: ${q}` : "",
    niche !== "all" ? niche.split(",")[0].trim() : "",
    workMode !== "all" ? `${workMode.charAt(0).toUpperCase()}${workMode.slice(1)}` : "",
    jobType !== "all" ? jobType : "",
    seniority !== "all" ? seniority : "",
    companyType !== "all" ? companyType : "",
    minSalary ? `₹${Number(minSalary).toLocaleString("en-IN")}+` : "",
    noticePeriod !== "all" ? `${noticePeriod} notice` : "",
    educationRequirement !== "all" ? educationRequirement : "",
    postedAfterDays ? `Last ${postedAfterDays}d` : "",
    freshersAllowed ? "Freshers ok" : "",
    verifiedCompany ? "Verified only" : "",
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <PageTracker event="opportunity_list_viewed" />
      <RecruitHeader />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Hero bar ── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Title */}
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-950">Find Jobs</h1>
              <p className="text-xs text-slate-400 mt-0.5">Browse verified roles — free to apply worldwide</p>
            </div>
            {/* Result count + clear */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{jobs.length} role{jobs.length === 1 ? "" : "s"}</span>
              {hasFilters && (
                <Link href="/recruit/opportunities" className="text-slate-400 hover:text-red-500 transition font-semibold">
                  · Clear filters
                </Link>
              )}
            </div>
          </div>

          {/* Filter row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FilterDropdown
              hasFilters={hasFilters}
              defaults={{ q, niche, workMode, jobType, seniority, companyType, minSalary, noticePeriod, educationRequirement, postedAfterDays, freshersAllowed, verifiedCompany }}
            />
            <div className="h-5 w-px bg-slate-200" />
            <Link
              href={quickFilterLink(params, { postedAfterDays: postedAfterDays === "7" ? "" : "7" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${postedAfterDays === "7" ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
            >
              This week
            </Link>
            <Link
              href={quickFilterLink(params, { freshersAllowed: freshersAllowed ? "" : "true" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${freshersAllowed ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
            >
              Freshers ok
            </Link>
            <Link
              href={quickFilterLink(params, { workMode: workMode === "remote" ? "" : "remote" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${workMode === "remote" ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
            >
              Remote
            </Link>
            {/* Active chips */}
            {activeChips.map(chip => (
              <span key={chip} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#0a66c2]">
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* ── Job Alert Subscribe ── */}
        <div className="mb-5">
          <JobAlertSubscribe />
        </div>

        {/* ── Job list ── */}
        <section className="space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#0a66c2]"><svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
              <h3 className="text-lg font-bold text-slate-900">No jobs match this search yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Try fewer filters or search a nearby city — new roles are added regularly.
              </p>
              <Link href="/recruit/opportunities" className="mt-5 inline-block rounded-full bg-[#0a66c2] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#004182]">
                Clear all filters
              </Link>
            </div>
          ) : (
            jobs.map(job => {
              const hasSalary = !!(job.salaryMin || job.salaryMax);
              const deadline = formatDeadline(job.applicationDeadline);
              const palette = avatarPalette(job.companyName || job.title);
              return (
                <div key={job._id} className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#0a66c2]/40 hover:shadow-md">
                  <Link href={`/recruit/opportunities/${job._id}`} className="absolute inset-0 rounded-2xl z-0" aria-label={`View ${job.title}`} />

                  <div className="flex gap-3">
                    {/* Avatar — color varies by company */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-black ${palette}`}>
                      {(job.companyName || job.title).slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title row + time + arrow */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                          <h2 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition leading-snug">
                            {job.title}
                          </h2>

                          {/* Verified = golden tick | Not verified = grey tag */}
                          {job.verifiedCompany ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700">
                              ✦ Verified
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                              Unverified
                            </span>
                          )}

                          {job.freshersAllowed && (
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Freshers</span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400">
                          {job.createdAt && <span>{timeAgo(job.createdAt)}</span>}
                          <svg className="opacity-0 group-hover:opacity-100 transition text-[#0a66c2]" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </div>
                      </div>

                      {/* Company · Location */}
                      <p className="mt-0.5 text-sm text-slate-500 truncate">
                        <span className="font-medium text-slate-700">{job.companyName || "Company"}</span>
                        {job.companyType ? ` · ${job.companyType}` : ""}
                        {" · "}{job.location || "Remote"}
                      </p>

                      {/* Work mode · Job type · Niche */}
                      <p className="mt-0.5 text-xs text-slate-400 capitalize">
                        {job.workMode || "Flexible"} · {job.jobType || "Full-time"}
                        {job.niche ? ` · ${job.niche.split(",")[0].trim()}` : ""}
                      </p>

                      {/* Skills — max 4, properly truncated */}
                      {job.mustHaveSkills && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {job.mustHaveSkills.split(",").slice(0, 4).map(s => s.trim()).filter(Boolean).map(s => (
                            <span key={s} className="max-w-[140px] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">{s}</span>
                          ))}
                        </div>
                      )}

                      {/* Bottom row: salary + meta + deadline */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {hasSalary ? (
                          <span className="font-semibold text-emerald-700">{formatSalary(job)}</span>
                        ) : (
                          <span className="text-slate-400">Salary not disclosed</span>
                        )}
                        <span className="text-slate-400">{job.experienceMin ?? 0}{job.experienceMax ? `–${job.experienceMax}` : "+"} yrs</span>
                        {job.seniority && <span className="text-slate-400">{job.seniority}</span>}
                        {job.openings && job.openings > 1 && <span className="text-slate-400">{job.openings} openings</span>}
                        {deadline && (
                          <span className="ml-auto rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 font-semibold text-rose-600">
                            By {deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {jobs.length > 0 && <PublicJobsEndMessage />}
        </section>
      </main>
    </div>
  );
}
