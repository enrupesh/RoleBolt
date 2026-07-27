"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useUser, useAuth } from "@clerk/nextjs";
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
  signOutFromRecruit: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const RecruitAuthContext = createContext<RecruitAuthState>({
  authUser: null,
  sessionToken: null,
  recruitProfile: null,
  loading: true,
  signOutFromRecruit: async () => {},
  refreshProfile: async () => {},
});

export function useRecruitAuth() {
  return useContext(RecruitAuthContext);
}

async function fetchOrCreateProfile(
  user: AuthUser,
  token: string
): Promise<RecruitProfile | null> {
  try {
    // Try fetching existing profile first
    const getRes = await fetch(apiUrl("/recruit/auth/profile"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (getRes.ok) return await getRes.json();

    // Profile doesn't exist — create it (default role: creator)
    const postRes = await fetch(apiUrl("/recruit/auth/profile"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "creator",
        name: user.name ?? "",
        email: user.email ?? "",
      }),
    });
    if (postRes.ok) return await postRes.json();
    return null;
  } catch {
    return null;
  }
}

export function RecruitAuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken, signOut } = useAuth();

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [recruitProfile, setRecruitProfile] = useState<RecruitProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);

  // Fetch Clerk JWT whenever auth state changes
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      setSessionToken(null);
      setRecruitProfile(null);
      setProfileFetched(true);
      return;
    }

    getToken().then((token) => {
      setSessionToken(token);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id]);

  // Fetch/create backend profile whenever we get a fresh token
  useEffect(() => {
    if (!sessionToken || !user) return;

    const authUser: AuthUser = {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName ?? undefined,
    };

    let cancelled = false;
    setProfileLoading(true);

    fetchOrCreateProfile(authUser, sessionToken).then((profile) => {
      if (cancelled) return;
      setRecruitProfile(profile);
      setProfileLoading(false);
      setProfileFetched(true);
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const authUser: AuthUser | null = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? undefined,
      }
    : null;

  const signOutFromRecruit = useCallback(async () => {
    await signOut();
    setRecruitProfile(null);
    setSessionToken(null);
    setProfileFetched(false);
  }, [signOut]);

  const refreshProfile = useCallback(async () => {
    if (!authUser || !sessionToken) return;
    setProfileLoading(true);
    const profile = await fetchOrCreateProfile(authUser, sessionToken);
    setRecruitProfile(profile);
    setProfileLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, sessionToken]);

  const loading = !isLoaded || profileLoading || (!profileFetched && !!isSignedIn);

  return (
    <RecruitAuthContext.Provider
      value={{
        authUser,
        sessionToken,
        recruitProfile,
        loading,
        signOutFromRecruit,
        refreshProfile,
      }}
    >
      {children}
    </RecruitAuthContext.Provider>
  );
}
