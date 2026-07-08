"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";

const NICHES = [
  { label: "AI, Data, Software & Product Tech", emoji: "💻", slug: "ai-tech" },
  { label: "Sales, Business Development & Revenue Roles", emoji: "📈", slug: "sales-bd" },
  { label: "Finance, Accounting, Banking & Fintech", emoji: "💰", slug: "finance-fintech" },
  { label: "Healthcare, Pharma & Allied Medical Workforce", emoji: "🏥", slug: "healthcare" },
  { label: "Skilled Blue-Collar, Logistics & Industrial Workforce", emoji: "🔧", slug: "blue-collar-logistics" },
  { label: "Creative, Marketing, Media & Design", emoji: "🎨", slug: "creative-marketing" },
];

const SEEKER_FEATURES = [
  "Deep niche filters", "AI match score", "Salary transparency",
  "Remote / Hybrid / Onsite", "Skills match", "Notice period filter",
  "Freshers allowed", "Verified companies", "Save & track jobs",
];

const RECRUITER_FEATURES = [
  "AI job description writer", "Applicant pipeline", "Candidate scoring",
  "Async assessments", "Hiring decision engine", "Rejection email generator",
  "Talent pool", "Company profile", "Interview briefs",
];

const SEEKER_SHORTCUTS = [
  { href: "/recruit/opportunities", label: "🔍 Find Jobs" },
  { href: "/recruit/saved-jobs", label: "🔖 Saved Jobs" },
  { href: "/recruit/my-applications", label: "📋 My Applications" },
  { href: "/recruit/profile", label: "👤 My Profile" },
];

const CREATOR_SHORTCUTS = [
  { href: "/recruit/dashboard", label: "📊 Dashboard" },
  { href: "/recruit/jobs/new", label: "➕ Post a Job" },
  { href: "/recruit/analytics", label: "📈 Analytics" },
  { href: "/recruit/talent-pool", label: "👥 Talent Pool" },
];

function ArrowIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function RecruitLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { recruitProfile, firebaseUser, signOutFromRecruit } = useRecruitAuth();

  const role = recruitProfile?.role ?? null;
  const isLoggedIn = !!firebaseUser && !!recruitProfile;
  const shortcuts = role === "seeker" ? SEEKER_SHORTCUTS : role === "creator" ? CREATOR_SHORTCUTS : null;

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    await signOutFromRecruit();
    await signOut(auth);
    router.replace("/recruit/login");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5 shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0a66c2] text-sm font-black text-white">R</span>
            <span>
              <span className="block text-sm font-bold leading-tight">Plyndrox Recruit AI</span>
              <span className="block text-[11px] text-slate-500 leading-tight">Plyndrox Jobs Network</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/recruit/opportunities" className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition">Find Jobs</Link>
            {!isLoggedIn && (
              <>
                <Link href="/recruit/signup" className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition">For Job Seekers</Link>
                <Link href="/recruit/signup" className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition">For Recruiters</Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Link
                  href={role === "creator" ? "/recruit/dashboard" : "/recruit/opportunities"}
                  className="hidden sm:inline-flex rounded-full border border-[#0a66c2] px-4 py-2 text-xs font-semibold text-[#0a66c2] hover:bg-blue-50 transition"
                >
                  {role === "creator" ? "Go to Dashboard" : "Browse Jobs"}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/recruit/login" className="hidden sm:inline-flex rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                  Sign in
                </Link>
                <Link href="/recruit/signup" className="rounded-full bg-[#0a66c2] px-4 py-2 text-xs font-bold text-white hover:bg-[#004182] transition">
                  Get started
                </Link>
              </>
            )}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 pb-4 pt-2">
            <nav className="flex flex-col gap-1">
              {[
                { href: "/recruit/opportunities", label: "Find Jobs" },
                ...(!isLoggedIn ? [{ href: "/recruit/login", label: "Sign in" }, { href: "/recruit/signup", label: "Create account" }] : []),
                ...(role === "creator" ? [{ href: "/recruit/dashboard", label: "Dashboard" }] : []),
                ...(role === "seeker" ? [{ href: "/recruit/profile", label: "My Profile" }] : []),
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  {link.label}
                </Link>
              ))}
              {!isLoggedIn && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <Link
                    href="/recruit/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-xl bg-[#0a66c2] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#004182] transition"
                  >
                    Get started →
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0a66c2]/20 bg-blue-50 px-4 py-1.5 text-xs font-bold text-[#0a66c2]">
              <span>✦</span> India-first hiring across 6 niches
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl leading-tight">
              LinkedIn meets serious<br />job search for India.
            </h1>
            <p className="mt-5 text-base sm:text-lg leading-8 text-slate-600 max-w-xl">
              Deep job filters, AI-powered candidate scoring, verified companies, and a complete hiring workflow — built for Indian job seekers and recruiters.
            </p>

            {isLoggedIn ? (
              <>
                <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0a66c2] mb-3">
                    Welcome back — {role === "creator" ? "Job Creator" : "Job Seeker"} dashboard
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shortcuts?.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-full border border-[#0a66c2]/30 bg-white px-4 py-2 text-xs font-semibold text-[#0a66c2] hover:bg-[#0a66c2] hover:text-white transition"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/recruit/opportunities"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#004182] transition shadow-sm"
                  >
                    Explore open roles <ArrowIcon />
                  </Link>
                  <Link
                    href="/recruit/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 transition shadow-sm"
                  >
                    Create free account
                  </Link>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-slate-500 self-center">Quick access:</span>
                  <Link href="/recruit/opportunities" className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-[#0a66c2]/30 hover:text-[#0a66c2] transition">
                    🔍 Browse jobs
                  </Link>
                  <Link href="/recruit/signup" className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-[#0a66c2]/30 hover:text-[#0a66c2] transition">
                    🎯 Seeker signup
                  </Link>
                  <Link href="/recruit/signup" className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-[#0a66c2]/30 hover:text-[#0a66c2] transition">
                    🏢 Recruiter signup
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Preview card */}
          <div className="mt-12 lg:mt-0">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 shadow-sm">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3 text-sm text-slate-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                Search role, skill, city, company…
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["Niche", "Salary", "Remote", "Seniority", "Freshers", "Verified"].map(f => (
                  <div key={f} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 text-center">{f}</div>
                ))}
              </div>
              <div className="mt-3 space-y-2.5">
                {[
                  { title: "Senior AI Engineer", sub: "AI & Tech · Bengaluru · Hybrid", badge: "✓ Verified" },
                  { title: "B2B Sales Manager", sub: "Sales · Mumbai · Remote", badge: "✓ Verified" },
                  { title: "Healthcare Lead", sub: "Healthcare · Delhi · Onsite", badge: "Freshers ok" },
                ].map(job => (
                  <div key={job.title} className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{job.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{job.sub}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${job.badge.includes("Verified") ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{job.badge}</span>
                  </div>
                ))}
              </div>
              <Link href="/recruit/opportunities" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#0a66c2] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#004182] transition">
                Browse all open roles <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Seeker / Recruiter split */}
      <section className="border-t border-slate-100 bg-[#f3f6f8] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#0a66c2] mb-2">Who it's for</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Built for both sides of hiring</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">🎯</div>
                <div>
                  <h3 className="font-bold text-slate-900">For Job Seekers</h3>
                  <p className="text-xs text-slate-500">Search, apply, track</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {SEEKER_FEATURES.map(f => (
                  <span key={f} className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">{f}</span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/recruit/opportunities" className="flex-1 rounded-full bg-[#0a66c2] px-5 py-2.5 text-center text-xs font-bold text-white hover:bg-[#004182] transition">
                  Browse jobs
                </Link>
                {!isLoggedIn && (
                  <Link href="/recruit/signup" className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                    Sign up as Seeker
                  </Link>
                )}
                {role === "seeker" && (
                  <Link href="/recruit/profile" className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                    My Profile
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">🏢</div>
                <div>
                  <h3 className="font-bold text-slate-900">For Recruiters</h3>
                  <p className="text-xs text-slate-500">Post, evaluate, hire</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {RECRUITER_FEATURES.map(f => (
                  <span key={f} className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">{f}</span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {!isLoggedIn && (
                  <>
                    <Link href="/recruit/signup" className="flex-1 rounded-full bg-[#0a66c2] px-5 py-2.5 text-center text-xs font-bold text-white hover:bg-[#004182] transition">
                      Sign up as Creator
                    </Link>
                    <Link href="/recruit/login" className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                      Sign in
                    </Link>
                  </>
                )}
                {role === "creator" && (
                  <>
                    <Link href="/recruit/jobs/new" className="flex-1 rounded-full bg-[#0a66c2] px-5 py-2.5 text-center text-xs font-bold text-white hover:bg-[#004182] transition">
                      Post a job
                    </Link>
                    <Link href="/recruit/dashboard" className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                      Dashboard
                    </Link>
                  </>
                )}
                {role === "seeker" && (
                  <Link href="/recruit/opportunities" className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                    Browse recruiter-posted jobs →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Niches */}
      <section className="border-t border-slate-100 bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#0a66c2] mb-2">Six focused markets</p>
              <h2 className="text-2xl font-bold">Niche-first, not generic-first</h2>
            </div>
            <Link href="/recruit/opportunities" className="text-sm font-bold text-[#0a66c2] hover:underline hidden sm:block">
              Browse all →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NICHES.map(({ label, emoji, slug }) => (
              <Link
                key={label}
                href={`/recruit/niche/${slug}`}
                className="group rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 hover:border-[#0a66c2]/30 hover:bg-blue-50/30 transition"
              >
                <span className="text-2xl">{emoji}</span>
                <p className="mt-2 font-bold text-slate-900 group-hover:text-[#0a66c2] transition text-sm leading-snug">{label}</p>
                <p className="mt-1 text-xs text-slate-500">Explore jobs, skills & roles →</p>
              </Link>
            ))}
          </div>
          <div className="mt-6 sm:hidden text-center">
            <Link href="/recruit/opportunities" className="text-sm font-bold text-[#0a66c2] hover:underline">
              Browse all opportunities →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-slate-200 bg-[#0a66c2] py-14 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to find your next role?</h2>
          <p className="mt-3 text-blue-100 text-sm sm:text-base">
            Join thousands of Indian professionals finding better jobs through Plyndrox Recruit AI.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/recruit/opportunities" className="rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[#0a66c2] hover:bg-blue-50 transition shadow">
              Browse open roles
            </Link>
            {isLoggedIn ? (
              <Link
                href={role === "seeker" ? "/recruit/profile" : "/recruit/dashboard"}
                className="rounded-full border border-white/30 bg-white/10 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition"
              >
                {role === "seeker" ? "My Profile" : "Recruiter Dashboard"}
              </Link>
            ) : (
              <Link href="/recruit/signup" className="rounded-full border border-white/30 bg-white/10 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition">
                Create free account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
