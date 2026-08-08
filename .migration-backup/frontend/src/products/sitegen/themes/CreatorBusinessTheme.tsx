import type { SitegenCreatorStructuredContent } from "../types/structuredContent";

export function CreatorBusinessTheme({ content, username }: { content: SitegenCreatorStructuredContent; username: string }) {
  return (
    <div className="min-h-full bg-[#f7f8fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-8 py-14">
        <div className="mx-auto flex max-w-5xl items-start gap-5">
          {content.logoUrl ? <img src={content.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white">{content.businessName.slice(0, 1)}</div>}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">rolebolt.tech/{username}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em]">{content.businessName}</h1>
            {content.tagline ? <p className="mt-3 text-lg text-slate-600">{content.tagline}</p> : null}
            {content.category ? <p className="mt-2 text-sm text-slate-500">{content.category}</p> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-8 py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-10">
          {content.about && content.sections.about ? <section><h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">About</h2><p className="mt-4 text-base leading-8 text-slate-600">{content.about}</p></section> : null}
          {content.sections.services && content.services.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Services</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">{content.services.map((item) => <li key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium">{item}</li>)}</ul>
            </section>
          ) : null}
        </div>
        <aside className="space-y-8">
          {content.sections.contact ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Contact</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {content.location ? <p>{content.location}</p> : null}
                {content.contact.email ? <p>{content.contact.email}</p> : null}
                {content.contact.phone ? <p>{content.contact.phone}</p> : null}
                {content.contact.website ? <p>{content.contact.website}</p> : null}
              </div>
            </section>
          ) : null}
          {content.sections.portfolio && content.portfolio.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Work</h2>
              <div className="mt-4 space-y-3">{content.portfolio.map((item) => <a key={item.url} href={item.url} className="block text-sm font-medium text-blue-700 hover:underline">{item.title}</a>)}</div>
            </section>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
