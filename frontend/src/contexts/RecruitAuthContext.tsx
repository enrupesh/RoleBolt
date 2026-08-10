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
import { isJudgeReviewerEmail } from "@/lib/judgeReviewer";
import { markJudgeWelcomePending } from "@/lib/judgeWelcome";

export type RecruitRole = "creator" | "seeker";

export interface RecruitProfile {
  uid: string;
  role: RecruitRole;
  canAccessSeeker?: boolean;
  username?: string;
  name?: string;
  email?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  name?: string;
  signupRole?: RecruitRole;
}

export type SignInCredentials = {
  password: string;
  email?: string;
  username?: string;
  role?: RecruitRole;
};

interface RecruitAuthState {
  authUser: AuthUser | null;
  sessionToken: string | null;
  recruitProfile: RecruitProfile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (credentials: SignInCredentials) => Promise<{ error?: string; code?: string; email?: string }>;
  signInWithToken: (token: string) => Promise<{ error?: string; username?: string }>;
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

function persistToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage full */ }
  setTokenCookie(token);
}

function retrieveToken(): string | null {
  try {
    const ls = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (ls) return ls;
  } catch { /* quota error */ }
  return getTokenCookie();
}

function wipeToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  clearTokenCookie();
}

type MeResponse = {
  id: string;
  email: string;
  username?: string;
  name: string;
  signupRole?: RecruitRole;
};

function toAuthUser(data: MeResponse): AuthUser {
  return {
    id: data.id,
    email: data.email,
    username: data.username,
    name: data.name,
    signupRole: data.signupRole,
  };
}

async function fetchOrCreateProfile(
  token: string,
  authUser?: AuthUser | null,
): Promise<RecruitProfile | null> {
  try {
    const headers = { Authorization: `Bearer ${token}` };

    const getRes = await fetch(apiUrl("/recruit/auth/profile"), { headers });
    if (getRes.ok) {
      const profile = await getRes.json() as RecruitProfile;
      if (authUser?.signupRole === "seeker" && profile.role !== "seeker") {
        const patchRes = await fetch(apiUrl("/recruit/auth/profile"), {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "seeker" }),
        });
        if (patchRes.ok) return await patchRes.json();
      }
      return profile;
    }

    const postRes = await fetch(apiUrl("/recruit/auth/profile"), {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        role: authUser?.signupRole === "seeker" ? "seeker" : "creator",
        canAccessSeeker: isJudgeReviewerEmail(authUser?.email),
        email: authUser?.email ?? "",
        username: authUser?.username ?? "",
      }),
    });
    if (postRes.ok) return await postRes.json();
    return null;
  } catch {
    return null;
  }
}

export function RecruitAuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser]             = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken]     = useState<string | null>(null);
  const [recruitProfile, setRecruitProfile] = useState<RecruitProfile | null>(null);
  const [loading, setLoading]               = useState(true);
  const [profileError, setProfileError]     = useState<string | null>(null);

  useEffect(() => {
    const stored = retrieveToken();

    if (!stored) {
      setLoading(false);
      return;
    }

    fetch(apiUrl("/auth/me"), {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          wipeToken();
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setSessionToken(stored);
          persistToken(stored);
          setLoading(false);
          return;
        }

        const data: MeResponse = await res.json();
        const user = toAuthUser(data);
        setAuthUser(user);
        setSessionToken(stored);
        persistToken(stored);

        const profile = await fetchOrCreateProfile(stored, user);
        if (profile) {
          setRecruitProfile(profile);
          setProfileError(null);
        } else {
          setProfileError("Could not reach the server. Please try again.");
        }
        setLoading(false);
      })
      .catch(() => {
        persistToken(stored);
        setSessionToken(stored);
        setLoading(false);
      });
  }, []);

  const signInWithToken = useCallback(
    async (token: string): Promise<{ error?: string; username?: string }> => {
      try {
        const res = await fetch(apiUrl("/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { error: "Invalid or expired token." };
        const data: MeResponse = await res.json();
        const user = toAuthUser(data);

        persistToken(token);
        setSessionToken(token);
        setAuthUser(user);

        setProfileError(null);
        const profile = await fetchOrCreateProfile(token, user);
        if (profile) {
          setRecruitProfile(profile);
        } else {
          setProfileError("Could not reach the server. Please try again.");
        }
        if (isJudgeReviewerEmail(user.email)) {
          markJudgeWelcomePending();
        }
        return { username: user.username };
      } catch {
        return { error: "Network error. Please check your connection." };
      }
    },
    []
  );

  const signIn = useCallback(
    async (credentials: SignInCredentials): Promise<{ error?: string; code?: string; email?: string }> => {
      try {
        const body: Record<string, string> = { password: credentials.password };
        if (credentials.email?.trim()) body.email = credentials.email.trim();
        else if (credentials.username?.trim()) body.username = credentials.username.trim();
        else return { error: "Provide email or username to sign in." };
        if (credentials.role) body.role = credentials.role;

        const res = await fetch(apiUrl("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) return { error: data.error ?? "Login failed.", code: data.code, email: data.email };

        const { token, user } = data as {
          token: string;
          user: {
            id: string;
            email: string;
            username?: string;
            name: string;
            signupRole?: RecruitRole;
          };
        };

        persistToken(token);
        setSessionToken(token);

        const nextUser: AuthUser = {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          signupRole: user.signupRole,
        };
        setAuthUser(nextUser);

        setProfileError(null);
        const profile = await fetchOrCreateProfile(token, nextUser);
        if (profile) {
          setRecruitProfile(profile);
        } else {
          setProfileError("Could not reach the server. Please try again.");
        }

        if (isJudgeReviewerEmail(nextUser.email)) {
          markJudgeWelcomePending();
        }

        return {};
      } catch {
        return { error: "Network error. Please check your connection." };
      }
    },
    []
  );

  const signOut = useCallback(() => {
    wipeToken();
    setAuthUser(null);
    setSessionToken(null);
    setRecruitProfile(null);
    setProfileError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!sessionToken) return;
    setProfileError(null);
    let currentUser = authUser;
    try {
      const meRes = await fetch(apiUrl("/auth/me"), {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (meRes.ok) {
        currentUser = toAuthUser(await meRes.json());
        setAuthUser(currentUser);
      }
    } catch {
      // Keep the current session and let profile refresh report a useful error.
    }
    const profile = await fetchOrCreateProfile(sessionToken, currentUser);
    if (profile) {
      setRecruitProfile(profile);
    } else {
      setProfileError("Could not reach the server. Please try again.");
    }
  }, [sessionToken, authUser]);

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
