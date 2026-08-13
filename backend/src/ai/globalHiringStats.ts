/**
 * globalHiringStats — deterministic organisation-wide hiring metrics.
 *
 * Used by:
 *  - buildGlobalContextPrompt (as grounding data the AI reasons over)
 *  - GET /recruit/copilot/global-stats (Organization Context Panel)
 *  - POST /recruit/copilot/insights (the auto-generated "Good morning" card)
 *
 * Everything here is computed directly from the data — no AI calls, no
 * guessing. The AI is only used later to phrase the numbers into prose.
 */

export interface GlobalJobLite {
  _id: any;
  title: string;
  department?: string;
  status: string;
  openings?: number;
  candidateCount?: number;
  mustHaveSkills?: string;
}

export interface GlobalCandidateLite {
  _id: any;
  jobId: any;
  name: string;
  totalScore: number;
  maxScore: number;
  stage: string;
  hiringDecision?: string | null;
  assessmentStatus?: string;
  strengths?: string[];
  redFlags?: string[];
  scoreBreakdown?: Array<{ criterion: string; score: number; maxScore: number }>;
  location?: string;
  availability?: string;
  createdAt?: Date;
  stageMovedAt?: Date;
}

export interface JobPipelineStat {
  jobId: string;
  title: string;
  department?: string;
  candidateCount: number;
  avgScorePct: number | null;
}

export interface GlobalHiringStats {
  activeJobs: number;
  openPositions: number;
  totalCandidates: number;
  interviewReady: number;
  offersSent: number;
  avgFitScorePct: number | null;
  topPipeline: JobPipelineStat | null;
  weakestPipeline: JobPipelineStat | null;
  highestRatedCandidate: { id: string; name: string; jobTitle: string; scorePct: number } | null;
  mostCommonMissingSkills: string[];
  recentActivity: string[];
  recommendation: string;
}

function pct(total: number, max: number): number | null {
  if (!max) return null;
  return Math.round((total / max) * 100);
}

export function computeGlobalHiringStats(
  jobs: GlobalJobLite[],
  candidates: GlobalCandidateLite[]
): GlobalHiringStats {
  const jobById = new Map(jobs.map((j) => [String(j._id), j]));

  const activeJobs = jobs.filter((j) => j.status === "active").length;
  const openPositions = jobs
    .filter((j) => j.status === "active")
    .reduce((s, j) => s + (j.openings || 1), 0);

  const interviewReady = candidates.filter(
    (c) =>
      c.stage === "interview" ||
      c.stage === "offer" ||
      c.stage === "hired" ||
      (c.hiringDecision === "strong_yes" && c.assessmentStatus === "completed")
  ).length;

  const offersSent = candidates.filter((c) => c.stage === "offer" || c.stage === "hired").length;

  const scored = candidates.filter((c) => c.maxScore > 0);
  const avgFitScorePct = scored.length
    ? Math.round(
        scored.reduce((s, c) => s + (pct(c.totalScore, c.maxScore) || 0), 0) / scored.length
      )
    : null;

  // ── Per-job pipeline stats ────────────────────────────────────────────────
  const byJob = new Map<string, GlobalCandidateLite[]>();
  for (const c of candidates) {
    const key = String(c.jobId);
    (byJob.get(key) ?? byJob.set(key, []).get(key)!).push(c);
  }

  const pipelines: JobPipelineStat[] = jobs.map((j) => {
    const list = byJob.get(String(j._id)) ?? [];
    const s = list.filter((c) => c.maxScore > 0);
    const avg = s.length
      ? Math.round(s.reduce((sum, c) => sum + (pct(c.totalScore, c.maxScore) || 0), 0) / s.length)
      : null;
    return {
      jobId: String(j._id),
      title: j.title,
      department: j.department,
      candidateCount: list.length,
      avgScorePct: avg,
    };
  });

  const rankable = pipelines.filter((p) => p.avgScorePct !== null && p.candidateCount > 0);
  const topPipeline = rankable.length
    ? [...rankable].sort((a, b) => (b.avgScorePct ?? 0) - (a.avgScorePct ?? 0))[0]
    : null;
  const weakestPipeline = rankable.length
    ? [...rankable].sort((a, b) => (a.avgScorePct ?? 0) - (b.avgScorePct ?? 0))[0]
    : null;

  // ── Highest rated candidate ────────────────────────────────────────────────
  let highestRatedCandidate: GlobalHiringStats["highestRatedCandidate"] = null;
  for (const c of scored) {
    const p = pct(c.totalScore, c.maxScore) ?? 0;
    if (!highestRatedCandidate || p > highestRatedCandidate.scorePct) {
      const job = jobById.get(String(c.jobId));
      highestRatedCandidate = {
        id: String(c._id),
        name: c.name,
        jobTitle: job?.title ?? "—",
        scorePct: p,
      };
    }
  }

  // ── Most commonly missing / weak skills (low-scoring rubric criteria) ──────
  const weakCriteriaCount = new Map<string, number>();
  for (const c of candidates) {
    for (const b of c.scoreBreakdown || []) {
      if (!b.maxScore) continue;
      if (b.score / b.maxScore < 0.5) {
        weakCriteriaCount.set(b.criterion, (weakCriteriaCount.get(b.criterion) ?? 0) + 1);
      }
    }
  }
  const mostCommonMissingSkills = [...weakCriteriaCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  // ── Recent activity ─────────────────────────────────────────────────────────
  const recent = [...candidates]
    .sort((a, b) => {
      const at = (a.stageMovedAt || a.createdAt)?.getTime?.() ?? 0;
      const bt = (b.stageMovedAt || b.createdAt)?.getTime?.() ?? 0;
      return bt - at;
    })
    .slice(0, 5);
  const recentActivity = recent.map((c) => {
    const job = jobById.get(String(c.jobId));
    return `${c.name} — ${c.stage} (${job?.title ?? "Unknown role"})`;
  });

  // ── Heuristic recommendation ────────────────────────────────────────────────
  const readyForInterview = [...candidates]
    .filter((c) => c.maxScore > 0 && !["interview", "offer", "hired", "rejected"].includes(c.stage))
    .sort((a, b) => (pct(b.totalScore, b.maxScore) || 0) - (pct(a.totalScore, a.maxScore) || 0))
    .slice(0, 2);

  const recommendation = readyForInterview.length
    ? `Schedule interviews for ${readyForInterview.map((c) => c.name.split(" ")[0]).join(" and ")} today.`
    : weakestPipeline
    ? `Focus on ${weakestPipeline.title} — it has the weakest applicant pool right now.`
    : "No urgent hiring actions — pipelines look steady.";

  return {
    activeJobs,
    openPositions,
    totalCandidates: candidates.length,
    interviewReady,
    offersSent,
    avgFitScorePct,
    topPipeline,
    weakestPipeline,
    highestRatedCandidate,
    mostCommonMissingSkills,
    recentActivity,
    recommendation,
  };
}

export function globalStatsToPromptText(stats: GlobalHiringStats, pipelines: JobPipelineStat[]): string {
  const pipelineLines = pipelines
    .map(
      (p) =>
        `  • ${p.title}${p.department ? ` (${p.department})` : ""} — ${p.candidateCount} candidates, avg fit ${
          p.avgScorePct !== null ? `${p.avgScorePct}%` : "not scored"
        }`
    )
    .join("\n");

  return `Active jobs: ${stats.activeJobs} | Open positions: ${stats.openPositions}
Total candidates (org-wide): ${stats.totalCandidates}
Interview-ready: ${stats.interviewReady} | Offers sent/hired: ${stats.offersSent}
Average fit score (org-wide): ${stats.avgFitScorePct !== null ? `${stats.avgFitScorePct}%` : "N/A"}
Strongest pipeline: ${stats.topPipeline ? `${stats.topPipeline.title} (${stats.topPipeline.avgScorePct}% avg)` : "N/A"}
Weakest pipeline: ${stats.weakestPipeline ? `${stats.weakestPipeline.title} (${stats.weakestPipeline.avgScorePct}% avg)` : "N/A"}
Highest rated candidate: ${
    stats.highestRatedCandidate
      ? `${stats.highestRatedCandidate.name} — ${stats.highestRatedCandidate.scorePct}% (${stats.highestRatedCandidate.jobTitle})`
      : "N/A"
  }
Most commonly weak/missing rubric skills: ${stats.mostCommonMissingSkills.join(", ") || "None detected"}
Recent activity:
${stats.recentActivity.map((a) => `  • ${a}`).join("\n") || "  (none yet)"}

## Per-Job Pipelines
${pipelineLines || "  (no jobs yet)"}`;
}
