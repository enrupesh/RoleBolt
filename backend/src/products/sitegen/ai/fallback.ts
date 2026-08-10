import type { ISitegenWebsite } from "../models/SitegenWebsite";
import type {
  SitegenCreatorStructuredContent,
  SitegenSeekerStructuredContent,
  SitegenStructuredContent,
} from "../types/structuredContent";
import { sanitizeSitegenMediaUrl } from "../lib/sanitize";
import { applyCreatorSectionVisibility, applySeekerSectionVisibility } from "./sections";

function nullableString(value: unknown, max = 500): string | null {
  const cleaned = String(value ?? "").trim().slice(0, max);
  return cleaned || null;
}

function stringArray(value: unknown, maxItems = 30, maxLen = 120): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function textIncludes(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function buildSeekerSourceText(website: ISitegenWebsite): string {
  const profile = website.seekerProfile;
  const chunks = [
    website.resumeText || "",
    profile?.fullName || "",
    profile?.headline || "",
    profile?.summary || "",
    ...(profile?.skills || []),
    ...(profile?.experience || []).flatMap((item) => [item.title, item.company, item.description || ""]),
    ...(profile?.education || []).flatMap((item) => [item.school, item.degree || "", item.field || ""]),
    ...(profile?.projects || []).flatMap((item) => [item.name, item.description || ""]),
  ];
  return chunks.join("\n").toLowerCase();
}

function buildCreatorSourceText(website: ISitegenWebsite): string {
  const profile = website.creatorProfile;
  const chunks = [
    profile?.businessName || "",
    profile?.tagline || "",
    profile?.description || "",
    profile?.about || "",
    profile?.category || "",
    ...(profile?.services || []),
    ...(profile?.team || []).flatMap((item) => [item.name, item.role || "", item.bio || ""]),
    ...(profile?.portfolioLinks || []).flatMap((item) => [item.title, item.url]),
  ];
  return chunks.join("\n").toLowerCase();
}

export function buildSeekerFallback(website: ISitegenWebsite): SitegenSeekerStructuredContent {
  const profile = website.seekerProfile;
  const name = profile?.fullName?.trim() || website.username;
  const contact = {
    email: profile?.email?.trim() || null,
    phone: profile?.phone?.trim() || null,
    location: profile?.location?.trim() || null,
    website: profile?.website?.trim() || null,
    linkedin: profile?.linkedin?.trim() || null,
    github: profile?.github?.trim() || null,
    portfolio: profile?.portfolio?.trim() || null,
  };

  const content: SitegenSeekerStructuredContent = {
    type: "seeker",
    name,
    headline: profile?.headline?.trim() || null,
    about: profile?.summary?.trim() || null,
    photoUrl: sanitizeSitegenMediaUrl(profile?.photoUrl, 1000) || null,
    skills: [...(profile?.skills || [])],
    experience: (profile?.experience || []).map((item) => ({
      title: item.title,
      company: item.company,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      current: Boolean(item.current),
      bullets: item.description ? [item.description] : [],
    })),
    education: (profile?.education || []).map((item) => ({
      school: item.school,
      degree: item.degree || null,
      field: item.field || null,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      description: item.description || null,
    })),
    projects: (profile?.projects || []).map((item) => ({
      name: item.name,
      description: item.description || null,
      url: item.url || null,
    })),
    certifications: [],
    achievements: [],
    contact,
    sections: {
      about: Boolean(profile?.summary?.trim()),
      skills: Boolean(profile?.skills?.length),
      experience: Boolean(profile?.experience?.length),
      education: Boolean(profile?.education?.length),
      projects: Boolean(profile?.projects?.length),
      certifications: false,
      achievements: false,
      contact: Object.values(contact).some(Boolean),
    },
  };

  return applySeekerSectionVisibility(content);
}

export function buildCreatorFallback(website: ISitegenWebsite): SitegenCreatorStructuredContent {
  const profile = website.creatorProfile;
  const businessName = profile?.businessName?.trim() || website.username;

  const content: SitegenCreatorStructuredContent = {
    type: "creator",
    businessName,
    tagline: profile?.tagline?.trim() || null,
    about: profile?.about?.trim() || profile?.description?.trim() || null,
    category: profile?.category?.trim() || null,
    logoUrl: profile?.logoUrl?.trim() || null,
    services: [...(profile?.services || [])],
    location: profile?.location?.trim() || null,
    contact: {
      email: profile?.email?.trim() || null,
      phone: profile?.phone?.trim() || null,
      website: profile?.website?.trim() || null,
    },
    socialLinks: {
      linkedin: profile?.socialLinks?.linkedin?.trim() || null,
      instagram: profile?.socialLinks?.instagram?.trim() || null,
      twitter: profile?.socialLinks?.twitter?.trim() || null,
      youtube: profile?.socialLinks?.youtube?.trim() || null,
      tiktok: profile?.socialLinks?.tiktok?.trim() || null,
    },
    portfolio: (profile?.portfolioLinks || []).map((item) => ({
      title: item.title,
      url: item.url,
      description: null,
    })),
    team: (profile?.team || []).map((item) => ({
      name: item.name,
      role: item.role || null,
      bio: item.bio || null,
    })),
    sections: {
      hero: true,
      about: Boolean(profile?.about?.trim() || profile?.description?.trim()),
      services: Boolean(profile?.services?.length),
      portfolio: Boolean(profile?.portfolioLinks?.length),
      team: Boolean(profile?.team?.length),
      contact: Boolean(profile?.email || profile?.phone || profile?.website),
    },
  };

  return applyCreatorSectionVisibility(content);
}

export function buildFallbackStructuredContent(website: ISitegenWebsite): SitegenStructuredContent {
  return website.siteType === "seeker"
    ? buildSeekerFallback(website)
    : buildCreatorFallback(website);
}

function filterSeekerAgainstSource(
  ai: SitegenSeekerStructuredContent,
  website: ISitegenWebsite,
): SitegenSeekerStructuredContent {
  const sourceText = buildSeekerSourceText(website);
  const profile = website.seekerProfile;

  const experience = ai.experience.filter((item) =>
    (profile?.experience || []).some((source) =>
      source.title.toLowerCase() === item.title.toLowerCase()
      && source.company.toLowerCase() === item.company.toLowerCase(),
    ) || (textIncludes(sourceText, item.title) && textIncludes(sourceText, item.company)),
  );

  const education = ai.education.filter((item) =>
    (profile?.education || []).some((source) => source.school.toLowerCase() === item.school.toLowerCase())
    || textIncludes(sourceText, item.school),
  );

  const projects = ai.projects.filter((item) =>
    (profile?.projects || []).some((source) => source.name.toLowerCase() === item.name.toLowerCase())
    || textIncludes(sourceText, item.name),
  );

  const skills = ai.skills.filter((skill) =>
    (profile?.skills || []).some((source) => source.toLowerCase() === skill.toLowerCase())
    || textIncludes(sourceText, skill),
  );

  const certifications = ai.certifications.filter((item) => textIncludes(sourceText, item));
  const achievements = ai.achievements.filter((item) => textIncludes(sourceText, item));

  return applySeekerSectionVisibility({
    ...ai,
    name: profile?.fullName?.trim() || ai.name || website.username,
    headline: ai.headline || profile?.headline || null,
    about: ai.about || profile?.summary || null,
    photoUrl: sanitizeSitegenMediaUrl(profile?.photoUrl, 1000) || null,
    skills,
    experience: experience.length ? experience : buildSeekerFallback(website).experience,
    education: education.length ? education : buildSeekerFallback(website).education,
    projects: projects.length ? projects : buildSeekerFallback(website).projects,
    certifications,
    achievements,
    contact: {
      email: profile?.email || ai.contact.email,
      phone: profile?.phone || ai.contact.phone,
      location: profile?.location || ai.contact.location,
      website: profile?.website || ai.contact.website,
      linkedin: profile?.linkedin || ai.contact.linkedin,
      github: profile?.github || ai.contact.github,
      portfolio: profile?.portfolio || ai.contact.portfolio,
    },
  });
}

function filterCreatorAgainstSource(
  ai: SitegenCreatorStructuredContent,
  website: ISitegenWebsite,
): SitegenCreatorStructuredContent {
  const sourceText = buildCreatorSourceText(website);
  const profile = website.creatorProfile;

  const services = ai.services.filter((item) =>
    (profile?.services || []).some((source) => source.toLowerCase() === item.toLowerCase())
    || textIncludes(sourceText, item),
  );

  const portfolio = ai.portfolio.filter((item) =>
    (profile?.portfolioLinks || []).some((source) =>
      source.title.toLowerCase() === item.title.toLowerCase()
      && source.url.toLowerCase() === item.url.toLowerCase(),
    ) || (textIncludes(sourceText, item.title) && textIncludes(sourceText, item.url)),
  );

  const team = ai.team.filter((item) =>
    (profile?.team || []).some((source) => source.name.toLowerCase() === item.name.toLowerCase())
    || textIncludes(sourceText, item.name),
  );

  return applyCreatorSectionVisibility({
    ...ai,
    businessName: profile?.businessName?.trim() || ai.businessName || website.username,
    tagline: ai.tagline || profile?.tagline || null,
    about: ai.about || profile?.about || profile?.description || null,
    category: ai.category || profile?.category || null,
    logoUrl: profile?.logoUrl || ai.logoUrl || null,
    services: services.length ? services : buildCreatorFallback(website).services,
    location: profile?.location || ai.location || null,
    contact: {
      email: profile?.email || ai.contact.email,
      phone: profile?.phone || ai.contact.phone,
      website: profile?.website || ai.contact.website,
    },
    socialLinks: {
      linkedin: profile?.socialLinks?.linkedin || ai.socialLinks.linkedin,
      instagram: profile?.socialLinks?.instagram || ai.socialLinks.instagram,
      twitter: profile?.socialLinks?.twitter || ai.socialLinks.twitter,
      youtube: profile?.socialLinks?.youtube || ai.socialLinks.youtube,
      tiktok: profile?.socialLinks?.tiktok || ai.socialLinks.tiktok,
    },
    portfolio: portfolio.length ? portfolio : buildCreatorFallback(website).portfolio,
    team,
  });
}

export function parseSeekerStructuredFromAi(raw: unknown, website: ISitegenWebsite): SitegenSeekerStructuredContent {
  const input = (raw ?? {}) as Record<string, unknown>;
  const contactInput = (input.contact ?? {}) as Record<string, unknown>;

  const sectionsInput = (input.sections ?? {}) as Record<string, unknown>;

  const parsed: SitegenSeekerStructuredContent = {
    type: "seeker",
    name: String(input.name || website.seekerProfile?.fullName || website.username).trim().slice(0, 120),
    headline: nullableString(input.headline, 160),
    about: nullableString(input.about, 4000),
    photoUrl: null,
    skills: stringArray(input.skills, 40, 80),
    experience: Array.isArray(input.experience)
      ? input.experience.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          title: String(row.title || "").trim().slice(0, 160),
          company: String(row.company || "").trim().slice(0, 160),
          startDate: nullableString(row.startDate, 40),
          endDate: nullableString(row.endDate, 40),
          current: Boolean(row.current),
          bullets: stringArray(row.bullets, 8, 500),
        };
      }).filter((item) => item.title && item.company).slice(0, 20)
      : [],
    education: Array.isArray(input.education)
      ? input.education.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          school: String(row.school || "").trim().slice(0, 160),
          degree: nullableString(row.degree, 120),
          field: nullableString(row.field, 120),
          startDate: nullableString(row.startDate, 40),
          endDate: nullableString(row.endDate, 40),
          description: nullableString(row.description, 1000),
        };
      }).filter((item) => item.school).slice(0, 15)
      : [],
    projects: Array.isArray(input.projects)
      ? input.projects.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          name: String(row.name || "").trim().slice(0, 160),
          description: nullableString(row.description, 1000),
          url: nullableString(row.url, 500),
        };
      }).filter((item) => item.name).slice(0, 15)
      : [],
    certifications: stringArray(input.certifications, 20, 160),
    achievements: stringArray(input.achievements, 20, 300),
    contact: {
      email: nullableString(contactInput.email, 254),
      phone: nullableString(contactInput.phone, 40),
      location: nullableString(contactInput.location, 120),
      website: nullableString(contactInput.website, 500),
      linkedin: nullableString(contactInput.linkedin, 500),
      github: nullableString(contactInput.github, 500),
      portfolio: nullableString(contactInput.portfolio, 500),
    },
    sections: {
      about: Boolean(sectionsInput.about ?? nullableString(input.about, 10)),
      skills: Boolean(sectionsInput.skills ?? stringArray(input.skills).length > 0),
      experience: Boolean(sectionsInput.experience ?? (Array.isArray(input.experience) && input.experience.length > 0)),
      education: Boolean(sectionsInput.education ?? (Array.isArray(input.education) && input.education.length > 0)),
      projects: Boolean(sectionsInput.projects ?? (Array.isArray(input.projects) && input.projects.length > 0)),
      certifications: Boolean(sectionsInput.certifications ?? stringArray(input.certifications).length > 0),
      achievements: Boolean(sectionsInput.achievements ?? stringArray(input.achievements).length > 0),
      contact: Boolean(sectionsInput.contact ?? true),
    },
  };

  if (!parsed.name) throw new Error("Structured seeker content is missing a name.");
  return filterSeekerAgainstSource(parsed, website);
}

export function parseCreatorStructuredFromAi(raw: unknown, website: ISitegenWebsite): SitegenCreatorStructuredContent {
  const input = (raw ?? {}) as Record<string, unknown>;
  const contactInput = (input.contact ?? {}) as Record<string, unknown>;
  const socialInput = (input.socialLinks ?? {}) as Record<string, unknown>;

  const sectionsInput = (input.sections ?? {}) as Record<string, unknown>;

  const parsed: SitegenCreatorStructuredContent = {
    type: "creator",
    businessName: String(input.businessName || website.creatorProfile?.businessName || website.username).trim().slice(0, 160),
    tagline: nullableString(input.tagline, 200),
    about: nullableString(input.about, 4000),
    category: nullableString(input.category, 80),
    logoUrl: nullableString(input.logoUrl, 1000),
    services: stringArray(input.services, 20, 120),
    location: nullableString(input.location, 120),
    contact: {
      email: nullableString(contactInput.email, 254),
      phone: nullableString(contactInput.phone, 40),
      website: nullableString(contactInput.website, 500),
    },
    socialLinks: {
      linkedin: nullableString(socialInput.linkedin, 500),
      instagram: nullableString(socialInput.instagram, 500),
      twitter: nullableString(socialInput.twitter, 500),
      youtube: nullableString(socialInput.youtube, 500),
      tiktok: nullableString(socialInput.tiktok, 500),
    },
    portfolio: Array.isArray(input.portfolio)
      ? input.portfolio.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          title: String(row.title || "").trim().slice(0, 120),
          url: String(row.url || "").trim().slice(0, 500),
          description: nullableString(row.description, 1000),
        };
      }).filter((item) => item.title && item.url).slice(0, 12)
      : [],
    team: Array.isArray(input.team)
      ? input.team.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          name: String(row.name || "").trim().slice(0, 120),
          role: nullableString(row.role, 120),
          bio: nullableString(row.bio, 1000),
        };
      }).filter((item) => item.name).slice(0, 20)
      : [],
    sections: {
      hero: Boolean(sectionsInput.hero ?? true),
      about: Boolean(sectionsInput.about ?? nullableString(input.about, 10)),
      services: Boolean(sectionsInput.services ?? stringArray(input.services).length > 0),
      portfolio: Boolean(sectionsInput.portfolio ?? (Array.isArray(input.portfolio) && input.portfolio.length > 0)),
      team: Boolean(sectionsInput.team ?? (Array.isArray(input.team) && input.team.length > 0)),
      contact: Boolean(sectionsInput.contact ?? true),
    },
  };

  if (!parsed.businessName) throw new Error("Structured creator content is missing a business name.");
  return filterCreatorAgainstSource(parsed, website);
}
