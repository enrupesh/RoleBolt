import express from "express";
import { connectMongo } from "./db";
import { RecruitSeekerProfile } from "./models/RecruitSeekerProfile";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitJob } from "./models/RecruitJob";
import { callGeminiChain } from "./ai/geminiClient";
import { callMeshChatCompletions } from "./ai/meshClient";
import { callNvidia } from "./ai/nvidiaClient";

export const seekerRouter = express.Router();

// Helper: get uid from request (set by requireAuth middleware)
function getUid(req: express.Request): string {
  return (req as any).user?._id?.toString() ?? (req as any).user?.id?.toString() ?? "";
}

// Fallback AI chain
async function callAI(prompt: string): Promise<string> {
  try {
    const r = await callGeminiChain({ prompt });
    if (r) return r;
  } catch (e) { console.error("[seeker-ai] Gemini failed:", e); }
  try {
    const MESH_KEY = process.env.GEMINI_MESH_KEY ?? "";
    const r = await callMeshChatCompletions({ apiKey: MESH_KEY, messages: [{ role: "user", content: prompt }] });
    if (r) return r;
  } catch (e) { console.error("[seeker-ai] Mesh failed:", e); }
  return callNvidia({ messages: [{ role: "user", content: prompt }] });
}

function safeParseJson(text: string): any {
  const t = (text ?? "").trim();
  const attempts = [
    () => JSON.parse(t),
    () => { const m = t.match(/```json\s*([\s\S]*?)```/); return m ? JSON.parse(m[1]) : null; },
    () => { const m = t.match(/```\s*([\s\S]*?)```/);      return m ? JSON.parse(m[1]) : null; },
    () => { const m = t.match(/(\{[\s\S]*\})/);            return m ? JSON.parse(m[1]) : null; },
    () => { const m = t.match(/(\[[\s\S]*\])/);            return m ? JSON.parse(m[1]) : null; },
  ];
  for (const fn of attempts) {
    try { const r = fn(); if (r !== null && r !== undefined) return r; } catch { /* try next */ }
  }
  return null;
}

// ── GET /recruit/seeker/profile ───────────────────────────────────────────────
seekerRouter.get("/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const profile = await RecruitSeekerProfile.findOne({ uid }).lean();
    return res.json({ profile: profile ?? null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /recruit/seeker/profile ───────────────────────────────────────────────
seekerRouter.put("/profile", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const allowed = [
      "name", "email", "phone", "headline", "bio", "skills",
      "experience", "education", "preferredJobType", "preferredWorkMode",
      "preferredLocation", "preferredSalaryMin", "preferredSalaryMax",
      "preferredNiche", "experienceLevel", "resumeText", "resumeFileName",
      "socialLinks", "photoUrl",
    ];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const profile = await RecruitSeekerProfile.findOneAndUpdate(
      { uid },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /recruit/seeker/applications ─────────────────────────────────────────
seekerRouter.get("/applications", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    // Candidates linked to this user's uid
    const candidates = await RecruitCandidate.find({ uid }).sort({ createdAt: -1 }).lean();
    if (!candidates.length) return res.json({ applications: [] });

    const jobIds = [...new Set(candidates.map((c: any) => c.jobId?.toString()).filter(Boolean))];
    const jobs = await RecruitJob.find({ _id: { $in: jobIds } }).lean();
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j._id.toString()] = j;

    const applications = candidates.map((c: any) => ({
      id: c._id.toString(),
      jobId: c.jobId?.toString() ?? "",
      jobTitle: jobMap[c.jobId?.toString()]?.title ?? "Unknown Role",
      companyName: jobMap[c.jobId?.toString()]?.companyName ?? "",
      location: jobMap[c.jobId?.toString()]?.location ?? "",
      workMode: jobMap[c.jobId?.toString()]?.workMode ?? "",
      stage: c.stage ?? "applied",
      totalScore: c.totalScore ?? 0,
      maxScore: c.maxScore ?? 0,
      appliedAt: c.createdAt,
      stageMovedAt: c.stageMovedAt ?? null,
    }));

    return res.json({ applications });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /recruit/seeker/saved-jobs ────────────────────────────────────────────
seekerRouter.get("/saved-jobs", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const profile = await RecruitSeekerProfile.findOne({ uid }).lean() as any;
    const savedIds: string[] = profile?.savedJobIds ?? [];
    if (!savedIds.length) return res.json({ jobs: [] });

    const jobDocs = await RecruitJob.find({ _id: { $in: savedIds }, publicVisibility: true }).lean();
    const jobs = jobDocs.map((j: any) => ({
      id: j._id.toString(),
      title: j.title,
      companyName: j.companyName,
      location: j.location,
      workMode: j.workMode,
      seniority: j.seniority,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      salaryCurrency: j.salaryCurrency,
    }));
    return res.json({ jobs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/jobs/:id/save ────────────────────────────────────────
seekerRouter.post("/jobs/:id/save", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const jobId = req.params.id;
    const profile = await RecruitSeekerProfile.findOneAndUpdate(
      { uid },
      { $addToSet: { savedJobIds: jobId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ ok: true, savedJobIds: (profile as any).savedJobIds });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /recruit/seeker/jobs/:id/save ──────────────────────────────────────
seekerRouter.delete("/jobs/:id/save", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const jobId = req.params.id;
    const profile = await RecruitSeekerProfile.findOneAndUpdate(
      { uid },
      { $pull: { savedJobIds: jobId } },
      { new: true }
    ).lean();
    return res.json({ ok: true, savedJobIds: (profile as any)?.savedJobIds ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/resume/build ─────────────────────────────────────────
seekerRouter.post("/resume/build", async (req, res) => {
  try {
    await connectMongo();
    const { answers, targetRole } = req.body as {
      answers: { question: string; answer: string }[];
      targetRole?: string;
    };
    if (!answers?.length) return res.status(400).json({ error: "Answers are required." });

    const qaPairs = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
    const prompt = `You are a professional resume writer specializing in ATS optimization. Based on the following Q&A answers, create a complete, professional resume.

Target Role: ${targetRole || "Not specified"}

Q&A Answers:
${qaPairs}

Return ONLY valid JSON in this exact structure (no markdown, no extra text):
{
  "contactInfo": { "name": "", "email": "", "phone": "", "location": "" },
  "summary": "",
  "experience": [{ "title": "", "company": "", "duration": "", "bullets": [""] }],
  "education": [{ "degree": "", "school": "", "year": "" }],
  "skills": { "technical": [""], "soft": [""] },
  "atsKeywords": [""],
  "atsScore": 85,
  "fullText": ""
}

Rules:
- summary: 2-3 sentences, strong value proposition
- experience bullets: start with action verbs, include metrics where possible
- atsKeywords: 8-12 keywords matching the target role
- atsScore: realistic 0-100 ATS compatibility score
- fullText: plain text version of the full resume (no JSON, just text)`;

    const raw = await callAI(prompt);
    const parsed = safeParseJson(raw);

    if (!parsed) {
      return res.status(500).json({ error: "AI failed to generate a structured resume. Please try again." });
    }

    // If fullText is missing, build it from the parts
    if (!parsed.fullText && parsed.contactInfo) {
      const lines: string[] = [];
      lines.push(parsed.contactInfo.name ?? "");
      if (parsed.contactInfo.email) lines.push(parsed.contactInfo.email);
      if (parsed.contactInfo.phone) lines.push(parsed.contactInfo.phone);
      if (parsed.contactInfo.location) lines.push(parsed.contactInfo.location);
      lines.push("\nSUMMARY\n" + (parsed.summary ?? ""));
      if (parsed.experience?.length) {
        lines.push("\nEXPERIENCE");
        for (const e of parsed.experience) {
          lines.push(`${e.title} at ${e.company} (${e.duration})`);
          for (const b of (e.bullets ?? [])) lines.push(`• ${b}`);
        }
      }
      if (parsed.education?.length) {
        lines.push("\nEDUCATION");
        for (const e of parsed.education) lines.push(`${e.degree} — ${e.school} (${e.year})`);
      }
      if (parsed.skills) {
        lines.push("\nSKILLS");
        if (parsed.skills.technical?.length) lines.push("Technical: " + parsed.skills.technical.join(", "));
        if (parsed.skills.soft?.length) lines.push("Soft Skills: " + parsed.skills.soft.join(", "));
      }
      parsed.fullText = lines.join("\n");
    }

    return res.json({ resume: parsed });
  } catch (err: any) {
    console.error("[seeker] resume/build error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/resume/improve ───────────────────────────────────────
seekerRouter.post("/resume/improve", async (req, res) => {
  try {
    await connectMongo();
    const { resumeText, targetJobDescription } = req.body as {
      resumeText: string;
      targetJobDescription: string;
    };
    if (!resumeText) return res.status(400).json({ error: "Resume text is required." });
    if (!targetJobDescription) return res.status(400).json({ error: "Job description is required." });

    const prompt = `You are an expert resume coach. Improve this resume to better match the target job description.

CURRENT RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${targetJobDescription}

Return ONLY valid JSON (no markdown, no extra text):
{
  "improvedResume": "full improved resume text here",
  "changes": ["change description 1", "change description 2", "change description 3"],
  "atsScore": 88
}

Rules:
- improvedResume: complete rewritten resume text (plain text, not JSON)
- changes: 3-5 specific improvements made (e.g. "Added Docker to skills section", "Rewrote summary to highlight cloud experience")
- atsScore: estimated ATS score 0-100 after improvements
- Keep the same work history — do not invent new jobs or fake experience
- Add missing keywords from the JD, strengthen action verbs, quantify achievements where possible`;

    const raw = await callAI(prompt);
    const parsed = safeParseJson(raw);

    if (!parsed?.improvedResume) {
      return res.status(500).json({ error: "AI failed to improve the resume. Please try again." });
    }

    return res.json({
      improvedResume: parsed.improvedResume,
      changes: parsed.changes ?? [],
      atsScore: parsed.atsScore ?? 0,
    });
  } catch (err: any) {
    console.error("[seeker] resume/improve error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/cover-letter/generate ────────────────────────────────
seekerRouter.post("/cover-letter/generate", async (req, res) => {
  try {
    await connectMongo();
    const { jobId, jobDescription, resumeText, tone = "professional" } = req.body as {
      jobId?: string;
      jobDescription?: string;
      resumeText: string;
      tone?: "professional" | "enthusiastic" | "concise";
    };
    if (!resumeText) return res.status(400).json({ error: "Resume text is required." });

    let jd = jobDescription ?? "";
    // If jobId provided and no JD text, fetch the JD
    if (jobId && !jd) {
      const job = await RecruitJob.findById(jobId).lean() as any;
      if (job) jd = job.generatedJD || `${job.title} at ${job.companyName}. Required skills: ${job.mustHaveSkills}`;
    }
    if (!jd) return res.status(400).json({ error: "Job description is required." });

    const toneGuide = {
      professional: "formal, polished, and confident. Use precise language and maintain a business-appropriate tone.",
      enthusiastic: "energetic, passionate, and positive. Show genuine excitement about the role and company.",
      concise: "brief, direct, and impactful. Every sentence earns its place — no filler words.",
    }[tone];

    const prompt = `Write a compelling cover letter for this job application.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resumeText}

TONE: ${toneGuide}

Rules:
- Exactly 3 paragraphs: (1) strong hook that references the specific role, (2) why you're the right fit with 2-3 specific examples from the resume, (3) confident CTA
- Under 300 words
- Reference specific skills and requirements from the job description
- Sound human, not robotic
- NEVER start with "I am writing to express my interest"
- Return ONLY the cover letter text (no subject line, no JSON, no markdown)`;

    const coverLetter = await callAI(prompt);
    const wordCount = coverLetter.trim().split(/\s+/).length;

    return res.json({ coverLetter: coverLetter.trim(), wordCount });
  } catch (err: any) {
    console.error("[seeker] cover-letter error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/interview-prep/questions ─────────────────────────────
seekerRouter.post("/interview-prep/questions", async (req, res) => {
  try {
    await connectMongo();
    const { jobDescription, difficulty = "mid" } = req.body as {
      jobDescription: string;
      difficulty?: "entry" | "mid" | "senior";
    };
    if (!jobDescription) return res.status(400).json({ error: "Job description is required." });

    const difficultyGuide = {
      entry:  "foundational questions suitable for entry-level candidates (0-2 years experience)",
      mid:    "intermediate questions for mid-level candidates (3-6 years experience)",
      senior: "advanced questions for senior candidates (7+ years experience)",
    }[difficulty];

    const prompt = `You are an expert interview coach. Generate 5 interview questions for this role.

JOB DESCRIPTION:
${jobDescription}

DIFFICULTY LEVEL: ${difficultyGuide}

Return ONLY valid JSON (no markdown, no extra text):
{
  "questions": [
    {
      "id": "q1",
      "question": "Tell me about a time you...",
      "category": "behavioral",
      "tips": "What a strong answer includes: STAR format, specific metrics, team impact"
    }
  ]
}

Include a mix of: behavioral (2), technical (2), situational (1).
Categories: "behavioral" | "technical" | "situational" | "culture"
Make questions specific to the role and skills mentioned in the JD.`;

    const raw = await callAI(prompt);
    const parsed = safeParseJson(raw);

    if (!parsed?.questions?.length) {
      return res.status(500).json({ error: "Failed to generate interview questions. Please try again." });
    }

    return res.json({ questions: parsed.questions });
  } catch (err: any) {
    console.error("[seeker] interview-prep/questions error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/profile/optimize ────────────────────────────────────
seekerRouter.post("/profile/optimize", async (req, res) => {
  try {
    await connectMongo();
    const { resumeText, targetRole, currentSkills } = req.body as {
      resumeText?: string;
      targetRole?: string;
      currentSkills?: string[];
    };
    if (!resumeText && (!currentSkills?.length)) {
      return res.status(400).json({ error: "Provide resume text or skills to analyze." });
    }

    const skillsList = Array.isArray(currentSkills) ? currentSkills.join(", ") : "";
    const prompt = `You are an expert career coach and recruiter. Analyze this job seeker's profile and give specific, high-impact improvements.

RESUME / PROFILE:
${resumeText ? resumeText.slice(0, 3000) : "Not provided"}

CURRENT SKILLS: ${skillsList || "Not listed"}
TARGET ROLE: ${targetRole || "Not specified"}

Return ONLY valid JSON (no markdown, no extra text):
{
  "profileScore": 72,
  "grade": "B",
  "improvements": [
    {
      "priority": "high",
      "action": "Add TypeScript to your skills",
      "impact": "+23% more matches",
      "howTo": "List TypeScript in your skills section and mention any TypeScript projects"
    }
  ],
  "inDemandSkills": ["Docker", "AWS", "TypeScript"],
  "missingFromProfile": ["AWS", "Docker"],
  "salaryInsight": "Developers with your profile typically earn $85K-$110K"
}

Rules:
- profileScore: 0-100 realistic score based on completeness and market fit
- grade: A/B/C/D/F matching the score
- improvements: 4-6 items ordered by priority (high/medium/low), each with a specific action, measurable impact, and brief howTo
- inDemandSkills: 5-7 skills currently in-demand for the target role
- missingFromProfile: skills from inDemandSkills that are absent from the profile
- salaryInsight: realistic salary range based on the profile (be specific, not generic)
- Be specific and data-driven — reference actual skills/experience from the profile`;

    const raw = await callAI(prompt);
    const parsed = safeParseJson(raw);

    if (!parsed || typeof parsed.profileScore !== "number") {
      return res.status(500).json({ error: "AI failed to analyze profile. Please try again." });
    }

    return res.json({
      profileScore: Math.max(0, Math.min(100, parsed.profileScore)),
      grade: parsed.grade ?? "C",
      improvements: parsed.improvements ?? [],
      inDemandSkills: parsed.inDemandSkills ?? [],
      missingFromProfile: parsed.missingFromProfile ?? [],
      salaryInsight: parsed.salaryInsight ?? "",
    });
  } catch (err: any) {
    console.error("[seeker] profile/optimize error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /recruit/seeker/interview-prep/evaluate ──────────────────────────────
seekerRouter.post("/interview-prep/evaluate", async (req, res) => {
  try {
    await connectMongo();
    const { question, answer, jobContext } = req.body as {
      question: string;
      answer: string;
      jobContext: string;
    };
    if (!question || !answer) return res.status(400).json({ error: "Question and answer are required." });

    const prompt = `You are an expert interview coach. Evaluate this interview answer.

INTERVIEW QUESTION: ${question}
CANDIDATE ANSWER: ${answer}
JOB CONTEXT: ${jobContext || "Not provided"}

Return ONLY valid JSON (no markdown, no extra text):
{
  "score": 78,
  "grade": "B+",
  "strengths": ["Used concrete example", "Clear structure"],
  "improvements": ["Add a quantifiable outcome", "Mention team impact"],
  "betterAnswer": "Here's how to strengthen the answer: ...",
  "followUpQuestions": ["Can you quantify the business impact?"]
}

Scoring guide:
- 90-100 (A): Exceptional — STAR format, specific metrics, clear impact
- 80-89 (B): Good — solid example, minor gaps in specifics
- 70-79 (C): Average — relevant but vague or missing impact
- 60-69 (D): Below average — lacks structure or specifics
- <60 (F): Needs significant improvement

betterAnswer: 2-3 sentences showing HOW to improve (not a full rewrite)
followUpQuestions: 1-2 natural follow-up questions an interviewer might ask`;

    const raw = await callAI(prompt);
    const parsed = safeParseJson(raw);

    if (!parsed || typeof parsed.score !== "number") {
      return res.status(500).json({ error: "Failed to evaluate answer. Please try again." });
    }

    return res.json({
      score: parsed.score,
      grade: parsed.grade ?? "C",
      strengths: parsed.strengths ?? [],
      improvements: parsed.improvements ?? [],
      betterAnswer: parsed.betterAnswer ?? "",
      followUpQuestions: parsed.followUpQuestions ?? [],
    });
  } catch (err: any) {
    console.error("[seeker] interview-prep/evaluate error:", err);
    return res.status(500).json({ error: err.message });
  }
});
