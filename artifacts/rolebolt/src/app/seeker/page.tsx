import type { Metadata } from "next";
import Link from "next/link";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "AI Job Search Platform & Career Workspace | Rolebolt",
  description:
    "Track every application, build tailored resumes, prepare for interviews and get AI job-match guidance in Rolebolt's free career workspace.",
  path: "/seeker",
  keywords: [
    "AI job search platform",
    "job application tracker",
    "AI resume builder",
    "AI interview preparation",
    "career workspace",
  ],
});

const FEATURES = [
  {
    icon: "🧭",
    title: "Career GPS",
    desc: "Know exactly what to do next — follow-ups, weekly goals, and momentum scoring.",
    href: "/seeker/career",
  },
  {
    icon: "📋",
    title: "Universal Application Tracker",
    desc: "Track every application — Rolebolt, LinkedIn, Indeed, company sites — in one place.",
    href: "/seeker/tracker",
  },
  {
    icon: "✦",
    title: "Job Workspace",
    desc: "Paste any job URL. Get AI match scores, resume tips, and interview prep.",
    href: "/seeker/workspace",
  },
  {
    icon: "📧",
    title: "Email Intelligence",
    desc: "Paste recruiter emails. AI extracts stage updates, interview dates, and next steps.",
    href: "/seeker/email",
  },
  {
    icon: "📄",
    title: "AI Resume Builder",
    desc: "Build from scratch or tailor your resume to any job description.",
    href: "/seeker/resume",
  },
  {
    icon: "🧩",
    title: "Browser Extension",
    desc: "Live AI match scores on LinkedIn, Indeed, and any job page. Save with one click.",
    href: "/seeker/extension",
  },
  {
    icon: "🎤",
    title: "Interview Prep",
    desc: "Mock interviews with AI feedback — for any role you're pursuing.",
    href: "/seeker/interview-prep",
  },
];

export default function SeekerLandingPage() {
  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/seeker" className="flex items-center gap-2">
            <RoleboltLogo size="md" />
            <span className="text-sm font-bold text-slate-900">RoleBolt Job Seeker</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/resources" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex">
              Guides
            </Link>
            <Link href="/seeker/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Sign in
            </Link>
            <Link href="/seeker/signup" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">Your job search command center</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 max-w-3xl mx-auto leading-tight">
            The career platform that works everywhere you apply
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Track applications from LinkedIn, Indeed, and company career pages. Build resumes, prep for interviews, and parse recruiter emails — even when you never apply through Rolebolt.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/seeker/signup" className="rounded-2xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700">
              Create free account
            </Link>
            <Link href="/recruit/opportunities" className="rounded-2xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Browse Rolebolt jobs
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <Link
                key={f.href}
                href={f.href}
                className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-2xl">{f.icon}</span>
                <h2 className="mt-3 text-lg font-bold text-slate-900">{f.title}</h2>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                <span className="mt-4 inline-block text-xs font-bold text-indigo-600">Learn more →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
            <h2 className="text-xl font-bold text-slate-900">Save jobs from any website</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto">
              Install the Rolebolt browser extension for Live AI match scores on LinkedIn, Indeed, and company career pages.
            </p>
            <Link href="/seeker/extension" className="mt-5 inline-block rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700">
              Get the extension →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
