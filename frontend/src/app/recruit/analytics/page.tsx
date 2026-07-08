"use client";

import { useState, useEffect, useCallback } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";

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
  applied: "bg-zinc-500",
  screened: "bg-blue-500",
  assessed: "bg-violet-500",
  interview: "bg-amber-500",
  offer: "bg-sky-500",
  hired: "bg-emerald-500",
  rejected: "bg-rose-500",
};

const STAGE_TEXT: Record<string, string> = {
  applied: "text-gray-500",
  screened: "text-blue-600",
  assessed: "text-violet-600",
  interview: "text-amber-600",
  offer: "text-sky-600",
  hired: "text-emerald-600",
  rejected: "text-rose-600",
};

function BarFill({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-2 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
      <div className={`absolute inset-y-0 left-0 rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, accent = "text-[var(--foreground)]" }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{label}</p>
      {sub && <p className="mt-1 text-[10px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

function BackIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
}

function ChartBarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

function RecruitAnalyticsContent() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { const t = await u.getIdToken(); setToken(t); }
      else router.push("/login");
    });
    return () => unsub();
  }, [router]);

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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      <header className="relative z-10 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-sm sticky top-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/recruit/dashboard" className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--foreground)] transition text-xs">
              <BackIcon /> Dashboard
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-500">
                <ChartBarIcon />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">Analytics</span>
            </div>
          </div>
          <button onClick={fetchAnalytics} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition">
            Refresh
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-3 text-[var(--text-muted)] text-sm">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading analytics...
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-6 text-center text-sm text-rose-500">{error}</div>
        ) : data ? (
          <>
            {/* Summary Stats */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">Overview</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total Jobs" value={data.totalJobs} accent="text-[var(--foreground)]" />
                <StatCard label="Active Roles" value={data.activeJobs} accent="text-emerald-600" />
                <StatCard label="Total Candidates" value={data.totalCandidates} accent="text-indigo-600" />
                <StatCard label="Hired" value={hired} sub={`${hireRate}% hire rate`} accent="text-emerald-600" />
                <StatCard label="Rejected" value={rejected} sub={`${rejectionRate}% rejection rate`} accent="text-rose-600" />
                <StatCard
                  label="Avg. Time to Hire"
                  value={data.avgTimeToHireDays !== null ? `${data.avgTimeToHireDays}d` : "—"}
                  sub={data.avgTimeToHireDays !== null ? "from job creation" : "No hires yet"}
                  accent={data.avgTimeToHireDays !== null ? "text-amber-600" : "text-[var(--text-muted)]"}
                />
              </div>
            </section>

            {/* Pipeline Funnel */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">Pipeline Funnel — Stage Distribution</h2>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                <div className="space-y-4">
                  {data.funnelDropoff.map(({ stage, count, dropoffPct }) => (
                    <div key={stage} className="flex items-center gap-4">
                      <span className={`w-20 shrink-0 text-xs font-medium capitalize ${STAGE_TEXT[stage] ?? "text-[var(--text-secondary)]"}`}>{stage}</span>
                      <div className="flex-1">
                        <BarFill pct={dropoffPct} color={STAGE_COLORS[stage] ?? "bg-zinc-500"} />
                      </div>
                      <span className="w-20 text-right text-xs text-[var(--text-secondary)]">{count} <span className="text-[var(--text-muted)]">({dropoffPct}%)</span></span>
                    </div>
                  ))}
                  {data.stageCounts.rejected > 0 && (
                    <div className="flex items-center gap-4">
                      <span className="w-20 shrink-0 text-xs font-medium capitalize text-rose-600">rejected</span>
                      <div className="flex-1">
                        <BarFill pct={Math.round((data.stageCounts.rejected / total) * 100)} color="bg-rose-500" />
                      </div>
                      <span className="w-20 text-right text-xs text-[var(--text-secondary)]">
                        {data.stageCounts.rejected} <span className="text-[var(--text-muted)]">({Math.round((data.stageCounts.rejected / total) * 100)}%)</span>
                      </span>
                    </div>
                  )}
                </div>
                {total === 0 && (
                  <p className="text-center text-sm text-[var(--text-muted)] py-8">No candidates yet. Add candidates to jobs to see funnel data.</p>
                )}
              </div>
            </section>

            {/* Source Quality */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">Source Quality</h2>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                {data.sourceBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {data.sourceBreakdown.map(({ source, count, pct }) => (
                      <div key={source} className="flex items-center gap-4">
                        <span className="w-36 shrink-0 text-xs text-[var(--text-secondary)] truncate">{source}</span>
                        <div className="flex-1">
                          <BarFill pct={pct} color="bg-indigo-500" />
                        </div>
                        <span className="w-20 text-right text-xs text-[var(--text-secondary)]">{count} <span className="text-[var(--text-muted)]">({pct}%)</span></span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] text-center py-6">
                    No source data yet. When adding candidates, select the source (LinkedIn, Naukri, Referral, etc.) to track which channels work best.
                  </p>
                )}
              </div>
            </section>

            {/* Bias Detection */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Bias Detection Report</h2>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Beta</span>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                {!hasBiasData ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--text-secondary)]">Bias detection requires demographic data.</p>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      To enable this report, provide optional gender and age range fields when editing candidate profiles. This data is voluntary, never inferred from resumes, and used only to surface statistical hiring patterns — not to filter or rank candidates.
                    </p>
                    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-1">
                      <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">What this report will show when data is available:</p>
                      <ul className="text-xs text-[var(--text-muted)] space-y-1 mt-2 list-disc list-inside">
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
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Gender Distribution</p>
                        <div className="space-y-2">
                          {data.genderBreakdown.map(({ gender, count, pct }) => (
                            <div key={gender} className="flex items-center gap-3">
                              <span className="w-20 shrink-0 text-xs text-[var(--text-secondary)] capitalize">{gender}</span>
                              <div className="flex-1"><BarFill pct={pct} color="bg-violet-500" /></div>
                              <span className="w-16 text-right text-xs text-[var(--text-secondary)]">{count} ({pct}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.ageBreakdown.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Age Range Distribution</p>
                        <div className="space-y-2">
                          {data.ageBreakdown.map(({ ageRange, count, pct }) => (
                            <div key={ageRange} className="flex items-center gap-3">
                              <span className="w-20 shrink-0 text-xs text-[var(--text-secondary)]">{ageRange}</span>
                              <div className="flex-1"><BarFill pct={pct} color="bg-sky-500" /></div>
                              <span className="w-16 text-right text-xs text-[var(--text-secondary)]">{count} ({pct}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.keys(data.biasStageData).length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Gender by Pipeline Stage</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border)]">
                                <th className="text-left text-[var(--text-muted)] pb-2 pr-4 font-medium">Stage</th>
                                {Array.from(new Set(Object.values(data.biasStageData).flatMap(g => Object.keys(g)))).map(g => (
                                  <th key={g} className="text-right text-[var(--text-muted)] pb-2 px-2 font-medium capitalize">{g}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(data.biasStageData).map(([stage, gMap]) => (
                                <tr key={stage} className="border-b border-[var(--border)]">
                                  <td className={`py-2 pr-4 font-medium capitalize ${STAGE_TEXT[stage] ?? "text-[var(--text-secondary)]"}`}>{stage}</td>
                                  {Array.from(new Set(Object.values(data.biasStageData).flatMap(g => Object.keys(g)))).map(g => (
                                    <td key={g} className="py-2 px-2 text-right text-[var(--text-secondary)]">{gMap[g] ?? 0}</td>
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
              </div>
            </section>

            {/* Per-Job Stats */}
            {data.jobStats.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">Per-Job Breakdown</h2>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                          <th className="text-left px-5 py-3 font-semibold">Role</th>
                          <th className="text-center px-4 py-3 font-semibold">Status</th>
                          <th className="text-center px-4 py-3 font-semibold">Candidates</th>
                          <th className="text-center px-4 py-3 font-semibold">Avg Score</th>
                          <th className="text-center px-4 py-3 font-semibold">Hired</th>
                          <th className="text-center px-4 py-3 font-semibold">Rejected</th>
                          <th className="text-right px-5 py-3 font-semibold">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.jobStats.map(j => (
                          <tr key={j.jobId} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)] transition">
                            <td className="px-5 py-3">
                              <Link href={`/recruit/jobs/${j.jobId}`} className="text-[var(--foreground)] hover:text-[var(--accent)] transition font-medium">{j.title}</Link>
                              {j.department && <p className="text-[11px] text-[var(--text-muted)]">{j.department}</p>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
                                j.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : j.status === "paused" ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]"
                              }`}>{j.status}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{j.totalCandidates}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={j.avgScorePct >= 70 ? "text-emerald-600" : j.avgScorePct >= 50 ? "text-amber-600" : "text-rose-600"}>
                                {j.totalCandidates > 0 ? `${j.avgScorePct}%` : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-600">{j.hired || "—"}</td>
                            <td className="px-4 py-3 text-center text-rose-600">{j.rejected || "—"}</td>
                            <td className="px-5 py-3 text-right text-[11px] text-[var(--text-muted)]">
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
