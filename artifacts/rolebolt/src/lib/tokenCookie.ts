/**
 * Mirrors the JWT in a first-party cookie so sessions survive
 * localStorage eviction, private-mode storage limits, and cold
 * Render backend restarts that would otherwise wipe the token.
 *
 * The cookie is:  SameSite=Lax; path=/; max-age=30 days
 * No HttpOnly — we intentionally need JS access on the same origin.
 */

const COOKIE_NAME = "rb_auth_token";
const MAX_AGE_SECS = 60 * 60 * 24 * 30; // 30 days — matches JWT expiry

export function setTokenCookie(token: string): void {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `max-age=${MAX_AGE_SECS}`,
    "path=/",
    "SameSite=Lax",
  ].join("; ");
}

export function getTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.split("=").slice(1).join("="));
  } catch {
    return null;
  }
}

export function clearTokenCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`;
}
