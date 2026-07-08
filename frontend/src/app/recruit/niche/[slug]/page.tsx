import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecruitHeader from "@/components/RecruitHeader";
import PageTracker from "@/components/PageTracker";
import { apiUrl, readApiJson } from "@/lib/api";
import { buildMetadata } from "@/lib/seo";

type NicheConfig = {
  label: string;
  slug: string;
  emoji: string;
  color: string;
  bgLight: string;
  borderColor: string;
  tagline: string;
  intro: string;
  popularSkills: string[];
  commonRoles: string[];
  highlights: { icon: string; title: string; desc: string }[];
};

const NICHES: Record<string, NicheConfig> = {
  "ai-tech": {
    label: "AI, Data, Software & Product Tech",
    slug: "ai-tech",
    emoji: "💻",
    color: "text-blue-700",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-200",
    tagline: "Build the future of India's tech economy.",
    intro:
      "From AI/ML engineers and data scientists to product managers and SDE roles — this niche covers the full spectrum of technology careers in India. Find roles at startups, MNCs, and everything in between.",
    popularSkills: [
      "Python", "Machine Learning", "React", "Node.js", "SQL", "TypeScript",
      "AWS", "LLMs", "Data Analysis", "System Design", "Product Roadmapping", "TensorFlow",
    ],
    commonRoles: [
      "Software Engineer", "AI/ML Engineer", "Data Scientist", "Product Manager",
      "Backend Developer", "Frontend Developer", "Full Stack Engineer", "DevOps Engineer",
      "Data Analyst", "Data Engineer", "AI Researcher", "QA Engineer",
    ],
    highlights: [
      { icon: "🚀", title: "High-growth sector", desc: "AI & tech roles are among the fastest-growing in India, with new opportunities every week." },
      { icon: "🌐", title: "Remote-friendly", desc: "A large proportion of tech roles offer remote or hybrid work options." },
      { icon: "💰", title: "Competitive salaries", desc: "Tech is one of India's highest-paying sectors across experience levels." },
    ],
  },
  "sales-bd": {
    label: "Sales, Business Development & Revenue Roles",
    slug: "sales-bd",
    emoji: "📈",
    color: "text-orange-700",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    tagline: "Drive revenue. Build relationships. Close deals.",
    intro:
      "Sales and business development are the engine of every growing company. Whether you're in B2B SaaS, FMCG, insurance, or enterprise deals, this niche is for people who turn conversations into contracts.",
    popularSkills: [
      "B2B Sales", "Lead Generation", "CRM Tools", "Cold Calling", "Negotiation",
      "Account Management", "SaaS Sales", "Revenue Forecasting", "Channel Partnerships", "Outbound Sales",
    ],
    commonRoles: [
      "Business Development Executive", "Sales Manager", "Account Executive",
      "Inside Sales Representative", "Field Sales Officer", "Key Account Manager",
      "Growth Manager", "Sales Lead", "VP Sales", "Channel Partner Manager",
    ],
    highlights: [
      { icon: "🤝", title: "Relationship-driven", desc: "Companies value sales professionals who can build and sustain client relationships long-term." },
      { icon: "🏆", title: "Incentive-heavy", desc: "Sales roles often come with performance bonuses and incentives above base salary." },
      { icon: "📊", title: "High demand", desc: "Every business needs revenue — sales roles are available across all industries and city tiers." },
    ],
  },
  "finance-fintech": {
    label: "Finance, Accounting, Banking & Fintech",
    slug: "finance-fintech",
    emoji: "💰",
    color: "text-emerald-700",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    tagline: "Where numbers, strategy, and fintech collide.",
    intro:
      "India's financial sector is transforming rapidly, from traditional banking and accounting to new-age fintech startups and digital payments. This niche covers CA roles, finance analysts, bankers, and fintech product teams.",
    popularSkills: [
      "Financial Modelling", "GST & Taxation", "Tally", "Excel", "SAP", "Python (Finance)",
      "Credit Analysis", "Risk Management", "Investment Analysis", "Compliance", "Blockchain", "Payment Systems",
    ],
    commonRoles: [
      "Chartered Accountant", "Finance Analyst", "Investment Banker", "Credit Analyst",
      "Relationship Manager", "Compliance Officer", "Fintech Product Manager",
      "Treasury Analyst", "Risk Analyst", "Accounts Manager", "CFO", "Audit Associate",
    ],
    highlights: [
      { icon: "🏦", title: "Stable & structured", desc: "Banking and finance roles offer strong job security and defined career progression." },
      { icon: "⚡", title: "Fintech boom", desc: "India's fintech sector is one of the largest globally — new roles emerge every day." },
      { icon: "📜", title: "Credential-driven", desc: "CA, CFA, and MBA qualifications open senior doors quickly in this sector." },
    ],
  },
  "healthcare": {
    label: "Healthcare, Pharma & Allied Medical Workforce",
    slug: "healthcare",
    emoji: "🏥",
    color: "text-red-700",
    bgLight: "bg-red-50",
    borderColor: "border-red-200",
    tagline: "Careers that save lives and build healthier communities.",
    intro:
      "India's healthcare sector is expanding rapidly — from clinical roles in hospitals to pharma sales, medical device companies, and healthtech startups. This niche covers everyone from doctors and nurses to medical writers and clinical researchers.",
    popularSkills: [
      "Clinical Research", "Pharmacovigilance", "Patient Care", "Medical Coding",
      "Pharma Sales", "Healthcare IT", "Lab Techniques", "Medical Writing",
      "NABH / Regulatory Compliance", "EMR Systems", "Drug Discovery",
    ],
    commonRoles: [
      "Medical Officer", "Clinical Research Associate", "Pharmacist", "Staff Nurse",
      "Pharma Sales Executive", "Medical Representative", "Healthcare Data Analyst",
      "Medical Writer", "Lab Technician", "Hospital Administrator", "Radiologist",
    ],
    highlights: [
      { icon: "❤️", title: "Purpose-driven work", desc: "Healthcare careers offer a unique combination of professional growth and social impact." },
      { icon: "🔬", title: "R&D opportunities", desc: "India's pharma sector is the world's third largest by volume — research roles are booming." },
      { icon: "🌱", title: "Freshers welcome", desc: "Many clinical and support roles are open to freshers with the right credentials." },
    ],
  },
  "blue-collar-logistics": {
    label: "Skilled Blue-Collar, Logistics & Industrial Workforce",
    slug: "blue-collar-logistics",
    emoji: "🔧",
    color: "text-slate-700",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    tagline: "The skilled workforce that keeps India moving.",
    intro:
      "India's logistics, manufacturing, and blue-collar workforce is the backbone of the economy. This niche covers ITI graduates, warehouse workers, drivers, electricians, machine operators, and supply chain professionals — roles that are critical and consistently in demand.",
    popularSkills: [
      "Forklift Operation", "Inventory Management", "Supply Chain", "Machine Operation",
      "Electrical Work", "Plumbing", "Welding", "Quality Control",
      "Warehouse Management", "Vehicle Driving (LMV/HMV)", "Safety Compliance",
    ],
    commonRoles: [
      "Warehouse Associate", "Delivery Driver", "Machine Operator", "Electrician",
      "Logistics Coordinator", "Quality Inspector", "Maintenance Technician",
      "Supply Chain Analyst", "Forklift Operator", "Production Supervisor", "Field Technician",
    ],
    highlights: [
      { icon: "🏭", title: "Always in demand", desc: "Blue-collar and logistics roles consistently rank among India's most available job categories." },
      { icon: "📦", title: "E-commerce growth", desc: "India's e-commerce boom has created a massive demand for logistics and warehouse talent." },
      { icon: "🛡️", title: "Freshers actively hired", desc: "Many roles in this niche offer on-the-job training and are open to candidates with no prior experience." },
    ],
  },
  "creative-marketing": {
    label: "Creative, Marketing, Media & Design",
    slug: "creative-marketing",
    emoji: "🎨",
    color: "text-purple-700",
    bgLight: "bg-purple-50",
    borderColor: "border-purple-200",
    tagline: "Build brands. Tell stories. Move audiences.",
    intro:
      "From brand strategists and performance marketers to UX designers, content creators, and video editors — this niche covers every creative and marketing role in India's growing digital economy.",
    popularSkills: [
      "Content Writing", "SEO", "Social Media Marketing", "Figma", "Adobe Suite",
      "Video Editing", "Performance Marketing", "Email Marketing", "Copywriting",
      "Brand Strategy", "UI/UX Design", "Google Ads", "Meta Ads",
    ],
    commonRoles: [
      "Content Writer", "Digital Marketing Manager", "UX Designer", "Graphic Designer",
      "Social Media Manager", "SEO Specialist", "Performance Marketer",
      "Video Editor", "Brand Manager", "Copywriter", "Creative Director", "Marketing Analyst",
    ],
    highlights: [
      { icon: "✨", title: "Portfolio over degree", desc: "Creative roles value your work more than your qualifications — a great portfolio opens doors." },
      { icon: "💻", title: "Remote-first culture", desc: "Marketing and design roles are among the most remote-friendly positions in India." },
      { icon: "📱", title: "D2C & creator boom", desc: "India's D2C and creator economy is generating thousands of new marketing and design roles." },
    ],
  },
};

type Job = {
  _id: string;
  title: string;
  companyName?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  freshersAllowed?: boolean;
  verifiedCompany?: boolean;
  mustHaveSkills?: string;
  seniority?: string;
  createdAt?: string;
  niche?: string;
};

function formatSalary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const min = job.salaryMin ? job.salaryMin.toLocaleString("en-IN") : "0";
  const max = job.salaryMax ? `–${job.salaryMax.toLocaleString("en-IN")}` : "+";
  return `${job.salaryCurrency || "₹"} ${min}${max}`;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

async function fetchNicheJobs(nicheLabel: string, extra?: Record<string, string>): Promise<Job[]> {
  try {
    const query = new URLSearchParams({ niche: nicheLabel, ...extra });
    const res = await fetch(apiUrl(`/recruit-public/jobs?${query}`), { cache: "no-store" });
    if (!res.ok) return [];
    const data = await readApiJson(res);
    return (data.jobs ?? []) as Job[];
  } catch {
    return [];
  }
}

function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  return (
    <Link
      href={`/recruit/opportunities/${job._id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#0a66c2]/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-sm font-black text-[#0a66c2]">
          {(job.companyName || job.title).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition text-sm leading-snug">{job.title}</h3>
            {job.verifiedCompany && (
              <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">✓ Verified</span>
            )}
            {job.freshersAllowed && (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">Freshers ok</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{job.companyName || "Company"}</span>
            {" · "}{job.location || "India"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            <span className="capitalize">{job.workMode || "Flexible"}</span>
            <span>·</span>
            <span>{job.jobType || "Full-time"}</span>
            {salary && <><span>·</span><span className="font-semibold text-slate-600">{salary}</span></>}
            {job.createdAt && <><span>·</span><span>{timeAgo(job.createdAt)}</span></>}
          </div>
          {job.mustHaveSkills && (
            <div className="mt-2 flex flex-wrap gap-1">
              {job.mustHaveSkills.split(",").slice(0, 4).map(s => s.trim()).filter(Boolean).map(s => (
                <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ label, href }: { label: string; href: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm text-slate-500">No {label} jobs posted yet.</p>
      <Link href={href} className="mt-2 inline-block text-xs font-bold text-[#0a66c2] hover:underline">
        Browse all {label} jobs →
      </Link>
    </div>
  );
}

export async function generateStaticParams() {
  return Object.keys(NICHES).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const niche = NICHES[slug];
  if (!niche) {
    return buildMetadata({
      title: "Niche not found | Plyndrox Recruit AI",
      description: "This niche job category could not be found on Plyndrox Recruit AI.",
      path: `/recruit/niche/${slug}`,
      noIndex: true,
    });
  }
  return buildMetadata({
    title: `${niche.emoji} ${niche.label} Jobs in India | Plyndrox Recruit AI`,
    description: niche.intro,
    path: `/recruit/niche/${niche.slug}`,
    keywords: [
      `${niche.label} jobs India`,
      `${niche.label} jobs`,
      `${niche.label} hiring India`,
      `${niche.label} freshers jobs`,
      `${niche.label} remote jobs India`,
      "niche job board India",
      "Plyndrox Recruit AI jobs",
      "free job board India",
      ...niche.popularSkills.map((s: string) => `${s} jobs India`),
    ],
  });
}

export default async function NicheLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const niche = NICHES[slug];
  if (!niche) notFound();

  const [allJobs, freshersJobs, remoteJobs] = await Promise.all([
    fetchNicheJobs(niche.label),
    fetchNicheJobs(niche.label, { freshersAllowed: "true" }),
    fetchNicheJobs(niche.label, { workMode: "remote" }),
  ]);

  const topJobs = allJobs.slice(0, 6);
  const topFreshers = freshersJobs.slice(0, 4);
  const topRemote = remoteJobs.slice(0, 4);
  const nicheFilterUrl = `/recruit/opportunities?niche=${encodeURIComponent(niche.label)}`;

  const otherNiches = Object.values(NICHES).filter(n => n.slug !== slug);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageTracker event="niche_viewed" data={{ niche: niche.slug }} />
      <RecruitHeader />

      {/* Hero */}
      <section className={`border-b border-slate-100 ${niche.bgLight}`}>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link href="/recruit" className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
                Plyndrox Recruit AI
              </Link>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400"><path d="m9 18 6-6-6-6" /></svg>
              <span className="text-xs font-semibold text-slate-500">Niches</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400"><path d="m9 18 6-6-6-6" /></svg>
              <span className={`text-xs font-bold ${niche.color}`}>{niche.emoji} {niche.label.split(",")[0]}</span>
            </div>

            <div className={`inline-flex items-center gap-2 rounded-full border ${niche.borderColor} bg-white px-4 py-1.5 text-xs font-bold ${niche.color} mb-4`}>
              <span>{niche.emoji}</span>
              {niche.label}
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl leading-tight">
              {niche.tagline}
            </h1>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600 max-w-2xl">
              {niche.intro}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={nicheFilterUrl}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#004182] transition shadow-sm"
              >
                Browse {allJobs.length > 0 ? `${allJobs.length} ` : ""}open roles
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </Link>
              <Link
                href="/recruit/profile"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 transition shadow-sm"
              >
                Create my profile
              </Link>
              <Link
                href="/recruit/jobs/new"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 transition shadow-sm"
              >
                Post a job
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="border-b border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {niche.highlights.map(h => (
              <div key={h.title} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
                <span className="text-2xl">{h.icon}</span>
                <h3 className="mt-2 font-bold text-slate-900 text-sm">{h.title}</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">

        {/* Top Jobs */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest ${niche.color} mb-1`}>Live openings</p>
              <h2 className="text-xl font-bold sm:text-2xl text-slate-900">Top jobs in this niche</h2>
            </div>
            <Link href={nicheFilterUrl} className="text-sm font-bold text-[#0a66c2] hover:underline whitespace-nowrap">
              View all →
            </Link>
          </div>
          {topJobs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {topJobs.map(job => <JobCard key={job._id} job={job} />)}
            </div>
          ) : (
            <EmptyState label="" href={nicheFilterUrl} />
          )}
          <div className="mt-5 text-center">
            <Link
              href={nicheFilterUrl}
              className="inline-flex items-center gap-2 rounded-full border border-[#0a66c2] px-6 py-2.5 text-sm font-bold text-[#0a66c2] hover:bg-blue-50 transition"
            >
              Browse all {niche.label.split(",")[0]} jobs
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </Link>
          </div>
        </section>

        {/* Popular Skills + Common Roles side by side */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🎯</span>
              <h2 className="font-bold text-slate-900">Popular skills</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {niche.popularSkills.map(skill => (
                <Link
                  key={skill}
                  href={`/recruit/opportunities?q=${encodeURIComponent(skill)}&niche=${encodeURIComponent(niche.label)}`}
                  className={`rounded-full border ${niche.borderColor} ${niche.bgLight} px-3 py-1.5 text-xs font-semibold ${niche.color} hover:opacity-80 transition`}
                >
                  {skill}
                </Link>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">Click any skill to find matching jobs</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💼</span>
              <h2 className="font-bold text-slate-900">Common job roles</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {niche.commonRoles.map(role => (
                <Link
                  key={role}
                  href={`/recruit/opportunities?q=${encodeURIComponent(role)}&niche=${encodeURIComponent(niche.label)}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-[#0a66c2]/30 hover:text-[#0a66c2] transition"
                >
                  {role}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Freshers-friendly */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">Entry-level</p>
              <h2 className="text-xl font-bold sm:text-2xl text-slate-900">Freshers-friendly roles</h2>
            </div>
            <Link
              href={`${nicheFilterUrl}&freshersAllowed=true`}
              className="text-sm font-bold text-[#0a66c2] hover:underline whitespace-nowrap"
            >
              See all →
            </Link>
          </div>
          {topFreshers.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {topFreshers.map(job => <JobCard key={job._id} job={job} />)}
            </div>
          ) : (
            <EmptyState label="freshers-friendly" href={`${nicheFilterUrl}&freshersAllowed=true`} />
          )}
        </section>

        {/* Remote / Hybrid */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-1">Work from anywhere</p>
              <h2 className="text-xl font-bold sm:text-2xl text-slate-900">Remote & hybrid jobs</h2>
            </div>
            <Link
              href={`${nicheFilterUrl}&workMode=remote`}
              className="text-sm font-bold text-[#0a66c2] hover:underline whitespace-nowrap"
            >
              See all →
            </Link>
          </div>
          {topRemote.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {topRemote.map(job => <JobCard key={job._id} job={job} />)}
            </div>
          ) : (
            <EmptyState label="remote" href={`${nicheFilterUrl}&workMode=remote`} />
          )}
        </section>

        {/* CTA Banner */}
        <section className="rounded-3xl bg-[#0a66c2] p-8 sm:p-10 text-white">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">Ready to find your next role in {niche.label.split(",")[0]}?</h2>
              <p className="mt-2 text-blue-100 text-sm max-w-lg">
                Create a profile once and apply to any job in seconds. Free forever, no hidden fees.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:items-end">
              <Link
                href={nicheFilterUrl}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[#0a66c2] hover:bg-blue-50 transition whitespace-nowrap"
              >
                Browse jobs
              </Link>
              <Link
                href="/recruit/profile"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-bold text-white hover:bg-white/20 transition whitespace-nowrap"
              >
                Create profile
              </Link>
              <Link
                href="/recruit/jobs/new"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-bold text-white hover:bg-white/20 transition whitespace-nowrap"
              >
                Post a job
              </Link>
            </div>
          </div>
        </section>

        {/* Other Niches */}
        <section>
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Explore more</p>
            <h2 className="text-xl font-bold sm:text-2xl text-slate-900">Other hiring categories</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherNiches.map(n => (
              <Link
                key={n.slug}
                href={`/recruit/niche/${n.slug}`}
                className="group rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 hover:border-[#0a66c2]/30 hover:bg-blue-50/20 transition"
              >
                <span className="text-2xl">{n.emoji}</span>
                <p className="mt-2 font-bold text-sm text-slate-900 group-hover:text-[#0a66c2] transition leading-snug">{n.label}</p>
                <p className="mt-1 text-xs text-slate-500">Explore jobs →</p>
              </Link>
            ))}
          </div>
        </section>

      </div>

      {/* Footer spacer */}
      <div className="h-12" />
    </div>
  );
}
