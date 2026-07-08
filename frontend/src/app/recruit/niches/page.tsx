import type { Metadata } from "next";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import { buildMetadata } from "@/lib/seo";

const NICHES = [
  {
    label: "AI, Data, Software & Product Tech",
    slug: "ai-tech",
    emoji: "💻",
    tagline: "Build the future of India's tech economy.",
    color: "text-blue-700",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-200",
    skills: ["Python", "ML", "React", "Node.js", "SQL", "AWS"],
  },
  {
    label: "Sales, Business Development & Revenue Roles",
    slug: "sales-bd",
    emoji: "📈",
    tagline: "Drive revenue. Build relationships. Close deals.",
    color: "text-orange-700",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    skills: ["B2B Sales", "Lead Gen", "CRM", "Negotiation", "SaaS Sales"],
  },
  {
    label: "Finance, Accounting, Banking & Fintech",
    slug: "finance-fintech",
    emoji: "💰",
    tagline: "Where numbers, strategy, and fintech collide.",
    color: "text-emerald-700",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    skills: ["Financial Modelling", "GST", "Excel", "SAP", "Compliance"],
  },
  {
    label: "Healthcare, Pharma & Allied Medical Workforce",
    slug: "healthcare",
    emoji: "🏥",
    tagline: "Careers that save lives and build healthier communities.",
    color: "text-red-700",
    bgLight: "bg-red-50",
    borderColor: "border-red-200",
    skills: ["Clinical Research", "Pharmacovigilance", "Patient Care", "Pharma Sales"],
  },
  {
    label: "Skilled Blue-Collar, Logistics & Industrial Workforce",
    slug: "blue-collar-logistics",
    emoji: "🔧",
    tagline: "The skilled workforce that keeps India moving.",
    color: "text-slate-700",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    skills: ["Supply Chain", "Warehouse Mgmt", "Machine Operation", "QC"],
  },
  {
    label: "Creative, Marketing, Media & Design",
    slug: "creative-marketing",
    emoji: "🎨",
    tagline: "Build brands. Tell stories. Move audiences.",
    color: "text-purple-700",
    bgLight: "bg-purple-50",
    borderColor: "border-purple-200",
    skills: ["Content Writing", "SEO", "Figma", "Adobe Suite", "Performance Marketing"],
  },
];

export const metadata: Metadata = buildMetadata({
  title: "Browse Jobs by Industry Niche — Plyndrox Recruit AI",
  description:
    "Explore India's most focused job board organised by industry niche: AI & Tech, Sales & BD, Finance & Fintech, Healthcare, Blue-Collar & Logistics, and Creative & Marketing. Find niche-specific roles, required skills, and freshers opportunities — free.",
  path: "/recruit/niches",
  keywords: [
    "India job board by niche",
    "niche job board India",
    "AI jobs India",
    "tech jobs India",
    "sales jobs India",
    "finance jobs India",
    "healthcare jobs India",
    "blue collar jobs India",
    "creative marketing jobs India",
    "niche hiring India",
    "Plyndrox Recruit jobs",
    "free job board India",
    "jobs by industry India",
    "freshers jobs India",
    "industry-specific jobs India",
  ],
});

export default function NichesIndexPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <RecruitHeader />

      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-br from-white to-blue-50/40 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0a66c2]/20 bg-blue-50 px-4 py-1.5 text-xs font-bold text-[#0a66c2] mb-5">
            ✦ India-first hiring across 6 niches
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Niche-first hiring.<br className="hidden sm:block" /> Not generic job boards.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Each section below is a focused hiring space — dedicated job listings, popular skills, common roles, and freshers opportunities for that industry.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/recruit/opportunities" className="rounded-full bg-[#0a66c2] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#004182] transition shadow-sm">
              Browse all open roles
            </Link>
            <Link href="/recruit/profile" className="rounded-full border border-slate-300 px-7 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm">
              Create my profile
            </Link>
          </div>
        </div>
      </section>

      {/* Niche Cards */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {NICHES.map(niche => (
            <Link
              key={niche.slug}
              href={`/recruit/niche/${niche.slug}`}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#0a66c2]/30 hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Emoji badge */}
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${niche.bgLight} border ${niche.borderColor}`}>
                {niche.emoji}
              </div>

              <h2 className={`mt-4 text-base font-bold text-slate-900 group-hover:${niche.color} transition leading-snug`}>
                {niche.label}
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{niche.tagline}</p>

              {/* Skills preview */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {niche.skills.map(s => (
                  <span key={s} className={`rounded-full border ${niche.borderColor} ${niche.bgLight} px-2.5 py-1 text-[11px] font-semibold ${niche.color}`}>
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-1 text-xs font-bold text-[#0a66c2]">
                Explore this niche
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="transition group-hover:translate-x-0.5">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-slate-100 bg-[#0a66c2] py-14 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">Can't find your niche?</h2>
          <p className="mt-3 text-blue-100 text-sm sm:text-base">
            Browse all open roles or search across every category. New jobs are added daily.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/recruit/opportunities" className="rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[#0a66c2] hover:bg-blue-50 transition shadow">
              Browse all jobs
            </Link>
            <Link href="/recruit/jobs/new" className="rounded-full border border-white/30 bg-white/10 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition">
              Post a job
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
