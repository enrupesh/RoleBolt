"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import { RecruitGuard } from "@/components/RecruitGuard";
import { apiUrl, readApiJson } from "@/lib/api";

const STAGE_META: Record<string, { label: string; color: string; icon: string }> = {
  applied:   { label: "Applied",            color: "bg-blue-50 text-blue-700 border-blue-200",       icon: "📋" },
  screened:  { label: "Screened",           color: "bg-purple-50 text-purple-700 border-purple-200",  icon: "👁" },
  assessed:  { label: "Assessment sent",    color: "bg-amber-50 text-amber-700 border-amber-200",     icon: "📝" },
  interview: { label: "Interview",          color: "bg-indigo-50 text-indigo-700 border-indigo-200",  icon: "🤝" },
  offer:     { label: "Offer received",     color: "bg-green-50 text-green-700 border-green-200",     icon: "🎉" },
  hired:     { label: "Hired",              color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "✅" },
  rejected:  { label: "Not selected",       color: "bg-red-50 text-red-700 border-red-200",           icon: "❌" },
};

type Application = {
  _id: string;
  jobId: string;
  job: { title: string; companyName: string; location: string; workMode: string; niche: string } | null;
  stage: string;
  totalScore: number;
  maxScore: number;
  assessmentStatus: string;
  appliedAt: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function MyApplicationsContent() {
  const [email, setEmail] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("recruit_applicant_email");
      if (savedEmail) {
        setInputEmail(savedEmail);
        setEmail(savedEmail);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!email) return;
    fetchApplications(email);
  }, [email]);

  async function fetchApplications(emailToSearch: string) {
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const res = await fetch(apiUrl(`/recruit-public/my-applications?email=${encodeURIComponent(emailToSearch)}`));
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to fetch applications");
      setApplications(data.applications || []);
      setSearched(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!inputEmail.trim()) return;
    const trimmed = inputEmail.trim().toLowerCase();
    try { localStorage.setItem("recruit_applicant_email", trimmed); } catch { /* ignore */ }
    setEmail(trimmed);
  }

  const scorePercent = (app: Application) =>
    app.maxScore > 0 ? Math.round((app.totalScore / app.maxScore) * 100) : null;

  const getScoreColor = (pct: number) => {
    if (pct >= 70) return "bg-green-500";
    if (pct >= 50) return "bg-amber-500";
    return "bg-red-400";
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <RecruitHeader />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0a66c2]">Application tracker</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">My Applications</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Track every job you've applied to, check current status, and continue applying with the same saved email.</p>
          <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">Status updates in one place</div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">AI match score where available</div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">Assessment progress included</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Enter your application email</p>
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={inputEmail}
              onChange={e => setInputEmail(e.target.value)}
              placeholder="you@email.com"
              className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition"
              required
            />
            <button type="submit" disabled={loading} className="shrink-0 rounded-lg bg-[#0a66c2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition">
              {loading ? "…" : "Search"}
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Looking up your applications…
            </div>
          </div>
        )}

        {!loading && searched && applications.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="text-4xl mb-3">📭</div>
            <h2 className="font-bold text-slate-800">No applications found</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
              We couldn't find any applications for <strong>{email}</strong>. Make sure you used this email when applying.
            </p>
            <Link href="/recruit/opportunities" className="mt-5 inline-block rounded-full bg-[#0a66c2] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition">
              Browse & apply to jobs
            </Link>
          </div>
        )}

        {!loading && applications.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              {applications.length} application{applications.length !== 1 ? "s" : ""} found
            </p>
            {applications.map(app => {
              const pct = scorePercent(app);
              const meta = STAGE_META[app.stage] || { label: app.stage, color: "bg-slate-100 text-slate-600 border-slate-200", icon: "•" };
              return (
                <div key={app._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#0a66c2]/30">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-base font-black text-[#0a66c2]">
                        {(app.job?.companyName || app.job?.title || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-2">
                          <h3 className="font-bold text-slate-900 leading-snug">{app.job?.title || "Unknown job"}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.color}`}>
                            {meta.icon} {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {app.job?.companyName || "Company"}
                          {app.job?.location ? ` · ${app.job.location}` : ""}
                          {app.job?.workMode ? ` · ${app.job.workMode}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">Applied {timeAgo(app.appliedAt)}</p>
                      </div>
                      {app.job && (
                        <Link href={`/recruit/opportunities/${app.jobId}`} className="shrink-0 hidden sm:inline-flex rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition whitespace-nowrap">
                          View job
                        </Link>
                      )}
                    </div>

                    {(pct !== null || app.assessmentStatus !== "not_sent") && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4">
                        {pct !== null && (
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden min-w-[80px]">
                              <div
                                className={`h-full rounded-full transition-all ${getScoreColor(pct)}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700 shrink-0">{pct}% match</span>
                          </div>
                        )}
                        {app.assessmentStatus === "sent" && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">⏳ Assessment pending</span>
                        )}
                        {app.assessmentStatus === "completed" && (
                          <span className="rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700">✓ Assessment submitted</span>
                        )}
                      </div>
                    )}

                    {app.job && (
                      <div className="mt-3 sm:hidden">
                        <Link href={`/recruit/opportunities/${app.jobId}`} className="inline-flex rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                          View job →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function MyApplicationsPage() {
  return <RecruitGuard requiredRole="seeker"><MyApplicationsContent /></RecruitGuard>;
}
