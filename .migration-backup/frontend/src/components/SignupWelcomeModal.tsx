"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { billingHref, CATEGORY_LABELS, pricingHref, type BillingCategory } from "@/lib/billing";
import { consumeSignupWelcome, type SignupWelcomeRole } from "@/lib/signupWelcome";

type WelcomePlan = "free" | "pro" | "ultra";

const PLAN_COPY: Record<WelcomePlan, { name: string; eyebrow: string; description: string; accent: string }> = {
  free: {
    name: "Free",
    eyebrow: "Start simply",
    description: "Explore the core workspace with a real starting plan.",
    accent: "border-slate-200 bg-white",
  },
  pro: {
    name: "Pro",
    eyebrow: "Most popular",
    description: "More capacity for consistent career or hiring workflows.",
    accent: "border-[#0a66c2] bg-[#f5faff] ring-2 ring-[#0a66c2]/10",
  },
  ultra: {
    name: "Ultra Pro",
    eyebrow: "For momentum",
    description: "Higher limits and priority capacity as your workflow grows.",
    accent: "border-slate-800 bg-[#10263d] text-white",
  },
};

function roleCategory(role: SignupWelcomeRole): BillingCategory {
  return role === "seeker" ? "seeker" : "creator_standard";
}

function shouldWaitForOnboarding(pathname: string) {
  return (
    pathname.includes("/signup") ||
    pathname.includes("/login") ||
    pathname.includes("/choose-username") ||
    pathname.includes("/verify-email") ||
    pathname.includes("/auth/callback") ||
    pathname.includes("/sso-callback")
  );
}

export function SignupWelcomeModal({ onlyRole }: { onlyRole?: SignupWelcomeRole } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { authUser, recruitProfile, loading } = useRecruitAuth();
  const [role, setRole] = useState<SignupWelcomeRole | null>(null);
  const [visible, setVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WelcomePlan | null>(null);

  useEffect(() => {
    if (loading || !authUser || !recruitProfile || !authUser.username?.trim()) return;
    if (shouldWaitForOnboarding(pathname)) return;
    const pendingRole = consumeSignupWelcome(onlyRole);
    if (!pendingRole || pendingRole !== recruitProfile.role) return;
    setRole(pendingRole);
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, [authUser, loading, onlyRole, pathname, recruitProfile]);

  if (!visible || !role) return null;

  const category = roleCategory(role);
  const categoryLabel = CATEGORY_LABELS[category];

  function close() {
    setVisible(false);
  }

  function explore(plan: WelcomePlan) {
    setSelectedPlan(plan);
    if (plan === "free") return;
    setVisible(false);
    router.push(pricingHref(category));
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#071a2d]/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-welcome-title"
    >
      <button
        type="button"
        aria-label="Close welcome message"
        className="absolute inset-0 cursor-default"
        onClick={close}
      />
      <div className="rb-welcome-card relative my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(4,26,49,.28)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#0a66c2] via-[#62b6ff] to-[#7c3aed]" />
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_80%_5%,rgba(119,196,255,.3),transparent_34%),linear-gradient(135deg,#f6fbff_0%,#ffffff_60%)] px-6 pb-7 pt-9 sm:px-10 sm:pt-11">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border-[18px] border-[#dff2ff]/80" />
          <div className="pointer-events-none absolute right-20 top-10 h-3 w-3 rounded-full bg-[#7c3aed]/50" />
          <div className="pointer-events-none absolute right-12 top-28 h-2 w-2 rounded-full bg-[#0a66c2]/50" />
          <button
            type="button"
            onClick={close}
            className="absolute right-5 top-5 rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
            aria-label="Close welcome message"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div className="relative flex items-start gap-4">
            <div className="rb-welcome-orb flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0a66c2] text-white shadow-[0_12px_28px_rgba(10,102,194,.25)]">
              <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
                <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
              </svg>
            </div>
            <div className="pr-7">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#0a66c2]">You&apos;re all set</p>
              <h2 id="signup-welcome-title" className="mt-2 font-display text-3xl font-semibold tracking-[-.055em] text-[#10263d] sm:text-4xl">
                Thanks for being part of Rolebolt
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#647a8d]">
                Welcome to your {categoryLabel.toLowerCase()} workspace. Choose a plan that feels right today—you can always change it later.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5 sm:px-10 sm:pb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#203d56]">Explore plans</p>
              <p className="mt-1 text-xs text-[#8496a5]">Start free or unlock more room when you need it.</p>
            </div>
            <span className="hidden rounded-full bg-[#f0f7fc] px-3 py-1 text-[11px] font-bold text-[#0a66c2] sm:inline-flex">
              {categoryLabel}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(PLAN_COPY) as WelcomePlan[]).map((plan) => {
              const copy = PLAN_COPY[plan];
              const isUltra = plan === "ultra";
              return (
                <button
                  key={plan}
                  type="button"
                  onClick={() => explore(plan)}
                  className={`group rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,55,90,.12)] ${copy.accent}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[.13em] ${isUltra ? "text-[#a8d9ff]" : plan === "pro" ? "text-[#0a66c2]" : "text-[#8496a5]"}`}>
                      {copy.eyebrow}
                    </span>
                    <span className={`text-lg transition group-hover:translate-x-0.5 ${isUltra ? "text-white/70" : "text-[#0a66c2]"}`}>↗</span>
                  </div>
                  <p className={`mt-3 text-lg font-bold ${isUltra ? "text-white" : "text-[#203d56]"}`}>{copy.name}</p>
                  <p className={`mt-1.5 text-xs leading-5 ${isUltra ? "text-white/70" : "text-[#718697]"}`}>{copy.description}</p>
                  <span className={`mt-4 inline-flex text-xs font-bold ${isUltra ? "text-white" : "text-[#0a66c2]"}`}>
                    {plan === "free" ? "Choose Free" : `Explore ${copy.name}`}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedPlan === "free" && (
            <div className="rb-welcome-free-note mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
              <span className="mt-0.5 text-base">✓</span>
              <p><span className="font-bold">No problem at all.</span> You can upgrade whenever you&apos;re ready—your Rolebolt workspace will be here.</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={close} className="text-xs font-semibold text-slate-500 transition hover:text-slate-800">
              I&apos;ll explore later
            </button>
            <div className="flex items-center gap-3">
              <a href={billingHref(category)} onClick={close} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                View my billing
              </a>
              <button type="button" onClick={() => explore("pro")} className="rounded-xl bg-[#0a66c2] px-4 py-2.5 text-xs font-bold text-white shadow-[0_6px_16px_rgba(10,102,194,.2)] transition hover:-translate-y-0.5 hover:bg-[#07559f]">
                Explore Plans
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}