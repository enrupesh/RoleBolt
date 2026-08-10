const JUDGE_REVIEWER_EMAIL = "test@judges.rolebolt.tech";

/**
 * The judge account is the only account allowed to review both workspaces.
 * Keep this check exact and normalized so no other account inherits access.
 */
export function isJudgeReviewerEmail(email: unknown): boolean {
  return String(email ?? "").trim().toLowerCase() === JUDGE_REVIEWER_EMAIL;
}

/**
 * Seeker access is normally determined by the account's stored role. The
 * reviewer account is the one deliberate exception, and must not require
 * changing that account's canonical creator role.
 */
export function canAccessSeekerRole(email: unknown, profileRole: unknown): boolean {
  return profileRole === "seeker" || isJudgeReviewerEmail(email);
}

export function canonicalRoleForAccount(
  email: unknown,
  storedRole: unknown,
): "creator" | "seeker" | undefined {
  if (isJudgeReviewerEmail(email)) return "creator";
  return storedRole === "creator" || storedRole === "seeker" ? storedRole : undefined;
}