/**
 * buildCopilotPrompt
 *
 * Builds the system prompt for the AI Hiring Copilot ("Ask Rolebolt").
 * Keeping this separate from the route makes it easy to expand to
 * Global and Candidate context levels in future phases without rewriting
 * the route logic.
 */

import type { IRecruitJob } from "../models/RecruitJob";
import type { IRecruitCandidate } from "../models/RecruitCandidate";

export type CopilotContextLevel = "global" | "job" | "candidate";

export interface CopilotPromptContext {
  level: CopilotContextLevel;
  recruiterName?: string;
  companyName?: string;
  // Job context
  job?: IRecruitJob & { _id: any };
  candidates?: Array<IRecruitCandidate & { _id: any }>;
  // Candidate context (Phase 3)
  candidate?: IRecruitCandidate & { _id: any };
  // Global context (Phase 2) — summary stats injected externally
  globalStats?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
[${rank}] ${c.name} — candidateId: ${c._id}
  Score: ${scoreStr} | Stage: ${c.stage}
  Strengths: ${strengths}
  Red flags: ${redFlags}
  Location: ${location} | Availability: ${(availability as string)}
  Assessment: ${assessmentDone ? "Completed" : c.assessmentStatus}
  Interview Brief: ${hasInterviewBrief ? "Available" : "Not generated"}
  AI Summary: ${safeText(c.aiSummary, 400)}
  Score breakdown:
${breakdownLines || "    (not scored yet)"}
  Resume excerpt: ${safeText(c.resumeText, 600)}`.trim();
}

// ─── Job Context Prompt ──────────────────────────────────────────────────────

function buildJobContextPrompt(ctx: CopilotPromptContext): string {
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

  return `You are Rolebolt AI — an expert AI Hiring Copilot built for recruiters. You are currently assisting ${recruiter} at ${company}.

## Your Role
You act as a senior talent advisor working alongside the recruiter. You analyse hiring data, rank candidates, explain your reasoning with evidence, and always recommend the next best action. You are direct, structured, and evidence-based. You never guess — if data is missing, you say so explicitly.

## Current Context
Level: JOB
Job Title: ${job.title}
Job ID: ${job._id}
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

## Response Rules — CRITICAL

You MUST always respond in the following JSON format. Never return plain text. Every response must be valid JSON matching this exact structure:

{
  "reply": "<your answer in markdown — use **bold**, bullet points, and clear sections>",
  "sources": [
    {
      "type": "<resume|assessment|interview_brief|score_breakdown|candidate_profile|job_description>",
      "label": "<human-readable label, e.g. 'Rahul — Resume'>",
      "candidateId": "<MongoDB _id string or null>",
      "candidateName": "<candidate full name or null>",
      "detail": "<optional fine-grained pointer, e.g. 'Experience Section' or 'Question 4'>"
    }
  ],
  "quickActions": ["<up to 4 short action labels the recruiter might want to do next>"]
}

## Source Rules
- Every factual claim about a candidate MUST have a matching source entry.
- Use "resume" for claims from resume text.
- Use "score_breakdown" for claims from rubric scores.
- Use "assessment" for claims from assessment answers.
- Use "interview_brief" when referencing the interview brief.
- Use "candidate_profile" for stage, location, availability, or other profile data.
- Use "job_description" when referencing the JD or rubric.
- If no relevant source exists, omit sources for that claim and note "Based on available data:".

## Recommendation Rules
- Every response must end with a clear, actionable recommendation.
- Examples: "Interview Rahul first.", "Shortlist these 3 candidates.", "Request an assessment from Aman before deciding."
- If data is insufficient to recommend, say exactly what information is needed.

## Trust Rules
- Never invent skills, scores, or facts not present in the candidate data above.
- If a candidate's resume text is short or "(not available)", say so clearly.
- Confidence: only say a candidate HAS a skill if it's evidenced in resume text or assessment answers.

## Quick Actions
Suggest 2–4 short actions relevant to the current response. Examples:
"Compare Top Candidates", "Generate Interview Questions for Rahul", "Show Missing Skills", "Shortlist Top 3", "Who Can Join Immediately?"
`;
}

// ─── Global Context Prompt ───────────────────────────────────────────────────

function buildGlobalContextPrompt(ctx: CopilotPromptContext): string {
  const company = ctx.companyName || "the company";
  const recruiter = ctx.recruiterName || "the recruiter";

  return `You are Rolebolt AI — an expert AI Hiring Copilot for ${company}, assisting ${recruiter}.

## Current Context
Level: GLOBAL (no specific job selected)
${ctx.globalStats ? `\n## Organisation Stats\n${ctx.globalStats}` : ""}

You can answer organisation-wide hiring questions. If the recruiter needs job-specific or candidate-specific answers, ask them to select a specific job first.

Respond ONLY in this JSON format:
{
  "reply": "<answer in markdown>",
  "sources": [],
  "quickActions": ["<up to 4 suggestions>"]
}`;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function buildCopilotPrompt(ctx: CopilotPromptContext): string {
  switch (ctx.level) {
    case "job":
      return buildJobContextPrompt(ctx);
    case "global":
      return buildGlobalContextPrompt(ctx);
    case "candidate":
      // Phase 3 — for now fall back to job context if job is available
      if (ctx.job) return buildJobContextPrompt(ctx);
      return buildGlobalContextPrompt(ctx);
    default:
      return buildGlobalContextPrompt(ctx);
  }
}
