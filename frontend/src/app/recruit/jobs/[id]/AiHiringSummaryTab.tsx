"use client";

import { useCallback, useState } from "react";
import { apiUrl, readApiJson } from "@/lib/api";
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────────────────────────── */
type AiSynthesis = {
  recommendation: "hire" | "hold" | "pass";
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  riskFactors: string[];
  keyReasons: string[];
  overallFit: string;
  suggestedNextStep: string;
  generatedAt?: string;
  generatedBy?: string;
  recruiterDecision?: "accepted" | "overridden" | "ignored";
  recruiterDecisionNote?: string;
  recruiterDecisionAt?: string;
};

type Candidate = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  totalScore?: number;
  maxScore?: number;
  aiSummary?: string;
  strengths?: string[];
  redFlags?: string[];
  assessmentStatus?: string;
  assessmentImpact?: { strengths?: string[]; weaknesses?: string[]; reasoning?: string };
  stage?: string;
  stageMovedAt?: string;
  aiHiringSynthesis?: AiSynthesis;
  [key: string]: unknown;
};

export type AiHiringSummaryTabProps = {
  jobId: string;
  token: string;
  candidates: Candidate[];
};

/* ─── helpers ─────────────────────────────────────────────────────────────────*/
function getId(c: Candidate) {
  return String(c._id ?? c.id ?? "");
}

function scorePercent(c: Candidate) {
  if (!c.totalScore || !c.maxScore) return 0;
  return Math.round((c.totalScore / c.maxScore) * 100);
}

function formatDate(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

const RECOMMENDATION_CONFIG = {
  hire: {
    label: "Hire",
    icon: CheckCircle2,
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    glow: "ring-emerald-300 bg-emerald-50",
    bar: "bg-emerald-500",
    emoji: "✅",
  },
  hold: {
    label: "Hold",
    icon: Clock,
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    glow: "ring-amber-300 bg-amber-50",
    bar: "bg-amber-500",
    emoji: "⏳",
  },
  pass: {
    label: "Pass",
    icon: XCircle,
    badge: "bg-rose-100 text-rose-800 border-rose-300",
    glow: "ring-rose-300 bg-rose-50",
    bar: "bg-rose-500",
    emoji: "❌",
  },
};

function BulletList({ items, icon: Icon, iconClass }: { items: string[]; icon: React.ElementType; iconClass: string }) {
  if (!items?.length) return <p className="text-xs text-slate-400">None noted.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
          <Icon size={14} className={`mt-0.5 shrink-0 ${iconClass}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rb-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
        {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-5 py-4">{children}</div>}
    </div>
  );
}

/* ─── main component ──────────────────────────────────────────────────────────*/
export default function AiHiringSummaryTab({ jobId, token, candidates }: AiHiringSummaryTabProps) {
  const [selectedId, setSelectedId] = useState("");
  const [synthesis, setSynthesis] = useState<AiSynthesis | null>(null);
  const [candidateData, setCandidateData] = useState<Candidate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [showDecision, setShowDecision] = useState(false);

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const request = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(apiUrl(`/recruit/collaboration/jobs/${jobId}/candidates${path}`), {
      ...opts,
      headers: { ...headers(), ...(opts?.headers ?? {}) },
    });
    return readApiJson(res);
  }, [jobId, headers]);

  /* select a candidate — try to load their existing synthesis from the candidate list */
  function selectCandidate(id: string) {
    setSelectedId(id);
    setError("");
    setNotice("");
    setDecisionNote("");
    setShowDecision(false);
    const c = candidates.find(c => getId(c) === id) ?? null;
    setCandidateData(c);
    setSynthesis(c?.aiHiringSynthesis ?? null);
  }

  /* generate (or re-generate) AI synthesis */
  async function generate(force = false) {
    if (!selectedId) return;
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const data = await request(`/${selectedId}/ai-synthesis`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setSynthesis(data.synthesis);
      setNotice("AI hiring summary generated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate AI summary.");
    } finally {
      setGenerating(false);
    }
  }

  /* record recruiter decision */
  async function recordDecision(decision: "accepted" | "overridden" | "ignored") {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await request(`/${selectedId}/recruiter-decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision, note: decisionNote.trim() || undefined }),
      });
      setSynthesis(data.synthesis);
      setNotice(`Decision recorded: ${decision}.`);
      setShowDecision(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save decision.");
    } finally {
      setSaving(false);
    }
  }

  const selected = candidates.find(c => getId(c) === selectedId);
  const rec = synthesis?.recommendation ? RECOMMENDATION_CONFIG[synthesis.recommendation] : null;
  const RecommendationIcon = rec?.icon ?? CheckCircle2;
  const scorePct = selected ? scorePercent(selected) : 0;

  return (
    <section className="space-y-5 pb-10">
      {/* header */}
      <div className="rb-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Brain size={19} /></div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-900">AI Hiring Summary</h2>
            <p className="mt-0.5 max-w-xl text-sm leading-6 text-slate-600">
              AI synthesises resume scores, assessment results, and interview feedback into a unified Hire / Hold / Pass recommendation. The recruiter always makes the final call.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select a candidate</label>
            <select
              value={selectedId}
              onChange={e => selectCandidate(e.target.value)}
              className="rb-input w-full"
              data-testid="select-ai-candidate"
            >
              <option value="">Choose a candidate ({candidates.length})</option>
              {candidates.map(c => (
                <option key={getId(c)} value={getId(c)}>
                  {c.name || c.email || "Unnamed"}{c.aiHiringSynthesis ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            {synthesis ? (
              <button
                type="button"
                onClick={() => void generate(true)}
                disabled={!selectedId || generating}
                className="rb-btn rb-btn-ghost"
                data-testid="button-regenerate-synthesis"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Regenerate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void generate(false)}
                disabled={!selectedId || generating}
                className="rb-btn rb-btn-primary"
                data-testid="button-generate-synthesis"
              >
                {generating ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Brain size={14} /> Generate AI Summary</>}
              </button>
            )}
          </div>
        </div>
        {notice && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            <p className="text-sm text-emerald-800">{notice}</p>
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5">
            <AlertTriangle size={14} className="text-rose-500 shrink-0" />
            <p className="text-sm text-rose-800">{error}</p>
          </div>
        )}
      </div>

      {/* candidate quick-stats */}
      {selected && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rb-card p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resume Score</p>
            <p className={`mt-1 text-2xl font-extrabold ${scorePct >= 70 ? "text-emerald-600" : scorePct >= 50 ? "text-amber-600" : "text-rose-600"}`}>{scorePct}%</p>
          </div>
          <div className="rb-card p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assessment</p>
            <p className={`mt-1 text-2xl font-extrabold ${selected.assessmentStatus === "completed" ? "text-emerald-600" : selected.assessmentStatus === "sent" ? "text-amber-600" : "text-slate-400"}`}>
              {selected.assessmentStatus === "completed" ? "Done" : selected.assessmentStatus === "sent" ? "Sent" : "N/A"}
            </p>
          </div>
          <div className="rb-card p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Stage</p>
            <p className="mt-1 text-lg font-extrabold capitalize text-slate-800">{selected.stage ?? "—"}</p>
          </div>
          <div className="rb-card p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Verdict</p>
            {synthesis ? (
              <span className={`mt-1 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-sm font-bold ${rec?.badge}`}>
                {rec?.emoji} {rec?.label}
              </span>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Not yet</p>
            )}
          </div>
        </div>
      )}

      {/* AI recommendation card */}
      {synthesis && rec && (
        <div className={`rb-card p-5 ring-2 ${rec.glow}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <RecommendationIcon size={28} className={
                synthesis.recommendation === "hire" ? "text-emerald-500" :
                synthesis.recommendation === "hold" ? "text-amber-500" : "text-rose-500"
              } />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">AI Recommendation</p>
                <p className="text-2xl font-extrabold text-slate-900">{rec.emoji} {rec.label}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {synthesis.recruiterDecision ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <BadgeCheck size={13} />
                  Recruiter decision: {synthesis.recruiterDecision}
                  {synthesis.recruiterDecisionAt && <> · {formatDate(synthesis.recruiterDecisionAt)}</>}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDecision(!showDecision)}
                  className="rb-btn rb-btn-secondary rb-btn-sm"
                >
                  Record your decision
                </button>
              )}
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">{synthesis.executiveSummary}</p>

          {/* recruiter decision panel */}
          {showDecision && !synthesis.recruiterDecision && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Record your final decision</p>
              <textarea
                value={decisionNote}
                onChange={e => setDecisionNote(e.target.value)}
                rows={2}
                placeholder="Optional notes about your decision…"
                className="rb-input h-auto resize-none py-2.5 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void recordDecision("accepted")}
                  disabled={saving}
                  className="rb-btn rb-btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                  data-testid="button-decision-accept"
                >
                  <ThumbsUp size={13} /> Accept AI recommendation
                </button>
                <button
                  type="button"
                  onClick={() => void recordDecision("overridden")}
                  disabled={saving}
                  className="rb-btn rb-btn-secondary rb-btn-sm"
                  data-testid="button-decision-override"
                >
                  Override recommendation
                </button>
                <button
                  type="button"
                  onClick={() => void recordDecision("ignored")}
                  disabled={saving}
                  className="rb-btn rb-btn-ghost rb-btn-sm text-slate-500"
                  data-testid="button-decision-ignore"
                >
                  <ThumbsDown size={13} /> Note but ignore
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* detailed synthesis sections */}
      {synthesis && (
        <div className="space-y-3">
          <Section title="Key Reasons for Recommendation">
            <BulletList items={synthesis.keyReasons} icon={ChevronRight} iconClass="text-indigo-500" />
          </Section>

          <Section title="Candidate Strengths">
            <BulletList items={synthesis.strengths} icon={CheckCircle2} iconClass="text-emerald-500" />
          </Section>

          <Section title="Candidate Weaknesses">
            <BulletList items={synthesis.weaknesses} icon={ShieldAlert} iconClass="text-amber-500" />
          </Section>

          <Section title="Risk Factors" defaultOpen={false}>
            <BulletList items={synthesis.riskFactors} icon={AlertTriangle} iconClass="text-rose-500" />
          </Section>

          <Section title="Overall Hiring Fit">
            <p className="text-sm leading-6 text-slate-700">{synthesis.overallFit || "—"}</p>
          </Section>

          <Section title="Suggested Next Step">
            <p className="text-sm leading-6 text-slate-700">{synthesis.suggestedNextStep || "—"}</p>
          </Section>
        </div>
      )}

      {/* resume + assessment summary for context */}
      {selected && (
        <div className="space-y-3">
          {selected.aiSummary && (
            <Section title="Resume AI Summary" defaultOpen={!synthesis}>
              <p className="text-sm leading-6 text-slate-700">{selected.aiSummary}</p>
              {!!(selected.strengths as string[])?.length && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Resume Strengths</p>
                  <BulletList items={selected.strengths as string[]} icon={CheckCircle2} iconClass="text-emerald-500" />
                </div>
              )}
              {!!(selected.redFlags as string[])?.length && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Red Flags</p>
                  <BulletList items={selected.redFlags as string[]} icon={AlertTriangle} iconClass="text-rose-500" />
                </div>
              )}
            </Section>
          )}
          {selected.assessmentStatus === "completed" && selected.assessmentImpact && (
            <Section title="Assessment Summary" defaultOpen={!synthesis}>
              <p className="text-sm leading-6 text-slate-700">{(selected.assessmentImpact as any).reasoning || "Assessment completed."}</p>
              {!!(selected.assessmentImpact as any).strengths?.length && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Assessment Strengths</p>
                  <BulletList items={(selected.assessmentImpact as any).strengths} icon={CheckCircle2} iconClass="text-emerald-500" />
                </div>
              )}
              {!!(selected.assessmentImpact as any).weaknesses?.length && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Assessment Weaknesses</p>
                  <BulletList items={(selected.assessmentImpact as any).weaknesses} icon={ShieldAlert} iconClass="text-amber-500" />
                </div>
              )}
            </Section>
          )}
        </div>
      )}

      {/* empty state */}
      {!selectedId && (
        <div className="rb-card flex min-h-64 flex-col items-center justify-center text-center p-8">
          <Brain className="mb-3 text-slate-300" size={32} />
          <p className="text-sm font-semibold text-slate-700">Select a candidate to view their AI hiring summary</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
            The AI synthesises all available evaluation data into a Hire, Hold, or Pass recommendation. You always make the final call.
          </p>
        </div>
      )}
      {selectedId && !synthesis && !generating && (
        <div className="rb-card flex min-h-52 flex-col items-center justify-center text-center p-8">
          <Brain className="mb-3 text-slate-300" size={28} />
          <p className="text-sm font-semibold text-slate-700">No AI summary yet</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
            Click <strong>Generate AI Summary</strong> above to run the synthesis. Make sure interview feedback has been submitted for the best results.
          </p>
        </div>
      )}
    </section>
  );
}
