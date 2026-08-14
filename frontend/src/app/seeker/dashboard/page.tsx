"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { displayHandle } from "@/lib/username";
import { apiUrl } from "@/lib/api";
import { ReviewModal } from "@/components/ReviewModal";

import type { CareerGpsPayload } from "@/lib/seekerTypes";

type Application = {
  id: string; jobId: string; jobTitle: string; companyName: string;
  location: string; workMode: string; stage: string;
  totalScore: number; maxScore: number; appliedAt: string;
};

type SavedJob = {
  id: string; title: string; companyName: string; location: string;
  workMode: string; seniority: string; salaryMin?: number; salaryMax?: number; salaryCurrency?: string;
};

const STAGE_COLORS: Record<string, string> = {
  applied:   "bg-blue-100 text-blue-700",
  screened:  "bg-indigo-100 text-indigo-700",
  assessed:  "bg-purple-100 text-purple-700",
  interview: "bg-amber-100 text-amber-700",
  offer:     "bg-green-100 text-green-700",
  hired:     "bg-emerald-100 text-emerald-700",
  rejected:  "bg-rose-100 text-rose-700",
};

const AI_TOOLS = [
  { href: "/seeker/career",         icon: "🧭", label: "Career GPS",                  desc: "Your personalized next actions" },
  { href: "/seeker/tracker",        icon: "📋", label: "Application Tracker",         desc: "All applications — any platform" },
  { href: "/seeker/workspace",      icon: "✦",  label: "Universal Job Workspace",     desc: "Analyze any job from any website" },
  { href: "/seeker/email",          icon: "📧", label: "Email Intelligence",          desc: "Parse recruiter emails instantly" },
  { href: "/seeker/extension",      icon: "🧩", label: "Browser Extension",           desc: "Live AI on LinkedIn, Indeed & more" },
  { href: "/seeker/resume",         icon: "📄", label: "AI Resume Builder",           desc: "Build or improve your resume" },
  { href: "/seeker/cover-letter",   icon: "✉️",  label: "Cover Letter Generator",      desc: "Personalized cover letters in seconds" },
  { href: "/seeker/interview-prep", icon: "🎤",  label: "Interview Prep",               desc: "Mock interviews with AI feedback" },
  { href: "/recruit/opportunities", icon: "🔍",  label: "Browse Jobs",                  desc: "Explore all open positions" },
];

function DashboardContent() {
  const { sessionToken, authUser, recruitProfile } = useRecruitAuth();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs]       = useState<SavedJob[]>([]);
  const [gps, setGps]                   = useState<CareerGpsPayload | null>(null);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState("");

  useEffect(() => { if (sessionToken) setToken(sessionToken); }, [sessionToken]);

  useEffect(() => {
    if (!token) return;
    setFetchError("");
    Promise.all([
      fetch(apiUrl("/recruit/seeker/applications"), { headers: { Authorization: `Bearer ${token}` } }),
      fetch(apiUrl("/recruit/seeker/saved-jobs"),   { headers: { Authorization: `Bearer ${token}` } }),
      fetch(apiUrl("/recruit/seeker/career-gps"),   { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([appsRes, savedRes, gpsRes]) => {
      if (!appsRes.ok || !savedRes.ok) throw new Error("Could not load dashboard data");
      const [apps, saved, gpsData] = await Promise.all([appsRes.json(), savedRes.json(), gpsRes.ok ? gpsRes.json() : { gps: null }]);
      setApplications(apps.applications ?? []);
      setSavedJobs(saved.jobs ?? []);
      setGps(gpsData.gps ?? null);
    }).catch(e => setFetchError(e.message)).finally(() => setLoading(false));
  }, [token]);

  const recentApps = applications.slice(0, 4);
  const activeCount = applications.filter(a => !["rejected", "hired"].includes(a.stage)).length;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Hey {displayHandle(authUser ?? recruitProfile)}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here&apos;s your job search overview.</p>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600"
          >
            Write a review
          </button>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{fetchError}</div>
        )}

        {gps && !loading && (
          <Link href="/seeker/career" className="mb-6 block rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-lg transition hover:shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Career GPS</p>
                <p className="mt-1 text-lg font-black">Momentum: {gps.momentumScore}/100</p>
                <p className="mt-1 text-sm text-indigo-100">{gps.nextActions[0]?.title ?? "You're on track"}</p>
              </div>
              <span className="text-3xl">🧭</span>
            </div>
          </Link>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Applications", value: applications.length, color: "text-indigo-600" },
            { label: "Active Processes",   value: activeCount, color: "text-amber-600" },
            { label: "Interviews",         value: applications.filter(a => a.stage === "interview").length, color: "text-purple-600" },
            { label: "Saved Jobs",         value: savedJobs.length, color: "text-green-600" },
          ].map(s => (
            <div key={s.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className={`text-3xl font-bold ${s.color}`}>{loading ? "—" : s.value}</p>
              <p className="mt-1 text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Applications */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">Recent Applications</h2>
              <Link href="/seeker/tracker" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                Full tracker →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : recentApps.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm font-medium text-slate-700">No applications yet</p>
                <p className="text-xs text-slate-400 mt-1">Browse jobs and apply with one click using your saved profile</p>
                <Link href="/recruit/opportunities"
                  className="mt-4 inline-block rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">
                  Browse Jobs
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentApps.map(app => (
                  <div key={app.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{app.jobTitle}</p>
                      <p className="text-xs text-slate-500 truncate">{app.companyName} · {app.location}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {app.maxScore > 0 && (
                        <span className="text-xs font-bold text-slate-600">
                          {Math.round((app.totalScore / app.maxScore) * 100)}%
                        </span>
                      )}
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${STAGE_COLORS[app.stage] ?? "bg-slate-100 text-slate-600"}`}>
                        {app.stage}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Tools */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">AI Tools</h2>
              <div className="space-y-2">
                {AI_TOOLS.map(tool => (
                  <Link key={tool.href} href={tool.href}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50">
                    <span className="text-xl">{tool.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{tool.label}</p>
                      <p className="text-xs text-slate-500 truncate">{tool.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Saved Jobs */}
            {savedJobs.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-bold text-slate-900 mb-4">Saved Jobs ({savedJobs.length})</h2>
                <div className="space-y-2">
                  {savedJobs.slice(0, 3).map(job => (
                    <Link key={job.id} href={`/recruit/opportunities/${job.id}`}
                      className="block rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:border-indigo-200 hover:bg-indigo-50">
                      <p className="text-sm font-semibold text-slate-900 truncate">{job.title}</p>
                      <p className="text-xs text-slate-500 truncate">{job.companyName} · {job.workMode}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} />}
    </div>
  );
}

export default function SeekerDashboard() {
  return <RecruitGuard requiredRole="seeker"><DashboardContent /></RecruitGuard>;
}
