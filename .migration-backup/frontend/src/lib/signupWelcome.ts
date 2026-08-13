export type SignupWelcomeRole = "creator" | "seeker";

const STORAGE_KEY = "rb_signup_welcome";

export function markSignupWelcome(role: SignupWelcomeRole) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ role, createdAt: Date.now() }),
    );
  } catch {
    // The welcome is a non-critical enhancement; auth flow must continue.
  }
}

export function consumeSignupWelcome(expectedRole?: SignupWelcomeRole): SignupWelcomeRole | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { role?: SignupWelcomeRole; createdAt?: number };
    if (
      (data.role !== "creator" && data.role !== "seeker") ||
      (expectedRole && data.role !== expectedRole) ||
      typeof data.createdAt !== "number" ||
      Date.now() - data.createdAt > 1000 * 60 * 60 * 24 * 14
    ) {
      return null;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    return data.role;
  } catch {
    return null;
  }
}