/**
 * Resume Entity Extractor — powered by Google Gemini (GEMINI_PRIMARY_KEY)
 *
 * Extracts structured entities from resume text:
 *   - skills / technologies
 *   - companies worked at
 *   - job titles held
 *
 * Uses the existing GEMINI_PRIMARY_KEY — no separate Google Cloud billing needed.
 * Falls back to empty arrays gracefully if the key is missing or call fails.
 */

import { callGeminiChain } from "./geminiClient";

export interface NlpEntities {
  skills: string[];
  companies: string[];
  jobTitles: string[];
}

/**
 * Extract skills, companies, and job titles from resume text using Gemini.
 * Returns empty arrays gracefully if key is missing or call fails.
 */
export async function extractResumeEntities(resumeText: string): Promise<NlpEntities> {
  const apiKey = process.env.GEMINI_PRIMARY_KEY;
  if (!apiKey) {
    console.warn("[googleNlpClient] GEMINI_PRIMARY_KEY not set — skipping NLP extraction.");
    return { skills: [], companies: [], jobTitles: [] };
  }

  const prompt = `You are a resume parser. Extract structured information from the resume below.

RESUME:
${resumeText.slice(0, 4000)}

Extract and return ONLY this JSON (no markdown, no extra text):
{
  "skills": ["skill1", "skill2", ...],
  "companies": ["company1", "company2", ...],
  "jobTitles": ["title1", "title2", ...]
}

Rules:
- skills: technical skills, tools, frameworks, programming languages, certifications (max 25)
- companies: employer/organization names the candidate worked at (max 15)
- jobTitles: job titles/roles the candidate held (max 10)
- If nothing found for a category, return empty array []
- Return ONLY the JSON, nothing else`;

  try {
    const raw = await callGeminiChain({ prompt, jsonMode: true, maxOutputTokens: 500, temperature: 0.1 });

    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const result: NlpEntities = {
      skills:    Array.isArray(parsed.skills)    ? parsed.skills.slice(0, 25)    : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies.slice(0, 15) : [],
      jobTitles: Array.isArray(parsed.jobTitles) ? parsed.jobTitles.slice(0, 10) : [],
    };

    console.log(
      `[googleNlpClient] ✓ Gemini extracted — skills:${result.skills.length} companies:${result.companies.length} jobTitles:${result.jobTitles.length}`
    );
    return result;
  } catch (err: any) {
    console.warn("[googleNlpClient] Entity extraction failed:", err?.message ?? err);
    return { skills: [], companies: [], jobTitles: [] };
  }
}
