"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { apiErrorFromPayload, apiUrl, readApiJson } from "@/lib/api";

type Analysis = {
  matchScore: number;
  matchLabel: string;
  summary: string;
  matchReasons: string[];
  strengths: string[];
  missingSkills: string[];
  profileSuggestions: string[];
  salaryInsight: string;
  analyzedAt?: string;
};

type WorkspaceItem = {
  id: string;
  sourceUrl: string;
  sourceType: "url" | "manual";
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  salaryText: string;
  jobDescription: string;
  status: "saved" | "analyzed" | "applied" | "archived";
  notes: string;
  analysis: Analysis | null;
  createdAt?: string;
  updatedAt?: string;
};

type AddMode = "url" | "paste";

const STATUS_LABELS: Record<WorkspaceItem["status"], string> = {
  saved: "Saved",
  analyzed: "Analyzed",
  applied: "Applied",
  archived: "Archived",
};

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

function scoreTone(score: number) {
  if (score >= 75) return { ring: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Strong fit" };
  if (score >= 55) return { ring: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Worth reviewing" };
  return { ring: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", label: "Needs work" };
}

function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className={`flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-8 ${tone.border} ${tone.bg}`}>
      <span className={`text-3xl font-black tracking-tight ${tone.ring}`}>{score}%</span>
      <span className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.ring}`}>{tone.label}</span>
    </div>
  );
}

function WorkspaceContent() {
  const { sessionToken } = useRecruitAuth();
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>("url");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    sourceUrl: "",
    title: "",
    companyName: "",
    location: "",
    workMode: "",
    salaryText: "",
    jobDescription: "",
  });

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    if (!sessionToken) return;
    const urlId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
    if (urlId) setSelectedId(urlId);
  }, [sessionToken]);

  const loadItems = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/workspace"), {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await readApiJson<{ workspaces?: WorkspaceItem[]; error?: string }>(res);
      if (!res.ok) throw apiErrorFromPayload(res.status, data, "Could not load your workspace.");
      const nextItems = data.workspaces ?? [];
      setItems(nextItems);
      const urlId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
      setSelectedId((current) => {
        const preferred = urlId || current;
        if (preferred && nextItems.some((item) => item.id === preferred)) return preferred;
        return nextItems[0]?.id ?? null;
      });
    } catch (err: unknown) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm({ sourceUrl: "", title: "", companyName: "", location: "", workMode: "", salaryText: "", jobDescription: "" });
    setAddMode("url");
    setShowAdd(false);
  }

  async function addWorkspaceItem(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionToken) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        sourceUrl: addMode === "url" ? form.sourceUrl : "",
        jobDescription: addMode === "paste" ? form.jobDescription : "",
      };
      const res = await fetch(apiUrl("/recruit/seeker/workspace"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<{ workspace?: WorkspaceItem; error?: string; analysisError?: string }>(res);
      if (!res.ok || !data.workspace) throw apiErrorFromPayload(res.status, data, "Could not add this job.");
      setItems((current) => [data.workspace!, ...current]);
      setSelectedId(data.workspace.id);
      resetForm();
      setNotice(data.analysisError ? "Job saved. Analysis could not finish, so you can retry it below." : "Job saved and analyzed.");
    } catch (err: unknown) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(id: string, update: Partial<WorkspaceItem>) {
    if (!sessionToken) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/seeker/workspace/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify(update),
      });
      const data = await readApiJson<{ workspace?: WorkspaceItem; error?: string }>(res);
      if (!res.ok || !data.workspace) throw apiErrorFromPayload(res.status, data, "Could not update this job.");
      setItems((current) => current.map((item) => (item.id === id ? data.workspace! : item)));
      setNotice("Workspace updated.");
    } catch (err: unknown) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function analyzeItem(id: string) {
    if (!sessionToken) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/seeker/workspace/${id}/analyze`), {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await readApiJson<{ workspace?: WorkspaceItem; error?: string }>(res);
      if (!res.ok || !data.workspace) throw apiErrorFromPayload(res.status, data, "Analysis failed. Please try again.");
      setItems((current) => current.map((item) => (item.id === id ? data.workspace! : item)));
      setNotice("Fresh match analysis is ready.");
    } catch (err: unknown) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(id: string) {
    if (!sessionToken || !window.confirm("Remove this job from your workspace?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/seeker/workspace/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Could not remove this job.");
      const nextItems = items.filter((item) => item.id !== id);
      setItems(nextItems);
      setSelectedId(nextItems[0]?.id ?? null);
      setNotice("Job removed from your workspace.");
    } catch (err: unknown) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function copyDescription() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.jobDescription);
    setNotice("Job description copied.");
  }

  const activeCount = items.filter((item) => item.status !== "archived").length;
  const analyzedCount = items.filter((item) => item.analysis).length;
  const appliedCount = items.filter((item) => item.status === "applied").length;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100">
                <Sparkles className="h-3.5 w-3.5" /> Your independent job search cockpit
              </div>
              <h1 className="max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Bring any job. Make a smarter move.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Paste a job from LinkedIn, Indeed, a company site, or anywhere else. Rolebolt will keep it organized and show how it fits your profile.
              </p>
            </div>
            <button
              onClick={() => { setShowAdd(true); setError(""); setNotice(""); }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" /> Add a job
            </button>
          </div>
          <div className="relative mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 sm:max-w-xl sm:gap-8">
            <div><p className="text-2xl font-black">{activeCount}</p><p className="text-xs text-slate-400">Active jobs</p></div>
            <div><p className="text-2xl font-black">{analyzedCount}</p><p className="text-xs text-slate-400">Analyzed</p></div>
            <div><p className="text-2xl font-black">{appliedCount}</p><p className="text-xs text-slate-400">Marked applied</p></div>
          </div>
        </section>

        {(error || notice) && (
          <div className="mt-5 flex items-start justify-between gap-4">
            {error ? <SeekerErrorNotice error={error} className="flex-1" /> : (
              <div className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
            )}
            <button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message"><X className="h-4 w-4" /></button>
          </div>
        )}

        {showAdd && (
          <section className="mt-6 rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">New workspace item</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Add a job from anywhere</h2>
                <p className="mt-1 text-sm text-slate-500">A URL lets us extract the page. Pasting the JD is the most reliable option for protected sites.</p>
              </div>
              <button onClick={resetForm} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
              <button onClick={() => setAddMode("url")} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${addMode === "url" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}><Link2 className="mr-2 inline h-4 w-4" />Job URL</button>
              <button onClick={() => setAddMode("paste")} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${addMode === "paste" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}><FileText className="mr-2 inline h-4 w-4" />Paste details</button>
            </div>
            <form onSubmit={addWorkspaceItem} className="grid gap-4 lg:grid-cols-2">
              {addMode === "url" ? (
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Public job URL *</label>
                  <input required type="url" value={form.sourceUrl} onChange={(event) => updateForm("sourceUrl", event.target.value)} placeholder="https://company.com/jobs/product-designer" className={inputClass} />
                </div>
              ) : (
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Job description *</label>
                  <textarea required rows={7} value={form.jobDescription} onChange={(event) => updateForm("jobDescription", event.target.value)} placeholder="Paste the complete job description here…" className={`${inputClass} resize-y`} />
                </div>
              )}
              <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Role title</label><input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="e.g. Product Designer" className={inputClass} /></div>
              <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Company</label><input value={form.companyName} onChange={(event) => updateForm("companyName", event.target.value)} placeholder="e.g. Acme Inc." className={inputClass} /></div>
              <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Location</label><input value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="Remote, Delhi, London…" className={inputClass} /></div>
              <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Work mode</label><select value={form.workMode} onChange={(event) => updateForm("workMode", event.target.value)} className={inputClass}><option value="">Not specified</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></div>
              <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Salary (optional)</label><input value={form.salaryText} onChange={(event) => updateForm("salaryText", event.target.value)} placeholder="e.g. ₹12–18 LPA" className={inputClass} /></div>
              <div className="flex items-end justify-end gap-3 lg:col-span-2"><button type="button" onClick={resetForm} className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving and analyzing…</> : <><Sparkles className="h-4 w-4" /> Save & analyze job</>}</button></div>
            </form>
          </section>
        )}

        <div className="mt-7 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="font-black text-slate-900">Your job list</h2><p className="mt-0.5 text-xs text-slate-500">Saved from any source</p></div>
              <button onClick={() => void loadItems()} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" aria-label="Refresh jobs"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
            </div>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">No jobs here yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Add a job from any website to start your private workspace.</p><button onClick={() => setShowAdd(true)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">Add your first job</button></div>
            ) : (
              <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => {
                  const active = selected?.id === item.id;
                  const score = item.analysis?.matchScore;
                  return <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-indigo-300 bg-indigo-50/70 shadow-sm" : "border-slate-100 bg-slate-50/70 hover:border-indigo-200 hover:bg-indigo-50/40"}`}>
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.title || "Untitled job"}</p><p className="mt-1 truncate text-xs text-slate-500">{item.companyName || "Company not added"}{item.location ? ` · ${item.location}` : ""}</p></div>{typeof score === "number" && <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${scoreTone(score).bg} ${scoreTone(score).ring}`}>{score}%</span>}</div>
                    <div className="mt-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.sourceType === "url" ? "External URL" : "Pasted JD"}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{STATUS_LABELS[item.status]}</span></div>
                  </button>;
                })}
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            {!selected ? (
              <div className="flex min-h-[520px] items-center justify-center text-center"><div><BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 font-black text-slate-800">Select a job to see its workspace</h2><p className="mt-1 text-sm text-slate-500">Your analysis, fit gaps, and preparation actions will appear here.</p></div></div>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700">{selected.sourceType === "url" ? "External job" : "Saved JD"}</span><select value={selected.status} onChange={(event) => void updateItem(selected.id, { status: event.target.value as WorkspaceItem["status"] })} className="rounded-full border-0 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 outline-none"><option value="saved">Saved</option><option value="analyzed">Analyzed</option><option value="applied">Applied</option><option value="archived">Archived</option></select></div><h2 className="mt-3 break-words text-2xl font-black tracking-tight text-slate-900">{selected.title || "Untitled job"}</h2><p className="mt-1 text-sm text-slate-500">{[selected.companyName, selected.location, selected.workMode, selected.salaryText].filter(Boolean).join(" · ") || "Add company and role details to personalize this workspace."}</p></div>
                  <div className="flex shrink-0 items-center gap-1"><button onClick={() => void analyzeItem(selected.id)} disabled={busyId === selected.id} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${busyId === selected.id ? "animate-spin" : ""}`} /> Re-analyze</button>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" aria-label="Open original job"><ExternalLink className="h-4 w-4" /></a>}<button onClick={() => void deleteItem(selected.id)} disabled={busyId === selected.id} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60" aria-label="Delete workspace item"><Trash2 className="h-4 w-4" /></button></div>
                </div>

                {selected.analysis ? (
                  <div className="mt-6 space-y-6">
                    <div className="flex flex-col gap-5 rounded-3xl border border-slate-100 bg-slate-50/80 p-5 sm:flex-row sm:items-center"><ScoreRing score={selected.analysis.matchScore} /><div><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Rolebolt fit read</p><h3 className="mt-1 text-xl font-black text-slate-900">{selected.analysis.matchLabel}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{selected.analysis.summary}</p></div></div>
                    <div className="grid gap-5 md:grid-cols-2"><div><h3 className="mb-3 text-sm font-black text-slate-900">Why it may fit</h3><ul className="space-y-2">{(selected.analysis.matchReasons.length ? selected.analysis.matchReasons : selected.analysis.strengths).map((reason, index) => <li key={`${reason}-${index}`} className="flex gap-2 text-sm leading-5 text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{reason}</li>)}</ul></div><div><h3 className="mb-3 text-sm font-black text-slate-900">Gaps to review</h3>{selected.analysis.missingSkills.length ? <ul className="space-y-2">{selected.analysis.missingSkills.map((skill) => <li key={skill} className="flex gap-2 text-sm leading-5 text-slate-600"><span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-amber-100 text-center text-[10px] font-black leading-4 text-amber-700">!</span>{skill}</li>)}</ul> : <p className="text-sm text-slate-500">No specific gaps were identified from the available profile.</p>}</div></div>
                    {selected.analysis.profileSuggestions.length > 0 && <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-indigo-800">Before you apply</p><ul className="mt-2 space-y-1.5">{selected.analysis.profileSuggestions.map((suggestion) => <li key={suggestion} className="flex gap-2 text-sm leading-5 text-indigo-900"><ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />{suggestion}</li>)}</ul></div>}
                    {selected.analysis.salaryInsight && <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Compensation read</p><p className="mt-1 text-sm leading-5 text-slate-600">{selected.analysis.salaryInsight}</p></div>}
                    <div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-black text-slate-900">Keep preparing from here</h3><button onClick={() => void copyDescription()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Clipboard className="h-3.5 w-3.5" /> Copy job details</button></div><div className="grid gap-2 sm:grid-cols-3"><Link href={`/seeker/resume?workspaceId=${encodeURIComponent(selected.id)}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50"><FileText className="mb-2 h-5 w-5 text-indigo-600" />Tailor resume<small className="mt-1 block text-xs font-normal text-slate-500">Use the match gaps</small></Link><Link href={`/seeker/cover-letter?workspaceId=${encodeURIComponent(selected.id)}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50"><Clipboard className="mb-2 h-5 w-5 text-indigo-600" />Write cover letter<small className="mt-1 block text-xs font-normal text-slate-500">Create a targeted draft</small></Link><Link href={`/seeker/interview-prep?workspaceId=${encodeURIComponent(selected.id)}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50"><Sparkles className="mb-2 h-5 w-5 text-indigo-600" />Prep for interview<small className="mt-1 block text-xs font-normal text-slate-500">Practice this role</small></Link></div></div>
                  </div>
                ) : <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-indigo-300" /><h3 className="mt-3 font-black text-slate-800">This job needs an analysis</h3><p className="mt-1 text-sm text-slate-500">Use your saved profile and resume to get a fit score and practical next steps.</p><button onClick={() => void analyzeItem(selected.id)} disabled={busyId === selected.id} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busyId === selected.id && <Loader2 className="h-4 w-4 animate-spin" />} Analyze this job</button></div>}

                <div className="mt-7 border-t border-slate-100 pt-5"><details><summary className="cursor-pointer text-sm font-bold text-slate-600">View saved job description</summary><div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">{selected.jobDescription}</div></details><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void updateItem(selected.id, { status: selected.status === "applied" ? "analyzed" : "applied" })} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{selected.status === "applied" ? "Undo applied" : "Mark as applied"}</button>{selected.status !== "archived" && <button onClick={() => void updateItem(selected.id, { status: "archived" })} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Archive className="h-3.5 w-3.5" /> Archive</button>}</div></div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function SeekerWorkspacePage() {
  return <RecruitGuard requiredRole="seeker"><WorkspaceContent /></RecruitGuard>;
}