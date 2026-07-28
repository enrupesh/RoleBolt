/**
 * Google Cloud Natural Language API Client
 *
 * Extracts structured entities from resume text:
 *   - skills / technologies  (CONSUMER_GOOD + OTHER types)
 *   - companies worked at    (ORGANIZATION type)
 *   - job titles             (keyword-matched from entities)
 *
 * Free tier: 5,000 requests / month
 * Docs: https://cloud.google.com/natural-language/docs/reference/rest/v1/documents/analyzeEntities
 *
 * Env: GOOGLE_CLOUD_API_KEY
 */

const NLP_BASE = "https://language.googleapis.com/v1/documents:analyzeEntities";

// Common job title keywords — used to classify entities as job titles
const JOB_TITLE_KEYWORDS = [
  "engineer", "developer", "designer", "manager", "analyst", "architect",
  "consultant", "director", "lead", "head", "officer", "specialist",
  "coordinator", "associate", "intern", "scientist", "researcher",
  "executive", "founder", "co-founder", "cto", "ceo", "vp", "president",
  "administrator", "technician", "programmer", "devops", "sre", "qa",
];

// Known skill / tech keywords for better classification
const SKILL_INDICATORS = [
  "js", "ts", "css", "html", "sql", "api", "sdk", "cli", "ui", "ux",
  "react", "vue", "angular", "node", "python", "java", "golang", "rust",
  "aws", "gcp", "azure", "docker", "kubernetes", "k8s", "git", "linux",
  "mongodb", "postgres", "redis", "graphql", "rest", "grpc", "ci", "cd",
  "ml", "ai", "llm", "nlp", "cv", "tensorflow", "pytorch", "spark",
];

export interface NlpEntities {
  skills: string[];
  companies: string[];
  jobTitles: string[];
}

interface GoogleNlpEntity {
  name: string;
  type: string;        // PERSON, ORGANIZATION, CONSUMER_GOOD, OTHER, etc.
  salience: number;    // 0–1, higher = more important in the text
  mentions?: { text: { content: string }; type: string }[];
}

function isSkillLike(name: string): boolean {
  const lower = name.toLowerCase();
  if (SKILL_INDICATORS.some(kw => lower === kw || lower.includes(kw))) return true;
  // Short ALL-CAPS words are often acronyms / tech names (e.g. "AWS", "REST")
  if (/^[A-Z][A-Z0-9.+#]{1,12}$/.test(name)) return true;
  return false;
}

function isJobTitleLike(name: string): boolean {
  const lower = name.toLowerCase();
  return JOB_TITLE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Extract skills, companies, and job titles from resume text using
 * Google Cloud Natural Language API.
 *
 * Returns empty arrays (gracefully) if the API key is missing or the call fails.
 */
export async function extractResumeEntities(
  resumeText: string,
  timeoutMs = 10_000
): Promise<NlpEntities> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    console.warn("[googleNlpClient] GOOGLE_CLOUD_API_KEY not set — skipping NLP extraction.");
    return { skills: [], companies: [], jobTitles: [] };
  }

  // Trim to 5 000 chars — NLP API has a 1 MB limit, but more text = more cost.
  const textSnippet = resumeText.slice(0, 5_000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${NLP_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: { type: "PLAIN_TEXT", content: textSnippet },
        encodingType: "UTF8",
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn("[googleNlpClient] Request failed:", err?.message ?? err);
    return { skills: [], companies: [], jobTitles: [] };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[googleNlpClient] API error (${res.status}): ${body}`);
    return { skills: [], companies: [], jobTitles: [] };
  }

  const data: any = await res.json().catch(() => null);
  const entities: GoogleNlpEntity[] = data?.entities ?? [];

  const skills   = new Set<string>();
  const companies = new Set<string>();
  const jobTitles = new Set<string>();

  for (const entity of entities) {
    const name    = entity.name?.trim();
    const type    = entity.type;
    const salience = entity.salience ?? 0;

    if (!name || name.length < 2) continue;

    if (type === "ORGANIZATION") {
      // Skip very common generic words
      if (!["the", "a", "inc", "llc", "ltd"].includes(name.toLowerCase())) {
        companies.add(name);
      }
    } else if (type === "CONSUMER_GOOD" || (type === "OTHER" && salience > 0.01)) {
      if (isJobTitleLike(name)) {
        jobTitles.add(name);
      } else if (isSkillLike(name) || type === "CONSUMER_GOOD") {
        skills.add(name);
      }
    } else if (type === "OTHER" && isSkillLike(name)) {
      skills.add(name);
    }
  }

  // Deduplicate case-insensitively and cap at reasonable limits
  const unique = (set: Set<string>, limit: number) =>
    [...set]
      .filter((v, i, arr) => arr.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i)
      .slice(0, limit);

  const result: NlpEntities = {
    skills:    unique(skills, 25),
    companies: unique(companies, 15),
    jobTitles: unique(jobTitles, 10),
  };

  console.log(
    `[googleNlpClient] ✓ Extracted — skills:${result.skills.length} companies:${result.companies.length} jobTitles:${result.jobTitles.length}`
  );

  return result;
}
