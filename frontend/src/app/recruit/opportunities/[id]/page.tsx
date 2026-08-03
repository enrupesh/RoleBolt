import type { Metadata } from "next";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import ShareJobButton from "./ShareJobButton";
import CopyJobButton from "./CopyJobButton";
import ReportJobButton from "./ReportJobButton";
import CompanySection from "./CompanySection";
import QualityBreakdown from "./QualityBreakdown";
import StickyActions from "./StickyActions";
import SeekerJobActions from "@/components/SeekerJobActions";
import { computeJobQuality } from "@/lib/jobQuality";
import PageTracker from "@/components/PageTracker";
import MatchScoreSection from "./MatchScoreSection";
import { apiUrl, readApiJson } from "@/lib/api";
import { buildMetadata, jobPostingJsonLd, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { formatJobDescription } from "@/lib/jobDescription";
import JDRenderer from "./JDRenderer";

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
  generatedJD?: string;
  mustHaveSkills?: string;
  niceToHaveSkills?: string;
  openings?: number;
  applicationDeadline?: string;
  createdAt?: string;
  perks?: string;
  languageRequirement?: string;
  timezoneOverlap?: string;
};

function formatDeadline(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtNum(n: number, currency: string) {
  return n.toLocaleString(currency === "INR" ? "en-IN" : "en-US");
}

function salary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return "Salary not disclosed";
  const cur = job.salaryCurrency || "INR";
  return `${cur} ${fmtNum(job.salaryMin ?? 0, cur)}${job.salaryMax ? `–${fmtNum(job.salaryMax, cur)}` : "+"}`;
}

function splitLines(value?: string) {
  return (value || "").split(/[\n,]/).map(item => item.trim()).filter(Boolean);
}

async function loadJob(id: string) {
  try {
    const res = await fetch(apiUrl(`/recruit-public/jobs/${id}`), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await readApiJson(res);
    return (data.job ?? null) as Job | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const job = await loadJob(id);
  if (!job) {
    return buildMetadata({
      title: "Job not found | Rolebolt",
      description: "This job opportunity could not be found on Rolebolt.",
      path: `/recruit/opportunities/${id}`,
      noIndex: true,
    });
  }
  const location = job.location || "Remote";
  const mode = job.workMode ? ` · ${job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)}` : "";
  const description = `${job.title} role${job.companyName ? ` at ${job.companyName}` : ""} in ${location}${mode}. ${job.mustHaveSkills ? `Skills: ${job.mustHaveSkills.split(",").slice(0, 4).join(", ")}.` : ""} Apply free on Rolebolt.`;
  const skills = job.mustHaveSkills
    ? job.mustHaveSkills.split(",").slice(0, 6).map((s: string) => s.trim()).filter(Boolean)
    : [];
  return buildMetadata({
    title: `${job.title}${job.companyName ? ` at ${job.companyName}` : ""} | Rolebolt`,
    description,
    path: `/recruit/opportunities/${id}`,
    keywords: [
      job.title,
      ...(job.companyName ? [`${job.title} at ${job.companyName}`] : []),
      `${job.title} jobs`,
      ...(location !== "Remote" ? [`${job.title} jobs ${location}`] : []),
      ...skills.map((s: string) => `${s} jobs`),
      "Rolebolt",
    ],
  });
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await loadJob(id);

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <RecruitHeader />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mx-auto">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Opportunity not found</h1>
          <p className="mt-2 text-sm text-slate-500">This job may have been closed or removed.</p>
          <Link href="/recruit/opportunities" className="mt-5 inline-block rounded-full bg-[#0a66c2] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  const mustHave = splitLines(job.mustHaveSkills);
  const niceToHave = splitLines(job.niceToHaveSkills);
  const quality = computeJobQuality(job);
  const roleOverview = formatJobDescription(job.generatedJD);
  const deadlineLabel = formatDeadline(job.applicationDeadline);
  const jobDescription = [
    roleOverview,
    mustHave.length ? `Must-have skills: ${mustHave.join(", ")}.` : "",
    niceToHave.length ? `Good-to-have skills: ${niceToHave.join(", ")}.` : "",
  ].filter(Boolean).join("\n\n") || `${job.title} opportunity on Rolebolt.`;
  const jobPosting = jobPostingJsonLd({
    id,
    title: job.title,
    description: jobDescription,
    url: `${SITE_URL}/recruit/opportunities/${id}`,
    companyName: job.companyName,
    location: job.location,
    workMode: job.workMode,
    jobType: job.jobType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    applicationDeadline: job.applicationDeadline,
    datePosted: job.createdAt,
  });

  const copyText = [
    `${job.title}${job.companyName ? ` — ${job.companyName}` : ""}`,
    "",
    `Company: ${job.companyName || "—"}${job.companyType ? ` (${job.companyType})` : ""}`,
    `Location: ${job.location || "Remote"}${job.workMode ? ` · ${job.workMode}` : ""}`,
    `Job type: ${job.jobType || "Full-time"}`,
    `Seniority: ${job.seniority || "Open level"}`,
    `Experience: ${job.experienceMin ?? 0}${job.experienceMax ? `–${job.experienceMax}` : "+"} years`,
    `Salary: ${salary(job)}`,
    `Niche / Department: ${job.niche || job.department || "General"}`,
    `Education: ${job.educationRequirement || "Flexible"}`,
    `Notice period: ${job.noticePeriod || "Flexible"}`,
    job.freshersAllowed ? "Freshers welcome: Yes" : "",
    job.verifiedCompany ? "Verified company: Yes" : "",
    job.openings && job.openings > 1 ? `Openings: ${job.openings}` : "",
    deadlineLabel ? `Apply by: ${deadlineLabel}` : "",
    "",
    "── Role overview ──",
    roleOverview || "The recruiter has not published a full job description yet.",
    "",
    mustHave.length ? `── Must-have skills ──\n${mustHave.map(s => `• ${s}`).join("\n")}` : "",
    niceToHave.length ? `── Good-to-have skills ──\n${niceToHave.map(s => `• ${s}`).join("\n")}` : "",
    "",
    `View job: https://www.rolebolt.tech/recruit/opportunities/${id}`,
  ].filter(Boolean).join("\n");

  const tags = [
    { label: salary(job), color: "bg-slate-100 text-slate-700" },
    { label: job.jobType || "Full-time", color: "bg-slate-100 text-slate-700" },
    { label: job.seniority || "Open level", color: "bg-slate-100 text-slate-700" },
    { label: `${job.experienceMin ?? 0}${job.experienceMax ? `–${job.experienceMax}` : "+"} yrs exp`, color: "bg-slate-100 text-slate-700" },
    ...(job.workMode ? [{ label: job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1), color: "bg-blue-50 text-[#0a66c2]" }] : []),
    ...(job.freshersAllowed ? [{ label: "Freshers welcome", color: "bg-amber-50 text-amber-700" }] : []),
    ...(job.verifiedCompany ? [{ label: "✓ Verified company", color: "bg-green-50 text-green-700" }] : []),
    ...(job.openings && job.openings > 1 ? [{ label: `${job.openings} openings`, color: "bg-indigo-50 text-indigo-700" }] : []),
    ...(deadlineLabel ? [{ label: `Apply by ${deadlineLabel}`, color: "bg-rose-50 text-rose-700" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <PageTracker event="opportunity_viewed" data={{ jobId: id }} />
      <JsonLd id="ld-job-posting" data={jobPosting} />
      <RecruitHeader />

      {/* Sticky bottom CTA bar */}
      <StickyActions jobId={id} jobTitle={job.title} companyName={job.companyName} />

      {/* Back nav */}
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        <Link
          href="/recruit/opportunities"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0a66c2] transition"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M19 12H5" /><path d="m12 5-7 7 7 7" />
          </svg>
          Back to jobs
        </Link>
      </div>

      {/* Single-column content — extra bottom padding for sticky bar */}
      <main className="mx-auto max-w-3xl px-4 py-4 pb-28 sm:px-6 space-y-4">

        {/* ── 1. Job header ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            {/* Logo avatar */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-xl font-black text-[#0a66c2]">
              {(job.companyName || job.title).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                {job.verifiedCompany && (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[11px] font-bold text-green-700">✓ Verified company</span>
                )}
                {job.freshersAllowed && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">Freshers welcome</span>
                )}
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${quality.color} ${quality.bg} ${quality.border}`}>
                  {quality.tier === "high" ? "★ " : quality.tier === "standard" ? "◆ " : "· "}{quality.label}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight leading-tight sm:text-2xl">{job.title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{job.companyName || "Company"}</span>
                {job.companyType ? ` · ${job.companyType}` : ""}
                {` · ${job.location || "Remote"}`}
              </p>
              {(job.niche || job.department) && (
                <p className="mt-0.5 text-xs text-slate-400">{job.niche || job.department}</p>
              )}
            </div>
            {/* Share / Copy */}
            <div className="flex shrink-0 items-center gap-2">
              <ShareJobButton title={job.title} companyName={job.companyName} />
              <CopyJobButton text={copyText} />
            </div>
          </div>

          {/* ── Verification status banner ── */}
          {job.verifiedCompany ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-200 text-white text-lg font-black">✓</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-emerald-800 leading-tight">Verified Company</p>
                <p className="text-xs text-emerald-600 mt-0.5">This company's identity has been reviewed and confirmed by Rolebolt.</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black text-white tracking-wide uppercase shadow-sm">
                Verified ✓
              </span>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-300 text-white text-lg font-black">?</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-slate-600 leading-tight">Unverified Company</p>
                <p className="text-xs text-slate-400 mt-0.5">This company has not been verified by Rolebolt. Please review carefully before applying.</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-400 px-3 py-1 text-[11px] font-black text-white tracking-wide uppercase shadow-sm">
                Unverified
              </span>
            </div>
          )}

          {/* Tag pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((t, i) => (
              <span key={i} className={`rounded-full px-3 py-1 text-xs font-semibold ${t.color}`}>{t.label}</span>
            ))}
          </div>

          {/* Inline CTAs — visible on desktop, supplementary to sticky bar */}
          <div className="mt-5 space-y-3">
            <SeekerJobActions jobId={id} jobTitle={job.title} />
            <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/recruit/recruiter/${id}`}
              className="flex-1 rounded-full border-2 border-[#0a66c2] py-3 text-center text-sm font-bold text-[#0a66c2] transition hover:bg-blue-50"
            >
              View Recruiter Profile
            </Link>
            </div>
          </div>
        </div>

        {/* ── 2. Role overview ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs text-[#0a66c2]">📄</span>
            <h2 className="text-base font-bold text-slate-900">Role overview</h2>
          </div>
          {roleOverview
            ? <JDRenderer content={roleOverview} />
            : <p className="text-sm text-slate-500 italic">The recruiter has not published a full job description yet.</p>
          }
        </div>

        {/* ── 3. Skills ── */}
        {(mustHave.length > 0 || niceToHave.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0a66c2] text-white text-[10px]">✓</span>
                Must-have skills
              </h2>
              <ul className="space-y-2">
                {(mustHave.length ? mustHave : ["Relevant experience for this role"]).map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0a66c2]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px]">+</span>
                Good-to-have
              </h2>
              <ul className="space-y-2">
                {(niceToHave.length ? niceToHave : ["Strong communication and ownership"]).map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── 4. Job details grid ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
            <h2 className="text-sm font-bold text-slate-900">Job details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            {[
              { label: "Niche", value: job.niche || job.department || "General" },
              { label: "Company type", value: job.companyType || "Not specified" },
              { label: "Education", value: job.educationRequirement || "Flexible" },
              { label: "Notice period", value: job.noticePeriod || "Flexible" },
              { label: "Openings", value: job.openings && job.openings > 1 ? `${job.openings} positions` : "1 position" },
              { label: "Apply by", value: deadlineLabel || "Open until filled" },
              ...(job.languageRequirement ? [{ label: "Language", value: job.languageRequirement }] : []),
              ...(job.workMode === "remote" && job.timezoneOverlap ? [{ label: "Timezone", value: job.timezoneOverlap }] : []),
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{item.label}</p>
                <p className="font-medium text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. Perks ── */}
        {job.perks?.trim() && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[10px]">★</span>
              Perks &amp; Benefits
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{job.perks}</p>
          </div>
        )}

        {/* ── 6. Trust & safety ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-900">Trust &amp; safety</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">✓</div>
              <div>
                <p className="text-xs font-bold text-slate-900">Free to apply</p>
                <p className="mt-0.5 text-[11px] text-slate-500">No fees charged. Ever.</p>
              </div>
            </div>
            {job.salaryMin || job.salaryMax ? (
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">₹</div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Salary disclosed</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Range shared upfront.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs font-black">₹</div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Salary not disclosed</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Ask during the process.</p>
                </div>
              </div>
            )}
            {job.verifiedCompany ? (
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">✓</div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Verified company</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Identity reviewed by Rolebolt.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-[11px] font-black">?</div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Not verified</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Review details before applying.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 7. Quality breakdown ── */}
        <QualityBreakdown job={job} />

        {/* ── 8. Company section ── */}
        <CompanySection
          jobId={id}
          companyName={job.companyName}
          companyType={job.companyType}
          location={job.location}
        />

        {/* ── 8b. AI Match Score ── */}
        <MatchScoreSection jobId={id} />

        {/* ── 9. Bottom CTA block ── */}
        <div className="rounded-3xl border border-[#0a66c2]/20 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm text-center">
          <p className="text-base font-bold text-slate-900">Ready to apply?</p>
          <p className="mt-1 text-sm text-slate-500">Takes less than 2 minutes. Free to apply — no account needed.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/recruit/opportunities/${id}/apply`}
              className="rounded-full bg-[#0a66c2] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#004182] active:scale-95"
            >
              Apply Now →
            </Link>
            <Link
              href={`/recruit/recruiter/${id}`}
              className="rounded-full border-2 border-[#0a66c2] px-8 py-3.5 text-sm font-bold text-[#0a66c2] transition hover:bg-blue-50"
            >
              View Recruiter Profile
            </Link>
          </div>
        </div>

        {/* Report */}
        <div className="flex justify-end">
          <ReportJobButton jobId={id} />
        </div>

      </main>
    </div>
  );
}
