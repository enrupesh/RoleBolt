"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { displayHandle } from "@/lib/username";
import { Menu, X } from "lucide-react";
import { isJudgeReviewerEmail } from "@/lib/judgeReviewer";

const NAV = [
  { href: "/seeker/dashboard", label: "Dashboard" },
  { href: "/seeker/career", label: "Career GPS" },
  { href: "/seeker/tracker", label: "Tracker" },
  { href: "/seeker/workspace", label: "Workspace" },
  { href: "/seeker/applications", label: "Rolebolt Apps" },
  { href: "/recruit/opportunities", label: "Browse Jobs" },
];

const TOOLS = [
  { href: "/seeker/resume", label: "Resume" },
  { href: "/seeker/cover-letter", label: "Cover Letter" },
  { href: "/seeker/interview-prep", label: "Interview Prep" },
  { href: "/seeker/email", label: "Email Intel" },
  { href: "/seeker/extension", label: "Extension" },
  { href: "/seeker/profile", label: "Profile" },
  { href: "/seeker/billing", label: "Billing & usage" },
];

export function SeekerHeader() {
  const pathname = usePathname();
  const { authUser, recruitProfile, signOut } = useRecruitAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isJudgeReviewer =
    isJudgeReviewerEmail(authUser?.email) &&
    recruitProfile?.canAccessSeeker === true;

  const linkClass = (href: string) =>
    `block rounded-xl px-3 py-2 text-sm font-medium transition ${
      pathname.startsWith(href)
        ? "bg-indigo-50 text-indigo-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-black/[0.07] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/seeker/dashboard" className="flex items-center gap-2.5">
          <RoleboltLogo size="md" />
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">RoleBolt</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Job Seeker</p>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href).replace("block ", "")}>
              {label}
            </Link>
          ))}
          <div className="relative group ml-1">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              AI Tools ▾
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute right-0 top-full pt-1 z-30 transition-opacity">
              <div className="min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {TOOLS.map(({ href, label }) => (
                  <Link key={href} href={href} className="block px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-2">
          {isJudgeReviewer && (
            <Link
              href="/recruit/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#0a66c2]/30 bg-[#0a66c2]/5 px-3 py-1.5 text-xs font-semibold text-[#0a66c2] transition hover:bg-[#0a66c2]/10"
            >
              Job Creator Dashboard →
            </Link>
          )}
          {authUser && (
            <span className="hidden sm:block text-xs text-slate-500 font-medium truncate max-w-[120px]">
              {displayHandle(authUser ?? recruitProfile)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden rounded-xl border border-slate-200 p-2 text-slate-600"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <button
            onClick={signOut}
            className="hidden sm:block rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Navigate</p>
            <div className="space-y-1">
              {isJudgeReviewer && (
                <Link
                  href="/recruit/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#0a66c2] bg-[#0a66c2]/5"
                >
                  Job Creator Dashboard →
                </Link>
              )}
              {NAV.map(({ href, label }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={linkClass(href)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">AI Tools</p>
            <div className="space-y-1">
              {TOOLS.map(({ href, label }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={linkClass(href)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setMobileOpen(false); signOut(); }}
            className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
