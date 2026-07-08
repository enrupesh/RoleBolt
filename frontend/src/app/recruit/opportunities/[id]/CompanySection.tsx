"use client";

import { useState, useEffect } from "react";
import { apiUrl, readApiJson } from "@/lib/api";

type CompanyData = {
  companyName?: string;
  companyType?: string;
  location?: string;
  profile: {
    description?: string;
    mission?: string;
    benefits?: string;
    industry?: string;
    companySize?: string;
    website?: string;
    linkedinUrl?: string;
    logoUrl?: string;
  } | null;
};

export default function CompanySection({ jobId, companyName, companyType, location }: {
  jobId: string;
  companyName?: string;
  companyType?: string;
  location?: string;
}) {
  const [data, setData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/recruit-public/jobs/${jobId}/company`))
      .then(r => readApiJson(r))
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [jobId]);

  const profile = data?.profile;
  const name = data?.companyName || companyName || "Company";
  const type = data?.companyType || companyType;
  const loc = data?.location || location;

  const hasRichInfo = Boolean(
    profile?.description || profile?.mission || profile?.benefits ||
    profile?.website || profile?.linkedinUrl || profile?.companySize || profile?.industry
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-4 w-32 bg-slate-100 rounded mb-3" />
        <div className="h-3 w-full bg-slate-100 rounded mb-2" />
        <div className="h-3 w-3/4 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900 mb-4">About the company</h2>

      <div className="flex items-start gap-3 mb-4">
        {profile?.logoUrl ? (
          <img
            src={profile.logoUrl}
            alt={`${name} logo`}
            className="h-12 w-12 rounded-xl object-contain border border-slate-200 bg-white shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-lg font-black text-[#0a66c2]">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {[type, loc, profile?.industry].filter(Boolean).join(" · ")}
          </p>
          {profile?.companySize && (
            <p className="text-xs text-slate-400 mt-0.5">{profile.companySize} employees</p>
          )}
        </div>
      </div>

      {hasRichInfo ? (
        <div className="space-y-3">
          {profile?.description && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">About</p>
              <p className="text-sm text-slate-700 leading-relaxed">{profile.description}</p>
            </div>
          )}
          {profile?.mission && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Mission</p>
              <p className="text-sm text-slate-700 leading-relaxed">{profile.mission}</p>
            </div>
          )}
          {profile?.benefits && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs font-bold text-[#0a66c2] mb-1">Benefits & perks</p>
              <p className="text-sm text-slate-700 leading-relaxed">{profile.benefits}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {profile?.website && (
              <a
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0a66c2] hover:text-[#0a66c2] transition"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Website
              </a>
            )}
            {profile?.linkedinUrl && (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0a66c2] hover:text-[#0a66c2] transition"
              >
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                LinkedIn
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <p className="text-xs text-slate-500">
            The recruiter hasn't added a company description yet.{" "}
            <span className="font-medium">Company info visible: {[type, loc].filter(Boolean).join(", ") || "minimal details provided."}</span>
          </p>
        </div>
      )}
    </div>
  );
}
