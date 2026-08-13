import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessSeekerRole,
  canonicalRoleForAccount,
  isJudgeReviewerEmail,
} from "./judgeReviewer";

test("only the exact judge email receives reviewer access", () => {
  assert.equal(isJudgeReviewerEmail("test@judges.rolebolt.tech"), true);
  assert.equal(isJudgeReviewerEmail(" TEST@JUDGES.ROLEBOLT.TECH "), true);
  assert.equal(isJudgeReviewerEmail("test@judges.rolebolt.tech.attacker.example"), false);
  assert.equal(isJudgeReviewerEmail("judge@rolebolt.tech"), false);
  assert.equal(isJudgeReviewerEmail(undefined), false);
});

test("normal seeker access still follows the stored seeker role", () => {
  assert.equal(canAccessSeekerRole("seeker@example.com", "seeker"), true);
  assert.equal(canAccessSeekerRole("creator@example.com", "creator"), false);
  assert.equal(canAccessSeekerRole("creator@example.com", undefined), false);
});

test("the judge remains a creator while receiving seeker access", () => {
  assert.equal(canAccessSeekerRole("test@judges.rolebolt.tech", "creator"), true);
  assert.equal(canonicalRoleForAccount("test@judges.rolebolt.tech", "seeker"), "creator");
  assert.equal(canonicalRoleForAccount("creator@example.com", "seeker"), "seeker");
});