/**
 * Pure What-If Criteria Simulator helpers (frontend + tests).
 */

export type RubricCriteria = { name: string; weight: number; description: string };

export type SimCandidate = {
  _id: string;
  name: string;
  stage: string;
  totalScore: number;
  maxScore: number;
  scoringFailed?: boolean;
  scoreBreakdown: Array<{ criterion: string; score: number; maxScore: number }>;
};

export type Zone = "shortlist" | "review" | "reject" | "unscored";

export function normalizeCriterionName(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ");
}

export function findBreakdown(
  breakdown: SimCandidate["scoreBreakdown"],
  criterionName: string,
) {
  const target = normalizeCriterionName(criterionName);
  const exact = breakdown.find(b => normalizeCriterionName(b.criterion) === target);
  if (exact) return exact;
  return breakdown.find(b => {
    const n = normalizeCriterionName(b.criterion);
    return n.includes(target) || target.includes(n);
  });
}

/** Re-weight existing criterion scores onto a new rubric (no AI call). */
export function simulateCandidateScore(
  c: SimCandidate,
  newRubric: RubricCriteria[],
): { pct: number; total: number; max: number } | null {
  if (c.scoringFailed || !c.scoreBreakdown?.length || !(c.maxScore > 0)) return null;
  let total = 0;
  let max = 0;
  for (const r of newRubric) {
    const b = findBreakdown(c.scoreBreakdown, r.name);
    max += r.weight;
    if (b && b.maxScore > 0) {
      total += (b.score / b.maxScore) * r.weight;
    }
  }
  if (max <= 0) return null;
  return { pct: Math.round((total / max) * 100), total, max };
}

export function zoneFor(pct: number | null, shortlist: number, reject: number): Zone {
  if (pct === null) return "unscored";
  if (pct >= shortlist) return "shortlist";
  if (pct < reject) return "reject";
  return "review";
}

export function currentPct(c: SimCandidate): number | null {
  if (c.scoringFailed || !(c.maxScore > 0)) return null;
  return Math.round((c.totalScore / c.maxScore) * 100);
}
