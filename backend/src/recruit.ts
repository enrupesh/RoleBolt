import express from "express";
import crypto from "crypto";
import { connectMongo } from "./db";
import { RecruitJob } from "./models/RecruitJob";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitSeekerProfile } from "./models/RecruitSeekerProfile";
import { RecruitCompanyProfile } from "./models/RecruitCompanyProfile";
import { callNvidiaChatCompletions } from "./ai/nvidiaClient";
import { RecruitJobAlert } from "./models/RecruitJobAlert";
import { UsageEvent } from "./models/UsageEvent";
import { RecruitProfile } from "./models/RecruitProfile";

function trackEvent(event: string, uid?: string, data?: Record<string, unknown>) {
  UsageEvent.create({ event, uid, data: data ?? {} }).catch(() => {});
}

export const recruitRouter = express.Router();
export const recruitPublicRouter = express.Router();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY ?? "";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://www.plyndrox.app";

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

recruitRouter.post("/auth/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const { role, name, email } = req.body as { role?: string; name?: string; email?: string };
    if (!role || !["creator", "seeker"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'creator' or 'seeker'." });
    }
    const existing = await RecruitProfile.findOne({ uid });
    if (existing) {
      return res.json({ uid: existing.uid, role: existing.role, name: existing.name, email: existing.email });
    }
    const profile = await RecruitProfile.create({ uid, role, name: name ?? "", email: email ?? "" });
    trackEvent("recruit_profile_created", uid, { role });
    return res.json({ uid: profile.uid, role: profile.role, name: profile.name, email: profile.email });
  } catch (err) {
    console.error("recruit profile create error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

recruitRouter.get("/auth/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const profile = await RecruitProfile.findOne({ uid });
    if (!profile) return res.status(404).json({ error: "No recruit profile found" });
    return res.json({ uid: profile.uid, role: profile.role, name: profile.name, email: profile.email });
  } catch (err) {
    console.error("recruit profile get error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

function safeJson(text: string): any {
  const normalized = String(text || "").trim();
  const decoded = decodeEscapedAiText(normalized);
  const attempts = [
    () => JSON.parse(normalized),
    () => JSON.parse(decoded),
    () => {
      const m = decoded.match(/```json\s*([\s\S]*?)```/);
      return m ? JSON.parse(m[1]) : null;
    },
    () => {
      const m = decoded.match(/```\s*([\s\S]*?)```/);
      return m ? JSON.parse(m[1]) : null;
    },
    () => {
      const m = decoded.match(/(\{[\s\S]*\})/);
      return m ? JSON.parse(m[1]) : null;
    },
  ];
  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (result !== null) return result;
    } catch { /* try next */ }
  }
  return null;
}

function decodeEscapedAiText(input: string): string {
  let value = String(input || "").trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") {
        value = parsed.trim();
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function cleanGeneratedJobDescription(value: string): string {
  const decoded = decodeEscapedAiText(value);
  const parsed = safeJson(decoded);
  if (parsed && typeof parsed.jd === "string" && parsed.jd.trim()) {
    return cleanGeneratedJobDescription(parsed.jd);
  }
  const jdMatch = decoded.match(/"jd"\s*:\s*"([\s\S]*?)"\s*,\s*"rubric"/);
  const extracted = jdMatch ? decodeEscapedAiText(jdMatch[1]) : decoded;
  return extracted
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*["'{]+/, "")
    .replace(/["'}]+\s*$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function listFromText(value: string): string {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
}

function buildFallbackJobDescription(args: {
  title: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  responsibilities: string;
  mustHaveSkills: string;
  niceToHaveSkills: string;
  salary: string;
}): string {
  const responsibilities = listFromText(args.responsibilities) || "own meaningful work, collaborate with the team, and deliver reliable outcomes";
  const mustHave = listFromText(args.mustHaveSkills) || "relevant experience, strong communication, ownership, and problem-solving";
  const niceToHave = listFromText(args.niceToHaveSkills) || "experience with similar tools, fast-moving teams, or customer-focused environments";
  return `About the role
We are hiring a ${args.seniority || "motivated"} ${args.title} to join the ${args.department || "team"} and contribute to practical, high-impact work. This role is based in ${args.location || "India"} with a ${args.workMode || "flexible"} working model.

What you will do
- ${responsibilities}
- Work closely with stakeholders to understand priorities and turn them into clear execution.
- Maintain quality, communicate progress clearly, and improve the way the team works over time.

What we are looking for
- Strong ability in ${mustHave}.
- A dependable, ownership-driven approach to work.
- Clear written and verbal communication with attention to detail.

Good to have
- ${niceToHave}.

Compensation and benefits
${args.salary}. The final offer will depend on skills, experience, and interview performance.`;
}

function serializeRecruitJob(job: any) {
  if (!job) return job;
  return {
    ...job,
    generatedJD: cleanGeneratedJobDescription(job.generatedJD || ""),
  };
}

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function buildPublicJobQuery(query: any) {
  const filter: any = {
    status: "active",
    publicVisibility: { $ne: false },
    $expr: { $lt: [{ $size: { $ifNull: ["$reports", []] } }, 3] },
  };
  const text = String(query.q ?? "").trim();
  if (text) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    filter.$or = [
      { title: rx },
      { companyName: rx },
      { location: rx },
      { mustHaveSkills: rx },
      { department: rx },
    ];
  }
  for (const key of ["niche", "workMode", "jobType", "seniority", "companyType", "location"]) {
    const value = String(query[key] ?? "").trim();
    if (value && value !== "all") filter[key] = value;
  }
  if (String(query.freshersAllowed ?? "") === "true") filter.freshersAllowed = true;
  if (String(query.verifiedCompany ?? "") === "true") filter.verifiedCompany = true;
  const minSalary = Number(query.minSalary);
  if (!Number.isNaN(minSalary) && minSalary > 0) {
    filter.$and = [...(filter.$and ?? []), { $or: [{ salaryMax: { $gte: minSalary } }, { salaryMax: { $exists: false } }] }];
  }
  const noticePeriod = String(query.noticePeriod ?? "").trim();
  if (noticePeriod && noticePeriod !== "all") filter.noticePeriod = noticePeriod;
  const educationRequirement = String(query.educationRequirement ?? "").trim();
  if (educationRequirement && educationRequirement !== "all") filter.educationRequirement = educationRequirement;
  const seniority = String(query.seniority ?? "").trim();
  if (seniority && seniority !== "all") filter.seniority = seniority;
  const postedAfterDays = Number(query.postedAfterDays);
  if (!Number.isNaN(postedAfterDays) && postedAfterDays > 0) {
    const cutoff = new Date(Date.now() - postedAfterDays * 24 * 60 * 60 * 1000);
    filter.createdAt = { $gte: cutoff };
  }
  return filter;
}

// Synonym table: maps common alternate forms → canonical lowercase term.
// Both sides of every tier-match comparison are normalized through this,
// so "React.js" in a rubric always matches "React" from AI output, etc.
const TERM_SYNONYMS: Record<string, string> = {
  // JavaScript ecosystem
  "js": "javascript", "ts": "typescript",
  "react.js": "react", "reactjs": "react",
  "vue.js": "vue", "vuejs": "vue",
  "angular.js": "angular", "angularjs": "angular",
  "next.js": "next", "nextjs": "next",
  "nuxt.js": "nuxt", "nuxtjs": "nuxt",
  "node.js": "node", "nodejs": "node",
  "express.js": "express", "expressjs": "express",
  // APIs
  "rest api": "api", "restful api": "api", "rest apis": "api",
  "api integration": "api", "api development": "api",
  "graphql api": "graphql",
  // Databases
  "postgresql": "postgres", "mongo db": "mongodb", "mongo": "mongodb",
  "ms sql": "sql", "mssql": "sql", "mysql": "sql",
  // Cloud
  "amazon web services": "aws", "amazon aws": "aws",
  "google cloud platform": "gcp", "google cloud": "gcp",
  "microsoft azure": "azure",
  // AI / ML
  "machine learning": "ml", "artificial intelligence": "ai",
  "natural language processing": "nlp", "deep learning": "dl",
  // Mobile
  "react native": "react-native",
  "ios development": "ios", "android development": "android",
  // General skills
  "communication skills": "communication",
  "leadership skills": "leadership",
  "problem solving": "problem-solving",
  "problem-solving skills": "problem-solving",
  "project management": "pm", "product management": "pm",
  "ci/cd pipeline": "ci/cd", "continuous integration": "ci/cd",
};

function normalizeTerm(name: string): string {
  const lower = name.toLowerCase().trim();
  return TERM_SYNONYMS[lower] ?? lower;
}

async function generateJobDescription(args: {
  title: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  responsibilities: string;
  mustHaveSkills: string;
  niceToHaveSkills: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
}): Promise<{ jd: string; rubric: { name: string; weight: number; description: string }[] }> {
  const salary =
    args.salaryMin && args.salaryMax
      ? `${args.salaryCurrency} ${args.salaryMin.toLocaleString()} – ${args.salaryMax.toLocaleString()} per year`
      : "Competitive (not disclosed)";

  const prompt = `You are a senior recruiter and job-description copywriter for an India-first job marketplace. Generate polished, candidate-friendly hiring content.

INPUT:
- Role Title: ${args.title}
- Department: ${args.department || "Not specified"}
- Seniority: ${args.seniority}
- Location: ${args.location}
- Work Mode: ${args.workMode}
- Key Responsibilities: ${args.responsibilities}
- Must-Have Skills: ${args.mustHaveSkills}
- Nice-to-Have Skills: ${args.niceToHaveSkills}
- Compensation: ${salary}

OUTPUT FORMAT (respond with valid JSON only, no markdown):
{
  "jd": "Plain text job description only. Use clear section headings and real paragraph/bullet spacing. Do not include JSON syntax, escaped slashes, quote marks around the whole description, or rubric text inside this field.",
  "rubric": [
    {
      "name": "criterion name (e.g. Core Technical Skills)",
      "weight": 30,
      "description": "What a 5/5 candidate looks like for this criterion vs a 1/5 candidate"
    }
  ]
}

Rules for the JD:
- Use these exact sections: About the role, What you will do, What we are looking for, Good to have, Compensation and benefits
- Write in simple, professional English that sounds human and credible
- Keep it concise: 220-350 words
- Use short paragraphs and 3-5 bullets under action-heavy sections
- Do not invent unrealistic benefits, claims, company facts, or requirements
- Avoid gendered language, age bias, caste/religion references, and unnecessary degree requirements
- Focus on outcomes, ownership, collaboration, and measurable impact
- Never return the jd as a nested JSON string

Rules for the rubric:
- Create 4-6 criteria that together sum to 100 weight points
- Each criterion should be clearly differentiated and measurable
- Include: core skills, experience depth, communication/culture fit, role-specific competency
- Descriptions should guide a non-expert reviewer`;

  const raw = await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    max_tokens: 2000,
  });

  const parsed = safeJson(raw);
  const fallbackJd = buildFallbackJobDescription({ ...args, salary });
  if (!parsed || !parsed.jd || !Array.isArray(parsed.rubric)) {
    const cleanedRaw = cleanGeneratedJobDescription(raw);
    return {
      jd: cleanedRaw && !cleanedRaw.includes('"rubric"') ? cleanedRaw : fallbackJd,
      rubric: [
        { name: "Core Skills", weight: 40, description: "Proficiency in the must-have technical skills listed for this role." },
        { name: "Relevant Experience", weight: 30, description: "Years and quality of experience directly relevant to this role." },
        { name: "Communication & Culture Fit", weight: 20, description: "Clarity of expression, professionalism, and alignment with team values." },
        { name: "Growth & Initiative", weight: 10, description: "Evidence of self-driven learning, side projects, or career progression." },
      ],
    };
  }
  const cleanedJd = cleanGeneratedJobDescription(parsed.jd) || fallbackJd;
  const rubric = parsed.rubric
    .map((item: any) => ({
      name: String(item?.name || "Role Fit").slice(0, 80),
      weight: Number(item?.weight) || 0,
      description: String(item?.description || "Relevant evidence for this hiring criterion.").slice(0, 300),
    }))
    .filter((item: any) => item.name && item.weight > 0);
  return { jd: cleanedJd, rubric: rubric.length ? rubric : [
    { name: "Core Skills", weight: 40, description: "Proficiency in the must-have technical skills listed for this role." },
    { name: "Relevant Experience", weight: 30, description: "Years and quality of experience directly relevant to this role." },
    { name: "Communication & Culture Fit", weight: 20, description: "Clarity of expression, professionalism, and alignment with team values." },
    { name: "Growth & Initiative", weight: 10, description: "Evidence of self-driven learning, side projects, or career progression." },
  ] };
}

function extractNameFromResume(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines.slice(0, 6)) {
    if (line.length < 60 && /^[A-Z][a-zA-Z]+([\s'-][A-Z][a-zA-Z]+)+$/.test(line)) {
      return line;
    }
  }
  for (const line of lines.slice(0, 6)) {
    if (line.length < 60 && /^[A-Za-z]+([\s'-][A-Za-z]+)+$/.test(line) && !/[@:\/\d]/.test(line)) {
      return line;
    }
  }
  return "Candidate";
}

async function scoreCandidate(args: {
  resumeText: string;
  jobTitle: string;
  rubric: { name: string; weight: number; description: string }[];
}): Promise<{
  name: string;
  email: string;
  totalScore: number;
  maxScore: number;
  scoreBreakdown: { criterion: string; score: number; maxScore: number; reasoning: string }[];
  aiSummary: string;
  redFlags: string[];
  strengths: string[];
  scoringFailed: boolean;
}> {
  const rubricText = args.rubric
    .map((r) => `- ${r.name} (max ${r.weight} pts): ${r.description}`)
    .join("\n");

  const prompt = `You are a seasoned technical recruiter screening a candidate for the role of "${args.jobTitle}". Evaluate the resume below using the rubric provided.

SCORING RUBRIC:
${rubricText}

RESUME:
${args.resumeText.slice(0, 4000)}

---

SCORING PHILOSOPHY — read carefully before scoring:

Think like a human recruiter presenting this candidate to a hiring manager. Your job is to give a fair, calibrated assessment — not to find reasons to reject.

THREE-TIER SCORING WEIGHTS — apply this framework to every criterion:

TIER 1 — Must-Have Skills (accounts for 60% of the total score weight):
These are the core technical skills, domain knowledge, or mandatory qualifications stated in the job description. Score these strictly but fairly:
- Clearly demonstrated → 85–100% of that criterion's points
- Partially demonstrated or strongly implied by related experience → 60–75%
- Minimal or indirect evidence → 40–55%
- Genuinely absent with no reasonable inference → 20–35% (not zero — they got through to screening)

TIER 2 — Experience Depth (accounts for 25% of the total score weight):
This covers years of experience, seniority, scope of work, leadership, or complexity of past projects. Score based on actual evidence:
- Exceeds expectations for the level → 85–100%
- Meets expectations with solid history → 65–80%
- Slightly below expected level or years → 45–60%
- Significantly under-experienced → 25–40%

TIER 3 — Nice-to-Have Skills (accounts for 15% of the total score weight):
These are bonus qualifications, secondary tools, or preferred (not required) skills. Be generous here — do NOT penalize heavily for missing these:
- Present and demonstrated → 80–100%
- Implied or related equivalent present → 60–75%
- Absent entirely → 45–60% (this is a bonus category, not a dealbreaker)

SCORE CALIBRATION — your final score across all criteria should land roughly here:
- Strong candidate: most required skills present, solid experience → 70–85%
- Good mid-level candidate: relevant background, minor gaps → 55–70%
- Junior or partial-fit candidate → 40–55%
- Clearly unqualified → below 40%

Classify each rubric criterion into one of the three tiers above based on its name and description, then score accordingly. When in doubt about a tier, treat it as Tier 1.
Do NOT penalise for skills that are plausibly implied by the candidate's role history or industry background.

RED FLAG RULES — only flag these specific situations:
1. An unexplained employment gap of 2 or more years
2. Zero relevant skills or experience for a role that requires specific technical expertise
3. A clear mismatch between claimed seniority and actual experience (e.g., "10 years experience" with only 2 jobs totaling 3 years)
4. Applying for a role that requires a specific license/certification they demonstrably don't have
DO NOT flag: short tenures at startups, fewer years than ideal, missing one nice-to-have skill, career pivots, non-linear paths, or anything that requires assumption

SUMMARY RULES:
- Open with their current/most recent title and company (or field of work)
- Name 2–3 specific, concrete skills or achievements from the resume
- End with one sentence on how they fit (or don't fit) this specific role
- Write it as you'd say it to a hiring manager — direct, specific, no filler phrases like "strong candidate" or "well-rounded"

CONFIDENCE DEFINITIONS — set one per criterion:
- "high": Strong, explicit evidence in resume (named skill, titled role, direct achievement)
- "medium": Partial or inferred evidence (related role, implied skill, adjacent experience)
- "low": Weak or unclear signal (thin mention, assumed from context, no direct evidence)

Respond with ONLY this JSON (no markdown, no extra text):
{"name":"full name","email":"email or empty string","aiSummary":"specific 2-3 sentence summary","strengths":["concrete strength 1","concrete strength 2","concrete strength 3"],"redFlags":["only genuine red flags — omit this array or leave empty if none"],"scoreBreakdown":[{"criterion":"exact name from rubric","score":28,"maxScore":35,"reasoning":"one sentence citing specific resume evidence","confidence":"medium","tier":1}]}

For "tier": classify each criterion as 1 (must-have skill), 2 (experience depth), or 3 (nice-to-have), matching the THREE-TIER SCORING WEIGHTS defined above.`;

  const raw = await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 2000,
  });

  const parsed = safeJson(raw);
  if (!parsed) {
    const rubricMaxScore = args.rubric.reduce((sum, r) => sum + r.weight, 0) || 100;
    const extractedName = extractNameFromResume(args.resumeText);
    console.error("[recruit] scoreCandidate: AI returned unparseable response. Raw output (first 500 chars):", raw?.slice(0, 500));
    return {
      name: extractedName,
      email: "",
      totalScore: 0,
      maxScore: rubricMaxScore,
      scoreBreakdown: [],
      aiSummary: "",
      redFlags: [],
      strengths: [],
      scoringFailed: true,
    };
  }

  const validConfidence = (v: any): "high" | "medium" | "low" =>
    v === "high" || v === "low" ? v : "medium";

  // Build deterministic tier map from rubric weights (60 / 25 / 15 split).
  // Criteria are sorted by weight descending; we accumulate until each
  // threshold is reached. This enforces the highest-weight criteria are
  // always Tier 1, regardless of what the AI classified them as.
  const totalRubricWeight = args.rubric.reduce((sum, r) => sum + r.weight, 0);
  const sortedRubric = [...args.rubric].sort((a, b) => b.weight - a.weight);
  // Store both raw and synonym-normalized keys so either form matches.
  const rubricTierMap = new Map<string, 1 | 2 | 3>();
  let accumulated = 0;
  for (const r of sortedRubric) {
    accumulated += r.weight;
    const pct = totalRubricWeight > 0 ? accumulated / totalRubricWeight : 1;
    const tier: 1 | 2 | 3 = pct <= 0.60 ? 1 : pct <= 0.85 ? 2 : 3;
    const raw = r.name.toLowerCase().trim();
    rubricTierMap.set(raw, tier);
    rubricTierMap.set(normalizeTerm(raw), tier); // also store canonical form
  }

  const resolveTier = (criterionName: string, aiTier: any): 1 | 2 | 3 => {
    const raw = (criterionName ?? "").toLowerCase().trim();
    const normalized = normalizeTerm(raw);

    // 1. Exact match on raw name
    if (rubricTierMap.has(raw)) return rubricTierMap.get(raw)!;
    // 2. Exact match on normalized name (catches React → react.js, JS → javascript, etc.)
    if (rubricTierMap.has(normalized)) return rubricTierMap.get(normalized)!;
    // 3. Partial match — normalized criterion substring of a normalized rubric key or vice versa
    for (const [rubricKey, tier] of rubricTierMap) {
      const normRubric = normalizeTerm(rubricKey);
      if (normalized.includes(normRubric) || normRubric.includes(normalized)) return tier;
    }
    // 4. AI fallback — validated integer only
    const n = Number(aiTier);
    return n === 1 || n === 2 || n === 3 ? n : 1;
  };

  const breakdown = (parsed.scoreBreakdown ?? []).map((b: any) => ({
    criterion: b.criterion ?? "",
    score: Number(b.score) || 0,
    maxScore: Number(b.maxScore) || 10,
    reasoning: (b.reasoning ?? "").trim(),
    confidence: validConfidence(b.confidence),
    tier: resolveTier(b.criterion, b.tier),
  })).filter((b: any) => b.criterion.length > 0);

  const totalScore = breakdown.reduce((sum: number, b: any) => sum + b.score, 0);
  const maxScore = breakdown.reduce((sum: number, b: any) => sum + b.maxScore, 0) || 100;

  const redFlags = Array.isArray(parsed.redFlags)
    ? parsed.redFlags.filter((f: unknown) => typeof f === "string" && f.trim().length > 0)
    : [];

  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
    : [];

  return {
    name: (parsed.name?.trim() || extractNameFromResume(args.resumeText)),
    email: parsed.email ?? "",
    totalScore,
    maxScore,
    scoreBreakdown: breakdown,
    aiSummary: (parsed.aiSummary ?? "").trim(),
    redFlags,
    strengths,
    scoringFailed: false,
  };
}

async function generateInterviewBrief(args: {
  candidateName: string;
  jobTitle: string;
  resumeText: string;
  aiSummary: string;
  redFlags: string[];
  scoreBreakdown: { criterion: string; score: number; maxScore: number; reasoning: string }[];
}): Promise<string> {
  const lowScores = args.scoreBreakdown
    .filter((b) => b.score / b.maxScore < 0.6)
    .map((b) => `${b.criterion}: ${b.reasoning}`)
    .join("; ");

  const prompt = `You are a senior talent acquisition specialist. Write a concise interview preparation brief for the interviewer.

Candidate: ${args.candidateName}
Role: ${args.jobTitle}
AI Summary: ${args.aiSummary}
Red Flags: ${args.redFlags.join(", ") || "None identified"}
Weak Areas: ${lowScores || "None"}

Write a practical interview brief (250-350 words) covering:
1. Quick candidate summary (2 sentences)
2. 3-4 specific probing questions tailored to their weak areas or red flags
3. 2-3 skills or claims to verify with concrete examples
4. Overall hiring recommendation (Strong Yes / Yes / Maybe / No) with one-sentence reasoning

Write in plain text, no JSON, no markdown headers.`;

  const brief = await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
    max_tokens: 600,
  });

  return brief;
}

async function generateAssessmentQuestions(args: {
  jobTitle: string;
  rubric: { name: string; weight: number; description: string }[];
  jd: string;
}): Promise<{ id: string; text: string }[]> {
  const rubricText = args.rubric
    .map((r, i) => `${i + 1}. ${r.name} (${r.weight} pts): ${r.description}`)
    .join("\n");

  const prompt = `You are a senior hiring manager at a fast-growing company. Generate exactly 5 written assessment questions for a candidate applying to be a ${args.jobTitle}.

SCORING RUBRIC (your questions must each probe a different criterion):
${rubricText}

JOB DESCRIPTION EXCERPT:
${args.jd.slice(0, 1200)}

STRICT REQUIREMENTS:
- Every question MUST be specific to the ${args.jobTitle} role — no generic questions
- Questions must require 2-4 paragraph written answers based on real experience
- Each question tests a DIFFERENT rubric criterion (match question 1 to criterion 1, etc.)
- Questions should reveal: depth of expertise, problem-solving, communication quality, judgment
- Do NOT ask trivial, yes/no, or easily-Googled questions
- Start each question with "Tell us about a time...", "Describe how you...", "Walk us through...", or "How would you approach..."

Respond with ONLY this exact JSON structure, no markdown, no extra text:
{"questions":[{"id":"q1","text":"..."},{"id":"q2","text":"..."},{"id":"q3","text":"..."},{"id":"q4","text":"..."},{"id":"q5","text":"..."}]}`;

  const raw = await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
    max_tokens: 1200,
  });

  const parsed = safeJson(raw);
  if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
    return parsed.questions.slice(0, 5).map((q: any, i: number) => ({
      id: q.id ?? `q${i + 1}`,
      text: (q.text ?? "").trim(),
    })).filter((q: { id: string; text: string }) => q.text.length > 10);
  }

  return [
    { id: "q1", text: `Describe a challenging technical problem you solved in a previous ${args.jobTitle} role. What was the situation, what actions did you take, and what was the measurable outcome?` },
    { id: "q2", text: `Walk us through a project where you had to work across teams or stakeholders with competing priorities. How did you navigate it and what did you learn?` },
    { id: "q3", text: `Tell us about a time you had to rapidly learn a new skill or technology under a tight deadline. How did you approach it and what was the result?` },
    { id: "q4", text: `Describe a situation where your initial approach to a problem was wrong. How did you identify it, course-correct, and what did you do differently afterward?` },
    { id: "q5", text: `As a ${args.jobTitle}, how would you approach your first 90 days — what would you prioritize, how would you measure early success, and what concerns would you flag to your manager?` },
  ];
}

async function analyzeAssessmentAnswers(args: {
  candidateName: string;
  jobTitle: string;
  rubric: { name: string; weight: number; description: string }[];
  questions: { id: string; text: string }[];
  answers: { questionId: string; answer: string; timeTakenSeconds: number }[];
  resumeScore: number;
  maxScore: number;
  resumeSummary: string;
}): Promise<{
  newTotalScore: number;
  hiringDecision: "strong_yes" | "maybe" | "no";
  impact: { strengths: string[]; weaknesses: string[]; reasoning: string };
}> {
  const rubricText = args.rubric
    .map((r) => `- ${r.name} (${r.weight} pts): ${r.description}`)
    .join("\n");

  const resumePct = args.maxScore > 0 ? Math.round((args.resumeScore / args.maxScore) * 100) : 0;

  const qaText = args.questions.map((q, i) => {
    const ans = args.answers.find((a) => a.questionId === q.id);
    const timeTaken = ans?.timeTakenSeconds ?? 0;
    const answerText = ans?.answer?.trim() ?? "";
    const wordCount = answerText.split(/\s+/).filter(Boolean).length;
    const warnings: string[] = [];
    if (timeTaken > 0 && timeTaken < 25) warnings.push("⚠ Answered in under 25 seconds — possible copy-paste or very brief effort");
    if (wordCount < 20 && answerText.length > 0) warnings.push("⚠ Very short answer (fewer than 20 words)");
    if (answerText.length === 0) warnings.push("⚠ No answer provided");
    const warningLine = warnings.length > 0 ? `\n[${warnings.join("; ")}]` : "";
    return `Q${i + 1}: ${q.text}\nAnswer: ${answerText || "(blank)"}${warningLine}`;
  }).join("\n\n---\n\n");

  const prompt = `You are a senior talent acquisition specialist. Evaluate the written assessment responses below for the ${args.jobTitle} role.

CANDIDATE: ${args.candidateName}
RESUME SCORE: ${resumePct}% (${args.resumeScore}/${args.maxScore} points)
RESUME SUMMARY: ${args.resumeSummary}

SCORING RUBRIC:
${rubricText}

ASSESSMENT RESPONSES:
${qaText}

Your task: Combine the resume quality (${resumePct}%) with the assessment quality to produce a final combined score.

SCORING GUIDANCE:
- If assessment answers are EXCELLENT (specific, detailed, clearly experienced): raise score up to +15 points from resume
- If answers MATCH the resume quality (solid, relevant): keep score within ±5 points of resume
- If answers are WEAK (vague, generic, very short, copy-paste signals): lower score by 10-20 points
- If answers are COMPLETELY EMPTY or nonsensical: lower score by 20-30 points

Respond with ONLY this JSON (no markdown, no extra text):
{"combinedScorePercent":72,"hiringDecision":"maybe","impact":{"strengths":["strength from assessment","another strength"],"weaknesses":["weakness if any"],"reasoning":"2-3 sentences explaining what the assessment revealed and why the score changed"}}

Rules:
- combinedScorePercent: integer 0-100 (the final combined score as a percentage, informed by BOTH resume and assessment)
- hiringDecision: "strong_yes" if ≥78%, "maybe" if 55-77%, "no" if <55%
- strengths: 2-4 specific, concrete observations from the actual answers (quote or reference what they said)
- weaknesses: 0-3 genuine concerns (if none, use empty array)
- reasoning: specific explanation of what the assessment revealed that the resume did not show`;

  const raw = await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.25,
    max_tokens: 700,
  });

  const parsed = safeJson(raw);

  const combinedPct = typeof parsed?.combinedScorePercent === "number"
    ? Math.max(0, Math.min(100, parsed.combinedScorePercent))
    : resumePct;

  const newTotalScore = Math.round((combinedPct / 100) * args.maxScore);

  const hiringDecision: "strong_yes" | "maybe" | "no" =
    parsed?.hiringDecision === "strong_yes" || parsed?.hiringDecision === "maybe" || parsed?.hiringDecision === "no"
      ? parsed.hiringDecision
      : combinedPct >= 78 ? "strong_yes" : combinedPct >= 55 ? "maybe" : "no";

  const strengths = Array.isArray(parsed?.impact?.strengths)
    ? parsed.impact.strengths.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
    : [];
  const weaknesses = Array.isArray(parsed?.impact?.weaknesses)
    ? parsed.impact.weaknesses.filter((w: unknown) => typeof w === "string" && w.trim().length > 0)
    : [];
  const reasoning = typeof parsed?.impact?.reasoning === "string" && parsed.impact.reasoning.trim().length > 0
    ? parsed.impact.reasoning
    : `Assessment completed. Final combined score: ${combinedPct}%.`;

  return {
    newTotalScore,
    hiringDecision,
    impact: { strengths, weaknesses, reasoning },
  };
}

async function generateRejectionEmail(args: {
  candidateName: string;
  jobTitle: string;
  stage: string;
}): Promise<string> {
  const stageContext: Record<string, string> = {
    applied: "after reviewing their application",
    screened: "after an initial review of their profile",
    assessed: "after reviewing their written assessment",
    interview: "after the interview stage",
    offer: "after careful consideration of the offer stage",
  };
  const context = stageContext[args.stage] ?? "after careful consideration";

  const prompt = `Write a rejection email for a job candidate. The email should feel human, warm, and genuinely respectful — not a corporate template.

Candidate first name: ${args.candidateName.split(" ")[0]}
Role: ${args.jobTitle}
Stage: ${context}

Write the email body only (no subject line). Follow this structure:
1. Open with their first name and a warm, specific acknowledgment of their interest in the ${args.jobTitle} role
2. Deliver the news clearly but kindly in one sentence — do not be vague or overly corporate
3. Offer one genuine, positive observation (e.g., "We were impressed by your background in X" or "It was clear you put genuine thought into your application")
4. Close with encouragement — keep the door open for future roles, wish them well
5. End with a warm sign-off

TONE RULES:
- Sound like a real person wrote this, not an HR bot
- Avoid clichés: "we regret to inform", "we had many strong candidates", "we'll keep your resume on file"
- Use contractions naturally (we're, we've, you've)
- Keep it under 200 words
- Do not use bullet points or formal headers`;

  const email = await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.75,
    max_tokens: 350,
  });

  return email;
}

recruitRouter.post("/jobs", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const {
      title, niche, companyName, companyType, jobType, department, seniority, location, workMode,
      responsibilities, mustHaveSkills, niceToHaveSkills,
      salaryMin, salaryMax, salaryCurrency, experienceMin, experienceMax,
      educationRequirement, noticePeriod, freshersAllowed, verifiedCompany, publicVisibility,
    } = req.body;

    if (!title?.trim() || title.trim().length < 3) return res.status(400).json({ error: "Job title must be at least 3 characters." });
    if (!companyName?.trim()) return res.status(400).json({ error: "Company name is required." });
    if (!location?.trim()) return res.status(400).json({ error: "Location is required." });
    if (!responsibilities?.trim() && !mustHaveSkills?.trim()) {
      return res.status(400).json({ error: "Please provide either key responsibilities or must-have skills." });
    }

    const SPAM_WORDS = ["work from home earn money", "earn daily", "earn per day", "no investment", "part time earn", "₹ daily", "earn ₹", "guaranteed income", "100% work from home easy money"];
    const titleLower = (title || "").toLowerCase();
    const respLower = (responsibilities || "").toLowerCase();
    if (SPAM_WORDS.some(w => titleLower.includes(w) || respLower.includes(w))) {
      return res.status(400).json({ error: "This job listing appears to contain spam or misleading content. Please review and revise." });
    }

    const companyProfileForVerif = await RecruitCompanyProfile.findOne({ uid }).lean();
    const isVerifiedCompany = (companyProfileForVerif as any)?.verificationStatus === "verified";

    const { jd, rubric } = await generateJobDescription({
      title, department: department || "", seniority: seniority || "Mid-level",
      location: location || "Remote", workMode: workMode || "remote",
      responsibilities: responsibilities || "", mustHaveSkills: mustHaveSkills || "",
      niceToHaveSkills: niceToHaveSkills || "",
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      salaryMax: salaryMax ? Number(salaryMax) : undefined,
      salaryCurrency: salaryCurrency || "INR",
    });

    const job = await RecruitJob.create({
      uid, title,
      niche: niche || "AI, Data, Software & Product Tech",
      companyName: companyName || "",
      companyType: companyType || "",
      jobType: jobType || "Full-time",
      department: department || "", seniority: seniority || "Mid-level",
      location: location || "Remote", workMode: workMode || "remote",
      responsibilities: responsibilities || "", mustHaveSkills: mustHaveSkills || "",
      niceToHaveSkills: niceToHaveSkills || "",
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      salaryMax: salaryMax ? Number(salaryMax) : undefined,
      salaryCurrency: salaryCurrency || "INR",
      experienceMin: experienceMin !== undefined && experienceMin !== "" ? Number(experienceMin) : undefined,
      experienceMax: experienceMax !== undefined && experienceMax !== "" ? Number(experienceMax) : undefined,
      educationRequirement: educationRequirement || "",
      noticePeriod: noticePeriod || "",
      freshersAllowed: Boolean(freshersAllowed),
      verifiedCompany: isVerifiedCompany,
      publicVisibility: publicVisibility !== false,
      generatedJD: jd, rubric, status: "active", candidateCount: 0,
    });

    trackEvent("recruiter_job_posted", uid, { jobId: String(job._id), niche, title });
    return res.json({ job });
  } catch (err: any) {
    console.error("[recruit] POST /jobs", err);
    return res.status(500).json({ error: err.message || "Failed to create job." });
  }
});

recruitRouter.get("/jobs", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const jobs = await RecruitJob.find({ uid }).sort({ createdAt: -1 }).lean();
    return res.json({ jobs: jobs.map(serializeRecruitJob) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.get("/jobs/:jobId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ job: serializeRecruitJob(job) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.patch("/jobs/:jobId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const allowed = [
      "status", "title", "niche", "companyName", "companyType", "jobType",
      "department", "location", "workMode", "salaryMin", "salaryMax",
      "experienceMin", "experienceMax", "educationRequirement", "noticePeriod",
      "freshersAllowed", "publicVisibility",
    ];
    const update: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const companyProfileForPatch = await RecruitCompanyProfile.findOne({ uid }).lean();
    update.verifiedCompany = (companyProfileForPatch as any)?.verificationStatus === "verified";
    const job = await RecruitJob.findOneAndUpdate({ _id: req.params.jobId, uid }, update, { new: true }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ job: serializeRecruitJob(job) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/jobs", async (req, res) => {
  try {
    await connectMongo();
    const filter = buildPublicJobQuery(req.query);
    const jobs = await RecruitJob.find(filter)
      .select("title niche companyName companyType jobType department seniority location workMode salaryMin salaryMax salaryCurrency experienceMin experienceMax educationRequirement noticePeriod freshersAllowed verifiedCompany candidateCount createdAt mustHaveSkills generatedJD")
      .sort({ verifiedCompany: -1, createdAt: -1 })
      .limit(80)
      .lean();
    return res.json({ jobs: jobs.map(serializeRecruitJob) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load jobs." });
  }
});

recruitPublicRouter.get("/jobs/:jobId", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ job: serializeRecruitJob(job) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load job." });
  }
});

recruitPublicRouter.post("/jobs/:jobId/apply", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    });
    if (!job) return res.status(404).json({ error: "Job not found." });

    const { name, email, phone, resumeText, source, location, currentStatus, educationLevel, currentClassYear, availability, coverLetter, linkedinUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required." });
    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });
    if (!resumeText?.trim() || resumeText.trim().length < 40) {
      return res.status(400).json({ error: "Resume or profile summary must be at least 40 characters." });
    }

    const scored = await scoreCandidate({
      resumeText,
      jobTitle: job.title,
      rubric: job.rubric,
    });

    const candidate = await RecruitCandidate.create({
      jobId: job._id,
      uid: job.uid,
      name: scored.name === "Candidate" ? name : scored.name,
      email,
      phone: phone || "",
      resumeText,
      totalScore: scored.totalScore,
      maxScore: scored.maxScore,
      scoreBreakdown: scored.scoreBreakdown,
      aiSummary: scored.aiSummary,
      redFlags: scored.redFlags,
      strengths: scored.strengths,
      stage: "applied",
      assessmentStatus: "not_sent",
      previousResumeScore: scored.totalScore,
      scoringFailed: scored.scoringFailed,
      source: source || "Plyndrox Jobs",
      location: location || "",
      currentStatus: currentStatus || "",
      educationLevel: educationLevel || "",
      currentClassYear: currentClassYear || "",
      availability: availability || "",
      coverLetter: coverLetter || "",
      linkedinUrl: linkedinUrl || "",
    });

    await RecruitJob.updateOne({ _id: job._id }, { $inc: { candidateCount: 1 } });
    return res.json({ ok: true, candidateId: candidate._id });
  } catch (err: any) {
    console.error("[recruit-public] POST /jobs/:jobId/apply", err);
    return res.status(500).json({ error: err.message || "Failed to submit application." });
  }
});

recruitRouter.delete("/jobs/:jobId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    await RecruitJob.deleteOne({ _id: req.params.jobId, uid });
    await RecruitCandidate.deleteMany({ jobId: req.params.jobId, uid });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid });
    if (!job) return res.status(404).json({ error: "Job not found." });

    const { resumeText } = req.body;
    if (!resumeText?.trim()) return res.status(400).json({ error: "Resume text is required." });

    const scored = await scoreCandidate({
      resumeText,
      jobTitle: job.title,
      rubric: job.rubric,
    });

    const { source } = req.body;

    // AI Memory: check if this email has applied before under same recruiter
    let previousApplication: {
      jobTitle: string;
      stage: string;
      totalScore: number;
      maxScore: number;
      rejectedAt: Date;
      aiSummary: string;
    } | null = null;

    if (scored.email) {
      const prev = await RecruitCandidate.findOne({
        uid,
        email: scored.email,
        stage: { $in: ["rejected", "hired"] },
      })
        .populate<{ jobId: { title: string } }>("jobId", "title")
        .sort({ updatedAt: -1 })
        .lean() as any;

      if (prev) {
        previousApplication = {
          jobTitle: (prev.jobId as any)?.title ?? "a previous role",
          stage: prev.stage,
          totalScore: prev.totalScore,
          maxScore: prev.maxScore,
          rejectedAt: prev.updatedAt,
          aiSummary: prev.aiSummary,
        };
      }
    }

    const candidate = await RecruitCandidate.create({
      jobId: job._id,
      uid,
      name: scored.name,
      email: scored.email,
      resumeText,
      totalScore: scored.totalScore,
      maxScore: scored.maxScore,
      scoreBreakdown: scored.scoreBreakdown,
      aiSummary: scored.aiSummary,
      redFlags: scored.redFlags,
      strengths: scored.strengths,
      stage: "applied",
      assessmentStatus: "not_sent",
      previousResumeScore: scored.totalScore,
      scoringFailed: scored.scoringFailed,
      source: source || "",
    });

    await RecruitJob.updateOne({ _id: job._id }, { $inc: { candidateCount: 1 } });

    trackEvent("recruiter_candidate_added", uid, { jobId: req.params.jobId, source: source || "" });
    return res.json({ candidate, previousApplication });
  } catch (err: any) {
    console.error("[recruit] POST /candidates", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.get("/jobs/:jobId/candidates", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const candidates = await RecruitCandidate.find({ jobId: req.params.jobId, uid })
      .sort({ totalScore: -1 })
      .lean();
    return res.json({ candidates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.patch("/jobs/:jobId/candidates/:candidateId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const allowed = ["stage", "notes", "source", "gender", "ageRange", "inTalentPool", "talentPoolNote"];
    const update: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.stage) {
      update.stageMovedAt = new Date();
    }
    const candidate = await RecruitCandidate.findOneAndUpdate(
      { _id: req.params.candidateId, jobId: req.params.jobId, uid },
      update,
      { new: true }
    ).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (update.stage) {
      trackEvent("recruiter_stage_changed", uid, { jobId: req.params.jobId, stage: update.stage });
    }
    return res.json({ candidate });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/retry-score", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const scored = await scoreCandidate({
      resumeText: candidate.resumeText,
      jobTitle: job.title,
      rubric: job.rubric,
    });

    candidate.name = scored.name;
    candidate.email = scored.email || candidate.email;
    candidate.totalScore = scored.totalScore;
    candidate.maxScore = scored.maxScore;
    candidate.scoreBreakdown = scored.scoreBreakdown as any;
    candidate.aiSummary = scored.aiSummary;
    candidate.redFlags = scored.redFlags;
    candidate.strengths = scored.strengths;
    candidate.scoringFailed = scored.scoringFailed;
    if (!candidate.scoringFailed) {
      candidate.previousResumeScore = scored.totalScore;
    }
    await candidate.save();

    return res.json({ candidate });
  } catch (err: any) {
    console.error("[recruit] POST /retry-score", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/brief", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    if (candidate.interviewBrief) {
      return res.json({ brief: candidate.interviewBrief });
    }

    const brief = await generateInterviewBrief({
      candidateName: candidate.name,
      jobTitle: job.title,
      resumeText: candidate.resumeText,
      aiSummary: candidate.aiSummary,
      redFlags: candidate.redFlags,
      scoreBreakdown: candidate.scoreBreakdown,
    });

    candidate.interviewBrief = brief;
    await candidate.save();

    return res.json({ brief });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.delete("/jobs/:jobId/candidates/:candidateId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const candidate = await RecruitCandidate.findOneAndDelete({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    await RecruitJob.updateOne({ _id: req.params.jobId, uid }, { $inc: { candidateCount: -1 } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/assessment/send", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    if (candidate.assessmentStatus === "completed") {
      return res.status(400).json({ error: "Assessment already completed by candidate." });
    }

    const questions = await generateAssessmentQuestions({
      jobTitle: job.title,
      rubric: job.rubric,
      jd: job.generatedJD,
    });

    const token = generateToken();
    candidate.assessmentToken = token;
    candidate.assessmentQuestions = questions;
    candidate.assessmentStatus = "sent";
    candidate.assessmentSentAt = new Date();
    candidate.previousResumeScore = candidate.totalScore;
    await candidate.save();

    const assessmentUrl = `${FRONTEND_URL}/recruit/assessment/${token}`;

    return res.json({
      ok: true,
      assessmentUrl,
      questions,
      candidateName: candidate.name,
      candidateEmail: candidate.email,
    });
  } catch (err: any) {
    console.error("[recruit] POST /assessment/send", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/reject-email", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid }).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const email = await generateRejectionEmail({
      candidateName: candidate.name,
      jobTitle: job.title,
      stage: candidate.stage,
    });

    return res.json({ email, candidateName: candidate.name, candidateEmail: candidate.email });
  } catch (err: any) {
    console.error("[recruit] POST /reject-email", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/reminder", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    if (candidate.assessmentStatus !== "sent") {
      return res.status(400).json({ error: "Assessment not in pending state." });
    }

    candidate.assessmentReminderSentAt = new Date();
    await candidate.save();

    const assessmentUrl = `${FRONTEND_URL}/recruit/assessment/${candidate.assessmentToken}`;
    return res.json({ ok: true, assessmentUrl, candidateEmail: candidate.email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/assessment/:token", async (req, res) => {
  try {
    await connectMongo();
    const candidate = await RecruitCandidate.findOne({ assessmentToken: req.params.token })
      .select("name assessmentQuestions assessmentStatus assessmentCompletedAt jobId")
      .lean();

    if (!candidate) return res.status(404).json({ error: "Assessment not found." });
    if (candidate.assessmentStatus === "completed") {
      return res.json({ completed: true, candidateName: candidate.name });
    }

    const job = await RecruitJob.findById(candidate.jobId)
      .select("title department location workMode")
      .lean();

    return res.json({
      completed: false,
      candidateName: candidate.name,
      jobTitle: job?.title ?? "the role",
      jobDepartment: job?.department ?? "",
      jobLocation: job?.location ?? "",
      questions: candidate.assessmentQuestions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.post("/assessment/:token/submit", async (req, res) => {
  try {
    await connectMongo();
    const candidate = await RecruitCandidate.findOne({ assessmentToken: req.params.token });
    if (!candidate) return res.status(404).json({ error: "Assessment not found." });
    if (candidate.assessmentStatus === "completed") {
      return res.status(400).json({ error: "Assessment already submitted." });
    }

    const { answers } = req.body as {
      answers: { questionId: string; answer: string; timeTakenSeconds: number }[];
    };

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: "Answers are required." });
    }

    const job = await RecruitJob.findById(candidate.jobId).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const result = await analyzeAssessmentAnswers({
      candidateName: candidate.name,
      jobTitle: job.title,
      rubric: job.rubric,
      questions: candidate.assessmentQuestions,
      answers,
      resumeScore: candidate.previousResumeScore || candidate.totalScore,
      maxScore: candidate.maxScore,
      resumeSummary: candidate.aiSummary,
    });

    candidate.assessmentAnswers = answers;
    candidate.assessmentStatus = "completed";
    candidate.assessmentCompletedAt = new Date();
    candidate.totalScore = result.newTotalScore;
    candidate.hiringDecision = result.hiringDecision;
    candidate.assessmentImpact = result.impact;
    candidate.stage = "assessed";
    await candidate.save();

    return res.json({ ok: true, message: "Assessment submitted successfully." });
  } catch (err: any) {
    console.error("[recruit] POST /assessment/submit", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Analytics ──────────────────────────────────────────────────────────────

recruitRouter.get("/analytics", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);

    const [jobs, allCandidates] = await Promise.all([
      RecruitJob.find({ uid }).lean(),
      RecruitCandidate.find({ uid }).lean(),
    ]);

    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => j.status === "active").length;
    const totalCandidates = allCandidates.length;

    // Stage funnel (all candidates across all jobs)
    const STAGES = ["applied", "screened", "assessed", "interview", "offer", "hired", "rejected"] as const;
    const stageCounts: Record<string, number> = {};
    for (const s of STAGES) stageCounts[s] = 0;
    for (const c of allCandidates) {
      if (stageCounts[c.stage] !== undefined) stageCounts[c.stage]++;
    }

    // Drop-off rates: % who made it through each stage (excluding rejected)
    const activeStages = STAGES.filter(s => s !== "rejected");
    const funnelDropoff = activeStages.map((stage, i) => {
      const count = stageCounts[stage] || 0;
      const dropoffPct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;
      return { stage, count, dropoffPct };
    });

    // Average time-to-hire (job createdAt → first hired candidate updatedAt)
    const avgTimeToHireMs: number[] = [];
    for (const job of jobs) {
      const hired = allCandidates.filter(
        c => c.jobId.toString() === job._id.toString() && c.stage === "hired"
      );
      if (hired.length > 0) {
        const earliest = Math.min(...hired.map(c => new Date(c.updatedAt).getTime()));
        avgTimeToHireMs.push(earliest - new Date(job.createdAt).getTime());
      }
    }
    const avgTimeToHireDays = avgTimeToHireMs.length > 0
      ? Math.round(avgTimeToHireMs.reduce((a, b) => a + b, 0) / avgTimeToHireMs.length / 86400000)
      : null;

    // Source breakdown
    const sourceCounts: Record<string, number> = {};
    for (const c of allCandidates) {
      const src = c.source?.trim() || "Not specified";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
    const sourceBreakdown = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count, pct: Math.round((count / totalCandidates) * 100) }))
      .sort((a, b) => b.count - a.count);

    // Bias detection: gender & age distribution (from voluntarily provided data only)
    const genderCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = {};
    for (const c of allCandidates) {
      if (c.gender?.trim()) {
        const g = c.gender.trim().toLowerCase();
        genderCounts[g] = (genderCounts[g] || 0) + 1;
      }
      if (c.ageRange?.trim()) {
        const a = c.ageRange.trim();
        ageCounts[a] = (ageCounts[a] || 0) + 1;
      }
    }
    const totalWithGender = Object.values(genderCounts).reduce((a, b) => a + b, 0);
    const totalWithAge = Object.values(ageCounts).reduce((a, b) => a + b, 0);
    const genderBreakdown = Object.entries(genderCounts).map(([gender, count]) => ({
      gender, count, pct: totalWithGender > 0 ? Math.round((count / totalWithGender) * 100) : 0,
    }));
    const ageBreakdown = Object.entries(ageCounts).map(([ageRange, count]) => ({
      ageRange, count, pct: totalWithAge > 0 ? Math.round((count / totalWithAge) * 100) : 0,
    }));

    // Bias across stages: gender distribution per pipeline stage (for hired vs rejected comparison)
    const biasStageData: Record<string, Record<string, number>> = {};
    for (const c of allCandidates) {
      if (!c.gender?.trim()) continue;
      const g = c.gender.trim().toLowerCase();
      if (!biasStageData[c.stage]) biasStageData[c.stage] = {};
      biasStageData[c.stage][g] = (biasStageData[c.stage][g] || 0) + 1;
    }

    // Per-job stats
    const jobStats = jobs.map(job => {
      const jCandidates = allCandidates.filter(c => c.jobId.toString() === job._id.toString());
      const avgScore = jCandidates.length > 0
        ? Math.round(jCandidates.reduce((s, c) => s + (c.maxScore > 0 ? (c.totalScore / c.maxScore) * 100 : 0), 0) / jCandidates.length)
        : 0;
      const hired = jCandidates.filter(c => c.stage === "hired").length;
      const rejected = jCandidates.filter(c => c.stage === "rejected").length;
      return {
        jobId: job._id,
        title: job.title,
        department: job.department,
        status: job.status,
        totalCandidates: jCandidates.length,
        avgScorePct: avgScore,
        hired,
        rejected,
        createdAt: job.createdAt,
      };
    });

    return res.json({
      totalJobs,
      activeJobs,
      totalCandidates,
      stageCounts,
      funnelDropoff,
      avgTimeToHireDays,
      sourceBreakdown,
      genderBreakdown,
      ageBreakdown,
      biasStageData,
      jobStats,
    });
  } catch (err: any) {
    console.error("[recruit] GET /analytics", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Talent Pool ─────────────────────────────────────────────────────────────

recruitRouter.get("/talent-pool", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);

    // Silver-medal candidates: rejected or not hired, but scored >= 55% OR manually added to pool
    const candidates = await RecruitCandidate.find({
      uid,
      $or: [
        { inTalentPool: true },
        {
          stage: "rejected",
          $expr: { $gte: [{ $divide: ["$totalScore", { $max: ["$maxScore", 1] }] }, 0.55] },
        },
      ],
    })
      .populate<{ jobId: { title: string; department: string; status: string } }>("jobId", "title department status")
      .sort({ totalScore: -1 })
      .lean();

    return res.json({ candidates });
  } catch (err: any) {
    console.error("[recruit] GET /talent-pool", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.patch("/talent-pool/:candidateId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const { inTalentPool, talentPoolNote } = req.body;
    const update: any = {};
    if (inTalentPool !== undefined) update.inTalentPool = inTalentPool;
    if (talentPoolNote !== undefined) update.talentPoolNote = talentPoolNote;
    const candidate = await RecruitCandidate.findOneAndUpdate(
      { _id: req.params.candidateId, uid },
      update,
      { new: true }
    ).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    return res.json({ candidate });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Offer Letter ─────────────────────────────────────────────────────────────

async function generateOfferLetter(args: {
  candidateName: string;
  jobTitle: string;
  department: string;
  location: string;
  workMode: string;
  seniority: string;
  startDate: string;
  salary: string;
  salaryCurrency: string;
  signingBonus?: string;
  benefits?: string;
  companyName?: string;
  hiringManagerName?: string;
}): Promise<string> {
  const prompt = `You are an expert HR professional. Write a professional, warm, and legally clear job offer letter.

DETAILS:
- Candidate Name: ${args.candidateName}
- Role: ${args.jobTitle}
- Department: ${args.department || "Not specified"}
- Location: ${args.location}
- Work Mode: ${args.workMode}
- Seniority: ${args.seniority}
- Start Date: ${args.startDate}
- Salary: ${args.salaryCurrency} ${args.salary} per year
${args.signingBonus ? `- Signing Bonus: ${args.signingBonus}` : ""}
${args.benefits ? `- Benefits / Perks: ${args.benefits}` : ""}
${args.companyName ? `- Company: ${args.companyName}` : ""}
${args.hiringManagerName ? `- Hiring Manager: ${args.hiringManagerName}` : ""}

Write a complete, ready-to-send offer letter that includes:
1. A warm congratulatory opening with the candidate's name and role
2. Job details: title, department, location, work mode, start date
3. Compensation: base salary${args.signingBonus ? ", signing bonus" : ""}${args.benefits ? ", key benefits" : ""}
4. At-will employment / standard employment terms statement (one paragraph)
5. A clear acceptance instruction (e.g., "Please confirm your acceptance by replying to this email or signing and returning this letter by [date 5 days from start date]")
6. A warm, encouraging close

FORMAT RULES:
- Write in plain text, no markdown headers or bullet points in the letter body
- Use professional but human language — not robotic legalese
- Keep it between 350–500 words
- Use proper letter formatting with spacing between sections
- If company name is not provided, use "the Company" as a placeholder
- End with a signature block for the hiring manager`;

  return await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
    max_tokens: 900,
  });
}

recruitRouter.post("/jobs/:jobId/candidates/:candidateId/offer-letter", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidate = await RecruitCandidate.findOne({ _id: req.params.candidateId, jobId: req.params.jobId, uid });
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const {
      startDate, salary, salaryCurrency, signingBonus, benefits, companyName, hiringManagerName, regenerate,
    } = req.body;

    if (!startDate || !salary) {
      return res.status(400).json({ error: "Start date and salary are required." });
    }

    // Use cached version unless regenerate is requested
    if (candidate.offerLetter && !regenerate) {
      return res.json({ offerLetter: candidate.offerLetter });
    }

    const letter = await generateOfferLetter({
      candidateName: candidate.name,
      jobTitle: job.title,
      department: job.department,
      location: job.location,
      workMode: job.workMode,
      seniority: job.seniority,
      startDate,
      salary,
      salaryCurrency: salaryCurrency || job.salaryCurrency || "INR",
      signingBonus,
      benefits,
      companyName,
      hiringManagerName,
    });

    candidate.offerLetter = letter;
    await candidate.save();

    return res.json({ offerLetter: letter });
  } catch (err: any) {
    console.error("[recruit] POST /offer-letter", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Recruiter views a candidate's seeker profile ─────────────────────────────

recruitRouter.get("/jobs/:jobId/candidates/:candidateId/seeker-profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    const candidate = await RecruitCandidate.findOne({
      _id: req.params.candidateId,
      jobId: req.params.jobId,
      uid,
    }).lean();
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const seekerProfile = await RecruitSeekerProfile.findOne({ email: candidate.email }).lean();
    return res.json({
      candidate: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        location: candidate.location,
        currentStatus: candidate.currentStatus,
        educationLevel: candidate.educationLevel,
        currentClassYear: candidate.currentClassYear,
        availability: candidate.availability,
        coverLetter: candidate.coverLetter,
        linkedinUrl: candidate.linkedinUrl,
      },
      seekerProfile: seekerProfile ?? null,
    });
  } catch (err: any) {
    console.error("[recruit] GET /seeker-profile", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public: job seeker views recruiter profile ────────────────────────────────

recruitPublicRouter.get("/jobs/:jobId/recruiter", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      publicVisibility: { $ne: false },
    }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    const companyProfile = await RecruitCompanyProfile.findOne({ uid: job.uid }).lean();
    const otherJobs = await RecruitJob.find({
      uid: job.uid,
      status: "active",
      publicVisibility: { $ne: false },
      _id: { $ne: job._id },
    })
      .select("_id title niche location workMode jobType seniority freshersAllowed verifiedCompany salaryMin salaryMax salaryCurrency")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    return res.json({
      companyProfile: companyProfile ?? null,
      companyName: job.companyName,
      companyType: job.companyType,
      location: job.location,
      otherJobs,
    });
  } catch (err: any) {
    console.error("[recruit-public] GET /jobs/:jobId/recruiter", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

recruitRouter.get("/jobs/:jobId/export", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidates = await RecruitCandidate.find({ jobId: req.params.jobId, uid })
      .sort({ totalScore: -1 })
      .lean();

    const format = (req.query.format as string) || "csv";

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${job.title.replace(/[^a-z0-9]/gi, "_")}_candidates.json"`);
      return res.json(candidates.map(c => ({
        name: c.name,
        email: c.email,
        phone: c.phone || "",
        stage: c.stage,
        score: c.totalScore,
        maxScore: c.maxScore,
        scorePct: c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : 0,
        hiringDecision: c.hiringDecision || "",
        assessmentStatus: c.assessmentStatus,
        source: c.source || "",
        redFlags: c.redFlags.join("; "),
        strengths: c.strengths.join("; "),
        aiSummary: c.aiSummary,
        notes: c.notes || "",
        addedAt: c.createdAt,
      })));
    }

    // CSV export
    const escape = (val: string | number | undefined) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ["Name", "Email", "Phone", "Stage", "Score", "Max Score", "Score %", "Hiring Decision", "Assessment Status", "Source", "Red Flags", "Strengths", "AI Summary", "Notes", "Added At"];
    const rows = candidates.map(c => [
      c.name,
      c.email,
      c.phone || "",
      c.stage,
      c.totalScore,
      c.maxScore,
      c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : 0,
      c.hiringDecision || "",
      c.assessmentStatus,
      c.source || "",
      c.redFlags.join("; "),
      c.strengths.join("; "),
      c.aiSummary,
      c.notes || "",
      new Date(c.createdAt).toISOString(),
    ].map(escape).join(","));

    const csv = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${job.title.replace(/[^a-z0-9]/gi, "_")}_candidates.csv"`);
    trackEvent("recruiter_export_csv", uid, { jobId: req.params.jobId, candidateCount: candidates.length });
    return res.send(csv);
  } catch (err: any) {
    console.error("[recruit] GET /export", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Seeker Profile ────────────────────────────────────────────────────────

recruitRouter.get("/seeker/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const profile = await RecruitSeekerProfile.findOne({ uid }).lean();
    return res.json({ profile: profile ?? null });
  } catch (err: any) {
    console.error("[recruit] GET /seeker/profile", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.put("/seeker/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const {
      name, email, phone, headline, bio, skills, experience, education,
      preferredJobType, preferredWorkMode, preferredLocation,
      preferredSalaryMin, preferredSalaryMax, preferredNiche, experienceLevel, resumeText,
    } = req.body;
    const update: any = {};
    if (name !== undefined) update.name = String(name).trim();
    if (email !== undefined) update.email = String(email).trim();
    if (phone !== undefined) update.phone = String(phone).trim();
    if (headline !== undefined) update.headline = String(headline).trim();
    if (bio !== undefined) update.bio = String(bio).trim();
    if (Array.isArray(skills)) update.skills = skills.map((s: any) => String(s).trim()).filter(Boolean);
    if (Array.isArray(experience)) update.experience = experience;
    if (Array.isArray(education)) update.education = education;
    if (preferredJobType !== undefined) update.preferredJobType = String(preferredJobType).trim();
    if (preferredWorkMode !== undefined) update.preferredWorkMode = String(preferredWorkMode).trim();
    if (preferredLocation !== undefined) update.preferredLocation = String(preferredLocation).trim();
    if (preferredSalaryMin !== undefined) update.preferredSalaryMin = Number(preferredSalaryMin) || undefined;
    if (preferredSalaryMax !== undefined) update.preferredSalaryMax = Number(preferredSalaryMax) || undefined;
    if (preferredNiche !== undefined) update.preferredNiche = String(preferredNiche).trim();
    if (experienceLevel !== undefined) update.experienceLevel = String(experienceLevel).trim();
    if (resumeText !== undefined) update.resumeText = String(resumeText).trim();
    if (req.body.socialLinks && typeof req.body.socialLinks === "object") {
      const sl = req.body.socialLinks;
      update.socialLinks = {
        linkedin: String(sl.linkedin || "").trim(),
        instagram: String(sl.instagram || "").trim(),
        twitter: String(sl.twitter || "").trim(),
        github: String(sl.github || "").trim(),
        portfolio: String(sl.portfolio || "").trim(),
      };
    }
    if (req.body.photoUrl !== undefined) update.photoUrl = String(req.body.photoUrl).trim();
    const profile = await RecruitSeekerProfile.findOneAndUpdate(
      { uid },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ profile });
  } catch (err: any) {
    console.error("[recruit] PUT /seeker/profile", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Company Profile ──────────────────────────────────────────────────────────

recruitRouter.get("/company/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const profile = await RecruitCompanyProfile.findOne({ uid }).lean();
    return res.json({ profile: profile ?? null });
  } catch (err: any) {
    console.error("[recruit] GET /company/profile", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.put("/company/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const fields = ["companyName", "companyType", "industry", "companySize", "website", "location", "description", "mission", "benefits", "linkedinUrl", "logoUrl", "photoUrl", "bio"];
    const update: Record<string, any> = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) update[f] = String(req.body[f]).trim();
    }
    if (req.body.socialLinks && typeof req.body.socialLinks === "object") {
      const sl = req.body.socialLinks;
      update.socialLinks = {
        instagram: String(sl.instagram || "").trim(),
        twitter: String(sl.twitter || "").trim(),
        github: String(sl.github || "").trim(),
        portfolio: String(sl.portfolio || "").trim(),
      };
    }

    const profile = await RecruitCompanyProfile.findOneAndUpdate(
      { uid },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    return res.json({ profile });
  } catch (err: any) {
    console.error("[recruit] PUT /company/profile", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitRouter.post("/company/request-verification", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const profile = await RecruitCompanyProfile.findOne({ uid }).lean();
    if (!profile) return res.status(404).json({ error: "Company profile not found. Please save your company profile first." });
    if (!profile.companyName || !profile.description || !profile.website) {
      return res.status(400).json({ error: "Please complete your company profile (name, description, and website) before requesting verification." });
    }
    if ((profile as any).verificationStatus === "verified") {
      return res.json({ status: "verified", message: "Your company is already verified." });
    }
    if ((profile as any).verificationStatus === "requested") {
      return res.json({ status: "requested", message: "Your verification request is already under review." });
    }

    const updated = await RecruitCompanyProfile.findOneAndUpdate(
      { uid },
      { $set: { verificationStatus: "requested", verificationRequestedAt: new Date() } },
      { new: true }
    ).lean();

    return res.json({ status: "requested", message: "Verification request submitted. Our team will review within 2–3 business days.", profile: updated });
  } catch (err: any) {
    console.error("[recruit] POST /company/request-verification", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/jobs/:jobId/company", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    }).select("uid companyName companyType location").lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const profile = await RecruitCompanyProfile.findOne({ uid: job.uid }).lean();
    return res.json({
      companyName: job.companyName,
      companyType: job.companyType,
      location: job.location,
      profile: profile ?? null,
    });
  } catch (err: any) {
    console.error("[recruit] GET /jobs/company", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Job Match Analysis (Phase 3 – job seeker AI) ────────────────────────────

async function generateJobMatch(args: {
  job: any;
  skills: string[];
  preferredNiche?: string;
  preferredWorkMode?: string;
  preferredLocation?: string;
  preferredSalaryMin?: number;
  preferredSalaryMax?: number;
  experienceLevel?: string;
  resumeText?: string;
}): Promise<{
  matchScore: number;
  matchReasons: string[];
  missingSkills: string[];
  profileSuggestions: string[];
}> {
  const jobSalary =
    args.job.salaryMin || args.job.salaryMax
      ? `INR ${(args.job.salaryMin ?? 0).toLocaleString("en-IN")}–${(args.job.salaryMax ?? 0).toLocaleString("en-IN")} per year`
      : "Not disclosed";
  const seekerSalary =
    args.preferredSalaryMin || args.preferredSalaryMax
      ? `INR ${(args.preferredSalaryMin ?? 0).toLocaleString("en-IN")}–${(args.preferredSalaryMax ?? 0).toLocaleString("en-IN")}`
      : "Not specified";

  const prompt = `You are a career counselor analyzing how well a job matches a job seeker. Be specific and encouraging.

JOB:
- Title: ${args.job.title}
- Niche: ${args.job.niche || args.job.department || "General"}
- Location: ${args.job.location || "India"}
- Work Mode: ${args.job.workMode || "Not specified"}
- Salary: ${jobSalary}
- Seniority Level: ${(args.job as any).seniority || "Not specified"}
- Freshers Allowed: ${args.job.freshersAllowed ? "Yes" : "No"}
- Must-have skills: ${args.job.mustHaveSkills || "Not specified"}
- Nice-to-have skills: ${args.job.niceToHaveSkills || "Not specified"}

SEEKER PROFILE:
- Skills: ${args.skills.join(", ") || "Not listed"}
- Experience Level: ${args.experienceLevel || "Not specified"}
- Preferred Niche: ${args.preferredNiche || "Any"}
- Preferred Work Mode: ${args.preferredWorkMode || "Any"}
- Preferred Location: ${args.preferredLocation || "Any"}
- Expected Salary: ${seekerSalary}
- Resume Text: ${args.resumeText ? args.resumeText.slice(0, 2000) : "Not provided"}

Analyze the match. Return ONLY this JSON (no markdown):
{
  "matchScore": 72,
  "matchReasons": ["specific reason referencing actual data", "another specific reason"],
  "missingSkills": ["skill genuinely absent from profile"],
  "profileSuggestions": ["specific actionable improvement for this role"]
}

Rules:
- matchScore: 0–100, based on skills overlap, niche/work-mode/location/salary alignment, and experience fit
- matchReasons: 3–5 items, specific to this job+seeker combination, not generic phrases
- missingSkills: only skills listed in job requirements that are genuinely absent (max 5); empty array if none
- profileSuggestions: 2–4 concrete, actionable suggestions to improve their profile or chances for this specific role
- If no resume text, focus on preference and skills matching only`;

  const raw = await callNvidiaChatCompletions({
    apiKey: NVIDIA_API_KEY,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.35,
    max_tokens: 800,
  });

  const parsed = safeJson(raw);
  if (!parsed) {
    return { matchScore: 0, matchReasons: [], missingSkills: [], profileSuggestions: ["Complete your profile to get personalized match insights."] };
  }

  return {
    matchScore: Math.max(0, Math.min(100, Number(parsed.matchScore) || 0)),
    matchReasons: Array.isArray(parsed.matchReasons) ? parsed.matchReasons.filter((r: any) => typeof r === "string").slice(0, 5) : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.filter((s: any) => typeof s === "string").slice(0, 5) : [],
    profileSuggestions: Array.isArray(parsed.profileSuggestions) ? parsed.profileSuggestions.filter((s: any) => typeof s === "string").slice(0, 4) : [],
  };
}

recruitPublicRouter.post("/jobs/:jobId/match", async (req, res) => {
  try {
    await connectMongo();
    const job = await RecruitJob.findOne({
      _id: req.params.jobId,
      status: "active",
      publicVisibility: { $ne: false },
    }).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });

    const { skills, preferredNiche, preferredWorkMode, preferredLocation, preferredSalaryMin, preferredSalaryMax, experienceLevel, resumeText } = req.body;

    if (!resumeText?.trim() && (!Array.isArray(skills) || skills.length === 0)) {
      return res.status(400).json({ error: "Provide at least your skills or resume text for match analysis." });
    }

    const result = await generateJobMatch({
      job,
      skills: Array.isArray(skills) ? skills : [],
      preferredNiche,
      preferredWorkMode,
      preferredLocation,
      preferredSalaryMin: preferredSalaryMin ? Number(preferredSalaryMin) : undefined,
      preferredSalaryMax: preferredSalaryMax ? Number(preferredSalaryMax) : undefined,
      experienceLevel,
      resumeText,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[recruit] POST /jobs/match", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Report Job ───────────────────────────────────────────────────────────────

recruitPublicRouter.post("/jobs/:jobId/report", async (req, res) => {
  try {
    await connectMongo();
    const { reason, details } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: "Reason is required." });
    const job = await RecruitJob.findOneAndUpdate(
      { _id: req.params.jobId, status: "active" },
      { $push: { reports: { reason: String(reason).trim(), details: String(details || "").trim(), reportedAt: new Date() } } },
      { new: true }
    ).lean();
    if (!job) return res.status(404).json({ error: "Job not found." });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[recruit] POST /jobs/report", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Applications by email (for applied jobs history) ──────────────────────

recruitPublicRouter.get("/my-applications", async (req, res) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    const candidates = await RecruitCandidate.find({ email: new RegExp(`^${email}$`, "i") })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const jobIds = [...new Set(candidates.map(c => c.jobId.toString()))];
    const jobs = await RecruitJob.find({ _id: { $in: jobIds } })
      .select("title companyName location workMode jobType status niche createdAt")
      .lean();
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j._id.toString()] = j;
    const applications = candidates.map(c => ({
      _id: c._id,
      jobId: c.jobId,
      job: jobMap[c.jobId.toString()] ?? null,
      stage: c.stage,
      totalScore: c.totalScore,
      maxScore: c.maxScore,
      assessmentStatus: c.assessmentStatus,
      appliedAt: c.createdAt,
    }));
    return res.json({ applications });
  } catch (err: any) {
    console.error("[recruit] GET /my-applications", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Job Alerts ──────────────────────────────────────────────────────────────

recruitPublicRouter.post("/job-alerts", async (req, res) => {
  try {
    await connectMongo();
    const { email, niche, workMode, keywords, location, freshersOnly, verifiedOnly } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ error: "email required" });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await RecruitJobAlert.findOne({ email: normalizedEmail, niche: niche || "", workMode: workMode || "" });
    if (existing) {
      existing.keywords = keywords || "";
      existing.location = location || "";
      existing.freshersOnly = !!freshersOnly;
      existing.verifiedOnly = !!verifiedOnly;
      await existing.save();
      return res.json({ alert: existing, updated: true });
    }
    const alert = await RecruitJobAlert.create({
      email: normalizedEmail,
      niche: niche || "",
      workMode: workMode || "",
      keywords: keywords || "",
      location: location || "",
      freshersOnly: !!freshersOnly,
      verifiedOnly: !!verifiedOnly,
    });
    return res.status(201).json({ alert });
  } catch (err: any) {
    console.error("[recruit] POST /job-alerts", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/job-alerts", async (req, res) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    const alerts = await RecruitJobAlert.find({ email }).sort({ createdAt: -1 }).lean();
    const alertsWithCounts = await Promise.all(
      alerts.map(async (a) => {
        const filter: any = { status: "active", publicVisibility: { $ne: false }, createdAt: { $gt: a.lastCheckedAt } };
        if (a.niche) filter.niche = a.niche;
        if (a.workMode) filter.workMode = a.workMode;
        if (a.freshersOnly) filter.freshersAllowed = true;
        if (a.verifiedOnly) filter.verifiedCompany = true;
        if (a.keywords) {
          const rx = new RegExp(a.keywords.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
          filter.$or = [{ title: rx }, { mustHaveSkills: rx }, { companyName: rx }, { location: rx }];
        }
        if (a.location) filter.location = new RegExp(a.location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const newCount = await RecruitJob.countDocuments(filter);
        return { ...a, newJobCount: newCount };
      })
    );
    return res.json({ alerts: alertsWithCounts });
  } catch (err: any) {
    console.error("[recruit] GET /job-alerts", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.get("/job-alerts/:alertId/jobs", async (req, res) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    const alert = await RecruitJobAlert.findOne({ _id: req.params.alertId, email });
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    const filter: any = { status: "active", publicVisibility: { $ne: false } };
    if (alert.niche) filter.niche = alert.niche;
    if (alert.workMode) filter.workMode = alert.workMode;
    if (alert.freshersOnly) filter.freshersAllowed = true;
    if (alert.verifiedOnly) filter.verifiedCompany = true;
    if (alert.keywords) {
      const rx = new RegExp(alert.keywords.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { mustHaveSkills: rx }, { companyName: rx }, { location: rx }];
    }
    if (alert.location) filter.location = new RegExp(alert.location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const jobs = await RecruitJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .select("title companyName location workMode jobType salaryMin salaryMax salaryCurrency freshersAllowed verifiedCompany mustHaveSkills createdAt niche")
      .lean();
    alert.lastCheckedAt = new Date();
    await alert.save();
    return res.json({ jobs, alertId: alert._id });
  } catch (err: any) {
    console.error("[recruit] GET /job-alerts/:id/jobs", err);
    return res.status(500).json({ error: err.message });
  }
});

recruitPublicRouter.delete("/job-alerts/:alertId", async (req, res) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    await RecruitJobAlert.deleteOne({ _id: req.params.alertId, email });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[recruit] DELETE /job-alerts/:id", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Recommended Jobs (based on profile or manual prefs) ─────────────────────

recruitPublicRouter.get("/recommended-jobs", async (req, res) => {
  try {
    await connectMongo();
    const niche = String(req.query.niche ?? "").trim();
    const workMode = String(req.query.workMode ?? "").trim();
    const skills = String(req.query.skills ?? "").trim();
    const location = String(req.query.location ?? "").trim();
    const freshersAllowed = req.query.freshersAllowed === "true";

    const filter: any = { status: "active", publicVisibility: { $ne: false } };
    if (niche) filter.niche = niche;
    if (workMode) filter.workMode = workMode;
    if (freshersAllowed) filter.freshersAllowed = true;
    if (location) filter.location = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (skills) {
      const skillList = skills.split(",").map(s => s.trim()).filter(Boolean);
      if (skillList.length > 0) {
        const rx = skillList.map(s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
        filter.$or = rx.map(r => ({ mustHaveSkills: r }));
      }
    }
    const jobs = await RecruitJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(6)
      .select("title companyName location workMode jobType salaryMin salaryMax salaryCurrency freshersAllowed verifiedCompany mustHaveSkills createdAt niche seniority")
      .lean();
    return res.json({ jobs });
  } catch (err: any) {
    console.error("[recruit] GET /recommended-jobs", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Recruiter: new applicants count since last check ────────────────────────

recruitRouter.get("/jobs/:jobId/new-applicants-count", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const job = await RecruitJob.findOne({ _id: req.params.jobId, uid }).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);
    const count = await RecruitCandidate.countDocuments({ jobId: req.params.jobId, createdAt: { $gt: since } });
    return res.json({ count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Pipeline summary for dashboard ─────────────────────────────────────────

recruitRouter.get("/pipeline-summary", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const [stageCounts, sourceBreakdown] = await Promise.all([
      RecruitCandidate.aggregate([
        { $match: { uid } },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),
      RecruitCandidate.aggregate([
        { $match: { uid, source: { $exists: true, $ne: "" } } },
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const stages: Record<string, number> = {};
    for (const s of stageCounts as Array<{ _id: string; count: number }>) {
      stages[s._id] = s.count;
    }

    const shortlisted = (stages["screened"] || 0) + (stages["assessed"] || 0);
    const interview = stages["interview"] || 0;
    const hired = stages["hired"] || 0;
    const offer = stages["offer"] || 0;
    const total = Object.values(stages).reduce((sum, v) => sum + v, 0);

    return res.json({
      total,
      shortlisted,
      interview,
      hired,
      offer,
      stages,
      sourceBreakdown: (sourceBreakdown as Array<{ _id: string; count: number }>).map(s => ({ source: s._id, count: s.count })),
    });
  } catch (err: any) {
    console.error("[recruit] GET /pipeline-summary", err);
    return res.status(500).json({ error: err.message });
  }
});
