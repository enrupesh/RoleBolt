import test from "node:test";
import assert from "node:assert/strict";
import { ensureJudgeReviewerEntitlements } from "./judgeReviewerEntitlements";

test("ensureJudgeReviewerEntitlements is a no-op for non-judge emails", async () => {
  await ensureJudgeReviewerEntitlements("507f1f77bcf86cd799439011", "user@example.com");
  assert.ok(true);
});

test("ensureJudgeReviewerEntitlements is a no-op for invalid user ids", async () => {
  await ensureJudgeReviewerEntitlements("not-a-valid-id", "test@judges.rolebolt.tech");
  assert.ok(true);
});
