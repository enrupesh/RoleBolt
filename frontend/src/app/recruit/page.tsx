"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { SiteGuideChatbot } from "@/components/SiteGuideChatbot";
import { MarketingFooter } from "@/components/MarketingFooter";
import { SitegenHeroPromoCard, SitegenShowcaseSection } from "@/components/SitegenHomePromo";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { NewVisitorWelcomePopup } from "@/components/NewVisitorWelcomePopup";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";

const NAV_LINK_CLASS =
  "whitespace-nowrap rounded-lg px-1.5 py-2 text-[12px] font-medium text-[#5b3f8c] transition hover:bg-[#f6f0ff] hover:text-[#4a2f78] min-[1180px]:px-3 min-[1180px]:text-sm";
const NAV_LINK_MOBILE_CLASS =
  "rounded-lg px-3 py-3 text-sm font-medium text-[#5b3f8c] transition hover:bg-[#f6f0ff] hover:text-[#4a2f78]";

const capabilities = [
  {
    number: "01",
    eyebrow: "Run the room",
    title: "A hiring command center that keeps the signal visible.",
    copy: "Job Health shows what is moving, what needs attention, and where a role is losing momentum. See the hiring timeline, live assessment progress, and next best action without opening six tabs.",
    image: "/landing/recruitment-pipeline.png",
    alt: "Rolebolt recruitment pipeline workspace showing active roles and candidate signals",
    accent: "bg-[#e7f0ff]",
  },
  {
    number: "02",
    eyebrow: "Make better calls",
    title: "A pipeline built for judgement, not just storage.",
    copy: "Bring in resumes in bulk, calibrate an AI rubric, compare candidates against the actual job, and use what-if simulation before you move someone forward. Review-zone actions and Autopilot rules take care of the repeatable work.",
    image: "/landing/talent-pool.png",
    alt: "Rolebolt applicant tracking pipeline with candidate fit scores",
    accent: "bg-[#f3edff]",
  },
  {
    number: "03",
    eyebrow: "Go structured",
    title: "Form jobs for the roles that need a little more context.",
    copy: "Build structured applications, score async assessments, and see an applicant timeline from first answer to final review. Form Copilot helps you shape questions that reveal how someone thinks.",
    image: "/landing/form-jobs.png",
    alt: "Rolebolt form jobs workspace for structured applications",
    accent: "bg-[#e8f7f3]",
  },
];

const recruiterFeatures = [
  ["Job analysis & rubric", "Turn a job brief into clear, reviewable criteria."],
  ["Offers, without the scramble", "Draft, version, send and share a candidate signing link."],
  ["Collaboration in context", "Keep notes, decisions and feedback alongside the candidate."],
  ["Talent pool reuse", "Find strong people from past applications when a new role opens."],
  ["Analytics you can use", "Understand funnel movement, source quality and hiring pace."],
  ["AI Copilot", "Ask about a candidate, a role or your organisation and get grounded answers."],
];

const seekerFeatures = [
  ["Public opportunities", "Discover roles from teams that are actively hiring."],
  ["Candidate match", "See how your experience maps to a role before you apply."],
  ["A calmer application flow", "Save progress, submit structured answers and track every update."],
  ["Your job-search workspace", "Keep applications, resumes, cover letters and interview prep together."],
];

const workflowSteps = [
  ["01", "Shape the role", "Start with a standard job or a structured form job. Use job analysis, a review rubric and clear criteria before you publish."],
  ["02", "Bring in the signal", "Share a public opportunity, invite applications or import resumes in bulk. Rolebolt keeps every profile and answer connected to the role."],
  ["03", "Review with context", "Use fit signals, assessments, applicant timelines, collaboration and What-If simulation to decide where human attention matters most."],
  ["04", "Move the work forward", "Let Autopilot and pipeline rules handle repeatable actions, then collaborate, send an offer, and keep the hiring timeline clear."],
];

const nicheCards = [
  ["Technology & product", "Engineering, data, AI, product and design teams.", "bg-[#e9f2ff]"],
  ["Sales & growth", "Revenue, business development, marketing and customer teams.", "bg-[#eaf8f2]"],
  ["Finance & fintech", "Accounting, finance, banking and operations roles.", "bg-[#fff5df]"],
  ["Healthcare & pharma", "Clinical, allied health and life-science hiring.", "bg-[#fff0f3]"],
  ["Operations & logistics", "Field, skilled, blue-collar and industrial workforces.", "bg-[#fff1e8]"],
  ["Professional services", "Consulting, legal, research and specialist teams.", "bg-[#f2edff]"],
];

const comparisonRows = [
  ["Standard job pipeline", true, true],
  ["Structured form jobs", true, false],
  ["Rubric-based candidate review", true, false],
  ["Async assessments and live progress", true, false],
  ["Pipeline rules and Autopilot actions", true, false],
  ["Offer versions and candidate signing link", true, false],
  ["Candidate workspace with job-search tools", true, false],
];

function Arrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8f3ff] text-[#0a66c2]">
      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
    </span>
  );
}

export default function RecruitLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { authUser, recruitProfile, loading, signOutFromRecruit } = useRecruitAuth();
  const isLoggedIn = Boolean(authUser && recruitProfile);

  useEffect(() => {
    if (!loading && isLoggedIn) router.replace("/recruit/dashboard");
  }, [loading, isLoggedIn, router]);

  async function signOut() {
    try {
      await signOutFromRecruit();
    } finally {
      router.replace("/recruit/login");
    }
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#f8fbfd] text-[#10263d]">
      <header className="sticky top-0 z-50 border-b border-[#dfe8ef]/80 bg-[#f8fbfd]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 lg:gap-4 lg:px-8 lg:py-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Rolebolt home">
            <RoleboltLogo size="md" />
            <span className="font-display text-[15px] font-semibold tracking-[-0.03em]">Rolebolt</span>
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0 min-[900px]:flex" aria-label="Primary navigation">
            <Link href="/recruit/opportunities" className={NAV_LINK_CLASS}>Find jobs</Link>
            <a href="#how-it-works" className={NAV_LINK_CLASS}>How it works</a>
            <a href="#recruiters" className={NAV_LINK_CLASS}>For recruiters</a>
            <a href="#seekers" className={NAV_LINK_CLASS}>For job seekers</a>
            <Link href="/recruit/pricing" className={NAV_LINK_CLASS}>Plans</Link>
            <Link href="/resources" className={NAV_LINK_CLASS}>Guides</Link>
            <Link href="/website" className={NAV_LINK_CLASS}>Free website</Link>
            <Link href="/reviews" className={NAV_LINK_CLASS}>Reviews</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
            {isLoggedIn ? (
              <>
                <Link href="/recruit/dashboard" className="hidden rounded-lg border border-[#d7e2eb] bg-white px-2.5 py-2 text-[12px] font-medium text-[#38546d] transition hover:border-[#0a66c2] sm:inline-flex min-[1180px]:px-3.5 min-[1180px]:text-sm">Dashboard</Link>
                <button onClick={signOut} className="hidden rounded-lg px-2.5 py-2 text-[12px] text-[#6e8193] transition hover:bg-white sm:inline-flex min-[1180px]:px-3.5 min-[1180px]:text-sm">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/recruit/login" className="hidden whitespace-nowrap px-2 py-2 text-[12px] font-medium text-[#38546d] sm:inline-flex min-[1180px]:px-3.5 min-[1180px]:text-sm">Sign in</Link>
                <Link href="/recruit/signup" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0a66c2] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_5px_16px_rgba(10,102,194,.18)] transition hover:-translate-y-0.5 hover:bg-[#07559f] min-[1180px]:gap-2 min-[1180px]:px-4 min-[1180px]:py-2.5 min-[1180px]:text-sm">Get started <Arrow /></Link>
              </>
            )}
            <button aria-label="Toggle navigation" onClick={() => setMenuOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d7e2eb] bg-white min-[900px]:hidden">
              {menuOpen ? (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              ) : (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#dfe8ef] bg-[#f8fbfd] px-5 py-3 min-[900px]:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              <Link onClick={() => setMenuOpen(false)} href="/recruit/opportunities" className={NAV_LINK_MOBILE_CLASS}>Find jobs</Link>
              <a onClick={() => setMenuOpen(false)} href="#how-it-works" className={NAV_LINK_MOBILE_CLASS}>How it works</a>
              <a onClick={() => setMenuOpen(false)} href="#recruiters" className={NAV_LINK_MOBILE_CLASS}>For recruiters</a>
              <a onClick={() => setMenuOpen(false)} href="#seekers" className={NAV_LINK_MOBILE_CLASS}>For job seekers</a>
              <Link onClick={() => setMenuOpen(false)} href="/recruit/pricing" className={NAV_LINK_MOBILE_CLASS}>Plans</Link>
              <Link onClick={() => setMenuOpen(false)} href="/resources" className={NAV_LINK_MOBILE_CLASS}>Guides</Link>
              <Link onClick={() => setMenuOpen(false)} href="/website" className={NAV_LINK_MOBILE_CLASS}>Free website</Link>
              <Link onClick={() => setMenuOpen(false)} href="/reviews" className={NAV_LINK_MOBILE_CLASS}>Reviews</Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#dfe8ef]">
          <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#d9ecff] blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-[#e7e1ff] blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-20 lg:px-8 lg:pb-24 lg:pt-28">
            <div className="grid items-center gap-12 min-[900px]:grid-cols-[1fr_0.92fr] min-[900px]:gap-14 lg:gap-20">
              <div>
                <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cbddea] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#3873a5]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2bb58a]" /> AI hiring workspace
                </p>
                <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.03] tracking-[-0.065em] text-[#10263d] sm:text-6xl lg:text-[4.75rem]">
                  Better hiring starts with a clearer view.
                </h1>
                <p className="mt-7 max-w-xl text-lg leading-8 text-[#5d7285]">
                  Rolebolt brings jobs, applications, candidate assessment, hiring automation and job search into one thoughtful workspace — for teams and the people they hope to meet.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link href="/recruit/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0a66c2] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,102,194,.18)] transition hover:-translate-y-0.5 hover:bg-[#07559f]">Build your hiring workspace <Arrow /></Link>
                  <Link href="/recruit/opportunities" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbd9e4] bg-white px-5 py-3.5 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2] hover:text-[#0a66c2]">Explore open roles <Arrow /></Link>
                </div>
                <div className="mt-6">
                  <SitegenHeroPromoCard />
                </div>
                <Link href="/recruit/preview" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0a66c2] transition hover:text-[#07559f]">See the product preview <Arrow /></Link>
                <p className="mt-3 text-xs text-[#7a8c9b]">Start with the entry plan. Upgrade when your workflow needs more.</p>
              </div>
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl bg-white/70 shadow-[0_22px_60px_rgba(34,72,104,.12)] ring-1 ring-[#d9e5ee]" />
                <div className="relative overflow-hidden rounded-2xl border border-[#d9e5ee] bg-white">
                  <div className="flex items-center justify-between border-b border-[#edf1f5] px-5 py-4">
                    <div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#8093a4]">Hiring command center</p><p className="mt-1 text-sm font-semibold">AI Backend Engineer</p></div>
                    <span className="rounded-full bg-[#e7f8f0] px-2.5 py-1 text-[10px] font-semibold text-[#188866]">Healthy</span>
                  </div>
                   <Image src="/landing/recruitment-pipeline.png" alt="Rolebolt recruitment pipeline dashboard preview" width={1921} height={1082} priority loading="eager" className="h-auto w-full object-cover" />
                  <div className="grid grid-cols-3 divide-x border-t border-[#edf1f5] bg-[#fbfcfd]">
                    <div className="px-4 py-4"><p className="text-xl font-semibold text-[#10263d]">11</p><p className="text-[10px] text-[#8093a4]">candidates</p></div>
                    <div className="px-4 py-4"><p className="text-xl font-semibold text-[#10263d]">4</p><p className="text-[10px] text-[#8093a4]">shortlisted</p></div>
                    <div className="px-4 py-4"><p className="text-xl font-semibold text-[#10263d]">2d</p><p className="text-[10px] text-[#8093a4]">next action</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SitegenShowcaseSection />

        <section id="how-it-works" className="border-b border-[#dfe8ef] bg-[#f8fbfd] scroll-mt-20">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">How it works</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">A clear path from first brief to next step.</h2>
              <p className="mt-5 text-base leading-7 text-[#647a8d]">Rolebolt keeps the workflow connected, so your team can spend less time moving information between tools and more time making thoughtful decisions.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map(([number, title, copy]) => (
                <article key={number} className="rounded-2xl border border-[#d9e5ee] bg-white p-6 shadow-[0_8px_24px_rgba(32,79,112,.05)]">
                  <p className="font-display text-3xl font-semibold tracking-[-.06em] text-[#b4d2ea]">{number}</p>
                  <h3 className="mt-7 text-sm font-semibold text-[#203d56]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#718496]">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="recruiters" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[.72fr_1fr] lg:gap-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">For recruiting teams</p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.055em] text-[#10263d]">The applicant tracking system that shows the work behind the work.</h2>
              <p className="mt-5 text-base leading-7 text-[#5d7285]">Use standard jobs for a familiar pipeline, or form jobs when structured applications are the better signal. Rolebolt gives your team the context to move with care and confidence.</p>
              <Link href="/recruit/signup" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#0a66c2] hover:gap-3 transition-all">Start building for your team <Arrow /></Link>
            </div>
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {recruiterFeatures.map(([title, copy]) => <div key={title} className="flex gap-3"><Check /><div><h3 className="text-sm font-semibold text-[#203d56]">{title}</h3><p className="mt-1.5 text-sm leading-6 text-[#718496]">{copy}</p></div></div>)}
            </div>
          </div>
        </section>

        <section id="product" className="border-y border-[#dfe8ef] bg-white scroll-mt-20">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">The product, in practice</p><h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">A more considered path from “we’re hiring” to “welcome aboard”.</h2></div></div>
            <div className="mt-14 space-y-20 lg:mt-20">
              {capabilities.map((item, index) => (
                <article key={item.number} className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${index % 2 ? "lg:[&>div:first-child]:order-2" : ""}`}>
                  <div><div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.16em] text-[#0a66c2]"><span>{item.number}</span><span className="h-px w-8 bg-[#a9c9e3]" />{item.eyebrow}</div><h3 className="mt-5 max-w-lg font-display text-3xl font-semibold leading-tight tracking-[-.05em] text-[#10263d]">{item.title}</h3><p className="mt-5 max-w-lg text-base leading-7 text-[#647a8d]">{item.copy}</p></div>
                  <div className={`rounded-2xl p-3 ${item.accent}`}><div className="overflow-hidden rounded-xl border border-white bg-white shadow-[0_14px_35px_rgba(33,71,103,.12)]"><Image src={item.image} alt={item.alt} width={1024} height={576} loading="lazy" className="h-auto w-full" /></div></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className="border-b border-[#dfe8ef] bg-white scroll-mt-20">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Built for the work you do</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">Useful across teams, not just one kind of role.</h2>
                <p className="mt-5 text-base leading-7 text-[#647a8d]">Use focused role context and review criteria across the markets where hiring quality matters.</p>
              </div>
              <Link href="/recruit/opportunities" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#0a66c2] hover:gap-3 transition-all">Browse open roles <Arrow /></Link>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {nicheCards.map(([title, copy, accent]) => (
                <Link key={title} href="/recruit/opportunities" className={`rounded-2xl border border-[#d9e5ee] ${accent} p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(32,79,112,.1)]`}>
                  <h3 className="text-sm font-semibold text-[#203d56]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#718496]">{copy}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#0a66c2]">Explore opportunities <Arrow /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

         <section id="seekers" className="scroll-mt-20 bg-[#eef6fb]">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-[1fr_1.08fr] lg:px-8">
            <div><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">For job seekers</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.055em] text-[#10263d]">Your next role deserves more than a browser tab.</h2><p className="mt-5 max-w-xl text-base leading-7 text-[#5d7285]">Discover public opportunities, understand your match, and keep the whole search moving in one place — from resume and cover letter to interview preparation.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/recruit/opportunities" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#10263d] px-5 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1d405c]">Find your next opportunity <Arrow /></Link><Link href="/seeker/workspace" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbd9e4] bg-white px-5 py-3.5 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2]">Open your workspace <Arrow /></Link></div><Link href="/website" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#5b3f8c] transition hover:text-[#4a2f78]">Or build a free portfolio website with Sitegen <Arrow /></Link></div>
            <div className="grid gap-4 sm:grid-cols-2">{seekerFeatures.map(([title, copy], index) => <div key={title} className={`rounded-2xl border border-[#d4e4ee] bg-white p-6 shadow-[0_8px_26px_rgba(32,79,112,.06)] ${index === 1 ? "sm:translate-y-8" : ""}`}><div className="mb-8 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e7f0ff] text-sm font-semibold text-[#0a66c2]">0{index + 1}</div><h3 className="text-sm font-semibold text-[#203d56]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#718496]">{copy}</p></div>)}</div>
          </div>
        </section>

         <section id="human-layer" className="border-b border-[#dfe8ef] bg-white scroll-mt-20">
           <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
             <div className="grid items-stretch gap-5 lg:grid-cols-[1.12fr_.88fr]">
               <div className="relative min-h-[380px] overflow-hidden rounded-3xl bg-[#10263d] p-8 text-white sm:p-12">
                 <Image
                   src="/landing/team-collaboration.jpg"
                   alt="Hiring team collaborating around a table"
                   fill
                   className="object-cover opacity-30 mix-blend-screen"
                   sizes="(max-width: 1024px) 100vw, 60vw"
                 />
                 <div className="relative flex h-full max-w-xl flex-col justify-between">
                   <div>
                     <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#8ec7f7]">The human layer</p>
                     <h2 className="mt-8 font-display text-4xl font-semibold leading-tight tracking-[-.055em] text-white sm:text-5xl">
                       Hiring is a conversation. Give it somewhere to land.
                     </h2>
                     <p className="mt-5 max-w-lg text-base leading-7 text-[#c7d8e5]">
                       Rolebolt keeps the context close to the people making the decision — so collaboration feels clear, timely and considered instead of scattered across tabs.
                     </p>
                   </div>
                   <Link href="/about" className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white transition hover:gap-3">
                     Why we built Rolebolt <Arrow />
                   </Link>
                 </div>
               </div>
               <div className="relative min-h-[380px] overflow-hidden rounded-3xl border border-[#d9e5ee] bg-[#f8fbfd]">
                 <Image
                   src="/landing/interview.jpg"
                   alt="Professional interview conversation"
                   fill
                   className="object-cover"
                   sizes="(max-width: 1024px) 100vw, 40vw"
                 />
                 <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#10263d]/90 via-[#10263d]/35 to-transparent p-7 pt-28 text-white sm:p-9 sm:pt-32">
                   <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#b7dcfb]">For every next step</p>
                   <p className="mt-3 max-w-sm text-xl font-semibold leading-snug">Candidates deserve a process they can understand, too.</p>
                   <Link href="/seeker" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:gap-3">
                     Explore the candidate workspace <Arrow />
                   </Link>
                 </div>
               </div>
             </div>
           </div>
         </section>

        <section id="ai-copilot" className="border-b border-[#dfe8ef] bg-[#10263d] scroll-mt-20">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#8ec7f7]">A useful copilot</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.055em] text-white">Ask the work. Keep the judgement.</h2><p className="mt-5 text-base leading-7 text-[#b7c9d8]">Rolebolt Copilot works across your jobs, candidates, resumes and assessments. Ask for a comparison, an interview brief or a missing skill — then verify the answer in context.</p></div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/95 shadow-[0_18px_50px_rgba(0,0,0,.18)]"><Image src="/screenshots/ai-copilot-rolebolt.png" alt="Rolebolt AI Copilot showing candidate context and prompts" width={1024} height={576} loading="lazy" className="h-auto w-full" /></div>
          </div>
        </section>

        <section id="why-rolebolt" className="border-b border-[#dfe8ef] bg-white scroll-mt-20">
          <div className="mx-auto max-w-4xl px-5 py-24 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Why Rolebolt</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">One workspace for the decisions that matter.</h2>
              <p className="mt-5 text-base leading-7 text-[#647a8d]">Instead of stitching together a job board, form builder, spreadsheet, assessment tool and offer workflow, keep the context with the candidate and the role.</p>
            </div>
            <div className="mt-12 overflow-hidden rounded-2xl border border-[#d9e5ee] shadow-[0_14px_35px_rgba(33,71,103,.08)]">
              <div className="grid grid-cols-[1fr_72px_72px] border-b border-[#dfe8ef] bg-[#f8fbfd] px-5 py-4 text-[11px] font-semibold uppercase tracking-[.12em] text-[#718496] sm:grid-cols-[1fr_100px_100px]">
                <span>Capability</span><span className="text-center text-[#0a66c2]">Rolebolt</span><span className="text-center">Separate tools</span>
              </div>
              {comparisonRows.map(([label, rolebolt, separate], index) => (
                <div key={label as string} className={`grid grid-cols-[1fr_72px_72px] items-center px-5 py-4 text-sm sm:grid-cols-[1fr_100px_100px] ${index < comparisonRows.length - 1 ? "border-b border-[#edf1f5]" : ""}`}>
                  <span className="font-medium text-[#38546d]">{label}</span>
                  <span className="flex justify-center text-[#188866]">{rolebolt ? "✓" : "—"}</span>
                  <span className="flex justify-center text-[#9badba]">{separate ? "✓" : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="bg-[#f8fbfd] scroll-mt-20">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-[.75fr_1fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Built with care</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">Hiring is human work. The software should respect that.</h2>
            </div>
            <div className="rounded-2xl border border-[#d9e5ee] bg-white p-7 shadow-[0_8px_26px_rgba(32,79,112,.06)]">
              <p className="text-base leading-7 text-[#5d7285]">Rolebolt is being built by a small product team focused on making hiring more legible for both sides of the market: teams need better signals, and candidates deserve a clearer path through the process.</p>
              <div className="mt-7 flex items-center gap-3 border-t border-[#edf1f5] pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e7f0ff] text-sm font-semibold text-[#0a66c2]">RG</div>
                <div><p className="text-sm font-semibold text-[#203d56]">Rupesh Gupta</p><p className="text-xs text-[#8093a4]">Founder</p></div>
              </div>
            </div>
          </div>
        </section>

         <section className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center lg:px-8"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Ready when your team is</p><h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d] sm:text-5xl">Make the next hiring decision with the whole picture.</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#667d8f]">Start with the tools that fit today. Rolebolt plans are designed to grow with your hiring volume, with payment-ready upgrades when you need them.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/recruit/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0a66c2] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#07559f]">Start building <Arrow /></Link><Link href="/recruit/opportunities" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbd9e4] px-6 py-3.5 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2]">Browse opportunities <Arrow /></Link></div></div>
        </section>
        <FeaturedReviews />
      </main>

      <MarketingFooter />
      <SiteGuideChatbot />
      <NewVisitorWelcomePopup disabled={isLoggedIn} />
    </div>
  );
}