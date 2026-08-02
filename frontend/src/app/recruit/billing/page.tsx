"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { apiUrl } from "@/lib/api";

type Sub = {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

const PLAN_DISPLAY: Record<string, { label: string; color: string; price: string }> = {
  free:       { label: "Free",       color: "bg-slate-100 text-slate-700",   price: "$0/mo" },
  pro:        { label: "Pro",        color: "bg-indigo-100 text-indigo-700", price: "$49/mo" },
  agency:     { label: "Agency",     color: "bg-purple-100 text-purple-700", price: "$149/mo" },
  seeker_pro: { label: "Seeker Pro", color: "bg-teal-100 text-teal-700",     price: "$9/mo" },
};

function BillingContent() {
  const { sessionToken } = useRecruitAuth();
  const [sub, setSub]           = useState<Sub | null>(null);
  const [loading, setLoading]   = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError]       = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    // Check for success/cancel query param
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") setSuccessMsg("🎉 Subscription activated! Welcome to your new plan.");
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    fetch(apiUrl("/billing/subscription"), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(r => r.json())
      .then(d => setSub(d))
      .catch(() => setSub({ plan: "free", status: "active" }))
      .finally(() => setLoading(false));
  }, [sessionToken]);

  async function openPortal() {
    if (!sessionToken) return;
    setPortalLoading(true); setError("");
    try {
      const res = await fetch(apiUrl("/billing/create-portal"), {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open billing portal.");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setPortalLoading(false);
    }
  }

  const planInfo = PLAN_DISPLAY[sub?.plan ?? "free"] ?? PLAN_DISPLAY.free;
  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href="/recruit/dashboard" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            ← Dashboard
          </Link>
          <Link href="/recruit/pricing" className="text-sm text-slate-500 hover:text-slate-700">
            View all plans →
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-black text-slate-900 mb-6">Billing & Subscription</h1>

        {successMsg && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Current plan card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Current Plan</h2>
          {loading ? (
            <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${planInfo.color}`}>{planInfo.label}</span>
                  <span className="text-2xl font-black text-slate-900">{planInfo.price}</span>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${isActive ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"}`}>
                  {sub?.status ?? "inactive"}
                </span>
              </div>

              {periodEnd && (
                <p className="text-sm text-slate-500 mb-2">
                  {sub?.cancelAtPeriodEnd
                    ? `⚠️ Cancels on ${periodEnd}`
                    : `Renews on ${periodEnd}`}
                </p>
              )}

              {sub?.plan === "free" ? (
                <Link
                  href="/recruit/pricing"
                  className="block w-full rounded-2xl bg-indigo-600 py-3 text-center text-sm font-bold text-white transition hover:bg-indigo-700"
                >
                  Upgrade to Pro — $49/mo →
                </Link>
              ) : (
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {portalLoading ? "Opening portal…" : "Manage Subscription (Stripe Portal) →"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Plan features reminder */}
        {!loading && sub?.plan !== "free" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Your Plan Includes</h2>
            {sub?.plan === "pro" && (
              <ul className="space-y-2 text-sm text-slate-700">
                {["Unlimited job listings", "AI Agent Mode", "Daily Recruiter Briefing", "Pipeline Rules automation", "Job Performance Monitor", "Priority AI processing"].map(f => (
                  <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
                ))}
              </ul>
            )}
            {sub?.plan === "agency" && (
              <ul className="space-y-2 text-sm text-slate-700">
                {["Everything in Pro", "5 team seats", "Agency branding", "Dedicated support", "Custom integrations"].map(f => (
                  <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Payments processed securely by <a href="https://stripe.com" className="underline" target="_blank" rel="noopener noreferrer">Stripe</a>.
          Cancel anytime with no fees.
        </p>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return <RecruitGuard requiredRole="creator"><BillingContent /></RecruitGuard>;
}
