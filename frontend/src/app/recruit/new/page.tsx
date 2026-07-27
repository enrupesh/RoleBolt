"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import { RoleboltLogo } from "@/components/RoleboltLogo";

function NewJobChoiceContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (sessionToken !== undefined) setLoading(false);
  }, [sessionToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 animate-[rb-fade-in_0.3s_ease_both]">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl rb-skeleton" />
              <div className="h-4 w-16 rounded-full rb-skeleton" />
            </div>
            <div className="h-4 w-28 rounded-full rb-skeleton" />
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="text-center mb-10 space-y-2">
            <div className="h-7 w-48 rounded-lg rb-skeleton mx-auto" />
            <div className="h-4 w-64 rounded-full rb-skeleton mx-auto" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-slate-200 bg-white p-7 space-y-4">
              <div className="h-12 w-12 rounded-2xl rb-skeleton" />
              <div className="h-5 w-40 rounded-lg rb-skeleton" />
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded-full rb-skeleton" />
                <div className="h-3.5 w-4/5 rounded-full rb-skeleton" />
                <div className="h-3.5 w-3/5 rounded-full rb-skeleton" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full rb-skeleton" />
                <div className="h-5 w-20 rounded-full rb-skeleton" />
              </div>
            </div>
            <div className="rounded-3xl border-2 border-slate-200 bg-white p-7 space-y-4">
              <div className="h-12 w-12 rounded-2xl rb-skeleton" />
              <div className="h-5 w-32 rounded-lg rb-skeleton" />
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded-full rb-skeleton" />
                <div className="h-3.5 w-4/5 rounded-full rb-skeleton" />
                <div className="h-3.5 w-3/5 rounded-full rb-skeleton" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full rb-skeleton" />
                <div className="h-5 w-20 rounded-full rb-skeleton" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/recruit/dashboard" className="flex items-center gap-2.5">
            <RoleboltLogo size="md" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <Link href="/recruit/dashboard" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-slate-900">Create something new</h1>
          <p className="mt-2 text-slate-500 text-sm">Choose how you want to collect candidates.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Standard Job */}
          <Link
            href="/recruit/jobs/new"
            className="group relative flex flex-col rounded-3xl border-2 border-slate-200 bg-white p-7 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                <rect width="20" height="14" x="2" y="6" rx="2"/>
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">Standard Job Post</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              AI generates the full job description and scoring rubric in 30 seconds. Candidates apply with their resume and Rolebolt scores them automatically.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["AI scoring", "Resume analysis", "Pipeline management", "Interview brief"].map(t => (
                <span key={t} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">{t}</span>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-blue-600 group-hover:gap-2.5 transition-all">
              Create standard job
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
          </Link>

          {/* Form Builder */}
          <Link
            href="/recruit/forms/new"
            className="group relative flex flex-col rounded-3xl border-2 border-slate-200 bg-white p-7 shadow-sm hover:border-violet-400 hover:shadow-md transition-all"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 group-hover:bg-violet-100 transition">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">Form Builder</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Build your own custom form — like Google Forms but smarter. Share the link anywhere. AI analyzes every response automatically.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Custom questions", "AI analysis", "Share anywhere", "WhatsApp / LinkedIn"].map(t => (
                <span key={t} className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-600">{t}</span>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-violet-600 group-hover:gap-2.5 transition-all">
              Build a form
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function NewJobChoicePage() {
  return <RecruitGuard requiredRole="creator"><NewJobChoiceContent /></RecruitGuard>;
}
