const SEEKER_SYSTEM = `You are Sitegen's professional profile structuring assistant.
Your job is to organize user-provided resume and profile information into clean JSON for a pre-built website theme.
You must NEVER generate HTML, CSS, React, code, or layout instructions.
You must NEVER invent employers, schools, skills, certifications, achievements, dates, contact details, or facts that are not supported by the source data.
If information is missing, use null or an empty array.
You may lightly polish wording for clarity, but do not add new facts.
Decide which sections deserve emphasis based on what is actually present — richer experience should surface experience; strong project portfolios should surface projects; certifications and achievements only when explicitly supported.
Return ONLY valid JSON matching the requested schema.`;

const CREATOR_SYSTEM = `You are Sitegen's business/creator profile structuring assistant.
Your job is to organize user-provided business information into clean JSON for a pre-built website theme.
You must NEVER generate HTML, CSS, React, code, or layout instructions.
You must NEVER invent services, team members, clients, locations, portfolio items, or facts that are not supported by the source data.
If information is missing, use null or an empty array.
You may lightly polish wording for clarity, but do not add new facts.
Emphasize sections that match the user's actual information — service-heavy businesses should highlight services; portfolio-led creators should highlight portfolio; team only when names are provided.
Return ONLY valid JSON matching the requested schema.`;

/** Keep prompts lean — very long resume text slows NVIDIA without improving output. */
export const SITEGEN_RESUME_PROMPT_MAX_CHARS = 8_000;

export function truncateResumeForPrompt(resumeText: string, maxChars = SITEGEN_RESUME_PROMPT_MAX_CHARS): string {
  const trimmed = resumeText.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[Resume text truncated for processing — earlier sections prioritized.]`;
}

export function buildSeekerStructuringPrompt(input: {
  profileJson: string;
  resumeText: string;
}): { system: string; prompt: string } {
  const resumeText = truncateResumeForPrompt(input.resumeText);

  return {
    system: SEEKER_SYSTEM,
    prompt: `Structure the following Job Seeker information into website-ready JSON.

Rules:
- Use only facts present in the profile JSON or resume text.
- When resume text is provided, extract experience, education, skills, projects, certifications, and achievements from it — but only when clearly stated.
- Merge profile fields with resume-derived facts; prefer the profile for contact details when both exist.
- Do not invent experience, education, skills, certifications, or achievements.
- Use null for missing scalar fields.
- Use [] for missing lists.
- Write a concise professional headline only when supported by the source data.
- For experience bullets, split role descriptions into short achievement bullets without adding new facts.
- recommendedThemeId: choose "seeker-modern" for project-heavy or design/tech portfolios; choose "seeker-classic" for experience-led or traditional professional profiles.
- sections: set each boolean true only when that section has real content to show. Hide empty sections.

Return JSON with this shape:
{
  "name": "string",
  "headline": "string|null",
  "about": "string|null",
  "skills": ["string"],
  "experience": [{"title":"string","company":"string","startDate":"string|null","endDate":"string|null","current":false,"bullets":["string"]}],
  "education": [{"school":"string","degree":"string|null","field":"string|null","startDate":"string|null","endDate":"string|null","description":"string|null"}],
  "projects": [{"name":"string","description":"string|null","url":"string|null"}],
  "certifications": ["string"],
  "achievements": ["string"],
  "contact": {"email":"string|null","phone":"string|null","location":"string|null","website":"string|null","linkedin":"string|null","github":"string|null","portfolio":"string|null"},
  "sections": {"about":false,"skills":false,"experience":false,"education":false,"projects":false,"certifications":false,"achievements":false,"contact":false},
  "recommendedThemeId": "seeker-classic|seeker-modern"
}

PROFILE JSON:
${input.profileJson}

RESUME TEXT:
${resumeText || "(none)"}`,
  };
}

export function buildCreatorStructuringPrompt(input: {
  profileJson: string;
}): { system: string; prompt: string } {
  return {
    system: CREATOR_SYSTEM,
    prompt: `Structure the following Creator/Business information into website-ready JSON.

Rules:
- Use only facts present in the profile data.
- Do not invent services, team members, portfolio items, or company facts.
- Use null for missing scalar fields.
- Use [] for missing lists.
- Preserve the business name and category when provided.
- logoUrl must only be copied from profile data when present — never invent URLs.
- recommendedThemeId: choose "creator-studio" for solo creators, personal brands, or lean portfolios; choose "creator-business" for agencies, startups, or service businesses with teams.
- sections: set each boolean true only when that section has real content to show. hero should stay true when a business name exists.

Return JSON with this shape:
{
  "businessName": "string",
  "tagline": "string|null",
  "about": "string|null",
  "category": "string|null",
  "logoUrl": "string|null",
  "services": ["string"],
  "location": "string|null",
  "contact": {"email":"string|null","phone":"string|null","website":"string|null"},
  "socialLinks": {"linkedin":"string|null","instagram":"string|null","twitter":"string|null","youtube":"string|null","tiktok":"string|null"},
  "portfolio": [{"title":"string","url":"string","description":"string|null"}],
  "team": [{"name":"string","role":"string|null","bio":"string|null"}],
  "sections": {"hero":true,"about":false,"services":false,"portfolio":false,"team":false,"contact":false},
  "recommendedThemeId": "creator-business|creator-studio"
}

PROFILE JSON:
${input.profileJson}`,
  };
}
