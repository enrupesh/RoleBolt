"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { useBillingEntitlements } from "@/contexts/BillingEntitlementContext";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ApiError, errorText } from "@/lib/api";
import {
  billingHref,
  CATEGORY_LABELS,
  changePlan,
  createCheckout,
  fetchBillingCatalog,
  formatInrPaise,
  highlightLimits,
  openRazorpaySubscriptionCheckout,
  PLAN_LABELS,
  type BillingCatalogResponse,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
  type PublicPlanDefinition,
  verifyCheckout,
} from "@/lib/billing";

const CATEGORIES: BillingCategory[] = ["seeker", "creator_form", "creator_standard"];
const PAID_PLANS: BillingPlan[] = ["free", "pro", "ultra"];

function parseCategory(value: string | null): BillingCategory {
  if (value === "seeker" || value === "creator_form" || value === "creator_standard") return value;
  return "creator_standard";
}

function planTone(plan: BillingPlan): string {
  if (plan === "pro") return "border-teal-600 ring-2 ring-teal-600/15";
  if (plan === "ultra") return "border-slate-800";
  return "border-slate-200";
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionToken } = useRecruitAuth();
  const { getEntitlement, refresh } = useBillingEntitlements();

  const [category, setCategory] = useState<BillingCategory>(() =>
    parseCategory(searchParams.get("category")),
  );
  const [interval, setIntervalBilling] = useState<BillingInterval>("monthly");
  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [internationalRequested, setInternationalRequested] = useState(false);

  useEffect(() => {
    setCategory(parseCategory(searchParams.get("category")));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCatalog(true);
    fetchBillingCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err, "Unable to load pricing."));
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const plansForCategory = useMemo(() => {
    const rows = catalog?.plansByCategory ?? [];
    return PAID_PLANS.map((plan) =>
      rows.find(
        (item) =>
          item.category === category && item.plan === plan && item.interval === interval,
      ),
    ).filter(Boolean) as PublicPlanDefinition[];
  }, [catalog, category, interval]);

  const entitlement = getEntitlement(category);

  async function startCheckout(plan: BillingPlan) {
    if (plan === "free") return;
    if (!sessionToken) {
      router.push(`/recruit/login?next=${encodeURIComponent(`/recruit/pricing?category=${category}`)}`);
      return;
    }

    setLoadingKey(`${category}:${plan}:${interval}`);
    setError("");
    setNotice("");

    try {
      const current = getEntitlement(category);
      if (current && current.plan !== "free") {
        const changed = await changePlan(sessionToken, { category, plan, interval });
        setNotice(
          typeof changed.message === "string"
            ? changed.message
            : "Plan change requested. Entitlement updates only after Razorpay confirmation.",
        );
        await refresh();
        router.push(billingHref(category, { checkout: "pending" }));
        return;
      }

      const checkout = await createCheckout(sessionToken, { category, plan, interval });
      if (checkout.activation !== "webhook_required") {
        throw new Error("Unexpected checkout activation mode.");
      }

      const subscriptionId = checkout.checkout.subscriptionId;
      const keyId = catalog?.razorpayKeyId?.trim();
      if (checkout.checkout.subscriptionStatus && checkout.checkout.subscriptionStatus !== "created") {
        throw new Error("This checkout session is no longer valid. Please try again.");
      }

      if (subscriptionId && keyId) {
        await openRazorpaySubscriptionCheckout({
          keyId,
          subscriptionId,
          description: `${CATEGORY_LABELS[category]} ${PLAN_LABELS[plan]}`,
          prefill: checkout.checkout.prefill,
          onSuccess: async (result) => {
            try {
              await verifyCheckout(sessionToken, result);
              await refresh();
              router.push(billingHref(category, { checkout: "pending" }));
            } finally {
              setLoadingKey(null);
            }
          },
          onDismiss: () => setLoadingKey(null),
        });
        return;
      }

      if (checkout.checkout.shortUrl) {
        window.location.href = checkout.checkout.shortUrl;
        return;
      }

      throw new Error(
        "Razorpay checkout is not fully configured. Set RAZORPAY_KEY_ID on the API (exposed as catalog.razorpayKeyId).",
      );
    } catch (err) {
      if (err instanceof ApiError && err.payload.error === "CHANGE_PLAN_REQUIRED") {
        try {
          await changePlan(sessionToken!, { category, plan, interval });
          await refresh();
          router.push(billingHref(category, { checkout: "pending" }));
          return;
        } catch (changeErr) {
          setError(errorText(changeErr));
        }
      } else if (err instanceof ApiError && err.payload.error === "PLAN_ALREADY_ACTIVE") {
        setNotice("This plan is already active for the selected category.");
      } else {
        setError(errorText(err));
      }
      setLoadingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f8fafc_45%,_#f1f5f9_100%)]">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            href="/recruit/dashboard"
            className="text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            ← Back
          </Link>
          <Link href={billingHref(category)} className="text-sm text-slate-500 hover:text-slate-800">
            Manage billing →
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Rolebolt billing</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Plans that match how you hire and apply
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Three independent categories. Free is a real product with strict limits. Prices are INR and
            come from the server catalog — checkout never activates paid access by itself.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item);
                router.replace(`/recruit/pricing?category=${item}`);
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

        <div className="mt-5 inline-flex rounded-2xl border border-slate-200 bg-white p-1">
          {(["monthly", "yearly"] as BillingInterval[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setIntervalBilling(item)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
                interval === item ? "bg-teal-700 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item}
              {item === "yearly" ? " · ~2 months free" : ""}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {notice}
          </div>
        )}

        {loadingCatalog ? (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-96 animate-pulse rounded-3xl bg-white/70" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {plansForCategory.map((plan) => {
              const isCurrent =
                entitlement?.plan === plan.plan && entitlement?.interval === plan.interval;
              const busy = loadingKey === `${category}:${plan.plan}:${interval}`;
              const highlights = highlightLimits(category, plan.limits);
              return (
                <article
                  key={plan.id}
                  className={`flex flex-col rounded-3xl border bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.04)] ${planTone(plan.plan)}`}
                >
                  {plan.plan === "pro" && (
                    <span className="mb-3 inline-flex self-start rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
                      Most popular
                    </span>
                  )}
                  <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-slate-900">
                    {PLAN_LABELS[plan.plan]}
                  </h2>
                  <p className="mt-3 text-4xl font-black tracking-tight text-slate-900">
                    {plan.pricePaise === 0
                      ? "₹0"
                      : formatInrPaise(plan.pricePaise, interval).replace(/\/.*/, "")}
                    <span className="ml-1 text-sm font-semibold text-slate-400">
                      {plan.pricePaise === 0 ? "forever" : interval === "monthly" ? "/ month" : "/ year"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Priority: {plan.processingPriority}
                  </p>

                  <ul className="mt-6 flex-1 space-y-2">
                    {highlights.map((line) => (
                      <li key={line} className="flex gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 text-teal-600">✓</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-center text-sm font-bold text-emerald-800">
                        Current plan
                      </div>
                    ) : plan.plan === "free" ? (
                      <div className="rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-400">
                        Included for every account
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(loadingKey)}
                        onClick={() => void startCheckout(plan.plan)}
                        className={`w-full rounded-2xl py-3 text-sm font-bold transition disabled:opacity-60 ${
                          plan.plan === "pro"
                            ? "bg-teal-700 text-white hover:bg-teal-800"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {busy
                          ? "Starting…"
                          : entitlement && entitlement.plan !== "free"
                            ? `Switch to ${PLAN_LABELS[plan.plan]}`
                            : `Get ${PLAN_LABELS[plan.plan]}`}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-10 space-y-2 text-center text-sm text-slate-500">
          <p>Payments by Razorpay · INR · Cancel anytime · Paid access activates only after webhook verification</p>
          <p className="text-xs">
            On mobile, choose UPI and your payment app. On desktop, scan the Razorpay QR with another phone.
          </p>
        </div>

        <div className="mt-10 grid gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Help us fix it</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Find a bug?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tell us what went wrong. Your report goes directly to the Rolebolt admin Feedback inbox.
            </p>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="mt-4 inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Report a bug
              <span className="ml-2" aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="rounded-3xl border border-teal-200 bg-teal-50/80 p-5 shadow-[0_10px_30px_rgba(15,118,110,0.05)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Coming soon</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Need International Payment?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              We&apos;re bringing international payments to Rolebolt so users outside India can subscribe too.
            </p>
            <button
              type="button"
              onClick={() => setInternationalRequested(true)}
              className="mt-4 inline-flex items-center rounded-2xl border border-teal-700 bg-white px-4 py-2.5 text-sm font-bold text-teal-800 transition hover:bg-teal-100"
            >
              {internationalRequested ? "Request noted" : "Request international payments"}
            </button>
            {internationalRequested && (
              <p className="mt-3 rounded-2xl border border-teal-200 bg-white/80 px-3 py-2.5 text-xs font-semibold leading-5 text-teal-900">
                We&apos;ve already requested international payment support from Razorpay. We&apos;re working to bring it soon.
              </p>
            )}
          </div>
        </div>
      </main>
      {feedbackOpen && (
        <FeedbackModal
          initialCategory="bug"
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading pricing…
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
