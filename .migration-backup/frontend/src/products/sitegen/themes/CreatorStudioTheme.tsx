import type { SitegenCreatorStructuredContent } from "../types/structuredContent";
import { CreatorSocialLinks, SafeExternalLink, hasCreatorContact } from "./shared";

export function CreatorStudioTheme({ content, username }: { content: SitegenCreatorStructuredContent; username: string }) {
  const displayName = content.businessName?.trim() || username;

  return (
    <div className="min-h-full bg-gradient-to-br from-[#1a1033] via-[#2a1450] to-[#4c1d95] text-white">
      <header className="px-5 py-12 text-center sm:px-8 sm:py-16">
        {content.logoUrl ? <img src={content.logoUrl} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" /> : null}
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">rolebolt.tech/{username}</p>
        <h1 className="mt-4 break-words font-display text-3xl font-semibold tracking-[-0.06em] sm:text-5xl">{displayName}</h1>
        {content.tagline ? <p className="mx-auto mt-4 max-w-2xl text-base text-violet-100/75 sm:text-lg">{content.tagline}</p> : null}
      </header>
      <main className="mx-auto max-w-4xl space-y-10 px-5 pb-16 sm:px-8">
        {content.about && content.sections.about ? <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-center sm:p-8"><p className="text-base leading-8 text-violet-50/85">{content.about}</p></section> : null}
        {content.sections.services && content.services.length > 0 ? (
          <section>
            <h2 className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">What I do</h2>
            <div className="mt-5 flex flex-wrap justify-center gap-3">{content.services.map((item) => <span key={item} className="rounded-full border border-white/15 px-4 py-2 text-sm">{item}</span>)}</div>
          </section>
        ) : null}
        {content.sections.portfolio && content.portfolio.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2">
            {content.portfolio.map((item) => (
              <SafeExternalLink key={item.url} href={item.url} className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                <h3 className="font-semibold">{item.title}</h3>
                {item.description ? <p className="mt-2 text-sm text-violet-100/70">{item.description}</p> : null}
              </SafeExternalLink>
            ))}
          </section>
        ) : null}
        {content.sections.team && content.team.length > 0 ? (
          <section>
            <h2 className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Team</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">{content.team.map((member) => <div key={member.name} className="rounded-3xl border border-white/10 bg-white/5 p-5"><h3 className="font-semibold">{member.name}</h3>{member.role ? <p className="text-sm text-violet-200/70">{member.role}</p> : null}</div>)}</div>
          </section>
        ) : null}
        {content.sections.contact && hasCreatorContact(content) ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-center sm:p-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Contact</h2>
            <div className="mt-4 space-y-2 text-sm text-violet-100/80">
              {content.location ? <p>{content.location}</p> : null}
              {content.contact.email ? <p>{content.contact.email}</p> : null}
              {content.contact.phone ? <p>{content.contact.phone}</p> : null}
              {content.contact.website ? <SafeExternalLink href={content.contact.website} className="text-violet-100 hover:underline">{content.contact.website}</SafeExternalLink> : null}
            </div>
            <CreatorSocialLinks social={content.socialLinks} className="mt-4 justify-center text-violet-100" />
          </section>
        ) : null}
      </main>
    </div>
  );
}
