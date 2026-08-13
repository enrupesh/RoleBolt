import type {
  SitegenCreatorProfile,
  SitegenSeekerExperience,
  SitegenSeekerEducation,
  SitegenSeekerProfile,
  SitegenSeekerProject,
} from "../types/profile";
import { sanitizeHttpUrl, sanitizeSitegenMediaUrl } from "./sanitize";

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanOptionalString(value: unknown, max = 500): string | undefined {
  const cleaned = cleanString(value, max);
  return cleaned || undefined;
}

function cleanStringArray(value: unknown, maxItems = 30, maxLen = 120): string[] | undefined {
  if (!Array.isArray(value)) {
    const single = cleanOptionalString(value, maxLen);
    if (!single) return undefined;
    return single.split(",").map((item) => item.trim()).filter(Boolean).slice(0, maxItems);
  }
  const items = value.map((item) => cleanString(item, maxLen)).filter(Boolean).slice(0, maxItems);
  return items.length ? items : undefined;
}

function parseExperience(value: unknown): SitegenSeekerExperience[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => ({
      title: cleanString((item as SitegenSeekerExperience)?.title, 160),
      company: cleanString((item as SitegenSeekerExperience)?.company, 160),
      startDate: cleanOptionalString((item as SitegenSeekerExperience)?.startDate, 40),
      endDate: cleanOptionalString((item as SitegenSeekerExperience)?.endDate, 40),
      current: Boolean((item as SitegenSeekerExperience)?.current),
      description: cleanOptionalString((item as SitegenSeekerExperience)?.description, 2000),
    }))
    .filter((item) => item.title && item.company)
    .slice(0, 20);
  return items.length ? items : undefined;
}

function parseEducation(value: unknown): SitegenSeekerEducation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => ({
      school: cleanString((item as SitegenSeekerEducation)?.school, 160),
      degree: cleanOptionalString((item as SitegenSeekerEducation)?.degree, 120),
      field: cleanOptionalString((item as SitegenSeekerEducation)?.field, 120),
      startDate: cleanOptionalString((item as SitegenSeekerEducation)?.startDate, 40),
      endDate: cleanOptionalString((item as SitegenSeekerEducation)?.endDate, 40),
      description: cleanOptionalString((item as SitegenSeekerEducation)?.description, 1000),
    }))
    .filter((item) => item.school)
    .slice(0, 15);
  return items.length ? items : undefined;
}

function parseProjects(value: unknown): SitegenSeekerProject[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => ({
      name: cleanString((item as SitegenSeekerProject)?.name, 160),
      description: cleanOptionalString((item as SitegenSeekerProject)?.description, 1000),
      url: sanitizeHttpUrl((item as SitegenSeekerProject)?.url, 500),
    }))
    .filter((item) => item.name)
    .slice(0, 15);
  return items.length ? items : undefined;
}

export function parseSeekerProfile(body: unknown): { profile?: SitegenSeekerProfile; error?: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const fullName = cleanString(input.fullName, 120);
  if (!fullName) return { error: "Your name is required." };

  const profile: SitegenSeekerProfile = {
    fullName,
    headline: cleanOptionalString(input.headline, 160),
    summary: cleanOptionalString(input.summary, 4000),
    email: cleanOptionalString(input.email, 254),
    phone: cleanOptionalString(input.phone, 40),
    location: cleanOptionalString(input.location, 120),
    website: sanitizeHttpUrl(input.website, 500),
    linkedin: sanitizeHttpUrl(input.linkedin, 500),
    github: sanitizeHttpUrl(input.github, 500),
    portfolio: sanitizeHttpUrl(input.portfolio, 500),
    photoUrl: sanitizeSitegenMediaUrl(input.photoUrl, 1000),
    skills: cleanStringArray(input.skills, 40, 80),
    experience: parseExperience(input.experience),
    education: parseEducation(input.education),
    projects: parseProjects(input.projects),
  };

  return { profile };
}

export function validateSeekerProfileSubmission(input: {
  profile: SitegenSeekerProfile;
  resumeText?: string;
  inputMode?: string;
}): string | null {
  if (!input.profile.fullName.trim()) return "Your name is required.";
  const hasResume = Boolean(input.resumeText && input.resumeText.trim().length >= 40);
  const hasSummary = Boolean(input.profile.summary && input.profile.summary.trim().length >= 10);
  const hasExperience = Boolean(input.profile.experience?.length);
  if (!hasResume && !hasSummary && !hasExperience) {
    return "Please upload a resume, write a short summary, or add at least one experience entry.";
  }
  return null;
}

export function parseCreatorProfile(body: unknown): { profile?: SitegenCreatorProfile; error?: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const businessName = cleanString(input.businessName, 160);
  if (!businessName) return { error: "Business or creator name is required." };

  const social = (input.socialLinks ?? {}) as Record<string, unknown>;
  const portfolioLinks = Array.isArray(input.portfolioLinks)
    ? input.portfolioLinks
      .map((item) => ({
        title: cleanString((item as { title?: string })?.title, 120),
        url: sanitizeHttpUrl((item as { url?: string })?.url, 500) || "",
      }))
      .filter((item) => item.title && item.url)
      .slice(0, 12)
    : [];

  const team = Array.isArray(input.team)
    ? input.team
      .map((item) => ({
        name: cleanString((item as { name?: string })?.name, 120),
        role: cleanOptionalString((item as { role?: string })?.role, 120),
        bio: cleanOptionalString((item as { bio?: string })?.bio, 1000),
      }))
      .filter((item) => item.name)
      .slice(0, 20)
    : [];

  const profile: SitegenCreatorProfile = {
    businessName,
    category: cleanOptionalString(input.category, 80),
    tagline: cleanOptionalString(input.tagline, 200),
    description: cleanOptionalString(input.description, 4000),
    logoUrl: sanitizeSitegenMediaUrl(input.logoUrl, 1000),
    about: cleanOptionalString(input.about, 4000),
    services: cleanStringArray(input.services, 20, 120),
    location: cleanOptionalString(input.location, 120),
    email: cleanOptionalString(input.email, 254),
    phone: cleanOptionalString(input.phone, 40),
    website: sanitizeHttpUrl(input.website, 500),
    socialLinks: {
      linkedin: sanitizeHttpUrl(social.linkedin, 500),
      instagram: sanitizeHttpUrl(social.instagram, 500),
      twitter: sanitizeHttpUrl(social.twitter, 500),
      youtube: sanitizeHttpUrl(social.youtube, 500),
      tiktok: sanitizeHttpUrl(social.tiktok, 500),
    },
    portfolioLinks: portfolioLinks.length ? portfolioLinks : undefined,
    team: team.length ? team : undefined,
    imageUrls: cleanStringArray(input.imageUrls, 12, 1000),
  };

  return { profile };
}

export function validateCreatorProfileSubmission(profile: SitegenCreatorProfile): string | null {
  if (!profile.businessName.trim()) return "Business or creator name is required.";
  const hasDescription = Boolean(profile.description && profile.description.trim().length >= 10);
  const hasTagline = Boolean(profile.tagline && profile.tagline.trim().length >= 5);
  const hasAbout = Boolean(profile.about && profile.about.trim().length >= 10);
  if (!hasDescription && !hasTagline && !hasAbout) {
    return "Please add a short description, tagline, or about section.";
  }
  return null;
}
