"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

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
  signOutFromRecruit: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Auth removed — context is stubbed as always-open.
// Replace with your custom auth implementation.
const RecruitAuthContext = createContext<RecruitAuthState>({
  authUser: { id: "anonymous", email: "", name: "" },
  sessionToken: "open",
  recruitProfile: { uid: "anonymous", role: "creator" },
  loading: false,
  profileError: null,
  signOutFromRecruit: async () => {},
  refreshProfile: async () => {},
});

export function useRecruitAuth() {
  return useContext(RecruitAuthContext);
}

export function RecruitAuthProvider({ children }: { children: ReactNode }) {
  const value: RecruitAuthState = {
    authUser: { id: "anonymous", email: "", name: "" },
    sessionToken: "open",
    recruitProfile: { uid: "anonymous", role: "creator" },
    loading: false,
    profileError: null,
    signOutFromRecruit: async () => {},
    refreshProfile: async () => {},
  };

  return (
    <RecruitAuthContext.Provider value={value}>
      {children}
    </RecruitAuthContext.Provider>
  );
}
