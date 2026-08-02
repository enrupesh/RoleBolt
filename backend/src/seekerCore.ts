import { User } from "./models/User";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitJob } from "./models/RecruitJob";
import { RecruitSeekerProfile } from "./models/RecruitSeekerProfile";
import { RecruitSeekerWorkspace } from "./models/RecruitSeekerWorkspace";
import { RecruitSeekerTrackerEntry, type TrackerStage } from "./models/RecruitSeekerTrackerEntry";

export type TrackerSource = "rolebolt" | "external" | "manual";

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

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screened: "Screening",
  screening: "Screening",
  assessed: "Assessment",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  saved: "Saved",
  analyzed: "Analyzing",
  archived: "Archived",
  ghosted: "No response",
};

function workspaceStageToTracker(status: string): string {
  if (status === "applied") return "applied";
  if (status === "analyzed") return "screening";
  if (status === "saved") return "saved";
  if (status === "archived") return "archived";
  return status;
}

export async function getSeekerEmail(uid: string): Promise<string | null> {
  const profile = await RecruitSeekerProfile.findOne({ uid }).lean() as { email?: string } | null;
  if (profile?.email) return profile.email.trim().toLowerCase();
  const user = await User.findById(uid).lean() as { email?: string } | null;
  return user?.email?.trim().toLowerCase() ?? null;
}

export async function buildUnifiedTracker(uid: string): Promise<UnifiedTrackerItem[]> {
  const email = await getSeekerEmail(uid);
  const items: UnifiedTrackerItem[] = [];

  if (email) {
    const candidates = await RecruitCandidate.find({ email }).sort({ createdAt: -1 }).lean();
    const jobIds = [...new Set(candidates.map((c: any) => c.jobId?.toString()).filter(Boolean))];
    const jobs = jobIds.length
      ? await RecruitJob.find({ _id: { $in: jobIds } }).select("title companyName location workMode").lean()
      : [];
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j._id.toString()] = j;

    for (const c of candidates as any[]) {
      const job = jobMap[c.jobId?.toString()] ?? {};
      items.push({
        id: `rb-${c._id.toString()}`,
        source: "rolebolt",
        candidateId: c._id.toString(),
        jobId: c.jobId?.toString(),
        title: job.title ?? "Unknown Role",
        companyName: job.companyName ?? "",
        location: job.location ?? "",
        workMode: job.workMode ?? "",
        stage: c.stage ?? "applied",
        stageLabel: STAGE_LABELS[c.stage] ?? c.stage ?? "Applied",
        appliedAt: c.createdAt?.toISOString?.() ?? undefined,
        updatedAt: (c.stageMovedAt ?? c.updatedAt ?? c.createdAt)?.toISOString?.(),
        totalScore: c.totalScore ?? 0,
        maxScore: c.maxScore ?? 0,
        matchScore: c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : undefined,
        platform: "rolebolt",
      });
    }
  }

  const workspaces = await RecruitSeekerWorkspace.find({ uid, status: { $ne: "archived" } })
    .sort({ updatedAt: -1 })
    .lean();
  for (const w of workspaces as any[]) {
    const stage = workspaceStageToTracker(w.status ?? "saved");
    items.push({
      id: `ws-${w._id.toString()}`,
      source: "external",
      workspaceId: w._id.toString(),
      title: w.title ?? "Untitled job",
      companyName: w.companyName ?? "",
      location: w.location ?? "",
      workMode: w.workMode ?? "",
      stage,
      stageLabel: STAGE_LABELS[stage] ?? stage,
      appliedAt: w.status === "applied" ? w.updatedAt?.toISOString?.() : undefined,
      updatedAt: w.updatedAt?.toISOString?.(),
      matchScore: w.analysis?.matchScore,
      sourceUrl: w.sourceUrl || undefined,
      platform: w.sourceType === "url" ? detectPlatform(w.sourceUrl) : "manual",
      notes: w.notes ?? "",
    });
  }

  const manual = await RecruitSeekerTrackerEntry.find({ uid }).sort({ updatedAt: -1 }).lean();
  for (const m of manual as any[]) {
    const recent = m.emailIntel?.length ? m.emailIntel[m.emailIntel.length - 1] : null;
    items.push({
      id: `tr-${m._id.toString()}`,
      source: "manual",
      title: m.title ?? "Untitled role",
      companyName: m.companyName ?? "",
      location: m.location ?? "",
      workMode: m.workMode ?? "",
      stage: m.stage ?? "applied",
      stageLabel: STAGE_LABELS[m.stage] ?? m.stage,
      appliedAt: m.appliedAt?.toISOString?.(),
      updatedAt: m.updatedAt?.toISOString?.(),
      sourceUrl: m.sourceUrl || undefined,
      platform: m.platform ?? "other",
      workspaceId: m.workspaceId || undefined,
      nextAction: m.nextAction || undefined,
      nextFollowUpAt: m.nextFollowUpAt?.toISOString?.(),
      notes: m.notes ?? "",
      recentEmail: recent
        ? {
            subject: recent.subject,
            summary: recent.summary,
            interviewDate: recent.interviewDate?.toISOString?.(),
            parsedAt: recent.parsedAt?.toISOString?.(),
          }
        : undefined,
    });
  }

  items.sort((a, b) => {
    const ta = new Date(a.updatedAt ?? a.appliedAt ?? 0).getTime();
    const tb = new Date(b.updatedAt ?? b.appliedAt ?? 0).getTime();
    return tb - ta;
  });

  return items;
}

function detectPlatform(url: string): string {
  const u = (url || "").toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("indeed.com")) return "indeed";
  if (u.includes("glassdoor.com")) return "glassdoor";
  if (u.includes("google.com")) return "google_jobs";
  if (u.includes("rolebolt")) return "rolebolt";
  return "company_site";
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

export async function buildCareerGps(uid: string): Promise<CareerGpsPayload> {
  const profile = await RecruitSeekerProfile.findOne({ uid }).lean() as any;
  const weeklyGoal = Math.max(1, Number(profile?.weeklyApplicationGoal) || 5);
  const tracker = await buildUnifiedTracker(uid);

  const activeStages = new Set(["applied", "screened", "screening", "assessed", "assessment", "analyzed", "saved", "interview", "offer"]);
  const active = tracker.filter(t => activeStages.has(t.stage));
  const interviews = tracker.filter(t => t.stage === "interview").length;
  const offers = tracker.filter(t => t.stage === "offer").length;
  const external = tracker.filter(t => t.source !== "rolebolt").length;

  const now = Date.now();
  const staleCutoff = now - 14 * 24 * 60 * 60 * 1000;
  const stale = active.filter(t => {
    const ts = new Date(t.updatedAt ?? t.appliedAt ?? 0).getTime();
    return ts > 0 && ts < staleCutoff && !["rejected", "hired", "archived"].includes(t.stage);
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weeklyApplications = tracker.filter(t => {
    if (!t.appliedAt) return false;
    return new Date(t.appliedAt).getTime() >= weekStart.getTime();
  }).length;

  const funnelMap: Record<string, number> = {};
  for (const t of tracker) {
    const key = t.stageLabel || t.stage;
    funnelMap[key] = (funnelMap[key] ?? 0) + 1;
  }
  const funnel = Object.entries(funnelMap).map(([stage, count]) => ({ stage, count }));

  const followUpsDue = tracker.filter(t => {
    if (!t.nextFollowUpAt) return false;
    return new Date(t.nextFollowUpAt).getTime() <= now + 3 * 24 * 60 * 60 * 1000;
  }).slice(0, 5);

  const nextActions: CareerGpsPayload["nextActions"] = [];

  if (!profile?.resumeText?.trim()) {
    nextActions.push({
      priority: "high",
      title: "Add your resume",
      detail: "Most AI tools and one-click apply need a saved resume on your profile.",
      href: "/seeker/profile",
    });
  }

  if (weeklyApplications < weeklyGoal) {
    nextActions.push({
      priority: "high",
      title: `Apply to ${weeklyGoal - weeklyApplications} more roles this week`,
      detail: `You're at ${weeklyApplications}/${weeklyGoal} applications for this week. Consistency beats volume spikes.`,
      href: "/recruit/opportunities",
    });
  }

  if (stale.length > 0) {
    nextActions.push({
      priority: "medium",
      title: `Follow up on ${stale.length} quiet application${stale.length > 1 ? "s" : ""}`,
      detail: "No movement in 14+ days — send a polite check-in or mark as ghosted.",
      href: "/seeker/tracker",
    });
  }

  if (followUpsDue.length > 0) {
    nextActions.push({
      priority: "high",
      title: `${followUpsDue.length} follow-up${followUpsDue.length > 1 ? "s" : ""} due soon`,
      detail: "Review your tracker reminders before they slip.",
      href: "/seeker/tracker",
    });
  }

  if (interviews > 0) {
    nextActions.push({
      priority: "medium",
      title: "Prep for upcoming interviews",
      detail: "Run a mock interview while the job context is fresh.",
      href: "/seeker/interview-prep",
    });
  }

  if (nextActions.length === 0) {
    nextActions.push({
      priority: "low",
      title: "Save jobs from anywhere",
      detail: "Use the browser extension or Job Workspace to track roles outside Rolebolt.",
      href: "/seeker/workspace",
    });
  }

  const momentumScore = Math.min(
    100,
    Math.round(
      (Math.min(weeklyApplications / weeklyGoal, 1) * 40) +
      (interviews * 10) +
      (offers * 15) +
      (Math.min(active.length, 10) * 2) -
      (stale.length * 3)
    )
  );

  return {
    headline: profile?.headline || profile?.preferredNiche || "Your job search command center",
    stats: {
      totalActive: active.length,
      interviews,
      offers,
      externalTracking: external,
      staleCount: stale.length,
      weeklyApplications,
      weeklyGoal,
    },
    funnel,
    nextActions: nextActions.slice(0, 6),
    followUpsDue,
    momentumScore: Math.max(0, momentumScore),
  };
}

export function trackerEntryDto(entry: any) {
  return {
    id: entry._id.toString(),
    title: entry.title,
    companyName: entry.companyName,
    location: entry.location,
    workMode: entry.workMode,
    platform: entry.platform,
    sourceUrl: entry.sourceUrl,
    stage: entry.stage,
    appliedAt: entry.appliedAt,
    lastContactAt: entry.lastContactAt,
    nextFollowUpAt: entry.nextFollowUpAt,
    nextAction: entry.nextAction,
    notes: entry.notes,
    workspaceId: entry.workspaceId,
    emailIntel: entry.emailIntel ?? [],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export const VALID_TRACKER_STAGES: TrackerStage[] = [
  "saved", "applied", "screening", "assessment", "interview", "offer", "hired", "rejected", "ghosted", "archived",
];
