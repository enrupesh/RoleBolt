/**
 * Shared skeleton primitives. All blocks use the .rb-skeleton shimmer class
 * already defined in globals.css (90-degree gradient + rb-shimmer animation).
 */

import React from "react";

interface SkProps {
  className?: string;
  style?: React.CSSProperties;
}

/** Raw skeleton block — shimmer rectangle. */
export function Sk({ className = "", style }: SkProps) {
  return <div className={`rb-skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Single text line skeleton. */
export function SkLine({ w = "100%", h = "h-3.5", className = "" }: { w?: string; h?: string; className?: string }) {
  return <Sk className={`${h} rounded-full ${className}`} style={{ width: w }} />;
}

/** Circle skeleton (avatars, icons). */
export function SkCircle({ size = "h-10 w-10" }: { size?: string }) {
  return <Sk className={`${size} rounded-full`} />;
}

/** Rounded rectangle skeleton (badges, buttons, tags). */
export function SkPill({ w = "w-16", h = "h-5" }: { w?: string; h?: string }) {
  return <Sk className={`${w} ${h} rounded-full`} />;
}

/**
 * Stat card skeleton — matches the "colored top-strip + big number + label" card
 * used on dashboard, analytics, and talent pool.
 */
export function SkStatCard({ bar = "from-slate-200 to-slate-300" }: { bar?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-black/[0.06] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]" aria-hidden="true">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${bar} opacity-40`} />
      <Sk className="h-7 w-14 rounded-lg mt-1" />
      <Sk className="h-3 w-24 rounded-full mt-3" />
      <Sk className="h-2.5 w-16 rounded-full mt-1.5" />
    </div>
  );
}

/**
 * Job card skeleton — 3-column card grid on dashboard.
 */
export function SkJobCard() {
  return (
    <div className="flex flex-col rounded-2xl bg-white border border-black/[0.06] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]" aria-hidden="true">
      <div className="flex items-start justify-between gap-3 mb-4">
        <Sk className="h-10 w-10 rounded-xl" />
        <SkPill w="w-16" h="h-5" />
      </div>
      <SkLine w="75%" h="h-4" className="mb-2" />
      <SkLine w="50%" h="h-3" className="mb-4" />
      <div className="flex gap-1.5 mb-4">
        <SkPill w="w-14" h="h-4" />
        <SkPill w="w-14" h="h-4" />
        <SkPill w="w-14" h="h-4" />
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100">
        <Sk className="h-3 w-20 rounded-full" />
        <Sk className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Candidate card skeleton — used in talent pool.
 */
export function SkCandidateCard() {
  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]" aria-hidden="true">
      <div className="flex items-start gap-3 mb-4">
        <SkCircle size="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <SkLine w="60%" h="h-4" />
          <SkLine w="45%" h="h-3" />
        </div>
        <SkPill w="w-12" h="h-5" />
      </div>
      <div className="space-y-2 mb-4">
        <SkLine w="90%" />
        <SkLine w="75%" />
        <SkLine w="60%" />
      </div>
      <div className="flex gap-1.5">
        <SkPill w="w-16" h="h-4" />
        <SkPill w="w-20" h="h-4" />
      </div>
    </div>
  );
}

/**
 * Analytics funnel row skeleton.
 */
export function SkFunnelRow() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <Sk className="h-3 w-16 rounded-full shrink-0" />
      <Sk className="h-2.5 flex-1 rounded-full" />
      <Sk className="h-3 w-20 rounded-full shrink-0" />
    </div>
  );
}

/**
 * Generic section card skeleton — white rounded card with title + content rows.
 */
export function SkSectionCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]" aria-hidden="true">
      <SkLine w="30%" h="h-3" className="mb-5" />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => <SkFunnelRow key={i} />)}
      </div>
    </div>
  );
}

/**
 * Form question skeleton — used on public form page.
 */
export function SkFormQuestion() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <SkLine w="45%" h="h-3.5" />
      <Sk className="h-11 w-full rounded-xl" />
    </div>
  );
}
