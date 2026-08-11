"use client";

import Link from "next/link";
import { useState } from "react";
import { SitegenHeader } from "../layout/SitegenHeader";
import { SitegenFooter } from "../layout/SitegenFooter";
import { sitegenProduct, sitegenSiteTypeLabels } from "../../config/product";
import type { SitegenSiteType } from "../../config/product";
import { sitegenRoutes } from "../../lib/routes";

const steps = [
  { number: "01", title: "Choose your path", copy: "Pick Job Seeker or Creator / Business — each path is tailored to your goals." },
  { number: "02", title: "Claim your username", copy: "Create your website with a username and password. Use those credentials to manage your site later." },
  { number: "03", title: "Add your information", copy: "Upload a resume or fill in your details manually. We keep it simple." },
  { number: "04", title: "AI structures your content", copy: "Our AI organizes your information into professional website sections — not arbitrary code." },
  { number: "05", title: "Publish instantly", copy: `Preview, pick a theme, and go live at ${sitegenProduct.publicUrlPattern.replace("{username}", "yourname")}.` },
];

const features = [
  { title: "Free to start", copy: "No payment, no subscription, no credit card. Build and publish for free." },
  { title: "No Rolebolt account", copy: "No account signup required. Create your website with a username and password to manage it later." },
  { title: "Template-first design", copy: "Professional themes built by us — predictable, beautiful, and secure." },
  { title: "AI-assisted content", copy: "AI understands your resume and polishes your content into structured sections." },
  { title: "Your own URL", copy: `Get a clean, memorable link: ${sitegenProduct.publicUrlPattern.replace("{username}", "yourname")}.` },
  { title: "Edit anytime", copy: "Use your username and password to return and update your website." },
];

const themes = [
  { name: "Seeker Classic", type: "Job Seeker", gradient: "from-sky-400 to-blue-600" },
  { name: "Seeker Modern", type: "Job Seeker", gradient: "from-emerald-400 to-teal-600" },
  { name: "Creator Business", type: "Creator / Business", gradient: "from-violet-400 to-purple-600" },
  { name: "Creator Studio", type: "Creator / Business", gradient: "from-amber-400 to-orange-500" },
];

const faqs = [
  {
    q: "Do I need to create a Rolebolt account?",
    a: "No account signup required. You create your website with a Sitegen username and password. Use those credentials to sign in, edit, preview, and publish your site later.",
  },
  {
    q: "Is it really free?",
    a: "Yes. There is no payment in V1. You can create, generate, and publish your website for free.",
  },
  {
    q: "What will my website URL look like?",
    a: `Your published site will be available at ${sitegenProduct.publicUrlPattern.replace("{username}", "yourusername")} — for example, ${sitegenProduct.publicUrlPattern.replace("{username}", "alex")} or ${sitegenProduct.publicUrlPattern.replace("{username}", "mycompany")}.`,
  },
  {
    q: "Does AI write the website code?",
    a: "No. AI only structures and polishes your information. The actual website comes from our professionally designed themes.",
  },
  {
    q: "Who is this for?",
    a: "Job Seekers who want a portfolio-style site, and Creators or Businesses who need a professional web presence — from solo consultants to growing companies.",
  },
];

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function PathCard({
  type,
  title,
  description,
  highlights,
}: {
  type: SitegenSiteType;
  title: string;
  description: string;
  highlights: string[];
}) {
  return (
    <Link
      href={sitegenRoutes.start(type)}
      className="group relative block w-full rounded-3xl border border-violet-200/20 bg-white/[0.04] p-7 text-left transition duration-300 hover:border-violet-300/40 hover:bg-white/[0.07] sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300/80">{sitegenSiteTypeLabels[type]}</p>
          <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-violet-100/60">{description}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-violet-200/70 transition group-hover:bg-violet-500 group-hover:text-white">
          <ArrowIcon />
        </span>
      </div>
      <ul className="mt-6 space-y-2">
        {highlights.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-violet-100/70">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm font-semibold text-violet-200">Continue →</p>
    </Link>
  );
}

export function SitegenLandingPage() {
  const [usernamePreview, setUsernamePreview] = useState("yourname");

  return (
    <div className="min-h-screen bg-[#0c0618] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute right-0 top-32 h-[420px] w-[420px] rounded-full bg-fuchsia-500/15 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-indigo-500/10 blur-[90px]" />
      </div>

      <div className="relative">
        <SitegenHeader />

        <main>
          {/* Hero */}
          <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
            <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Free · No account signup required
                </p>
                <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.04] tracking-[-0.06em] text-white sm:text-6xl lg:text-[4.25rem]">
                  Create your professional website — <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">free.</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-violet-100/65">
                  Choose Job Seeker or Creator, claim your username, and publish a polished site at{" "}
                  <span className="font-medium text-white">{sitegenProduct.publicUrlPattern}</span>.
                  AI helps structure your content — our themes make it beautiful.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={sitegenRoutes.start("seeker")}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#1a1033] shadow-[0_16px_50px_rgba(255,255,255,.14)] transition hover:bg-violet-50"
                  >
                    I&apos;m a Job Seeker
                    <ArrowIcon />
                  </Link>
                  <Link
                    href={sitegenRoutes.start("creator")}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                  >
                    I&apos;m a Creator / Business
                    <ArrowIcon />
                  </Link>
                </div>
                <p className="mt-5 text-sm text-violet-200/45">No payment. No Rolebolt account. Create your website with a username and password.</p>
              </div>

              {/* URL preview mockup */}
              <div className="relative">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_100px_rgba(0,0,0,.45)] backdrop-blur-sm sm:p-5">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#130a24] px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                    <div className="ml-3 flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-violet-100/70">
                      {sitegenProduct.hostDomain}/<span className="text-white">{usernamePreview || "yourname"}</span>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1033] to-[#2a1450]">
                    <div className="border-b border-white/10 px-5 py-8">
                      <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400" />
                      <div className="mx-auto mt-4 h-3 w-32 rounded-full bg-white/20" />
                      <div className="mx-auto mt-2 h-2.5 w-48 rounded-full bg-white/10" />
                    </div>
                    <div className="grid gap-3 p-5 sm:grid-cols-2">
                      {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="h-2 w-16 rounded-full bg-white/15" />
                          <div className="mt-3 h-2 w-full rounded-full bg-white/8" />
                          <div className="mt-2 h-2 w-4/5 rounded-full bg-white/8" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <label className="mt-4 block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/50">Preview your URL</span>
                    <input
                      type="text"
                      value={usernamePreview}
                      onChange={(event) => setUsernamePreview(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30))}
                      placeholder="yourname"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/50"
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Choose path */}
          <section id="choose-path" className="scroll-mt-24 border-y border-white/10 bg-white/[0.02] py-20 lg:py-28">
            <div className="mx-auto max-w-6xl px-5 lg:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Choose your path</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  Built for your story.
                </h2>
                <p className="mt-4 text-base leading-7 text-violet-100/60">
                  Whether you&apos;re landing your next role or growing your brand, Sitegen gives you a path that fits.
                </p>
              </div>
              <div className="mt-12 grid gap-5 lg:grid-cols-2">
                <PathCard
                  type="seeker"
                  title="Showcase your career"
                  description="Turn your resume and experience into a polished portfolio site that recruiters can discover."
                  highlights={["Resume upload or manual entry", "Experience, skills, and education sections", "2 professional seeker themes"]}
                />
                <PathCard
                  type="creator"
                  title="Grow your presence"
                  description="Launch a clean business or creator site — from solo consultants to startups and agencies."
                  highlights={["Flexible business information form", "Works for brands, agencies, and creators", "2 professional business themes"]}
                />
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="scroll-mt-24 py-20 lg:py-28">
            <div className="mx-auto max-w-6xl px-5 lg:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">How it works</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  From idea to live site in five steps.
                </h2>
              </div>
              <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {steps.map((step) => (
                  <article key={step.number} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <p className="font-display text-3xl font-semibold text-violet-400/40">{step.number}</p>
                    <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-violet-100/55">{step.copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="border-y border-white/10 bg-white/[0.02] py-20 lg:py-28">
            <div className="mx-auto max-w-6xl px-5 lg:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Why Sitegen</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  Simple, free, and professionally designed.
                </h2>
              </div>
              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature) => (
                  <article key={feature.title} className="rounded-2xl border border-white/10 bg-[#130a24]/50 p-6">
                    <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-violet-100/55">{feature.copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Themes */}
          <section id="themes" className="scroll-mt-24 py-20 lg:py-28">
            <div className="mx-auto max-w-6xl px-5 lg:px-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Themes</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  Four professionally designed themes.
                </h2>
                <p className="mt-4 text-base leading-7 text-violet-100/60">
                  Our themes are built in code — not generated by AI — so every site looks polished and loads fast.
                </p>
              </div>
              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {themes.map((theme) => (
                  <article key={theme.name} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className={`h-32 bg-gradient-to-br ${theme.gradient}`} />
                    <div className="p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/70">{theme.type}</p>
                      <h3 className="mt-2 font-semibold text-white">{theme.name}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Architecture callout */}
          <section className="border-y border-white/10 bg-gradient-to-r from-violet-950/50 to-fuchsia-950/30 py-16">
            <div className="mx-auto max-w-4xl px-5 text-center lg:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Template-first + AI-assisted</p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                AI makes your content smarter. Our themes make your site beautiful.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-violet-100/60">
                Your information goes through AI to become structured, professional content. The website itself is rendered from our pre-built themes — predictable design, better security, and faster performance.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-24 py-20 lg:py-28">
            <div className="mx-auto max-w-3xl px-5 lg:px-8">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">FAQ</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-white">
                  Common questions
                </h2>
              </div>
              <div className="mt-12 space-y-4">
                {faqs.map((item) => (
                  <details key={item.q} className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 open:bg-white/[0.05]">
                    <summary className="cursor-pointer list-none text-base font-semibold text-white marker:content-none">
                      <span className="flex items-center justify-between gap-4">
                        {item.q}
                        <span className="text-violet-300 transition group-open:rotate-45">+</span>
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-7 text-violet-100/60">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="pb-20 pt-8 lg:pb-28">
            <div className="mx-auto max-w-4xl px-5 lg:px-8">
              <div className="rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 px-8 py-14 text-center sm:px-12">
                <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  Ready to claim your URL?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-violet-100/70">
                  Pick your path and start building. Your professional website is minutes away.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href={sitegenRoutes.start("seeker")} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#1a1033] transition hover:bg-violet-50">
                    Get started free
                    <ArrowIcon />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <SitegenFooter />
      </div>
    </div>
  );
}
