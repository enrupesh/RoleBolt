import type {
  SitegenCreatorStructuredContent,
  SitegenSeekerStructuredContent,
} from "../types/structuredContent";

function hasSeekerContact(contact: SitegenSeekerStructuredContent["contact"]): boolean {
  return Boolean(
    contact.email || contact.phone || contact.location || contact.website
    || contact.linkedin || contact.github || contact.portfolio,
  );
}

function hasCreatorContact(content: SitegenCreatorStructuredContent): boolean {
  return Boolean(
    content.location || content.contact.email || content.contact.phone || content.contact.website,
  );
}

/** Derive visible sections only from actual structured content — never show empty blocks. */
export function inferSeekerSections(content: SitegenSeekerStructuredContent): SitegenSeekerStructuredContent["sections"] {
  return {
    about: Boolean(content.about?.trim()),
    skills: content.skills.length > 0,
    experience: content.experience.length > 0,
    education: content.education.length > 0,
    projects: content.projects.length > 0,
    certifications: content.certifications.length > 0,
    achievements: content.achievements.length > 0,
    contact: hasSeekerContact(content.contact),
  };
}

export function inferCreatorSections(content: SitegenCreatorStructuredContent): SitegenCreatorStructuredContent["sections"] {
  return {
    hero: true,
    about: Boolean(content.about?.trim()),
    services: content.services.length > 0,
    portfolio: content.portfolio.length > 0,
    team: content.team.length > 0,
    contact: hasCreatorContact(content),
  };
}

export function applySeekerSectionVisibility(content: SitegenSeekerStructuredContent): SitegenSeekerStructuredContent {
  return { ...content, sections: inferSeekerSections(content) };
}

export function applyCreatorSectionVisibility(content: SitegenCreatorStructuredContent): SitegenCreatorStructuredContent {
  return { ...content, sections: inferCreatorSections(content) };
}
