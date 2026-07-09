"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, isFirebaseAvailable } from "@/lib/firebaseClient";
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
  jobId: { title: string; department: string; status: string } | string;
  /** Server-computed: true if this candidate would appear here even without being manually starred. */
  autoEligible?: boolean;
};

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
  c, token, onUpdate, onRemove,
}: {
  c: PoolCandidate;
  token: string;
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

  const scorePct = c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : 0;
  const jobInfo = typeof c.jobId === "object" ? c.jobId : null;
  const badge = decisionBadge(c.hiringDecision);

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
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold capitalize text-slate-500">{c.stage}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-400">
        {jobInfo && <span className="truncate">{jobInfo.title}{jobInfo.department ? ` · ${jobInfo.department}` : ""}</span>}
        {c.source && <span>via {c.source}</span>}
      </div>

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
                <span key={i} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">⚠ {f}</span>
              ))}
            </div>
          )}
          <div>
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Add a note about this candidate…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/12 resize-none transition"
                />
                <div className="flex gap-2">
                  <button onClick={saveNote} disabled={savingNote} className="rounded-lg bg-[#0a66c2] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition">
                    {savingNote ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => { setEditingNote(false); setNote(c.talentPoolNote || ""); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 transition">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditingNote(true)} className="text-[11px] text-slate-400 hover:text-blue-600 transition flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                {c.talentPoolNote ? "Edit note" : "Add note"}
              </button>
            )}
            {c.talentPoolNote && !editingNote && <p className="mt-1.5 text-[12px] text-slate-500 italic leading-relaxed">{c.talentPoolNote}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function TalentPoolContent() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PoolCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pinned" | "strong_yes" | "maybe">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isFirebaseAvailable()) {
      // No auth configured in this environment — don't spin forever.
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { const t = await u.getIdToken(); setToken(t); }
      else router.push("/recruit/login");
    });
    return () => unsub();
  }, [router]);

  const fetchPool = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/talent-pool"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiJson(res);
      setCandidates(data.candidates ?? []);
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Coming Soon – Full Features
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
            Strong candidates who weren&apos;t hired — starred and kept warm for future roles.
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
              <CandidateCard key={c._id} c={c} token={token!} onUpdate={handleUpdate} onRemove={handleRemove} />
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
