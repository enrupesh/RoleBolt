"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { SkStatCard, SkCandidateCard } from "@/components/Skeleton";

type PoolCandidate = {
  _id: string;
  name: string;
  email: string;
  totalScore: number;
  maxScore: number;
  aiSummary: string;
  strengths: string[];
  redFlags: string[];
  stage: string;
  hiringDecision: string | null;
  inTalentPool: boolean;
  talentPoolNote: string;
  source: string;
  createdAt: string;
  jobId: { _id: string; title: string; department: string; status: string } | string;
  /** Server-computed: true if this candidate would appear here even without being manually starred. */
  autoEligible?: boolean;
};

type JobOption = { _id: string; title: string; status: string };

function BackIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
}

function StarIcon({ filled = false, size = 14 }: { filled?: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}

function UsersIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}

function XIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {open ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

function decisionBadge(d: string | null) {
  if (d === "strong_yes") return { label: "Strong Yes", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (d === "maybe") return { label: "Maybe", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (d === "no") return { label: "No", cls: "bg-rose-50 text-rose-700 border-rose-200" };
  return null;
}

function scoreBadgeClass(pct: number) {
  if (pct >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pct >= 55) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function CandidateCard({
  c, token, jobs, onUpdate, onRemove,
}: {
  c: PoolCandidate;
  token: string;
  jobs: JobOption[];
  onUpdate: (id: string, update: Partial<PoolCandidate>) => void;
  onRemove: (id: string) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(c.talentPoolNote || "");
  const [savingNote, setSavingNote] = useState(false);

  // Keep the draft in sync if the candidate's saved note changes elsewhere
  // (e.g. re-fetched from the server) while not actively editing it.
  useEffect(() => {
    if (!editingNote) setNote(c.talentPoolNote || "");
  }, [c.talentPoolNote, editingNote]);
  const [togglingPool, setTogglingPool] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [targetJobId, setTargetJobId] = useState("");
  const [reusing, setReusing] = useState(false);
  const [reuseMsg, setReuseMsg] = useState<string | null>(null);

  const scorePct = c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : 0;
  const jobInfo = typeof c.jobId === "object" ? c.jobId : null;
  const sourceJobId = jobInfo?._id || (typeof c.jobId === "string" ? c.jobId : "");
  const badge = decisionBadge(c.hiringDecision);
  const reuseJobs = jobs.filter(j => j.status === "active" && j._id !== sourceJobId);

  async function togglePool() {
    setTogglingPool(true);
    try {
      const nextValue = !c.inTalentPool;
      const res = await fetch(apiUrl(`/recruit/talent-pool/${c._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inTalentPool: nextValue }),
      });
      const data = await readApiJson(res);
      if (res.ok) {
        const updatedValue: boolean = data.candidate.inTalentPool;
        // If unstarring a candidate who only appears here because they were manually
        // added (i.e. they don't meet the server's auto-eligibility rule — see
        // `autoEligible`, computed server-side so this never drifts from the API),
        // remove them from the list — a fresh fetch would no longer return them, so
        // keep local state consistent instead of leaving a stale card behind.
        const autoEligible: boolean = data.candidate.autoEligible ?? c.autoEligible ?? false;
        if (!updatedValue && !autoEligible) {
          onRemove(c._id);
        } else {
          onUpdate(c._id, { inTalentPool: updatedValue, autoEligible });
        }
      }
    } finally {
      setTogglingPool(false);
    }
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      const res = await fetch(apiUrl(`/recruit/talent-pool/${c._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ talentPoolNote: note }),
      });
      const data = await readApiJson(res);
      if (res.ok) {
        onUpdate(c._id, { talentPoolNote: data.candidate.talentPoolNote });
        setEditingNote(false);
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function reuseIntoJob() {
    if (!targetJobId) return;
    setReusing(true);
    setReuseMsg(null);
    try {
      const res = await fetch(apiUrl(`/recruit/talent-pool/${c._id}/reuse`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetJobId }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Reuse failed.");
      setReuseMsg("Added to job — opening pipeline…");
      window.location.href = `/recruit/jobs/${data.jobId}?candidate=${data.candidateId}`;
    } catch (e: unknown) {
      setReuseMsg(e instanceof Error ? e.message : "Reuse failed.");
      setReusing(false);
    }
  }

  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-white p-5 transition-all duration-200
        shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]
        hover:shadow-[0_8px_28px_rgba(0,0,0,0.11),0_1px_4px_rgba(0,0,0,0.06)] hover:-translate-y-0.5
        ${c.inTalentPool ? "border border-blue-200 ring-1 ring-blue-100/70" : "border border-black/[0.06]"}`}
    >
      {/* Blue top-accent on hover */}
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border border-blue-100/80 font-bold text-sm">
          {c.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-[14px] font-semibold text-slate-900 leading-snug truncate">{c.name}</h3>
          </div>
          {c.email && <p className="text-[12px] text-slate-400 truncate mt-0.5">{c.email}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${scoreBadgeClass(scorePct)}`}>{scorePct}%</span>
          <button
            onClick={togglePool} disabled={togglingPool}
            title={c.inTalentPool ? "Remove from talent pool" : "Add to talent pool"}
            className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${c.inTalentPool ? "text-blue-600 hover:bg-blue-50" : "text-slate-300 hover:text-blue-500 hover:bg-slate-50"}`}
          >
            <StarIcon filled={c.inTalentPool} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
        {badge && <span className={`rounded-full border px-2 py-0.5 font-bold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>}
        {c.inTalentPool && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-700 flex items-center gap-1"><StarIcon filled size={10} /> In Pool</span>}
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold capitalize text-slate-500">{c.stage.replace("_", " ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-400">
        {jobInfo && sourceJobId ? (
          <Link href={`/recruit/jobs/${sourceJobId}?candidate=${c._id}`} className="truncate text-blue-600 hover:underline font-medium">
            {jobInfo.title}{jobInfo.department ? ` · ${jobInfo.department}` : ""}
          </Link>
        ) : jobInfo ? (
          <span className="truncate">{jobInfo.title}{jobInfo.department ? ` · ${jobInfo.department}` : ""}</span>
        ) : null}
        {c.source && <span>via {c.source}</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {sourceJobId && (
          <Link
            href={`/recruit/jobs/${sourceJobId}?candidate=${c._id}`}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 transition"
          >
            Open in job
          </Link>
        )}
        <button
          type="button"
          onClick={() => setReuseOpen(o => !o)}
          className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
        >
          Reuse in another job
        </button>
      </div>

      {reuseOpen && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
          {reuseJobs.length === 0 ? (
            <p className="text-[11px] text-slate-500">No other active jobs to reuse into. Create a new Standard Job first.</p>
          ) : (
            <>
              <select
                value={targetJobId}
                onChange={e => setTargetJobId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400"
              >
                <option value="">Select target job…</option>
                {reuseJobs.map(j => (
                  <option key={j._id} value={j._id}>{j.title}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!targetJobId || reusing}
                onClick={reuseIntoJob}
                className="w-full rounded-lg bg-[#0a66c2] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {reusing ? "Scoring into job…" : "Add & open pipeline"}
              </button>
            </>
          )}
          {reuseMsg && <p className="text-[11px] text-slate-600">{reuseMsg}</p>}
        </div>
      )}

      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[12px] font-semibold text-slate-500 hover:text-blue-600 transition"
      >
        <span className="flex items-center gap-1.5"><UsersIcon size={12} /> Details</span>
        <ChevronDownIcon open={expanded} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {c.aiSummary && <p className="text-[12px] text-slate-600 leading-relaxed">{c.aiSummary}</p>}
          {c.strengths.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.strengths.map((s, i) => (
                <span key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">{s}</span>
              ))}
            </div>
          )}
          {c.redFlags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.redFlags.map((f, i) => (
                <span key={i} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">{f}</span>
              ))}
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pool note</p>
              {!editingNote && (
                <button type="button" onClick={() => setEditingNote(true)} className="text-[10px] font-bold text-blue-600">Edit</button>
              )}
            </div>
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] outline-none focus:border-blue-400"
                  placeholder="Why keep this person warm?"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={savingNote} onClick={saveNote} className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50">
                    {savingNote ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => { setEditingNote(false); setNote(c.talentPoolNote || ""); }} className="text-[11px] font-semibold text-slate-500">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">{c.talentPoolNote || "No note yet."}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TalentPoolContent() {
  const [token, setToken] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PoolCandidate[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pinned" | "strong_yes" | "maybe">("all");
  const [search, setSearch] = useState("");

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (sessionToken) setToken(sessionToken);
  }, [sessionToken]);

  const fetchPool = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [poolRes, jobsRes] = await Promise.all([
        fetch(apiUrl("/recruit/talent-pool"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/recruit/jobs"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const data = await readApiJson(poolRes);
      const jobsData = await readApiJson(jobsRes);
      setCandidates(data.candidates ?? []);
      setJobs((jobsData.jobs ?? []).map((j: JobOption) => ({ _id: j._id, title: j.title, status: j.status })));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  function handleUpdate(id: string, update: Partial<PoolCandidate>) {
    setCandidates(prev => prev.map(c => c._id === id ? { ...c, ...update } : c));
  }

  function handleRemove(id: string) {
    setCandidates(prev => prev.filter(c => c._id !== id));
  }

  const pinned = useMemo(() => candidates.filter(c => c.inTalentPool), [candidates]);
  const strongYes = useMemo(() => candidates.filter(c => c.hiringDecision === "strong_yes"), [candidates]);
  const maybes = useMemo(() => candidates.filter(c => c.hiringDecision === "maybe"), [candidates]);
  const avgScore = useMemo(() => {
    if (candidates.length === 0) return 0;
    const total = candidates.reduce((sum, c) => sum + (c.maxScore > 0 ? (c.totalScore / c.maxScore) * 100 : 0), 0);
    return Math.round(total / candidates.length);
  }, [candidates]);

  const stats = [
    { label: "Total in Pool", value: candidates.length, accent: "text-blue-600", bar: "from-blue-400 to-blue-600", sub: "candidates tracked" },
    { label: "Starred", value: pinned.length, accent: "text-indigo-600", bar: "from-indigo-400 to-indigo-600", sub: "marked for future roles" },
    { label: "Strong Yes", value: strongYes.length, accent: "text-emerald-600", bar: "from-emerald-400 to-emerald-500", sub: "top-tier fits" },
    { label: "Avg. Match Score", value: `${avgScore}%`, accent: "text-amber-600", bar: "from-amber-400 to-amber-500", sub: "across the pool" },
  ];

  const filtered = useMemo(() => {
    let list = candidates;
    if (filter === "pinned") list = pinned;
    else if (filter === "strong_yes") list = strongYes;
    else if (filter === "maybe") list = maybes;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(c => {
        const jobInfo = typeof c.jobId === "object" ? c.jobId : null;
        return (
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          jobInfo?.title.toLowerCase().includes(q) ||
          jobInfo?.department?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [candidates, filter, pinned, strongYes, maybes, search]);

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
                <UsersIcon size={13} />
              </div>
              <span className="text-[13px] font-bold text-slate-900">Talent Pool</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-0.5">
            <Link href="/recruit/analytics"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              Analytics
            </Link>
            <Link href="/recruit/recruiter-profile"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Page title ────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900 leading-tight">Talent Pool</h1>
          </div>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
            Strong candidates kept warm for future roles — star from any job, then reuse into another opening.
          </p>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8 animate-[rb-fade-in_0.3s_ease_both]">
            {Array.from({ length: 4 }).map((_, i) => <SkStatCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8 animate-[rb-fade-in_0.3s_ease_both]">
            {stats.map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-2xl bg-white border border-black/[0.06] p-4
                shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${s.bar}`} />
                <p className={`text-[26px] font-bold leading-none tabular-nums mt-1 ${s.accent}`}>{s.value}</p>
                <p className="mt-2 text-[11px] font-semibold text-slate-800 leading-snug">{s.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Search + filter row ──────────────────────────────────────── */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-[13px] text-slate-900 placeholder-slate-400 outline-none
                focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/12 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition"
              >
                <XIcon />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              ["all", "All Candidates"],
              ["pinned", `Starred (${pinned.length})`],
              ["strong_yes", `Strong Yes (${strongYes.length})`],
              ["maybe", `Maybe (${maybes.length})`],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
                  filter === val
                    ? "bg-[#0a66c2] text-white shadow-[0_2px_8px_rgba(10,102,194,0.30)]"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-1 text-[12px] font-medium text-slate-400 whitespace-nowrap">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-[rb-fade-in_0.3s_ease_both]">
            {Array.from({ length: 6 }).map((_, i) => <SkCandidateCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-300 mb-5
              shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <UsersIcon size={30} />
            </div>
            <h2 className="text-base font-semibold text-slate-800">
              {search
                ? "No matches found"
                : filter === "pinned"
                  ? "No starred candidates yet"
                  : filter === "strong_yes"
                    ? "No strong-yes candidates yet"
                    : filter === "maybe"
                      ? "No maybe candidates yet"
                      : "Talent pool is empty"}
            </h2>
            <p className="mt-2 text-[13px] text-slate-500 max-w-xs leading-relaxed">
              {search
                ? "Try a different name, email, or role."
                : filter === "pinned"
                  ? "Star candidates you'd consider for future roles by clicking the ★ icon on their card."
                  : "Candidates who score 55%+ and aren't hired appear here automatically."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(c => (
              <CandidateCard key={c._id} c={c} token={token!} jobs={jobs} onUpdate={handleUpdate} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function TalentPoolPage() {
  return <RecruitGuard requiredRole="creator"><TalentPoolContent /></RecruitGuard>;
}
