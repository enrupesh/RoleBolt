const JUDGE_REVIEWER_EMAIL = "test@judges.rolebolt.tech";

export function isJudgeReviewerEmail(email?: unknown): boolean {
  return String(email ?? "").trim().toLowerCase() === JUDGE_REVIEWER_EMAIL;
}