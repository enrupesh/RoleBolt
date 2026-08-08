import type {
  SitegenCreatorStructuredContent,
  SitegenSeekerStructuredContent,
} from "../types/structuredContent";

export function SafeExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function hasSeekerContact(contact: SitegenSeekerStructuredContent["contact"]): boolean {
  return Boolean(
    contact.email || contact.phone || contact.location || contact.website
    || contact.linkedin || contact.github || contact.portfolio,
  );
}

export function hasCreatorContact(content: SitegenCreatorStructuredContent): boolean {
  return Boolean(
    content.location || content.contact.email || content.contact.phone || content.contact.website,
  );
}

export function hasCreatorSocialLinks(social: SitegenCreatorStructuredContent["socialLinks"]): boolean {
  return Boolean(social.linkedin || social.instagram || social.twitter || social.youtube || social.tiktok);
}

export function formatDateRange(
  startDate: string | null,
  endDate: string | null,
  current?: boolean,
): string | null {
  const start = startDate?.trim();
  const end = current ? "Present" : endDate?.trim();
  if (start && end) return `${start} – ${end}`;
  return start || end || null;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function seekerNavItems(content: SitegenSeekerStructuredContent): Array<{ id: string; label: string }> {
  const items: Array<{ id: string; label: string }> = [];
  if (content.sections.about && content.about) items.push({ id: "about", label: "About" });
  if (content.sections.experience && content.experience.length) items.push({ id: "experience", label: "Experience" });
  if (content.sections.skills && content.skills.length) items.push({ id: "skills", label: "Skills" });
  if (content.sections.projects && content.projects.length) items.push({ id: "projects", label: "Projects" });
  if (content.sections.education && content.education.length) items.push({ id: "education", label: "Education" });
  if (content.sections.certifications && content.certifications.length) items.push({ id: "certifications", label: "Certifications" });
  if (content.sections.achievements && content.achievements.length) items.push({ id: "achievements", label: "Achievements" });
  if (content.sections.contact && hasSeekerContact(content.contact)) items.push({ id: "contact", label: "Contact" });
  return items;
}

export function creatorNavItems(content: SitegenCreatorStructuredContent): Array<{ id: string; label: string }> {
  const items: Array<{ id: string; label: string }> = [];
  if (content.sections.about && content.about) items.push({ id: "about", label: "About" });
  if (content.sections.services && content.services.length) items.push({ id: "services", label: "Services" });
  if (content.sections.portfolio && content.portfolio.length) items.push({ id: "portfolio", label: "Work" });
  if (content.sections.team && content.team.length) items.push({ id: "team", label: "Team" });
  if (content.sections.contact && (hasCreatorContact(content) || hasCreatorSocialLinks(content.socialLinks))) {
    items.push({ id: "contact", label: "Contact" });
  }
  return items;
}

export function SeekerContactBlock({
  contact,
  variant = "light",
}: {
  contact: SitegenSeekerStructuredContent["contact"];
  variant?: "light" | "dark" | "accent";
}) {
  if (!hasSeekerContact(contact)) return null;

  const linkClass = variant === "dark"
    ? "text-violet-200 hover:text-white"
    : variant === "accent"
      ? "text-blue-100 hover:text-white"
      : "text-blue-700 hover:text-blue-900";
  const textClass = variant === "dark" ? "text-slate-300" : variant === "accent" ? "text-blue-50/90" : "text-slate-600";

  const rows = [
    contact.location ? { label: "Location", value: contact.location } : null,
    contact.email ? { label: "Email", value: contact.email, href: `mailto:${contact.email}` } : null,
    contact.phone ? { label: "Phone", value: contact.phone, href: `tel:${contact.phone}` } : null,
    contact.website ? { label: "Website", value: "Website", href: contact.website } : null,
    contact.linkedin ? { label: "LinkedIn", value: "LinkedIn", href: contact.linkedin } : null,
    contact.github ? { label: "GitHub", value: "GitHub", href: contact.github } : null,
    contact.portfolio ? { label: "Portfolio", value: "Portfolio", href: contact.portfolio } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string }>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-2xl border border-current/10 bg-current/[0.03] px-4 py-3">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${variant === "light" ? "text-slate-400" : "text-white/45"}`}>
            {row.label}
          </p>
          {row.href ? (
            <SafeExternalLink href={row.href} className={`mt-1 block text-sm font-medium ${linkClass}`}>
              {row.value}
            </SafeExternalLink>
          ) : (
            <p className={`mt-1 text-sm font-medium ${textClass}`}>{row.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function CreatorSocialLinks({
  social,
  className = "flex flex-wrap gap-2",
  pill = false,
}: {
  social: SitegenCreatorStructuredContent["socialLinks"];
  className?: string;
  pill?: boolean;
}) {
  if (!hasCreatorSocialLinks(social)) return null;
  const links = [
    social.linkedin ? { label: "LinkedIn", href: social.linkedin } : null,
    social.instagram ? { label: "Instagram", href: social.instagram } : null,
    social.twitter ? { label: "Twitter", href: social.twitter } : null,
    social.youtube ? { label: "YouTube", href: social.youtube } : null,
    social.tiktok ? { label: "TikTok", href: social.tiktok } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <div className={className}>
      {links.map((item) => (
        <SafeExternalLink
          key={item.label}
          href={item.href}
          className={pill
            ? "inline-flex items-center rounded-full border border-current/15 px-3.5 py-1.5 text-sm font-medium transition hover:bg-current/10"
            : "text-sm font-medium hover:underline"}
        >
          {item.label}
        </SafeExternalLink>
      ))}
    </div>
  );
}
