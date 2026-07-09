"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRecruitAuth, type RecruitRole } from "@/contexts/RecruitAuthContext";
import { Sk, SkStatCard, SkJobCard } from "@/components/Skeleton";

interface RecruitGuardProps {
  requiredRole: RecruitRole;
  children: React.ReactNode;
}

function GuardSkeleton() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] animate-[rb-fade-in_0.3s_ease_both]">
      {/* Header skeleton */}
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
        {/* Page title */}
        <div className="mb-8 space-y-2">
          <Sk className="h-7 w-52 rounded-lg" />
          <Sk className="h-3.5 w-80 rounded-full" />
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {Array.from({ length: 5 }).map((_, i) => <SkStatCard key={i} />)}
        </div>
        {/* Tab bar */}
        <Sk className="h-16 w-full rounded-2xl mb-6" />
        {/* Job cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkJobCard key={i} />)}
        </div>
      </main>
    </div>
  );
}

export function RecruitGuard({ requiredRole, children }: RecruitGuardProps) {
  const { firebaseUser, recruitProfile, loading } = useRecruitAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/recruit/login");
      return;
    }
    // Email verification requirement disabled for now.
    if (!recruitProfile) {
      router.replace("/recruit/login");
      return;
    }
    if (recruitProfile.role !== requiredRole) {
      if (recruitProfile.role === "creator") {
        router.replace("/recruit/dashboard");
      } else {
        router.replace("/recruit/opportunities");
      }
    }
  }, [loading, firebaseUser, recruitProfile, requiredRole, router]);

  if (loading) {
    return <GuardSkeleton />;
  }

  if (!firebaseUser) {
    return null;
  }

  if (!recruitProfile) {
    return null;
  }

  if (recruitProfile.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
