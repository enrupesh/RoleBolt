import "./_group.css";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Copy,
  Filter,
  ListFilter,
  Mail,
  MapPin,
  MoreHorizontal,
  PanelRight,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type Stage = "Applied" | "Review" | "Screened" | "Interview" | "Offer";
type Candidate = {
  id: string;
  name: string;
  initials: string;
  email: string;
  stage: Stage;
  score: number;
  signal: string;
  next: string;
  tone: "violet" | "amber" | "teal" | "rose";
  updated: string;
  selected?: boolean;
};

const candidates: Candidate[] = [
  { id: "c1", name: "Maya Chen", initials: "MC", email: "maya.chen@example.com", stage: "Applied", score: 88, signal: "Strong product sense", next: "Review scorecard", tone: "violet", updated: "12 min ago", selected: true },
  { id: "c2", name: "Arjun Patel", initials: "AP", email: "arjun.patel@example.com", stage: "Review", score: 64, signal: "Needs evidence on scope", next: "Add hiring note", tone: "amber", updated: "42 min ago", selected: true },
  { id: "c3", name: "Sofia Alvarez", initials: "SA", email: "sofia.alvarez@example.com", stage: "Screened", score: 91, signal: "Top rubric alignment", next: "Move to interview", tone: "teal", updated: "1 hr ago" },
  { id: "c4", name: "Daniel Kim", initials: "DK", email: "daniel.kim@example.com", stage: "Offer", score: 73, signal: "Offer viewed", next: "Follow up tomorrow", tone: "rose", updated: "3 hrs ago" },
  { id: "c5", name: "Nina Rao", initials: "NR", email: "nina.rao@example.com", stage: "Applied", score: 38, signal: "Scoring failed", next: "Retry scoring", tone: "rose", updated: "Yesterday" },
  { id: "c6", name: "Ethan Brooks", initials: "EB", email: "ethan.brooks@example.com", stage: "Interview", score: 84, signal: "Strong panel feedback", next: "Record decision", tone: "teal", updated: "Yesterday" },
];

const stageCounts: Array<[Stage, number, string]> = [
  ["Applied", 11, "22%"],
  ["Review", 8, "16%"],
  ["Screened", 9, "18%"],
  ["Interview", 6, "12%"],
  ["Offer", 3, "6%"],
];

const toneStyles = {
  violet: "bg-[#ede9fe] text-[#5b45ad]",
  amber: "bg-[#fff1cf] text-[#936817]",
  teal: "bg-[#d9f1ec] text-[#277568]",
  rose: "bg-[#fbe3e2] text-[#aa4c4a]",
};

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Users }) {
  return (
    <div className="cc-metric">
      <div className="flex items-center justify-between">
        <span className="cc-kicker">{label}</span>
        <Icon className="h-4 w-4 text-[#8b849a]" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <strong className="text-[29px] leading-none tracking-[-0.06em] text-[#28233a]">{value}</strong>
        <span className="text-[11px] font-semibold text-[#777185]">{detail}</span>
      </div>
    </div>
  );
}

function CandidateRow({ candidate, checked, onToggle, onOpen }: { candidate: Candidate; checked: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div className={`cc-candidate ${checked ? "cc-candidate-selected" : ""}`}>
      <button type="button" aria-label={`Select ${candidate.name}`} onClick={onToggle} className={`cc-check ${checked ? "cc-check-on" : ""}`}>
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </button>
      <div className={`cc-avatar ${toneStyles[candidate.tone]}`}>{candidate.initials}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" onClick={onOpen} className="truncate text-left text-[13px] font-bold text-[#302b42] hover:text-[#6852bf]">{candidate.name}</button>
          <span className="cc-stage">{candidate.stage}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-[#8c8598]">{candidate.email}</p>
      </div>
      <div className="hidden min-w-[145px] md:block">
        <p className="text-[11px] font-semibold text-[#504960]">{candidate.signal}</p>
        <p className="mt-0.5 text-[10px] text-[#9992a2]">{candidate.updated}</p>
      </div>
      <div className="w-[58px] text-right">
        <span className={`text-[15px] font-extrabold ${candidate.score >= 80 ? "text-[#297e71]" : candidate.score >= 60 ? "text-[#a5761f]" : "text-[#b05251]"}`}>{candidate.score}</span>
        <span className="ml-0.5 text-[10px] text-[#aaa3b0]">/100</span>
      </div>
      <button type="button" onClick={onOpen} className="cc-next hidden w-[122px] items-center justify-between gap-2 rounded-lg border border-[#e6e0eb] bg-[#fbf9fd] px-2.5 py-2 text-left text-[10px] font-bold text-[#5f566d] transition hover:border-[#b9a9eb] hover:bg-[#f4efff] lg:flex">
        <span className="truncate">{candidate.next}</span><ArrowRight className="h-3 w-3 shrink-0" />
      </button>
      <button type="button" onClick={onOpen} className="rounded-lg p-2 text-[#a09aaa] hover:bg-[#f1edf7] hover:text-[#5b45ad]" aria-label={`Open ${candidate.name}`}><ArrowRight className="h-4 w-4" /></button>
    </div>
  );
}

export function CommandCenter() {
  const [activeView, setActiveView] = useState<"Pipeline" | "Decisions" | "Rubric">("Pipeline");
  const [filter, setFilter] = useState<Stage | "All">("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["c1", "c2"]);
  const [notice, setNotice] = useState("");
  const [openCandidate, setOpenCandidate] = useState<string | null>(null);

  const filtered = useMemo(() => candidates.filter((candidate) => {
    const matchesStage = filter === "All" || candidate.stage === filter;
    const matchesQuery = `${candidate.name} ${candidate.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesStage && matchesQuery;
  }), [filter, query]);

  const act = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  return (
    <div className="cc-shell min-h-screen bg-[#f4f1f8] text-[#302b42]">
      <style>{`
        .cc-shell { font-family: "Inter", ui-sans-serif, system-ui, sans-serif; }
        .cc-shell button, .cc-shell input { transition: background-color .18s ease, border-color .18s ease, color .18s ease, transform .18s ease; }
        .cc-shell button:active { transform: translateY(1px); }
        .cc-kicker { color:#948ca0; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
        .cc-panel { border:1px solid #e5e0ea; background:#fffdfd; box-shadow:0 8px 22px rgba(62,44,87,.055); }
        .cc-metric { border:1px solid #e5e0ea; background:#fffdfd; border-radius:16px; padding:15px 16px; box-shadow:0 5px 16px rgba(62,44,87,.04); }
        .cc-stage { border:1px solid #e8e2ec; border-radius:999px; color:#81798d; font-size:10px; font-weight:700; padding:2px 7px; }
        .cc-candidate { align-items:center; border-top:1px solid #eee9f0; display:flex; gap:12px; min-height:74px; padding:11px 13px; }
        .cc-candidate:hover { background:#fbf9fd; }
        .cc-candidate-selected { background:#faf8ff; }
        .cc-check { align-items:center; border:1px solid #d7d0df; border-radius:5px; color:white; display:flex; height:17px; justify-content:center; width:17px; }
        .cc-check-on { background:#6d59c8; border-color:#6d59c8; }
        .cc-avatar { align-items:center; border-radius:11px; display:flex; flex:0 0 auto; font-size:10px; font-weight:800; height:33px; justify-content:center; width:33px; }
        @media (max-width: 640px) { .cc-candidate { gap:8px; padding-left:8px; padding-right:8px; } .cc-avatar { display:none; } }
      `}</style>
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#e4dfe8] pb-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => act("Returning to jobs")} className="rounded-xl border border-[#e2dce8] bg-[#fffdfd] p-2.5 text-[#71687f] hover:border-[#b9a9eb] hover:text-[#5b45ad]" aria-label="Back to jobs"><ArrowLeft className="h-4 w-4" /></button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#6d59c8] text-sm font-black text-white">R</div>
              <span className="text-[15px] font-extrabold tracking-[-0.03em] text-[#332d43]">Rolebolt</span>
            </div>
            <span className="hidden h-5 w-px bg-[#ddd6e2] sm:block" />
            <span className="hidden text-[12px] font-semibold text-[#8b8395] sm:block">Hiring workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => act("Link copied to clipboard")} className="hidden items-center gap-1.5 rounded-lg border border-[#e2dce8] bg-[#fffdfd] px-3 py-2 text-[11px] font-bold text-[#655d70] hover:border-[#b9a9eb] sm:flex"><Copy className="h-3.5 w-3.5" /> Copy link</button>
            <button type="button" onClick={() => act("Notifications are up to date")} className="rounded-lg border border-[#e2dce8] bg-[#fffdfd] p-2 text-[#71687f] hover:border-[#b9a9eb]" aria-label="Notifications"><Bell className="h-4 w-4" /></button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7c9f2] text-[11px] font-extrabold text-[#5a458d]">AR</div>
          </div>
        </header>

        <section className="pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#e9e2fb] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#654bb2]">Standard Job</span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#3f927f]"><span className="h-1.5 w-1.5 rounded-full bg-[#49a891]" /> Open · 18 days active</span>
              </div>
              <h1 className="text-[27px] font-extrabold tracking-[-.055em] text-[#2e283e] sm:text-[32px]">Senior Product Designer</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-medium text-[#847b90]">
                <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5" /> RoleBolt · Product</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Bengaluru · Hybrid</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Created Jul 18, 2026</span>
              </div>
            </div>
            <button type="button" onClick={() => act("Autopilot review started")} className="inline-flex items-center gap-2 rounded-xl bg-[#6d59c8] px-4 py-2.5 text-[12px] font-extrabold text-white shadow-[0_7px_15px_rgba(109,89,200,.22)] hover:bg-[#5e4ab6]"><Sparkles className="h-4 w-4" /> Run next review</button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Candidates" value="42" detail="+11 this week" icon={Users} />
            <Metric label="In decision zone" value="14" detail="6 need action" icon={ClipboardCheck} />
            <Metric label="Avg. match" value="76" detail="+4 vs last role" icon={SlidersHorizontal} />
            <Metric label="Time to fill" value="18d" detail="Target: 24d" icon={Clock3} />
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <main className="cc-panel min-w-0 overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eae5ed] px-4 pb-0 pt-3 sm:px-5">
              <div className="flex gap-5">
                {(["Pipeline", "Decisions", "Rubric"] as const).map((view) => <button type="button" key={view} onClick={() => setActiveView(view)} className={`relative pb-3 text-[12px] font-extrabold ${activeView === view ? "text-[#5c48ad] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#6d59c8]" : "text-[#9a92a2] hover:text-[#5e566d]"}`}>{view}{view === "Decisions" ? <span className="ml-1.5 rounded-full bg-[#f8e7c9] px-1.5 py-0.5 text-[9px] text-[#9a6b24]">6</span> : null}</button>)}
              </div>
              <button type="button" onClick={() => act("Pipeline view options opened")} className="mb-2 rounded-lg p-1.5 text-[#9a92a2] hover:bg-[#f2eef6]"><MoreHorizontal className="h-4 w-4" /></button>
            </div>
            <div className="border-b border-[#eee9f0] bg-[#fcfafd] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-[15px] font-extrabold tracking-[-.02em] text-[#342e43]">{activeView === "Pipeline" ? "Candidate pipeline" : activeView === "Decisions" ? "Decisions waiting on you" : "Hiring rubric coverage"}</h2><p className="mt-0.5 text-[11px] text-[#938b9c]">{activeView === "Pipeline" ? "Move from signal to a confident human decision." : activeView === "Decisions" ? "Six candidates have a clear next action." : "The evidence behind every match score."}</p></div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[#e4dfe8] bg-white px-2.5 py-2"><Search className="h-3.5 w-3.5 text-[#aaa2b0]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" className="w-[118px] bg-transparent text-[11px] font-semibold text-[#443c51] outline-none placeholder:text-[#aaa2b0] sm:w-[155px]" /></div>
                  <button type="button" onClick={() => act("Filters ready")} className="rounded-lg border border-[#e4dfe8] bg-white p-2 text-[#81788d] hover:border-[#b9a9eb]" aria-label="Filter candidates"><ListFilter className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 flex gap-1.5 overflow-x-auto pb-0.5">{(["All", ...stageCounts.map(([stage]) => stage)] as const).map((stage) => <button type="button" key={stage} onClick={() => setFilter(stage as Stage | "All")} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-extrabold ${filter === stage ? "bg-[#6d59c8] text-white" : "bg-[#f0edf4] text-[#81798d] hover:bg-[#e6e0ed]"}`}>{stage}<span className="ml-1 opacity-65">{stage === "All" ? 42 : stageCounts.find(([name]) => name === stage)?.[1]}</span></button>)}</div>
            </div>
            {selected.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8e1ef] bg-[#f5f0ff] px-4 py-2.5 sm:px-5"><span className="text-[11px] font-extrabold text-[#624cae]">{selected.length} candidates selected</span><div className="flex gap-1.5"><button type="button" onClick={() => act("Message draft opened")} className="inline-flex items-center gap-1 rounded-lg border border-[#ddd2f5] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#654fb1]"><Mail className="h-3 w-3" /> Message</button><button type="button" onClick={() => { setSelected([]); act("Candidates shortlisted"); }} className="inline-flex items-center gap-1 rounded-lg border border-[#ddd2f5] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#654fb1]"><Check className="h-3 w-3" /> Shortlist</button><button type="button" onClick={() => setSelected([])} className="rounded-lg p-1.5 text-[#8a7aa9] hover:bg-white" aria-label="Clear selection"><X className="h-3.5 w-3.5" /></button></div></div> : null}
            <div className="hidden items-center gap-3 bg-[#fffdfd] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#aaa1b0] sm:flex"><span className="w-[17px]" /><span className="w-[33px]" /><span className="flex-1">Candidate</span><span className="w-[145px]">Latest signal</span><span className="w-[58px] text-right">Score</span><span className="w-[122px]">Next action</span><span className="w-4" /></div>
            <div>{filtered.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} checked={selected.includes(candidate.id)} onToggle={() => setSelected((current) => current.includes(candidate.id) ? current.filter((id) => id !== candidate.id) : [...current, candidate.id])} onOpen={() => setOpenCandidate(candidate.id)} />)}</div>
            {filtered.length === 0 ? <div className="px-6 py-14 text-center"><Filter className="mx-auto h-6 w-6 text-[#b5adbd]" /><p className="mt-2 text-sm font-bold text-[#665d70]">No candidates match this view</p><button type="button" onClick={() => { setFilter("All"); setQuery(""); }} className="mt-3 text-[11px] font-bold text-[#6d59c8]">Clear filters</button></div> : null}
          </main>

          <aside className="space-y-5">
            <section className="cc-panel rounded-2xl p-4">
              <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-[#ba7c28]" /><h2 className="text-[13px] font-extrabold text-[#393144]">Next decision</h2></div><p className="mt-2 text-[12px] font-bold leading-5 text-[#4f465e]">Review Maya Chen's scorecard</p><p className="mt-1 text-[11px] leading-4 text-[#958c9e]">Strong product sense, but one rubric signal is still unconfirmed.</p></div><span className="rounded-full bg-[#fff0d6] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#a26e22]">Due today</span></div>
              <button type="button" onClick={() => setOpenCandidate("c1")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#332d43] px-3 py-2.5 text-[11px] font-extrabold text-white hover:bg-[#4b425b]">Open decision <ArrowRight className="h-3.5 w-3.5" /></button>
            </section>
            <section className="cc-panel rounded-2xl p-4">
              <div className="flex items-center justify-between"><h2 className="text-[13px] font-extrabold text-[#393144]">Pipeline health</h2><button type="button" onClick={() => act("Pipeline filters opened")} className="text-[#9b92a2] hover:text-[#6d59c8]" aria-label="Pipeline health options"><MoreHorizontal className="h-4 w-4" /></button></div>
              <div className="mt-4 space-y-3">{stageCounts.map(([stage, count, width]) => <button type="button" onClick={() => setFilter(stage)} key={stage} className="group flex w-full items-center gap-2.5 text-left"><span className="w-[59px] text-[10px] font-bold text-[#7d7488]">{stage}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-[#eeeaf1]"><span className="block h-full rounded-full bg-[#8670d3] transition group-hover:bg-[#6d59c8]" style={{ width }} /></span><span className="w-5 text-right text-[11px] font-extrabold text-[#484052]">{count}</span></button>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#eee9f0] pt-3"><div><p className="cc-kicker">Conversion</p><p className="mt-1 text-[16px] font-extrabold text-[#322d41]">14.8%</p></div><div><p className="cc-kicker">Stalled</p><p className="mt-1 text-[16px] font-extrabold text-[#b16d3f]">4</p></div></div>
            </section>
            <section className="rounded-2xl border border-[#dcd4ef] bg-[#eee9fc] p-4">
              <div className="flex items-center gap-2"><PanelRight className="h-4 w-4 text-[#6a54ba]" /><h2 className="text-[12px] font-extrabold text-[#4c3a88]">Standard Job signal</h2></div><p className="mt-2 text-[11px] leading-5 text-[#685b91]">Rubric signals, stage movement, and human decisions stay connected here. Nothing gets lost between a score and a hire.</p><button type="button" onClick={() => setActiveView("Rubric")} className="mt-3 text-[10px] font-extrabold text-[#604ab0] hover:underline">View hiring rubric <ArrowRight className="ml-1 inline h-3 w-3" /></button>
            </section>
          </aside>
        </div>
      </div>
      {openCandidate ? <div className="fixed inset-0 z-20 flex items-end justify-center bg-[#2f2740]/20 p-3 backdrop-blur-[2px] sm:items-center"><div className="cc-panel w-full max-w-[430px] rounded-2xl p-5 shadow-2xl"><div className="flex items-start justify-between"><div><span className="cc-kicker">Candidate review</span><h2 className="mt-1 text-xl font-extrabold text-[#332d43]">{candidates.find((candidate) => candidate.id === openCandidate)?.name}</h2></div><button type="button" onClick={() => setOpenCandidate(null)} className="rounded-lg p-1.5 text-[#8f8797] hover:bg-[#f1edf5]" aria-label="Close review"><X className="h-4 w-4" /></button></div><div className="mt-5 rounded-xl bg-[#f7f3ff] p-4"><p className="cc-kicker">Decision prompt</p><p className="mt-2 text-sm font-bold leading-6 text-[#484052]">Does the evidence support moving this candidate to the next stage?</p><div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-[#847b90]">Match score</span><strong className="text-lg text-[#5d49ad]">{candidates.find((candidate) => candidate.id === openCandidate)?.score}/100</strong></div></div><div className="mt-5 flex gap-2"><button type="button" onClick={() => { setOpenCandidate(null); act("Candidate moved to next stage"); }} className="flex-1 rounded-xl bg-[#6d59c8] px-3 py-2.5 text-[11px] font-extrabold text-white hover:bg-[#5e4ab6]">Move forward</button><button type="button" onClick={() => { setOpenCandidate(null); act("Decision saved for later"); }} className="flex-1 rounded-xl border border-[#e2dce8] bg-white px-3 py-2.5 text-[11px] font-extrabold text-[#5f566d] hover:border-[#b9a9eb]">Hold decision</button></div></div></div> : null}
      {notice ? <div role="status" className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-[#332d43] px-4 py-2.5 text-[11px] font-bold text-white shadow-xl">{notice}</div> : null}
    </div>
  );
}

export default CommandCenter;