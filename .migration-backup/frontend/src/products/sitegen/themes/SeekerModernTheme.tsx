import type { SitegenSeekerStructuredContent } from "../types/structuredContent";
import { SeekerContactBlock, hasSeekerContact } from "./shared";

export function SeekerModernTheme({ content, username }: { content: SitegenSeekerStructuredContent; username: string }) {
  const displayName = content.name?.trim() || username;

  return (
    <div className="min-h-full bg-[#0f172a] text-white">
      <div className="grid min-h-full lg:grid-cols-[1.1fr_0.9fr]">
        <header className="flex flex-col justify-center px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">rolebolt.tech/{username}</p>
          <h1 className="mt-4 break-words font-display text-3xl font-semibold tracking-[-0.06em] sm:text-5xl">{displayName}</h1>
          {content.headline ? <p className="mt-4 text-lg text-violet-100/80 sm:text-xl">{content.headline}</p> : null}
          {content.about && content.sections.about ? <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">{content.about}</p> : null}
        </header>
        <main className="space-y-8 bg-white/5 px-5 py-10 text-slate-100 sm:px-8 sm:py-14 lg:px-10">
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
          {content.sections.education && content.education.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Education</h2>
              <div className="mt-4 space-y-3">{content.education.map((item) => <div key={item.school}><h3 className="font-semibold">{item.school}</h3><p className="text-sm text-slate-400">{[item.degree, item.field].filter(Boolean).join(" · ")}</p></div>)}</div>
            </section>
          ) : null}
          {content.sections.certifications && content.certifications.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Certifications</h2>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">{content.certifications.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ) : null}
          {content.sections.contact && hasSeekerContact(content.contact) ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Contact</h2>
              <div className="mt-4"><SeekerContactBlock contact={content.contact} className="text-sm text-slate-300" /></div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
