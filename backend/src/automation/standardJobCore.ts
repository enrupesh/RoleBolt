/**
 * Pure Standard Job automation helpers — safe to unit-test without DB/AI.
 */

export type AgentAction = "shortlisted" | "rejected" | "review_zone";

export type PipelineCondition =
  | "score_above"
  | "score_below"
  | "assessment_passed"
  | "assessment_failed"
  | "stage_age_days";

export type PipelineAction =
  | "move_to_screened"
  | "move_to_assessed"
  | "move_to_interview"
  | "move_to_offer"
  | "move_to_rejected"
  | "send_assessment"
  | "send_reminder";

export interface PipelineRuleLike {
  id: string;
  condition: PipelineCondition | string;
  threshold: number;
  fromStage?: string;
  action: PipelineAction | string;
  enabled?: boolean;
}

export interface CandidateAutomationSnapshot {
  stage: string;
  scoringFailed?: boolean;
  assessmentStatus?: string;
  hiringDecision?: string | null;
  assessmentToken?: string;
  pipelineRuleState?: Record<string, string>;
  stageMovedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export const PIPELINE_CONDITIONS = new Set([
  "score_above", "score_below", "assessment_passed", "assessment_failed", "stage_age_days",
]);
export const PIPELINE_ACTIONS = new Set([
  "move_to_screened", "move_to_assessed", "move_to_interview", "move_to_offer",
  "move_to_rejected", "send_assessment", "send_reminder",
]);
export const PIPELINE_CONDITIONS_NEED_THRESHOLD = new Set([
  "score_above", "score_below", "stage_age_days",
]);

export function validatePipelineRuleInput(body: {
  condition?: string;
  threshold?: number;
  action?: string;
}): string | null {
  if (!body.condition || !PIPELINE_CONDITIONS.has(body.condition)) {
    return "Invalid or missing condition.";
  }
  if (!body.action || !PIPELINE_ACTIONS.has(body.action)) {
    return "Invalid or missing action.";
  }
  if (PIPELINE_CONDITIONS_NEED_THRESHOLD.has(body.condition)) {
    const t = Number(body.threshold);
    if (!Number.isFinite(t)) return "threshold is required for this condition.";
  }
  return null;
}

export function isPipelineRuleEnabled(rule: { enabled?: boolean }): boolean {
  return rule.enabled !== false;
}

export function normalizeAgentThresholds(agentMode: Record<string, unknown>) {
  let shortlistThreshold = Number(agentMode.shortlistThreshold ?? 75);
  let rejectThreshold = Number(agentMode.rejectThreshold ?? 40);
  shortlistThreshold = Math.min(100, Math.max(0, shortlistThreshold));
  rejectThreshold = Math.min(100, Math.max(0, rejectThreshold));
  if (rejectThreshold >= shortlistThreshold) {
    rejectThreshold = Math.max(0, shortlistThreshold - 5);
  }
  return { shortlistThreshold, rejectThreshold };
}

/**
 * Initial triage on intake. Review-zone candidates use stage `review_zone`
 * (distinct from Applied) when the agent is enabled.
 */
export function computeAgentTriage(
  agentMode: Record<string, unknown>,
  scorePct: number,
  scoringFailed: boolean,
) {
  const { shortlistThreshold, rejectThreshold } = normalizeAgentThresholds(agentMode);
  const agentEnabled = agentMode.enabled === true && !scoringFailed;
  let initialStage = "applied";
  let agentAction: AgentAction | null = null;

  if (agentEnabled) {
    if (scorePct >= shortlistThreshold) {
      initialStage = "screened";
      agentAction = "shortlisted";
    } else if (scorePct < rejectThreshold) {
      initialStage = "rejected";
      agentAction = "rejected";
    } else {
      initialStage = "review_zone";
      agentAction = "review_zone";
    }
  }

  return { initialStage, agentAction, shortlistThreshold, rejectThreshold, agentEnabled };
}

export function agentReason(
  agentAction: AgentAction,
  scorePct: number,
  shortlistThreshold: number,
  rejectThreshold: number,
): string {
  if (agentAction === "shortlisted") {
    return `Score ${scorePct}% ≥ shortlist threshold ${shortlistThreshold}%`;
  }
  if (agentAction === "rejected") {
    return `Score ${scorePct}% < reject threshold ${rejectThreshold}%`;
  }
  return `Score ${scorePct}% is in review zone (${rejectThreshold}%–${shortlistThreshold}%)`;
}

export function candidateDayInStage(candidate: CandidateAutomationSnapshot, nowMs = Date.now()): number {
  const movedAt = candidate.stageMovedAt ?? candidate.createdAt;
  if (!movedAt) return 0;
  return (nowMs - new Date(movedAt).getTime()) / (1000 * 60 * 60 * 24);
}

export function pipelineRuleMarker(
  rule: PipelineRuleLike,
  candidate: CandidateAutomationSnapshot,
  scorePct: number,
): string {
  if (rule.condition === "score_above" || rule.condition === "score_below") {
    return `score:${scorePct}`;
  }
  if (rule.condition === "assessment_passed" || rule.condition === "assessment_failed") {
    return `assessment:${candidate.hiringDecision ?? "none"}`;
  }
  return "fired";
}

export function shouldSkipPipelineRule(
  rule: PipelineRuleLike,
  candidate: CandidateAutomationSnapshot,
  scorePct: number,
): boolean {
  const state = (candidate.pipelineRuleState ?? {}) as Record<string, string>;
  const prev = state[rule.id];

  if (rule.action === "send_assessment" && candidate.assessmentStatus !== "not_sent") return true;
  if (rule.action === "send_reminder" && !["sent", "invited"].includes(candidate.assessmentStatus ?? "")) return true;

  if (prev === undefined) return false;
  return prev === pipelineRuleMarker(rule, candidate, scorePct);
}

export function isPipelineConditionMet(
  rule: PipelineRuleLike,
  candidate: CandidateAutomationSnapshot,
  scorePct: number,
  dayInStage: number,
): boolean {
  // Never treat AI scoring failures as genuine low/high scores.
  if (
    (rule.condition === "score_above" || rule.condition === "score_below") &&
    candidate.scoringFailed === true
  ) {
    return false;
  }

  if (rule.condition === "score_above" && scorePct >= rule.threshold) return true;
  if (rule.condition === "score_below" && scorePct < rule.threshold) return true;
  if (
    rule.condition === "assessment_passed" &&
    candidate.assessmentStatus === "completed" &&
    candidate.hiringDecision === "strong_yes"
  ) return true;
  if (
    rule.condition === "assessment_failed" &&
    candidate.assessmentStatus === "completed" &&
    candidate.hiringDecision === "no"
  ) return true;
  if (rule.condition === "stage_age_days" && dayInStage >= rule.threshold) return true;
  return false;
}

/**
 * Pure first-match pipeline rule selection (mirrors evaluatePipelineRules order).
 * Does not execute side effects — callers persist DB updates.
 */
/** Pre–review_zone stage: agent triage logged review_zone but stage stayed `applied`. */
export function shouldMigrateLegacyReviewZoneStage(candidate: {
  stage?: string;
  agentLog?: Array<{ action?: string; timestamp?: Date | string }>;
}): boolean {
  if (candidate.stage !== "applied") return false;
  const log = candidate.agentLog ?? [];
  if (!log.length) return false;
  const latest = log.reduce((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb >= ta ? b : a;
  });
  return latest.action === "review_zone";
}

export function selectMatchingPipelineRule(
  rules: PipelineRuleLike[],
  candidate: CandidateAutomationSnapshot,
  scorePct: number,
  nowMs = Date.now(),
): PipelineRuleLike | null {
  const enabled = rules.filter(r => isPipelineRuleEnabled(r));
  const dayInStage = candidateDayInStage(candidate, nowMs);

  for (const rule of enabled) {
    if (rule.fromStage && candidate.stage !== rule.fromStage) continue;
    if (shouldSkipPipelineRule(rule, candidate, scorePct)) continue;
    if (!isPipelineConditionMet(rule, candidate, scorePct, dayInStage)) continue;
    return rule;
  }
  return null;
}
