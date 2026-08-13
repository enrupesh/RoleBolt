import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/lib/seo";
import { getRelatedResources, resourceArticles, resourcesBySlug, type ResourceArticle } from "@/lib/resourceContent";

export function generateStaticParams() {
  return resourceArticles.map((article) => ({ slug: article.slug }));
}

async function getArticle(slug: string) {
  return resourcesBySlug[slug];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) {
    return buildMetadata({
      title: "Resource not found | Rolebolt",
      description: "This Rolebolt resource is not available.",
      path: `/resources/${slug}`,
      noIndex: true,
    });
  }
  return buildMetadata({
    title: article.metaTitle,
    description: article.description,
    path: `/resources/${article.slug}`,
    keywords: article.keywords,
    ogType: "article",
    ogImage: article.image,
    publishedTime: article.publishedAt,
    modifiedTime: article.modifiedAt,
    authors: [article.author],
  });
}

function articleSchema(article: ResourceArticle) {
  const url = `${SITE_URL}/resources/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.description,
    image: `${SITE_URL}${article.image}`,
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    inLanguage: "en",
    articleSection: article.category,
    keywords: article.keywords.join(", "),
    author: { "@type": "Organization", name: article.author, url: `${SITE_URL}/resources` },
    reviewedBy: { "@type": "Organization", name: article.reviewer, url: `${SITE_URL}/resources` },
    publisher: { "@id": `${SITE_URL}#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };
}

function ResourceArticle({ article }: { article: ResourceArticle }) {
  const related = getRelatedResources(article);
  const faq = article.faqs.length ? faqJsonLd(article.faqs) : null;

  return (
    <div className="min-h-screen bg-[#f7fafc] text-slate-900">
      <JsonLd id="resource-article-jsonld" data={articleSchema(article)} />
      <JsonLd
        id="resource-breadcrumb-jsonld"
        data={breadcrumbJsonLd([
          { name: "Rolebolt", url: SITE_URL },
          { name: "Resources", url: `${SITE_URL}/resources` },
          { name: article.title, url: `${SITE_URL}/resources/${article.slug}` },
        ])}
      />
      {faq && <JsonLd id="resource-faq-jsonld" data={faq} />}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="text-lg font-black tracking-tight text-slate-950">Rolebolt</Link>
          <nav className="flex items-center gap-2 text-sm font-semibold text-slate-600" aria-label="Article navigation">
            <Link href="/resources" className="rounded-xl px-3 py-2 hover:bg-slate-50 hover:text-blue-700">All resources</Link>
            <Link href="/recruit/opportunities" className="hidden rounded-xl px-3 py-2 hover:bg-slate-50 hover:text-blue-700 sm:inline-flex">Find jobs</Link>
            <Link href={article.audience === "Recruiters" ? "/recruit/preview" : "/seeker"} className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              {article.audience === "Recruiters" ? "For recruiters" : "For job seekers"}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <article>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-4xl px-5 py-14 sm:py-20 lg:px-8">
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                <Link href="/resources" className="hover:text-blue-900">Resources</Link>
                <span className="text-slate-300">/</span>
                <span>{article.audience}</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">{article.category}</span>
              </div>
              <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-6xl">{article.title}</h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{article.summary}</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                <span>By <strong className="text-slate-700">{article.author}</strong></span>
                <span>Reviewed by <strong className="text-slate-700">{article.reviewer}</strong></span>
                <span>{article.readTime}</span>
                <time dateTime={article.modifiedAt}>Updated {new Date(article.modifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time>
              </div>
            </div>
          </header>

          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,780px)_300px] lg:px-8 lg:py-16">
            <div>
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <Image src={article.image} alt={article.imageAlt} width={1024} height={576} className="h-auto w-full" priority />
              </div>
              <div className="mt-10 space-y-10">
                {article.sections.map((section) => (
                  <section id={`section-${article.sections.indexOf(section) + 1}`} key={section.heading}>
                    <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{section.heading}</h2>
                    <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
                      {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    </div>
                    {section.bullets && (
                      <ul className="mt-5 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-6 text-sm leading-7 text-slate-700">
                        {section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />{bullet}</li>)}
                      </ul>
                    )}
                  </section>
                ))}
              </div>

              <section className="mt-12 rounded-3xl border border-amber-200 bg-amber-50 p-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Practical example</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{article.example.title}</h2>
                <p className="mt-3 text-base leading-7 text-slate-700">{article.example.text}</p>
                <ul className="mt-5 space-y-2 text-sm leading-7 text-slate-700">
                  {article.example.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="font-bold text-amber-700">✓</span>{bullet}</li>)}
                </ul>
              </section>

              <section id="faq" className="mt-12">
                <h2 className="text-3xl font-black tracking-tight text-slate-950">Frequently asked questions</h2>
                <div className="mt-5 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
                  {article.faqs.map((item) => (
                    <details key={item.question} className="group p-6">
                      <summary className="cursor-pointer list-none pr-8 text-base font-bold text-slate-950 marker:hidden">
                        {item.question}
                        <span className="float-right text-blue-600 transition group-open:rotate-45" aria-hidden="true">＋</span>
                      </summary>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>

              <section className="mt-12 rounded-3xl bg-slate-950 p-8 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Next step</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">{article.cta.label}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{article.cta.text}</p>
                <Link href={article.cta.href} className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">{article.cta.label} <span className="ml-2" aria-hidden="true">→</span></Link>
              </section>
            </div>

            <aside className="lg:sticky lg:top-8 lg:self-start">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">In this guide</p>
                <ol className="mt-4 space-y-3 text-sm font-semibold text-slate-700">
                  {article.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`} className="hover:text-blue-700">{index + 1}. {section.heading}</a></li>)}
                  <li><a href="#faq" className="hover:text-blue-700">FAQs</a></li>
                </ol>
              </div>
              <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">More resources</p>
                <div className="mt-4 space-y-3">
                  {related.map((relatedArticle) => <Link key={relatedArticle.slug} href={`/resources/${relatedArticle.slug}`} className="block text-sm font-bold leading-6 text-blue-700 hover:text-blue-900">{relatedArticle.title}</Link>)}
                </div>
              </div>
            </aside>
          </div>
        </article>
      </main>
    </div>
  );
}

export default async function ResourceArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  return <ResourceArticle article={article} />;
}