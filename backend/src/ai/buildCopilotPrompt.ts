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
import type { FormPipelineStat } from "./globalFormStats";

export type CopilotContextLevel =
  | "global"
  | "job"
  | "candidate"
  | "form_global"
  | "form"
  | "form_applicant";
export type CopilotPromptMode = "json" | "stream";

export interface GlobalCandidateSummary {
  _id: any;
  name: string;
  email?: string;
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

/** A Form Job applicant, projected into the shape the global prompt needs. */
export interface FormResponseSummary {
  _id: any;
  name: string;
  email?: string;
  formId: any;
  formTitle: string;
  aiScore: number;
  scoringFailed?: boolean;
  stage: string;
  strengths?: string[];
  redFlags?: string[];
  submittedAt?: Date;
  assessmentStatus?: string;
  assessmentScore?: number;
  assessmentScoringStatus?: string;
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
  /** Form Job workspace — org-wide form stats text */
  formGlobalStats?: string;
  formPipelines?: FormPipelineStat[];
  formResponses?: FormResponseSummary[];
  syntheticInstruction?: string;
  // Form context (single form or single applicant)
  form?: any;
  formDetailedResponses?: any[];
  formResponse?: any;
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
  Email: ${(c as any).email || "(not available)"}
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
      "jobId": "<MongoDB _id string of the job this candidate belongs to, or null>",
      "jobTitle": "<job title, or null>",
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
  return `## Candidate Email Display Rule — MANDATORY, NO EXCEPTIONS
Whenever you mention ANY candidate by name anywhere in your reply — in a list, a comparison, a ranking, a paragraph, a recommendation, anywhere — you MUST immediately display that candidate's email address on the next line, directly below their name, in this exact format:

**<Candidate Name>**
📧 <email>

If the email is not present in the data provided to you above, output exactly:
📧 Email not available

Rules:
- This applies in EVERY context — Global, Job, and Candidate — with no exceptions.
- If multiple candidates are mentioned (e.g. a shortlist or comparison), show the 📧 line for EACH candidate, immediately after each name.
- The email MUST be copied verbatim from the candidate data provided in this prompt. NEVER invent, guess, autocomplete, or infer an email address (e.g. never construct one from the candidate's name).
- Never mention a candidate's name without immediately showing their email (or "Email not available") — recruiters need this because multiple candidates can share the same name.

## Source Rules
- Every factual claim about a candidate MUST have a matching source entry.
- "resume" → claims from resume text. Set sectionId to "experience", "skills", "education", etc. when applicable.
- "score_breakdown" → claims from rubric scores.
- "assessment" → claims from assessment answers. Set detail to "Question N" when applicable.
- "interview_brief" → references to the generated interview brief.
- "candidate_profile" → stage, location, availability, other profile fields.
- "job_description" → references to the JD text or rubric criteria.
- If a candidateId is known, ALWAYS include it in the source — the frontend uses it for deep links.
- If the candidate's jobId/jobTitle is known (always true in Global context, where candidates span multiple jobs), ALWAYS include jobId and jobTitle in the source too — the frontend needs it to jump straight to the right job + candidate.
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
Candidate Email: ${(c as any).email || "(not available)"}

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
  return `[${rank}] ${c.name} — candidateId: ${String(c._id)} | Email: ${c.email || "(not available)"} | Job: ${c.jobTitle} | Score: ${
    p !== null ? `${p}%` : "N/A"
  } | Stage: ${c.stage} | Decision: ${decision} | Assessment: ${c.assessmentStatus || "not_sent"} | Strengths: ${strengths} | Location: ${c.location || "—"} | Availability: ${c.availability || "—"}`;
}

const GLOBAL_CANDIDATE_CAP = 150;
const GLOBAL_FORM_RESPONSE_CAP = 100;

function formResponseLine(r: FormResponseSummary, rank: number): string {
  const strengths = (r.strengths || []).slice(0, 3).join(", ") || "—";
  const redFlags = (r.redFlags || []).slice(0, 2).join(", ") || "None";
  const score = r.scoringFailed ? "not scored" : `${r.aiScore}%`;
  const assessmentPart = r.assessmentStatus && r.assessmentStatus !== "not_sent"
    ? ` | Assessment: ${r.assessmentStatus}${r.assessmentScore ? ` (${r.assessmentScore}%)` : ""}`
    : "";
  return `[F${rank}] ${r.name || "Applicant"} — responseId: ${String(r._id)} | Email: ${r.email || "(not available)"} | Form: ${r.formTitle} | Score: ${score} | Stage: ${r.stage}${assessmentPart} | Strengths: ${strengths} | Red flags: ${redFlags}`;
}

function formResponsesBlock(responses: FormResponseSummary[]): string {
  if (!responses.length) return "(no form applicants yet)";
  const ranked = [...responses].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
  const shown = ranked.slice(0, GLOBAL_FORM_RESPONSE_CAP);
  const note =
    ranked.length > GLOBAL_FORM_RESPONSE_CAP
      ? `\n(Showing top ${GLOBAL_FORM_RESPONSE_CAP} of ${ranked.length} form applicants by score.)`
      : "";
  return shown.map((r, i) => formResponseLine(r, i + 1)).join("\n") + note;
}

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
- This is the Standard Job workspace only — you do NOT have Form Job applicants here. If asked about application forms, tell the recruiter to switch to the Form Job workspace.
- Never guess a number. If organization stats don't cover something (e.g. a specific skill not tracked), say the data isn't available rather than inventing it.
`;
}

// ─── Form Context Prompt (single form deep analysis) ──────────────────────────

function buildFormContextPrompt(ctx: CopilotPromptContext): string {
  const mode = ctx.mode ?? "json";
  const company = ctx.companyName || "the company";
  const recruiter = ctx.recruiterName || "the recruiter";
  const form = ctx.form;
  const responses = ctx.formDetailedResponses || [];

  const formTitle = form?.title || "Unknown Form";
  const formDesc = form?.description || "";
  const questions = (form?.questions || []) as Array<{ label: string; type?: string }>;

  const stageBreakdown = (() => {
    const counts: Record<string, number> = {};
    for (const r of responses) counts[r.stage] = (counts[r.stage] || 0) + 1;
    return Object.entries(counts).map(([stage, count]) => `  • ${stage}: ${count}`).join("\n") || "  (none yet)";
  })();

  const scored = responses.filter((r: any) => !r.scoringFailed && r.aiScore > 0);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s: number, r: any) => s + r.aiScore, 0) / scored.length)
    : null;

  const assessmentSent = responses.filter((r: any) => r.assessmentStatus && r.assessmentStatus !== "not_sent").length;
  const assessmentCompleted = responses.filter((r: any) => r.assessmentStatus === "completed").length;
  const scoringFailed = responses.filter((r: any) => r.scoringFailed).length;

  const questionsBlock = questions.length
    ? questions.map((q, i) => `  Q${i + 1}: ${q.label}`).join("\n")
    : "  (no questions)";

  const responseLines = responses
    .slice(0, 60)
    .map((r: any, i: number) => {
      const score = r.scoringFailed ? "not scored" : `${r.aiScore}%`;
      const strengths = (r.strengths || []).slice(0, 3).join(", ") || "—";
      const redFlags = (r.redFlags || []).slice(0, 2).join(", ") || "None";
      const assessmentPart = r.assessmentStatus && r.assessmentStatus !== "not_sent"
        ? ` | Assessment: ${r.assessmentStatus}${r.assessmentScore ? ` (${r.assessmentScore}%)` : ""}`
        : "";
      const summaryLine = `[${i + 1}] ${r.submittedName || "Applicant"} — responseId: ${String(r._id)} | Email: ${r.submittedEmail || "(not available)"} | Score: ${score} | Stage: ${r.stage}${assessmentPart} | Strengths: ${strengths} | Red flags: ${redFlags}`;

      // Include a brief per-answer summary if answers exist
      const answers = (r.answers || []) as Array<{ label: string; value: string }>;
      const answerLines = answers
        .slice(0, 5)
        .map((a, qi) => `    Q${qi + 1} — ${a.label || "Question"}: ${(a.value || "").slice(0, 200)}`)
        .join("\n");
      return answerLines ? `${summaryLine}\n${answerLines}` : summaryLine;
    })
    .join("\n\n");

  const truncatedNote = responses.length > 60
    ? `\n(Showing ${60} of ${responses.length} applicants.)`
    : "";

  return `You are Rolebolt AI — an expert AI Hiring Copilot for ${company}, assisting ${recruiter}.

## Your Role
You are acting as ${recruiter}'s expert hiring analyst focused on a SINGLE application form. You have access to every applicant's profile, their written answers, AI scores, assessment results, and pipeline stage. Reason from the actual data — do not generalise beyond what you can see.

## Form Details
Title: ${formTitle}
${formDesc ? `Description: ${formDesc}` : ""}

## Form Questions
${questionsBlock}

## Pipeline Summary
Total applicants: ${responses.length}
Average AI score: ${avgScore !== null ? `${avgScore}%` : "N/A (none scored yet)"}
Scoring failed: ${scoringFailed}
Assessments sent: ${assessmentSent} | Completed: ${assessmentCompleted}

Stage breakdown:
${stageBreakdown}

## Applicants (sorted by score, highest first)
${responseLines || "(no applicants yet)"}${truncatedNote}

---

${mode === "stream" ? streamResponseFormat() : jsonResponseFormat()}

${sharedBehaviourRules()}

## Form Context Rules
- Always use responseId (not candidateId) when citing a Form applicant in sources. Use source type "candidate_profile" with the responseId in the candidateId field so the frontend can link correctly.
- AI scores (0–100) come from evaluating written answers. Assessment scores (0–100) come from a separate timed test — use both when available.
- scoringFailed = true means AI could not score the response; do NOT treat it as a low-quality applicant. Tell the recruiter to retry scoring.
- When suggesting stages, respect the form pipeline: new → scored → review_zone → shortlisted → assessment → interview → offer → hired / rejected / withdrawn.
- Never suggest sending an offer letter for Form applicants (not yet supported); recommend advancing to interview or noting as a top candidate instead.
- Focus recommendations on concrete next actions: shortlist X, reject Y, send assessment to Z, schedule interview with W.`;
}

// ─── Form Global Context (all forms — Form Job workspace only) ───────────────

function buildFormGlobalContextPrompt(ctx: CopilotPromptContext): string {
  const mode = ctx.mode ?? "json";
  const company = ctx.companyName || "the company";
  const recruiter = ctx.recruiterName || "the recruiter";
  const forms = (ctx.allJobs || []) as Array<{ _id: any; title: string; status?: string; responseCount?: number }>;
  const formResponses = ctx.formResponses || [];

  const instructionLine = ctx.syntheticInstruction
    ? `\n## Task\n${ctx.syntheticInstruction}\n`
    : "";

  const formList = forms.length
    ? forms.map((f, i) => `[F${i + 1}] ${f.title} — formId: ${String(f._id)} | Status: ${f.status || "active"} | Applicants: ${f.responseCount ?? 0}`).join("\n")
    : "(no forms yet)";

  return `You are Rolebolt AI — an expert AI Hiring Copilot for ${company}, assisting ${recruiter}.

## Your Role
You are in the **Form Job workspace** — application forms for creators and small businesses. You have visibility across EVERY form and EVERY applicant. You do NOT have Standard Job (resume/rubric) data here. Reason only from Form Job data below.

## Current Context
Level: FORM GLOBAL (all application forms — no specific form or applicant selected)
${instructionLine}
## Organization Stats (Form Jobs)
${ctx.formGlobalStats || ctx.globalStats || "(no data yet)"}

## Active Forms
${formList}

## Applicants Across All Forms (sorted by AI score, highest first)
${formResponsesBlock(formResponses)}

---

${mode === "stream" ? streamResponseFormat() : jsonResponseFormat()}

${sharedBehaviourRules()}

## Form Global Rules
- AI scores (0–100) come from evaluating written form answers — not comparable to Standard Job rubric scores.
- When citing an applicant, use type "form_response" with responseId in the candidateId field.
- When citing a form, use type "form_description" with formId in jobId field.
- Compare applicants within the same form when ranking; note when comparing across forms.
- Assessment scores are a second data point when assessmentStatus is "completed".
- Never reference Standard Job candidates — they are in a separate workspace.`;
}

// ─── Form Applicant Context (single applicant deep dive) ─────────────────────

function buildFormApplicantContextPrompt(ctx: CopilotPromptContext): string {
  const mode = ctx.mode ?? "json";
  const company = ctx.companyName || "the company";
  const recruiter = ctx.recruiterName || "the recruiter";
  const form = ctx.form;
  const r = ctx.formResponse;
  if (!r) return buildFormGlobalContextPrompt(ctx);

  const formTitle = form?.title || "Unknown Form";
  const score = r.scoringFailed ? "not scored" : `${r.aiScore ?? 0}%`;
  const answers = (r.answers || []) as Array<{ label: string; value: string }>;
  const answerBlock = answers
    .filter(a => a.value?.trim() && a.value !== "__file_uploaded__")
    .map((a, i) => `  Q${i + 1} — ${a.label}: ${(a.value || "").slice(0, 500)}`)
    .join("\n") || "  (no text answers)";

  const stageHistory = (r.stageHistory || [])
    .slice(-8)
    .map((h: any) => `  • ${h.fromStage || "start"} → ${h.toStage} (${h.actor}${h.reason ? `: ${h.reason}` : ""})`)
    .join("\n") || "  (none)";

  return `You are Rolebolt AI — an expert AI Hiring Copilot for ${company}, assisting ${recruiter}.

## Your Role
You are focused on ONE Form Job applicant in the **Form Job workspace**. Analyze their answers, AI score, assessment, and pipeline stage. Do not reference Standard Job data.

## Applicant Profile
Name: ${r.submittedName || "Applicant"}
Email: ${r.submittedEmail || "(not available)"}
responseId: ${String(r._id)}
Form: ${formTitle} (formId: ${String(form?._id || r.formId)})
AI Score: ${score}
Stage: ${r.stage || "new"}
AI Summary: ${safeText(r.aiSummary, 800)}
Strengths: ${(r.strengths || []).join(", ") || "—"}
Red flags: ${(r.redFlags || []).join(", ") || "None"}
Assessment: ${r.assessmentStatus || "not sent"}${r.assessmentScore ? ` (${r.assessmentScore}%)` : ""}
${r.assessmentSummary ? `Assessment summary: ${safeText(r.assessmentSummary, 400)}` : ""}

## Written Answers
${answerBlock}

## Stage History
${stageHistory}

---

${mode === "stream" ? streamResponseFormat() : jsonResponseFormat()}

${sharedBehaviourRules()}

## Form Applicant Rules
- Use type "form_response" with responseId ${String(r._id)} when citing this applicant.
- Recommend concrete next steps: shortlist, reject, send assessment, schedule interview.
- scoringFailed means retry scoring — not low quality.
- Pipeline: new → scored → review_zone → shortlisted → assessment → interview → offer → hired / rejected / withdrawn.`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function buildCopilotPrompt(ctx: CopilotPromptContext): string {
  switch (ctx.level) {
    case "job":
      return buildJobContextPrompt(ctx);
    case "global":
      return buildGlobalContextPrompt(ctx);
    case "form_global":
      return buildFormGlobalContextPrompt(ctx);
    case "form":
      if (ctx.form) return buildFormContextPrompt(ctx);
      return buildFormGlobalContextPrompt(ctx);
    case "form_applicant":
      if (ctx.formResponse) return buildFormApplicantContextPrompt(ctx);
      if (ctx.form) return buildFormContextPrompt(ctx);
      return buildFormGlobalContextPrompt(ctx);
    case "candidate":
      if (ctx.candidate) return buildCandidateContextPrompt(ctx);
      if (ctx.job) return buildJobContextPrompt(ctx);
      return buildGlobalContextPrompt(ctx);
    default:
      return buildGlobalContextPrompt(ctx);
  }
}
