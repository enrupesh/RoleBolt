/**
 * buildCopilotPrompt
 *
 * Builds system prompts for the AI Hiring Copilot ("Ask Rolebolt").
 *
 * Two output modes:
 *   "json"   — full structured JSON response (used by POST /chat)
 *   "stream" — plain reply text followed by ---ROLEBOLT_META--- + JSON metadata
 *              (used by POST /chat/stream; the reply streams naturally while
 *               metadata is parsed and sent in a final SSE "done" event)
 */

import type { IRecruitJob } from "../models/RecruitJob";
import type { IRecruitCandidate } from "../models/RecruitCandidate";
import type { JobPipelineStat } from "./globalHiringStats";

export type CopilotContextLevel = "global" | "job" | "candidate";
export type CopilotPromptMode = "json" | "stream";

export interface GlobalCandidateSummary {
  _id: any;
  name: string;
  jobId: any;
  jobTitle: string;
  totalScore: number;
  maxScore: number;
  stage: string;
  hiringDecision?: string | null;
  assessmentStatus?: string;
  strengths?: string[];
  location?: string;
  availability?: string;
}

export interface CopilotPromptContext {
  level: CopilotContextLevel;
  mode?: CopilotPromptMode;
  recruiterName?: string;
  companyName?: string;
  // Job context
  job?: IRecruitJob & { _id: any };
  candidates?: Array<IRecruitCandidate & { _id: any }>;
  // Candidate context
  candidate?: IRecruitCandidate & { _id: any };
  // Global context (Phase 3 — Organization Intelligence)
  globalStats?: string;
  allJobs?: Array<IRecruitJob & { _id: any }>;
  allCandidates?: GlobalCandidateSummary[];
  pipelines?: JobPipelineStat[];
  /** When set, this is a synthetic instruction (e.g. "generate today's insights card") rather than a real recruiter question. */
  syntheticInstruction?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeText(s: string | undefined | null, maxChars = 3000): string {
  if (!s) return "(not available)";
  return s.length > maxChars ? s.slice(0, maxChars) + "…" : s;
}

function formatScore(total: number, max: number): string {
  if (!max) return "N/A";
  const pct = Math.round((total / max) * 100);
  return `${total}/${max} (${pct}%)`;
}

function candidateSummaryBlock(
  c: IRecruitCandidate & { _id: any },
  rank: number
): string {
  const scoreStr = formatScore(c.totalScore, c.maxScore);
  const strengths = c.strengths?.slice(0, 3).join(", ") || "—";
  const redFlags = c.redFlags?.slice(0, 2).join(", ") || "None";
  const breakdownLines = (c.scoreBreakdown || [])
    .map((b) => `    • ${b.criterion}: ${b.score}/${b.maxScore} — ${b.reasoning}`)
    .join("\n");
  const assessmentDone = c.assessmentStatus === "completed";
  const hasInterviewBrief = !!c.interviewBrief;
  const availability = c.availability || "Not specified";
  const location = c.location || "Not specified";

  return `
[${rank}] ${c.name} — candidateId: ${String(c._id)}
  Score: ${scoreStr} | Stage: ${c.stage}
  Strengths: ${strengths}
  Red flags: ${redFlags}
  Location: ${location} | Availability: ${availability}
  Assessment: ${assessmentDone ? "Completed" : c.assessmentStatus}
  Interview Brief: ${hasInterviewBrief ? "Available" : "Not generated"}
  AI Summary: ${safeText(c.aiSummary, 400)}
  Score breakdown:
${breakdownLines || "    (not scored yet)"}
  Resume excerpt: ${safeText(c.resumeText, 600)}`.trim();
}

// ─── Shared response format instructions ─────────────────────────────────────

function sourceShape(): string {
  return `{
      "type": "<resume|assessment|interview_brief|score_breakdown|candidate_profile|job_description>",
      "label": "<human label, e.g. 'Rahul — Resume'>",
      "candidateId": "<MongoDB _id string, or null>",
      "candidateName": "<full name, or null>",
      "resumeId": null,
      "assessmentId": null,
      "page": <page number if applicable, or null>,
      "sectionId": "<named section id, e.g. 'experience', 'skills', or null>",
      "detail": "<fine-grained pointer shown as tooltip, e.g. 'Experience Section' or null>"
    }`;
}

function jsonResponseFormat(): string {
  return `## Response Format — CRITICAL
You MUST respond ONLY with valid JSON matching this exact structure. Never wrap it in markdown code fences.

{
  "reply": "<your full answer in markdown — use **bold**, bullet points, and clear sections>",
  "recommendation": "<single clear action for the recruiter, e.g. 'Interview Rahul first' — required>",
  "confidence": <integer 0–100 — how confident you are in the recommendation>,
  "reasoning": "<one sentence explaining the confidence score, e.g. 'Highest rubric match with verified AWS experience'>",
  "sources": [
    ${sourceShape()}
  ],
  "quickActions": ["<2–4 natural follow-up actions>"]
}`;
}

function streamResponseFormat(): string {
  return `## Response Format — CRITICAL

Write your reply in natural markdown first (this streams to the recruiter in real time).
Use **bold**, bullet points, and clear sections. Be direct and informative.

After your complete reply, output EXACTLY the following sentinel on its own line (nothing before or after):
---ROLEBOLT_META---

Then immediately output a single JSON object (no code fences) with this exact shape:
{
  "recommendation": "<single clear action, e.g. 'Interview Rahul first'>",
  "confidence": <integer 0–100>,
  "reasoning": "<one sentence explaining the confidence>",
  "sources": [
    ${sourceShape()}
  ],
  "quickActions": ["<2–4 natural follow-up actions>"]
}`;
}

function sharedBehaviourRules(): string {
  return `## Source Rules
- Every factual claim about a candidate MUST have a matching source entry.
- "resume" → claims from resume text. Set sectionId to "experience", "skills", "education", etc. when applicable.
- "score_breakdown" → claims from rubric scores.
- "assessment" → claims from assessment answers. Set detail to "Question N" when applicable.
- "interview_brief" → references to the generated interview brief.
- "candidate_profile" → stage, location, availability, other profile fields.
- "job_description" → references to the JD text or rubric criteria.
- If a candidateId is known, ALWAYS include it in the source — the frontend uses it for deep links.
- If no source exists, note "Based on available data:" in the reply and omit the source.

## Recommendation Rules
- Every response MUST include a single clear recommendation.
- Be direct: "Interview Rahul first.", "Shortlist these 3.", "Request an assessment from Aman."
- Confidence must reflect actual data quality: 90–100 = strong evidence, 60–89 = partial evidence, <60 = limited data.
- If data is insufficient, say so and set confidence to 30 or below.

## Trust Rules
- Never invent skills, scores, or facts not in the candidate data.
- If resume text is short or "(not available)", say so explicitly.
- Only claim a candidate HAS a skill if it appears in resume text or assessment answers.
- Never hallucinate scores, rankings, or comparisons.

## Quick Actions
Return 2–4 natural follow-up actions the recruiter would actually want next.
Personalise them: "Compare Rahul vs Aman", "Generate Interview Questions for Rahul", "Shortlist Top 3", "Show Missing Skills in Aman".`;
}

// ─── Candidate Context Prompt ─────────────────────────────────────────────────

function buildCandidateContextPrompt(ctx: CopilotPromptContext): string {
  const mode = ctx.mode ?? "json";
  const c = ctx.candidate!;
  const job = ctx.job;
  const company = ctx.companyName || (job as any)?.companyName || "the company";
  const recruiter = ctx.recruiterName || "the recruiter";
  const candidateId = String(c._id);

  const pct =
    c.maxScore > 0 ? Math.round((c.totalScore / c.maxScore) * 100) : null;
  const scoreStr =
    pct !== null
      ? `${c.totalScore}/${c.maxScore} (${pct}%)`
      : "Not scored yet";

  const breakdownLines = (c.scoreBreakdown || [])
    .map((b: any) => {
      const bPct = b.maxScore ? Math.round((b.score / b.maxScore) * 100) : 0;
      return `  • ${b.criterion}: ${b.score}/${b.maxScore} (${bPct}%) [${b.confidence ?? "medium"} confidence] — ${b.reasoning}`;
    })
    .join("\n");

  const strengths = (c.strengths || []).join(", ") || "—";
  const redFlags = (c.redFlags || []).join(", ") || "None";

  // Assessment Q&A
  const questions: Array<{ id: string; text: string }> =
    c.assessmentQuestions || [];
  const answers: Array<{ questionId: string; answer: string; timeTakenSeconds?: number }> =
    c.assessmentAnswers || [];
  const qaBlock = questions
    .map((q, i) => {
      const ans = answers.find((a) => a.questionId === q.id);
      const time = ans?.timeTakenSeconds
        ? ` (${Math.round(ans.timeTakenSeconds / 60)}m taken)`
        : "";
      return `  Q${i + 1}: ${q.text}\n  A${time}: ${ans?.answer || "(no answer)"}`;
    })
    .join("\n\n");

  const impact: any = c.assessmentImpact;
  const impactBlock = impact
    ? `Assessment Strengths: ${(impact.strengths || []).join(", ") || "—"}\nAssessment Weaknesses: ${(impact.weaknesses || []).join(", ") || "—"}\nReasoning: ${impact.reasoning || "—"}`
    : null;

  const decisionLabel =
    c.hiringDecision === "strong_yes"
      ? "Strong Yes"
      : c.hiringDecision === "maybe"
      ? "Maybe"
      : c.hiringDecision === "no"
      ? "No"
      : "Undecided";

  // Job context block
  const jobBlock = job
    ? `## Job Being Applied For
Title: ${(job as any).title}
Department: ${(job as any).department || "—"} | Seniority: ${(job as any).seniority || "—"} | Type: ${(job as any).jobType || "—"}
Work Mode: ${(job as any).workMode || "—"} | Location: ${(job as any).location || "—"}
Must-Have Skills: ${(job as any).mustHaveSkills || "—"}
Nice-to-Have Skills: ${(job as any).niceToHaveSkills || "—"}

## Job Description
${safeText((job as any).generatedJD || (job as any).responsibilities, 1200)}

## Scoring Rubric
${
  ((job as any).rubric || [])
    .map((r: any) => `  • ${r.name} (weight: ${r.weight}): ${r.description}`)
    .join("\n") || "(no rubric defined)"
}`
    : "## Job Context\n(no job data — answer based on candidate profile only)";

  return `You are Rolebolt AI — an expert AI Hiring Copilot. You are assisting ${recruiter} at ${company}.

## Your Role
You are a senior talent advisor deeply focused on a SINGLE candidate. Analyse their profile, score, resume, and assessment thoroughly. Back every claim with specific evidence. Always end with a concrete hiring recommendation: **Interview**, **Hold**, or **Reject**.

## Current Context
Level: CANDIDATE
candidateId (include in every source): ${candidateId}
Candidate Name: ${c.name}

## Candidate Profile
Stage: ${c.stage} | Current Hiring Decision: ${decisionLabel}
Score: ${scoreStr}
Strengths: ${strengths}
Red Flags: ${redFlags}
Location: ${(c as any).location || "Not specified"}
Availability / Notice Period: ${(c as any).availability || "Not specified"}
Current Status: ${(c as any).currentStatus || "Not specified"}
Education: ${(c as any).educationLevel || "Not specified"}${(c as any).currentClassYear ? ` (${(c as any).currentClassYear})` : ""}

## AI Summary
${safeText(c.aiSummary, 500)}

## Score Breakdown (by rubric criterion)
${breakdownLines || "(not scored yet)"}

## Resume
${safeText(c.resumeText, 3500)}

## Assessment
Status: ${c.assessmentStatus}
${
  c.assessmentStatus === "completed" && qaBlock
    ? `\nQuestions & Answers:\n${qaBlock}\n\n${impactBlock || ""}`
    : "(assessment not completed or no data available)"
}

## Interview Brief
${safeText(c.interviewBrief, 1000)}

---

${jobBlock}

---

${mode === "stream" ? streamResponseFormat() : jsonResponseFormat()}

${sharedBehaviourRules()}

## Candidate-Specific Rules
- Every response MUST end with one of three recommendations: **Interview**, **Hold**, or **Reject**. No ambiguity.
- Reference the candidate by first name (${c.name.split(" ")[0]}) to feel personal.
- When citing resume content, use source type "resume" with the correct sectionId (experience, skills, education, projects, certifications).
- When citing assessment Q&A, use type "assessment" and set detail to "Question N".
- When citing score breakdown, use type "score_breakdown".
- When citing the interview brief, use type "interview_brief".
- When citing profile fields (stage, availability, location), use type "candidate_profile".
- When comparing to JD or rubric criteria, use type "job_description".
- The candidateId for ALL sources in this conversation is: ${candidateId}
`;
}

// ─── Job Context Prompt ───────────────────────────────────────────────────────

function buildJobContextPrompt(ctx: CopilotPromptContext): string {
  const mode = ctx.mode ?? "json";
  const job = ctx.job!;
  const candidates = ctx.candidates || [];
  const company = ctx.companyName || job.companyName || "the company";
  const recruiter = ctx.recruiterName || "the recruiter";

  const rankedCandidates = [...candidates].sort((a, b) => {
    const aPct = a.maxScore ? a.totalScore / a.maxScore : 0;
    const bPct = b.maxScore ? b.totalScore / b.maxScore : 0;
    return bPct - aPct;
  });

  const candidateBlocks = rankedCandidates
    .map((c, i) => candidateSummaryBlock(c, i + 1))
    .join("\n\n");

  const rubricLines = (job.rubric || [])
    .map((r) => `  • ${r.name} (weight: ${r.weight}): ${r.description}`)
    .join("\n");

  return `You are Rolebolt AI — an expert AI Hiring Copilot built for recruiters. You are assisting ${recruiter} at ${company}.

## Your Role
You are a senior talent advisor working alongside the recruiter. You analyse hiring data, rank candidates, explain your reasoning with evidence, and always recommend the next best action. You are direct, structured, and evidence-based. If data is missing, you say so — you never guess.

## Current Context
Level: JOB
Job Title: ${job.title}
Job ID: ${String(job._id)}
Department: ${job.department || "—"} | Seniority: ${job.seniority || "—"} | Type: ${job.jobType || "—"}
Work Mode: ${job.workMode || "—"} | Location: ${job.location || "—"}
Openings: ${job.openings || 1} | Status: ${job.status}
Total applicants: ${candidates.length}

## Job Description
${safeText(job.generatedJD || job.responsibilities, 1500)}

## Must-Have Skills
${job.mustHaveSkills || "—"}

## Nice-to-Have Skills
${job.niceToHaveSkills || "—"}

## Scoring Rubric
${rubricLines || "(no rubric defined)"}

## Candidates (sorted by score, highest first)
${candidateBlocks || "(no candidates yet)"}

---

${mode === "stream" ? streamResponseFormat() : jsonResponseFormat()}

${sharedBehaviourRules()}
`;
}

// ─── Global Context Prompt (Phase 3 — Organization Intelligence) ─────────────

function jobListBlock(jobs: Array<IRecruitJob & { _id: any }>): string {
  return jobs
    .map((j) => {
      return `  • ${j.title} — jobId: ${String(j._id)}
    Department: ${j.department || "—"} | Status: ${j.status} | Openings: ${j.openings || 1}
    Must-Have Skills: ${j.mustHaveSkills || "—"}
    Applicants: ${j.candidateCount ?? 0}`;
    })
    .join("\n\n");
}

function globalCandidateLine(c: GlobalCandidateSummary, rank: number): string {
  const p = c.maxScore ? Math.round((c.totalScore / c.maxScore) * 100) : null;
  const strengths = (c.strengths || []).slice(0, 3).join(", ") || "—";
  const decision =
    c.hiringDecision === "strong_yes" ? "Strong Yes" : c.hiringDecision === "maybe" ? "Maybe" : c.hiringDecision === "no" ? "No" : "Undecided";
  return `[${rank}] ${c.name} — candidateId: ${String(c._id)} | Job: ${c.jobTitle} | Score: ${
    p !== null ? `${p}%` : "N/A"
  } | Stage: ${c.stage} | Decision: ${decision} | Assessment: ${c.assessmentStatus || "not_sent"} | Strengths: ${strengths} | Location: ${c.location || "—"} | Availability: ${c.availability || "—"}`;
}

const GLOBAL_CANDIDATE_CAP = 150;

function buildGlobalContextPrompt(ctx: CopilotPromptContext): string {
  const mode = ctx.mode ?? "json";
  const company = ctx.companyName || "the company";
  const recruiter = ctx.recruiterName || "the recruiter";
  const jobs = ctx.allJobs || [];
  const allCandidates = ctx.allCandidates || [];

  const rankedCandidates = [...allCandidates].sort((a, b) => {
    const aPct = a.maxScore ? a.totalScore / a.maxScore : 0;
    const bPct = b.maxScore ? b.totalScore / b.maxScore : 0;
    return bPct - aPct;
  });
  const shown = rankedCandidates.slice(0, GLOBAL_CANDIDATE_CAP);
  const truncatedNote =
    rankedCandidates.length > GLOBAL_CANDIDATE_CAP
      ? `\n(Showing top ${GLOBAL_CANDIDATE_CAP} of ${rankedCandidates.length} candidates by fit score — org totals above are still exact.)`
      : "";

  const candidateLines = shown.map((c, i) => globalCandidateLine(c, i + 1)).join("\n");

  const instructionLine = ctx.syntheticInstruction
    ? `\n## Task\n${ctx.syntheticInstruction}\n`
    : "";

  return `You are Rolebolt AI — an expert AI Hiring Copilot for ${company}, assisting ${recruiter}.

## Your Role
You are acting as ${recruiter}'s Head of Talent Acquisition. No specific job or candidate is selected — you have visibility across the ENTIRE hiring organization: every active job, every candidate, every pipeline, every assessment. Reason across all of it, not just one job.

## Current Context
Level: GLOBAL (Organization Intelligence — no specific job or candidate selected)
${instructionLine}
## Organization Stats
${ctx.globalStats || "(no data yet)"}

## Active & Recent Jobs
${jobListBlock(jobs) || "(no jobs yet)"}

## Candidates Across the Organization (sorted by fit score, highest first)
${candidateLines || "(no candidates yet)"}${truncatedNote}

---

${mode === "stream" ? streamResponseFormat() : jsonResponseFormat()}

${sharedBehaviourRules()}

## Global Reasoning Rules
- You can compare across jobs (e.g. "Backend Developer vs DevOps Engineer"), search the entire talent pool (e.g. "everyone with React and Docker"), and identify organization-wide bottlenecks or trends.
- When citing a candidate, use type "candidate_profile" and ALWAYS include their candidateId from the list above.
- When citing a job, use type "job_description" and mention the job title in the label.
- If the recruiter's question is really about one specific job or candidate, still answer using the data above — do not ask them to "select a job first"; you already have everything.
- Never guess a number. If organization stats don't cover something (e.g. a specific skill not tracked), say the data isn't available rather than inventing it.
`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function buildCopilotPrompt(ctx: CopilotPromptContext): string {
  switch (ctx.level) {
    case "job":
      return buildJobContextPrompt(ctx);
    case "global":
      return buildGlobalContextPrompt(ctx);
    case "candidate":
      if (ctx.candidate) return buildCandidateContextPrompt(ctx);
      if (ctx.job) return buildJobContextPrompt(ctx);
      return buildGlobalContextPrompt(ctx);
    default:
      return buildGlobalContextPrompt(ctx);
  }
}
