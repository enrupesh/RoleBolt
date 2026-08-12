"use client";

import { errorText } from "@/lib/api";
import { BillingLimitNotice } from "@/components/PlanLimitModal";
import { isUpgradeRequiredError } from "@/lib/billing";

export function SeekerErrorNotice({
  error,
  className = "",
  manualAlternative,
}: {
  error: unknown;
  className?: string;
  /** Shown in the limit modal when manual editing/review still works. */
  manualAlternative?: string;
}) {
  if (!error) return null;
  if (isUpgradeRequiredError(error)) {
    return (
      <BillingLimitNotice
        error={error}
        className={className}
        manualAlternative={manualAlternative}
      />
    );
  }
  return (
    <div className={`rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 ${className}`}>
      {errorText(error)}
    </div>
  );
}
