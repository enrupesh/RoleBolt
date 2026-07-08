"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRecruitAuth, type RecruitRole } from "@/contexts/RecruitAuthContext";

interface RecruitGuardProps {
  requiredRole: RecruitRole;
  children: React.ReactNode;
}

export function RecruitGuard({ requiredRole, children }: RecruitGuardProps) {
  const { firebaseUser, recruitProfile, loading } = useRecruitAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser || !recruitProfile) {
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0a66c2] border-t-transparent" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !recruitProfile) {
    return null;
  }

  if (recruitProfile.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
