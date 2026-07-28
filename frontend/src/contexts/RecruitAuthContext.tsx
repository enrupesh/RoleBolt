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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const [authUser, setAuthUser]           = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken]   = useState<string | null>(null);
  const [recruitProfile, setRecruitProfile] = useState<RecruitProfile | null>(null);
  const [loading, setLoading]             = useState(true);
  const [profileError, setProfileError]   = useState<string | null>(null);

  // ── Initialise from stored token ───────────────────────────────────────────
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null;

    if (!stored) {
      setLoading(false);
      return;
    }

    // Verify the stored token is still valid
    fetch(apiUrl("/auth/me"), {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("invalid_token");
        return res.json();
      })
      .then(async (data: { id: string; email: string; name: string }) => {
        const user: AuthUser = { id: data.id, email: data.email, name: data.name };
        setAuthUser(user);
        setSessionToken(stored);

        const profile = await fetchOrCreateProfile(stored);
        if (profile) {
          setRecruitProfile(profile);
          setProfileError(null);
        } else {
          setProfileError("Could not reach the server. Please try again.");
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => {
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

        localStorage.setItem(TOKEN_KEY, token);
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

        localStorage.setItem(TOKEN_KEY, token);
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
    localStorage.removeItem(TOKEN_KEY);
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
