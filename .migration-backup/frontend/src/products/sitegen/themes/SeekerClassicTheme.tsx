import type { SitegenSeekerStructuredContent } from "../types/structuredContent";
import { sitegenDisplayPublicUrl } from "../lib/publicUrl";
import { SeekerContactBlock, seekerNavItems } from "./shared";
import {
  AvatarBadge,
  BulletHighlights,
  EducationList,
  ExperienceTimeline,
  PrimaryButton,
  ProjectShowcase,
  SkillGrid,
  ThemeNav,
  ThemeSection,
} from "./theme-ui";

export function SeekerClassicTheme({ content, username }: { content: SitegenSeekerStructuredContent; username: string }) {
  const displayName = content.name?.trim() || username;
  const navItems = seekerNavItems(content);
  const contactHref = navItems.some((item) => item.id === "contact") ? "#contact" : undefined;

  return (
    <div className="min-h-full bg-[#f8fafc] text-slate-900">
      <ThemeNav brand={displayName} items={navItems} variant="light" />

      <header id={content.about && content.sections.about ? "about" : undefined} className="border-b border-slate-200 bg-white scroll-mt-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[auto_1fr] lg:items-center">
          <AvatarBadge name={displayName} imageUrl={content.photoUrl} size="xl" variant="brand" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Professional Portfolio</p>
            <h1 className="mt-3 break-words font-display text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{displayName}</h1>
            {content.headline ? <p className="mt-4 text-lg font-medium text-slate-600 sm:text-xl">{content.headline}</p> : null}
            {content.about && content.sections.about ? (
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{content.about}</p>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
              {contactHref ? <PrimaryButton href={contactHref} variant="brand">Get in touch</PrimaryButton> : null}
              {content.contact.portfolio ? <PrimaryButton href={content.contact.portfolio} variant="light">View portfolio</PrimaryButton> : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:px-8 sm:py-16">
        {content.sections.skills && content.skills.length > 0 ? (
          <ThemeSection id="skills" title="Core skills" eyebrow="Expertise">
            <SkillGrid skills={content.skills} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.experience && content.experience.length > 0 ? (
          <ThemeSection id="experience" title="Professional experience" eyebrow="Career">
            <ExperienceTimeline items={content.experience} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.projects && content.projects.length > 0 ? (
          <ThemeSection id="projects" title="Selected projects" eyebrow="Work">
            <ProjectShowcase items={content.projects} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.education && content.education.length > 0 ? (
          <ThemeSection id="education" title="Education" eyebrow="Background">
            <EducationList items={content.education} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.certifications && content.certifications.length > 0 ? (
          <ThemeSection id="certifications" title="Certifications" eyebrow="Credentials">
            <BulletHighlights items={content.certifications} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.achievements && content.achievements.length > 0 ? (
          <ThemeSection id="achievements" title="Achievements" eyebrow="Highlights">
            <BulletHighlights items={content.achievements} variant="light" />
          </ThemeSection>
        ) : null}

        {content.sections.contact ? (
          <ThemeSection id="contact" title="Contact" eyebrow="Connect">
            <SeekerContactBlock contact={content.contact} variant="light" />
          </ThemeSection>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-400 sm:px-8">
        {displayName} · {sitegenDisplayPublicUrl(username)}
      </footer>
    </div>
  );
}
