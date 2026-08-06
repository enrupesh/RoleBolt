"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRecruitAuth, type RecruitRole } from "@/contexts/RecruitAuthContext";
import { Sk, SkStatCard, SkJobCard } from "@/components/Skeleton";
import { isJudgeReviewerEmail } from "@/lib/judgeReviewer";

interface RecruitGuardProps {
  requiredRole: RecruitRole;
  children: React.ReactNode;
}

function GuardSkeleton() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] animate-[rb-fade-in_0.3s_ease_both]">
      <header className="sticky top-0 z-20 bg-white border-b border-black/[0.07] shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Sk className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Sk className="h-3.5 w-20 rounded-full" />
              <Sk className="h-2.5 w-14 rounded-full" />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Sk className="h-7 w-24 rounded-lg" />
            <Sk className="h-7 w-20 rounded-lg" />
            <Sk className="h-7 w-16 rounded-lg" />
          </div>
          <Sk className="h-9 w-28 rounded-xl" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2">
          <Sk className="h-7 w-52 rounded-lg" />
          <Sk className="h-3.5 w-80 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {Array.from({ length: 5 }).map((_, i) => <SkStatCard key={i} />)}
        </div>
        <Sk className="h-16 w-full rounded-2xl mb-6" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkJobCard key={i} />)}
        </div>
      </main>
    </div>
  );
}

function BackendErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">Connection Error</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Could not reach the server. Your account is still active — please retry in a moment.
        </p>
        <button
          onClick={onRetry}
          className="w-full rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004182] transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export function RecruitGuard({ requiredRole, children }: RecruitGuardProps) {
  const { authUser, recruitProfile, loading, profileError, refreshProfile } = useRecruitAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!authUser) {
      router.replace(requiredRole === "seeker" ? "/seeker/login" : "/recruit/login");
      return;
    }
    if (!recruitProfile) return;
    const canAccessRequiredRole =
      recruitProfile.role === requiredRole ||
      (requiredRole === "seeker" &&
        recruitProfile.canAccessSeeker === true &&
        isJudgeReviewerEmail(authUser.email));
    if (!canAccessRequiredRole) {
      router.replace(recruitProfile.role === "creator" ? "/recruit/dashboard" : "/seeker/dashboard");
    }
  }, [loading, authUser, recruitProfile, requiredRole, router]);

  if (loading) return <GuardSkeleton />;
  if (!authUser) return null;
  if (!recruitProfile) {
    if (profileError) return <BackendErrorScreen onRetry={refreshProfile} />;
    return null;
  }
  const canAccessRequiredRole =
    recruitProfile.role === requiredRole ||
    (requiredRole === "seeker" &&
      recruitProfile.canAccessSeeker === true &&
      isJudgeReviewerEmail(authUser.email));
  if (!canAccessRequiredRole) return null;
  return <>{children}</>;
}
