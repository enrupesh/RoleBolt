"use client";

import { useState, useEffect, useCallback } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { Sk, SkStatCard, SkSectionCard } from "@/components/Skeleton";

type FunnelStage = { stage: string; count: number; dropoffPct: number };
type SourceEntry = { source: string; count: number; pct: number };
type GenderEntry = { gender: string; count: number; pct: number };
type AgeEntry = { ageRange: string; count: number; pct: number };
type JobStat = {
  jobId: string; title: string; department: string; status: string;
  totalCandidates: number; avgScorePct: number; hired: number; rejected: number; createdAt: string;
};

type Analytics = {
  totalJobs: number;
  activeJobs: number;
  totalCandidates: number;
  stageCounts: Record<string, number>;
  funnelDropoff: FunnelStage[];
  avgTimeToHireDays: number | null;
  sourceBreakdown: SourceEntry[];
  genderBreakdown: GenderEntry[];
  ageBreakdown: AgeEntry[];
  biasStageData: Record<string, Record<string, number>>;
  jobStats: JobStat[];
};

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-slate-400",
  review_zone: "bg-amber-500",
  screened: "bg-blue-500",
  assessed: "bg-violet-500",
  interview: "bg-amber-500",
  offer: "bg-sky-500",
  hired: "bg-emerald-500",
  rejected: "bg-rose-500",
};

const STAGE_TEXT: Record<string, string> = {
  applied: "text-slate-600",
  review_zone: "text-amber-700",
  screened: "text-blue-600",
  assessed: "text-violet-600",
  interview: "text-amber-600",
  offer: "text-sky-600",
  hired: "text-emerald-600",
  rejected: "text-rose-600",
};

function BarFill({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`absolute inset-y-0 left-0 rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, accent = "text-slate-900", bar = "from-slate-300 to-slate-400" }: { label: string; value: string | number; sub?: string; accent?: string; bar?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-black/[0.06] p-4
      shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${bar}`} />
      <p className={`text-[26px] font-bold leading-none tabular-nums mt-1 ${accent}`}>{value}</p>
      <p className="mt-2 text-[11px] font-semibold text-slate-800 leading-snug">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</h2>
        {badge}
      </div>
      <div className="rounded-2xl bg-white border border-black/[0.06] p-6
        shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]">
        {children}
      </div>
    </section>
  );
}

function BackIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
}

function ChartBarIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

function RefreshIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/></svg>;
}

function RecruitAnalyticsContent() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (sessionToken) setToken(sessionToken);
  }, [sessionToken]);

  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/analytics"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await readApiJson(res);
      if (!res.ok) throw new Error(json.error || "Failed to load analytics.");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const hired = data?.stageCounts?.hired ?? 0;
  const rejected = data?.stageCounts?.rejected ?? 0;
  const total = data?.totalCandidates ?? 0;
  const hireRate = total > 0 ? Math.round((hired / total) * 100) : 0;
  const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

  const hasBiasData = (data?.genderBreakdown?.length ?? 0) > 0 || (data?.ageBreakdown?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-black/[0.07] shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Link href="/recruit/dashboard" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              <BackIcon />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <ChartBarIcon size={13} />
              </div>
              <span className="text-[13px] font-bold text-slate-900">Analytics</span>
            </div>
          </div>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600
              shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/40 transition"
          >
            <RefreshIcon /> Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

        {/* ── Page title ────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900 leading-tight">Recruiting Analytics</h1>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">Pipeline health, source performance, and hiring outcomes at a glance.</p>
        </div>

        {loading ? (
          <div className="space-y-8 animate-[rb-fade-in_0.3s_ease_both]">
            {/* Stats skeleton */}
            <section>
              <Sk className="h-3 w-20 rounded-full mb-4" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => <SkStatCard key={i} />)}
              </div>
            </section>
            {/* Funnel + Source skeletons */}
            <SkSectionCard rows={6} />
            <SkSectionCard rows={4} />
            {/* Job table skeleton */}
            <div className="rounded-2xl bg-white border border-black/[0.06] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <Sk className="h-3 w-24 rounded-full mb-5" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Sk className="h-4 flex-1 rounded-full" />
                    <Sk className="h-4 w-12 rounded-full" />
                    <Sk className="h-4 w-12 rounded-full" />
                    <Sk className="h-4 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-medium text-rose-600 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">{error}</div>
        ) : data ? (
          <>
            {/* Summary Stats */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-4">Overview</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total Jobs" value={data.totalJobs} accent="text-slate-900" bar="from-slate-300 to-slate-400" />
                <StatCard label="Active Roles" value={data.activeJobs} accent="text-emerald-600" bar="from-emerald-400 to-emerald-500" sub="hiring now" />
                <StatCard label="Total Candidates" value={data.totalCandidates} accent="text-blue-600" bar="from-blue-400 to-blue-600" sub="in pipeline" />
                <StatCard label="Hired" value={hired} sub={`${hireRate}% hire rate`} accent="text-teal-600" bar="from-teal-400 to-teal-500" />
                <StatCard label="Rejected" value={rejected} sub={`${rejectionRate}% rejection rate`} accent="text-rose-600" bar="from-rose-400 to-rose-500" />
                <StatCard
                  label="Avg. Time to Hire"
                  value={data.avgTimeToHireDays !== null ? `${data.avgTimeToHireDays}d` : "—"}
                  sub={data.avgTimeToHireDays !== null ? "from job creation" : "No hires yet"}
                  accent={data.avgTimeToHireDays !== null ? "text-amber-600" : "text-slate-400"}
                  bar={data.avgTimeToHireDays !== null ? "from-amber-400 to-amber-500" : "from-slate-200 to-slate-300"}
                />
              </div>
            </section>

            {/* Pipeline Funnel */}
            <SectionCard title="Pipeline Funnel — Stage Distribution">
              <div className="space-y-4">
                {data.funnelDropoff.map(({ stage, count, dropoffPct }) => (
                  <div key={stage} className="flex items-center gap-4">
                    <span className={`w-20 shrink-0 text-[12px] font-semibold capitalize ${STAGE_TEXT[stage] ?? "text-slate-600"}`}>{stage}</span>
                    <div className="flex-1">
                      <BarFill pct={dropoffPct} color={STAGE_COLORS[stage] ?? "bg-slate-400"} />
                    </div>
                    <span className="w-24 text-right text-[12px] text-slate-600 font-medium">{count} <span className="text-slate-400 font-normal">({dropoffPct}%)</span></span>
                  </div>
                ))}
                {data.stageCounts.rejected > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="w-20 shrink-0 text-[12px] font-semibold capitalize text-rose-600">rejected</span>
                    <div className="flex-1">
                      <BarFill pct={Math.round((data.stageCounts.rejected / total) * 100)} color="bg-rose-500" />
                    </div>
                    <span className="w-24 text-right text-[12px] text-slate-600 font-medium">
                      {data.stageCounts.rejected} <span className="text-slate-400 font-normal">({Math.round((data.stageCounts.rejected / total) * 100)}%)</span>
                    </span>
                  </div>
                )}
              </div>
              {total === 0 && (
                <p className="text-center text-[13px] text-slate-400 py-8">No candidates yet. Add candidates to jobs to see funnel data.</p>
              )}
            </SectionCard>

            {/* Source Quality */}
            <SectionCard title="Source Quality">
              {data.sourceBreakdown.length > 0 ? (
                <div className="space-y-3.5">
                  {data.sourceBreakdown.map(({ source, count, pct }) => (
                    <div key={source} className="flex items-center gap-4">
                      <span className="w-36 shrink-0 text-[12px] font-medium text-slate-600 truncate">{source}</span>
                      <div className="flex-1">
                        <BarFill pct={pct} color="bg-blue-500" />
                      </div>
                      <span className="w-24 text-right text-[12px] text-slate-600 font-medium">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400 text-center py-6 leading-relaxed">
                  No source data yet. When adding candidates, select the source (LinkedIn, Naukri, Referral, etc.) to track which channels work best.
                </p>
              )}
            </SectionCard>

            {/* Bias Detection */}
            <SectionCard
              title="Bias Detection Report"
              badge={<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Beta</span>}
            >
              {!hasBiasData ? (
                <div className="space-y-3">
                  <p className="text-[13px] font-medium text-slate-700">Bias detection requires demographic data.</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    To enable this report, provide optional gender and age range fields when editing candidate profiles. This data is voluntary, never inferred from resumes, and used only to surface statistical hiring patterns — not to filter or rank candidates.
                  </p>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">What this report will show when data is available:</p>
                    <ul className="text-[12px] text-slate-500 space-y-1 mt-2 list-disc list-inside leading-relaxed">
                      <li>Gender distribution across all applicants</li>
                      <li>Age range distribution across all applicants</li>
                      <li>Gender breakdown by pipeline stage (hired vs. rejected comparison)</li>
                      <li>Patterns that may suggest unintentional bias in screening</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {data.genderBreakdown.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Gender Distribution</p>
                      <div className="space-y-2.5">
                        {data.genderBreakdown.map(({ gender, count, pct }) => (
                          <div key={gender} className="flex items-center gap-3">
                            <span className="w-20 shrink-0 text-[12px] font-medium text-slate-600 capitalize">{gender}</span>
                            <div className="flex-1"><BarFill pct={pct} color="bg-violet-500" /></div>
                            <span className="w-16 text-right text-[12px] text-slate-600 font-medium">{count} ({pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.ageBreakdown.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Age Range Distribution</p>
                      <div className="space-y-2.5">
                        {data.ageBreakdown.map(({ ageRange, count, pct }) => (
                          <div key={ageRange} className="flex items-center gap-3">
                            <span className="w-20 shrink-0 text-[12px] font-medium text-slate-600">{ageRange}</span>
                            <div className="flex-1"><BarFill pct={pct} color="bg-sky-500" /></div>
                            <span className="w-16 text-right text-[12px] text-slate-600 font-medium">{count} ({pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.keys(data.biasStageData).length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Gender by Pipeline Stage</p>
                      <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="text-left text-slate-500 py-2.5 pl-4 pr-4 font-semibold uppercase text-[10px] tracking-wide">Stage</th>
                              {Array.from(new Set(Object.values(data.biasStageData).flatMap(g => Object.keys(g)))).map(g => (
                                <th key={g} className="text-right text-slate-500 py-2.5 px-3 font-semibold capitalize uppercase text-[10px] tracking-wide">{g}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(data.biasStageData).map(([stage, gMap], idx, arr) => (
                              <tr key={stage} className={idx !== arr.length - 1 ? "border-b border-slate-100" : ""}>
                                <td className={`py-2.5 pl-4 pr-4 font-semibold capitalize ${STAGE_TEXT[stage] ?? "text-slate-600"}`}>{stage}</td>
                                {Array.from(new Set(Object.values(data.biasStageData).flatMap(g => Object.keys(g)))).map(g => (
                                  <td key={g} className="py-2.5 px-3 text-right text-slate-600 font-medium">{gMap[g] ?? 0}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Per-Job Stats */}
            {data.jobStats.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-4">Per-Job Breakdown</h2>
                <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden
                  shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                          <th className="text-left px-5 py-3 font-bold">Role</th>
                          <th className="text-center px-4 py-3 font-bold">Status</th>
                          <th className="text-center px-4 py-3 font-bold">Candidates</th>
                          <th className="text-center px-4 py-3 font-bold">Avg Score</th>
                          <th className="text-center px-4 py-3 font-bold">Hired</th>
                          <th className="text-center px-4 py-3 font-bold">Rejected</th>
                          <th className="text-right px-5 py-3 font-bold">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.jobStats.map((j, idx) => (
                          <tr key={j.jobId} className={`hover:bg-blue-50/30 transition ${idx !== data.jobStats.length - 1 ? "border-b border-slate-100" : ""}`}>
                            <td className="px-5 py-3.5">
                              <Link href={`/recruit/jobs/${j.jobId}`} className="text-slate-900 hover:text-blue-700 transition font-semibold">{j.title}</Link>
                              {j.department && <p className="text-[11px] text-slate-400 mt-0.5">{j.department}</p>}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                                j.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : j.status === "paused" ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}>{j.status}</span>
                            </td>
                            <td className="px-4 py-3.5 text-center text-slate-700 font-medium">{j.totalCandidates}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-bold ${j.avgScorePct >= 70 ? "text-emerald-600" : j.avgScorePct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                                {j.totalCandidates > 0 ? `${j.avgScorePct}%` : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center text-emerald-600 font-semibold">{j.hired || "—"}</td>
                            <td className="px-4 py-3.5 text-center text-rose-600 font-semibold">{j.rejected || "—"}</td>
                            <td className="px-5 py-3.5 text-right text-[11px] text-slate-400 font-medium">
                              {new Date(j.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function RecruitAnalyticsPage() {
  return <RecruitGuard requiredRole="creator"><RecruitAnalyticsContent /></RecruitGuard>;
}
