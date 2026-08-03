"use client";

import { errorText } from "@/lib/api";
import { PlanLimitInlineNotice } from "@/components/PlanLimitModal";
import { isUpgradeRequiredError } from "@/lib/billing";

export function SeekerErrorNotice({
  error,
  className = "",
}: {
  error: unknown;
  className?: string;
}) {
  if (!error) return null;
  if (isUpgradeRequiredError(error)) {
    return <PlanLimitInlineNotice error={error} className={className} />;
  }
  return (
    <div className={`rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 ${className}`}>
      {errorText(error)}
    </div>
  );
}
