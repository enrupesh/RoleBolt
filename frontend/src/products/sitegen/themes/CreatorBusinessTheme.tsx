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

export function CreatorBusinessTheme({ content, username }: { content: SitegenCreatorStructuredContent; username: string }) {
  const displayName = content.businessName?.trim() || username;
  const navItems = creatorNavItems(content);
  const contactHref = navItems.some((item) => item.id === "contact") ? "#contact" : undefined;

  return (
    <div className="min-h-full bg-[#f4f7fb] text-slate-900">
      <ThemeNav brand={displayName} items={navItems} variant="light" />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-5">
              <AvatarBadge name={displayName} imageUrl={content.logoUrl} size="xl" variant="brand" />
              <div className="min-w-0">
                {content.category ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{content.category}</p>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Business website</p>
                )}
                <h1 className="mt-3 break-words font-display text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{displayName}</h1>
                {content.tagline ? <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{content.tagline}</p> : null}
              </div>
            </div>
            {contactHref ? <PrimaryButton href={contactHref} variant="brand">Contact us</PrimaryButton> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:px-8 sm:py-16">
        {content.about && content.sections.about ? (
          <ThemeSection id="about" title="About the business" eyebrow="Who we are">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-base leading-8 text-slate-600 shadow-[0_16px_50px_rgba(15,23,42,0.05)] sm:p-8">
              {content.about}
            </div>
          </ThemeSection>
        ) : null}

        {content.sections.services && content.services.length > 0 ? (
          <ThemeSection id="services" title="Services" eyebrow="What we offer">
            <ServiceCards services={content.services} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.portfolio && content.portfolio.length > 0 ? (
          <ThemeSection id="portfolio" title="Selected work" eyebrow="Portfolio">
            <PortfolioGrid items={content.portfolio} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.team && content.team.length > 0 ? (
          <ThemeSection id="team" title="Our team" eyebrow="People">
            <TeamGrid members={content.team} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.contact ? (
          <ThemeSection id="contact" title="Contact" eyebrow="Work with us">
            <CreatorContactPanel content={content} variant="light" />
          </ThemeSection>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-400 sm:px-8">
        {displayName} · {sitegenDisplayPublicUrl(username)}
      </footer>
    </div>
  );
}
