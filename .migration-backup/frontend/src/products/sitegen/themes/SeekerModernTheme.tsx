import type { SitegenSeekerStructuredContent } from "../types/structuredContent";

export function SeekerModernTheme({ content, username }: { content: SitegenSeekerStructuredContent; username: string }) {
  return (
    <div className="min-h-full bg-[#0f172a] text-white">
      <div className="grid min-h-full lg:grid-cols-[1.1fr_0.9fr]">
        <header className="flex flex-col justify-center px-8 py-14 lg:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">rolebolt.tech/{username}</p>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.06em]">{content.name}</h1>
          {content.headline ? <p className="mt-4 text-xl text-violet-100/80">{content.headline}</p> : null}
          {content.about && content.sections.about ? <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">{content.about}</p> : null}
        </header>
        <main className="space-y-8 bg-white/5 px-8 py-14 text-slate-100 lg:px-10">
          {content.sections.skills && content.skills.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Skills</h2>
              <div className="mt-4 flex flex-wrap gap-2">{content.skills.map((skill) => <span key={skill} className="rounded-full border border-white/10 px-3 py-1 text-sm">{skill}</span>)}</div>
            </section>
          ) : null}
          {content.sections.projects && content.projects.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Projects</h2>
              <div className="mt-4 space-y-4">{content.projects.map((item) => <div key={item.name} className="rounded-2xl border border-white/10 p-4"><h3 className="font-semibold">{item.name}</h3>{item.description ? <p className="mt-2 text-sm text-slate-300">{item.description}</p> : null}</div>)}</div>
            </section>
          ) : null}
          {content.sections.experience && content.experience.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Experience</h2>
              <div className="mt-4 space-y-4">{content.experience.map((item) => <div key={`${item.title}-${item.company}`}><h3 className="font-semibold">{item.title}</h3><p className="text-sm text-slate-400">{item.company}</p></div>)}</div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
