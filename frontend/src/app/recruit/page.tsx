"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { signOut } from "firebase/auth";
import { getFirebaseAuth, isFirebaseAvailable } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { RoleboltLogo } from "@/components/RoleboltLogo";

// ─── Data ────────────────────────────────────────────────────────────────────

const NICHES = [
  { label: "AI, Data & Software", emoji: "💻", desc: "Engineers, PMs, data scientists, ML researchers", full: "AI, Data, Software & Product Tech", accent: "from-blue-500/10 to-indigo-500/10 border-blue-500/20 hover:border-blue-400/40" },
  { label: "Sales & Business Dev", emoji: "📈", desc: "AEs, SDRs, BDMs, revenue leaders", full: "Sales, Business Development & Revenue Roles", accent: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-400/40" },
  { label: "Finance & Fintech", emoji: "💰", desc: "Analysts, CFOs, bankers, fintech specialists", full: "Finance, Accounting, Banking & Fintech", accent: "from-amber-500/10 to-yellow-500/10 border-amber-500/20 hover:border-amber-400/40" },
  { label: "Healthcare & Pharma", emoji: "🏥", desc: "Doctors, nurses, pharma, allied health", full: "Healthcare, Pharma & Allied Medical Workforce", accent: "from-rose-500/10 to-pink-500/10 border-rose-500/20 hover:border-rose-400/40" },
  { label: "Blue-Collar & Logistics", emoji: "🔧", desc: "Drivers, technicians, warehouse, field ops", full: "Skilled Blue-Collar, Logistics & Industrial Workforce", accent: "from-orange-500/10 to-amber-500/10 border-orange-500/20 hover:border-orange-400/40" },
  { label: "Creative & Marketing", emoji: "🎨", desc: "Designers, copywriters, brand, growth", full: "Creative, Marketing, Media & Design", accent: "from-violet-500/10 to-purple-500/10 border-violet-500/20 hover:border-violet-400/40" },
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    ),
    title: "AI Job Description Writer",
    desc: "Generate a complete, role-specific JD in seconds. Just enter the title and skills — Rolebolt writes the rest, tailored to your industry niche.",
    tag: "Create",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    ),
    title: "Resume Parsing & AI Scoring",
    desc: "Every applicant gets a 0–100 AI fit score the moment they apply. Skills, experience, seniority — all calibrated to your rubric, not generic keywords.",
    tag: "Evaluate",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
    ),
    title: "Async Candidate Assessments",
    desc: "Send AI-generated written assessments to candidates. Responses are automatically scored and summarised — no scheduling required.",
    tag: "Evaluate",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    ),
    title: "Interview Brief Generator",
    desc: "One click produces a tailored interview brief with key focus areas, red-flag questions, and a scorecard — ready before your first call.",
    tag: "Evaluate",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    ),
    title: "Analytics & Funnel Insights",
    desc: "Track every stage of your hiring funnel — applications, scores, conversions, time-to-hire. Make data-driven decisions, not gut calls.",
    tag: "Decide",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    ),
    title: "Talent Pool Management",
    desc: "Every candidate who ever applied is searchable. When a new role opens, surface the right people in seconds — never start from scratch.",
    tag: "Decide",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Post a job in 90 seconds",
    desc: "Enter a job title. Rolebolt's AI generates a complete, industry-calibrated job description and scoring rubric. Publish instantly to your public job board.",
  },
  {
    n: "02",
    title: "AI screens every applicant",
    desc: "Candidates upload their resume. Our AI parses it, matches it against your rubric, and assigns a 0–100 fit score — instantly, for every applicant.",
  },
  {
    n: "03",
    title: "Decide fast, hire confident",
    desc: "Sort by AI score, run async assessments on shortlisted candidates, generate interview briefs, and make your hire. All in one place, completely free.",
  },
];

const PAINS = [
  {
    icon: "⏳",
    title: "Reading 200 resumes wastes weeks",
    desc: "Recruiters spend 80% of their time on manual screening — before a single qualified candidate is even contacted.",
  },
  {
    icon: "🎯",
    title: "Keyword filters miss great candidates",
    desc: "Legacy ATS systems reject strong candidates who use different terminology. You're filtering by vocabulary, not capability.",
  },
  {
    icon: "💸",
    title: "Hiring tools charge per seat, per job",
    desc: "Greenhouse, Lever, and LinkedIn Recruiter are built for enterprises. SMBs and startups pay for features they barely use.",
  },
];

const WHY = [
  { label: "AI fit score on every resume", rolebolt: true, others: false },
  { label: "JD generated in seconds", rolebolt: true, others: false },
  { label: "Async assessments built-in", rolebolt: true, others: false },
  { label: "Multi-model AI (1000+ LLMs)", rolebolt: true, others: false },
  { label: "6 niche industry categories", rolebolt: true, others: false },
  { label: "Interview brief generator", rolebolt: true, others: false },
  { label: "Completely free", rolebolt: true, others: false },
  { label: "Talent pool with search", rolebolt: true, others: true },
];

const AI_CAPABILITIES = [
  { title: "Multi-model routing", desc: "Powered by Mesh API — routes each task to the optimal model across GPT, Claude, Gemini, and 1000+ LLMs. Best output, every time.", icon: "⚡" },
  { title: "Automatic fallbacks", desc: "If a provider goes down, requests reroute in under 100ms. Your hiring pipeline never stops because of an LLM outage.", icon: "🛡️" },
  { title: "Structured AI output", desc: "All scoring, summaries, and JDs return validated JSON — not raw prose. Data you can trust, not just text you have to parse.", icon: "🔷" },
  { title: "Model-agnostic prompts", desc: "Prompt logic is centralised and reused across features. Consistent, version-controlled AI behaviour across the entire platform.", icon: "🧠" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecruitLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { recruitProfile, firebaseUser, signOutFromRecruit } = useRecruitAuth();
  const role = recruitProfile?.role ?? null;
  const isLoggedIn = !!firebaseUser && !!recruitProfile;

  async function handleSignOut() {
    try {
      await signOutFromRecruit();
      if (isFirebaseAvailable()) await signOut(getFirebaseAuth());
    } catch {}
    router.replace("/recruit/login");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_16px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5 shrink-0 group">
            <RoleboltLogo size="md" className="transition-all group-hover:shadow-[0_4px_14px_rgba(10,102,194,0.4)] group-hover:scale-105" />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none tracking-tight">Rolebolt</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5 font-medium tracking-wide">AI Hiring Platform</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            <Link href="/recruit/opportunities" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">Find Jobs</Link>
            {!isLoggedIn && <Link href="/recruit/signup" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">For Recruiters</Link>}
            {isLoggedIn && role === "creator" && <>
              <Link href="/recruit/dashboard" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">Dashboard</Link>
              <Link href="/recruit/analytics" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">Analytics</Link>
            </>}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isLoggedIn ? <>
              <Link href="/recruit/dashboard" className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-all">Dashboard</Link>
              <button onClick={handleSignOut} className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-50 transition-all">Sign out</button>
            </> : <>
              <Link href="/recruit/login" className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-all">Sign in</Link>
              <Link href="/recruit/signup" className="inline-flex rounded-lg bg-[#0a66c2] px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(10,102,194,0.3)] hover:bg-[#004182] hover:shadow-[0_4px_14px_rgba(10,102,194,0.4)] hover:-translate-y-px transition-all">Get started free</Link>
            </>}
            <button onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu" className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
              {mobileMenuOpen
                ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 pb-5 pt-3">
            <nav className="flex flex-col gap-1">
              <Link href="/recruit/opportunities" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Find Jobs</Link>
              {isLoggedIn ? <>
                <Link href="/recruit/dashboard" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Dashboard</Link>
                <button onClick={() => { setMobileMenuOpen(false); handleSignOut(); }} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 text-left">Sign out</button>
              </> : <>
                <Link href="/recruit/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign in</Link>
                <Link href="/recruit/signup" onClick={() => setMobileMenuOpen(false)} className="mt-1 rounded-xl bg-[#0a66c2] px-4 py-3 text-center text-sm font-bold text-white">Get started free →</Link>
              </>}
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative bg-slate-950 overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        {/* Glow orbs */}
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[#0a66c2]/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-[#0a66c2]/5 blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-20 lg:px-8 lg:pt-32 lg:pb-28">
          <div className="mx-auto max-w-4xl text-center">

            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#0a66c2]/40 bg-[#0a66c2]/10 px-4 py-2 text-xs font-bold text-[#60a5fa] mb-8 backdrop-blur-sm">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#60a5fa] animate-pulse" />
              Powered by Mesh API · 1,000+ AI Models · Mesh Hackathon 2026
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.04]">
              Hire the best.<br />
              <span className="bg-gradient-to-r from-[#60a5fa] via-[#3b82f6] to-[#818cf8] bg-clip-text text-transparent">
                In half the time.
              </span>
            </h1>

            {/* Sub */}
            <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Rolebolt is an AI-powered hiring platform that writes job descriptions, scores every resume, and runs candidate assessments automatically — so you can focus on the humans, not the paperwork.
            </p>

            {/* CTAs */}
            {isLoggedIn ? (
              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/recruit/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-8 py-4 text-sm font-bold text-white shadow-[0_4px_24px_rgba(10,102,194,0.5)] hover:bg-[#1d77d2] hover:-translate-y-0.5 transition-all">
                  Go to Dashboard
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <Link href="/recruit/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-8 py-4 text-sm font-bold text-white hover:bg-white/14 hover:-translate-y-0.5 transition-all backdrop-blur-sm">
                  Post a New Job
                </Link>
              </div>
            ) : (
              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/recruit/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-8 py-4 text-sm font-bold text-white shadow-[0_4px_24px_rgba(10,102,194,0.5)] hover:bg-[#1d77d2] hover:-translate-y-0.5 transition-all">
                  Start hiring free
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <Link href="/recruit/opportunities" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-8 py-4 text-sm font-bold text-white hover:bg-white/14 hover:-translate-y-0.5 transition-all backdrop-blur-sm">
                  Browse open roles
                </Link>
              </div>
            )}

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {["No credit card required", "Completely free forever", "AI-powered scoring", "Global reach"].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Hero UI mockup */}
          <div className="mt-16 relative mx-auto max-w-4xl">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#0a66c2]/40 via-indigo-500/30 to-[#0a66c2]/40 rounded-2xl blur-lg opacity-60" />
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-sm overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-slate-700" />
                  <div className="h-3 w-3 rounded-full bg-slate-700" />
                  <div className="h-3 w-3 rounded-full bg-slate-700" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="rounded-md bg-slate-800 px-3 py-1 text-[11px] text-slate-500 font-mono">rolebolt.app/recruit/dashboard</div>
                </div>
              </div>
              {/* Mock dashboard content */}
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">AI Hiring Dashboard</p>
                    <p className="text-base font-bold text-white">Senior AI Engineer — 47 Applicants</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-400">Filters</div>
                    <div className="rounded-lg bg-[#0a66c2] px-3 py-1.5 text-[11px] font-bold text-white">+ Assess</div>
                  </div>
                </div>
                {/* Stat pills */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Total Applied", val: "47" },
                    { label: "AI Scored", val: "47" },
                    { label: "Score 80+", val: "12" },
                    { label: "Shortlisted", val: "5" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-white/8 bg-white/4 px-3 py-3 text-center">
                      <p className="text-xl font-black text-white">{s.val}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
                {/* Candidate rows */}
                <div className="space-y-2">
                  {[
                    { name: "Aryan Sharma", role: "ML Engineer · 4 yrs", score: 94, flag: "Strong Match", flagColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
                    { name: "Priya Nair", role: "AI Researcher · 6 yrs", score: 91, flag: "Strong Match", flagColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
                    { name: "Rohan Mehta", role: "Backend Engineer · 3 yrs", score: 78, flag: "Good Fit", flagColor: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
                    { name: "Sneha Iyer", role: "Data Scientist · 2 yrs", score: 61, flag: "Partial Fit", flagColor: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-white/6 bg-white/3 px-4 py-3 hover:border-[#0a66c2]/40 hover:bg-white/6 transition-all group cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#0a66c2]/60 to-indigo-600/60 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                          {c.name.split(" ").map(w => w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-[#60a5fa] transition-colors">{c.name}</p>
                          <p className="text-[11px] text-slate-500">{c.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${c.flagColor}`}>{c.flag}</span>
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${c.score >= 85 ? "bg-emerald-500/20 text-emerald-400" : c.score >= 70 ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-400"}`}>{c.score}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-center py-2 text-[11px] text-slate-600 font-medium">+ 43 more applicants ranked by AI</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
            {[
              { val: "1,000+", label: "AI Models via Mesh API" },
              { val: "6", label: "Niche industry verticals" },
              { val: "< 2s", label: "Resume scored in" },
              { val: "₹0", label: "Cost to recruiters" },
            ].map(s => (
              <div key={s.label} className="py-6 px-4 sm:px-6 text-center">
                <p className="text-2xl font-black text-slate-950 tracking-tight">{s.val}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a66c2] mb-3">The problem</p>
            <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
              Traditional hiring is<br />broken by design.
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">Every recruiter knows the pain. It didn't have to be this way.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 max-w-5xl mx-auto">
            {PAINS.map(p => (
              <div key={p.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-7">
                <div className="text-3xl mb-4">{p.icon}</div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#f8fafc] border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a66c2] mb-3">How it works</p>
            <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
              From job post to<br />hire in 3 steps.
            </h2>
          </div>
          <div className="relative max-w-4xl mx-auto">
            {/* Connector line */}
            <div className="hidden sm:block absolute top-[2.25rem] left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <div className="grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.n} className="relative flex flex-col items-start sm:items-center sm:text-center">
                  <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-white border-2 border-[#0a66c2]/20 shadow-[0_2px_12px_rgba(10,102,194,0.12)] mb-5">
                    <span className="text-2xl font-black text-[#0a66c2]">{step.n}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-950 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 text-center">
            <Link href="/recruit/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#0a66c2] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(10,102,194,0.32)] hover:bg-[#004182] hover:shadow-[0_6px_20px_rgba(10,102,194,0.4)] hover:-translate-y-0.5 transition-all">
              Start for free — no card needed
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a66c2] mb-3">Features</p>
            <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
              Everything a modern<br />recruiter actually needs.
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">End-to-end hiring from first post to final hire — all AI-assisted, all free.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {FEATURES.map(f => (
              <div key={f.title} className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] hover:border-[#0a66c2]/20 hover:-translate-y-1 transition-all duration-200">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#0a66c2] group-hover:bg-[#0a66c2] group-hover:text-white transition-all duration-200">
                  {f.icon}
                </div>
                <span className="inline-block mb-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">{f.tag}</span>
                <h3 className="text-base font-bold text-slate-950 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Capabilities (Mesh API) ───────────────────────────────────────── */}
      <section className="py-20 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-[#0a66c2]/10 blur-[100px] pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0a66c2]/30 bg-[#0a66c2]/10 px-4 py-1.5 text-[11px] font-bold text-[#60a5fa] mb-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Powered by Mesh API
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight sm:text-4xl leading-tight">
              AI infrastructure<br />built for reliability.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Every AI feature in Rolebolt runs through Mesh API — a unified gateway to 1,000+ LLMs including GPT, Claude, and Gemini. Your hiring pipeline never fails because an LLM does.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto mb-10">
            {AI_CAPABILITIES.map(c => (
              <div key={c.title} className="rounded-2xl border border-white/8 bg-white/4 p-6 hover:border-[#0a66c2]/40 hover:bg-white/7 transition-all">
                <div className="text-2xl mb-4">{c.icon}</div>
                <h3 className="text-sm font-bold text-white mb-2">{c.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Code snippet */}
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/8 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
              <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-slate-700"/><div className="h-2.5 w-2.5 rounded-full bg-slate-700"/><div className="h-2.5 w-2.5 rounded-full bg-slate-700"/></div>
              <span className="text-[11px] text-slate-600 font-mono ml-1">meshClient.ts — Mesh API integration</span>
            </div>
            <pre className="p-5 text-[12px] leading-relaxed font-mono overflow-x-auto">
              <span className="text-slate-500">{"// Route AI tasks through Mesh API — 1000+ models, one key\n"}</span>
              <span className="text-purple-400">{"const "}</span>
              <span className="text-blue-300">{"result"}</span>
              <span className="text-white">{" = await "}</span>
              <span className="text-yellow-300">{"callMeshChatCompletions"}</span>
              <span className="text-white">{"({\n"}</span>
              <span className="text-white">{"  "}</span>
              <span className="text-orange-300">{"apiKey"}</span>
              <span className="text-white">{": MESHAPI_API_KEY,\n"}</span>
              <span className="text-white">{"  "}</span>
              <span className="text-orange-300">{"model"}</span>
              <span className="text-white">{": "}</span>
              <span className="text-emerald-300">{'"openai/gpt-4o-mini"'}</span>
              <span className="text-white">{",\n"}</span>
              <span className="text-white">{"  "}</span>
              <span className="text-orange-300">{"fallbackModels"}</span>
              <span className="text-white">{": [\n"}</span>
              <span className="text-white">{"    "}</span>
              <span className="text-emerald-300">{'"anthropic/claude-3-haiku"'}</span>
              <span className="text-white">{",\n"}</span>
              <span className="text-white">{"    "}</span>
              <span className="text-emerald-300">{'"google/gemini-2.5-flash-lite"'}</span>
              <span className="text-white">{",\n"}</span>
              <span className="text-white">{"  ],\n"}</span>
              <span className="text-white">{"  "}</span>
              <span className="text-orange-300">{"retries"}</span>
              <span className="text-white">{": "}</span>
              <span className="text-amber-300">{"2"}</span>
              <span className="text-white">{",\n"}</span>
              <span className="text-white">{"});\n"}</span>
            </pre>
          </div>
          <p className="text-center text-xs text-slate-600 mt-4">GPT → Claude → Gemini automatic fallback chain. Zero downtime.</p>
        </div>
      </section>

      {/* ── Niches ──────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a66c2] mb-3">Industry niches</p>
              <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
                Built for your<br />specific market.
              </h2>
              <p className="mt-3 text-slate-500 max-w-md leading-relaxed">Generic job boards miss the nuance of each industry. Rolebolt AI is calibrated for 6 focused niches — not one-size-fits-all.</p>
            </div>
            <Link href="/recruit/opportunities" className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-[#0a66c2] hover:text-[#004182] transition-colors">
              Browse all opportunities
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NICHES.map(({ label, emoji, desc, full, accent }) => (
              <Link
                key={label}
                href={`/recruit/opportunities?niche=${encodeURIComponent(full)}`}
                className={`group rounded-2xl border bg-gradient-to-br ${accent} p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]`}
              >
                <span className="text-3xl">{emoji}</span>
                <p className="mt-3 text-base font-bold text-slate-900 leading-snug">{label}</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{desc}</p>
                <p className="mt-3 text-xs font-bold text-[#0a66c2] group-hover:underline">Browse jobs →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Rolebolt ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#f8fafc] border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a66c2] mb-3">Why Rolebolt</p>
            <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
              Not another ATS.<br />A smarter one.
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">Traditional ATS tools were built before AI existed. Rolebolt was built for it.</p>
          </div>
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50">
              <div className="col-span-1 py-3 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Capability</div>
              <div className="py-3 px-4 text-center text-xs font-bold text-[#0a66c2] uppercase tracking-wider">Rolebolt</div>
              <div className="py-3 px-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Others</div>
            </div>
            {WHY.map((row, i) => (
              <div key={row.label} className={`grid grid-cols-3 ${i < WHY.length - 1 ? "border-b border-slate-100" : ""}`}>
                <div className="col-span-1 py-3.5 px-5 text-sm text-slate-700 font-medium">{row.label}</div>
                <div className="py-3.5 px-4 flex items-center justify-center">
                  <svg width="16" height="16" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="py-3.5 px-4 flex items-center justify-center">
                  {row.others
                    ? <svg width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-[#0a66c2]/12 blur-[100px] pointer-events-none" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-bold text-slate-400 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Free forever · No limits · No card required
          </div>
          <h2 className="text-4xl font-black text-white tracking-tight sm:text-5xl leading-tight">
            Ready to hire<br />
            <span className="bg-gradient-to-r from-[#60a5fa] to-[#818cf8] bg-clip-text text-transparent">smarter?</span>
          </h2>
          <p className="mt-5 text-slate-400 text-base leading-relaxed max-w-xl mx-auto">
            Join recruiters who've switched from spreadsheets and keyword filters to AI-powered hiring. Your first job post takes 90 seconds.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            {isLoggedIn ? (
              <Link href="/recruit/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-9 py-4 text-sm font-bold text-slate-900 shadow-[0_4px_24px_rgba(255,255,255,0.15)] hover:bg-blue-50 hover:-translate-y-0.5 transition-all">
                Go to Dashboard
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
            ) : (
              <>
                <Link href="/recruit/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-9 py-4 text-sm font-bold text-white shadow-[0_4px_24px_rgba(10,102,194,0.5)] hover:bg-[#1d77d2] hover:-translate-y-0.5 transition-all">
                  Start hiring free
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <Link href="/recruit/opportunities" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-9 py-4 text-sm font-bold text-white hover:bg-white/14 hover:-translate-y-0.5 transition-all">
                  Browse open roles
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 border-t border-white/6">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <RoleboltLogo size="md" />
                <div>
                  <p className="text-sm font-bold text-white leading-none">Rolebolt</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">AI Hiring Platform</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">AI-powered hiring for recruiters and job seekers worldwide. Completely free, forever.</p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[10px] font-bold text-slate-500">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Powered by Mesh API
              </div>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Platform</p>
                <ul className="space-y-2.5">
                  {[
                    { label: "Find Jobs", href: "/recruit/opportunities" },
                    { label: "For Recruiters", href: "/recruit/signup" },
                    { label: "Dashboard", href: "/recruit/dashboard" },
                    { label: "Analytics", href: "/recruit/analytics" },
                  ].map(l => <li key={l.label}><Link href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{l.label}</Link></li>)}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Niches</p>
                <ul className="space-y-2.5">
                  {NICHES.slice(0, 4).map(n => (
                    <li key={n.label}>
                      <Link href={`/recruit/opportunities?niche=${encodeURIComponent(n.full)}`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{n.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Account</p>
                <ul className="space-y-2.5">
                  {[
                    { label: "Sign up free", href: "/recruit/signup" },
                    { label: "Sign in", href: "/recruit/login" },
                    { label: "Talent Pool", href: "/recruit/talent-pool" },
                    { label: "Recruiter Profile", href: "/recruit/recruiter-profile" },
                  ].map(l => <li key={l.label}><Link href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{l.label}</Link></li>)}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-600">© 2026 Rolebolt. All rights reserved.</p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              Built with
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444" className="inline"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              for the Mesh API Hackathon 2026
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
