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
  companyName?: string;
  companyType?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  linkedinUrl?: string;
  logoUrl?: string;
  description?: string;
  mission?: string;
  benefits?: string;
  bio?: string;
  photoUrl?: string;
  socialLinks?: { instagram?: string; twitter?: string; github?: string; portfolio?: string };
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
  return `${job.salaryCurrency || "INR"} ${job.salaryMin?.toLocaleString("en-IN") ?? "0"}${job.salaryMax ? `–${job.salaryMax.toLocaleString("en-IN")}` : "+"}`;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <RecruitHeader />
        <div className="flex items-center justify-center py-32">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading recruiter profile…
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-white">
        <RecruitHeader />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-slate-900">Recruiter profile not found</h1>
          <p className="mt-2 text-sm text-slate-500">This job or recruiter may no longer be available.</p>
          <Link href="/recruit/opportunities" className="mt-5 inline-block rounded-full bg-[#0a66c2] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  const cp = data.companyProfile;
  const name = cp?.companyName || data.companyName || "Company";
  const type = cp?.companyType || data.companyType;
  const loc = (cp as any)?.location || data.location;
  const hasRichInfo = Boolean(cp?.description || cp?.mission || cp?.benefits || cp?.website || cp?.linkedinUrl);
  const hasRecruiterInfo = Boolean(cp?.bio || cp?.photoUrl);
  const hasSocialLinks = Boolean(cp?.linkedinUrl || cp?.socialLinks?.instagram || cp?.socialLinks?.twitter || cp?.socialLinks?.github || cp?.socialLinks?.portfolio);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <RecruitHeader />

      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
        <Link href={`/recruit/opportunities/${jobId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0a66c2] transition py-2">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5" /><path d="m12 5-7 7 7 7" /></svg>
          Back to job listing
        </Link>
      </div>

      <main className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            {cp?.logoUrl ? (
              <img
                src={cp.logoUrl}
                alt={`${name} logo`}
                className="h-16 w-16 rounded-2xl object-contain border border-slate-200 bg-white shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-2xl font-black text-[#0a66c2]">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {[type, loc, cp?.industry].filter(Boolean).join(" · ")}
              </p>
              {cp?.companySize && (
                <p className="text-xs text-slate-400 mt-0.5">{cp.companySize} employees</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {cp?.website && (
                  <a href={cp.website.startsWith("http") ? cp.website : `https://${cp.website}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0a66c2] hover:text-[#0a66c2] transition">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    Website
                  </a>
                )}
                {cp?.linkedinUrl && (
                  <a href={cp.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0a66c2] hover:text-[#0a66c2] transition">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {hasRecruiterInfo && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-4">About the Recruiter</h2>
            <div className="flex items-start gap-4">
              {cp?.photoUrl ? (
                <img src={cp.photoUrl} alt="Recruiter" className="h-14 w-14 rounded-full object-cover border-2 border-slate-100 shrink-0" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] text-xl font-bold text-white">
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {cp?.bio && <p className="text-sm text-slate-700 leading-relaxed">{cp.bio}</p>}
                {hasSocialLinks && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cp?.linkedinUrl && (
                      <a href={cp.linkedinUrl.startsWith("http") ? cp.linkedinUrl : `https://${cp.linkedinUrl}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#0a66c2] hover:bg-blue-100 transition">
                        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                        LinkedIn
                      </a>
                    )}
                    {cp?.socialLinks?.instagram && (
                      <a href={cp.socialLinks.instagram.startsWith("http") ? cp.socialLinks.instagram : `https://${cp.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-600 hover:bg-pink-100 transition">
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                        Instagram
                      </a>
                    )}
                    {cp?.socialLinks?.twitter && (
                      <a href={cp.socialLinks.twitter.startsWith("http") ? cp.socialLinks.twitter : `https://${cp.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
                        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        X / Twitter
                      </a>
                    )}
                    {cp?.socialLinks?.portfolio && (
                      <a href={cp.socialLinks.portfolio.startsWith("http") ? cp.socialLinks.portfolio : `https://${cp.socialLinks.portfolio}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
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

        {hasRichInfo && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            {cp?.description && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">About</p>
                <p className="text-sm text-slate-700 leading-relaxed">{cp.description}</p>
              </div>
            )}
            {cp?.mission && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Mission</p>
                <p className="text-sm text-slate-700 leading-relaxed">{cp.mission}</p>
              </div>
            )}
            {cp?.benefits && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs font-bold text-[#0a66c2] mb-1.5">Benefits & Perks</p>
                <p className="text-sm text-slate-700 leading-relaxed">{cp.benefits}</p>
              </div>
            )}
          </div>
        )}

        {!hasRichInfo && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">This recruiter hasn't added a company description yet.</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">
              {data.otherJobs.length > 0 ? `More open roles at ${name}` : `Open roles at ${name}`}
            </h2>
            <Link href={`/recruit/opportunities/${jobId}`} className="text-xs font-semibold text-[#0a66c2] hover:underline">
              View current job →
            </Link>
          </div>

          {data.otherJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500">No other open roles from this recruiter right now.</p>
              <Link href="/recruit/opportunities" className="mt-2 inline-block text-xs font-semibold text-[#0a66c2] hover:underline">
                Browse all jobs
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.otherJobs.map(job => (
                <Link
                  key={job._id}
                  href={`/recruit/opportunities/${job._id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3.5 hover:border-[#0a66c2]/30 hover:bg-blue-50/30 transition group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-[#0a66c2] transition truncate">{job.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[job.location, job.workMode && job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1), job.seniority].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {job.niche && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{job.niche.split(",")[0].trim()}</span>}
                      {job.freshersAllowed && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Freshers ok</span>}
                      {job.verifiedCompany && <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[11px] font-semibold text-green-700">✓ Verified</span>}
                    </div>
                  </div>
                  {salary(job) && (
                    <span className="shrink-0 text-xs font-semibold text-slate-600 mt-0.5">{salary(job)}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link
            href={`/recruit/opportunities/${jobId}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#0a66c2] px-6 py-3 text-sm font-bold text-white hover:bg-[#004182] transition"
          >
            Apply for the original role
          </Link>
        </div>
      </main>
    </div>
  );
}
