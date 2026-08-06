const JUDGE_REVIEWER_EMAIL = "test@judges.rolebolt.tech";

/**
 * The judge account is the only account allowed to review both workspaces.
 * Keep this check exact and normalized so no other account inherits access.
 */
export function isJudgeReviewerEmail(email: unknown): boolean {
  return String(email ?? "").trim().toLowerCase() === JUDGE_REVIEWER_EMAIL;
}