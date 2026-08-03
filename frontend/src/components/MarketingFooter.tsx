import Link from "next/link";
import { RoleboltLogo } from "@/components/RoleboltLogo";

const productLinks = [
  ["Product preview", "/recruit/preview"],
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

const legalLinks = [
  ["Privacy policy", "/privacy"],
  ["Terms & conditions", "/terms"],
  ["Refund & cancellation", "/refund-policy"],
  ["Payment & billing", "/recruit/billing"],
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

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#071a2b] text-white">
      <div className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[#0a66c2]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 left-1/3 h-[28rem] w-[28rem] rounded-full bg-[#2bb58a]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 py-14 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:gap-20 lg:py-16">
          <div>
            <div className="flex items-center gap-3">
              <RoleboltLogo size="md" />
              <span className="font-display text-lg font-semibold tracking-[-0.04em]">Rolebolt</span>
            </div>
            <h2 className="mt-7 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.055em] text-white sm:text-4xl">
              Make every hiring decision with the whole picture.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#9eb5c8]">
              One thoughtful workspace for recruiting teams, candidates and the work between first application and final decision.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_20px_60px_rgba(0,0,0,.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#88a7c0]">Platform status</p>
                <p className="mt-2 text-sm font-semibold text-white">Check every service at a glance</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#41d2a0]/25 bg-[#41d2a0]/10 px-2.5 py-1 text-[10px] font-semibold text-[#73e2bd]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#41d2a0]" />
                Live status
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/recruit/status" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#102d46] transition hover:bg-[#e8f4fb]">
                View system status
                <ExternalArrow />
              </Link>
              <Link href="/recruit/preview" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Explore the product
                <ExternalArrow />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-10 border-b border-white/10 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="For recruiters" links={recruiterLinks} />
          <FooterColumn title="For job seekers" links={seekerLinks} />
          <FooterColumn title="Trust & billing" links={legalLinks} />
        </div>

        <div className="flex flex-col gap-5 py-7 text-xs text-[#88a7c0] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <p>© 2026 Rolebolt. All rights reserved.</p>
            <p>Built for clearer hiring and more confident job searches.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/recruit/status" className="transition-colors hover:text-white">System status</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            <a href="mailto:support@rolebolt.tech" className="transition-colors hover:text-white">Contact support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}