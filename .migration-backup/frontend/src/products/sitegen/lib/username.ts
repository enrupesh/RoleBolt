import {
  SITEGEN_RESERVED_USERNAMES,
  SITEGEN_USERNAME_MAX,
  SITEGEN_USERNAME_MIN,
  SITEGEN_USERNAME_PATTERN,
} from "../config/reserved-usernames";

export function normalizeSitegenUsernameInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function validateSitegenUsername(username: string): string | null {
  const normalized = normalizeSitegenUsernameInput(username);
  if (!normalized) return "Username is required.";
  if (normalized.length < SITEGEN_USERNAME_MIN) {
    return `Username must be at least ${SITEGEN_USERNAME_MIN} characters.`;
  }
  if (normalized.length > SITEGEN_USERNAME_MAX) {
    return `Username must be at most ${SITEGEN_USERNAME_MAX} characters.`;
  }
  if (!SITEGEN_USERNAME_PATTERN.test(normalized)) {
    return "Username must start with a letter and contain only letters, numbers, and underscores.";
  }
  if (SITEGEN_RESERVED_USERNAMES.has(normalized)) {
    return "This username is reserved. Please choose another.";
  }
  return null;
}

export function validateSitegenPassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}
