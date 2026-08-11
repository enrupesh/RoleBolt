"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { isJudgeReviewerEmail } from "@/lib/judgeReviewer";
import { consumeJudgeWelcomePending, JUDGE_WELCOME_OPEN_EVENT } from "@/lib/judgeWelcome";

type Panel = "welcome" | "vision" | "timeline" | "google";

const JUDGE_FEATURED_LINKS = [
  {
    href: "https://www.youtube.com/watch?v=3odX6rX572E&t=86s",
    label: "Watch demo video",
    description: "Full product walkthrough on YouTube",
    accent: "from-[#dc2626] to-[#ef4444]",
    icon: "▶",
    external: true,
  },
  {
    href: "https://github.com/enrupesh/RoleBolt/blob/main/JUDGES.md",
    label: "Technical brief (JUDGES.md)",
    description: "Architecture, Gemini usage & Google Cloud stack",
    accent: "from-[#24292f] to-[#57606a]",
    icon: "⌘",
    external: true,
  },
] as const;

type QuickLink = {
  href: string;
  label: string;
  description: string;
  accent: string;
  icon: string;
  external?: boolean;
};

const QUICK_LINKS: QuickLink[] = [
  {
    href: "/recruit/judges",
    label: "10-min testing kit",
    description: "Sample jobs, resumes & walkthrough",
    accent: "from-[#0a66c2] to-[#1d8fe8]",
    icon: "★",
  },
  {
    href: "/recruit/jobs/new",
    label: "Create a test job",
    description: "Watch Gemini write the JD & rubric",
    accent: "from-[#7c3aed] to-[#a855f7]",
    icon: "✦",
  },
  {
    href: "/recruit/copilot",
    label: "AI Copilot",
    description: "Ask grounded hiring questions",
    accent: "from-[#0f766e] to-[#14b8a6]",
    icon: "◎",
  },
  {
    href: "/recruit/opportunities",
    label: "Find Jobs board",
    description: "See the seeker experience",
    accent: "from-[#c2410c] to-[#f97316]",
    icon: "→",
  },
  {
    href: "/seeker/dashboard",
    label: "Seeker workspace",
    description: "Resume, tracker & career tools",
    accent: "from-[#1d4ed8] to-[#3b82f6]",
    icon: "◇",
  },
  {
    href: "/reviews",
    label: "Community reviews",
    description: "X posts, video & written reviews",
    accent: "from-[#be185d] to-[#ec4899]",
    icon: "♥",
  },
  {
    href: "/website",
    label: "Free website (Sitegen)",
    description: "AI portfolio from a resume",
    accent: "from-[#5b21b6] to-[#8b5cf6]",
    icon: "◈",
  },
  {
    href: "/recruit/pricing",
    label: "Plans & billing",
    description: "Ultra unlocked on this account",
    accent: "from-[#334155] to-[#64748b]",
    icon: "∞",
  },
];

function QuickLinkCard({
  link,
  onNavigate,
}: {
  link: QuickLink;
  onNavigate: () => void;
}) {
  const className =
    "group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#0a66c2]/30 hover:shadow-[0_10px_28px_rgba(15,55,90,.1)]";

  const inner = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${link.accent} text-sm font-bold text-white shadow-sm`}
        aria-hidden="true"
      >
        {link.icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-bold text-[#10263d]">
          {link.label}
          <span className="text-[#0a66c2] opacity-0 transition group-hover:opacity-100">
            {link.external ? "↗" : "→"}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-[#718697]">{link.description}</span>
      </span>
    </>
  );

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={link.href} onClick={onNavigate} className={className}>
      {inner}
    </Link>
  );
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

function PanelNav({
  active,
  onSelect,
}: {
  active: Panel;
  onSelect: (panel: Panel) => void;
}) {
  const items: { id: Panel; label: string }[] = [
    { id: "welcome", label: "Welcome" },
    { id: "vision", label: "Vision" },
    { id: "timeline", label: "Story" },
    { id: "google", label: "Google Cloud" },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] transition ${
            active === item.id
              ? "bg-[#10263d] text-white shadow-sm"
              : "bg-white/80 text-[#647a8d] hover:bg-white hover:text-[#10263d]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function JudgeWelcomeModal() {
  const pathname = usePathname();
  const { authUser, recruitProfile, loading } = useRecruitAuth();
  const [visible, setVisible] = useState(false);
  const [panel, setPanel] = useState<Panel>("welcome");

  useEffect(() => {
    if (loading || !authUser?.email || !recruitProfile) return;
    if (!isJudgeReviewerEmail(authUser.email)) return;
    if (shouldWaitForOnboarding(pathname)) return;
    if (!consumeJudgeWelcomePending()) return;

    const timer = window.setTimeout(() => {
      setPanel("welcome");
      setVisible(true);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [authUser, loading, pathname, recruitProfile]);

  useEffect(() => {
    function onReopen() {
      if (!authUser?.email || !isJudgeReviewerEmail(authUser.email)) return;
      setPanel("welcome");
      setVisible(true);
    }

    window.addEventListener(JUDGE_WELCOME_OPEN_EVENT, onReopen);
    return () => window.removeEventListener(JUDGE_WELCOME_OPEN_EVENT, onReopen);
  }, [authUser?.email]);

  function close() {
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#071a2d]/70 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judge-welcome-title"
    >
      <button
        type="button"
        aria-label="Close judge welcome"
        className="absolute inset-0 cursor-default"
        onClick={close}
      />

      <div className="relative my-auto w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_32px_120px_rgba(4,26,49,.32)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-[#0a66c2] to-[#7c3aed]" />

        {/* Hero */}
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_0%,rgba(251,191,36,.22),transparent_38%),linear-gradient(135deg,#fff9eb_0%,#f6fbff_45%,#ffffff_100%)] px-6 pb-6 pt-8 sm:px-9 sm:pt-10">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full border-[20px] border-amber-200/50" />
          <div className="pointer-events-none absolute right-24 top-8 h-2.5 w-2.5 rounded-full bg-[#0a66c2]/40" />

          <button
            type="button"
            onClick={close}
            className="absolute right-5 top-5 rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
            aria-label="Close judge welcome"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <div className="relative pr-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-amber-800">
              <span aria-hidden="true">★</span>
              Build with Gemini XPRIZE · Judge access
            </div>
            <h2 id="judge-welcome-title" className="mt-4 font-display text-3xl font-semibold tracking-[-.055em] text-[#10263d] sm:text-[2.35rem] sm:leading-tight">
              Welcome — we&apos;re glad you&apos;re here.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#647a8d]">
              You&apos;re signed in with the judge evaluation account. <strong className="font-semibold text-[#10263d]">Free, Pro, and Ultra</strong> are
              fully unlocked so you can explore every workflow without limits.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                ["Live since", "July 2026"],
                ["Production URL", "rolebolt.tech"],
                ["AI engine", "Google Gemini"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8496a5]">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-[#10263d]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-6">
            <PanelNav active={panel} onSelect={setPanel} />
          </div>
        </div>

        <div className="px-6 pb-7 pt-2 sm:px-9 sm:pb-8">
          {panel === "welcome" && (
            <>
              <p className="text-sm font-semibold text-[#203d56]">Start here</p>
              <p className="mt-1 text-xs text-[#8496a5]">
                Watch the demo, read the technical brief, or jump straight into the product.
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {JUDGE_FEATURED_LINKS.map((link) => (
                  <QuickLinkCard key={link.href} link={link} onNavigate={close} />
                ))}
              </div>

              <p className="mt-6 text-sm font-semibold text-[#203d56]">Explore the product</p>
              <p className="mt-1 text-xs text-[#8496a5]">
                Pick a path below — or read our vision, origin story, and Google Cloud stack in the tabs above.
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {QUICK_LINKS.map((link) => (
                  <QuickLinkCard key={link.href} link={link} onNavigate={close} />
                ))}
              </div>
            </>
          )}

          {panel === "vision" && (
            <div className="space-y-4">
              <blockquote className="rounded-2xl border border-[#dbeafe] bg-[#f5faff] px-5 py-4 text-[15px] font-medium leading-7 text-[#10263d]">
                &ldquo;Hiring software should help people make better decisions — not just move faster.&rdquo;
              </blockquote>
              <div className="space-y-3 text-sm leading-7 text-[#647a8d]">
                <p>
                  <strong className="text-[#10263d]">Rolebolt</strong> is an AI-native recruiting workspace for hiring teams and job seekers.
                  Recruiters get pipelines, rubric-based scoring, assessments, collaboration, and a Gemini-powered copilot. Candidates get match
                  scores, application tracking, and career tools — all in one product.
                </p>
                <p>
                  We built Rolebolt for small teams who cannot afford enterprise ATS pricing but still deserve intelligent hiring. Gemini is not a
                  sidebar chatbot here — it runs inside job creation, resume scoring, form evaluation, daily briefings, and portfolio generation.
                </p>
                <p>
                  <strong className="text-[#10263d]">Long-term vision:</strong> become the default hiring operating system for growing businesses in
                  markets where LinkedIn and enterprise tools are too heavy — with AI that keeps human judgement at the centre.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/about"
                  onClick={close}
                  className="rounded-xl bg-[#0a66c2] px-4 py-2.5 text-xs font-bold text-white shadow-[0_6px_16px_rgba(10,102,194,.2)] transition hover:bg-[#07559f]"
                >
                  Read about Rolebolt
                </Link>
                <Link
                  href="/recruit/judges"
                  onClick={close}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#31536e] transition hover:border-[#0a66c2] hover:text-[#0a66c2]"
                >
                  Open testing kit
                </Link>
              </div>
            </div>
          )}

          {panel === "timeline" && (
            <div className="space-y-4">
              <ol className="space-y-3">
                {[
                  ["July 2026", "Rolebolt extracted into a standalone production codebase — frontend (Next.js) + backend (Express) deployed on Render."],
                  ["Summer 2026", "Core AI hiring loop shipped: Gemini JD generation, resume rubric scoring, recruiting copilot, form jobs, and seeker workspace."],
                  ["August 2026", "Build with Gemini XPRIZE submission — Sitegen portfolio builder, community reviews, private jobs, and judge evaluation kit."],
                  ["Today", "Live at rolebolt.tech with Firebase auth, reCAPTCHA bot protection, Razorpay billing, and real user workflows."],
                ].map(([when, what]) => (
                  <li key={when} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-[.12em] text-[#0a66c2]">{when}</span>
                    <span className="text-sm leading-6 text-[#647a8d]">{what}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs leading-6 text-[#8496a5]">
                Technical evidence (GCP billing, Gemini usage dashboards) lives in the repository&apos;s{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-[#31536e]">Product_Evidence/</code> folder and the{" "}
                <a
                  href="https://github.com/enrupesh/RoleBolt/blob/main/JUDGES.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#0a66c2] hover:underline"
                >
                  JUDGES.md technical brief
                </a>
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://www.youtube.com/watch?v=3odX6rX572E&t=86s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#dc2626] px-4 py-2.5 text-xs font-bold text-white shadow-[0_6px_16px_rgba(220,38,38,.2)] transition hover:bg-[#b91c1c]"
                >
                  Watch demo video ↗
                </a>
                <a
                  href="https://github.com/enrupesh/RoleBolt/blob/main/JUDGES.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#31536e] transition hover:border-[#0a66c2] hover:text-[#0a66c2]"
                >
                  Read JUDGES.md ↗
                </a>
              </div>
            </div>
          )}

          {panel === "google" && (
            <div className="space-y-4">
              <p className="text-sm leading-7 text-[#647a8d]">
                Rolebolt is built on a deliberate <strong className="text-[#10263d]">Google-first stack</strong> for identity, intelligence, and abuse prevention.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[
                  ["Google Gemini API", "JD generation, resume scoring, copilot, form grading, daily briefings, site guide chatbot, Sitegen structuring."],
                  ["Firebase Authentication", "Google OAuth sign-in and phone OTP for recruiters and job seekers."],
                  ["Firebase Admin SDK", "Server-side verification of Firebase ID tokens on login."],
                  ["reCAPTCHA v3", "Invisible bot detection on public job applications and form submissions — protects paid AI endpoints."],
                ].map(([title, copy]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-bold text-[#10263d]">{title}</p>
                    <p className="mt-1.5 text-xs leading-5 text-[#718697]">{copy}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-[#dbeafe] bg-[#f5faff] px-4 py-3.5 text-xs leading-6 text-[#31536e]">
                <strong>Model routing:</strong> Direct Gemini API for generation → Mesh gateway for high-volume scoring → automatic fallback chain so users never hit a dead end.
              </div>
              <Link
                href="/recruit/mesh-api-status"
                onClick={close}
                className="inline-flex rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#31536e] transition hover:border-[#0a66c2] hover:text-[#0a66c2]"
              >
                Check live AI routing status →
              </Link>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://github.com/enrupesh/RoleBolt/blob/main/JUDGES.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#10263d] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0a1f33]"
                >
                  Full JUDGES.md brief ↗
                </a>
                <a
                  href="https://www.youtube.com/watch?v=3odX6rX572E&t=86s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#31536e] transition hover:border-[#dc2626] hover:text-[#dc2626]"
                >
                  Demo video ↗
                </a>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={close}
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
            >
              I&apos;ll explore on my own
            </button>
            <Link
              href="/recruit/judges"
              onClick={close}
              className="rounded-xl bg-[#10263d] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(16,38,61,.2)] transition hover:-translate-y-0.5 hover:bg-[#0a1f33]"
            >
              Begin 10-minute evaluation →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
