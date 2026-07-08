import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import FilterDropdown from "./FilterDropdown";
import { computeJobQuality } from "@/lib/jobQuality";
import PageTracker from "@/components/PageTracker";
import { apiUrl, readApiJson } from "@/lib/api";

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

        {/* ── Hero card ── */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          {/* Title row */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Find roles that fit your skills faster
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Browse fresh jobs across India — filtered, verified, and free to apply.
              </p>
            </div>
          </div>

          {/* Filter button + quick filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FilterDropdown
              hasFilters={hasFilters}
              defaults={{ q, niche, workMode, jobType, seniority, companyType, minSalary, noticePeriod, educationRequirement, postedAfterDays, freshersAllowed, verifiedCompany }}
            />
            <Link
              href={quickFilterLink(params, { postedAfterDays: "7" })}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${postedAfterDays === "7" ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"}`}
            >
              Fresh jobs this week
            </Link>
            <Link
              href={quickFilterLink(params, { freshersAllowed: freshersAllowed ? "" : "true" })}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${freshersAllowed ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"}`}
            >
              Freshers-friendly roles
            </Link>
            <Link
              href={quickFilterLink(params, { workMode: workMode === "remote" ? "" : "remote" })}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${workMode === "remote" ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"}`}
            >
              Remote opportunities
            </Link>
          </div>

          {/* Info strips */}
          <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
            {[
              { title: "Free to apply", desc: "No payment or subscription needed." },
              { title: "AI-scored listings", desc: "Every job has a quality score based on transparency." },
              { title: "Trust-first filters", desc: "Find freshers-friendly and verified-company roles." },
            ].map(({ title, desc }) => (
              <div key={title} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                <span className="text-xs font-bold text-slate-900">{title}</span>
                <p className="mt-0.5 text-[11px] text-slate-500">{desc}</p>
              </div>
            ))}
          </div>

          {/* Active filter chips + result count */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#0a66c2]/10 px-3 py-1 text-xs font-bold text-[#0a66c2]">
              {jobs.length} role{jobs.length === 1 ? "" : "s"} found
            </span>
            {activeChips.map(chip => (
              <span key={chip} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#0a66c2]">
                {chip}
              </span>
            ))}
            {hasFilters && (
              <Link
                href="/recruit/opportunities"
                className="rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-red-500 transition"
              >
                ✕ Clear filters
              </Link>
            )}
          </div>
        </div>

        {/* ── Job list ── */}
        <section className="space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl">🔍</div>
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
              const quality = computeJobQuality(job);
              return (
                <div key={job._id} className="group relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition-all hover:border-[#0a66c2]/30 hover:shadow-md">
                  <Link href={`/recruit/opportunities/${job._id}`} className="absolute inset-0 rounded-2xl z-0" aria-label={`View ${job.title}`} />

                  <div className="flex gap-3 sm:gap-4">
                    {/* Avatar */}
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-base font-black text-[#0a66c2]">
                      {(job.companyName || job.title).slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title + badges */}
                      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                        <h2 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition leading-snug">
                          {job.title}
                        </h2>
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

                      {/* Company · Location */}
                      <p className="mt-0.5 text-sm text-slate-500 truncate">
                        <span className="font-medium text-slate-700">{job.companyName || "Company"}</span>
                        {job.companyType ? ` · ${job.companyType}` : ""}
                        {" · "}{job.location || "India"}
                      </p>

                      {/* Meta */}
                      <p className="mt-0.5 text-xs text-slate-400 capitalize">
                        {job.workMode || "Flexible"} · {job.jobType || "Full-time"}
                        {job.niche ? ` · ${job.niche.split(",")[0].trim()}` : ""}
                      </p>

                      {/* Skills */}
                      {job.mustHaveSkills && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {job.mustHaveSkills.split(",").slice(0, 5).map(s => s.trim()).filter(Boolean).map(s => (
                            <span key={s} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">{s}</span>
                          ))}
                        </div>
                      )}

                      {/* Salary + experience row */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{formatSalary(job)}</span>
                        <span>{job.experienceMin ?? 0}{job.experienceMax ? `–${job.experienceMax}` : "+"} yrs</span>
                        {job.seniority && <span>{job.seniority}</span>}
                        {job.noticePeriod && <span>{job.noticePeriod} notice</span>}
                        {job.openings && job.openings > 1 && <span>{job.openings} openings</span>}
                        {job.createdAt && <span className="ml-auto text-slate-400">{timeAgo(job.createdAt)}</span>}
                      </div>

                      {/* Tags row */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#0a66c2]">Apply free</span>
                        {(job.salaryMin || job.salaryMax) && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">₹ Salary visible</span>
                        )}
                        {formatDeadline(job.applicationDeadline) && (
                          <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                            Apply by {formatDeadline(job.applicationDeadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
