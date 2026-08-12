export type FormStage =
  | "new"
  | "scored"
  | "review_zone"
  | "shortlisted"
  | "assessment"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export const FORM_STAGES: { id: FormStage; label: string; color: string; bg: string }[] = [
  { id: "new", label: "New", color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
  { id: "scored", label: "Scored", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  { id: "review_zone", label: "Review", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  { id: "shortlisted", label: "Shortlisted", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  { id: "assessment", label: "Assessment", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  { id: "interview", label: "Interview", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  { id: "offer", label: "Offer", color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  { id: "hired", label: "Hired", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  { id: "rejected", label: "Rejected", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
  { id: "withdrawn", label: "Withdrawn", color: "text-slate-500", bg: "bg-slate-100 border-slate-300" },
];

/** Creator-friendly primary filters — internal stages still available in card dropdown */
export type FormStageFilter = "all" | "new" | "review" | "shortlisted" | "interview" | "hired" | "rejected";

export const FORM_STAGE_FILTERS: { id: FormStageFilter; label: string; stages: FormStage[] }[] = [
  { id: "all", label: "All", stages: [] },
  { id: "new", label: "New", stages: ["new", "scored"] },
  { id: "review", label: "Review", stages: ["review_zone", "assessment"] },
  { id: "shortlisted", label: "Shortlisted", stages: ["shortlisted"] },
  { id: "interview", label: "Interview", stages: ["interview", "offer"] },
  { id: "hired", label: "Hired", stages: ["hired"] },
  { id: "rejected", label: "Rejected", stages: ["rejected", "withdrawn"] },
];

export function matchesFormStageFilter(stage: FormStage, filter: FormStageFilter): boolean {
  if (filter === "all") return true;
  const entry = FORM_STAGE_FILTERS.find(f => f.id === filter);
  return entry ? entry.stages.includes(stage) : true;
}

export type FormPageTab = "responses" | "insights" | "autopilot";
