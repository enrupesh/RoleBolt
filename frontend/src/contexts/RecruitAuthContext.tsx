"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apiUrl } from "@/lib/api";
import { setTokenCookie, getTokenCookie, clearTokenCookie } from "@/lib/tokenCookie";

export type RecruitRole = "creator" | "seeker";

export interface RecruitProfile {
  uid: string;
  role: RecruitRole;
  name?: string;
  email?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

interface RecruitAuthState {
  authUser: AuthUser | null;
  sessionToken: string | null;
  recruitProfile: RecruitProfile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string; code?: string }>;
  signInWithToken: (token: string) => Promise<{ error?: string }>;
  signOut: () => void;
  signOutFromRecruit: () => void;
  refreshProfile: () => Promise<void>;
}

const TOKEN_KEY = "rb_auth_token";

const RecruitAuthContext = createContext<RecruitAuthState>({
  authUser: null,
  sessionToken: null,
  recruitProfile: null,
  loading: true,
  profileError: null,
  signIn: async () => ({}),
  signInWithToken: async () => ({}),
  signOut: () => {},
  signOutFromRecruit: () => {},
  refreshProfile: async () => {},
});

export function useRecruitAuth() {
  return useContext(RecruitAuthContext);
}

// ─── Token persistence helpers ────────────────────────────────────────────────
// We keep the token in BOTH localStorage (fast read) and a cookie (survives
// localStorage eviction, private mode, and mobile OS storage pressure).

function persistToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage full */ }
  setTokenCookie(token);
}

function retrieveToken(): string | null {
  try {
    const ls = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (ls) return ls;
  } catch { /* quota error */ }
  // Fall back to cookie if localStorage is unavailable or was cleared
  return getTokenCookie();
}

function wipeToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  clearTokenCookie();
}

// ─── Profile helper ───────────────────────────────────────────────────────────

async function fetchOrCreateProfile(
  token: string
): Promise<RecruitProfile | null> {
  try {
    const headers = { Authorization: `Bearer ${token}` };

    const getRes = await fetch(apiUrl("/recruit/auth/profile"), { headers });
    if (getRes.ok) return await getRes.json();

    // Profile not yet created — create it now (default role: creator)
    const postRes = await fetch(apiUrl("/recruit/auth/profile"), {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "creator" }),
    });
    if (postRes.ok) return await postRes.json();
    return null;
  } catch {
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RecruitAuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser]             = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken]     = useState<string | null>(null);
  const [recruitProfile, setRecruitProfile] = useState<RecruitProfile | null>(null);
  const [loading, setLoading]               = useState(true);
  const [profileError, setProfileError]     = useState<string | null>(null);

  // ── Initialise from stored token ───────────────────────────────────────────
  useEffect(() => {
    const stored = retrieveToken();

    if (!stored) {
      setLoading(false);
      return;
    }

    // Verify the stored token is still valid against the backend.
    // IMPORTANT: only wipe the token on an explicit auth rejection (401/403).
    // Network errors (backend sleeping, timeout) must NOT clear the token —
    // that was the root cause of session loss on Render cold starts.
    fetch(apiUrl("/auth/me"), {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          // Token is genuinely invalid or expired — clear it
          wipeToken();
          setLoading(false);
          return;
        }

        if (!res.ok) {
          // Server error (5xx) or network issue — keep token, let user stay logged in
          // Optimistically restore state from the stored token without profile
          // (profile will reload on next navigation / retry)
          setSessionToken(stored);
          // We can't validate the user object without a successful /auth/me,
          // so set a minimal sentinel so guards don't redirect to login
          // Re-sync the cookie to keep it alive
          persistToken(stored);
          setLoading(false);
          return;
        }

        const data: { id: string; email: string; name: string } = await res.json();
        const user: AuthUser = { id: data.id, email: data.email, name: data.name };
        setAuthUser(user);
        setSessionToken(stored);
        // Re-sync both stores to keep expiry fresh
        persistToken(stored);

        const profile = await fetchOrCreateProfile(stored);
        if (profile) {
          setRecruitProfile(profile);
          setProfileError(null);
        } else {
          setProfileError("Could not reach the server. Please try again.");
        }
        setLoading(false);
      })
      .catch(() => {
        // Pure network failure (offline, DNS, CORS on cold start) —
        // do NOT wipe the token. Keep the user "logged in" so they aren't
        // kicked to the login page just because the backend is waking up.
        persistToken(stored); // refresh cookie TTL
        setSessionToken(stored);
        setLoading(false);
      });
  }, []);

  // ── signInWithToken (used after OAuth redirect) ───────────────────────────
  const signInWithToken = useCallback(
    async (token: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(apiUrl("/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { error: "Invalid or expired token." };
        const data: { id: string; email: string; name: string } = await res.json();

        persistToken(token);
        setSessionToken(token);
        setAuthUser({ id: data.id, email: data.email, name: data.name });

        setProfileError(null);
        const profile = await fetchOrCreateProfile(token);
        if (profile) {
          setRecruitProfile(profile);
        } else {
          setProfileError("Could not reach the server. Please try again.");
        }
        return {};
      } catch {
        return { error: "Network error. Please check your connection." };
      }
    },
    []
  );

  // ── signIn ────────────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error?: string; code?: string }> => {
      try {
        const res = await fetch(apiUrl("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) return { error: data.error ?? "Login failed.", code: data.code };

        const { token, user } = data as {
          token: string;
          user: { id: string; email: string; name: string };
        };

        persistToken(token);
        setSessionToken(token);

        const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
        setAuthUser(authUser);

        setProfileError(null);
        const profile = await fetchOrCreateProfile(token);
        if (profile) {
          setRecruitProfile(profile);
        } else {
          setProfileError("Could not reach the server. Please try again.");
        }

        return {};
      } catch {
        return { error: "Network error. Please check your connection." };
      }
    },
    []
  );

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    wipeToken();
    setAuthUser(null);
    setSessionToken(null);
    setRecruitProfile(null);
    setProfileError(null);
  }, []);

  // ── refreshProfile ────────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!sessionToken) return;
    setProfileError(null);
    const profile = await fetchOrCreateProfile(sessionToken);
    if (profile) {
      setRecruitProfile(profile);
    } else {
      setProfileError("Could not reach the server. Please try again.");
    }
  }, [sessionToken]);

  return (
    <RecruitAuthContext.Provider
      value={{
        authUser,
        sessionToken,
        recruitProfile,
        loading,
        profileError,
        signIn,
        signInWithToken,
        signOut,
        signOutFromRecruit: signOut,
        refreshProfile,
      }}
    >
      {children}
    </RecruitAuthContext.Provider>
  );
}
