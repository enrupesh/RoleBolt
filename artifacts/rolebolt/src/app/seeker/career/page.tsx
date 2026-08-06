"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { apiUrl } from "@/lib/api";
import type { CareerGpsPayload } from "@/lib/seekerTypes";

function CareerGpsContent() {
  const { sessionToken } = useRecruitAuth();
  const [gps, setGps] = useState<CareerGpsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionToken) return;
    fetch(apiUrl("/recruit/seeker/career-gps"), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load Career GPS");
        return r.json();
      })
      .then(d => setGps(d.gps))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionToken]);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Career GPS</h1>
          <p className="mt-1 text-sm text-slate-500">Your personalized job search navigation — what to do next, every day.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-3xl bg-slate-200 animate-pulse" />)}
          </div>
        ) : gps && (
          <>
            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Momentum score</p>
              <div className="mt-2 flex items-end gap-4">
                <span className="text-5xl font-black">{gps.momentumScore}</span>
                <span className="text-sm text-indigo-100 pb-2">/ 100 — {gps.headline}</span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${gps.momentumScore}%` }} />
              </div>
              <p className="mt-3 text-sm text-indigo-100">
                Weekly applications: {gps.stats.weeklyApplications} / {gps.stats.weeklyGoal}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Active processes", value: gps.stats.totalActive, color: "text-indigo-600" },
                { label: "Interviews", value: gps.stats.interviews, color: "text-amber-600" },
                { label: "Offers", value: gps.stats.offers, color: "text-emerald-600" },
                { label: "External tracked", value: gps.stats.externalTracking, color: "text-violet-600" },
              ].map(s => (
                <div key={s.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-bold text-slate-900 mb-4">Recommended next actions</h2>
                <div className="space-y-3">
                  {gps.nextActions.map((a, i) => (
                    <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${
                            a.priority === "high" ? "text-rose-600" : a.priority === "medium" ? "text-amber-600" : "text-slate-500"
                          }`}>{a.priority}</span>
                          <p className="mt-1 text-sm font-bold text-slate-900">{a.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{a.detail}</p>
                        </div>
                        {a.href && (
                          <Link href={a.href} className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                            Go →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {gps.stats.staleCount > 0 && (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <p className="font-bold text-amber-900">{gps.stats.staleCount} application{gps.stats.staleCount > 1 ? "s" : ""} going quiet</p>
                    <p className="mt-1 text-sm text-amber-800">No updates in 14+ days. Consider a follow-up or mark as ghosted.</p>
                    <Link href="/seeker/tracker" className="mt-3 inline-block text-xs font-bold text-amber-900 underline">
                      Review tracker →
                    </Link>
                  </div>
                )}

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-bold text-slate-900 mb-4">Pipeline breakdown</h2>
                  {gps.funnel.length === 0 ? (
                    <p className="text-sm text-slate-500">Start tracking applications to see your funnel.</p>
                  ) : (
                    <div className="space-y-2">
                      {gps.funnel.map(f => (
                        <div key={f.stage} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{f.stage}</span>
                          <span className="font-bold text-slate-900">{f.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {gps.followUpsDue.length > 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-bold text-slate-900 mb-3">Follow-ups due</h2>
                    {gps.followUpsDue.map(item => (
                      <div key={item.id} className="py-2 border-b border-slate-100 last:border-0">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.companyName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function CareerGpsPage() {
  return (
    <RecruitGuard requiredRole="seeker">
      <CareerGpsContent />
    </RecruitGuard>
  );
}
