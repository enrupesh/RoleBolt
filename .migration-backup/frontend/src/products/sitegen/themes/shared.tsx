import type { SitegenCreatorStructuredContent, SitegenSeekerStructuredContent } from "../types/structuredContent";

export function SafeExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
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

export function SeekerContactBlock({
  contact,
  className = "text-sm text-slate-600",
}: {
  contact: SitegenSeekerStructuredContent["contact"];
  className?: string;
}) {
  if (!hasSeekerContact(contact)) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {contact.location ? <p>{contact.location}</p> : null}
      {contact.email ? <p>{contact.email}</p> : null}
      {contact.phone ? <p>{contact.phone}</p> : null}
      {contact.website ? <SafeExternalLink href={contact.website} className="text-blue-700 hover:underline">{contact.website}</SafeExternalLink> : null}
      {contact.linkedin ? <SafeExternalLink href={contact.linkedin} className="text-blue-700 hover:underline">LinkedIn</SafeExternalLink> : null}
      {contact.github ? <SafeExternalLink href={contact.github} className="text-blue-700 hover:underline">GitHub</SafeExternalLink> : null}
      {contact.portfolio ? <SafeExternalLink href={contact.portfolio} className="text-blue-700 hover:underline">Portfolio</SafeExternalLink> : null}
    </div>
  );
}

export function CreatorSocialLinks({
  social,
  className = "flex flex-wrap gap-3 text-sm",
}: {
  social: SitegenCreatorStructuredContent["socialLinks"];
  className?: string;
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
        <SafeExternalLink key={item.label} href={item.href} className="font-medium hover:underline">
          {item.label}
        </SafeExternalLink>
      ))}
    </div>
  );
}
