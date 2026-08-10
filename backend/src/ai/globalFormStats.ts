/**
 * globalFormStats — deterministic org-wide metrics for Form Job workspace.
 */

export interface FormPipelineStat {
  formId: string;
  title: string;
  responseCount: number;
  avgScorePct: number | null;
  shortlisted: number;
}

export interface GlobalFormStats {
  activeForms: number;
  totalApplicants: number;
  avgAiScorePct: number | null;
  shortlisted: number;
  interviewStage: number;
  hired: number;
  assessmentCompleted: number;
  topForm: FormPipelineStat | null;
  weakestForm: FormPipelineStat | null;
  highestRatedApplicant: { id: string; name: string; formTitle: string; scorePct: number } | null;
  recentActivity: string[];
}

export function computeGlobalFormStats(
  forms: Array<{ _id: any; title: string; status?: string; responseCount?: number }>,
  responses: Array<{
    _id: any;
    formId: any;
    submittedName?: string;
    aiScore?: number;
    scoringFailed?: boolean;
    stage?: string;
    assessmentStatus?: string;
    createdAt?: Date;
  }>,
): { stats: GlobalFormStats; pipelines: FormPipelineStat[] } {
  const formById = new Map(forms.map(f => [String(f._id), f]));
  const activeForms = forms.filter(f => f.status !== "closed").length;

  const scored = responses.filter(r => !r.scoringFailed && (r.aiScore ?? 0) > 0);
  const avgAiScorePct = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.aiScore ?? 0), 0) / scored.length)
    : null;

  const shortlisted = responses.filter(r => r.stage === "shortlisted").length;
  const interviewStage = responses.filter(r => ["interview", "offer"].includes(r.stage || "")).length;
  const hired = responses.filter(r => r.stage === "hired").length;
  const assessmentCompleted = responses.filter(r => r.assessmentStatus === "completed").length;

  const byForm = new Map<string, typeof responses>();
  for (const r of responses) {
    const key = String(r.formId);
    (byForm.get(key) ?? byForm.set(key, []).get(key)!).push(r);
  }

  const pipelines: FormPipelineStat[] = forms.map(f => {
    const list = byForm.get(String(f._id)) ?? [];
    const s = list.filter(r => !r.scoringFailed && (r.aiScore ?? 0) > 0);
    const avg = s.length ? Math.round(s.reduce((sum, r) => sum + (r.aiScore ?? 0), 0) / s.length) : null;
    return {
      formId: String(f._id),
      title: f.title,
      responseCount: list.length,
      avgScorePct: avg,
      shortlisted: list.filter(r => r.stage === "shortlisted").length,
    };
  });

  const rankable = pipelines.filter(p => p.avgScorePct !== null && p.responseCount > 0);
  const topForm = rankable.length
    ? [...rankable].sort((a, b) => (b.avgScorePct ?? 0) - (a.avgScorePct ?? 0))[0]
    : null;
  const weakestForm = rankable.length > 1
    ? [...rankable].sort((a, b) => (a.avgScorePct ?? 0) - (b.avgScorePct ?? 0))[0]
    : null;

  let highestRatedApplicant: GlobalFormStats["highestRatedApplicant"] = null;
  const topResponse = [...scored].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))[0];
  if (topResponse) {
    const form = formById.get(String(topResponse.formId));
    highestRatedApplicant = {
      id: String(topResponse._id),
      name: topResponse.submittedName || "Applicant",
      formTitle: form?.title || "Unknown form",
      scorePct: topResponse.aiScore ?? 0,
    };
  }

  const recentActivity: string[] = [];
  const recent = [...responses]
    .filter(r => r.createdAt)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 5);
  for (const r of recent) {
    const form = formById.get(String(r.formId));
    recentActivity.push(
      `${r.submittedName || "Applicant"} applied to ${form?.title || "a form"} (${r.aiScore ?? 0}% score)`,
    );
  }

  return {
    stats: {
      activeForms,
      totalApplicants: responses.length,
      avgAiScorePct,
      shortlisted,
      interviewStage,
      hired,
      assessmentCompleted,
      topForm,
      weakestForm,
      highestRatedApplicant,
      recentActivity,
    },
    pipelines,
  };
}

export function globalFormStatsToPromptText(stats: GlobalFormStats, pipelines: FormPipelineStat[]): string {
  const lines = [
    `Active forms: ${stats.activeForms}`,
    `Total applicants: ${stats.totalApplicants}`,
    `Average AI score: ${stats.avgAiScorePct !== null ? `${stats.avgAiScorePct}%` : "N/A"}`,
    `Shortlisted: ${stats.shortlisted}`,
    `In interview/offer: ${stats.interviewStage}`,
    `Hired: ${stats.hired}`,
    `Assessments completed: ${stats.assessmentCompleted}`,
  ];
  if (stats.topForm) {
    lines.push(`Strongest form pipeline: ${stats.topForm.title} (avg ${stats.topForm.avgScorePct}%, ${stats.topForm.responseCount} applicants)`);
  }
  if (stats.weakestForm && stats.weakestForm.formId !== stats.topForm?.formId) {
    lines.push(`Weakest form pipeline: ${stats.weakestForm.title} (avg ${stats.weakestForm.avgScorePct}%, ${stats.weakestForm.responseCount} applicants)`);
  }
  if (stats.highestRatedApplicant) {
    lines.push(
      `Top applicant: ${stats.highestRatedApplicant.name} — ${stats.highestRatedApplicant.scorePct}% on ${stats.highestRatedApplicant.formTitle}`,
    );
  }
  if (pipelines.length) {
    lines.push("\nPer-form breakdown:");
    for (const p of pipelines.slice(0, 20)) {
      lines.push(`  • ${p.title}: ${p.responseCount} applicants, avg ${p.avgScorePct ?? "N/A"}%, ${p.shortlisted} shortlisted`);
    }
  }
  if (stats.recentActivity.length) {
    lines.push("\nRecent activity:");
    for (const a of stats.recentActivity) lines.push(`  • ${a}`);
  }
  return lines.join("\n");
}
