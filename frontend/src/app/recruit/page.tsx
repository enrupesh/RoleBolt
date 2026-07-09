"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { signOut } from "firebase/auth";
import { getFirebaseAuth, isFirebaseAvailable } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";

const NICHES = [
  { label: "AI, Data & Software", full: "AI, Data, Software & Product Tech", emoji: "💻", color: "from-blue-50 to-indigo-50 border-blue-100 hover:border-blue-300", text: "text-blue-700" },
  { label: "Sales & Business Dev", full: "Sales, Business Development & Revenue Roles", emoji: "📈", color: "from-emerald-50 to-teal-50 border-emerald-100 hover:border-emerald-300", text: "text-emerald-700" },
  { label: "Finance & Fintech", full: "Finance, Accounting, Banking & Fintech", emoji: "💰", color: "from-amber-50 to-yellow-50 border-amber-100 hover:border-amber-300", text: "text-amber-700" },
  { label: "Healthcare & Pharma", full: "Healthcare, Pharma & Allied Medical Workforce", emoji: "🏥", color: "from-rose-50 to-pink-50 border-rose-100 hover:border-rose-300", text: "text-rose-700" },
  { label: "Blue-Collar & Logistics", full: "Skilled Blue-Collar, Logistics & Industrial Workforce", emoji: "🔧", color: "from-orange-50 to-amber-50 border-orange-100 hover:border-orange-300", text: "text-orange-700" },
  { label: "Creative & Marketing", full: "Creative, Marketing, Media & Design", emoji: "🎨", color: "from-violet-50 to-purple-50 border-violet-100 hover:border-violet-300", text: "text-violet-700" },
];

const FEATURES = [
  { icon: "✦", label: "AI job description writer" },
  { icon: "✦", label: "Resume parsing & AI scoring" },
  { icon: "✦", label: "Async candidate assessments" },
  { icon: "✦", label: "Hiring decision engine" },
  { icon: "✦", label: "Candidate pipeline & ATS" },
  { icon: "✦", label: "Talent pool management" },
  { icon: "✦", label: "Interview brief generator" },
  { icon: "✦", label: "Rejection email automation" },
  { icon: "✦", label: "Analytics & funnel insights" },
];

const STATS = [
  { value: "6", label: "Industry niches" },
  { value: "AI", label: "Powered scoring" },
  { value: "Free", label: "No hidden fees" },
  { value: "Global", label: "Global reach" },
];

export default function RecruitLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { recruitProfile, firebaseUser, signOutFromRecruit } = useRecruitAuth();

  const role = recruitProfile?.role ?? null;
  const isLoggedIn = !!firebaseUser && !!recruitProfile;

  async function handleSignOut() {
    try {
      await signOutFromRecruit();
      if (isFirebaseAvailable()) {
        const auth = getFirebaseAuth();
        await signOut(auth);
      }
    } catch {}
    router.replace("/recruit/login");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-50 bg-white/96 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a66c2] text-white font-black text-sm shadow-[0_2px_8px_rgba(10,102,194,0.3)] group-hover:shadow-[0_4px_14px_rgba(10,102,194,0.4)] group-hover:scale-105 transition-all">
              R
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none tracking-tight">Rolebolt</p>
              <p className="text-[10.5px] text-slate-400 leading-none mt-0.5 font-medium">Global Jobs Network</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            <Link href="/recruit/opportunities" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all">Find Jobs</Link>
            {!isLoggedIn && <Link href="/recruit/signup" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all">For Recruiters</Link>}
            {isLoggedIn && role === "creator" && (
              <>
                <Link href="/recruit/dashboard" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all">Dashboard</Link>
                <Link href="/recruit/analytics" className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all">Analytics</Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Link href="/recruit/dashboard" className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-all">
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-all">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/recruit/login" className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-all">
                  Sign in
                </Link>
                <Link href="/recruit/signup" className="inline-flex rounded-lg bg-[#0a66c2] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(10,102,194,0.28)] hover:bg-[#004182] hover:shadow-[0_4px_14px_rgba(10,102,194,0.36)] hover:-translate-y-px transition-all">
                  Get started free
                </Link>
              </>
            )}
            <button onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu" className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
              {mobileMenuOpen
                ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              }
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 pb-5 pt-3">
            <nav className="flex flex-col gap-1">
              <Link href="/recruit/opportunities" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Find Jobs</Link>
              {isLoggedIn ? (
                <>
                  <Link href="/recruit/dashboard" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Dashboard</Link>
                  <button onClick={() => { setMobileMenuOpen(false); handleSignOut(); }} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 text-left">Sign out</button>
                </>
              ) : (
                <>
                  <Link href="/recruit/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign in</Link>
                  <Link href="/recruit/signup" onClick={() => setMobileMenuOpen(false)} className="mt-1 rounded-xl bg-[#0a66c2] px-4 py-3 text-center text-sm font-bold text-white">Get started free →</Link>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(10,102,194,0.06)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(79,70,229,0.04)_0%,transparent_60%)] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 pt-16 pb-14 sm:px-6 sm:pt-22 sm:pb-18 lg:grid lg:grid-cols-2 lg:gap-14 lg:items-center lg:px-8 lg:pt-24 lg:pb-24">
          <div className="rb-animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-bold text-[#0a66c2] mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0a66c2] animate-pulse" />
              AI-powered hiring platform
            </div>

            <h1 className="text-[2.75rem] font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem] leading-[1.08]">
              Hire smarter.<br />
              <span className="text-[#0a66c2]">Find faster.</span>
            </h1>

            <p className="mt-5 text-lg text-slate-500 leading-relaxed max-w-lg">
              AI-powered ATS for recruiters worldwide — score resumes, run async assessments, and manage your full hiring pipeline. Completely free.
            </p>

            {isLoggedIn ? (
              <div className="mt-8 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0a66c2] mb-3">Welcome back</p>
                <div className="flex flex-wrap gap-2">
                  {role === "creator" && [
                    { href: "/recruit/dashboard", label: "📊 Dashboard" },
                    { href: "/recruit/jobs/new", label: "➕ Post a Job" },
                    { href: "/recruit/analytics", label: "📈 Analytics" },
                    { href: "/recruit/talent-pool", label: "👥 Talent Pool" },
                  ].map(item => (
                    <Link key={item.href} href={item.href}
                      className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-[#0a66c2] hover:bg-[#0a66c2] hover:text-white hover:border-[#0a66c2] hover:-translate-y-px transition-all duration-150 shadow-sm">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/recruit/opportunities"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(10,102,194,0.32)] hover:bg-[#004182] hover:shadow-[0_6px_20px_rgba(10,102,194,0.4)] hover:-translate-y-0.5 transition-all duration-150">
                  Browse open roles
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <Link href="/recruit/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-150">
                  Start hiring free
                </Link>
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {["No credit card", "Free forever", "AI-powered", "Global"].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Preview card */}
          <div className="mt-14 lg:mt-0 rb-animate-fade-up rb-delay-200">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-100/50 to-indigo-100/50 rounded-3xl blur-xl" />
              <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden">
                {/* Mini search bar */}
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400 mb-4">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  Search role, skill, city…
                </div>
                {/* Filter pills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {["Remote", "Senior", "Freshers ok", "Verified", "₹10L+"].map(f => (
                    <span key={f} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">{f}</span>
                  ))}
                </div>
                {/* Job cards */}
                <div className="space-y-2.5">
                  {[
                    { title: "Senior AI Engineer", company: "TechCorp", loc: "Bengaluru · Remote", score: 92, tag: "✦ Verified", tagColor: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                    { title: "B2B Sales Manager", company: "GrowthCo", loc: "Mumbai · Hybrid", score: 87, tag: "Freshers ok", tagColor: "bg-amber-50 text-amber-700 border-amber-200" },
                    { title: "Product Designer", company: "Designify", loc: "Remote", score: 81, tag: "✦ Verified", tagColor: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                  ].map((job, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-blue-200 hover:shadow-[0_3px_10px_rgba(10,102,194,0.08)] transition-all duration-150 cursor-pointer group">
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">{job.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{job.company} · {job.loc}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${job.tagColor}`}>{job.tag}</span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-black text-[#0a66c2]">{job.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/recruit/opportunities" className="mt-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-[#0a66c2] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#004182] transition-all duration-150">
                  Browse all open roles →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200">
              {STATS.map(stat => (
                <div key={stat.label} className="py-5 px-6 text-center">
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{stat.value}</p>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0a66c2] mb-3">Built for hiring teams</p>
            <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight sm:text-4xl">Everything a modern<br />recruiter needs</h2>
            <p className="mt-4 text-slate-500 text-base leading-relaxed">End-to-end hiring from first job post to final offer — all AI-assisted, all free.</p>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {[
                  { group: "Create", items: ["AI job description writer", "Custom application forms", "Public job board"] },
                  { group: "Evaluate", items: ["Resume parsing & AI scoring", "Async candidate assessments", "Interview brief generator"] },
                  { group: "Decide", items: ["Hiring decision engine", "Rejection email automation", "Analytics & funnel insights"] },
                ].map(col => (
                  <div key={col.group} className="p-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0a66c2] mb-3">{col.group}</p>
                    <ul className="space-y-2.5">
                      {col.items.map(item => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-500 mt-0.5 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-slate-600 font-medium">Ready to start hiring smarter?</p>
                <div className="flex gap-2">
                  {!isLoggedIn ? (
                    <>
                      <Link href="/recruit/signup" className="rounded-lg bg-[#0a66c2] px-4 py-2 text-xs font-bold text-white shadow-[0_2px_8px_rgba(10,102,194,0.25)] hover:bg-[#004182] transition-all">Get started free</Link>
                      <Link href="/recruit/login" className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition-all">Sign in</Link>
                    </>
                  ) : (
                    <Link href="/recruit/jobs/new" className="rounded-lg bg-[#0a66c2] px-4 py-2 text-xs font-bold text-white shadow-[0_2px_8px_rgba(10,102,194,0.25)] hover:bg-[#004182] transition-all">Post a job</Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Niches ── */}
      <section className="py-16 bg-[#f8fafc] border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0a66c2] mb-2">Six focused markets</p>
              <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">Niche-first hiring</h2>
            </div>
            <Link href="/recruit/opportunities" className="text-sm font-bold text-[#0a66c2] hover:text-[#004182] hover:underline hidden sm:block transition-colors">
              Browse all →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NICHES.map(({ label, full, emoji, color, text }) => (
              <Link
                key={label}
                href={`/recruit/opportunities?niche=${encodeURIComponent(full)}`}
                className={`group rounded-2xl border bg-gradient-to-br ${color} p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)]`}
              >
                <span className="text-2xl">{emoji}</span>
                <p className={`mt-3 font-bold text-slate-900 text-sm leading-snug group-hover:${text} transition-colors`}>{label}</p>
                <p className="mt-1 text-xs text-slate-500 group-hover:text-slate-600 transition-colors">Browse jobs →</p>
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center sm:hidden">
            <Link href="/recruit/opportunities" className="text-sm font-bold text-[#0a66c2] hover:underline">Browse all opportunities →</Link>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="py-16 bg-[#0a66c2]">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-blue-200 text-[11px] font-bold uppercase tracking-[0.12em] mb-3">Get started today</p>
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl tracking-tight">Hire smarter, not harder.</h2>
          <p className="mt-4 text-blue-100 text-base leading-relaxed">
            AI-powered hiring for recruiters worldwide — completely free, no limits.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {isLoggedIn ? (
              <Link href="/recruit/dashboard" className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[#0a66c2] hover:bg-blue-50 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:-translate-y-0.5">
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/recruit/signup" className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[#0a66c2] hover:bg-blue-50 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:-translate-y-0.5">
                  Get started free
                </Link>
                <Link href="/recruit/opportunities" className="inline-flex items-center justify-center rounded-xl border-2 border-white/25 bg-white/10 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition-all hover:-translate-y-0.5">
                  Browse open roles
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
