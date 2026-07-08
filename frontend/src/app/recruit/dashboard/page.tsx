"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { RecruitGuard } from "@/components/RecruitGuard";

type Job = {
  _id: string;
  title: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  status: "active" | "paused" | "closed";
  candidateCount: number;
  createdAt: string;
};

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

function BriefcaseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}

function UsersIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

const STATUS_MAP = {
  active: { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Active" },
  paused: { pill: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500", label: "Paused" },
  closed: { pill: "bg-slate-100 text-slate-500 border border-slate-200", dot: "bg-slate-400", label: "Closed" },
};

const WORK_MODE_LABELS: Record<string, string> = {
  remote: "Remote", onsite: "On-site", hybrid: "Hybrid",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const SEEN_COUNTS_KEY = "recruit_dashboard_seen_counts";
function loadSeenCounts(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SEEN_COUNTS_KEY) || "{}"); } catch { return {}; }
}
function saveSeenCounts(counts: Record<string, number>) {
  try { localStorage.setItem(SEEN_COUNTS_KEY, JSON.stringify(counts)); } catch {}
}

type PipelineSummary = {
  total: number;
  shortlisted: number;
  interview: number;
  hired: number;
  offer: number;
};

function RecruitDashboardContent() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "closed">("all");
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { const t = await u.getIdToken(); setToken(t); }
      else router.push("/login");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => { setSeenCounts(loadSeenCounts()); }, []);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [jobsRes, pipelineRes] = await Promise.all([
        fetch(apiUrl("/recruit/jobs"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/recruit/pipeline-summary"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const jobsData = await readApiJson(jobsRes);
      setJobs(jobsData.jobs ?? []);
      if (pipelineRes.ok) {
        const pd = await readApiJson(pipelineRes);
        setPipeline(pd);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  function markJobSeen(jobId: string, count: number) {
    const updated = { ...seenCounts, [jobId]: count };
    setSeenCounts(updated);
    saveSeenCounts(updated);
  }

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = jobs.filter(j => filter === "all" || j.status === filter);
  const activeJobs = jobs.filter(j => j.status === "active").length;

  const stats = [
    { label: "Active Roles", value: activeJobs, accent: "text-emerald-600", sub: "hiring now" },
    { label: "Total Candidates", value: pipeline?.total ?? jobs.reduce((s, j) => s + (j.candidateCount || 0), 0), accent: "text-blue-700", sub: "in pipeline" },
    { label: "Shortlisted", value: pipeline?.shortlisted ?? 0, accent: "text-violet-600", sub: "screened + assessed" },
    { label: "Interview", value: pipeline?.interview ?? 0, accent: "text-amber-600", sub: "at interview stage" },
    { label: "Hired", value: pipeline?.hired ?? 0, accent: "text-emerald-700", sub: "all time" },
    { label: "Closed Roles", value: jobs.filter(j => j.status === "closed").length, accent: "text-slate-400", sub: "completed" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 shadow">
              <img src="/plyndrox-logo.svg" alt="" className="h-10 w-10 object-contain plyndrox-logo-img" draggable={false} />
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900 leading-none">Plyndrox Recruit AI</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">Dashboard</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/recruit/talent-pool"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition">
              <UsersIcon /> Talent Pool
            </Link>
            <Link href="/recruit/analytics"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition">
              <BarChartIcon /> Analytics
            </Link>
            <Link href="/recruit/company-profile"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition">
              Company Profile
            </Link>
          </nav>

          <Link href="/recruit/jobs/new"
            className="flex items-center gap-1.5 rounded-xl bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition">
            <PlusIcon /> Post a Job
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Recruitment Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">Manage all your open roles and candidate pipelines from one place.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700">{s.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {(["all", "active", "paused", "closed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
                filter === f
                  ? "bg-blue-700 text-white shadow"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {f === "all" ? "All Jobs" : f}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">{filtered.length} role{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading jobs...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 mb-5">
              <BriefcaseIcon size={28} />
            </div>
            <h2 className="text-base font-semibold text-slate-800">
              {filter === "all" ? "No jobs yet" : `No ${filter} jobs`}
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xs">
              {filter === "all"
                ? "Post your first job and let AI generate the full job description and scoring rubric in 30 seconds."
                : `You don't have any ${filter} jobs right now.`}
            </p>
            {filter === "all" && (
              <Link href="/recruit/jobs/new"
                className="mt-6 flex items-center gap-2 rounded-xl bg-[#0a66c2] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition">
                <PlusIcon /> Post First Job
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(job => {
              const s = STATUS_MAP[job.status] ?? STATUS_MAP.closed;
              const lastSeen = seenCounts[job._id] ?? 0;
              const newCount = Math.max(0, (job.candidateCount || 0) - lastSeen);
              const hasNew = newCount > 0 && lastSeen > 0;

              return (
                <Link
                  key={job._id}
                  href={`/recruit/jobs/${job._id}`}
                  onClick={() => markJobSeen(job._id, job.candidateCount || 0)}
                  className="group relative flex flex-col rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <BriefcaseIcon size={18} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {hasNew && (
                        <span className="rounded-full bg-blue-700 px-2 py-0.5 text-[10px] font-bold text-white">
                          +{newCount} new
                        </span>
                      )}
                      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition line-clamp-1 mb-0.5">
                    {job.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {job.seniority}{job.department ? ` · ${job.department}` : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><MapPinIcon /> {job.location}</span>
                    <span>{WORK_MODE_LABELS[job.workMode] ?? job.workMode}</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${hasNew ? "text-blue-700" : "text-slate-500"}`}>
                      <UsersIcon /> {job.candidateCount || 0} candidate{job.candidateCount !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      {timeAgo(job.createdAt)}
                      <ChevronRightIcon />
                    </div>
                  </div>
                </Link>
              );
            })}

            <Link
              href="/recruit/jobs/new"
              className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center hover:border-blue-300 hover:bg-blue-50/40 transition-all"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-600 transition mb-3">
                <PlusIcon />
              </div>
              <p className="text-sm font-semibold text-slate-500 group-hover:text-blue-700 transition">New Job Posting</p>
              <p className="mt-1 text-xs text-slate-400">AI generates the JD in 30 seconds</p>
            </Link>
          </div>
        )}

        <div className="mt-8 md:hidden flex flex-wrap gap-2">
          <Link href="/recruit/talent-pool"
            className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-700 shadow-sm">
            <UsersIcon /> Talent Pool
          </Link>
          <Link href="/recruit/analytics"
            className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-700 shadow-sm">
            <BarChartIcon /> Analytics
          </Link>
          <Link href="/recruit/company-profile"
            className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-700 shadow-sm">
            Company Profile
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function RecruitDashboardPage() {
  return <RecruitGuard requiredRole="creator"><RecruitDashboardContent /></RecruitGuard>;
}
