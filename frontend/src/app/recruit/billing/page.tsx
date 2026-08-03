"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { useBillingEntitlements } from "@/contexts/BillingEntitlementContext";
import { errorText } from "@/lib/api";
import {
  billingHref,
  cancelPendingPlanChange,
  cancelSubscription,
  CATEGORY_LABELS,
  counterLabel,
  formatLimit,
  PLAN_LABELS,
  pricingHref,
  type BillingCategory,
  type CategoryEntitlement,
  VISIBLE_COUNTERS,
} from "@/lib/billing";

const CATEGORIES: BillingCategory[] = ["seeker", "creator_form", "creator_standard"];

function parseCategory(value: string | null): BillingCategory {
  if (value === "seeker" || value === "creator_form" || value === "creator_standard") return value;
  return "creator_standard";
}

function warningCopy(entitlement: CategoryEntitlement): string | null {
  switch (entitlement.billingWarning) {
    case "cancel_scheduled":
      return "Cancellation is scheduled. Paid access continues until the current period ends.";
    case "payment_pending":
      return "A payment is pending. You still have paid capacity while Razorpay retries.";
    case "past_due":
      return "Payment failed. New AI/metered work is restricted until billing is restored.";
    case "halted":
      return "Subscription halted after failed payments. Metered work is restricted.";
    case "plan_change_pending":
      return `Plan change pending${entitlement.pendingPlan ? ` → ${PLAN_LABELS[entitlement.pendingPlan]}` : ""}. Current limits stay until Razorpay confirms.`;
    default:
      return null;
  }
}

function priorityBadge(priority: string): string {
  if (priority === "priority") return "bg-slate-900 text-white";
  if (priority === "normal") return "bg-teal-100 text-teal-900";
  return "bg-slate-100 text-slate-700";
}

function UsageBar({
  used,
  reserved,
  limit,
}: {
  used: number;
  reserved: number;
  limit: number | null | undefined;
}) {
  if (limit === null || limit === undefined) {
    return (
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/5 rounded-full bg-teal-500/70" />
      </div>
    );
  }
  const total = used + reserved;
  const pct = Math.min(100, Math.round((total / Math.max(limit, 1)) * 100));
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-teal-600"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionToken, loading: authLoading } = useRecruitAuth();
  const { entitlements, loading, refresh, error: entitlementError } = useBillingEntitlements();

  const [category, setCategory] = useState<BillingCategory>(() =>
    parseCategory(searchParams.get("category")),
  );
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const checkoutPending = searchParams.get("checkout") === "pending";
  // Intentionally ignore legacy ?success=1 activation — never claim paid unlock client-side.

  useEffect(() => {
    setCategory(parseCategory(searchParams.get("category")));
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (!sessionToken) {
      router.replace(`/recruit/login?next=${encodeURIComponent(billingHref(category))}`);
    }
  }, [authLoading, sessionToken, router, category]);

  useEffect(() => {
    if (checkoutPending) {
      setActionNotice(
        "Checkout received. Waiting for Razorpay webhook verification — paid access is not unlocked from this page alone.",
      );
      void refresh();
    }
  }, [checkoutPending, refresh]);

  const entitlement = useMemo(
    () => entitlements.find((item) => item.category === category) ?? null,
    [entitlements, category],
  );

  const warning = entitlement ? warningCopy(entitlement) : null;
  const counters = VISIBLE_COUNTERS[category];
  const periodEnd = entitlement?.periodEnd
    ? new Date(entitlement.periodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  async function onCancel() {
    if (!sessionToken || !entitlement || entitlement.plan === "free") return;
    if (
      !window.confirm(
        "Schedule cancellation at the end of the current billing period? You keep paid access until then.",
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const result = await cancelSubscription(sessionToken, category);
      setActionNotice(
        typeof result.message === "string"
          ? result.message
          : "Cancellation scheduled at period end.",
      );
      await refresh();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCancelPendingChange() {
    if (!sessionToken) return;
    setBusy(true);
    setActionError("");
    try {
      await cancelPendingPlanChange(sessionToken, category);
      setActionNotice("Pending plan change cancelled.");
      await refresh();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfdf5_0%,_#f8fafc_40%,_#eef2ff_100%)]">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link href="/recruit/dashboard" className="text-sm font-semibold text-teal-800 hover:text-teal-950">
            ← Dashboard
          </Link>
          <Link href={pricingHref(category)} className="text-sm text-slate-500 hover:text-slate-800">
            View plans →
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Rolebolt</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold text-slate-900">
          Billing & usage
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Each category has its own Free / Pro / Ultra Pro entitlement. Usage below comes from the
          server — not from browser plan flags.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item);
                router.replace(billingHref(item, checkoutPending ? { checkout: "pending" } : undefined));
              }}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                category === item
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>

        {(actionNotice || checkoutPending) && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {actionNotice ||
              "Pending webhook verification. Refreshing entitlements automatically."}
          </div>
        )}
        {(actionError || entitlementError) && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError || entitlementError}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {CATEGORY_LABELS[category]}
              </p>
              {loading || !entitlement ? (
                <div className="mt-3 h-10 w-48 animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900">
                    {PLAN_LABELS[entitlement.plan]}
                    <span className="ml-2 text-base font-semibold capitalize text-slate-400">
                      {entitlement.interval}
                    </span>
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                      {entitlement.status}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${priorityBadge(
                        entitlement.processingPriority,
                      )}`}
                    >
                      {entitlement.processingPriority} queue
                    </span>
                    {entitlement.cancelAtPeriodEnd && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                        Cancels at period end
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <Link
              href={pricingHref(category)}
              className="rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
            >
              {entitlement && entitlement.plan !== "free" ? "Change plan" : "Upgrade"}
            </Link>
          </div>

          {periodEnd && (
            <p className="mt-4 text-sm text-slate-500">
              {entitlement?.cancelAtPeriodEnd ? `Access through ${periodEnd}` : `Resets / renews ${periodEnd}`}
            </p>
          )}
          {warning && (
            <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {warning}
            </p>
          )}

          {entitlement && entitlement.plan !== "free" && (
            <div className="mt-5 flex flex-wrap gap-2">
              {!entitlement.cancelAtPeriodEnd && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCancel()}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel at period end
                </button>
              )}
              {entitlement.pendingPlan && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCancelPendingChange()}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel pending plan change
                </button>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Usage this period</h3>
          {loading || !entitlement ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {counters.map((counter) => {
                const used = entitlement.usedCounters[counter] ?? 0;
                const reserved = entitlement.reservedCounters[counter] ?? 0;
                const remaining = entitlement.remaining[counter];
                const limit =
                  remaining === null
                    ? null
                    : typeof remaining === "number"
                      ? used + reserved + remaining
                      : undefined;
                return (
                  <div key={counter} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{counterLabel(counter)}</p>
                      <p className="text-xs font-bold text-slate-500">
                        {used + reserved}
                        {limit === null ? " / ∞" : typeof limit === "number" ? ` / ${formatLimit(limit)}` : ""}
                      </p>
                    </div>
                    <UsageBar used={used} reserved={reserved} limit={limit ?? null} />
                    <p className="mt-2 text-[11px] text-slate-500">
                      Remaining: {formatLimit(remaining ?? null)}
                      {periodEnd ? ` · resets ${periodEnd}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-slate-400">
          Payments processed by Razorpay. Checkout success never unlocks paid plans — only a verified
          webhook or reconciliation does.
        </p>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading billing…
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
