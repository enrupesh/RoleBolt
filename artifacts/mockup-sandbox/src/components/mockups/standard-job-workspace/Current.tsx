import "./_group.css";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Bell, ChevronDown, ClipboardList, Copy, Filter, Mail, MoreHorizontal, Search, Sparkles, Star, Users, AlertTriangle, BriefcaseBusiness, CalendarDays, MapPin, SquareCheckBig, LayoutGrid, PanelTop, BadgeInfo, Send, RotateCcw } from "lucide-react";
import JobTabNav, { type JobTabId } from "./JobTabNav";
import NeedsAttentionQueue from "./NeedsAttentionQueue";

type CandidateStage = "applied" | "review_zone" | "screened" | "assessed" | "interview" | "offer" | "hired" | "rejected";

type Candidate = {
  _id: string;
  name: string;
  email: string;
  totalScore: number;
  maxScore: number;
  stage: CandidateStage;
  createdAt: string;
  stageMovedAt: string;
  scoringFailed?: boolean;
  assessmentStatus?: string;
  assessmentSentAt?: string;
  assessmentCompletedAt?: string;
  hiringDecision?: "strong_yes" | "maybe" | "no" | null;
  offerStatus?: string;
  offerCandidateStatus?: string;
  offerDetails?: { offerExpiryDate?: string };
  aiHiringSynthesis?: { recommendation?: "hire" | "hold" | "pass"; recruiterDecision?: "accepted" | "overridden" | "ignored" };
};

const candidates: Candidate[] = [
  { _id: "c1", name: "Maya Chen", email: "maya.chen@example.com", totalScore: 88, maxScore: 100, stage: "applied", createdAt: "2026-07-26T09:30:00Z", stageMovedAt: "2026-07-27T10:15:00Z", assessmentStatus: "sent", assessmentSentAt: "2026-07-28T12:00:00Z", hiringDecision: "strong_yes", aiHiringSynthesis: { recommendation: "hire" } },
  { _id: "c2", name: "Arjun Patel", email: "arjun.patel@example.com", totalScore: 64, maxScore: 100, stage: "review_zone", createdAt: "2026-07-22T09:30:00Z", stageMovedAt: "2026-07-23T10:15:00Z", assessmentStatus: "completed", assessmentCompletedAt: "2026-07-29T15:10:00Z", hiringDecision: "maybe", aiHiringSynthesis: { recommendation: "hold" } },
  { _id: "c3", name: "Sofia Alvarez", email: "sofia.alvarez@example.com", totalScore: 91, maxScore: 100, stage: "screened", createdAt: "2026-07-20T09:30:00Z", stageMovedAt: "2026-07-29T10:45:00Z", assessmentStatus: "invited", assessmentSentAt: "2026-07-30T16:40:00Z", hiringDecision: "strong_yes", aiHiringSynthesis: { recommendation: "hire" } },
  { _id: "c4", name: "Daniel Kim", email: "daniel.kim@example.com", totalScore: 73, maxScore: 100, stage: "offer", createdAt: "2026-07-12T09:30:00Z", stageMovedAt: "2026-07-30T13:25:00Z", offerStatus: "sent", offerCandidateStatus: "viewed", offerDetails: { offerExpiryDate: "2026-08-03T18:00:00Z" }, aiHiringSynthesis: { recommendation: "hire" } },
  { _id: "c5", name: "Nina Rao", email: "nina.rao@example.com", totalScore: 38, maxScore: 100, stage: "applied", createdAt: "2026-07-18T09:30:00Z", stageMovedAt: "2026-07-18T09:30:00Z", scoringFailed: true, aiHiringSynthesis: { recommendation: "pass" } },
  { _id: "c6", name: "Ethan Brooks", email: "ethan.brooks@example.com", totalScore: 84, maxScore: 100, stage: "interview", createdAt: "2026-07-24T09:30:00Z", stageMovedAt: "2026-07-30T11:00:00Z", hiringDecision: "strong_yes" },
];

const job = {
  title: "Standard Job recruiter workspace",
  department: "Product",
  seniority: "Senior",
  location: "Bengaluru, India",
  workMode: "Hybrid",
  status: "Open",
  companyName: "RoleBolt",
  candidateCount: 42,
  createdAt: "2026-07-18T09:00:00Z",
};

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const pct = Math.round((candidate.totalScore / candidate.maxScore) * 100);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{candidate.name}</h3>
            {candidate.scoringFailed ? <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600">Scoring failed</span> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{candidate.email}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-right">
          <div className="text-sm font-bold text-[var(--foreground)]">{pct}%</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Match</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5">{candidate.stage.replace("_", " ")}</span>
        <span>{candidate.assessmentStatus ?? "not sent"}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[var(--surface-muted)]">
        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">Moved {new Date(candidate.stageMovedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <button className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:border-indigo-500/40">
          Open <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
        </button>
      </div>
    </div>
  );
}

export function Current() {
  const [activeTab, setActiveTab] = useState<JobTabId>("pipeline");
  const [selected] = useState<string[]>(["c1", "c2"]);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => candidates.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.email.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 py-5">
        <header className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)]"><ArrowLeft className="h-4 w-4" /></button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-extrabold tracking-[-0.03em]">{job.title}</h1>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{job.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-4 w-4" />{job.companyName}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{job.location}</span>
                  <span className="inline-flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" />{job.department} · {job.seniority}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"><Copy className="h-4 w-4" />Copy link</button>
              <button className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"><Bell className="h-4 w-4" />Notify</button>
              <button className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(67,56,202,0.32)]"><Sparkles className="h-4 w-4" />Autopilot</button>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-4">
          {[
            ["Candidates", job.candidateCount, Users],
            ["In review", 14, ClipboardList],
            ["Needs attention", 6, AlertTriangle],
            ["Offers sent", 3, Mail],
          ].map(([label, value, Icon]) => (
            <CardMetric key={String(label)} label={label as string} value={value as number} Icon={Icon as LucideIcon} />
          ))}
        </section>

        <div className="mt-5">
          <NeedsAttentionQueue candidates={candidates} perfAlerts={[{ id: "a1", type: "low_applications", message: "Only 11 applications in the last 7 days. Consider boosting distribution." }]} agentMode={{ enabled: true }} onAction={() => setActiveTab("pipeline")} />
        </div>

        <main className="grid flex-1 gap-5 lg:grid-cols-[1.7fr_0.9fr]">
          <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <JobTabNav activeTab={activeTab} onSelectTab={setActiveTab} />
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {["All", "Applied", "Review", "Screened", "Interview", "Offer"].map((pill, i) => (
                <button key={pill} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${i === 0 ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
                  <Filter className="h-3.5 w-3.5" />{pill}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates" className="w-52 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]" />
              </div>
            </div>

            {selected.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700"><SquareCheckBig className="h-4 w-4" />{selected.length} selected</div>
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold"><Send className="h-3.5 w-3.5" />Email</button>
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold"><Star className="h-3.5 w-3.5" />Shortlist</button>
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5" />Reassign</button>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((candidate) => <CandidateCard key={candidate._id} candidate={candidate} />)}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Job identity</h2>
                <MoreHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-[var(--text-secondary)]">Recruiter workspace</span><span className="font-semibold">Standard Job</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--text-secondary)]">Created</span><span className="font-semibold">{new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--text-secondary)]">Work mode</span><span className="font-semibold">{job.workMode}</span></div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Quick actions</h2>
              <div className="mt-4 grid gap-2">
                {[
                  ["Send assessment", Mail],
                  ["Schedule interview", CalendarDays],
                  ["Open job description", PanelTop],
                  ["View scoring rubric", BadgeInfo],
                ].map(([label, Icon]) => (
                  <button key={String(label)} className="inline-flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-left text-sm font-semibold">
                    <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-[var(--text-muted)]" />{label as string}</span>
                    <ChevronDown className="h-4 w-4 -rotate-90 text-[var(--text-muted)]" />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Pipeline summary</h2>
              <div className="mt-4 space-y-3">
                {[
                  ["Applied", 11],
                  ["Review", 8],
                  ["Screened", 9],
                  ["Interview", 6],
                  ["Offer", 3],
                  ["Hired", 1],
                ].map(([stage, count]) => (
                  <div key={String(stage)} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-semibold text-[var(--text-secondary)]">{stage as string}</div>
                    <div className="h-2 flex-1 rounded-full bg-[var(--surface-muted)]"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(18, (count as number) * 10)}%` }} /></div>
                    <div className="w-6 text-right text-xs font-semibold">{count as number}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function CardMetric({ label, value, Icon }: { label: string; value: number; Icon: LucideIcon }) {
  return (
            <div key={String(label)} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">{label as string}</p>
                <Icon className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-[-0.03em]">{value as number}</div>
            </div>
  );
}

export default Current;
export type { JobTabId };