"use client";

import { ApiError, errorText } from "@/lib/api";

function label(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function SeekerErrorNotice({
  error,
  className = "",
}: {
  error: unknown;
  className?: string;
}) {
  if (!error) return null;

  const apiError = error instanceof ApiError ? error : null;
  const payload = apiError?.payload;
  const isLimit = payload?.error === "PLAN_LIMIT_REACHED"
    || payload?.code?.endsWith("_QUOTA_EXHAUSTED") === true;

  if (isLimit) {
    const feature = payload?.feature ? label(payload.feature) : "This operation";
    const usage = typeof payload?.used === "number" && payload.limit !== undefined && payload.limit !== null
      ? `Usage: ${payload.used}/${payload.limit}.`
      : "";
    const reset = payload?.resetAt
      ? ` Resets ${new Date(payload.resetAt).toLocaleDateString()}.`
      : "";

    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}>
        <p className="font-semibold">{feature} limit reached.</p>
        {(usage || reset) && <p className="mt-1 text-xs text-amber-800">{usage}{reset}</p>}
        {payload?.upgradeRequired && (
          <a href="/billing?category=seeker" className="mt-2 inline-block text-xs font-bold text-indigo-700 hover:text-indigo-800">
            View seeker plans →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 ${className}`}>
      {errorText(error)}
    </div>
  );
}