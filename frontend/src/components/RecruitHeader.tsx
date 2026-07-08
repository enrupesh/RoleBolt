"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { useTheme } from "@/components/ThemeProvider";

type NavLink = { href: string; label: string };

const SEEKER_NAV: NavLink[] = [
  { href: "/recruit/opportunities", label: "Find Jobs" },
  { href: "/recruit/niches", label: "Niches" },
  { href: "/recruit/saved-jobs", label: "Saved Jobs" },
  { href: "/recruit/job-alerts", label: "Job Alerts" },
  { href: "/recruit/my-applications", label: "My Applications" },
  { href: "/recruit/profile", label: "My Profile" },
];

const CREATOR_NAV: NavLink[] = [
  { href: "/recruit/dashboard", label: "Dashboard" },
  { href: "/recruit/analytics", label: "Analytics" },
  { href: "/recruit/talent-pool", label: "Talent Pool" },
  { href: "/recruit/recruiter-profile", label: "Recruiter Profile" },
];

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

function SunIcon() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "white" : "dark")}
      title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export default function RecruitHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { recruitProfile, firebaseUser, signOutFromRecruit } = useRecruitAuth();

  const role = recruitProfile?.role ?? null;
  const isLoggedIn = !!firebaseUser && !!recruitProfile;
  const navLinks = role === "creator" ? CREATOR_NAV : role === "seeker" ? SEEKER_NAV : [];

  function isActive(href: string) {
    if (href === "/recruit/niches") {
      return pathname === href || pathname.startsWith("/recruit/niche/");
    }
    return pathname === href || (pathname.startsWith(href + "/") && href !== "/recruit");
  }

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    await signOutFromRecruit();
    await signOut(auth);
    router.replace("/recruit/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/recruit" className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0a66c2] text-sm font-black text-white">R</span>
          <span className="hidden sm:block">
            <span className="block text-sm font-bold leading-tight text-[var(--foreground)]">Plyndrox Recruit AI</span>
            <span className="block text-[11px] text-[var(--text-muted)] leading-tight">India Jobs Network</span>
          </span>
          <span className="block sm:hidden text-sm font-bold text-[var(--foreground)]">Plyndrox Recruit AI</span>
        </Link>

        {isLoggedIn && navLinks.length > 0 && (
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  isActive(link.href)
                    ? "bg-blue-500/10 text-[#0a66c2]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {!isLoggedIn && (
          <nav className="hidden md:flex items-center gap-0.5">
            <Link href="/recruit/opportunities" className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] transition">
              Find Jobs
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isLoggedIn ? (
            <>
              {role === "creator" && (
                <Link
                  href="/recruit/jobs/new"
                  className="hidden sm:inline-flex rounded-full bg-[#0a66c2] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#004182] transition"
                >
                  Post a job
                </Link>
              )}
              {role === "seeker" && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-[11px] font-semibold text-[#0a66c2]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0a66c2]" />
                  Job Seeker
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-flex rounded-full border border-[var(--border)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/recruit/login"
                className="hidden sm:inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition"
              >
                Sign in
              </Link>
              <Link
                href="/recruit/signup"
                className="rounded-full bg-[#0a66c2] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#004182] transition"
              >
                Get started
              </Link>
            </>
          )}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition"
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-4 pt-2">
          <nav className="flex flex-col gap-1">
            {isLoggedIn && navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive(link.href)
                    ? "bg-blue-500/10 text-[#0a66c2]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {!isLoggedIn && (
              <Link href="/recruit/opportunities" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition">
                Find Jobs
              </Link>
            )}
            <div className="mt-2 border-t border-[var(--border)] pt-2 flex flex-col gap-1">
              {isLoggedIn ? (
                <>
                  {role === "creator" && (
                    <Link
                      href="/recruit/jobs/new"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl bg-[#0a66c2] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#004182] transition"
                    >
                      Post a job →
                    </Link>
                  )}
                  <button
                    onClick={() => { setMobileOpen(false); handleSignOut(); }}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition text-left"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/recruit/login" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition">
                    Sign in
                  </Link>
                  <Link href="/recruit/signup" onClick={() => setMobileOpen(false)} className="rounded-xl bg-[#0a66c2] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#004182] transition">
                    Get started →
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
