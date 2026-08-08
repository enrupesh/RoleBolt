import type { SitegenSeekerStructuredContent } from "../types/structuredContent";
import { sitegenDisplayPublicUrl } from "../lib/publicUrl";
import { SeekerContactBlock, seekerNavItems } from "./shared";
import {
  AvatarBadge,
  BulletHighlights,
  EducationList,
  ExperienceTimeline,
  ProjectShowcase,
  SkillGrid,
  ThemeNav,
  ThemeSection,
} from "./theme-ui";

export function SeekerModernTheme({ content, username }: { content: SitegenSeekerStructuredContent; username: string }) {
  const displayName = content.name?.trim() || username;
  const navItems = seekerNavItems(content);

  return (
    <div className="min-h-full bg-[#0b1020] text-white">
      <ThemeNav brand={displayName} items={navItems} variant="glass" />

      <header id={content.about && content.sections.about ? "about" : undefined} className="relative overflow-hidden border-b border-white/10 scroll-mt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_38%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Modern portfolio</p>
            <h1 className="mt-4 break-words font-display text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">{displayName}</h1>
            {content.headline ? <p className="mt-5 text-xl text-violet-100/85 sm:text-2xl">{content.headline}</p> : null}
            {content.about && content.sections.about ? (
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">{content.about}</p>
            ) : null}
          </div>
          <div className="flex items-end justify-start lg:justify-end">
            <AvatarBadge name={displayName} imageUrl={content.photoUrl} size="xl" variant="dark" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:px-8 sm:py-16">
        {content.sections.skills && content.skills.length > 0 ? (
          <ThemeSection id="skills" title="Skills & tools" eyebrow="Capabilities" headerClassName="text-white">
            <SkillGrid skills={content.skills} variant="dark" />
          </ThemeSection>
        ) : null}

        {content.sections.experience && content.experience.length > 0 ? (
          <ThemeSection id="experience" title="Experience" eyebrow="Career path" headerClassName="text-white">
            <ExperienceTimeline items={content.experience} variant="dark" />
          </ThemeSection>
        ) : null}

        {content.sections.projects && content.projects.length > 0 ? (
          <ThemeSection id="projects" title="Projects" eyebrow="Selected work" headerClassName="text-white">
            <ProjectShowcase items={content.projects} variant="dark" />
          </ThemeSection>
        ) : null}

        <div className="grid gap-14 lg:grid-cols-2">
          {content.sections.education && content.education.length > 0 ? (
            <ThemeSection id="education" title="Education" eyebrow="Academic" headerClassName="text-white">
              <EducationList items={content.education} variant="dark" />
            </ThemeSection>
          ) : null}

          {content.sections.certifications && content.certifications.length > 0 ? (
            <ThemeSection id="certifications" title="Certifications" eyebrow="Credentials" headerClassName="text-white">
              <BulletHighlights items={content.certifications} variant="dark" />
            </ThemeSection>
          ) : null}
        </div>

        {content.sections.achievements && content.achievements.length > 0 ? (
          <ThemeSection id="achievements" title="Achievements" eyebrow="Recognition" headerClassName="text-white">
            <BulletHighlights items={content.achievements} variant="dark" />
          </ThemeSection>
        ) : null}

        {content.sections.contact ? (
          <ThemeSection id="contact" title="Contact" eyebrow="Let’s connect" headerClassName="text-white">
            <SeekerContactBlock contact={content.contact} variant="dark" />
          </ThemeSection>
        ) : null}
      </main>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-violet-200/45 sm:px-8">
        {displayName} · {sitegenDisplayPublicUrl(username)}
      </footer>
    </div>
  );
}
