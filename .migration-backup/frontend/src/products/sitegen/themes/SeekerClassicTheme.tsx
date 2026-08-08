import type { SitegenSeekerStructuredContent } from "../types/structuredContent";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 py-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SeekerClassicTheme({ content, username }: { content: SitegenSeekerStructuredContent; username: string }) {
  return (
    <div className="min-h-full bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-slate-50 px-8 py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">rolebolt.tech/{username}</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em]">{content.name}</h1>
        {content.headline ? <p className="mt-3 text-lg text-slate-600">{content.headline}</p> : null}
        {content.about && content.sections.about ? <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{content.about}</p> : null}
      </header>
      <main className="mx-auto max-w-4xl px-8 py-4">
        {content.sections.experience && content.experience.length > 0 ? (
          <Section title="Experience">
            <div className="space-y-6">
              {content.experience.map((item) => (
                <article key={`${item.title}-${item.company}`}>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.company}</p>
                  {item.bullets.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-slate-600">{item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
                </article>
              ))}
            </div>
          </Section>
        ) : null}
        {content.sections.skills && content.skills.length > 0 ? (
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">{content.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{skill}</span>)}</div>
          </Section>
        ) : null}
        {content.sections.education && content.education.length > 0 ? (
          <Section title="Education">
            <div className="space-y-4">{content.education.map((item) => <div key={item.school}><h3 className="font-semibold">{item.school}</h3><p className="text-sm text-slate-500">{[item.degree, item.field].filter(Boolean).join(" · ")}</p></div>)}</div>
          </Section>
        ) : null}
      </main>
    </div>
  );
}
