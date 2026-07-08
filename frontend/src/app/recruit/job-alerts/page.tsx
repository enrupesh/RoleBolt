"use client";
import { trackEvent } from "@/lib/trackEvent";

import { useState, useEffect, useCallback } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import { apiUrl, readApiJson } from "@/lib/api";

const NICHES = [
  "AI, Data, Software & Product Tech",
  "Sales, Business Development & Revenue Roles",
  "Finance, Accounting, Banking & Fintech",
  "Healthcare, Pharma & Allied Medical Workforce",
  "Skilled Blue-Collar, Logistics & Industrial Workforce",
  "Creative, Marketing, Media & Design",
];

type Alert = {
  _id: string;
  niche: string;
  workMode: string;
  keywords: string;
  location: string;
  freshersOnly: boolean;
  verifiedOnly: boolean;
  newJobCount: number;
  createdAt: string;
};

type Job = {
  _id: string;
  title: string;
  companyName?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  freshersAllowed?: boolean;
  verifiedCompany?: boolean;
  mustHaveSkills?: string;
  createdAt?: string;
  niche?: string;
};

function formatSalary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const min = job.salaryMin ? job.salaryMin.toLocaleString("en-IN") : "0";
  const max = job.salaryMax ? `–${job.salaryMax.toLocaleString("en-IN")}` : "+";
  return `${job.salaryCurrency || "₹"} ${min}${max}`;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function JobAlertsContent() {
  const [email, setEmail] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [alertJobs, setAlertJobs] = useState<Record<string, Job[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    niche: "",
    workMode: "",
    keywords: "",
    location: "",
    freshersOnly: false,
    verifiedOnly: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("recruit_applicant_email");
      if (saved) { setInputEmail(saved); setEmail(saved); }
    } catch {}
  }, []);

  const fetchAlerts = useCallback(async (emailStr: string) => {
    setLoadingAlerts(true);
    try {
      const res = await fetch(apiUrl(`/recruit-public/job-alerts?email=${encodeURIComponent(emailStr)}`));
      const data = await readApiJson(res);
      setAlerts(data.alerts || []);
    } catch {}
    finally { setLoadingAlerts(false); }
  }, []);

  useEffect(() => {
    if (email) fetchAlerts(email);
  }, [email, fetchAlerts]);

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputEmail.trim().toLowerCase();
    if (!trimmed) return;
    try { localStorage.setItem("recruit_applicant_email", trimmed); } catch {}
    setEmail(trimmed);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setCreating(true);
    setFormError("");
    setSuccess("");
    try {
      const res = await fetch(apiUrl("/recruit-public/job-alerts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...form }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to create alert");
      setSuccess(data.updated ? "Alert updated successfully." : "Job alert created! You'll see new matches here.");
      if (!data.updated) trackEvent("job_alert_created", { niche: form.niche, workMode: form.workMode });
      setForm({ niche: "", workMode: "", keywords: "", location: "", freshersOnly: false, verifiedOnly: false });
      await fetchAlerts(email);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(alertId: string) {
    if (!email) return;
    setDeleting(alertId);
    try {
      await fetch(apiUrl(`/recruit-public/job-alerts/${alertId}?email=${encodeURIComponent(email)}`), { method: "DELETE" });
      setAlerts(prev => prev.filter(a => a._id !== alertId));
    } catch {}
    finally { setDeleting(null); }
  }

  async function toggleExpand(alertId: string) {
    if (expandedAlert === alertId) { setExpandedAlert(null); return; }
    setExpandedAlert(alertId);
    if (!alertJobs[alertId]) {
      setLoadingJobs(prev => ({ ...prev, [alertId]: true }));
      try {
        const res = await fetch(apiUrl(`/recruit-public/job-alerts/${alertId}/jobs?email=${encodeURIComponent(email)}`));
        const data = await readApiJson(res);
        setAlertJobs(prev => ({ ...prev, [alertId]: data.jobs || [] }));
        setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, newJobCount: 0 } : a));
      } catch {}
      finally { setLoadingJobs(prev => ({ ...prev, [alertId]: false })); }
    }
  }

  function alertLabel(a: Alert) {
    const parts = [
      a.niche ? a.niche.split(",")[0].trim() : "All niches",
      a.workMode ? a.workMode.charAt(0).toUpperCase() + a.workMode.slice(1) : "Any mode",
    ];
    if (a.keywords) parts.push(`"${a.keywords}"`);
    if (a.location) parts.push(a.location);
    return parts.join(" · ");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <RecruitHeader />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Hero */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-[#0a66c2]">
              <BellIcon />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#0a66c2]">Growth & Retention</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Job Alerts</h1>
              <p className="mt-1 text-sm text-slate-600">
                Save your job search preferences and check back here to see new matching roles. No spam — just jobs that fit your criteria.
              </p>
            </div>
          </div>
        </div>

        {/* Email gate */}
        {!email ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
            <p className="text-sm font-semibold text-slate-700 mb-3">Enter your email to manage job alerts</p>
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={inputEmail}
                onChange={e => setInputEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition"
                required
              />
              <button type="submit" className="shrink-0 rounded-lg bg-[#0a66c2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition">
                Continue
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Create alert form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900">Create a new alert</h2>
                <span className="text-xs text-slate-400">{email}</span>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Niche</label>
                    <select value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
                      <option value="">All niches</option>
                      {NICHES.map(n => <option key={n} value={n}>{n.split(",")[0]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Work mode</label>
                    <select value={form.workMode} onChange={e => setForm(f => ({ ...f, workMode: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white">
                      <option value="">Any</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">Onsite</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Keywords</label>
                    <input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="e.g. React, AI, Sales" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">City / Location</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Bengaluru, Remote" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.freshersOnly} onChange={e => setForm(f => ({ ...f, freshersOnly: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-[#0a66c2] focus:ring-[#0a66c2]" />
                    <span className="text-sm font-medium text-slate-700">Freshers-friendly only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.verifiedOnly} onChange={e => setForm(f => ({ ...f, verifiedOnly: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-[#0a66c2] focus:ring-[#0a66c2]" />
                    <span className="text-sm font-medium text-slate-700">Verified companies only</span>
                  </label>
                </div>

                {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{formError}</p>}
                {success && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">{success}</p>}

                <button type="submit" disabled={creating} className="w-full rounded-lg bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition">
                  {creating ? "Saving…" : "Create alert"}
                </button>
              </form>
            </div>

            {/* Existing alerts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-slate-900">Your alerts</h2>
                {alerts.length > 0 && <span className="text-xs text-slate-500">{alerts.length} active</span>}
              </div>

              {loadingAlerts && (
                <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Loading your alerts…
                </div>
              )}

              {!loadingAlerts && alerts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <BellIcon />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No alerts yet</p>
                  <p className="mt-1 text-xs text-slate-500">Create your first alert above to start tracking new jobs.</p>
                </div>
              )}

              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0a66c2]">
                        <BellIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{alertLabel(alert)}</p>
                        <p className="text-xs text-slate-400">Created {timeAgo(alert.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {alert.newJobCount > 0 && (
                          <span className="rounded-full bg-[#0a66c2] px-2.5 py-1 text-[11px] font-bold text-white">
                            {alert.newJobCount} new
                          </span>
                        )}
                        <button onClick={() => toggleExpand(alert._id)} className="flex h-5 w-5 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                          <div className={`transition-transform ${expandedAlert === alert._id ? "rotate-180" : ""}`}><ChevronDown /></div>
                        </button>
                        <button onClick={() => handleDelete(alert._id)} disabled={deleting === alert._id} className="flex h-5 w-5 items-center justify-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition disabled:opacity-50">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    {expandedAlert === alert._id && (
                      <div className="border-t border-slate-100 p-4">
                        {loadingJobs[alert._id] ? (
                          <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            Loading matching jobs…
                          </div>
                        ) : alertJobs[alert._id]?.length === 0 ? (
                          <div className="text-center py-6">
                            <p className="text-sm text-slate-500">No matching jobs found right now.</p>
                            <Link href="/recruit/opportunities" className="mt-2 inline-block text-xs font-bold text-[#0a66c2] hover:underline">Browse all jobs →</Link>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(alertJobs[alert._id] || []).map(job => {
                              const salary = formatSalary(job);
                              return (
                                <Link
                                  key={job._id}
                                  href={`/recruit/opportunities/${job._id}`}
                                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-[#0a66c2]/30 hover:bg-blue-50/20 transition"
                                >
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-xs font-black text-[#0a66c2]">
                                    {(job.companyName || job.title).charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 group-hover:text-[#0a66c2] transition truncate">{job.title}</p>
                                    <p className="text-xs text-slate-500 truncate">{job.companyName} · {job.location} · {job.workMode}</p>
                                    {salary && <p className="text-xs font-semibold text-slate-700 mt-0.5">{salary}</p>}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {job.verifiedCompany && <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">✓</span>}
                                    {job.freshersAllowed && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">Freshers</span>}
                                    <span className="text-[10px] text-slate-400">{timeAgo(job.createdAt)}</span>
                                  </div>
                                </Link>
                              );
                            })}
                            <div className="pt-1 text-center">
                              <Link href={`/recruit/opportunities?${alert.niche ? `niche=${encodeURIComponent(alert.niche)}&` : ""}${alert.workMode ? `workMode=${alert.workMode}` : ""}`} className="text-xs font-bold text-[#0a66c2] hover:underline">
                                Browse all matching jobs →
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-3">How job alerts work</h3>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex gap-2"><span className="text-[#0a66c2] font-bold">1.</span><span>Set your filters — niche, mode, keywords, and location.</span></div>
                <div className="flex gap-2"><span className="text-[#0a66c2] font-bold">2.</span><span>Come back here anytime to see new jobs that match your criteria.</span></div>
                <div className="flex gap-2"><span className="text-[#0a66c2] font-bold">3.</span><span>Each alert shows a count of new jobs posted since your last check.</span></div>
                <div className="flex gap-2"><span className="text-[#0a66c2] font-bold">4.</span><span>Delete alerts you no longer need. You can have multiple alerts with different filters.</span></div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function JobAlertsPage() {
  return <RecruitGuard requiredRole="seeker"><JobAlertsContent /></RecruitGuard>;
}
