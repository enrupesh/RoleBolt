import type { SitegenCreatorStructuredContent } from "../types/structuredContent";

export function CreatorStudioTheme({ content, username }: { content: SitegenCreatorStructuredContent; username: string }) {
  return (
    <div className="min-h-full bg-gradient-to-br from-[#1a1033] via-[#2a1450] to-[#4c1d95] text-white">
      <header className="px-8 py-16 text-center">
        {content.logoUrl ? <img src={content.logoUrl} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" /> : null}
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">rolebolt.tech/{username}</p>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.06em]">{content.businessName}</h1>
        {content.tagline ? <p className="mx-auto mt-4 max-w-2xl text-lg text-violet-100/75">{content.tagline}</p> : null}
      </header>
      <main className="mx-auto max-w-4xl space-y-10 px-8 pb-16">
        {content.about && content.sections.about ? <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center"><p className="text-base leading-8 text-violet-50/85">{content.about}</p></section> : null}
        {content.sections.services && content.services.length > 0 ? (
          <section>
            <h2 className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">What I do</h2>
            <div className="mt-5 flex flex-wrap justify-center gap-3">{content.services.map((item) => <span key={item} className="rounded-full border border-white/15 px-4 py-2 text-sm">{item}</span>)}</div>
          </section>
        ) : null}
        {content.sections.portfolio && content.portfolio.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2">
            {content.portfolio.map((item) => (
              <a key={item.url} href={item.url} className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                <h3 className="font-semibold">{item.title}</h3>
                {item.description ? <p className="mt-2 text-sm text-violet-100/70">{item.description}</p> : null}
              </a>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
