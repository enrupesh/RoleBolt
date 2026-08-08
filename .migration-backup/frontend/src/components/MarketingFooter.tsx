"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ReviewModal } from "@/components/ReviewModal";

const productLinks = [
  ["Free website (Sitegen)", "/website"],
  ["AI Copilot", "/recruit/copilot"],
  ["Analytics", "/recruit/analytics"],
  ["Talent pool", "/recruit/talent-pool"],
  ["Plans & billing", "/recruit/pricing"],
] as const;

const recruiterLinks = [
  ["Create a job", "/recruit/jobs/new"],
  ["Recruiter dashboard", "/recruit/dashboard"],
  ["Recruiter profile", "/recruit/recruiter-profile"],
  ["Find opportunities", "/recruit/opportunities"],
] as const;

const seekerLinks = [
  ["Seeker workspace", "/seeker/workspace"],
  ["Browse opportunities", "/recruit/opportunities"],
  ["Resume workspace", "/seeker/resume"],
  ["Interview preparation", "/seeker/interview-prep"],
] as const;

const resourceLinks = [
  ["Recruiting resources", "/resources#recruiter-guides"],
  ["Job-search resources", "/resources#job-seeker-guides"],
  ["AI recruiting guide", "/resources/ai-recruiting-software"],
  ["Resume builder guide", "/resources/ai-resume-builder"],
] as const;

const companyLinks = [
  ["About Rolebolt", "/about"],
  ["Blog", "/blog"],
  ["Careers", "/careers"],
  ["Contact", "/contact"],
] as const;

const legalLinks = [
  ["Privacy policy", "/privacy"],
  ["Terms & conditions", "/terms"],
  ["Refund & cancellation", "/refund-policy"],
  ["Payment & billing", "/recruit/billing"],
  ["Sitemap XML", "/sitemap.xml"],
] as const;

function ExternalArrow() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#88a7c0]">{title}</h3>
      <ul className="mt-5 space-y-3">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-[#c3d2df] transition-colors hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const trustBadges = [
  {
    short: "SOC 2",
    eyebrow: "AICPA",
    title: "Security controls",
    detail: "Designed for accountable operations",
    tone: "from-[#1e4f9c] to-[#17336f]",
    mark: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 3.25 19 6v5.2c0 4.35-2.72 7.98-7 9.55-4.28-1.57-7-5.2-7-9.55V6l7-2.75Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="m8.8 12 2.05 2.05L15.4 9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    short: "27001",
    eyebrow: "ISO",
    title: "Information security",
    detail: "Thoughtful protection by default",
    tone: "from-[#2865bb] to-[#1b3d83]",
    mark: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 3.5 14.15 9l5.85.45-4.48 3.78 1.4 5.77L12 15.9l-4.92 3.1 1.4-5.77L4 9.45 9.85 9 12 3.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    short: "GDPR",
    eyebrow: "EU",
    title: "Privacy principles",
    detail: "Respect for people and their data",
    tone: "from-[#315f9f] to-[#202f65]",
    mark: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.5v4.9l3.05 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
] as const;

export function MarketingFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <footer className="relative overflow-hidden bg-[#071a2b] text-white">
      <div className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[#0a66c2]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 left-1/3 h-[28rem] w-[28rem] rounded-full bg-[#2bb58a]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-8 border-b border-white/10 py-11 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:gap-16 lg:py-12">
          <div>
            <div className="flex items-center gap-3">
              <RoleboltLogo size="md" />
              <span className="font-display text-lg font-semibold tracking-[-0.04em]">Rolebolt</span>
            </div>
            <h2 className="mt-6 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.055em] text-white sm:text-[2.15rem]">
              Make every hiring decision with the whole picture.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#9eb5c8]">
              One thoughtful workspace for recruiting teams, candidates and the work between first application and final decision.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-[0_20px_60px_rgba(0,0,0,.18)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#88a7c0]">Have feedback?</p>
                <p className="mt-2 text-sm font-semibold text-white">Help us make Rolebolt better</p>
              </div>
              <span className="hidden items-center gap-2 rounded-full border border-[#41d2a0]/25 bg-[#41d2a0]/10 px-2.5 py-1 text-[10px] font-semibold text-[#73e2bd] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#41d2a0]" />
                We listen
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#9eb5c8]">
              Tell us what is working, what is missing, or what we should build next.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setReviewOpen(true)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#8fc4e9]/40 bg-[#0a66c2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#07559f]">
                Write a review
                <ExternalArrow />
              </button>
              <button type="button" onClick={() => setFeedbackOpen(true)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#102d46] transition hover:bg-[#e8f4fb]">
                Give feedback
                <ExternalArrow />
              </button>
              <a href="mailto:support@rolebolt.tech" className="text-center text-xs font-semibold text-[#a9c5d8] transition hover:text-white sm:text-left">
                support@rolebolt.tech
              </a>
            </div>
            <Link href="/reviews" className="mt-3 inline-flex text-xs font-semibold text-[#9ed2ee] transition hover:text-white">
              Read all community reviews →
            </Link>
          </div>
        </div>

        <div className="border-b border-white/10 py-8 sm:py-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-xs shrink-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#73b8ef]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#52d7ae] shadow-[0_0_10px_rgba(82,215,174,.8)]" />
                Trust, by design
              </div>
              <p className="mt-2 text-sm leading-5 text-[#b4c8d8]">
                The foundation behind clearer, more responsible hiring.
              </p>
            </div>

            <div className="flex min-w-0 gap-3 overflow-x-auto pb-1 sm:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {trustBadges.map((badge) => (
                <div
                  key={badge.short}
                  className="group flex min-w-[238px] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#65b6f2]/40 hover:bg-white/[0.09] sm:min-w-[250px] sm:p-3.5"
                >
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border border-white/15 bg-gradient-to-br ${badge.tone} text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_8px_20px_rgba(0,0,0,.22)]`}>
                    {badge.mark}
                    <span className="mt-0.5 text-[8px] font-bold tracking-[0.08em]">{badge.eyebrow}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86bde6]">{badge.short}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-white">{badge.title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#8fa9bc]">{badge.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-8 border-b border-white/10 py-9 sm:grid-cols-2 lg:grid-cols-6 lg:gap-7">
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="For recruiters" links={recruiterLinks} />
          <FooterColumn title="For job seekers" links={seekerLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Trust & billing" links={legalLinks} />
        </div>

        <div className="flex flex-col gap-5 py-7 text-xs text-[#88a7c0] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <p>© 2026 Rolebolt. All rights reserved.</p>
            <p>Built for clearer hiring and more confident job searches.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/recruit/status" className="group inline-flex items-center gap-2 font-semibold text-[#b9d4e4] transition-colors hover:text-white" aria-label="View Rolebolt system status">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#41d2a0] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#41d2a0] shadow-[0_0_10px_rgba(65,210,160,.85)]" />
              </span>
              System status
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            <a href="mailto:support@rolebolt.tech" className="transition-colors hover:text-white">Contact support</a>
          </div>
        </div>
      </div>
      </footer>
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} />}
    </>
  );
}