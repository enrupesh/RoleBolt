const PENDING_KEY = "rb_judge_welcome_pending";
export const JUDGE_WELCOME_OPEN_EVENT = "rb-open-judge-welcome";

/** Call after a successful judge-account login so the welcome modal can appear once. */
export function markJudgeWelcomePending(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, String(Date.now()));
  } catch {
    // Non-critical — judges can still use the product without the modal.
  }
}

/** Returns true the first time after login when the welcome should be shown. */
export function consumeJudgeWelcomePending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Re-open the judge welcome modal from the dashboard or anywhere in the app. */
export function openJudgeWelcomeModal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(JUDGE_WELCOME_OPEN_EVENT));
}
