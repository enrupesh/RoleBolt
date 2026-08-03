"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { apiUrl } from "@/lib/api";

type Application = {
  id: string; jobId: string; jobTitle: string; companyName: string;
  location: string; workMode: string; stage: string;
  totalScore: number; maxScore: number; appliedAt: string; stageMovedAt?: string;
};

const STAGE_ORDER = ["applied", "screened", "assessed", "interview", "offer", "hired", "rejected"];
const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  applied:   { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  screened:  { bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-400" },
  assessed:  { bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400" },
  interview: { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  offer:     { bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-400" },
  hired:     { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  rejected:  { bg: "bg-rose-50",    text: "text-rose-700",    dot: "bg-rose-400" },
};

function ScoreBar({ score, max }: { score: number; max: number }) {
  if (!max) return null;
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600">{pct}%</span>
    </div>
  );
}

function ApplicationsContent() {
  const { sessionToken } = useRecruitAuth();
  const [token, setToken]           = useState<string | null>(null);
  const [applications, setApps]     = useState<Application[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<string>("all");

  useEffect(() => { if (sessionToken) setToken(sessionToken); }, [sessionToken]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(apiUrl("/recruit/seeker/applications"), { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load applications");
        setApps(d.applications ?? []);
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = filter === "all" ? applications : applications.filter(a => a.stage === filter);

  const counts: Record<string, number> = { all: applications.length };
  for (const s of STAGE_ORDER) counts[s] = applications.filter(a => a.stage === s).length;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rolebolt Applications</h1>
            <p className="mt-1 text-sm text-slate-500">{applications.length} applications on Rolebolt</p>
          </div>
          <Link href="/seeker/tracker" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
            View full tracker (all platforms) →
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {["all", ...STAGE_ORDER.filter(s => counts[s] > 0)].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filter === s ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}>
              {s} {counts[s] > 0 && <span className="ml-1 opacity-70">({counts[s]})</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-3xl bg-white animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-semibold text-slate-900">No applications yet</p>
            <p className="mt-1 text-sm text-slate-500">
              {filter === "all" ? "Browse jobs and apply with your saved profile" : `No applications in "${filter}" stage`}
            </p>
            {filter === "all" && (
              <Link href="/recruit/opportunities"
                className="mt-4 inline-block rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition">
                Browse Jobs
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(app => {
              const c = STAGE_COLORS[app.stage] ?? STAGE_COLORS.applied;
              return (
                <div key={app.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 truncate">{app.jobTitle}</h3>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${c.bg} ${c.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                          {app.stage}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {app.companyName}{app.location ? ` · ${app.location}` : ""}{app.workMode ? ` · ${app.workMode}` : ""}
                      </p>
                      {app.jobId && (
                        <Link href={`/recruit/opportunities/${app.jobId}`} className="mt-2 inline-block text-xs font-bold text-indigo-600 hover:text-indigo-700">
                          View job posting →
                        </Link>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <ScoreBar score={app.totalScore} max={app.maxScore} />
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        Applied {new Date(app.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Stage progress */}
                  <div className="mt-4 flex items-center gap-1">
                    {STAGE_ORDER.filter(s => s !== "rejected").map((s, i) => {
                      const idx    = STAGE_ORDER.filter(x => x !== "rejected").indexOf(app.stage);
                      const active = STAGE_ORDER.filter(x => x !== "rejected").indexOf(s) <= idx && app.stage !== "rejected";
                      return (
                        <div key={s} className="flex-1 flex items-center gap-1">
                          <div className={`h-1.5 w-full rounded-full transition-colors ${active ? "bg-indigo-500" : "bg-slate-100"}`} />
                          {i === 0 && <span className="sr-only">{s}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between">
                    {STAGE_ORDER.filter(s => s !== "rejected").map(s => (
                      <span key={s} className="text-[9px] text-slate-400 capitalize">{s}</span>
                    ))}
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

export default function SeekerApplicationsPage() {
  return <RecruitGuard requiredRole="seeker"><ApplicationsContent /></RecruitGuard>;
}
