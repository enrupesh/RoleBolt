import "./_group.css";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

const capabilities = [
  {
    number: "01",
    eyebrow: "Run the room",
    title: "A hiring command center that keeps the signal visible.",
    copy: "Job Health shows what is moving, what needs attention, and where a role is losing momentum. See the hiring timeline, live assessment progress, and next best action without opening six tabs.",
    image: "/__mockup/images/landing/dashboard.png",
    alt: "Rolebolt hiring dashboard showing active roles and candidate pipeline",
    accent: "bg-[#e7f0ff]",
  },
  {
    number: "02",
    eyebrow: "Make better calls",
    title: "A pipeline built for judgement, not just storage.",
    copy: "Bring in resumes in bulk, calibrate an AI rubric, compare candidates against the actual job, and use what-if simulation before you move someone forward. Review-zone actions and Autopilot rules take care of the repeatable work.",
    image: "/__mockup/images/landing/pipeline.png",
    alt: "Rolebolt applicant tracking pipeline with candidate fit scores",
    accent: "bg-[#f3edff]",
  },
  {
    number: "03",
    eyebrow: "Go structured",
    title: "Form jobs for the roles that need a little more context.",
    copy: "Build structured applications, score async assessments, and see an applicant timeline from first answer to final review. Form Copilot helps you shape questions that reveal how someone thinks.",
    image: "/__mockup/images/landing/form-jobs.png",
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

function Arrow() {
  return (
    <ArrowRight aria-hidden="true" className="h-4 w-4" />
  );
}

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8f3ff] text-[#0a66c2]">
      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
    </span>
  );
}

function Logo() {
  return <img src="/__mockup/images/landing/rolebolt-icon.png" alt="Rolebolt" className="h-8 w-8 rounded-xl object-contain shrink-0 shadow-[0_2px_8px_rgba(10,102,194,0.25)]" />;
}

export function Current() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fbfd] text-[#10263d]">
      <header className="sticky top-0 z-50 border-b border-[#dfe8ef]/80 bg-[#f8fbfd]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 lg:gap-4 lg:px-8 lg:py-4">
          <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="Rolebolt home">
            <Logo />
            <span className="font-display text-[15px] font-semibold tracking-[-0.03em]">Rolebolt</span>
          </a>
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0 min-[900px]:flex" aria-label="Primary navigation">
            <a href="#product" className="whitespace-nowrap rounded-lg px-1.5 py-2 text-[12px] text-[#5d7285] transition hover:bg-white hover:text-[#10263d] min-[1180px]:px-3 min-[1180px]:text-sm">Product</a>
            <a href="#how-it-works" className="whitespace-nowrap rounded-lg px-1.5 py-2 text-[12px] text-[#5d7285] transition hover:bg-white hover:text-[#10263d] min-[1180px]:px-3 min-[1180px]:text-sm">How it works</a>
            <a href="#recruiters" className="whitespace-nowrap rounded-lg px-1.5 py-2 text-[12px] text-[#5d7285] transition hover:bg-white hover:text-[#10263d] min-[1180px]:px-3 min-[1180px]:text-sm">For recruiters</a>
            <a href="#seekers" className="whitespace-nowrap rounded-lg px-1.5 py-2 text-[12px] text-[#5d7285] transition hover:bg-white hover:text-[#10263d] min-[1180px]:px-3 min-[1180px]:text-sm">For job seekers</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
            <button aria-label="Toggle navigation" onClick={() => setMenuOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d7e2eb] bg-white min-[900px]:hidden">
              {menuOpen ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#dfe8ef] bg-[#f8fbfd] px-5 py-3 min-[900px]:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              <a onClick={() => setMenuOpen(false)} href="#product" className="rounded-lg px-3 py-3 text-sm">Product</a>
              <a onClick={() => setMenuOpen(false)} href="#how-it-works" className="rounded-lg px-3 py-3 text-sm">How it works</a>
              <a onClick={() => setMenuOpen(false)} href="#recruiters" className="rounded-lg px-3 py-3 text-sm">For recruiters</a>
              <a onClick={() => setMenuOpen(false)} href="#seekers" className="rounded-lg px-3 py-3 text-sm">For job seekers</a>
            </div>
          </nav>
        )}
      </header>

      <main id="top">
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
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a href="#recruiters" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0a66c2] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,102,194,.18)] transition hover:-translate-y-0.5 hover:bg-[#07559f]">Build your hiring workspace <Arrow /></a>
                  <a href="#product" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbd9e4] bg-white px-5 py-3.5 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2] hover:text-[#0a66c2]">Explore open roles <Arrow /></a>
                </div>
                <p className="mt-4 text-xs text-[#7a8c9b]">Start with the entry plan. Upgrade when your workflow needs more.</p>
              </div>
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl bg-white/70 shadow-[0_22px_60px_rgba(34,72,104,.12)] ring-1 ring-[#d9e5ee]" />
                <div className="relative overflow-hidden rounded-2xl border border-[#d9e5ee] bg-white">
                  <div className="flex items-center justify-between border-b border-[#edf1f5] px-5 py-4">
                    <div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#8093a4]">Hiring command center</p><p className="mt-1 text-sm font-semibold">AI Backend Engineer</p></div>
                    <span className="rounded-full bg-[#e7f8f0] px-2.5 py-1 text-[10px] font-semibold text-[#188866]">Healthy</span>
                  </div>
                   <img src="/__mockup/images/landing/dashboard.png" alt="Rolebolt dashboard preview" width={1024} height={576} className="h-auto w-full object-cover" />
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
              <a href="#product" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#0a66c2] hover:gap-3 transition-all">Start building for your team <Arrow /></a>
            </div>
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {recruiterFeatures.map(([title, copy]) => <div key={title} className="flex gap-3"><Check /><div><h3 className="text-sm font-semibold text-[#203d56]">{title}</h3><p className="mt-1.5 text-sm leading-6 text-[#718496]">{copy}</p></div></div>)}
            </div>
          </div>
        </section>

        <section id="product" className="border-y border-[#dfe8ef] bg-white scroll-mt-20">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">The product, in practice</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">A more considered path from “we’re hiring” to “welcome aboard”.</h2>
              </div>
            </div>
            <div className="mt-14 space-y-20 lg:mt-20">
              {capabilities.map((item, index) => (
                <article key={item.number} className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${index % 2 ? "lg:[&>div:first-child]:order-2" : ""}`}>
                  <div><div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.16em] text-[#0a66c2]"><span>{item.number}</span><span className="h-px w-8 bg-[#a9c9e3]" />{item.eyebrow}</div><h3 className="mt-5 max-w-lg font-display text-3xl font-semibold leading-tight tracking-[-.05em] text-[#10263d]">{item.title}</h3><p className="mt-5 max-w-lg text-base leading-7 text-[#647a8d]">{item.copy}</p></div>
                   <div className={`rounded-2xl p-3 ${item.accent}`}><div className="overflow-hidden rounded-xl border border-white bg-white shadow-[0_14px_35px_rgba(33,71,103,.12)]"><img src={item.image} alt={item.alt} width={1024} height={576} className="h-auto w-full" /></div></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="seekers" className="scroll-mt-20 bg-[#eef6fb]">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-[1fr_1.08fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">For job seekers</p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.055em] text-[#10263d]">Your next role deserves more than a browser tab.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#5d7285]">Discover public opportunities, understand your match, and keep the whole search moving in one place — from resume and cover letter to interview preparation.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {seekerFeatures.map(([title, copy], index) => <div key={title} className={`rounded-2xl border border-[#d4e4ee] bg-white p-6 shadow-[0_8px_26px_rgba(32,79,112,.06)] ${index === 1 ? "sm:translate-y-8" : ""}`}><div className="mb-8 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e7f0ff] text-sm font-semibold text-[#0a66c2]">0{index + 1}</div><h3 className="text-sm font-semibold text-[#203d56]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#718496]">{copy}</p></div>)}
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Ready when your team is</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d] sm:text-5xl">Make the next hiring decision with the whole picture.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#667d8f]">Start with the tools that fit today. Rolebolt plans are designed to grow with your hiring volume, with payment-ready upgrades when you need them.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Current;