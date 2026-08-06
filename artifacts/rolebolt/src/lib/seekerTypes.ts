export type TrackerSource = "rolebolt" | "external" | "manual";

export type TrackerStage =
  | "saved" | "applied" | "screening" | "assessment" | "interview"
  | "offer" | "hired" | "rejected" | "ghosted" | "archived";

export interface UnifiedTrackerItem {
  id: string;
  source: TrackerSource;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  stage: string;
  stageLabel: string;
  appliedAt?: string;
  updatedAt?: string;
  matchScore?: number;
  totalScore?: number;
  maxScore?: number;
  sourceUrl?: string;
  platform?: string;
  jobId?: string;
  workspaceId?: string;
  candidateId?: string;
  nextAction?: string;
  nextFollowUpAt?: string;
  notes?: string;
  recentEmail?: {
    subject: string;
    summary: string;
    interviewDate?: string;
    parsedAt?: string;
  };
}

export interface CareerGpsPayload {
  headline: string;
  stats: {
    totalActive: number;
    interviews: number;
    offers: number;
    externalTracking: number;
    staleCount: number;
    weeklyApplications: number;
    weeklyGoal: number;
  };
  funnel: { stage: string; count: number }[];
  nextActions: { priority: "high" | "medium" | "low"; title: string; detail: string; href?: string }[];
  followUpsDue: UnifiedTrackerItem[];
  momentumScore: number;
}

export const STAGE_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  screened: "bg-indigo-100 text-indigo-700",
  screening: "bg-indigo-100 text-indigo-700",
  assessed: "bg-purple-100 text-purple-700",
  assessment: "bg-purple-100 text-purple-700",
  interview: "bg-amber-100 text-amber-700",
  offer: "bg-green-100 text-green-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  saved: "bg-slate-100 text-slate-700",
  analyzed: "bg-violet-100 text-violet-700",
  ghosted: "bg-slate-200 text-slate-600",
  archived: "bg-slate-100 text-slate-500",
};

export const SOURCE_LABELS: Record<TrackerSource, string> = {
  rolebolt: "Rolebolt",
  external: "External",
  manual: "Manual",
};

export const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  google_jobs: "Google Jobs",
  company_site: "Company site",
  rolebolt: "Rolebolt",
  other: "Other",
};
