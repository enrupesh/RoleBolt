// AuthProviderButtons is no longer used — Clerk's <SignIn> and <SignUp>
// components handle Google and all other social providers natively.
// This file is kept to avoid stale import errors during migration.

export function AuthProviderButtons(_props: { mode: "login" | "signup"; onSuccess: () => void }) {
  return null;
}
