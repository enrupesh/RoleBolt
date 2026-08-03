"use client";

import { errorText } from "@/lib/api";
import { BillingLimitNotice } from "@/components/PlanLimitModal";
import { isUpgradeRequiredError } from "@/lib/billing";

/** Stable plan-limit / billing notice for Form Jobs creator surfaces. */
export function FormErrorNotice({
  error,
  className = "",
}: {
  error: unknown;
  className?: string;
}) {
  if (!error) return null;
  if (isUpgradeRequiredError(error)) {
    return <BillingLimitNotice error={error} className={className} />;
  }
  return (
    <div className={`rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 ${className}`}>
      {errorText(error)}
    </div>
  );
}
