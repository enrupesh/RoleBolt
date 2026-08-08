const SEEKER_SYSTEM = `You are Sitegen's professional profile structuring assistant.
Your job is to organize user-provided resume/profile information into clean JSON for a pre-built website theme.
You must NEVER generate HTML, CSS, React, code, or layout instructions.
You must NEVER invent employers, schools, skills, certifications, achievements, dates, or facts that are not supported by the source data.
If information is missing, use null or an empty array.
You may lightly polish wording for clarity, but do not add new facts.
Return ONLY valid JSON matching the requested schema.`;

const CREATOR_SYSTEM = `You are Sitegen's business/creator profile structuring assistant.
Your job is to organize user-provided business information into clean JSON for a pre-built website theme.
You must NEVER generate HTML, CSS, React, code, or layout instructions.
You must NEVER invent services, team members, clients, locations, or facts that are not supported by the source data.
If information is missing, use null or an empty array.
You may lightly polish wording for clarity, but do not add new facts.
Return ONLY valid JSON matching the requested schema.`;

/** Keep prompts lean — very long resume text slows NVIDIA without improving output. */
export const SITEGEN_RESUME_PROMPT_MAX_CHARS = 12_000;

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
- Use only facts present in the profile or resume text.
- Do not invent experience, education, skills, certifications, or achievements.
- Use null for missing scalar fields.
- Use [] for missing lists.
- recommendedThemeId must be either "seeker-classic" or "seeker-modern".

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
- recommendedThemeId must be either "creator-business" or "creator-studio".

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
  "recommendedThemeId": "creator-business|creator-studio"
}

PROFILE JSON:
${input.profileJson}`,
  };
}
