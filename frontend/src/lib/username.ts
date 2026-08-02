/** Shared username validation — keep in sync with backend auth.ts */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export const USERNAME_EXPLANATION =
  "Your username is required because it will be used to create your personal Rolebolt profile URL. Recruiters can use it for their company profile, and Job Seekers can use it for their public resume/profile page.";

const USERNAME_PATTERN = /^[a-z][a-z0-9_]*$/;

const RESERVED = new Set([
  "admin", "administrator", "api", "auth", "help", "login", "logout", "me",
  "profile", "recruit", "recruiter", "rolebolt", "root", "seeker", "signup",
  "support", "system", "www", "null", "undefined",
]);

export function normalizeUsernameInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function validateUsername(username: string): string | null {
  const u = normalizeUsernameInput(username);
  if (!u) return "Username is required.";
  if (u.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (u.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters.`;
  if (!USERNAME_PATTERN.test(u)) {
    return "Username must start with a letter and contain only letters, numbers, and underscores.";
  }
  if (RESERVED.has(u)) return "This username is reserved. Please choose another.";
  return null;
}

/** Display name for greetings — prefers username, falls back gracefully */
export function displayHandle(user?: { username?: string; name?: string; email?: string } | null): string {
  if (user?.username?.trim()) return user.username.trim();
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0]!;
  if (user?.email?.trim()) return user.email.split("@")[0]!;
  return "there";
}
