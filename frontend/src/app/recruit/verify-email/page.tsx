"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { authUser, loading } = useRecruitAuth();

  // Better Auth doesn't use a separate email-verification step in this flow.
  // Redirect signed-in users straight to dashboard; everyone else to login.
  useEffect(() => {
    if (loading) return;
    if (authUser) {
      router.replace("/recruit/dashboard");
    } else {
      router.replace("/recruit/login");
    }
  }, [authUser, loading, router]);

  return <div className="min-h-screen bg-[#f8fafc]" />;
}
