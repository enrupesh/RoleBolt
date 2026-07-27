"use client";

import type { ReactNode } from "react";
import type { RecruitRole } from "@/contexts/RecruitAuthContext";

interface RecruitGuardProps {
  requiredRole: RecruitRole;
  children: ReactNode;
}

// Auth removed — guard is a passthrough.
// Replace with your custom RBAC logic when auth is implemented.
export function RecruitGuard({ children }: RecruitGuardProps) {
  return <>{children}</>;
}
