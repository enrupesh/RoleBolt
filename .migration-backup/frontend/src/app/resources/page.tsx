import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { buildMetadata, breadcrumbJsonLd, collectionPageJsonLd, itemListJsonLd, SITE_URL } from "@/lib/seo";
import { recruiterResources, resourceArticles, seekerResources } from "@/lib/resourceContent";

export const metadata: Metadata = buildMetadata({
  title: "Recruiting & Job Search Resources | Rolebolt",
  description:
    "Practical recruiting guides and job-search resources covering AI hiring, applicant tracking, resume writing, interviews, applications, and career strategy.",
  path: "/resources",
  keywords: [
    "recruiting resources",
    "job search resources",
    "hiring guides",
    "career advice",
    "AI recruiting guides",
  ],
});

function ResourceCard({ slug, title, description, category, readTime }: {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
}) {
  return (
    <Link
      href={`/resources/${slug}`}
      className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5"
    >
      <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
        <span>{category}</span>
        <span className="text-slate-400">{readTime}</span>
      </div>
      <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950 group-hover:text-blue-700">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{description}</p>
      <span className="mt-5 text-sm font-bold text-blue-700">Read the guide <span aria-hidden="true">→</span></span>
    </Link>
  );
}

export default function ResourcesHubPage() {
  const featured = resourceArticles.slice(0, 6);
  const collectionSchema = collectionPageJsonLd({
    url: "/resources",
    name: "Rolebolt recruiting and job-search resources",
    description: "Practical guides for hiring teams and people searching for their next opportunity.",
    itemList: itemListJsonLd({
      name: "Rolebolt resources",
      items: resourceArticles.map((article) => ({
        name: article.title,
        url: `/resources/${article.slug}`,
        description: article.description,
      })),
    }),
  });

  return (
    <div className="min-h-screen bg-[#f7fafc] text-slate-900">
      <JsonLd id="resources-collection-jsonld" data={collectionSchema} />
      <JsonLd
        id="resources-breadcrumb-jsonld"
        data={breadcrumbJsonLd([
          { name: "Rolebolt", url: SITE_URL },
          { name: "Resources", url: `${SITE_URL}/resources` },
        ])}
      />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="text-lg font-black tracking-tight text-slate-950">Rolebolt</Link>
          <nav className="flex items-center gap-2 text-sm font-semibold text-slate-600" aria-label="Resources navigation">
            <Link href="/recruit/opportunities" className="rounded-xl px-3 py-2 hover:bg-slate-50 hover:text-blue-700">Find jobs</Link>
            <Link href="/seeker" className="hidden rounded-xl px-3 py-2 hover:bg-slate-50 hover:text-blue-700 sm:inline-flex">For job seekers</Link>
            <Link href="/recruit/preview" className="hidden rounded-xl px-3 py-2 hover:bg-slate-50 hover:text-blue-700 sm:inline-flex">For recruiters</Link>
            <Link href="/" className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Rolebolt home</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-200 bg-slate-950">
          <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:py-24 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Rolebolt learning center</p>
            <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
              Recruiting and job-search resources that help you take the next step.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              Practical, evidence-based guides for hiring teams and job seekers. Learn the process, use the right signals, and keep people at the center of every decision.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">For recruiters</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Build a clearer hiring process</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">Learn about AI recruiting software, ATS workflows, resume screening, assessments, candidate experience, and recruiting analytics.</p>
              <Link href="#recruiter-guides" className="mt-5 inline-flex text-sm font-bold text-blue-700">Browse recruiter guides <span className="ml-1" aria-hidden="true">→</span></Link>
            </div>
            <div className="rounded-3xl border border-violet-100 bg-violet-50 p-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">For job seekers</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Make your search more intentional</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">Learn how to build a resume, tailor applications, prepare for interviews, track opportunities, and create momentum.</p>
              <Link href="#job-seeker-guides" className="mt-5 inline-flex text-sm font-bold text-violet-700">Browse job-seeker guides <span className="ml-1" aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Start here</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Featured guides</h2>
            </div>
            <span className="hidden text-sm text-slate-500 sm:inline">{resourceArticles.length} practical guides</span>
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((article) => <ResourceCard key={article.slug} {...article} />)}
          </div>
        </section>

        <section id="recruiter-guides" className="scroll-mt-8 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Hiring teams</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Recruiter guides</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">Use these guides to create clearer roles, review evidence consistently, and keep the candidate journey moving.</p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {recruiterResources.map((article) => <ResourceCard key={article.slug} {...article} />)}
            </div>
          </div>
        </section>

        <section id="job-seeker-guides" className="scroll-mt-8 border-t border-slate-200 bg-[#f8f7ff]">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Career workspace</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Job-seeker guides</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">Build a search system that connects your resume, applications, interviews, and next actions.</p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {seekerResources.map((article) => <ResourceCard key={article.slug} {...article} />)}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-950">
          <div className="mx-auto max-w-4xl px-5 py-16 text-center lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white">Turn guidance into a better workflow.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">Rolebolt brings recruiting workflows and job-search tools into one focused workspace.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/recruit/preview" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">Explore recruiting tools</Link>
              <Link href="/seeker" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Open the career workspace</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}