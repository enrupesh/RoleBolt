"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { apiUrl } from "@/lib/api";

export type RecruitRole = "creator" | "seeker";

export interface RecruitProfile {
  uid: string;
  role: RecruitRole;
  name?: string;
  email?: string;
}

interface RecruitAuthState {
  firebaseUser: User | null;
  recruitProfile: RecruitProfile | null;
  loading: boolean;
  signOutFromRecruit: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const RecruitAuthContext = createContext<RecruitAuthState>({
  firebaseUser: null,
  recruitProfile: null,
  loading: true,
  signOutFromRecruit: async () => {},
  refreshProfile: async () => {},
});

export function useRecruitAuth() {
  return useContext(RecruitAuthContext);
}

async function fetchRecruitProfileOnce(user: User): Promise<RecruitProfile | null> {
  try {
    const token = await user.getIdToken();
    const res = await fetch(apiUrl("/recruit/auth/profile"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchRecruitProfileWithRetry(user: User): Promise<RecruitProfile | null> {
  const first = await fetchRecruitProfileOnce(user);
  if (first) return first;
  await new Promise(r => setTimeout(r, 2000));
  return fetchRecruitProfileOnce(user);
}

export function RecruitAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [recruitProfile, setRecruitProfile] = useState<RecruitProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setFirebaseUser(null);
      setRecruitProfile(null);
      setLoading(false);
      return;
    }
    setFirebaseUser(user);
    const profile = await fetchRecruitProfileWithRetry(user);
    setRecruitProfile(profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setLoading(true);
      loadProfile(user);
    });
    return unsub;
  }, [loadProfile]);

  const signOutFromRecruit = useCallback(async () => {
    setRecruitProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    const profile = await fetchRecruitProfileOnce(firebaseUser);
    setRecruitProfile(profile);
    setLoading(false);
  }, [firebaseUser]);

  return (
    <RecruitAuthContext.Provider
      value={{ firebaseUser, recruitProfile, loading, signOutFromRecruit, refreshProfile }}
    >
      {children}
    </RecruitAuthContext.Provider>
  );
}
