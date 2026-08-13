import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeAgentTriage,
  normalizeAgentThresholds,
  selectMatchingPipelineRule,
  isPipelineConditionMet,
  shouldSkipPipelineRule,
  shouldMigrateLegacyReviewZoneStage,
  validatePipelineRuleInput,
  type PipelineRuleLike,
  type CandidateAutomationSnapshot,
} from "./standardJobCore";

describe("normalizeAgentThresholds", () => {
  it("clamps and separates reject below shortlist", () => {
    const t = normalizeAgentThresholds({ shortlistThreshold: 70, rejectThreshold: 80 });
    assert.equal(t.shortlistThreshold, 70);
    assert.equal(t.rejectThreshold, 65);
  });

  it("uses defaults", () => {
    const t = normalizeAgentThresholds({});
    assert.equal(t.shortlistThreshold, 75);
    assert.equal(t.rejectThreshold, 40);
  });
});

describe("computeAgentTriage", () => {
  const mode = { enabled: true, shortlistThreshold: 75, rejectThreshold: 40 };

  it("shortlists high scores", () => {
    const r = computeAgentTriage(mode, 82, false);
    assert.equal(r.agentAction, "shortlisted");
    assert.equal(r.initialStage, "screened");
    assert.equal(r.agentEnabled, true);
  });

  it("rejects low scores", () => {
    const r = computeAgentTriage(mode, 20, false);
    assert.equal(r.agentAction, "rejected");
    assert.equal(r.initialStage, "rejected");
  });

  it("puts mid scores in review_zone stage", () => {
    const r = computeAgentTriage(mode, 55, false);
    assert.equal(r.agentAction, "review_zone");
    assert.equal(r.initialStage, "review_zone");
  });

  it("skips triage when scoringFailed", () => {
    const r = computeAgentTriage(mode, 10, true);
    assert.equal(r.agentAction, null);
    assert.equal(r.initialStage, "applied");
    assert.equal(r.agentEnabled, false);
  });

  it("skips triage when agent disabled", () => {
    const r = computeAgentTriage({ ...mode, enabled: false }, 90, false);
    assert.equal(r.agentAction, null);
    assert.equal(r.initialStage, "applied");
  });
});

describe("evaluatePipelineRules (pure selection)", () => {
  const baseCandidate: CandidateAutomationSnapshot = {
    stage: "applied",
    scoringFailed: false,
    assessmentStatus: "not_sent",
    pipelineRuleState: {},
  };

  it("matches score_above and returns first rule", () => {
    const rules: PipelineRuleLike[] = [
      { id: "a", condition: "score_above", threshold: 80, action: "move_to_interview", enabled: true },
      { id: "b", condition: "score_above", threshold: 50, action: "move_to_screened", enabled: true },
    ];
    const match = selectMatchingPipelineRule(rules, baseCandidate, 85);
    assert.equal(match?.id, "a");
  });

  it("does not match score_below when scoringFailed", () => {
    const rules: PipelineRuleLike[] = [
      { id: "r", condition: "score_below", threshold: 40, action: "move_to_rejected", enabled: true },
    ];
    const match = selectMatchingPipelineRule(
      rules,
      { ...baseCandidate, scoringFailed: true },
      0,
    );
    assert.equal(match, null);
    assert.equal(
      isPipelineConditionMet(rules[0], { ...baseCandidate, scoringFailed: true }, 0, 0),
      false,
    );
  });

  it("respects fromStage filter", () => {
    const rules: PipelineRuleLike[] = [
      {
        id: "r",
        condition: "score_above",
        threshold: 70,
        fromStage: "screened",
        action: "send_assessment",
        enabled: true,
      },
    ];
    assert.equal(selectMatchingPipelineRule(rules, baseCandidate, 90), null);
    assert.ok(
      selectMatchingPipelineRule(rules, { ...baseCandidate, stage: "screened" }, 90),
    );
  });

  it("skips send_assessment when already sent", () => {
    const rule: PipelineRuleLike = {
      id: "r",
      condition: "score_above",
      threshold: 70,
      action: "send_assessment",
      enabled: true,
    };
    assert.equal(
      shouldSkipPipelineRule(rule, { ...baseCandidate, assessmentStatus: "sent" }, 80),
      true,
    );
  });

  it("skips disabled rules", () => {
    const rules: PipelineRuleLike[] = [
      { id: "r", condition: "score_above", threshold: 50, action: "move_to_screened", enabled: false },
    ];
    assert.equal(selectMatchingPipelineRule(rules, baseCandidate, 90), null);
  });

  it("matches stage_age_days", () => {
    const rule: PipelineRuleLike = {
      id: "r",
      condition: "stage_age_days",
      threshold: 3,
      action: "send_reminder",
      enabled: true,
    };
    const threeDaysAgo = new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(
      isPipelineConditionMet(rule, { ...baseCandidate, stageMovedAt: threeDaysAgo }, 0, 3.5),
      true,
    );
    assert.equal(
      isPipelineConditionMet(rule, { ...baseCandidate, stageMovedAt: new Date().toISOString() }, 0, 0.5),
      false,
    );
  });

  it("matches assessment_passed only for strong_yes", () => {
    const rule: PipelineRuleLike = {
      id: "r",
      condition: "assessment_passed",
      threshold: 0,
      action: "move_to_interview",
      enabled: true,
    };
    assert.equal(
      isPipelineConditionMet(
        rule,
        { ...baseCandidate, assessmentStatus: "completed", hiringDecision: "maybe" },
        0,
        0,
      ),
      false,
    );
    assert.equal(
      isPipelineConditionMet(
        rule,
        { ...baseCandidate, assessmentStatus: "completed", hiringDecision: "strong_yes" },
        0,
        0,
      ),
      true,
    );
  });
});

describe("shouldMigrateLegacyReviewZoneStage", () => {
  it("detects applied + latest agent review_zone", () => {
    assert.equal(
      shouldMigrateLegacyReviewZoneStage({
        stage: "applied",
        agentLog: [
          { action: "review_zone", timestamp: "2026-01-01T00:00:00.000Z" },
        ],
      }),
      true,
    );
  });
  it("ignores when stage already review_zone", () => {
    assert.equal(
      shouldMigrateLegacyReviewZoneStage({
        stage: "review_zone",
        agentLog: [{ action: "review_zone" }],
      }),
      false,
    );
  });
});

describe("validatePipelineRuleInput", () => {
  it("rejects invalid condition", () => {
    assert.ok(validatePipelineRuleInput({ condition: "nope", threshold: 1, action: "move_to_screened" }));
  });
  it("accepts valid score rule", () => {
    assert.equal(
      validatePipelineRuleInput({ condition: "score_above", threshold: 80, action: "move_to_interview" }),
      null,
    );
  });
});
