import type { Metadata } from "next";
import Link from "next/link";
import ApplyForm from "./ApplyForm";
import RecruitHeader from "@/components/RecruitHeader";
import ClientSaveButton from "../SaveButton";
import ShareJobButton from "./ShareJobButton";
import CopyJobButton from "./CopyJobButton";
import RecentlyViewedTracker from "./RecentlyViewedTracker";
import ReportJobButton from "./ReportJobButton";
import JobMatchPanel from "./JobMatchPanel";
import CompanySection from "./CompanySection";
import QualityBreakdown from "./QualityBreakdown";
import { computeJobQuality } from "@/lib/jobQuality";
import PageTracker from "@/components/PageTracker";
import { apiUrl, readApiJson } from "@/lib/api";
import { buildMetadata } from "@/lib/seo";
import { formatJobDescription } from "@/lib/jobDescription";

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
};

function salary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return "Salary not disclosed";
  return `${job.salaryCurrency || "INR"} ${job.salaryMin?.toLocaleString("en-IN") ?? "0"}${job.salaryMax ? `–${job.salaryMax.toLocaleString("en-IN")}` : "+"}`;
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
      title: "Job not found | Plyndrox Recruit AI",
      description: "This job opportunity could not be found on Plyndrox Recruit AI.",
      path: `/recruit/opportunities/${id}`,
      noIndex: true,
    });
  }
  const title = `${job.title}${job.companyName ? ` at ${job.companyName}` : ""} | Plyndrox Recruit AI`;
  const location = job.location || "India";
  const mode = job.workMode ? ` · ${job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)}` : "";
  const description = `${job.title} role${job.companyName ? ` at ${job.companyName}` : ""} in ${location}${mode}. ${job.mustHaveSkills ? `Skills: ${job.mustHaveSkills.split(",").slice(0, 4).join(", ")}.` : ""} Apply free on Plyndrox Recruit AI — India's niche job platform.`;
  const skills = job.mustHaveSkills
    ? job.mustHaveSkills.split(",").slice(0, 6).map((s: string) => s.trim()).filter(Boolean)
    : [];
  return buildMetadata({
    title,
    description,
    path: `/recruit/opportunities/${id}`,
    keywords: [
      job.title,
      ...(job.companyName ? [`${job.title} at ${job.companyName}`] : []),
      `${job.title} jobs India`,
      `${job.title} hiring`,
      ...(location !== "India" ? [`${job.title} jobs ${location}`] : []),
      ...skills.map((s: string) => `${s} jobs India`),
      "Plyndrox Recruit AI",
      "niche jobs India",
      "apply free India",
    ],
  });
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await loadJob(id);

  if (!job) {
    return (
      <div className="min-h-screen bg-white">
        <RecruitHeader />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="text-4xl mb-4">🔍</div>
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

  const copyText = [
    `${job.title}${job.companyName ? ` — ${job.companyName}` : ""}`,
    "",
    `Company: ${job.companyName || "—"}${job.companyType ? ` (${job.companyType})` : ""}`,
    `Location: ${job.location || "India"}${job.workMode ? ` · ${job.workMode}` : ""}`,
    `Job type: ${job.jobType || "Full-time"}`,
    `Seniority: ${job.seniority || "Open level"}`,
    `Experience: ${job.experienceMin ?? 0}${job.experienceMax ? `–${job.experienceMax}` : "+"} years`,
    `Salary: ${salary(job)}`,
    `Niche / Department: ${job.niche || job.department || "General"}`,
    `Education: ${job.educationRequirement || "Flexible"}`,
    `Notice period: ${job.noticePeriod || "Flexible"}`,
    job.freshersAllowed ? "Freshers welcome: Yes" : "",
    job.verifiedCompany ? "Verified company: Yes" : "",
    "",
    "── Role overview ──",
    roleOverview || "The recruiter has not published a full job description yet.",
    "",
    mustHave.length ? `── Must-have skills ──\n${mustHave.map(s => `• ${s}`).join("\n")}` : "",
    "",
    niceToHave.length ? `── Good-to-have skills ──\n${niceToHave.map(s => `• ${s}`).join("\n")}` : "",
    "",
    `View job: https://www.plyndrox.app/recruit/opportunities/${id}`,
  ]
    .filter(Boolean)
    .join("\n");

  const tags = [
    { label: salary(job), color: "bg-slate-100 text-slate-700" },
    { label: job.jobType || "Full-time", color: "bg-slate-100 text-slate-700" },
    { label: job.seniority || "Open level", color: "bg-slate-100 text-slate-700" },
    { label: `${job.experienceMin ?? 0}${job.experienceMax ? `–${job.experienceMax}` : "+"} yrs exp`, color: "bg-slate-100 text-slate-700" },
    ...(job.workMode ? [{ label: job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1), color: "bg-blue-50 text-[#0a66c2]" }] : []),
    ...(job.freshersAllowed ? [{ label: "Freshers welcome", color: "bg-amber-50 text-amber-700" }] : []),
    ...(job.verifiedCompany ? [{ label: "✓ Verified company", color: "bg-green-50 text-green-700" }] : []),
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageTracker event="opportunity_viewed" data={{ jobId: id }} />
      <RecruitHeader />
      <RecentlyViewedTracker
        job={{
          jobId: id,
          title: job.title,
          companyName: job.companyName,
          location: job.location,
          workMode: job.workMode,
          jobType: job.jobType,
          niche: job.niche,
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/recruit/opportunities" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0a66c2] transition py-2">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5" /><path d="m12 5-7 7 7 7" /></svg>
          Back to jobs
        </Link>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start">
        <section className="space-y-4 mt-0">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-xl font-black text-[#0a66c2]">
                {(job.companyName || job.title).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {job.verifiedCompany && <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">✓ Verified company</span>}
                  {job.freshersAllowed && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Freshers welcome</span>}
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${quality.color} ${quality.bg} ${quality.border}`}>
                    {quality.tier === "high" ? "★ " : quality.tier === "standard" ? "◆ " : "· "}{quality.label}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{job.title}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="font-medium text-slate-700">{job.companyName || "Company"}</span>
                  {job.companyType ? ` · ${job.companyType}` : ""}
                  {` · ${job.location || "India"}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{job.niche || job.department}</p>
              </div>
              <div className="relative z-10 flex shrink-0 items-center gap-2">
                <ClientSaveButton
                  jobId={id}
                  title={job.title}
                  companyName={job.companyName}
                  location={job.location}
                  workMode={job.workMode}
                  jobType={job.jobType}
                  niche={job.niche}
                />
                <ShareJobButton title={job.title} companyName={job.companyName} />
                <CopyJobButton text={copyText} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t, i) => (
                <span key={i} className={`rounded-full px-3 py-1 text-xs font-semibold ${t.color}`}>{t.label}</span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-3">Role overview</h2>
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
              {roleOverview || "The recruiter has not published a full job description yet."}
            </div>
          </div>

          {(mustHave.length > 0 || niceToHave.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0a66c2] text-white text-[10px]">✓</span>
                  Must-have skills
                </h2>
                <ul className="space-y-2">
                  {(mustHave.length ? mustHave : ["Relevant experience for this role"]).map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#0a66c2] shrink-0" />
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
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Job details</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              {[
                { label: "Niche", value: job.niche || job.department || "General" },
                { label: "Company type", value: job.companyType || "Not specified" },
                { label: "Education", value: job.educationRequirement || "Flexible" },
                { label: "Notice period", value: job.noticePeriod || "Flexible" },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{item.label}</p>
                  <p className="font-medium text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h2 className="text-sm font-bold text-slate-900">Trust &amp; safety</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">✓</div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Free to apply</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">No fees charged to candidates. Ever.</p>
                </div>
              </div>
              {job.salaryMin || job.salaryMax ? (
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">₹</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Salary disclosed</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Recruiter shared the salary range upfront.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs font-black">₹</div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">Salary not disclosed</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Ask during application process.</p>
                  </div>
                </div>
              )}
              {job.verifiedCompany ? (
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">✓</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Verified company</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Company identity reviewed by Plyndrox team.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-[11px] font-black">?</div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">Not verified</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Review company details before applying.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <QualityBreakdown job={job} />

          <CompanySection
            jobId={id}
            companyName={job.companyName}
            companyType={job.companyType}
            location={job.location}
          />

          <div className="rounded-2xl border border-[#0a66c2]/20 bg-blue-50/50 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Want to know more about who's hiring?</p>
              <p className="text-xs text-slate-500 mt-0.5">View the recruiter's full company profile and their other open roles.</p>
            </div>
            <Link
              href={`/recruit/recruiter/${id}`}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#0a66c2]/30 bg-white px-4 py-2 text-xs font-bold text-[#0a66c2] hover:bg-[#0a66c2] hover:text-white transition"
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
              View Recruiter Profile
            </Link>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Apply faster with your saved profile</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Save your profile once and Plyndrox can reuse your name, contact details, and resume text when you apply to similar jobs.
            </p>
            <Link href="/recruit/profile" className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0a66c2] shadow-sm ring-1 ring-blue-100 transition hover:bg-blue-50">
              Update seeker profile
            </Link>
          </div>

          <JobMatchPanel jobId={id} />

          <div className="flex justify-end pt-1">
            <ReportJobButton jobId={id} />
          </div>
        </section>

        <div className="mt-4 lg:mt-0 lg:sticky lg:top-24">
          <ApplyForm jobId={id} jobTitle={job.title} companyName={job.companyName} />
        </div>
      </main>
    </div>
  );
}
