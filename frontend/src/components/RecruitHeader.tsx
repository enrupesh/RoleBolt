"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { signOut } from "firebase/auth";
import { getFirebaseAuth, isFirebaseAvailable } from "@/lib/firebaseClient";
import { RoleboltLogo } from "@/components/RoleboltLogo";

const CREATOR_NAV = [
  { href: "/recruit/dashboard", label: "Dashboard" },
  { href: "/recruit/opportunities", label: "Find Jobs" },
  { href: "/recruit/analytics", label: "Analytics" },
  { href: "/recruit/talent-pool", label: "Talent Pool" },
  { href: "/recruit/recruiter-profile", label: "Profile" },
];

export default function RecruitHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { recruitProfile, firebaseUser, signOutFromRecruit } = useRecruitAuth();

  const role = recruitProfile?.role ?? null;
  const isLoggedIn = !!firebaseUser && !!recruitProfile;
  const navLinks = role === "creator" ? CREATOR_NAV : [];

  function isActive(href: string) {
    return pathname === href || (pathname.startsWith(href + "/") && href !== "/recruit");
  }

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
    <header className="sticky top-0 z-50 bg-white/96 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8 gap-4">

        {/* Logo */}
        <Link href="/recruit" className="flex items-center gap-2.5 shrink-0 group">
          <RoleboltLogo size="md" className="transition group-hover:shadow-[0_4px_14px_rgba(10,102,194,0.4)] group-hover:scale-105" />
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-none tracking-tight">Rolebolt</p>
            <p className="text-[10.5px] text-slate-400 leading-none mt-0.5 font-medium">Global Jobs Network</p>
          </div>
          <p className="block sm:hidden text-sm font-bold text-slate-900 leading-none">Rolebolt</p>
        </Link>

        {/* Nav links */}
        {isLoggedIn && navLinks.length > 0 && (
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive(link.href)
                    ? "bg-blue-50 text-[#0a66c2] font-semibold"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {role === "creator" && (
              <Link
                href="/recruit/copilot"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive("/recruit/copilot")
                    ? "bg-violet-50 text-violet-700 font-semibold"
                    : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
                </svg>
                Ask Rolebolt
              </Link>
            )}
          </nav>
        )}

        {!isLoggedIn && (
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            <Link href="/recruit/opportunities" className="flex items-center px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150">
              Find Jobs
            </Link>
            <Link href="/recruit/signup" className="flex items-center px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150">
              For Recruiters
            </Link>
          </nav>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Social icons — always visible */}
          <a
            href="https://instagram.com/rolebolt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-pink-500 hover:bg-pink-50 transition-all duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          <a
            href="https://x.com/rolebolt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
          </a>

          {isLoggedIn ? (
            <>
              {role === "creator" && (
                <Link
                  href="/recruit/jobs/new"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#0a66c2] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(10,102,194,0.28)] hover:bg-[#004182] hover:shadow-[0_4px_14px_rgba(10,102,194,0.36)] hover:-translate-y-px transition-all duration-150"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  Post a Job
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/recruit/login"
                className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
              >
                Sign in
              </Link>
              <Link
                href="/recruit/signup"
                className="inline-flex items-center rounded-lg bg-[#0a66c2] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(10,102,194,0.28)] hover:bg-[#004182] hover:shadow-[0_4px_14px_rgba(10,102,194,0.36)] hover:-translate-y-px transition-all duration-150"
              >
                Get started
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
          >
            {mobileOpen ? (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 pb-5 pt-3 shadow-lg">
          <nav className="flex flex-col gap-1">
            {isLoggedIn && navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive(link.href)
                    ? "bg-blue-50 text-[#0a66c2] font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {!isLoggedIn && (
              <>
                <Link href="/recruit/opportunities" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Find Jobs</Link>
                <Link href="/recruit/login" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign in</Link>
              </>
            )}
            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
              {isLoggedIn ? (
                <>
                  {role === "creator" && (
                    <Link href="/recruit/jobs/new" onClick={() => setMobileOpen(false)} className="rounded-xl bg-[#0a66c2] px-4 py-3 text-center text-sm font-bold text-white">
                      Post a Job →
                    </Link>
                  )}
                  <button onClick={() => { setMobileOpen(false); handleSignOut(); }} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 text-left">
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/recruit/signup" onClick={() => setMobileOpen(false)} className="rounded-xl bg-[#0a66c2] px-4 py-3 text-center text-sm font-bold text-white">
                  Get started free →
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
