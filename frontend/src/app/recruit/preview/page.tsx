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

// ─── Architecture diagram helpers ────────────────────────────────────────────

function ArchNode({
  icon,
  label,
  sublabel,
  color,
  borderColor,
  highlight,
}: {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  borderColor?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`w-full rounded-xl px-4 py-3 flex items-center gap-3 border ${borderColor ?? "border-transparent"} ${color} ${
        highlight ? "ring-2 ring-violet-400 ring-offset-2 shadow-lg" : ""
      }`}
    >
      {icon && <span className="shrink-0 opacity-90">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-snug">{label}</p>
        {sublabel && <p className="text-[11px] opacity-70 mt-0.5 truncate">{sublabel}</p>}
      </div>
    </div>
  );
}

function ArchArrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center my-1 w-full">
      <div className="h-3 w-px bg-slate-200" />
      {label && (
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-300 my-0.5">
          {label}
        </span>
      )}
      <svg width="10" height="10" fill="currentColor" className="text-slate-300" viewBox="0 0 10 10">
        <polygon points="5,0 10,10 0,10" />
      </svg>
    </div>
  );
}

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

        {/* ── How Mesh API Powers Rolebolt ─────────────────────────────────── */}
        <div className="mt-24">
          {/* Header */}
          <div className="max-w-2xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0a66c2]/30 bg-[#0a66c2]/8 px-4 py-1.5 text-[11px] font-bold text-[#0a66c2] mb-5 uppercase tracking-widest">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              Powered by Mesh API
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl leading-tight">
              How Mesh API powers Rolebolt
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed max-w-lg mx-auto">
              Every AI capability in Rolebolt is routed through Mesh API — giving us access to 1,000+ models with automatic fallback chains, so hiring never stops even when a single provider has issues.
            </p>
          </div>

          {/* Model badge */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
            {[
              { label: "Primary", model: "GPT-4o mini", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
              { label: "Fallback 1", model: "Claude 3 Haiku", color: "bg-violet-50 border-violet-200 text-violet-700" },
              { label: "Fallback 2", model: "Gemini 2.5 Flash Lite", color: "bg-blue-50 border-blue-200 text-blue-700" },
            ].map((m) => (
              <span key={m.model} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold ${m.color}`}>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">{m.label}</span>
                <span className="h-3 w-px bg-current opacity-20" />
                {m.model}
              </span>
            ))}
          </div>

          {/* Workflow cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: (
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                ),
                title: "AI Resume Analysis",
                desc: "When a candidate applies, Mesh API parses the uploaded PDF/DOCX resume and extracts structured signals: skills, experience depth, career trajectory, and role alignment — all in seconds.",
                model: "openai/gpt-4o-mini",
                accentColor: "text-[#0a66c2]",
                accentBg: "bg-blue-50 border-blue-100",
                badge: "Application pipeline",
              },
              {
                icon: (
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                ),
                title: "AI Candidate Scoring",
                desc: "Every applicant receives a 0–100 AI fit score broken down across 5 weighted criteria: Technical Skills, Experience Depth, Communication, Role Fit, and Cultural Ownership — with written rationale for each.",
                model: "openai/gpt-4o-mini",
                accentColor: "text-amber-500",
                accentBg: "bg-amber-50 border-amber-100",
                badge: "AI Evaluation",
              },
              {
                icon: (
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                ),
                title: "AI Candidate Matching",
                desc: "Rolebolt cross-references each candidate's full profile — resume, background, and self-reported experience — against the job's scoring rubric to produce a precise match signal.",
                model: "openai/gpt-4o-mini",
                accentColor: "text-emerald-600",
                accentBg: "bg-emerald-50 border-emerald-100",
                badge: "Matching engine",
              },
              {
                icon: (
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                ),
                title: "AI Job Description Generation",
                desc: "A 4-step wizard collects the role basics, and Mesh API generates a full job description — including requirements, responsibilities, and a custom scoring rubric — ready to publish instantly.",
                model: "openai/gpt-4o-mini",
                accentColor: "text-violet-600",
                accentBg: "bg-violet-50 border-violet-100",
                badge: "Job creation",
              },
              {
                icon: (
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                ),
                title: "AI Recruitment Assistant",
                desc: "Recruiters can ask natural-language questions about their pipeline — 'Who are my top 3 candidates for this role?' or 'Summarise this applicant's background' — and get instant AI answers.",
                model: "openai/gpt-4o-mini",
                accentColor: "text-rose-500",
                accentBg: "bg-rose-50 border-rose-100",
                badge: "Recruiter tools",
              },
              {
                icon: (
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                ),
                title: "AI Form Response Scoring",
                desc: "When candidates submit custom intake forms, Mesh API scores each answer against the form's criteria — giving small businesses the same AI evaluation power as the full pipeline, without requiring a resume.",
                model: "openai/gpt-4o-mini",
                accentColor: "text-indigo-600",
                accentBg: "bg-indigo-50 border-indigo-100",
                badge: "Form jobs",
              },
            ].map((wf) => (
              <div key={wf.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
                {/* Icon */}
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${wf.accentBg} ${wf.accentColor}`}>
                  {wf.icon}
                </div>
                {/* Badge */}
                <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 w-fit">
                  {wf.badge}
                </span>
                <h3 className="text-[15px] font-bold text-slate-900 leading-snug mb-2">{wf.title}</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed flex-1">{wf.desc}</p>
                {/* Model chip */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  <span className="text-[11px] font-mono text-slate-400">{wf.model}</span>
                  <span className="ml-auto text-[10px] text-slate-300 font-medium">+ 2 fallbacks</span>
                </div>
              </div>
            ))}
          </div>

          {/* Fallback explanation strip */}
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-emerald-500">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-slate-800">Automatic fallback chain on every AI call</p>
              <p className="text-[12px] text-slate-500 mt-0.5">If GPT-4o mini is unavailable or rate-limited, Mesh API automatically retries with Claude 3 Haiku, then Gemini 2.5 Flash Lite — so AI scoring never blocks a candidate&apos;s application.</p>
            </div>
          </div>
        </div>

        {/* ── Architecture / System Flow ────────────────────────────────────── */}
        <div className="mt-24">
          {/* Header */}
          <div className="max-w-2xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-4 py-1.5 text-[11px] font-bold text-slate-500 mb-5 uppercase tracking-widest">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
              System Architecture
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl leading-tight">
              How it all fits together
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed max-w-lg mx-auto">
              A request from a hiring manager or a candidate touches multiple layers — here&apos;s how data flows through the full stack in under 3 seconds.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Diagram area */}
            <div className="p-8 sm:p-10 lg:p-12">

              {/* ── Desktop layout (lg+): two columns ── */}
              <div className="hidden lg:flex items-start gap-6">

                {/* Left column: Main request flow */}
                <div className="flex-1 flex flex-col items-center gap-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Request flow</div>

                  {/* User */}
                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                    label="Recruiter / Candidate"
                    sublabel="Web browser"
                    color="bg-slate-800 text-white"
                    borderColor="border-slate-700"
                  />
                  <ArchArrow label="HTTPS request" />

                  {/* Firebase Auth */}
                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                    label="Firebase Auth"
                    sublabel="JWT session"
                    color="bg-amber-500 text-white"
                    borderColor="border-amber-400"
                  />
                  <ArchArrow label="Verified token" />

                  {/* Frontend */}
                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}
                    label="Next.js Frontend"
                    sublabel="Rolebolt UI · Port 5000"
                    color="bg-[#0a66c2] text-white"
                    borderColor="border-[#004182]"
                  />
                  <ArchArrow label="REST API call" />

                  {/* Backend */}
                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>}
                    label="Express Backend"
                    sublabel="Node.js · Port 8080"
                    color="bg-slate-700 text-white"
                    borderColor="border-slate-600"
                  />
                  <ArchArrow label="AI workflow triggered" />

                  {/* Mesh API */}
                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
                    label="Mesh API"
                    sublabel="api.meshapi.ai · 1,000+ models"
                    color="bg-violet-600 text-white"
                    borderColor="border-violet-500"
                    highlight
                  />
                  <ArchArrow label="Model routing" />

                  {/* AI Models */}
                  <div className="flex items-center gap-3 w-full justify-center">
                    {[
                      { name: "GPT-4o mini", tag: "Primary", color: "border-emerald-300 bg-emerald-50 text-emerald-800" },
                      { name: "Claude 3 Haiku", tag: "Fallback 1", color: "border-violet-300 bg-violet-50 text-violet-800" },
                      { name: "Gemini Flash", tag: "Fallback 2", color: "border-blue-300 bg-blue-50 text-blue-800" },
                    ].map((m) => (
                      <div key={m.name} className={`rounded-xl border ${m.color} px-3 py-2.5 text-center flex-1`}>
                        <p className="text-[9px] font-bold uppercase tracking-wider opacity-50 mb-0.5">{m.tag}</p>
                        <p className="text-[12px] font-bold leading-tight">{m.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px self-stretch bg-slate-100 mt-8" />

                {/* Right column: Data & storage */}
                <div className="w-56 flex flex-col items-center gap-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Data layer</div>

                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>}
                    label="MongoDB Atlas"
                    sublabel="Jobs · Candidates · Forms"
                    color="bg-emerald-600 text-white"
                    borderColor="border-emerald-500"
                  />

                  <div className="flex flex-col items-center my-2 gap-0.5">
                    <div className="h-3 w-px bg-slate-200" />
                    <svg width="10" height="10" fill="currentColor" className="text-slate-300" viewBox="0 0 10 10"><polygon points="5,0 10,10 0,10"/></svg>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 w-full text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Stored entities</p>
                    {["RecruitJob", "RecruitCandidate", "RecruitForm", "RecruitFormResponse", "RecruitProfile"].map((e) => (
                      <p key={e} className="text-[11px] font-mono text-slate-500 py-0.5 border-b border-slate-100 last:border-0">{e}</p>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 w-full text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1.5">Firebase Admin</p>
                    <p className="text-[11px] text-amber-700">Token verification on every protected API route</p>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 w-full text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email</p>
                    <p className="text-[11px] text-slate-500">Assessment delivery &amp; candidate notifications via Nodemailer</p>
                  </div>
                </div>
              </div>

              {/* ── Mobile / tablet layout: single column simplified ── */}
              <div className="flex lg:hidden flex-col items-center gap-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-5">Full system flow</div>

                {[
                  { label: "User (Browser)", sub: "Recruiter or Candidate", bg: "bg-slate-800 text-white" },
                  { label: "Firebase Auth", sub: "JWT session validation", bg: "bg-amber-500 text-white" },
                  { label: "Next.js Frontend", sub: "Rolebolt UI · Port 5000", bg: "bg-[#0a66c2] text-white" },
                  { label: "Express Backend", sub: "Node.js API · Port 8080", bg: "bg-slate-700 text-white" },
                  { label: "MongoDB Atlas", sub: "Jobs, Candidates, Forms", bg: "bg-emerald-600 text-white" },
                  { label: "Mesh API", sub: "Model router · 1,000+ models", bg: "bg-violet-600 text-white", highlight: true },
                  { label: "AI Models", sub: "GPT-4o mini → Claude 3 Haiku → Gemini Flash", bg: "bg-slate-100 text-slate-700" },
                ].map((node, i, arr) => (
                  <div key={node.label} className="flex flex-col items-center w-full max-w-xs">
                    <div className={`w-full rounded-xl px-4 py-3 text-center ${node.bg} ${node.highlight ? "ring-2 ring-violet-400 ring-offset-2" : ""}`}>
                      <p className="text-[13px] font-bold leading-snug">{node.label}</p>
                      <p className="text-[11px] opacity-70 mt-0.5">{node.sub}</p>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex flex-col items-center my-1">
                        <div className="h-4 w-px bg-slate-200" />
                        <svg width="10" height="10" fill="currentColor" className="text-slate-300" viewBox="0 0 10 10"><polygon points="5,0 10,10 0,10"/></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer legend */}
            <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                { color: "bg-[#0a66c2]", label: "Frontend (Next.js)" },
                { color: "bg-slate-700", label: "Backend (Express / Node)" },
                { color: "bg-violet-600", label: "Mesh API (AI gateway)" },
                { color: "bg-emerald-600", label: "MongoDB (persistence)" },
                { color: "bg-amber-500", label: "Firebase (auth)" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Previous Work — VeilChat ──────────────────────────────────────── */}
        <div className="mt-20">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-4 py-1.5 text-[11px] font-bold text-slate-500 mb-5 uppercase tracking-widest">
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              From the same team
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl leading-tight">
              Our previous work
            </h2>
            <p className="mt-3 text-slate-500 leading-relaxed max-w-md mx-auto">
              Before Rolebolt, we shipped another product that gained real users.
            </p>
          </div>

          <a
            href="https://veilchat.me"
            target="_blank"
            rel="noopener noreferrer"
            className="group block max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-slate-300 hover:-translate-y-1 transition-all duration-200"
          >
            <div className="flex flex-col sm:flex-row items-stretch">
              {/* Left accent panel */}
              <div className="sm:w-2 shrink-0 bg-gradient-to-b from-slate-800 to-slate-600 sm:rounded-l-2xl h-2 sm:h-auto rounded-t-2xl sm:rounded-t-none" />

              {/* Content */}
              <div className="flex-1 p-7 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Logo row */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      </div>
                      <div>
                        <p className="text-[17px] font-black text-slate-900 tracking-tight leading-none">VeilChat.me</p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">veilchat.me</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[14px] text-slate-600 leading-relaxed max-w-lg">
                      An anonymous, private chat platform — no sign-up, no history, no trace. Built for people who value genuine privacy in conversation. Gained real organic users and proved our team can ship products that people actually use.
                    </p>

                    {/* Tags */}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {["Anonymous Chat", "Privacy-first", "No sign-up", "Real users"].map(tag => (
                        <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all duration-200">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </div>

        {/* ── Roadmap ───────────────────────────────────────────────────────── */}
        <div className="mt-20">
          {/* Header */}
          <div className="max-w-2xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/8 px-4 py-1.5 text-[11px] font-bold text-violet-400 mb-5">
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              What&apos;s Next
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl leading-tight">
              Built today.<br />Evolving tomorrow.
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed max-w-lg mx-auto">
              Rolebolt is actively evolving. Here&apos;s what&apos;s already in our pipeline — shipping soon.
            </p>
          </div>

          {/* Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
                title: "AI Voice Interview",
                desc: "Candidates complete spoken interviews with an AI agent. Tone, clarity, and answers scored automatically.",
                color: "text-violet-500", bg: "bg-violet-50 border-violet-100",
              },
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                title: "AI Ranking",
                desc: "Beyond scoring — AI ranks every candidate against each other and surfaces the definitive shortlist.",
                color: "text-amber-500", bg: "bg-amber-50 border-amber-100",
              },
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>,
                title: "AI Recommendation",
                desc: "Rolebolt proactively suggests the best-fit candidates from the talent pool the moment a new role is posted.",
                color: "text-[#0a66c2]", bg: "bg-blue-50 border-blue-100",
              },
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
                title: "Mobile App",
                desc: "Review candidates, approve shortlists, and send offers from your phone — fully native iOS & Android.",
                color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-100",
              },
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 2H3v16h5l3 3 3-3h7V2z"/><path d="M7.5 7.5h9"/><path d="M7.5 12h6"/></svg>,
                title: "WhatsApp Outreach",
                desc: "Send assessments, share updates, and keep candidates engaged directly on WhatsApp — no email needed.",
                color: "text-[#25d366]", bg: "bg-green-50 border-green-100",
              },
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                title: "Team Collaboration",
                desc: "Invite hiring managers, assign stages, leave comments, and make decisions together in real time.",
                color: "text-indigo-500", bg: "bg-indigo-50 border-indigo-100",
              },
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
                title: "ATS Integrations",
                desc: "Connect Rolebolt to Greenhouse, Lever, Workday, and more — sync candidates both ways automatically.",
                color: "text-rose-500", bg: "bg-rose-50 border-rose-100",
              },
              {
                icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
                title: "LinkedIn Chrome Extension",
                desc: "Source candidates directly from LinkedIn and push them into your Rolebolt pipeline in one click.",
                color: "text-[#0a66c2]", bg: "bg-sky-50 border-sky-100",
              },
            ].map((item) => (
              <div key={item.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                    Coming Soon
                  </span>
                </div>
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${item.bg} ${item.color}`}>
                  {item.icon}
                </div>
                <h3 className="text-[14px] font-bold text-slate-900 leading-snug mb-1.5 pr-16">{item.title}</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
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
