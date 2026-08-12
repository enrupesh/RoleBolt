"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import { apiUrl, readApiJson } from "@/lib/api";

type OtherJob = {
  _id: string;
  title: string;
  niche?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  seniority?: string;
  freshersAllowed?: boolean;
  verifiedCompany?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
};

type CompanyProfile = {
  profileType?: string;
  companyName?: string;
  tagline?: string;
  companyType?: string;
  industry?: string;
  companySize?: string;
  foundedYear?: string;
  instituteType?: string;
  coursesOffered?: string;
  niche?: string;
  website?: string;
  linkedinUrl?: string;
  logoUrl?: string;
  description?: string;
  mission?: string;
  benefits?: string;
  bio?: string;
  photoUrl?: string;
  personalLinkedinUrl?: string;
  socialLinks?: { instagram?: string; twitter?: string; github?: string; portfolio?: string };
};

const RECRUITER_SECTION_TITLE: Record<string, string> = {
  company: "About the Company",
  educational_institute: "About the Institute",
  individual: "About the Recruiter",
  content_creator: "About the Creator",
  ngo_government: "About the Organisation",
};

type RecruiterData = {
  companyProfile: CompanyProfile | null;
  companyName?: string;
  companyType?: string;
  location?: string;
  otherJobs: OtherJob[];
};

function salary(job: OtherJob) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const cur = job.salaryCurrency || "INR";
  const locale = cur === "INR" ? "en-IN" : "en-US";
  const fmt = (n: number) => cur === "INR" && n >= 100000
    ? `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`
    : n.toLocaleString(locale);
  return `${cur} ${fmt(job.salaryMin ?? 0)}${job.salaryMax ? `–${fmt(job.salaryMax)}` : "+"}`;
}

function externalHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function RecruiterProfilePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [data, setData] = useState<RecruiterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(apiUrl(`/recruit-public/jobs/${jobId}/recruiter`))
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return readApiJson(r);
      })
      .then(d => { if (d) setData(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [jobId]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] animate-[rb-fade-in_0.3s_ease_both]">
        <RecruitHeader />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-4">
          <div className="h-56 w-full rounded-3xl rb-skeleton" />
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-white p-6 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="h-4 w-32 rounded-full rb-skeleton" />
              <div className="h-3.5 w-full rounded-full rb-skeleton" />
              <div className="h-3.5 w-5/6 rounded-full rb-skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#f0f2f5]">
        <RecruitHeader />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mx-auto"><svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
          <h1 className="text-2xl font-extrabold text-slate-900">Recruiter profile not found</h1>
          <p className="mt-2 text-sm text-slate-500">This job or recruiter may no longer be available.</p>
          <Link href="/recruit/opportunities"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0a66c2] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(10,102,194,0.35)] hover:bg-[#004182] hover:-translate-y-0.5 transition-all">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  const cp = data.companyProfile;
  const name = cp?.companyName || data.companyName || "Company";
  const type = cp?.companyType || cp?.instituteType || data.companyType;
  const loc = (cp as any)?.location || data.location;
  const aboutTitle = RECRUITER_SECTION_TITLE[cp?.profileType || ""] || "About the Company";
  const hasRichInfo = Boolean(cp?.description || cp?.mission || cp?.benefits || cp?.website || cp?.linkedinUrl || cp?.coursesOffered);
  const hasRecruiterInfo = Boolean(cp?.bio || cp?.photoUrl);
  const hasSocialLinks = Boolean(cp?.personalLinkedinUrl || cp?.socialLinks?.instagram || cp?.socialLinks?.twitter || cp?.socialLinks?.github || cp?.socialLinks?.portfolio);
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-900">
      <RecruitHeader />

      <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6">
        <Link
          href={`/recruit/opportunities/${jobId}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M19 12H5" /><path d="m12 5-7 7 7 7" />
          </svg>
          Back to job listing
        </Link>
      </div>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-16 sm:px-6 space-y-4">

        {/* ── Company Hero Card ── */}
        <div className="overflow-hidden rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.10)]">
          {/* Dark header band */}
          <div className="relative bg-gradient-to-br from-[#0d1829] via-[#0f2340] to-[#0a66c2] px-6 pt-8 pb-14 sm:px-8">
            {/* Decorative circles */}
            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-white/[0.03] translate-x-1/3 -translate-y-1/3" />
            <div className="pointer-events-none absolute right-12 bottom-0 h-40 w-40 rounded-full bg-[#0a66c2]/30 translate-y-1/3" />

            {/* Logo */}
            {cp?.logoUrl ? (
              <img
                src={cp.logoUrl}
                alt={`${name} logo`}
                className="h-16 w-16 rounded-2xl object-contain border-2 border-white/20 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-[#0a66c2] shadow-[0_4px_16px_rgba(0,0,0,0.25)] border-2 border-white/20">
                {initial}
              </div>
            )}

            <div className="mt-4">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">{name}</h1>
              {cp?.tagline && (
                <p className="mt-1 text-[15px] text-blue-200 font-medium">{cp.tagline}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-blue-200/80">
                {[type, loc, cp?.industry || cp?.niche].filter(Boolean).map((item, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    {item}
                    {i < arr.length - 1 && <span className="h-1 w-1 rounded-full bg-blue-300/40 inline-block" />}
                  </span>
                ))}
              </div>
              {(cp?.companySize || cp?.foundedYear) && (
                <p className="mt-1 text-[12px] text-blue-300/70 font-medium">
                  {[cp?.companySize && `${cp.companySize} employees`, cp?.foundedYear && `Founded ${cp.foundedYear}`].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>

          {/* White content area — links, overlapping the dark band */}
          <div className="relative bg-white px-6 py-5 sm:px-8">
            {/* Overlap logo on white section */}
            <div className="flex flex-wrap gap-2">
              {cp?.website && (
                <a href={externalHref(cp.website)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:border-[#0a66c2] hover:text-[#0a66c2] hover:shadow-md transition-all">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Website
                </a>
              )}
              {cp?.linkedinUrl && (
                <a href={externalHref(cp.linkedinUrl)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[12px] font-semibold text-[#0a66c2] shadow-sm hover:bg-blue-100 hover:shadow-md transition-all">
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                  LinkedIn
                </a>
              )}
              {!cp?.website && !cp?.linkedinUrl && (
                <span className="text-[13px] text-slate-400">No external links added</span>
              )}
            </div>
          </div>
        </div>

        {/* ── About the Recruiter (individual card) ── */}
        {hasRecruiterInfo && (
          <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 sm:px-7">
              <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#0a66c2]">Hiring Manager</h2>
            </div>
            <div className="flex items-start gap-5 px-6 py-5 sm:px-7">
              {cp?.photoUrl ? (
                <img src={cp.photoUrl} alt="Recruiter" className="h-14 w-14 rounded-full object-cover border-2 border-slate-200 shadow-sm shrink-0" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] text-xl font-bold text-white shadow-md">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {cp?.bio && <p className="text-[15px] text-slate-700 leading-relaxed">{cp.bio}</p>}
                {hasSocialLinks && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {cp?.personalLinkedinUrl && (
                      <a href={externalHref(cp.personalLinkedinUrl)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[12px] font-semibold text-[#0a66c2] hover:bg-blue-100 transition">
                        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                        LinkedIn
                      </a>
                    )}
                    {cp?.socialLinks?.instagram && (
                      <a href={externalHref(cp.socialLinks.instagram)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3.5 py-1.5 text-[12px] font-semibold text-pink-600 hover:bg-pink-100 transition">
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                        Instagram
                      </a>
                    )}
                    {cp?.socialLinks?.twitter && (
                      <a href={externalHref(cp.socialLinks.twitter)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 transition">
                        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        X / Twitter
                      </a>
                    )}
                    {cp?.socialLinks?.github && (
                      <a href={externalHref(cp.socialLinks.github)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 transition">
                        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                        GitHub
                      </a>
                    )}
                    {cp?.socialLinks?.portfolio && (
                      <a href={externalHref(cp.socialLinks.portfolio)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        Portfolio
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── About the Org ── */}
        {hasRichInfo && (
          <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 sm:px-7">
              <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#0a66c2]">{aboutTitle}</h2>
            </div>
            <div className="px-6 py-5 sm:px-7 space-y-5">
              {cp?.description && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">About</p>
                  <p className="text-[15px] text-slate-700 leading-relaxed">{cp.description}</p>
                </div>
              )}
              {cp?.coursesOffered && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Courses Offered</p>
                  <p className="text-[15px] text-slate-700 leading-relaxed">{cp.coursesOffered}</p>
                </div>
              )}
              {cp?.mission && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Mission</p>
                  <p className="text-[15px] text-slate-700 leading-relaxed">{cp.mission}</p>
                </div>
              )}
              {cp?.benefits && (
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#0a66c2] mb-2.5">Benefits & Perks</p>
                  <p className="text-[15px] text-slate-700 leading-relaxed">{cp.benefits}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!hasRichInfo && (
          <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] px-6 py-5 sm:px-7">
            <p className="text-[14px] text-slate-400 italic">This recruiter hasn't added a company description yet.</p>
          </div>
        )}

        {/* ── Open roles ── */}
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sm:px-7">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#0a66c2]">
              {data.otherJobs.length > 0 ? `More open roles at ${name}` : `Open roles at ${name}`}
            </h2>
            <Link
              href={`/recruit/opportunities/${jobId}`}
              className="text-[12px] font-semibold text-[#0a66c2] hover:text-[#004182] flex items-center gap-1 transition"
            >
              View current job
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>

          {data.otherJobs.length === 0 ? (
            <div className="px-6 py-10 sm:px-7 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              </div>
              <p className="text-[14px] font-semibold text-slate-700">No other open roles right now</p>
              <p className="text-[13px] text-slate-400 mt-1">Check back soon — new positions are posted regularly.</p>
              <Link href="/recruit/opportunities" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0a66c2] hover:text-[#004182] transition">
                Browse all jobs
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.otherJobs.map(job => (
                <Link
                  key={job._id}
                  href={`/recruit/opportunities/${job._id}`}
                  className="group flex items-start justify-between gap-4 px-6 py-4 sm:px-7 hover:bg-blue-50/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-slate-900 group-hover:text-[#0a66c2] transition-colors truncate">{job.title}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {[job.location, job.workMode && (job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)), job.seniority].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.niche && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                          {job.niche.split(",")[0].trim()}
                        </span>
                      )}
                      {job.freshersAllowed && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          Freshers ok
                        </span>
                      )}
                      {job.verifiedCompany && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2 mt-0.5">
                    {salary(job) && (
                      <span className="text-[13px] font-bold text-slate-800">{salary(job)}</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0a66c2] opacity-0 group-hover:opacity-100 transition-opacity">
                      View role
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0d1829] to-[#0a66c2] p-6 sm:p-8 text-center shadow-[0_8px_32px_rgba(10,102,194,0.30)]">
          <p className="text-[13px] font-semibold text-blue-200 mb-1">Interested in working here?</p>
          <h3 className="text-xl font-extrabold text-white mb-5">Apply for the original role at {name}</h3>
          <Link
            href={`/recruit/opportunities/${jobId}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-[14px] font-bold text-[#0a66c2] shadow-[0_4px_16px_rgba(0,0,0,0.20)] hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all"
          >
            View & Apply
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>

      </main>
    </div>
  );
}
