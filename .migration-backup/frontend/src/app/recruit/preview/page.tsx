"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { JudgesTestingKit } from "@/components/JudgesTestingKit";
import { MarketingFooter } from "@/components/MarketingFooter";

// ─── Data ────────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Dashboard", "AI Evaluation", "Analytics", "Candidate Experience"] as const;
type Category = (typeof CATEGORIES)[number];

interface Screenshot {
  src: string;
  title: string;
  desc: string;
  category: Exclude<Category, "All">;
  badge?: string;
  contain?: boolean;
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
  {
    src: "/screenshots/ai-copilot-rolebolt.png",
    title: "AI Copilot",
    desc: "Ask natural-language questions about a candidate, a job's pipeline, or your entire hiring organisation, and get sourced, data-grounded answers instantly.",
    category: "AI Evaluation",
    badge: "AI",
  },
];

const NEW_VERSION_SCREENSHOTS: Screenshot[] = [
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174200_1785760331750.png",
    title: "Recruitment Pipeline",
    desc: "A recruiter command centre for active roles, candidate volume, shortlist progress, interviews, hires, and daily briefing updates.",
    category: "Dashboard",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174224_1785760328349.png",
    title: "Form Jobs Workspace",
    desc: "A focused view for collecting and reviewing applicants through lightweight custom forms without a full hiring pipeline.",
    category: "Dashboard",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174242_1785760325931.png",
    title: "Talent Pool",
    desc: "Keep strong candidates warm, review match scores, and reuse promising people across future roles.",
    category: "Dashboard",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174554_1785760271871.png",
    title: "Candidate Email Outreach",
    desc: "Select candidates, choose a professional template, edit the message, and see the live email preview before sending.",
    category: "Candidate Experience",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174613_1785760271871.png",
    title: "Choose Your Hiring Flow",
    desc: "Start with a Standard Job Post for a complete AI pipeline or a Form Builder for flexible candidate intake.",
    category: "Dashboard",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174618_1785760271872.png",
    title: "AI Job Posting Generator",
    desc: "A guided role setup turns a few inputs into a complete job description and scoring rubric.",
    category: "AI Evaluation",
    badge: "AI",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174625_1785760271872.png",
    title: "Application Form Builder",
    desc: "Choose a starting template and build a custom application form that can be shared anywhere.",
    category: "Dashboard",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174643_1785760271873.png",
    title: "Plans & Billing",
    desc: "Separate plans for job seekers, Form Jobs, and Standard Jobs with clear payment and access verification.",
    category: "Dashboard",
    badge: "Billing",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174740_1785760257250.png",
    title: "Job Seeker Dashboard",
    desc: "A personal job search overview with Career GPS momentum, applications, interviews, saved jobs, and AI tools.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174747_1785760257251.png",
    title: "Career GPS",
    desc: "Turn job search activity into clear next actions with momentum scoring, weekly goals, and pipeline visibility.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174756_1785760257252.png",
    title: "Universal Application Tracker",
    desc: "Track Rolebolt, LinkedIn, Indeed, company-site, and manually added applications in one place.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174812_1785760257252.png",
    title: "Universal Job Workspace",
    desc: "Bring any job from a URL or pasted description into a workspace for analysis and smarter next steps.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174833_1785760257253.png",
    title: "Job Seeker AI Tools",
    desc: "Jump from the dashboard into Resume, Cover Letter, Interview Prep, Email Intelligence, Extension, and Profile tools.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174840_1785760257254.png",
    title: "AI Tools at a Glance",
    desc: "A quick dashboard view of the complete job seeker toolkit, from application tracking to interview preparation.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174849_1785760257254.png",
    title: "Browser Extension",
    desc: "Save roles from LinkedIn, Indeed, and career pages, then get instant AI match analysis and workspace actions.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174900_1785760257255.png",
    title: "AI Interview Prep",
    desc: "Practice with AI-generated questions at entry, mid, or senior difficulty and get ready for the real conversation.",
    category: "AI Evaluation",
    badge: "AI",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174911_1785760257255.png",
    title: "AI Cover Letter Generator",
    desc: "Combine a job description and your resume, choose a tone, and generate a tailored cover letter in seconds.",
    category: "AI Evaluation",
    badge: "AI",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174921_1785760257256.png",
    title: "Email Intelligence",
    desc: "Paste recruiter emails and extract stage updates, interview dates, and recommended next steps.",
    category: "AI Evaluation",
    badge: "AI",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174932_1785760207911.png",
    title: "AI Resume Builder",
    desc: "Build from scratch or improve an existing resume, then export an ATS-friendly version in your preferred format.",
    category: "AI Evaluation",
    badge: "AI",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174951_1785760184810.png",
    title: "Job Seeker Profile",
    desc: "Keep your headline, experience, location, bio, and skills current so every job match starts with better context.",
    category: "Candidate Experience",
    badge: "Job seeker",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174250_1785760819689.png",
    title: "Recruiting Analytics",
    desc: "See pipeline health, stage distribution, source quality, hiring outcomes, and key recruiting metrics at a glance.",
    category: "Analytics",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174305_1785760819690.png",
    title: "Recruiter Profile",
    desc: "Build a public-facing recruiter or company profile with the details candidates need to understand who is hiring.",
    category: "Dashboard",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174316_1785760819691.png",
    title: "Recruiter Profile Details",
    desc: "Capture company basics, industry, size, location, website, and description in a clear profile workflow.",
    category: "Dashboard",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174331_1785760819691.png",
    title: "Assessment Responses",
    desc: "Review applicant responses, AI scores, assessment summaries, stage decisions, notes, and next actions in one view.",
    category: "AI Evaluation",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174357_1785760819692.png",
    title: "Standard Job Pipeline",
    desc: "Run a structured hiring command centre with AI recommendations, candidate scores, needs-attention items, and pipeline health.",
    category: "AI Evaluation",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174404_1785760819692.png",
    title: "Candidate Pipeline Review",
    desc: "Take action on each candidate with stage changes, assessments, outreach, reminders, decisions, and supporting score context.",
    category: "AI Evaluation",
    badge: "Recruiter",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174422_1785760819693.png",
    title: "AI Pipeline Rules",
    desc: "Set automated rules that move candidates through stages or trigger actions when scores and assessment outcomes match.",
    category: "AI Evaluation",
    badge: "AI",
    contain: true,
  },
  {
    src: "/screenshots/new-version/Screenshot_2026-08-03_174430_1785760819693.png",
    title: "AI Triage Agent",
    desc: "Tune shortlist and reject thresholds, configure automatic actions, and keep human review in control of the pipeline.",
    category: "AI Evaluation",
    badge: "AI",
    contain: true,
  },
];

const BADGE_STYLES: Record<string, string> = {
  Dashboard: "bg-[#0a66c2]/10 text-[#0a66c2] border-[#0a66c2]/20",
  AI: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  Analytics: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  Candidate: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Recruiter: "bg-[#0a66c2]/10 text-[#0a66c2] border-[#0a66c2]/20",
  Billing: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "Job seeker": "bg-violet-500/10 text-violet-600 border-violet-500/20",
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
              href="/recruit/status"
              className="relative inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[13px] font-bold text-emerald-700 shadow-[0_0_0_0_rgba(16,185,129,0.5)] hover:bg-emerald-100 hover:-translate-y-px transition-all animate-[rb-pulse-glow_2.2s_ease-in-out_infinite]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Status
            </Link>
            <Link
              href="/recruit/signup"
              className="inline-flex rounded-lg bg-[#0a66c2] px-3.5 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-[#004182] transition-all"
            >
              Get started
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
          {filtered.map((shot, idx) => (
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
                  loading={idx === 0 ? "eager" : "lazy"}
                   className={`${shot.contain ? "object-contain" : "object-cover object-top"} transition-transform duration-500 group-hover:scale-[1.03]`}
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

         {/* ── The New Version of Preview ──────────────────────────────────── */}
         <section id="new-version-preview" className="mt-24 scroll-mt-28">
           <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 sm:px-10 sm:py-12">
             <div className="pointer-events-none absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-[90px]" />
             <div className="pointer-events-none absolute -bottom-48 left-1/4 h-[24rem] w-[24rem] rounded-full bg-[#0a66c2]/20 blur-[90px]" />
             <div className="relative mx-auto max-w-3xl text-center">
               <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-300/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-200">
                 <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                   <path d="M12 3v18M3 12h18M5.64 5.64l12.72 12.72M18.36 5.64 5.64 18.36" />
                 </svg>
                 The New Version of Preview
               </span>
               <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
                 One workspace. Every better next step.
               </h2>
               <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                 Explore the latest Rolebolt experience for recruiting teams and job seekers — from the first job post to the final interview.
               </p>
               <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold text-slate-400">
                 <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">28 new screens</span>
                 <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Recruiter + job seeker</span>
                 <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Click to enlarge</span>
               </div>
             </div>
           </div>

           <div className="mt-12 space-y-14">
             {[
               {
                 label: "For recruiting teams",
                 title: "A clearer operating system for hiring",
                 desc: "Move from job creation to candidate outreach with better context at every step.",
                 items: NEW_VERSION_SCREENSHOTS.filter((shot) => ["Recruiter", "Billing"].includes(shot.badge ?? "")),
                 accent: "text-[#0a66c2]",
                 pill: "bg-blue-50 text-[#0a66c2] border-blue-100",
               },
               {
                 label: "For job seekers",
                 title: "A smarter workspace for the whole search",
                 desc: "Keep your profile, applications, preparation, and job research connected in one place.",
                 items: NEW_VERSION_SCREENSHOTS.filter((shot) => shot.badge === "Job seeker"),
                 accent: "text-violet-600",
                 pill: "bg-violet-50 text-violet-600 border-violet-100",
               },
               {
                 label: "AI-powered tools",
                 title: "Useful assistance, right when you need it",
                 desc: "Build, tailor, prepare, and understand with focused AI tools for real job-search moments.",
                 items: NEW_VERSION_SCREENSHOTS.filter((shot) => shot.badge === "AI"),
                 accent: "text-amber-600",
                 pill: "bg-amber-50 text-amber-700 border-amber-100",
               },
             ].map((group) => (
               <div key={group.label}>
                 <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                   <div>
                     <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${group.accent}`}>{group.label}</p>
                     <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{group.title}</h3>
                   </div>
                   <p className="max-w-md text-sm leading-5 text-slate-500 sm:text-right">{group.desc}</p>
                 </div>
                 <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                   {group.items.map((shot, idx) => (
                     <article
                       key={shot.src}
                       onClick={() => setLightbox(shot)}
                       className="group cursor-zoom-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#0a66c2]/30 hover:shadow-lg"
                     >
                       <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                         <Image
                           src={shot.src}
                           alt={shot.title}
                           fill
                           loading={idx === 0 ? "eager" : "lazy"}
                           className={`${shot.contain ? "object-contain" : "object-cover object-top"} transition-transform duration-500 group-hover:scale-[1.03]`}
                           sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                         />
                         <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 transition-all duration-200 group-hover:bg-slate-950/20">
                           <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                             <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                               <circle cx="11" cy="11" r="8" />
                               <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
                             </svg>
                           </div>
                         </div>
                       </div>
                       <div className="p-4 sm:p-5">
                         <span className={`mb-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${group.pill}`}>
                           {shot.badge}
                         </span>
                         <h4 className="text-[15px] font-bold leading-snug text-slate-900">{shot.title}</h4>
                         <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{shot.desc}</p>
                       </div>
                     </article>
                   ))}
                 </div>
               </div>
             ))}
           </div>
         </section>

        {/* ── Judges Testing Kit ───────────────────────────────────────────── */}
        <div className="mt-20">
          <JudgesTestingKit dark={false} />
        </div>

        {/* ── How Rolebolt's AI workflow supports hiring ─────────────────────── */}
        <div className="mt-24">
          {/* Header */}
          <div className="max-w-2xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0a66c2]/30 bg-[#0a66c2]/8 px-4 py-1.5 text-[11px] font-bold text-[#0a66c2] mb-5 uppercase tracking-widest">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              AI workflow
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl leading-tight">
              How Rolebolt's AI workflow supports hiring
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed max-w-lg mx-auto">
              Rolebolt turns job context, candidate information and structured answers into useful hiring signals, with resilient AI workflows designed to keep review moving.
            </p>
          </div>

          {/* Model badge */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
              {[
                { label: "Primary", model: "Role-aware reasoning", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                { label: "Fallback 1", model: "Structured review", color: "bg-violet-50 border-violet-200 text-violet-700" },
                { label: "Fallback 2", model: "Human verification", color: "bg-blue-50 border-blue-200 text-blue-700" },
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
                desc: "When a candidate applies, Rolebolt extracts structured signals from the uploaded resume: skills, experience depth, career trajectory, and role alignment.",
                model: "Resume signal extraction",
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
                model: "Rubric-based scoring",
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
                model: "Role-aware matching",
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
                desc: "A guided wizard collects the role basics and generates a full job description with requirements, responsibilities, and a custom scoring rubric.",
                model: "Job context generation",
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
                title: "AI Copilot — Recruitment Assistant",
                desc: "Recruiters can chat with an AI that already knows their jobs, candidates, resumes, and scores. Ask 'who are my top 3 candidates for this role?' or 'should I hire this candidate?' and get sourced, grounded answers instantly.",
                model: "Grounded recruiter assistance",
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
                desc: "When candidates submit custom intake forms, Rolebolt scores each answer against the form's criteria, giving teams structured evidence even when a resume is not required.",
                model: "Form response scoring",
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
                  <span className="ml-auto text-[10px] text-slate-300 font-medium">Human-checkable</span>
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
              <p className="text-[12px] text-slate-500 mt-0.5">Structured outputs and reviewable rationale help teams keep candidate evaluation moving without hiding the evidence behind a single score.</p>
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

                  {/* Auth */}
                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                    label="Custom Auth"
                    sublabel="Session management"
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

                  {/* AI workflow */}
                  <ArchNode
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
                    label="AI workflow"
                    sublabel="Role context · structured outputs"
                    color="bg-violet-600 text-white"
                    borderColor="border-violet-500"
                    highlight
                  />
                  <ArchArrow label="Model routing" />

                  {/* AI Models */}
                  <div className="flex items-center gap-3 w-full justify-center">
                    {[
                      { name: "Role-aware reasoning", tag: "Primary", color: "border-emerald-300 bg-emerald-50 text-emerald-800" },
                      { name: "Structured review", tag: "Fallback 1", color: "border-violet-300 bg-violet-50 text-violet-800" },
                      { name: "Human verification", tag: "Fallback 2", color: "border-blue-300 bg-blue-50 text-blue-800" },
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
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1.5">Custom Auth</p>
                    <p className="text-[11px] text-amber-700">Session validation on every protected API route</p>
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
                  { label: "Custom Auth", sub: "Session management", bg: "bg-amber-500 text-white" },
                  { label: "Next.js Frontend", sub: "Rolebolt UI · Port 5000", bg: "bg-[#0a66c2] text-white" },
                  { label: "Express Backend", sub: "Node.js API · Port 8080", bg: "bg-slate-700 text-white" },
                  { label: "MongoDB Atlas", sub: "Jobs, Candidates, Forms", bg: "bg-emerald-600 text-white" },
                  { label: "AI workflow", sub: "Role context · structured outputs", bg: "bg-violet-600 text-white", highlight: true },
                  { label: "Review signals", sub: "Scores → rationale → human decision", bg: "bg-slate-100 text-slate-700" },
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
                { color: "bg-violet-600", label: "AI workflow" },
                { color: "bg-emerald-600", label: "MongoDB (persistence)" },
                { color: "bg-amber-500", label: "Custom Auth" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
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
              See the product in action.
            </h2>
            <p className="mt-3 text-slate-400 text-sm max-w-sm mx-auto">
              Explore the workflow, then choose the path that fits your team.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/recruit/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(10,102,194,0.45)] hover:bg-[#1d77d2] hover:-translate-y-0.5 transition-all"
              >
                Get started
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
      <MarketingFooter />

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
