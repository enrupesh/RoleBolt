"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { apiUrl } from "@/lib/api";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tag: null,
    color: "border-slate-200",
    btnClass: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    features: [
      "2 active job listings",
      "10 candidates per job",
      "AI resume scoring",
      "Public job board",
      "Basic analytics",
    ],
    missing: [
      "AI Agent Mode",
      "Daily Recruiter Briefing",
      "Pipeline Rules",
      "Job Performance Monitor",
      "Priority AI",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    period: "/ month",
    tag: "⭐ Most Popular",
    color: "border-indigo-500 ring-2 ring-indigo-500/20",
    btnClass: "bg-indigo-600 text-white hover:bg-indigo-700",
    features: [
      "Unlimited job listings",
      "Unlimited candidates",
      "AI Agent Mode (auto-shortlist)",
      "AI Daily Recruiter Briefing",
      "Pipeline Rules automation",
      "Job Performance Monitor",
      "Priority AI processing",
      "CSV export",
    ],
    missing: ["5 team seats", "Dedicated support"],
  },
  {
    id: "agency",
    name: "Agency",
    price: "$149",
    period: "/ month",
    tag: "🏢 Teams",
    color: "border-purple-400",
    btnClass: "bg-purple-600 text-white hover:bg-purple-700",
    features: [
      "Everything in Pro",
      "5 team seats",
      "Agency branding",
      "Priority AI processing",
      "Dedicated support",
      "Custom integrations",
    ],
    missing: [],
  },
];

const SEEKER_PRO = {
  price: "$9",
  features: [
    "AI Resume Builder",
    "AI Interview Prep",
    "AI Cover Letter Generator",
    "AI Profile Optimizer",
    "Smart Job Alerts",
  ],
};

export default function PricingPage() {
  const router = useRouter();
  const { sessionToken, recruitProfile } = useRecruitAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleUpgrade(planId: string) {
    if (!sessionToken) { router.push("/recruit/login"); return; }
    if (planId === "free") return;
    setLoadingPlan(planId); setError("");
    try {
      const res = await fetch(apiUrl("/billing/create-checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout.");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setLoadingPlan(null);
    }
  }

  const currentPlan = (recruitProfile as any)?.plan ?? "free";

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/recruit/dashboard" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            ← Back to Dashboard
          </Link>
          <Link href="/recruit/billing" className="text-sm text-slate-500 hover:text-slate-700">
            Manage billing →
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900">Simple, transparent pricing</h1>
          <p className="mt-3 text-lg text-slate-500">Start free. Upgrade when you need more AI power.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 text-center">
            {error}
          </div>
        )}

        {/* Recruiter plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {PLANS.map(plan => (
            <div key={plan.id} className={`rounded-3xl border bg-white p-7 shadow-sm flex flex-col ${plan.color}`}>
              {plan.tag && (
                <span className="mb-3 inline-block self-start rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-200">
                  {plan.tag}
                </span>
              )}
              <h2 className="text-xl font-black text-slate-900">{plan.name}</h2>
              <div className="mt-2 mb-6">
                <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-400 ml-1">{plan.period}</span>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-green-500 font-bold">✓</span>{f}
                  </li>
                ))}
                {plan.missing.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="mt-0.5 text-slate-300">✗</span>{f}
                  </li>
                ))}
              </ul>

              {currentPlan === plan.id ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 py-3 text-center text-sm font-bold text-green-700">
                  ✓ Current Plan
                </div>
              ) : plan.id === "free" ? (
                <div className="rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-400">
                  Always free
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className={`w-full rounded-2xl py-3 text-sm font-bold transition disabled:opacity-60 ${plan.btnClass}`}
                >
                  {loadingPlan === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                      Starting checkout…
                    </span>
                  ) : `Upgrade to ${plan.name} →`}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Seeker Pro */}
        <div className="rounded-3xl border border-teal-300 bg-gradient-to-br from-teal-50 to-white p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <span className="mb-2 inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700 border border-teal-200">
                👤 For Job Seekers
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-1">Seeker Pro</h2>
              <div className="mt-1 mb-4">
                <span className="text-3xl font-black text-slate-900">{SEEKER_PRO.price}</span>
                <span className="text-sm text-slate-400 ml-1">/ month</span>
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
                {SEEKER_PRO.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-teal-500 font-bold">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => handleUpgrade("seeker_pro")}
              disabled={loadingPlan === "seeker_pro"}
              className="shrink-0 rounded-2xl bg-teal-600 px-8 py-4 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60 whitespace-nowrap"
            >
              {loadingPlan === "seeker_pro" ? "Starting…" : "Get Seeker Pro →"}
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center text-sm text-slate-400">
          Questions? <a href="mailto:hello@rolebolt.tech" className="text-indigo-600 hover:underline">hello@rolebolt.tech</a>
          {" · "}
          <span>Cancel anytime · No contracts</span>
        </div>
      </main>
    </div>
  );
}
