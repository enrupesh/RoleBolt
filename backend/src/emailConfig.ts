/**
 * Centralized sender identities for all outbound Rolebolt email.
 *
 * Authentication/security mail must never share the operational notification
 * identity. The legacy SMTP_FROM_EMAIL variable remains a compatibility
 * fallback for auth deployments that have not yet added AUTH_FROM_EMAIL.
 */
const NAME = process.env.FROM_NAME || process.env.SMTP_FROM_NAME || "Rolebolt";

const AUTH_EMAIL =
  process.env.AUTH_FROM_EMAIL ||
  process.env.SMTP_FROM_EMAIL ||
  "verify@rolebolt.tech";

const NOTIFICATION_EMAIL =
  process.env.NOTIFICATION_FROM_EMAIL ||
  "notifications@rolebolt.tech";

const CREATOR_OUTBOUND_EMAIL =
  process.env.CREATOR_OUTBOUND_FROM_EMAIL ||
  "no-reply@jobcreators.rolebolt.tech";

export const AUTH_FROM = `${NAME} <${AUTH_EMAIL}>`;
export const NOTIFICATION_FROM = `${NAME} <${NOTIFICATION_EMAIL}>`;
export const CREATOR_OUTBOUND_FROM = `Rolebolt Job Creators <${CREATOR_OUTBOUND_EMAIL}>`;

/**
 * The default is intentionally operational, not security-oriented. Every
 * current call site also passes an explicit sender, but this protects future
 * non-auth call sites from accidentally using verify@rolebolt.tech.
 */
export const DEFAULT_FROM = NOTIFICATION_FROM;