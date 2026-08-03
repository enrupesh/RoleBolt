import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/MarketingPageShell";
import { resourceArticles } from "@/lib/resourceContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Rolebolt Blog | Recruiting, Hiring and Career Insights",
  description:
    "Ideas and practical guidance from Rolebolt on AI recruiting, candidate experience, hiring workflows, job searches and career growth.",
  path: "/blog",
  keywords: ["Rolebolt blog", "recruiting blog", "AI hiring insights", "career advice blog", "candidate experience"],
});

export default function BlogPage() {
  const featured = resourceArticles.slice(0, 6);
  return (
    <MarketingPageShell
      eyebrow="The Rolebolt blog"
      title="Useful ideas for the people doing the hiring—and the people looking for what comes next."
      intro="Practical perspectives on recruiting, candidate experience, job search strategy and the systems that make good work easier to begin."
    >
      <section className="border-b border-[#dfe8ef] bg-[#eef6fb]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <Link href={`/resources/${featured[0].slug}`} className="group rounded-3xl border border-[#cbddea] bg-white p-7 shadow-[0_12px_30px_rgba(32,79,112,.06)] transition hover:-translate-y-1 hover:border-[#0a66c2] sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Featured guide</p>
              <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-[-.05em] text-[#10263d] group-hover:text-[#0a66c2] sm:text-4xl">{featured[0].title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#647a8d]">{featured[0].description}</p>
              <span className="mt-7 inline-flex text-sm font-semibold text-[#0a66c2]">Read the guide <span className="ml-2">→</span></span>
            </Link>
            <div className="rounded-3xl bg-[#10263d] p-7 text-white sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#8ec7f7]">A clearer practice</p>
              <p className="mt-6 font-display text-3xl font-semibold leading-tight tracking-[-.045em]">Less noise. Better signals. More thoughtful next steps.</p>
              <Link href="/resources" className="mt-8 inline-flex text-sm font-semibold text-white hover:text-[#b7dcfb]">Explore all resources <span className="ml-2">→</span></Link>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="flex items-end justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Latest thinking</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.05em] text-[#10263d] sm:text-4xl">Guides worth saving.</h2></div>
          <Link href="/resources" className="hidden text-sm font-semibold text-[#0a66c2] sm:inline-flex">View resource hub →</Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((article) => (
            <Link key={article.slug} href={`/resources/${article.slug}`} className="group flex h-full flex-col rounded-2xl border border-[#d9e5ee] bg-white p-6 shadow-[0_8px_24px_rgba(32,79,112,.05)] transition hover:-translate-y-1 hover:border-[#0a66c2]">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#0a66c2]"><span>{article.category}</span><span className="text-[#8aa0b1]">{article.readTime}</span></div>
              <h3 className="mt-4 text-lg font-semibold leading-snug text-[#203d56] group-hover:text-[#0a66c2]">{article.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-[#718496]">{article.description}</p>
              <span className="mt-6 text-sm font-semibold text-[#0a66c2]">Read article →</span>
            </Link>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}