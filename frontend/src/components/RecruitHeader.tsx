"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { displayHandle } from "@/lib/username";

const CREATOR_NAV = [
  { href: "/recruit/dashboard", label: "Dashboard" },
  { href: "/recruit/opportunities", label: "Find Jobs" },
  { href: "/recruit/analytics", label: "Analytics" },
  { href: "/recruit/talent-pool", label: "Talent Pool" },
  { href: "/recruit/recruiter-profile", label: "Profile" },
  { href: "/recruit/billing", label: "Billing" },
];

export default function RecruitHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { recruitProfile, authUser, signOutFromRecruit } = useRecruitAuth();

  const role = recruitProfile?.role ?? null;
  const isLoggedIn = !!authUser && !!recruitProfile;
  const navLinks = role === "creator" ? CREATOR_NAV : [];

  function isActive(href: string) {
    return pathname === href || (pathname.startsWith(href + "/") && href !== "/recruit");
  }

  async function handleSignOut() {
    try {
      await signOutFromRecruit();
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

          {isLoggedIn && authUser && (
            <span className="hidden sm:block text-xs text-slate-500 font-medium truncate max-w-[120px]">
              {displayHandle(authUser ?? recruitProfile)}
            </span>
          )}

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
