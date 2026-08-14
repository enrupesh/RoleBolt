"use client";

import Link from "next/link";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { JudgesTestingKit } from "@/components/JudgesTestingKit";

export default function JudgesHackathonPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5 shrink-0">
            <RoleboltLogo className="h-7 w-7" />
            <div className="leading-none">
              <p className="text-[14px] font-black text-slate-950 tracking-tight">Rolebolt</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">For Hackathon Judges</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/recruit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-all"
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:56px_56px] pointer-events-none" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[900px] rounded-full bg-[#0a66c2]/18 blur-[100px] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20 sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/8 px-4 py-1.5 text-[11px] font-bold text-amber-300 mb-6 uppercase tracking-widest">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Hackathon Judges
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl leading-tight">
            Everything you need to<br />evaluate Rolebolt.
          </h1>
          <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-xl mx-auto">
            Sample jobs, ready-made resumes, and pre-written answers so you can test the full hiring workflow in minutes — no setup required.
          </p>
        </div>
      </section>

      {/* ── Testing kit ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <JudgesTestingKit dark={false} />

      </main>
    </div>
  );
}
