"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { RoleboltLogo } from "@/components/RoleboltLogo";

// ─── Data ────────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Dashboard", "AI Evaluation", "Analytics", "Candidate Experience"] as const;
type Category = (typeof CATEGORIES)[number];

interface Screenshot {
  src: string;
  title: string;
  desc: string;
  category: Exclude<Category, "All">;
  badge?: string;
}

const SCREENSHOTS: Screenshot[] = [
  {
    src: "/screenshots/create-new.png",
    title: "Create Something New",
    desc: "Choose between a Standard Job Post (full AI pipeline) or a Form Builder (custom intake form). Two hiring modes built for different team sizes.",
    category: "Dashboard",
    badge: "Dashboard",
  },
  {
    src: "/screenshots/job-create.png",
    title: "AI Job Posting Wizard",
    desc: "A guided 4-step wizard — Role Basics, Skills & Scope, Compensation, Review & Generate. The AI writes the full JD and scoring rubric automatically.",
    category: "Dashboard",
    badge: "Dashboard",
  },
  {
    src: "/screenshots/form-builder.png",
    title: "Form Builder",
    desc: "Drag-and-drop form builder with typed question fields (short answer, email, etc.), required toggles, and reordering. Share the link anywhere — AI scores every response.",
    category: "Dashboard",
    badge: "Dashboard",
  },
  {
    src: "/screenshots/dashboard.png",
    title: "Recruiter Dashboard",
    desc: "A unified command centre showing active roles, total candidates, shortlisted applicants, interview stage, and hires — all at a glance.",
    category: "Dashboard",
    badge: "Dashboard",
  },
  {
    src: "/screenshots/form-jobs.png",
    title: "Form Jobs",
    desc: "A lightweight hiring mode for small businesses. Collect applicants through custom intake forms — no full pipeline required.",
    category: "Dashboard",
    badge: "Dashboard",
  },
  {
    src: "/screenshots/pipeline.png",
    title: "AI-Scored Candidate Pipeline",
    desc: "Every applicant receives a 0–100 AI fit score the moment they apply. Confidence ratings and stage-based columns keep your pipeline organised.",
    category: "AI Evaluation",
    badge: "AI",
  },
  {
    src: "/screenshots/ai-scoring.png",
    title: "Deep Score Breakdown",
    desc: "Per-criterion scoring across Technical Skills, Experience Depth, Communication, Role Fit, and Cultural Ownership — with AI-written rationale for each.",
    category: "AI Evaluation",
    badge: "AI",
  },
  {
    src: "/screenshots/assessment.png",
    title: "AI Candidate Assessments",
    desc: "Role-specific written assessments generated and sent automatically. Candidates answer asynchronously; responses are scored and summarised by AI.",
    category: "AI Evaluation",
    badge: "AI",
  },
  {
    src: "/screenshots/analytics.png",
    title: "Recruiting Analytics",
    desc: "Pipeline funnel, stage distribution, source quality, and hiring outcomes visualised in one place. Make data-driven decisions, not gut calls.",
    category: "Analytics",
    badge: "Analytics",
  },
  {
    src: "/screenshots/candidate-browse.png",
    title: "Candidate Job Board",
    desc: "A clean jobs marketplace where candidates browse verified roles filtered by location, work mode, seniority, salary, and more.",
    category: "Candidate Experience",
    badge: "Candidate",
  },
  {
    src: "/screenshots/job-detail.png",
    title: "Job Listing Page",
    desc: "Full role overview with salary range, work mode, experience requirements, and a one-click apply flow. Salary always shown — no guessing.",
    category: "Candidate Experience",
    badge: "Candidate",
  },
  {
    src: "/screenshots/apply-form.png",
    title: "Multi-Step Apply Form",
    desc: "A guided, multi-step application wizard covering contact info, background, resume upload, and review — with auto-save at every step.",
    category: "Candidate Experience",
    badge: "Candidate",
  },
];

const BADGE_STYLES: Record<string, string> = {
  Dashboard: "bg-[#0a66c2]/10 text-[#0a66c2] border-[#0a66c2]/20",
  AI: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  Analytics: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  Candidate: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductPreviewPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [lightbox, setLightbox] = useState<Screenshot | null>(null);

  const filtered =
    activeCategory === "All"
      ? SCREENSHOTS
      : SCREENSHOTS.filter((s) => s.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5 shrink-0">
            <RoleboltLogo className="h-7 w-7" />
            <div className="leading-none">
              <p className="text-[14px] font-black text-slate-950 tracking-tight">Rolebolt</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Product Preview</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/recruit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-all"
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              Back to Home
            </Link>
            <Link
              href="/recruit/signup"
              className="inline-flex rounded-lg bg-[#0a66c2] px-3.5 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-[#004182] transition-all"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:56px_56px] pointer-events-none" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[900px] rounded-full bg-[#0a66c2]/18 blur-[100px] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20 sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/8 px-4 py-1.5 text-[11px] font-bold text-amber-300 mb-6">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Live Product Screenshots
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl leading-tight">
            See Rolebolt in action.
          </h1>
          <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-xl mx-auto">
            Real screenshots from the live platform — not mockups. Explore every feature that powers the next generation of AI hiring.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[12px] text-slate-500">
            {[
              { label: "12 screens", icon: "M4 6h16M4 10h16M4 14h16M4 18h7" },
              { label: "4 feature areas", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
              { label: "Click to enlarge", icon: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" },
            ].map(({ label, icon }) => (
              <span key={label} className="flex items-center gap-1.5">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={icon}/></svg>
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category filter ─────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 py-3 overflow-x-auto scrollbar-none">
            {CATEGORIES.map((cat) => {
              const count = cat === "All" ? SCREENSHOTS.length : SCREENSHOTS.filter(s => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                    activeCategory === cat
                      ? "bg-[#0a66c2] text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  {cat}
                  <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-bold ${
                    activeCategory === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((shot) => (
            <article
              key={shot.src}
              onClick={() => setLightbox(shot)}
              className="group cursor-zoom-in rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-[#0a66c2]/30 hover:-translate-y-1 transition-all duration-200"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <Image
                  src={shot.src}
                  alt={shot.title}
                  fill
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg text-slate-700">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  </div>
                </div>
              </div>

              {/* Caption */}
              <div className="p-5">
                {shot.badge && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide mb-3 ${BADGE_STYLES[shot.badge]}`}>
                    {shot.badge}
                  </span>
                )}
                <h2 className="text-[15px] font-bold text-slate-900 leading-snug">{shot.title}</h2>
                <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">{shot.desc}</p>
              </div>
            </article>
          ))}
        </div>

        {/* ── CTA strip ─────────────────────────────────────────────────────── */}
        <div className="mt-16 rounded-2xl bg-slate-950 px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[200px] w-[600px] rounded-full bg-[#0a66c2]/15 blur-[60px] pointer-events-none" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#60a5fa] mb-3">Ready to try it?</p>
            <h2 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
              Start hiring smarter — for free.
            </h2>
            <p className="mt-3 text-slate-400 text-sm max-w-sm mx-auto">
              No credit card. No time limit. Your first job post takes 90 seconds.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/recruit/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(10,102,194,0.45)] hover:bg-[#1d77d2] hover:-translate-y-0.5 transition-all"
              >
                Get started free
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
              <Link
                href="/recruit"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/6 px-7 py-3.5 text-sm font-medium text-white hover:bg-white/12 hover:-translate-y-0.5 transition-all"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightbox(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-5xl rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/60 text-white hover:bg-slate-950/80 transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>

            {/* Image */}
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              <Image
                src={lightbox.src}
                alt={lightbox.title}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1280px) 100vw, 1280px"
                priority
              />
            </div>

            {/* Caption bar */}
            <div className="flex items-start gap-4 border-t border-slate-100 bg-white px-6 py-4">
              {lightbox.badge && (
                <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide mt-0.5 ${BADGE_STYLES[lightbox.badge]}`}>
                  {lightbox.badge}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 leading-snug">{lightbox.title}</p>
                <p className="mt-0.5 text-[13px] text-slate-500 leading-relaxed">{lightbox.desc}</p>
              </div>
              <button
                onClick={() => setLightbox(null)}
                className="shrink-0 ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
