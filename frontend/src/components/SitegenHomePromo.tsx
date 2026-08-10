"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { sitegenProduct } from "@/products/sitegen/config/product";

function Arrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function SitegenAnimatedBorder({
  children,
  className = "",
  radiusClass = "rounded-2xl",
}: {
  children: ReactNode;
  className?: string;
  radiusClass?: string;
}) {
  return (
    <div className={`relative ${radiusClass} p-[2px] ${className}`}>
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${radiusClass}`} aria-hidden="true">
        <div
          className={`absolute inset-[-120%] sitegen-border-spin bg-[conic-gradient(from_0deg,transparent_0deg,transparent_286deg,#c4b5fd_312deg,#a78bfa_328deg,#e879f9_344deg,transparent_360deg)]`}
        />
      </div>
      <div className={`relative ${radiusClass} bg-gradient-to-br from-[#faf7ff] to-white`}>
        {children}
      </div>
    </div>
  );
}

export function SitegenHeroPromoCard() {
  return (
    <SitegenAnimatedBorder className="max-w-xl shadow-[0_10px_30px_rgba(91,63,140,.08)]">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b4fa8]">
              <span className="rounded-full bg-[#ede4ff] px-2 py-0.5 text-[10px] text-[#5b3f8c]">New</span>
              Sitegen
            </p>
            <p className="mt-2 text-sm font-semibold text-[#10263d]">Need a portfolio or business website?</p>
            <p className="mt-1 text-sm leading-6 text-[#667d8f]">
              Create a free site at <span className="font-medium text-[#38546d]">{sitegenProduct.publicUrlPattern.replace("{username}", "yourname")}</span> — no Rolebolt account required.
            </p>
          </div>
          <Link
            href="/website"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#d8c8f5] bg-white px-4 py-3 text-sm font-semibold text-[#5b3f8c] transition hover:border-[#b79ce8] hover:bg-[#faf7ff] hover:text-[#4a2f78]"
          >
            Build free website
            <Arrow />
          </Link>
        </div>
      </div>
    </SitegenAnimatedBorder>
  );
}

function SitegenPreviewMockup({ interactive = false }: { interactive?: boolean }) {
  const [usernamePreview, setUsernamePreview] = useState("yourname");
  const username = interactive ? (usernamePreview || "yourname") : "yourname";

  return (
    <SitegenAnimatedBorder radiusClass="rounded-[2rem]" className="shadow-[0_30px_100px_rgba(0,0,0,.45)]">
      <div className="rounded-[calc(2rem-2px)] border border-white/10 bg-[#130a24]/95 p-4 backdrop-blur-sm sm:p-5">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0c0618] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <div className="ml-3 flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-violet-100/70">
            {sitegenProduct.publicHost}/<span className="text-white">{username}</span>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1033] to-[#2a1450]">
          <div className="border-b border-white/10 px-5 py-8">
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 shadow-[0_0_40px_rgba(167,139,250,.35)]" />
            <div className="mx-auto mt-4 h-3 w-32 rounded-full bg-white/20" />
            <div className="mx-auto mt-2 h-2.5 w-48 rounded-full bg-white/10" />
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="h-2 w-16 rounded-full bg-white/15" />
                <div className="mt-3 h-2 w-full rounded-full bg-white/10" />
                <div className="mt-2 h-2 w-4/5 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
        {interactive ? (
          <label className="mt-4 block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/50">Preview your URL</span>
            <input
              type="text"
              value={usernamePreview}
              onChange={(event) => setUsernamePreview(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30))}
              placeholder="yourname"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/50"
            />
          </label>
        ) : null}
      </div>
    </SitegenAnimatedBorder>
  );
}

const showcasePoints = [
  "Job Seeker or Creator — pick the path that fits you",
  "AI structures your resume into website sections",
  "Four professional themes — no code, no drag-and-drop",
  "Publish at www.rolebolt.tech/yourname in minutes",
];

export function SitegenShowcaseSection() {
  return (
    <section id="sitegen" className="scroll-mt-20 bg-[#f8fbfd] px-5 py-14 sm:py-16 lg:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-[#e4d8f8] bg-[#0c0618] text-white shadow-[0_24px_80px_rgba(91,63,140,.14)] sm:rounded-[2.25rem]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-violet-600/20 blur-[100px]" />
          <div className="absolute right-0 top-10 h-[360px] w-[360px] rounded-full bg-fuchsia-500/15 blur-[90px]" />
          <div className="absolute bottom-0 left-1/3 h-[280px] w-[280px] rounded-full bg-indigo-500/10 blur-[80px]" />
        </div>

        <div className="relative px-5 py-12 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              New from Rolebolt
            </p>
            <h2 className="mt-6 font-display text-4xl font-semibold leading-[1.06] tracking-[-0.06em] text-white sm:text-5xl lg:text-[3.4rem]">
              Create your professional website —{" "}
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">free.</span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-violet-100/65 sm:text-lg">
              <strong className="font-semibold text-white">Sitegen</strong> turns your resume or business details into a polished public site at{" "}
              <span className="font-medium text-white">{sitegenProduct.publicUrlPattern}</span>.
              AI organizes your content — our themes make it beautiful.
            </p>

            <ul className="mt-8 space-y-3">
              {showcasePoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm leading-6 text-violet-100/75 sm:text-base">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/website"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-[#1a1033] shadow-[0_16px_50px_rgba(255,255,255,.12)] transition hover:-translate-y-0.5 hover:bg-violet-50"
              >
                Explore Sitegen
                <Arrow />
              </Link>
              <Link
                href="/website"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                Build free website
                <Arrow />
              </Link>
            </div>
            <p className="mt-4 text-sm text-violet-200/45">No payment. No Rolebolt account. Username + password to manage your site.</p>
          </div>

          <div className="relative">
            <SitegenPreviewMockup interactive />
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
