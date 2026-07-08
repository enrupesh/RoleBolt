"use client";

import { useState, useEffect, useCallback } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";

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
};

function BackIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}

function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function scoreColor(pct: number) {
  if (pct >= 75) return "text-emerald-400";
  if (pct >= 55) return "text-amber-400";
  return "text-rose-400";
}

function decisionBadge(d: string | null) {
  if (d === "strong_yes") return { label: "Strong Yes", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
  if (d === "maybe") return { label: "Maybe", cls: "bg-amber-500/15 text-amber-400 border-amber-500/20" };
  if (d === "no") return { label: "No", cls: "bg-rose-500/15 text-rose-400 border-rose-500/20" };
  return null;
}

function CandidateRow({
  c, token, onUpdate,
}: {
  c: PoolCandidate;
  token: string;
  onUpdate: (id: string, update: Partial<PoolCandidate>) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(c.talentPoolNote || "");
  const [savingNote, setSavingNote] = useState(false);
  const [togglingPool, setTogglingPool] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const scorePct = c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : 0;
  const jobInfo = typeof c.jobId === "object" ? c.jobId : null;
  const badge = decisionBadge(c.hiringDecision);

  async function togglePool() {
    setTogglingPool(true);
    try {
      const res = await fetch(apiUrl(`/recruit/talent-pool/${c._id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inTalentPool: !c.inTalentPool }),
      });
      const data = await readApiJson(res);
      if (res.ok) onUpdate(c._id, { inTalentPool: data.candidate.inTalentPool });
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
    <div className={`rounded-2xl border ${c.inTalentPool ? "border-indigo-500/20 bg-indigo-500/[0.04]" : "border-white/[0.07] bg-white/[0.02]"} transition`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{c.name}</span>
              {badge && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>{badge.label}</span>
              )}
              {c.inTalentPool && (
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">In Pool</span>
              )}
            </div>
            {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-gray-400">
              {jobInfo && (
                <span className="text-gray-400">
                  {jobInfo.title}{jobInfo.department ? ` · ${jobInfo.department}` : ""}
                </span>
              )}
              {c.source && <span>via {c.source}</span>}
              <span className="capitalize">{c.stage}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-lg font-bold ${scoreColor(scorePct)}`}>{scorePct}%</span>
            <button
              onClick={togglePool}
              disabled={togglingPool}
              title={c.inTalentPool ? "Remove from talent pool" : "Add to talent pool"}
              className={`transition ${c.inTalentPool ? "text-indigo-400 hover:text-rose-400" : "text-zinc-700 hover:text-indigo-400"}`}
            >
              <StarIcon filled={c.inTalentPool} />
            </button>
            <button onClick={() => setExpanded(e => !e)} className="text-zinc-700 hover:text-gray-500 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
              </svg>
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t border-white/[0.05] pt-4">
            {c.aiSummary && (
              <p className="text-xs text-gray-500 leading-relaxed">{c.aiSummary}</p>
            )}
            {c.strengths.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.strengths.map((s, i) => (
                  <span key={i} className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2 py-0.5 text-[10px] text-emerald-400">{s}</span>
                ))}
              </div>
            )}
            {c.redFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.redFlags.map((f, i) => (
                  <span key={i} className="rounded-full border border-rose-500/15 bg-rose-500/[0.07] px-2 py-0.5 text-[10px] text-rose-400">⚠ {f}</span>
                ))}
              </div>
            )}
            <div>
              {editingNote ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note about this candidate for future roles..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveNote} disabled={savingNote} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition">
                      {savingNote ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => { setEditingNote(false); setNote(c.talentPoolNote || ""); }} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-gray-400 hover:text-white transition">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditingNote(true)} className="text-[11px] text-gray-400 hover:text-indigo-400 transition flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  {c.talentPoolNote ? "Edit note" : "Add note"}
                </button>
              )}
              {c.talentPoolNote && !editingNote && (
                <p className="mt-1 text-xs text-gray-400 italic">{c.talentPoolNote}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TalentPoolContent() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PoolCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pinned">("all");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { const t = await u.getIdToken(); setToken(t); }
      else router.push("/login");
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

  const pinned = candidates.filter(c => c.inTalentPool);
  const displayed = filter === "pinned" ? pinned : candidates;

  return (
    <div className="min-h-screen bg-white text-[#1d2226]">
      

      <header className="relative z-10 border-b border-white/[0.07] bg-gray-100 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/recruit/dashboard" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition text-xs">
              <BackIcon /> Dashboard
            </Link>
            <span className="text-zinc-700">/</span>
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                <UsersIcon />
              </div>
              <span className="text-sm font-semibold text-white">Talent Pool</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Talent Pool</h1>
          <p className="mt-1 text-sm text-gray-400">
            Silver-medal candidates who scored 55%+ but weren&apos;t hired. Star candidates you&apos;d consider for future roles.
          </p>
        </div>

        <div className="mb-5 flex items-center gap-2">
          {([["all", "All Candidates"], ["pinned", `Starred (${pinned.length})`]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                filter === val
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">{displayed.length} candidate{displayed.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading talent pool...
            </div>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.03] text-gray-400 mb-5">
              <UsersIcon />
            </div>
            <h2 className="text-base font-semibold text-gray-600">
              {filter === "pinned" ? "No starred candidates yet" : "Talent pool is empty"}
            </h2>
            <p className="mt-2 text-sm text-gray-400 max-w-xs">
              {filter === "pinned"
                ? "Star candidates you'd consider for future roles by clicking the ★ icon on any candidate card."
                : "Candidates who score 55%+ and are rejected will appear here automatically. You can also star any candidate to add them manually."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(c => (
              <CandidateRow key={c._id} c={c} token={token!} onUpdate={handleUpdate} />
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
