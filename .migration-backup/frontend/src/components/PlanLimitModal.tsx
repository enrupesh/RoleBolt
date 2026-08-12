"use client";

import { useState } from "react";
import Link from "next/link";
import type { BillingErrorPayload } from "@/lib/api";
import {
  billingErrorPayload,
  billingHref,
  CATEGORY_LABELS,
  counterLabel,
  isUpgradeRequiredError,
  pricingHref,
  type BillingCategory,
} from "@/lib/billing";

function asCategory(value: unknown): BillingCategory | undefined {
  if (value === "seeker" || value === "creator_form" || value === "creator_standard") {
    return value;
  }
  return undefined;
}

export function PlanLimitModal({
  error,
  open,
  onClose,
  manualAlternative,
}: {
  error: unknown;
  open: boolean;
  onClose: () => void;
  /** Optional copy when a manual non-AI path remains available. */
  manualAlternative?: string;
}) {
  if (!open || !error || !isUpgradeRequiredError(error)) return null;

  const payload: BillingErrorPayload = billingErrorPayload(error) ?? {};
  const category = asCategory(payload.category);
  const feature = payload.feature ? counterLabel(payload.feature) : "This feature";
  const used =
    typeof payload.used === "number" && payload.limit !== undefined && payload.limit !== null
      ? `${payload.used} / ${payload.limit}`
      : null;
  const reset = payload.resetAt
    ? new Date(payload.resetAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close plan limit dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
          Plan limit
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold text-slate-900">
          {feature} needs a higher plan
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {payload.message ||
            "You have reached a plan capacity limit. Upgrade to continue, or keep using available manual options."}
        </p>

        <dl className="mt-5 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
          {category && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Category</dt>
              <dd className="font-semibold text-slate-800">{CATEGORY_LABELS[category]}</dd>
            </div>
          )}
          {payload.plan && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Current plan</dt>
              <dd className="font-semibold capitalize text-slate-800">{payload.plan}</dd>
            </div>
          )}
          {used && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Used / limit</dt>
              <dd className="font-semibold text-slate-800">{used}</dd>
            </div>
          )}
          {reset && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Resets</dt>
              <dd className="font-semibold text-slate-800">{reset}</dd>
            </div>
          )}
        </dl>

        {manualAlternative && (
          <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800">
            Manual option still available: {manualAlternative}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={pricingHref(category)}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-800"
            onClick={onClose}
          >
            View upgrade plans
          </Link>
          <Link
            href={billingHref(category)}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Billing usage
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-2xl px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Continue without upgrading
        </button>
      </div>
    </div>
  );
}

/** Inline notice plus upgrade modal — default billing limit UX for product surfaces. */
export function BillingLimitNotice({
  error,
  className = "",
  manualAlternative,
}: {
  error: unknown;
  className?: string;
  manualAlternative?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  if (!error || !isUpgradeRequiredError(error)) return null;
  return (
    <>
      <PlanLimitInlineNotice
        error={error}
        className={className}
        onOpenUpgrade={() => setModalOpen(true)}
      />
      <PlanLimitModal
        error={error}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        manualAlternative={manualAlternative}
      />
    </>
  );
}

/** Inline limit notice that can open the modal via optional callback. */
export function PlanLimitInlineNotice({
  error,
  className = "",
  onOpenUpgrade,
}: {
  error: unknown;
  className?: string;
  onOpenUpgrade?: () => void;
}) {
  if (!error || !isUpgradeRequiredError(error)) return null;
  const payload = billingErrorPayload(error) ?? {};
  const category = asCategory(payload.category);
  const feature = payload.feature ? counterLabel(payload.feature) : "This operation";
  const usage =
    typeof payload.used === "number" && payload.limit !== undefined && payload.limit !== null
      ? `Usage: ${payload.used}/${payload.limit}.`
      : "";
  const reset = payload.resetAt
    ? ` Resets ${new Date(payload.resetAt).toLocaleDateString("en-IN")}.`
    : "";

  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}>
      <p className="font-semibold">{feature} limit reached.</p>
      {(usage || reset) && <p className="mt-1 text-xs text-amber-800">{usage}{reset}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {onOpenUpgrade ? (
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="text-xs font-bold text-teal-800 hover:text-teal-900"
          >
            See upgrade options →
          </button>
        ) : (
          <Link href={pricingHref(category)} className="text-xs font-bold text-teal-800 hover:text-teal-900">
            See upgrade options →
          </Link>
        )}
        <Link href={billingHref(category)} className="text-xs font-semibold text-slate-600 hover:text-slate-800">
          Usage details
        </Link>
      </div>
    </div>
  );
}
