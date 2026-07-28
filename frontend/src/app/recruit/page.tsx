"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { useRouter } from "next/navigation";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { SiteGuideChatbot } from "@/components/SiteGuideChatbot";

// ─── Data ────────────────────────────────────────────────────────────────────

const NICHES = [
  {
    label: "AI, Data & Software", desc: "Engineers, PMs, data scientists, ML researchers", full: "AI, Data, Software & Product Tech", accent: "from-blue-500/10 to-indigo-500/10 border-blue-500/20 hover:border-blue-400/40", iconColor: "text-blue-500",
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m9 8 2 2-2 2M13 12h2"/></svg>,
  },
  {
    label: "Sales & Business Dev", desc: "AEs, SDRs, BDMs, revenue leaders", full: "Sales, Business Development & Revenue Roles", accent: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-400/40", iconColor: "text-emerald-500",
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  },
  {
    label: "Finance & Fintech", desc: "Analysts, CFOs, bankers, fintech specialists", full: "Finance, Accounting, Banking & Fintech", accent: "from-amber-500/10 to-yellow-500/10 border-amber-500/20 hover:border-amber-400/40", iconColor: "text-amber-500",
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
  {
    label: "Healthcare & Pharma", desc: "Doctors, nurses, pharma, allied health", full: "Healthcare, Pharma & Allied Medical Workforce", accent: "from-rose-500/10 to-pink-500/10 border-rose-500/20 hover:border-rose-400/40", iconColor: "text-rose-500",
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  },
  {
    label: "Blue-Collar & Logistics", desc: "Drivers, technicians, warehouse, field ops", full: "Skilled Blue-Collar, Logistics & Industrial Workforce", accent: "from-orange-500/10 to-amber-500/10 border-orange-500/20 hover:border-orange-400/40", iconColor: "text-orange-500",
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  },
  {
    label: "Creative & Marketing", desc: "Designers, copywriters, brand, growth", full: "Creative, Marketing, Media & Design", accent: "from-violet-500/10 to-purple-500/10 border-violet-500/20 hover:border-violet-400/40", iconColor: "text-violet-500",
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
  },
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
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
    title: "AI Copilot — ask about anyone, anytime",
    desc: "Chat with an AI that already knows your jobs, candidates, resumes, and scores. Ask \"who should I interview first?\" or \"summarise this candidate\" and get grounded, sourced answers instantly.",
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
    icon: <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    title: "Reading 200 resumes wastes weeks",
    desc: "Recruiters spend 80% of their time on manual screening — before a single qualified candidate is even contacted.",
  },
  {
    icon: <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>,
    title: "Keyword filters miss great candidates",
    desc: "Legacy ATS systems reject strong candidates who use different terminology. You're filtering by vocabulary, not capability.",
  },
  {
    icon: <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
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
  { label: "AI Copilot chat across your pipeline", rolebolt: true, others: false },
];

const AI_CAPABILITIES = [
  {
    title: "Multi-model routing", desc: "Powered by Google M API — routes each task to the optimal model across GPT, Claude, Gemini, and 1000+ LLMs. Best output, every time.",
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  },
  {
    title: "Automatic fallbacks", desc: "If a provider goes down, requests reroute in under 100ms. Your hiring pipeline never stops because of an LLM outage.",
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
  {
    title: "Structured AI output", desc: "All scoring, summaries, and JDs return validated JSON — not raw prose. Data you can trust, not just text you have to parse.",
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  },
  {
    title: "Model-agnostic prompts", desc: "Prompt logic is centralised and reused across features. Consistent, version-controlled AI behaviour across the entire platform.",
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecruitLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { recruitProfile, authUser, signOutFromRecruit } = useRecruitAuth();
  const role = recruitProfile?.role ?? null;
  const isLoggedIn = !!authUser && !!recruitProfile;

  async function handleSignOut() {
    try {
      await signOutFromRecruit();
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
            <a href="#how-it-works" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">How it Works</a>
            <a href="#features" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">Features</a>
            <a href="#ai-copilot" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">AI Copilot</a>
            <a href="#why-rolebolt" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">Why Rolebolt</a>
            <a href="#team" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all">Team</a>
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
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">How it Works</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Features</a>
              <a href="#ai-copilot" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">AI Copilot</a>
              <a href="#why-rolebolt" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Why Rolebolt</a>
              <a href="#team" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Team</a>
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

            {/* ── Social icons above badge ── */}
            <div className="flex justify-center gap-4 mb-5">
              <a
                href="https://www.instagram.com/entrepreneur.rupesh/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                style={{ animation: "float 3s ease-in-out infinite" }}
                className="group flex items-center justify-center h-10 w-10 rounded-full border border-pink-500/40 bg-gradient-to-br from-pink-500/15 to-purple-600/15 text-pink-400 hover:border-pink-400/80 hover:text-pink-300 hover:shadow-[0_0_18px_rgba(236,72,153,0.45)] transition-all duration-300"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="https://x.com/rupesh__gupta_"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                style={{ animation: "float 3s ease-in-out infinite 0.4s" }}
                className="group flex items-center justify-center h-10 w-10 rounded-full border border-slate-500/40 bg-slate-800/40 text-slate-300 hover:border-slate-300/70 hover:text-white hover:shadow-[0_0_18px_rgba(255,255,255,0.2)] transition-all duration-300"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                </svg>
              </a>
            </div>

            {/* ── Hackathon Judges floating badge ── */}
            <div className="flex justify-center mb-8">
              <Link
                href="/recruit/preview"
                style={{ animation: "float 3s ease-in-out infinite" }}
                className="group relative inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[12px] font-bold text-amber-200 tracking-wide cursor-pointer select-none"
              >
                {/* Outer glow halo */}
                <span className="absolute inset-0 rounded-full bg-amber-400/25 blur-[10px] group-hover:bg-amber-400/40 transition-all duration-500" />
                {/* Inner pill surface */}
                <span className="absolute inset-0 rounded-full border border-amber-400/50 bg-gradient-to-r from-[#1a0f00]/90 via-slate-900/95 to-[#1a0f00]/90 group-hover:border-amber-400/80 transition-all duration-300" />
                {/* Shimmer sweep */}
                <span
                  className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                  aria-hidden="true"
                >
                  <span
                    style={{
                      background: "linear-gradient(105deg, transparent 35%, rgba(251,191,36,0.18) 50%, transparent 65%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 2.8s linear infinite",
                    }}
                    className="absolute inset-0"
                  />
                </span>
                {/* Content */}
                <span className="relative flex items-center gap-2">
                  <svg width="13" height="13" fill="currentColor" className="text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <span className="text-amber-100">For Hackathon Judges</span>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-amber-400 group-hover:translate-x-0.5 transition-transform duration-200"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
              </Link>
            </div>

            {/* Badge */}
            <div className="inline-flex items-stretch rounded-lg border border-[#0a66c2]/35 bg-slate-950/70 text-[11px] font-bold mb-8 overflow-hidden">
              {/* Left: Google M API brand tab */}
              <div className="flex items-center gap-1.5 bg-[#0a66c2]/18 px-3.5 py-2 border-r border-[#0a66c2]/25">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <span className="text-[#60a5fa] tracking-wide">Powered by Google M API</span>
              </div>
              {/* Right: stats + hackathon link */}
              <div className="flex items-center gap-2.5 px-3.5 py-2 text-slate-400">
                <span>1,000+ AI Models</span>
                <span className="text-slate-600 font-normal">·</span>
                <a
                  href="https://hack.meshapi.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#93c5fd] hover:text-white transition-colors"
                >
                  Mesh Hackathon 2026
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
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
                <Link href="/recruit/preview" className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/8 px-8 py-4 text-sm font-bold text-amber-200 hover:bg-amber-400/15 hover:border-amber-400/50 hover:-translate-y-0.5 transition-all backdrop-blur-sm">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  Explore Product Preview
                </Link>
              </div>
            ) : (
              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/recruit/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-8 py-4 text-sm font-bold text-white shadow-[0_4px_24px_rgba(10,102,194,0.5)] hover:bg-[#1d77d2] hover:-translate-y-0.5 transition-all">
                  Start hiring free
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <Link href="/recruit/preview" className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/8 px-8 py-4 text-sm font-bold text-amber-200 hover:bg-amber-400/15 hover:border-amber-400/50 hover:-translate-y-0.5 transition-all backdrop-blur-sm">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  Explore Product Preview
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
                  <div className="rounded-md bg-slate-800 px-3 py-1 text-[11px] text-slate-500 font-mono">rolebolt.tech/recruit/dashboard</div>
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
              { val: "1,000+", label: "AI Models via Google M API" },
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

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a66c2] mb-3">How it works</p>
            <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
              From job post to<br />hire in 3 steps.
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">No training required. No complex setup. Just post, let AI do the screening, and hire.</p>
          </div>
          <div className="relative max-w-4xl mx-auto">
            {/* Connector line */}
            <div className="hidden sm:block absolute top-[2.25rem] left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <div className="grid gap-8 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="relative flex flex-col items-start sm:items-center sm:text-center">
                  <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-blue-50 border-2 border-[#0a66c2]/20 shadow-[0_2px_12px_rgba(10,102,194,0.12)] mb-5">
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
      <section id="features" className="py-20 bg-[#f8fafc] border-t border-slate-100">
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

      {/* ── AI Copilot spotlight ────────────────────────────────────────────── */}
      <section id="ai-copilot" className="py-20 bg-white border-t border-slate-100 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-[11px] font-bold text-violet-600 mb-5 uppercase tracking-widest">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                AI Copilot
              </div>
              <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
                Your entire hiring pipeline,<br />one conversation away.
              </h2>
              <p className="mt-4 text-slate-500 leading-relaxed max-w-lg">
                Ask Rolebolt anything — about a single candidate, a whole job's pipeline, or your entire
                hiring organisation — and get a straight answer, grounded in your real data. No dashboards
                to dig through, no exports to read.
              </p>
              <div className="mt-6 space-y-3 max-w-lg">
                {[
                  { title: "Organisation-wide intelligence", desc: "\"Which jobs need attention?\" or \"search my talent pool for React devs\" — across every role at once." },
                  { title: "Job-level pipeline analysis", desc: "\"Who should I interview first?\" or \"compare my top candidates\" for the role you're viewing." },
                  { title: "Candidate deep-dives", desc: "\"Should I hire this candidate?\" or \"generate interview questions\" — tailored to one person's resume and scores." },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <p className="text-[13.5px] font-bold text-slate-900">{item.title}</p>
                      <p className="text-[13px] text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[12px] text-slate-400 leading-relaxed max-w-lg">
                Every answer cites its sources — the exact candidate, job, or score it's referring to — so you
                can verify it in one click. Nothing is invented; it's your data, explained.
              </p>
              <div className="mt-7">
                <Link href="/recruit/preview" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(124,58,237,0.32)] hover:bg-violet-700 hover:-translate-y-0.5 transition-all">
                  See it in the product preview
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
              </div>
            </div>

            {/* Screenshot */}
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-br from-violet-200/50 via-blue-100/40 to-transparent rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] overflow-hidden">
                <div className="relative aspect-[1024/500] w-full bg-slate-50">
                  <Image
                    src="/screenshots/ai-copilot.png"
                    alt="Ask Rolebolt AI Copilot chat, focused on a candidate with a 90% fit score"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Rolebolt ────────────────────────────────────────────────────── */}
      <section id="why-rolebolt" className="py-20 bg-white border-t border-slate-100">
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

      {/* ── Problem ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#f8fafc] border-t border-slate-100">
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
              <div key={p.title} className="rounded-2xl border border-slate-100 bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{p.icon}</div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Capabilities (Google M API) ───────────────────────────────────────── */}
      <section className="py-20 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-[#0a66c2]/10 blur-[100px] pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0a66c2]/30 bg-[#0a66c2]/10 px-4 py-1.5 text-[11px] font-bold text-[#60a5fa] mb-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Powered by Google M API
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight sm:text-4xl leading-tight">
              AI infrastructure<br />built for reliability.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Every AI feature in Rolebolt runs through Google M API — a unified gateway to 1,000+ LLMs including GPT, Claude, and Gemini. Your hiring pipeline never fails because an LLM does.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto mb-10">
            {AI_CAPABILITIES.map(c => (
              <div key={c.title} className="rounded-2xl border border-white/8 bg-white/4 p-6 hover:border-[#0a66c2]/40 hover:bg-white/7 transition-all">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-[#60a5fa]">{c.icon}</div>
                <h3 className="text-sm font-bold text-white mb-2">{c.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Code snippet */}
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/8 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
              <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-slate-700"/><div className="h-2.5 w-2.5 rounded-full bg-slate-700"/><div className="h-2.5 w-2.5 rounded-full bg-slate-700"/></div>
              <span className="text-[11px] text-slate-600 font-mono ml-1">meshClient.ts — Google M API integration</span>
            </div>
            <pre className="p-5 text-[12px] leading-relaxed font-mono overflow-x-auto">
              <span className="text-slate-500">{"// Route AI tasks through Google M API — 1000+ models, one key\n"}</span>
              <span className="text-purple-400">{"const "}</span>
              <span className="text-blue-300">{"result"}</span>
              <span className="text-white">{" = await "}</span>
              <span className="text-yellow-300">{"callMeshChatCompletions"}</span>
              <span className="text-white">{"({\n"}</span>
              <span className="text-white">{"  "}</span>
              <span className="text-orange-300">{"apiKey"}</span>
              <span className="text-white">{": GOOGLEM_API_KEY,\n"}</span>
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
            {NICHES.map(({ label, icon, iconColor, desc, full, accent }) => (
              <Link
                key={label}
                href={`/recruit/opportunities?niche=${encodeURIComponent(full)}`}
                className={`group rounded-2xl border bg-gradient-to-br ${accent} p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]`}
              >
                <span className={iconColor}>{icon}</span>
                <p className="mt-3 text-base font-bold text-slate-900 leading-snug">{label}</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{desc}</p>
                <p className="mt-3 text-xs font-bold text-[#0a66c2] group-hover:underline">Browse jobs →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ────────────────────────────────────────────────────────────── */}
      <section id="team" className="py-20 bg-[#f8fafc] border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a66c2] mb-3">The team</p>
            <h2 className="text-3xl font-black text-slate-950 tracking-tight sm:text-4xl leading-tight">
              Built by people who<br />care about hiring.
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">We're builders who believe hiring should be faster, fairer, and smarter for everyone.</p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-6 max-w-xl mx-auto">
            {[
              { name: "Rupesh Gupta", role: "Founder", initials: "RG" },
            ].map((member) => (
              <div
                key={member.name}
                className="group flex-1 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-10 py-8 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-1 transition-all duration-200"
              >
                {/* Avatar */}
                <div className="h-20 w-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-5 group-hover:bg-slate-50 transition-colors duration-200">
                  <span className="text-xl font-bold text-slate-500 tracking-wide">{member.initials}</span>
                </div>

                {/* Name + role */}
                <h3 className="text-base font-bold text-slate-900 tracking-tight">{member.name}</h3>
                <p className="mt-1 text-[12px] font-medium text-slate-400 uppercase tracking-widest">{member.role}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 max-w-2xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-4 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-slate-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Honestly — For Hackathon Judges
            </span>
          </div>

          <div className="mt-4 max-w-2xl mx-auto rounded-2xl border-2 border-amber-300 bg-amber-50 px-6 py-5 shadow-sm">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-amber-500 shrink-0 mt-0.5">
                <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.71 3.86a2 2 0 0 0-3.42 0Z"/>
              </svg>
              <p className="text-[13px] font-semibold text-amber-900 leading-relaxed">
                This project was developed between <strong>July 6 and July 12</strong>. During its development,{" "}
                <strong>Replit AI</strong> and <strong>Cursor AI</strong> were used to assist with coding,
                implementation, and development tasks.
              </p>
            </div>
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
                Powered by Google M API
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
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Status</p>
                <ul className="space-y-2.5">
                  <li>
                    <Link href="/recruit/status" className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      Status
                    </Link>
                  </li>
                  <li>
                    <Link href="/recruit/preview" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Product Preview</Link>
                  </li>
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
              for the{" "}
              <a href="https://hack.meshapi.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline underline-offset-2 transition-colors">Google M API Hackathon 2026</a>
            </div>
          </div>
        </div>
      </footer>

      <SiteGuideChatbot />
    </div>
  );
}
