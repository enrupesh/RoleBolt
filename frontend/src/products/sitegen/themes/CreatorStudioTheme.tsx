import type { SitegenCreatorStructuredContent } from "../types/structuredContent";
import { sitegenDisplayPublicUrl } from "../lib/publicUrl";
import { creatorNavItems } from "./shared";
import {
  AvatarBadge,
  CreatorContactPanel,
  PortfolioGrid,
  PrimaryButton,
  ServiceCards,
  TeamGrid,
  ThemeNav,
  ThemeSection,
} from "./theme-ui";

export function CreatorStudioTheme({ content, username }: { content: SitegenCreatorStructuredContent; username: string }) {
  const displayName = content.businessName?.trim() || username;
  const navItems = creatorNavItems(content);
  const contactHref = navItems.some((item) => item.id === "contact") ? "#contact" : undefined;

  return (
    <div className="min-h-full bg-[#120a24] text-white">
      <ThemeNav brand={displayName} items={navItems} variant="glass" />

      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.22),transparent_40%),linear-gradient(180deg,rgba(76,29,149,0.35),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-24">
          <div className="flex justify-center">
            <AvatarBadge name={displayName} imageUrl={content.logoUrl} size="xl" variant="dark" />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Creator studio</p>
          <h1 className="mt-4 break-words font-display text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">{displayName}</h1>
          {content.tagline ? <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-violet-100/80 sm:text-xl">{content.tagline}</p> : null}
          {content.category ? <p className="mt-3 text-sm font-medium text-violet-200/55">{content.category}</p> : null}
          {contactHref ? (
            <div className="mt-8 flex justify-center">
              <PrimaryButton href={contactHref} variant="light">Start a project</PrimaryButton>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:px-8 sm:py-16">
        {content.about && content.sections.about ? (
          <ThemeSection id="about" title="About" eyebrow="Story" headerClassName="text-center text-white">
            <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 text-center text-base leading-8 text-violet-50/85 sm:p-8">
              {content.about}
            </div>
          </ThemeSection>
        ) : null}

        {content.sections.services && content.services.length > 0 ? (
          <ThemeSection id="services" title="What I do" eyebrow="Services" headerClassName="text-white">
            <ServiceCards services={content.services} variant="studio" />
          </ThemeSection>
        ) : null}

        {content.sections.portfolio && content.portfolio.length > 0 ? (
          <ThemeSection id="portfolio" title="Featured work" eyebrow="Portfolio" headerClassName="text-white">
            <PortfolioGrid items={content.portfolio} variant="studio" />
          </ThemeSection>
        ) : null}

        {content.sections.team && content.team.length > 0 ? (
          <ThemeSection id="team" title="Team" eyebrow="Collaborators" headerClassName="text-white">
            <TeamGrid members={content.team} variant="studio" />
          </ThemeSection>
        ) : null}

        {content.sections.contact ? (
          <ThemeSection id="contact" title="Get in touch" eyebrow="Contact" headerClassName="text-white">
            <CreatorContactPanel content={content} variant="studio" />
          </ThemeSection>
        ) : null}
      </main>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-violet-200/45 sm:px-8">
        {displayName} · {sitegenDisplayPublicUrl(username)}
      </footer>
    </div>
  );
}
