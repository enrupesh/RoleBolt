"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";

const NAV = [
  { href: "/seeker/dashboard",     label: "Dashboard" },
  { href: "/seeker/workspace",     label: "Job Workspace" },
  { href: "/seeker/applications",  label: "My Applications" },
  { href: "/seeker/profile",       label: "My Profile" },
  { href: "/recruit/opportunities",label: "Browse Jobs" },
];

export function SeekerHeader() {
  const pathname   = usePathname();
  const { authUser, signOut } = useRecruitAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-black/[0.07] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/seeker/dashboard" className="flex items-center gap-2.5">
          <RoleboltLogo size="md" />
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">RoleBolt</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Job Seeker</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                pathname.startsWith(href)
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          {authUser && (
            <span className="hidden sm:block text-xs text-slate-500 font-medium truncate max-w-[140px]">
              {authUser.name || authUser.email}
            </span>
          )}
          <button
            onClick={signOut}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
