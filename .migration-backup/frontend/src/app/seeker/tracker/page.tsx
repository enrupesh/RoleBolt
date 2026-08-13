"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { apiUrl } from "@/lib/api";
import { apiErrorFromPayload } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { PLATFORM_LABELS, SOURCE_LABELS, STAGE_COLORS, type UnifiedTrackerItem } from "@/lib/seekerTypes";
import { Plus, ExternalLink } from "lucide-react";

const STAGES = ["all", "applied", "screening", "interview", "offer", "rejected", "saved", "ghosted"];

function TrackerContent() {
  const { sessionToken } = useRecruitAuth();
  const [items, setItems] = useState<UnifiedTrackerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<unknown>("");
  const [form, setForm] = useState({
    title: "", companyName: "", platform: "other", sourceUrl: "", stage: "applied", notes: "",
  });

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/tracker"), {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw apiErrorFromPayload(res.status, d, "Failed to load tracker");
      setItems(d.items ?? []);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all"
    ? items
    : items.filter(i => i.stage === filter || i.stageLabel.toLowerCase().includes(filter));

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setError("");
    try {
      const res = await fetch(apiUrl("/recruit/seeker/tracker"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, d, "Could not add application");
      setShowAdd(false);
      setForm({ title: "", companyName: "", platform: "other", sourceUrl: "", stage: "applied", notes: "" });
      await load();
    } catch (e: unknown) {
      setError(e);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Universal Application Tracker</h1>
            <p className="mt-1 text-sm text-slate-500">
              Every application in one place — Rolebolt, LinkedIn, Indeed, company sites, and manual entries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
          >
            <Plus size={16} /> Add application
          </button>
        </div>

        <SeekerErrorNotice error={error} className="mb-4" />

        <div className="flex flex-wrap gap-2 mb-6">
          {STAGES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
                filter === s ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        {showAdd && (
          <form onSubmit={addManual} className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-900">Add external application</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="Job title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input required placeholder="Company" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
                <option value="ghosted">Ghosted</option>
              </select>
            </div>
            <input placeholder="Job URL (optional)" value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px]" />
            <div className="flex gap-2">
              <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Save</button>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-3xl bg-slate-200 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-slate-800">No applications tracked yet</p>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              Apply on Rolebolt, save jobs from the browser extension, or add external applications manually.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/seeker/workspace" className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white">Job Workspace</Link>
              <Link href="/recruit/opportunities" className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700">Browse jobs</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {SOURCE_LABELS[item.source]}
                        {item.platform ? ` · ${PLATFORM_LABELS[item.platform] ?? item.platform}` : ""}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STAGE_COLORS[item.stage] ?? "bg-slate-100 text-slate-600"}`}>
                        {item.stageLabel}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="text-sm text-slate-500">{item.companyName}{item.location ? ` · ${item.location}` : ""}</p>
                    {item.recentEmail && (
                      <p className="mt-2 text-xs text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1 inline-block">
                        📧 {item.recentEmail.summary}
                      </p>
                    )}
                    {item.nextAction && (
                      <p className="mt-1 text-xs text-amber-700">Next: {item.nextAction}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {item.matchScore !== undefined && (
                      <span className="text-lg font-black text-indigo-600">{item.matchScore}%</span>
                    )}
                    {item.jobId && item.source === "rolebolt" && (
                      <Link href={`/recruit/opportunities/${item.jobId}`} className="text-xs font-bold text-indigo-600">View job</Link>
                    )}
                    {item.workspaceId && (
                      <Link href={`/seeker/workspace?id=${encodeURIComponent(item.workspaceId)}`} className="text-xs font-bold text-indigo-600">Workspace</Link>
                    )}
                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600">
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>
                {item.appliedAt && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Applied {new Date(item.appliedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function TrackerPage() {
  return (
    <RecruitGuard requiredRole="seeker">
      <TrackerContent />
    </RecruitGuard>
  );
}
