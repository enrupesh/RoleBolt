import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  simulateCandidateScore,
  zoneFor,
  currentPct,
  type SimCandidate,
  type RubricCriteria,
} from "./whatIfSimulation";

const rubric: RubricCriteria[] = [
  { name: "React", weight: 40, description: "" },
  { name: "Communication", weight: 20, description: "" },
];

const candidate: SimCandidate = {
  _id: "1",
  name: "Ada",
  stage: "applied",
  totalScore: 45,
  maxScore: 60,
  scoringFailed: false,
  scoreBreakdown: [
    { criterion: "React", score: 30, maxScore: 40 },
    { criterion: "Communication", score: 15, maxScore: 20 },
  ],
};

describe("simulateCandidateScore", () => {
  it("reweights criterion ratios onto new weights", () => {
    const heavierReact: RubricCriteria[] = [
      { name: "React", weight: 50, description: "" },
      { name: "Communication", weight: 10, description: "" },
    ];
    // React 75% of 50 = 37.5; Comm 75% of 10 = 7.5 → 45/60 = 75%
    const sim = simulateCandidateScore(candidate, heavierReact);
    assert.ok(sim);
    assert.equal(sim!.pct, 75);
  });

  it("returns null when scoringFailed", () => {
    assert.equal(
      simulateCandidateScore({ ...candidate, scoringFailed: true }, rubric),
      null,
    );
  });

  it("matches fuzzy criterion names", () => {
    const c = {
      ...candidate,
      scoreBreakdown: [
        { criterion: "React.js", score: 40, maxScore: 40 },
        { criterion: "Communication Skills", score: 20, maxScore: 20 },
      ],
    };
    const sim = simulateCandidateScore(c, rubric);
    assert.ok(sim);
    assert.equal(sim!.pct, 100);
  });
});

describe("zoneFor / currentPct", () => {
  it("classifies zones", () => {
    assert.equal(zoneFor(80, 75, 40), "shortlist");
    assert.equal(zoneFor(50, 75, 40), "review");
    assert.equal(zoneFor(20, 75, 40), "reject");
    assert.equal(zoneFor(null, 75, 40), "unscored");
  });

  it("computes current pct", () => {
    assert.equal(currentPct(candidate), 75);
  });
});
