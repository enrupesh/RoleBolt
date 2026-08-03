import express from "express";
import crypto from "crypto";
import multer from "multer";
import mongoose from "mongoose";
import { connectMongo } from "./db";
import { RecruitForm } from "./models/RecruitForm";
import { RecruitFormResponse } from "./models/RecruitFormResponse";
import { User } from "./models/User";
import { RecruitProfile } from "./models/RecruitProfile";
import { callMeshChatCompletions } from "./ai/meshClient";
import { sendEmail } from "./mailer";
import { NOTIFICATION_FROM } from "./emailConfig";

import * as emailTemplates from "./emailTemplates";
import {
  verifyRecaptcha,
  RECAPTCHA_REJECTION_MESSAGE,
  checkRateLimit,
} from "./publicSubmissionGuard";
import {
  assertFormBulkActionSize,
  assertFormFeature,
  assertFormResourceLimit,
  formBillingOwnerUid,
  formContentHash,
  formIdempotencyHeader,
  formIdempotencyKey,
  formRequestIdempotencyKey,
  isFormBillingError,
  respondFormBillingError,
  runFormBillingOperation,
} from "./billing/formEnforcement";

export const formRouter = express.Router();       // protected — /recruit/forms
export const formPublicRouter = express.Router(); // public    — /recruit-public/forms

// Re-export for tests / future bulk form actions
export { assertFormBulkActionSize };

const GEMINI_MESH_KEY = process.env.GEMINI_MESH_KEY ?? "";
const FORM_FRONTEND_URL = (
  process.env.FRONTEND_URL &&
  !process.env.FRONTEND_URL.includes("localhost") &&
  !process.env.FRONTEND_URL.includes("127.0.0.1")
    ? process.env.FRONTEND_URL
    : "https://www.rolebolt.tech"
).replace(/\/$/, "");

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
}

async function getCreatorOfficialEmail(ownerUid: string): Promise<string> {
  if (!ownerUid) return "";
  try {
    const user = await User.findById(ownerUid).select("email").lean();
    if (user?.email?.trim()) return user.email.trim();
  } catch { /* ignore */ }
  const profile = await RecruitProfile.findOne({ uid: ownerUid }).select("email").lean();
  return profile?.email?.trim() ?? "";
}

function formCompanyName(form: any): string {
  return String(form?.jobDetails?.companyName ?? "").trim();
}

async function formEmailContext(form: any): Promise<{ companyName: string; officialContactEmail: string }> {
  const companyName = formCompanyName(form);
  const officialContactEmail = await getCreatorOfficialEmail(String(form?.uid ?? ""));
  return { companyName, officialContactEmail };
}

type FormStageActor = "recruiter" | "agent" | "rule" | "system";

async function recordFormStageChange(args: {
  responseId: any;
  fromStage: string;
  toStage: string;
  actor: FormStageActor;
  reason?: string;
  actorUid?: string;
}): Promise<void> {
  if (args.fromStage === args.toStage) return;
  await RecruitFormResponse.updateOne(
    { _id: args.responseId },
    {
      $push: {
        stageHistory: {
          fromStage: args.fromStage,
          toStage: args.toStage,
          actor: args.actor,
          actorUid: args.actorUid || "",
          reason: args.reason || "",
          timestamp: new Date(),
        },
      },
    },
  );
}

function safeJson(raw: string): any {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampPct(value: unknown): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function generateFormAssessmentToken(): string {
  return `form_${crypto.randomBytes(32).toString("hex")}`;
}

async function generateFormAssessmentQuestions(args: {
  formTitle: string;
  description: string;
  questions: Array<{ id: string; label: string }>;
}): Promise<Array<{ id: string; text: string }>> {
  const sourceQuestions = args.questions
    .map(q => `${q.id}: ${q.label}`)
    .join("\n");
  const prompt = `You are a senior hiring manager creating a written follow-up assessment for "${args.formTitle}".
Application description:
${args.description || "(not provided)"}

The candidate already answered these screening questions:
${sourceQuestions || "(no screening questions)"}

Create exactly 5 concise, job-relevant written assessment questions. They should test depth,
judgment, practical thinking, and evidence beyond the initial screening answers.
Do not ask for sensitive personal data. Return ONLY JSON:
{"questions":[{"id":"assessment_1","text":"..."},{"id":"assessment_2","text":"..."}]}
Use ids assessment_1 through assessment_5.`;

  const raw = await callMeshChatCompletions({
    apiKey: GEMINI_MESH_KEY,
    model: "openai/gpt-4o-mini",
    fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
    messages: [{ role: "user", content: prompt }],
    temperature: 0.35,
    max_tokens: 2200,
    retries: 2,
    responseFormat: "json_object",
    nvidiaFallback: true,
  });
  const parsed = safeJson(raw);
  const questions = Array.isArray(parsed?.questions)
    ? parsed.questions
      .filter((q: any) => typeof q?.text === "string" && q.text.trim())
      .slice(0, 5)
      .map((q: any, index: number) => ({
        id: `assessment_${index + 1}`,
        text: String(q.text).trim().slice(0, 500),
      }))
    : [];
  if (questions.length < 3) throw new Error("AI returned too few assessment questions.");
  return questions;
}

async function scoreFormAssessment(args: {
  formTitle: string;
  formDescription: string;
  screeningScore: number;
  screeningSummary: string;
  questions: Array<{ id: string; text: string }>;
  answers: Array<{ questionId: string; answer: string; timeTakenSeconds: number }>;
}): Promise<{
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
}> {
  const answerText = args.questions.map((question, index) => {
    const answer = args.answers.find(item => item.questionId === question.id);
    return `Q${index + 1}. ${question.text}\nAnswer: ${answer?.answer || "(blank)"}`;
  }).join("\n\n");
  const prompt = `Evaluate a written hiring assessment for "${args.formTitle}".
Use only the candidate's answers below. Be calibrated and evidence-based; do not invent facts.
The initial screening score was ${clampPct(args.screeningScore)}% and its summary was:
${args.screeningSummary || "(no screening summary)"}

${answerText}

Return ONLY JSON:
{
  "score": 0,
  "summary": "2-4 sentence assessment summary",
  "strengths": ["specific evidence"],
  "weaknesses": ["specific gap or concern"]
}
Score 0-100 based on relevance, specificity, reasoning, and demonstrated capability.
Do not treat missing information as a definitive weakness; mention incomplete evidence instead.`;

  const raw = await callMeshChatCompletions({
    apiKey: GEMINI_MESH_KEY,
    model: "openai/gpt-4o-mini",
    fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 3000,
    retries: 2,
    responseFormat: "json_object",
    nvidiaFallback: true,
  });
  const parsed = safeJson(raw);
  if (!parsed || typeof parsed.summary !== "string" || !parsed.summary.trim()) {
    throw new Error("AI returned an invalid assessment score.");
  }
  return {
    score: clampPct(parsed.score),
    summary: parsed.summary.trim().slice(0, 1500),
    strengths: cleanSummaryList(parsed.strengths, 6),
    weaknesses: cleanSummaryList(parsed.weaknesses, 6),
  };
}

async function processFormAssessmentScore(responseId: any, runKey: string): Promise<void> {
  try {
    const [form, response] = await Promise.all([
      RecruitForm.findById((await RecruitFormResponse.findById(responseId).select("formId").lean())?.formId).lean(),
      RecruitFormResponse.findOne({ _id: responseId, assessmentRunKey: runKey }).lean(),
    ]);
    if (!form || !response || response.assessmentScoringStatus !== "pending") return;

    const ownerUid = formBillingOwnerUid(form);
    if (!ownerUid) {
      await RecruitFormResponse.updateOne(
        { _id: responseId, assessmentRunKey: runKey, assessmentScoringStatus: "pending" },
        { $set: { assessmentScoringStatus: "failed" } },
      );
      return;
    }

    let scored;
    try {
      scored = await runFormBillingOperation({
        ownerUid,
        operation: "assessment_score_form",
        idempotencyKey: formIdempotencyKey(ownerUid, [
          "assessment-score",
          String(responseId),
          runKey,
        ]),
        resourceType: "form_response",
        resourceId: String(responseId),
        work: async () => scoreFormAssessment({
          formTitle: form.title,
          formDescription: form.description,
          screeningScore: response.aiScore,
          screeningSummary: response.aiSummary,
          questions: response.assessmentQuestions,
          answers: response.assessmentAnswers,
        }),
      });
    } catch (billingErr) {
      if (isFormBillingError(billingErr)) {
        console.warn(
          "[forms] assessment scoring blocked by billing — response kept for manual review:",
          (billingErr as Error).message,
        );
        await RecruitFormResponse.updateOne(
          { _id: responseId, assessmentRunKey: runKey, assessmentScoringStatus: "pending" },
          { $set: { assessmentScoringStatus: "failed" } },
        );
        return;
      }
      throw billingErr;
    }

    const updated = await RecruitFormResponse.updateOne(
      { _id: responseId, assessmentRunKey: runKey, assessmentScoringStatus: "pending" },
      {
        $set: {
          assessmentScore: scored.score,
          assessmentSummary: scored.summary,
          assessmentStrengths: scored.strengths,
          assessmentWeaknesses: scored.weaknesses,
          assessmentScoringStatus: "completed",
        },
      },
    );
    if (updated.modifiedCount === 1) {
      const current = await RecruitFormResponse.findById(responseId).select("stage").lean();
      if (String((current as any)?.stage || "") === "assessment") {
        await moveFormResponseStage({
          responseId,
          fromStage: "assessment",
          toStage: "scored",
          actor: "system",
          reason: "Assessment scoring completed",
        });
      }
      await evaluateFormPipelineRules(String(form._id), String(responseId));
    }
  } catch (error) {
    console.error("[forms] async assessment scoring failed:", error);
    await RecruitFormResponse.updateOne(
      { _id: responseId, assessmentRunKey: runKey, assessmentScoringStatus: "pending" },
      { $set: { assessmentScoringStatus: "failed" } },
    ).catch(updateError => console.error("[forms] assessment failure update failed:", updateError));
  }
}

function generateSlug(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length))
    .map(b => chars[b % chars.length])
    .join("");
}

// ─── Resume file upload (memory only) ─────────────────────────────────────────
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, DOCX, or TXT files are allowed."));
  },
});

async function extractResumeText(file: Express.Multer.File): Promise<string> {
  const mime = file.mimetype;
  try {
    if (mime === "text/plain") {
      const text = file.buffer.toString("utf-8");
      return text.replace(/\0/g, "").replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, " ").replace(/[ \t]+/g, " ").trim();
    }
    if (mime === "application/pdf") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require("pdf-parse/lib/pdf-parse");
      const result = await pdfParse(file.buffer);
      const text = result.text || "";
      if (!text.trim()) return "__scanned_pdf__";
      return text.replace(/\0/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    }
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return (result.value || "").replace(/\0/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    }
  } catch {
    return "";
  }
  return "";
}

// ─── AI scoring for form responses ────────────────────────────────────────────
interface ScoredAnswer {
  questionId: string;
  label: string;
  value: string;
}

interface AnswerSignal {
  questionId: string;
  signal: "strong" | "ok" | "thin";
  note: string;
}

interface QuestionScore {
  questionId: string;
  score: number; // 0-10
  strengths: string[];
  weaknesses: string[];
  feedback: string;
}

async function scoreFormResponse(args: {
  formTitle: string;
  answers: ScoredAnswer[];
  resumeText?: string;
}): Promise<{
  aiScore: number;
  aiSummary: string;
  strengths: string[];
  redFlags: string[];
  answerSignals: AnswerSignal[];
  questionScores: QuestionScore[];
  scoringFailed: boolean;
}> {
  // Build a numbered list so the AI can reference answers by index
  const indexedAnswers = args.answers.filter(a => a.value && a.value.trim());
  const answersText = indexedAnswers
    .map((a, i) => `[${i + 1}] ${a.label}: ${a.value}`)
    .join("\n");

  const prompt = `You are screening a candidate who applied via a form for: "${args.formTitle}".

CANDIDATE FORM RESPONSES:
${answersText || "(no text answers provided)"}

${args.resumeText && args.resumeText !== "__scanned_pdf__" ? `CANDIDATE RESUME:\n${args.resumeText.slice(0, 3500)}` : ""}

Evaluate this candidate and respond with ONLY this JSON (no markdown):
{
  "aiScore": <integer 0-100 representing overall fit>,
  "aiSummary": "<2-3 sentence direct assessment — mention their strongest relevant point and one area of uncertainty>",
  "strengths": ["<specific overall strength 1>", "<specific overall strength 2>"],
  "redFlags": ["<only genuine concern — leave empty array if none>"],
  "answerSignals": [
    { "idx": 1, "signal": "strong", "note": "<one short phrase why — e.g. specific examples, deep expertise>" },
    { "idx": 2, "signal": "ok", "note": "<one short phrase>" },
    { "idx": 3, "signal": "thin", "note": "<one short phrase why — e.g. very brief, vague, no examples>" }
  ],
  "questionScores": [
    {
      "idx": 1,
      "score": <number 0-10>,
      "strengths": ["<specific strength in this answer>"],
      "weaknesses": ["<specific weakness or gap — omit if none>"],
      "feedback": "<1-2 sentence explanation of the score>",
    }
  ]
}

Scoring guide (overall aiScore):
- 80-100: Strong, clear fit with excellent answers
- 60-79: Good candidate, solid answers, minor gaps
- 40-59: Some relevant background, unclear fit
- Below 40: Significant mismatch or very thin responses

Answer signal guide (for each numbered answer above):
- "strong": detailed, specific, compelling — concrete examples or clear expertise shown
- "ok": adequate but generic — answers the question without standing out
- "thin": very brief, vague, off-topic, or missing entirely

Question score guide (score 0-10 per answer):
- 9-10: Exceptional — highly specific, compelling, demonstrates deep expertise or experience
- 7-8: Good — solid answer with relevant detail, minor gaps
- 5-6: Adequate — answers the question but generic or lacking depth
- 3-4: Weak — vague, very brief, or only partially on-topic
- 0-2: Poor — off-topic, missing, or a single-word answer

Confidence guide:
- "High": answer is detailed enough to evaluate confidently
- "Medium": answer gives some signal but is somewhat brief or ambiguous
- "Low": answer is very short, vague, or context is insufficient

Only include signals and questionScores for answers that were actually provided (match the [idx] numbers above). Skip contact-info-only answers (name, email, phone).
Be specific and honest. If answers are very short or empty, note that in the summary.`;

  let raw: string;
  try {
    raw = await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 3500,
      nvidiaFallback: true,
    });
  } catch (err) {
    console.error("[forms] scoreFormResponse: AI call failed:", err);
    return { aiScore: 0, aiSummary: "", strengths: [], redFlags: [], answerSignals: [], questionScores: [], scoringFailed: true };
  }

  const parsed = safeJson(raw);
  if (!parsed) {
    console.error("[forms] scoreFormResponse: unparseable AI response:", raw?.slice(0, 300));
    return { aiScore: 0, aiSummary: "", strengths: [], redFlags: [], answerSignals: [], questionScores: [], scoringFailed: true };
  }

  // Map AI's 1-based indices back to questionIds
  const answerSignals: AnswerSignal[] = [];
  if (Array.isArray(parsed.answerSignals)) {
    for (const s of parsed.answerSignals) {
      const idx = Number(s.idx);
      if (!idx || idx < 1 || idx > indexedAnswers.length) continue;
      const answer = indexedAnswers[idx - 1];
      if (!answer) continue;
      const sig = String(s.signal || "").toLowerCase();
      if (!["strong", "ok", "thin"].includes(sig)) continue;
      answerSignals.push({
        questionId: answer.questionId,
        signal: sig as "strong" | "ok" | "thin",
        note: String(s.note || "").trim().slice(0, 120),
      });
    }
  }

  // Map AI's 1-based questionScore indices back to questionIds
  const questionScores: QuestionScore[] = [];
  if (Array.isArray(parsed.questionScores)) {
    for (const qs of parsed.questionScores) {
      const idx = Number(qs.idx);
      if (!idx || idx < 1 || idx > indexedAnswers.length) continue;
      const answer = indexedAnswers[idx - 1];
      if (!answer) continue;
      questionScores.push({
        questionId: answer.questionId,
        score: Math.min(10, Math.max(0, Number(qs.score) || 0)),
        strengths: Array.isArray(qs.strengths) ? qs.strengths.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim()) : [],
        weaknesses: Array.isArray(qs.weaknesses) ? qs.weaknesses.filter((w: unknown) => typeof w === "string" && w.trim()).map((w: string) => w.trim()) : [],
        feedback: String(qs.feedback || "").trim().slice(0, 300),
      });
    }
  }

  return {
    aiScore: Math.min(100, Math.max(0, Number(parsed.aiScore) || 0)),
    aiSummary: String(parsed.aiSummary || "").trim(),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s: unknown) => typeof s === "string" && s.trim()) : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.filter((f: unknown) => typeof f === "string" && f.trim()) : [],
    answerSignals,
    questionScores,
    scoringFailed: false,
  };
}

// ─── AI rejection email generator ────────────────────────────────────────────

async function generateRejectionEmailText(args: {
  candidateName: string;
  formTitle: string;
  stage: string;
}): Promise<string> {
  const stageNote =
    args.stage === "shortlisted"
      ? "They had been shortlisted but unfortunately did not advance further."
      : args.stage === "interview"
      ? "They had reached the interview stage but we are moving forward with other candidates."
      : "We carefully reviewed their application.";

  const prompt = `Write a professional, empathetic rejection email body for a candidate named "${args.candidateName}" who applied via an application form for "${args.formTitle}". ${stageNote}

Rules:
- 3-4 sentences max, warm but professional tone
- Acknowledge their effort, explain we are moving forward with other candidates
- Encourage them to apply for future opportunities
- Do NOT include subject line, salutation (Hi X), or sign-off — just the body paragraphs
- Do NOT use placeholder text like [Company Name]

Return only the plain text email body.`;

  try {
    const raw = await callMeshChatCompletions({
      apiKey: GEMINI_MESH_KEY,
      model: "openai/gpt-4o-mini",
      retries: 2,
      fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
      nvidiaFallback: true,
    });
    return raw.trim();
  } catch {
    return `Thank you for taking the time to apply for the "${args.formTitle}" role. After careful consideration, we have decided to move forward with other candidates whose backgrounds more closely match our current needs.\n\nWe truly appreciate your interest and encourage you to apply for future openings that may be a great fit.`;
  }
}

// ─── AI Agent Mode ────────────────────────────────────────────────────────────

export type FormAgentAction = "shortlisted" | "rejected" | "review_zone";

interface FormAgentDecision {
  action: FormAgentAction;
  stage: "review_zone" | "shortlisted" | "rejected";
  reason: string;
}

/**
 * Decides what the agent should do with a freshly scored response.
 * Returns null when the agent is off or the score can't be trusted.
 */
export function decideFormAgentAction(
  agentMode: any,
  aiScore: number,
  scoringFailed: boolean,
): FormAgentDecision | null {
  if (agentMode?.enabled !== true || scoringFailed) return null;

  const shortlistThreshold = agentMode.shortlistThreshold ?? 75;
  const rejectThreshold    = agentMode.rejectThreshold    ?? 35;

  if (aiScore >= shortlistThreshold) {
    return {
      action: "shortlisted",
      stage: "shortlisted",
      reason: `Score ${aiScore}% ≥ shortlist threshold ${shortlistThreshold}%`,
    };
  }
  if (aiScore < rejectThreshold) {
    return {
      action: "rejected",
      stage: "rejected",
      reason: `Score ${aiScore}% < reject threshold ${rejectThreshold}%`,
    };
  }
  return {
    action: "review_zone",
    stage: "review_zone",
    reason: `Score ${aiScore}% is in review zone (${rejectThreshold}%–${shortlistThreshold}%)`,
  };
}

async function moveFormResponseStage(args: {
  responseId: any;
  fromStage: string;
  toStage: string;
  actor: FormStageActor;
  actorUid?: string;
  reason: string;
}): Promise<boolean> {
  if (args.fromStage === args.toStage) return false;
  const result = await RecruitFormResponse.updateOne(
    { _id: args.responseId, stage: args.fromStage },
    { $set: { stage: args.toStage, stageMovedAt: new Date() } },
  );
  if (result.modifiedCount !== 1) return false;
  await recordFormStageChange(args);
  return true;
}

async function markFormResponseScored(responseId: any): Promise<void> {
  await moveFormResponseStage({
    responseId,
    fromStage: "new",
    toStage: "scored",
    actor: "system",
    reason: "AI scoring completed",
  });
}

/**
 * Applies the agent decision: moves the response's stage, sends the configured
 * email, and appends an agentLog entry. Safe to call fire-and-forget.
 */
async function runFormAgent(args: {
  responseId: any;
  formTitle: string;
  ownerUid: string;
  companyName: string;
  agentMode: any;
  aiScore: number;
  scoringFailed: boolean;
  candidateName: string;
  candidateEmail: string;
}): Promise<void> {
  const decision = decideFormAgentAction(args.agentMode, args.aiScore, args.scoringFailed);
  if (!decision) return;

  // Claim this action before any stage mutation or email send. This makes
  // background scoring/retry calls idempotent even when they overlap.
  const runKey = `agent:${decision.action}`;
  const claim = await RecruitFormResponse.updateOne(
    { _id: args.responseId, agentRunKeys: { $ne: runKey } },
    { $addToSet: { agentRunKeys: runKey } },
  );
  if (claim.modifiedCount !== 1) {
    console.log(`[forms][agent] skipped duplicate action ${runKey} for ${args.responseId}`);
    return;
  }

  const name = args.candidateName || "Applicant";
  const email = args.candidateEmail?.trim() || "";

  const current = await RecruitFormResponse.findById(args.responseId).select("stage").lean();
  const fromStage = String((current as any)?.stage || "new");
  await moveFormResponseStage({
    responseId: args.responseId,
    fromStage,
    toStage: decision.stage,
    actor: "agent",
    reason: decision.reason,
  });

  let emailSent = false;
  let emailStatus: "sent" | "failed" | "skipped" | "disabled" = "disabled";

  const wantsEmail =
    (decision.action === "shortlisted" && args.agentMode.autoEmailShortlist !== false) ||
    (decision.action === "rejected"    && args.agentMode.autoEmailReject === true) ||
    (decision.action === "review_zone" && args.agentMode.emailReviewZoneCandidates === true);

  if (wantsEmail && !email) emailStatus = "skipped"; // nothing to send to

  if (wantsEmail && email) {
    const officialContactEmail = await getCreatorOfficialEmail(args.ownerUid);
    const ctx = { officialContactEmail };
    const co = args.companyName;
    let tpl: emailTemplates.EmailPayload;
    if (decision.action === "shortlisted") {
      tpl = emailTemplates.screened(name, args.formTitle, co, ctx);
    } else if (decision.action === "rejected") {
      const body = `Hi ${name.split(" ")[0]},\n\nThank you for taking the time to complete our "${args.formTitle}" application. After reviewing your responses, we've decided to move forward with other applicants at this time.\n\nWe appreciate your interest and wish you the best in your search.\n\nWarm regards,\nThe Hiring Team`;
      tpl = emailTemplates.rejectionEmailHtml(name, args.formTitle, co, body, ctx);
    } else {
      tpl = emailTemplates.reviewZoneEmail(name, args.formTitle, co, ctx);
    }

    try {
      await runFormBillingOperation({
        ownerUid: args.ownerUid,
        operation: "automated_email_form",
        idempotencyKey: formIdempotencyKey(args.ownerUid, [
          "agent-email",
          String(args.responseId),
          decision.action,
        ]),
        resourceType: "form_response",
        resourceId: String(args.responseId),
        work: async () => {
          const result = await sendEmail({
            to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, from: NOTIFICATION_FROM,
          });
          emailSent = result.ok;
          emailStatus = result.ok ? "sent" : "failed";
          await RecruitFormResponse.updateOne({ _id: args.responseId }, {
            $push: {
              emailLog: {
                type: `agent_${decision.action}`, to: email, subject: tpl.subject, body: tpl.text,
                sentAt: new Date(), status: emailStatus, error: result.error,
              },
            },
          });
          return result;
        },
      });
    } catch (e) {
      if (isFormBillingError(e)) {
        console.warn("[forms][agent] automated email blocked by billing:", (e as Error).message);
        emailStatus = "skipped";
      } else {
        console.error("[forms][agent] email dispatch failed:", e);
        emailStatus = "failed";
      }
    }
  }

  await RecruitFormResponse.updateOne({ _id: args.responseId }, {
    $push: {
      agentLog: {
        action: decision.action,
        score: args.aiScore,
        reason: decision.reason,
        emailSent,
        emailStatus,
        runKey,
        timestamp: new Date(),
      },
    },
  });

  console.log(`[forms][agent] ${decision.action}: ${name} — ${decision.reason} (email ${emailStatus})`);
}

// ─── Pipeline Rules ───────────────────────────────────────────────────────────

const FORM_RULE_STAGE_MAP: Record<string, string> = {
  move_to_scored:       "scored",
  move_to_review_zone:  "review_zone",
  move_to_shortlisted: "shortlisted",
  move_to_assessment:   "assessment",
  move_to_interview:   "interview",
  move_to_offer:        "offer",
  move_to_hired:        "hired",
  move_to_withdrawn:    "withdrawn",
  move_to_rejected:    "rejected",
};

function parseOptionalNumber(value: unknown, min = 0): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : undefined;
}

function normalizeFormJobDetails(raw: any): Record<string, any> {
  const details = raw && typeof raw === "object" ? raw : {};
  const workMode = ["remote", "onsite", "hybrid"].includes(String(details.workMode))
    ? String(details.workMode)
    : "remote";
  const normalized: Record<string, any> = {
    companyName: String(details.companyName || "").trim().slice(0, 160),
    jobType: String(details.jobType || "").trim().slice(0, 80),
    department: String(details.department || "").trim().slice(0, 120),
    seniority: String(details.seniority || "").trim().slice(0, 80),
    location: String(details.location || "").trim().slice(0, 160),
    workMode,
    salaryCurrency: String(details.salaryCurrency || "INR").trim().slice(0, 8).toUpperCase(),
  };
  const numericFields: [string, number][] = [
    ["salaryMin", 0], ["salaryMax", 0], ["experienceMin", 0], ["experienceMax", 0], ["openings", 1],
  ];
  for (const [key, min] of numericFields) {
    const value = parseOptionalNumber(details[key], min);
    if (value !== undefined) normalized[key] = value;
  }
  if (details.applicationDeadline) {
    const date = new Date(String(details.applicationDeadline));
    if (!Number.isNaN(date.getTime())) normalized.applicationDeadline = date;
  }
  return normalized;
}

/**
 * Evaluates a form's pipeline rules against one response. Call non-blocking —
 * a rule failure must never affect the recruiter's request.
 */
async function evaluateFormPipelineRules(formId: string, responseId: string): Promise<void> {
  try {
    const [form, response] = await Promise.all([
      RecruitForm.findById(formId).lean(),
      RecruitFormResponse.findById(responseId).lean(),
    ]);
    if (!form || !response) return;

    const ownerUid = formBillingOwnerUid(form);
    if (!ownerUid) return;

    const rules: any[] = ((form as any).pipelineRules ?? []).filter((r: any) => r.enabled);
    if (!rules.length) return;

    const score = (response as any).assessmentScoringStatus === "completed"
      ? clampPct((response as any).assessmentScore)
      : clampPct((response as any).aiScore);
    const movedAt = (response as any).stageMovedAt ?? (response as any).createdAt;
    const daysInStage = movedAt ? (Date.now() - new Date(movedAt).getTime()) / 86400000 : 0;

    // Track the stage locally so a second rule sees the result of the first.
    let currentStage: string = (response as any).stage;

    for (const rule of rules) {
      if (rule.fromStage && currentStage !== rule.fromStage) continue;

      let conditionMet = false;
      if (rule.condition === "score_above"    && score >= rule.threshold)       conditionMet = true;
      if (rule.condition === "score_below"    && score <  rule.threshold)       conditionMet = true;
      if (rule.condition === "stage_age_days" && daysInStage >= rule.threshold) conditionMet = true;
      if (!conditionMet) continue;

      const nextStage = FORM_RULE_STAGE_MAP[rule.action];
      if (!nextStage || nextStage === currentStage) continue;

      const fromStage = currentStage;
      try {
        await runFormBillingOperation({
          ownerUid,
          operation: "pipeline_rule_execution_form",
          idempotencyKey: formIdempotencyKey(ownerUid, [
            "pipeline-rule",
            String(responseId),
            String(rule.id),
            fromStage,
            nextStage,
          ]),
          resourceType: "form_response",
          resourceId: String(responseId),
          metadata: { ruleId: rule.id, action: rule.action, condition: rule.condition },
          work: async () => {
            await RecruitFormResponse.updateOne(
              { _id: responseId },
              { $set: { stage: nextStage, stageMovedAt: new Date() } },
            );
            await recordFormStageChange({
              responseId,
              fromStage,
              toStage: nextStage,
              actor: "rule",
              reason: `${rule.condition} → ${rule.action}`,
            });
            await RecruitForm.updateOne(
              { _id: formId, "pipelineRules.id": rule.id },
              { $inc: { "pipelineRules.$.triggerCount": 1 } },
            );
            return true;
          },
        });
        currentStage = nextStage;
        console.log(`[forms][pipeline-rule] "${rule.id}" fired: ${rule.condition} → ${rule.action} for response ${responseId}`);
      } catch (e) {
        if (isFormBillingError(e)) {
          console.warn(
            `[forms][pipeline-rule] "${rule.id}" blocked by billing:`,
            (e as Error).message,
          );
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    console.error("[forms][pipeline-rule] evaluation failed:", e);
  }
}

// ─── Protected routes (/recruit/forms) ────────────────────────────────────────

// POST /recruit/forms — create a form
formRouter.post("/", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, questions, jobDetails } = req.body as {
      title?: string;
      description?: string;
      questions?: any[];
      jobDetails?: any;
    };

    if (!title?.trim()) return res.status(400).json({ error: "Form title is required." });

    await assertFormResourceLimit(uid, "active_forms");
    await assertFormResourceLimit(uid, "stored_forms");

    // Generate unique slug
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await RecruitForm.findOne({ slug });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const form = await RecruitForm.create({
      uid,
      title: title.trim(),
      description: (description || "").trim(),
      slug,
      jobDetails: normalizeFormJobDetails(jobDetails),
      questions: (questions || []).map((q: any, idx: number) => ({
        id: q.id || `q_${idx}_${Date.now()}`,
        label: String(q.label || "").trim(),
        type: q.type || "short",
        required: Boolean(q.required),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        placeholder: String(q.placeholder || ""),
      })),
      status: "active",
    });

    return res.status(201).json({ form });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST /recruit/forms:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /recruit/forms — list all forms for the recruiter
formRouter.get("/", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const forms = await RecruitForm.find({ uid }).sort({ createdAt: -1 }).lean();
    return res.json({ forms });
  } catch (err: any) {
    console.error("[forms] GET /recruit/forms:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /recruit/forms/:formId — get one form (with questions)
async function getOwnedForm(formId: string, uid: string) {
  if (!mongoose.isValidObjectId(formId)) return null;
  return RecruitForm.findOne({ _id: formId, uid }).lean();
}

function cleanSummaryList(value: unknown, limit = 6): string[] {
  return Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map(item => item.trim().slice(0, 300))
      .slice(0, limit)
    : [];
}

// GET /recruit/forms/:formId/ai-summary — return the last saved AI summary
formRouter.get("/:formId/ai-summary", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const form = await getOwnedForm(req.params.formId, uid);
    if (!form) return res.status(404).json({ error: "Form not found." });
    return res.json({ summary: (form as any).aiHiringSummary ?? null });
  } catch (err: any) {
    console.error("[forms] GET /ai-summary:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recruit/forms/:formId/ai-summary/refresh — generate and persist AI hiring insights
formRouter.post("/:formId/ai-summary/refresh", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const form = await getOwnedForm(req.params.formId, uid);
    if (!form) return res.status(404).json({ error: "Form not found." });

    const responses = await RecruitFormResponse.find({ formId: form._id, uid })
      .select("submittedName aiScore scoringFailed stage aiSummary strengths redFlags questionScores answerSignals createdAt")
      .sort({ aiScore: -1, createdAt: -1 })
      .lean();
    const rows = responses as any[];
    const scored = rows.filter(r => !r.scoringFailed && (r.aiSummary || r.questionScores?.length || Number(r.aiScore) > 0));
    const averageScore = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + clampPct(r.aiScore), 0) / scored.length)
      : 0;
    const stageCounts = rows.reduce<Record<string, number>>((counts, row) => {
      const stage = String(row.stage || "new");
      counts[stage] = (counts[stage] || 0) + 1;
      return counts;
    }, {});
    const questionMap = new Map<string, { label: string; answered: number; strong: number; thin: number; scoreTotal: number; scoreCount: number }>();
    for (const row of rows) {
      for (const score of row.questionScores ?? []) {
        const item = questionMap.get(String(score.questionId)) ?? { label: String(score.questionId), answered: 0, strong: 0, thin: 0, scoreTotal: 0, scoreCount: 0 };
        item.answered += 1;
        item.scoreTotal += Number(score.score) || 0;
        item.scoreCount += 1;
        questionMap.set(String(score.questionId), item);
      }
      for (const signal of row.answerSignals ?? []) {
        const item = questionMap.get(String(signal.questionId)) ?? { label: String(signal.questionId), answered: 0, strong: 0, thin: 0, scoreTotal: 0, scoreCount: 0 };
        if (signal.signal === "strong") item.strong += 1;
        if (signal.signal === "thin") item.thin += 1;
        questionMap.set(String(signal.questionId), item);
      }
    }
    const questionInsights = Array.from(questionMap.entries()).map(([questionId, item]) => ({
      questionId,
      averageScore: item.scoreCount ? Math.round((item.scoreTotal / item.scoreCount) * 10) / 10 : 0,
      strongRate: item.answered ? Math.round((item.strong / item.answered) * 100) : 0,
      thinRate: item.answered ? Math.round((item.thin / item.answered) * 100) : 0,
    }));
    const evidence = {
      formTitle: form.title,
      totalResponses: rows.length,
      scoredResponses: scored.length,
      scoringFailures: rows.filter(r => r.scoringFailed).length,
      averageScore,
      stageCounts,
      questionInsights,
      topCandidates: scored.slice(0, 5).map(r => ({
        responseId: String(r._id),
        name: r.submittedName || "Candidate",
        score: clampPct(r.aiScore),
        stage: r.stage || "new",
        summary: String(r.aiSummary || "").slice(0, 500),
        strengths: cleanSummaryList(r.strengths, 3),
        redFlags: cleanSummaryList(r.redFlags, 3),
      })),
    };

    const prompt = `You are an evidence-based hiring operations analyst for a custom application form titled "${form.title}".
Use ONLY the supplied metrics and candidate evidence. Do not invent counts, names, scores, or facts.
Return ONLY valid JSON:
{
  "summary": "2-4 sentence hiring funnel summary",
  "strengths": ["evidence-based pattern"],
  "risks": ["evidence-based risk or limitation"],
  "recommendations": ["specific next action for the recruiter"],
  "highSignalQuestions": ["question id with why it is high signal"],
  "lowSignalQuestions": ["question id with why it may be low signal"],
  "priorityCandidates": [{"responseId": "exact id from topCandidates", "reason": "specific evidence"}]
}
If there are fewer than 3 scored responses, explicitly say the sample is small and keep recommendations cautious.

DATA:
${JSON.stringify(evidence)}`;

    const raw = await runFormBillingOperation({
      ownerUid: uid,
      operation: "form_hiring_summary",
      idempotencyKey: formRequestIdempotencyKey(
        uid,
        `hiring-summary:${form._id}`,
        formIdempotencyHeader(req),
      ),
      resourceType: "form",
      resourceId: String(form._id),
      work: async () => callMeshChatCompletions({
        apiKey: GEMINI_MESH_KEY,
        model: "openai/gpt-4o-mini",
        retries: 2,
        fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 2200,
        nvidiaFallback: true,
      }),
    });
    const parsed = safeJson(raw);
    if (!parsed || typeof parsed.summary !== "string" || !parsed.summary.trim()) {
      throw new Error("AI returned an invalid hiring summary.");
    }

    const validIds = new Set(evidence.topCandidates.map(candidate => candidate.responseId));
    const priorityCandidates = Array.isArray(parsed.priorityCandidates)
      ? parsed.priorityCandidates
        .filter((item: any) => validIds.has(String(item?.responseId)))
        .map((item: any) => ({ responseId: String(item.responseId), reason: String(item.reason || "").trim().slice(0, 300) }))
        .slice(0, 5)
      : [];
    const summary = {
      generatedAt: new Date(),
      summary: parsed.summary.trim().slice(0, 1500),
      strengths: cleanSummaryList(parsed.strengths),
      risks: cleanSummaryList(parsed.risks),
      recommendations: cleanSummaryList(parsed.recommendations),
      highSignalQuestions: cleanSummaryList(parsed.highSignalQuestions),
      lowSignalQuestions: cleanSummaryList(parsed.lowSignalQuestions),
      priorityCandidates,
    };
    const updated = await RecruitForm.findOneAndUpdate(
      { _id: form._id, uid },
      { $set: { aiHiringSummary: summary } },
      { returnDocument: "after" },
    ).lean();
    return res.json({ summary: (updated as any)?.aiHiringSummary ?? summary });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST /ai-summary/refresh:", err);
    const uid = getUid(req);
    const existing = uid ? await getOwnedForm(req.params.formId, uid).catch(() => null) : null;
    if ((existing as any)?.aiHiringSummary) {
      return res.status(503).json({
        error: "AI refresh failed. Showing the last saved summary.",
        summary: (existing as any).aiHiringSummary,
      });
    }
    return res.status(500).json({ error: "AI hiring summary is temporarily unavailable." });
  }
});

formRouter.get("/:formId", async (req, res, next) => {
  if (req.params.formId === "analysis") return next();
  if (req.params.formId === "ai-summary") return next();
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    return res.json({ form });
  } catch (err: any) {
    console.error("[forms] GET /recruit/forms/:formId:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /recruit/forms/:formId/analysis — server-side Form Job analytics
formRouter.get("/:formId/analysis", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    if (!mongoose.isValidObjectId(req.params.formId)) {
      return res.status(400).json({ error: "Invalid form id." });
    }

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid })
      .select("questions responseCount")
      .lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const responseRows = await RecruitFormResponse.find({
      formId: req.params.formId,
      uid,
    })
      .select("stage aiScore aiSummary scoringFailed createdAt stageMovedAt source agentLog answers answerSignals questionScores")
      .lean();

    const rows = responseRows as any[];
    const total = rows.length;
    const failed = rows.filter(r => r.scoringFailed === true).length;
    const pending = rows.filter(r => !r.scoringFailed && !r.aiSummary && !r.questionScores?.length).length;
    const scoredRows = rows.filter(r => !r.scoringFailed && (r.aiSummary || r.questionScores?.length || Number(r.aiScore) > 0));
    const scores = scoredRows.map(r => clampPct(r.aiScore)).sort((a, b) => a - b);
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;
    const medianScore = scores.length
      ? scores.length % 2 === 1
        ? scores[Math.floor(scores.length / 2)]
        : Math.round((scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2)
      : 0;

    const stageOrder = ["new", "shortlisted", "interview", "hired", "rejected"];
    const stages = stageOrder.map(stage => ({
      stage,
      count: rows.filter(r => (r.stage || "new") === stage).length,
    }));
    const scoreDistribution = [
      { label: "0–39", min: 0, max: 39, count: scores.filter(s => s < 40).length },
      { label: "40–59", min: 40, max: 59, count: scores.filter(s => s >= 40 && s < 60).length },
      { label: "60–79", min: 60, max: 79, count: scores.filter(s => s >= 60 && s < 80).length },
      { label: "80–100", min: 80, max: 100, count: scores.filter(s => s >= 80).length },
    ];

    const sourceMap = new Map<string, { source: string; applications: number; scored: number; scoreTotal: number }>();
    for (const row of rows) {
      const source = String(row.source || "Form");
      const item = sourceMap.get(source) ?? { source, applications: 0, scored: 0, scoreTotal: 0 };
      item.applications += 1;
      if (!row.scoringFailed && (row.aiSummary || row.questionScores?.length || Number(row.aiScore) > 0)) {
        item.scored += 1;
        item.scoreTotal += clampPct(row.aiScore);
      }
      sourceMap.set(source, item);
    }
    const sources = Array.from(sourceMap.values())
      .map(item => ({
        source: item.source,
        applications: item.applications,
        averageScore: item.scored ? Math.round(item.scoreTotal / item.scored) : null,
      }))
      .sort((a, b) => b.applications - a.applications);

    const timelineMap = new Map<string, { date: string; applications: number; scored: number; scoreTotal: number }>();
    for (const row of rows) {
      const date = row.createdAt
        ? new Date(row.createdAt).toISOString().slice(0, 10)
        : "unknown";
      const item = timelineMap.get(date) ?? { date, applications: 0, scored: 0, scoreTotal: 0 };
      item.applications += 1;
      if (!row.scoringFailed && (row.aiSummary || row.questionScores?.length || Number(row.aiScore) > 0)) {
        item.scored += 1;
        item.scoreTotal += clampPct(row.aiScore);
      }
      timelineMap.set(date, item);
    }
    const timeline = Array.from(timelineMap.values())
      .map(item => ({
        date: item.date,
        applications: item.applications,
        averageScore: item.scored ? Math.round(item.scoreTotal / item.scored) : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const agentActions = { shortlisted: 0, rejected: 0, review_zone: 0, emailsSent: 0, failed: 0 };
    for (const row of rows) {
      for (const entry of row.agentLog ?? []) {
        if (entry.action === "shortlisted") agentActions.shortlisted += 1;
        if (entry.action === "rejected") agentActions.rejected += 1;
        if (entry.action === "review_zone") agentActions.review_zone += 1;
        if (entry.emailSent) agentActions.emailsSent += 1;
        if (entry.emailStatus === "failed") agentActions.failed += 1;
      }
    }

    const questionMap = new Map<string, {
      questionId: string;
      label: string;
      answered: number;
      strong: number;
      thin: number;
      scoreTotal: number;
      scoreCount: number;
    }>();
    const questionLabels = new Map<string, string>(
      ((form as any).questions ?? []).map((q: any) => [q.id, q.label])
    );
    for (const row of rows) {
      for (const answer of row.answers ?? []) {
        const value = String(answer.value ?? "").trim();
        if (!value || value === "__file_uploaded__") continue;
        const questionId = String(answer.questionId);
        const item = questionMap.get(questionId) ?? {
          questionId,
          label: questionLabels.get(questionId) || String(answer.label || "Question"),
          answered: 0,
          strong: 0,
          thin: 0,
          scoreTotal: 0,
          scoreCount: 0,
        };
        item.answered += 1;
        questionMap.set(questionId, item);
      }
      for (const signal of row.answerSignals ?? []) {
        const item = questionMap.get(String(signal.questionId));
        if (!item) continue;
        if (signal.signal === "strong") item.strong += 1;
        if (signal.signal === "thin") item.thin += 1;
      }
      for (const score of row.questionScores ?? []) {
        const item = questionMap.get(String(score.questionId));
        if (!item) continue;
        item.scoreTotal += Math.min(10, Math.max(0, Number(score.score) || 0));
        item.scoreCount += 1;
      }
    }
    const questionPerformance = Array.from(questionMap.values())
      .map(item => ({
        questionId: item.questionId,
        label: item.label,
        answered: item.answered,
        strongSignals: item.strong,
        thinSignals: item.thin,
        averageScore: item.scoreCount ? Math.round((item.scoreTotal / item.scoreCount) * 10) / 10 : null,
        signalRate: item.answered ? Math.round((item.strong / item.answered) * 100) : 0,
      }))
      .sort((a, b) => b.answered - a.answered);

    const now = Date.now();
    const stageAging = stageOrder
      .map(stage => {
        const activeRows = rows.filter(r => (r.stage || "new") === stage && r.stageMovedAt);
        const averageDays = activeRows.length
          ? Math.round((activeRows.reduce((sum, r) => sum + Math.max(0, now - new Date(r.stageMovedAt).getTime()), 0) / activeRows.length / 86400000) * 10) / 10
          : 0;
        return { stage, candidates: activeRows.length, averageDays };
      })
      .filter(item => item.candidates > 0);

    return res.json({
      analysis: {
        generatedAt: new Date().toISOString(),
        overview: {
          total,
          scored: scoredRows.length,
          pending,
          failed,
          averageScore,
          medianScore,
          shortlistRate: total ? Math.round((rows.filter(r => r.stage === "shortlisted").length / total) * 100) : 0,
          interviewRate: total ? Math.round((rows.filter(r => r.stage === "interview").length / total) * 100) : 0,
          hireRate: total ? Math.round((rows.filter(r => r.stage === "hired").length / total) * 100) : 0,
        },
        funnel: stages,
        scoreDistribution,
        timeline,
        sources,
        agentActions,
        questionPerformance,
        stageAging,
      },
    });
  } catch (err: any) {
    console.error("[forms] GET /recruit/forms/:formId/analysis:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /recruit/forms/:formId/assessment-analytics
formRouter.get("/:formId/assessment-analytics", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).select("title").lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const responses = await RecruitFormResponse.find({ formId: req.params.formId, uid })
      .select("stage assessmentStatus assessmentScoringStatus assessmentScore assessmentQuestions assessmentAnswers assessmentSentAt assessmentStartedAt assessmentCompletedAt")
      .lean();
    const rows = responses as any[];
    const sent = rows.filter(row => row.assessmentStatus && row.assessmentStatus !== "not_sent").length;
    const started = rows.filter(row => ["in_progress", "completed"].includes(row.assessmentStatus)).length;
    const completed = rows.filter(row => row.assessmentStatus === "completed").length;
    const scored = rows.filter(row => row.assessmentScoringStatus === "completed");
    const scoringPending = rows.filter(row => row.assessmentStatus === "completed" && row.assessmentScoringStatus === "pending").length;
    const scoringFailed = rows.filter(row => row.assessmentScoringStatus === "failed").length;
    const passThreshold = 70;
    const passed = scored.filter(row => clampPct(row.assessmentScore) >= passThreshold).length;
    const durations = rows
      .filter(row => row.assessmentStartedAt && row.assessmentCompletedAt)
      .map(row => Math.max(0, new Date(row.assessmentCompletedAt).getTime() - new Date(row.assessmentStartedAt).getTime()) / 60000);
    const averageCompletionMinutes = durations.length
      ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10
      : null;

    const questionMap = new Map<string, {
      questionId: string;
      text: string;
      shown: number;
      answered: number;
      timeTotal: number;
      timeCount: number;
    }>();
    for (const row of rows) {
      const answerMap = new Map<string, {
        questionId: string;
        answer: string;
        timeTakenSeconds: number;
      }>((row.assessmentAnswers || []).map((answer: any) => [String(answer.questionId), answer]));
      for (const question of row.assessmentQuestions || []) {
        const item = questionMap.get(String(question.id)) || {
          questionId: String(question.id),
          text: String(question.text || "Question"),
          shown: 0,
          answered: 0,
          timeTotal: 0,
          timeCount: 0,
        };
        item.shown += 1;
        const answer = answerMap.get(String(question.id));
        if (answer?.answer?.trim()) item.answered += 1;
        const timeTakenSeconds = Number(answer?.timeTakenSeconds);
        if (Number.isFinite(timeTakenSeconds) && timeTakenSeconds > 0) {
          item.timeTotal += timeTakenSeconds;
          item.timeCount += 1;
        }
        questionMap.set(item.questionId, item);
      }
    }
    const questionPerformance = Array.from(questionMap.values()).map(item => ({
      questionId: item.questionId,
      text: item.text,
      shown: item.shown,
      answered: item.answered,
      answerRate: item.shown ? Math.round((item.answered / item.shown) * 100) : 0,
      averageTimeSeconds: item.timeCount ? Math.round(item.timeTotal / item.timeCount) : null,
    }));

    return res.json({
      analytics: {
        formTitle: form.title,
        totalResponses: rows.length,
        sent,
        started,
        completed,
        pending: rows.filter(row => ["sent", "in_progress"].includes(row.assessmentStatus)).length,
        scoringPending,
        scoringFailed,
        passThreshold,
        passed,
        passRate: scored.length ? Math.round((passed / scored.length) * 100) : 0,
        completionRate: sent ? Math.round((completed / sent) * 100) : 0,
        assessmentToInterviewRate: completed ? Math.round((rows.filter(row => row.assessmentStatus === "completed" && ["interview", "offer", "hired"].includes(row.stage)).length / completed) * 100) : 0,
        averageCompletionMinutes,
        questionPerformance,
      },
    });
  } catch (err: any) {
    console.error("[forms] GET assessment-analytics:", err);
    return res.status(500).json({ error: err.message || "Could not load assessment analytics." });
  }
});

// PATCH /recruit/forms/:formId — update form
formRouter.patch("/:formId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, questions, status, jobDetails } = req.body;
    const update: Record<string, any> = {};
    if (title !== undefined) update.title = String(title).trim();
    if (description !== undefined) update.description = String(description).trim();
    if (status !== undefined) update.status = status;
    if (jobDetails !== undefined) update.jobDetails = normalizeFormJobDetails(jobDetails);
    if (questions !== undefined) {
      update.questions = questions.map((q: any, idx: number) => ({
        id: q.id || `q_${idx}_${Date.now()}`,
        label: String(q.label || "").trim(),
        type: q.type || "short",
        required: Boolean(q.required),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        placeholder: String(q.placeholder || ""),
      }));
    }

    if (status === "active") {
      const existing = await RecruitForm.findOne({ _id: req.params.formId, uid }).select("status").lean();
      if (existing && existing.status !== "active") {
        await assertFormResourceLimit(uid, "active_forms");
      }
    }

    const form = await RecruitForm.findOneAndUpdate(
      { _id: req.params.formId, uid },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!form) return res.status(404).json({ error: "Form not found." });

    return res.json({ form });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] PATCH /recruit/forms/:formId:", err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /recruit/forms/:formId — delete form + all responses
formRouter.delete("/:formId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOneAndDelete({ _id: req.params.formId, uid });
    if (!form) return res.status(404).json({ error: "Form not found." });

    await RecruitFormResponse.deleteMany({ formId: req.params.formId });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[forms] DELETE /recruit/forms/:formId:", err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /recruit/forms/:formId/responses/:responseId — remove a single response
formRouter.delete("/:formId/responses/:responseId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    await RecruitFormResponse.deleteOne({
      _id: req.params.responseId,
      formId: req.params.formId,
      uid,
    });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[forms] DELETE /recruit/forms/:formId/responses/:responseId:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /recruit/forms/:formId/responses — get all responses
formRouter.get("/:formId/responses", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const responses = await RecruitFormResponse.find({ formId: req.params.formId, uid })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ responses });
  } catch (err: any) {
    console.error("[forms] GET /recruit/forms/:formId/responses:", err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /recruit/forms/:formId/responses/:responseId — update stage
formRouter.patch("/:formId/responses/:responseId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { stage, notes } = req.body;

    // Fetch current stage before update so we can detect actual transition
    const existing = await RecruitFormResponse.findOne(
      { _id: req.params.responseId, formId: req.params.formId, uid },
      { stage: 1, submittedName: 1, submittedEmail: 1 }
    ).lean();
    if (!existing) return res.status(404).json({ error: "Response not found." });

    const update: Record<string, any> = {};
    if (stage !== undefined) update.stage = stage;
    if (notes !== undefined) update.notes = String(notes).slice(0, 5000);
    const allowedStages = [
      "new", "scored", "review_zone", "shortlisted", "assessment",
      "interview", "offer", "hired", "rejected", "withdrawn",
    ];
    if (stage !== undefined && !allowedStages.includes(String(stage))) {
      return res.status(400).json({ error: "Invalid response stage." });
    }
    if (stage && stage !== (existing as any).stage) update.stageMovedAt = new Date();

    const response = await RecruitFormResponse.findOneAndUpdate(
      { _id: req.params.responseId, formId: req.params.formId, uid },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!response) return res.status(404).json({ error: "Response not found." });

    // Stage changes are recorded; recruiters choose when to email via the UI.
    const stageChanged = stage && stage !== (existing as any).stage;
    if (stageChanged) {
      await recordFormStageChange({
        responseId: response._id,
        fromStage: String((existing as any).stage || "new"),
        toStage: String(stage),
        actor: "recruiter",
        actorUid: uid,
        reason: typeof req.body.reason === "string" ? req.body.reason.slice(0, 300) : "Manual stage change",
      });
    }

    if (stageChanged) {
      const _formId = req.params.formId;
      const _responseId = req.params.responseId;
      setImmediate(() => {
        evaluateFormPipelineRules(_formId, _responseId).catch(e =>
          console.error("[forms] post-stage-change rule evaluation failed:", e)
        );
      });
    }

    return res.json({ response });
  } catch (err: any) {
    console.error("[forms] PATCH response:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recruit/forms/:formId/responses/:responseId/assessment/send
// Generate and send a written assessment for a Form response.
formRouter.post("/:formId/responses/:responseId/assessment/send", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const response = await RecruitFormResponse.findOne({
      _id: req.params.responseId,
      formId: req.params.formId,
      uid,
    });
    if (!response) return res.status(404).json({ error: "Response not found." });
    if (response.assessmentStatus === "completed") {
      return res.status(400).json({ error: "Assessment already completed by this applicant." });
    }

    // Sending is idempotent while an assessment is pending.
    if (
      response.assessmentToken &&
      response.assessmentQuestions?.length &&
      ["sent", "in_progress"].includes(response.assessmentStatus)
    ) {
      return res.json({
        ok: true,
        assessmentUrl: `${FORM_FRONTEND_URL}/recruit/assessment/${response.assessmentToken}?form=1`,
        status: response.assessmentStatus,
        questions: response.assessmentQuestions,
        candidateName: response.submittedName,
        candidateEmail: response.submittedEmail,
        emailSent: false,
      });
    }

    await assertFormFeature(uid, "assessments");
    await assertFormResourceLimit(uid, "active_assessments");

    const questions = await runFormBillingOperation({
      ownerUid: uid,
      operation: "assessment_generate_form",
      idempotencyKey: formRequestIdempotencyKey(
        uid,
        `assessment-generate:${response._id}`,
        formIdempotencyHeader(req),
      ),
      resourceType: "form_response",
      resourceId: String(response._id),
      work: async () => generateFormAssessmentQuestions({
        formTitle: form.title,
        description: form.description,
        questions: (form.questions || []).map((question: any) => ({
          id: String(question.id),
          label: String(question.label),
        })),
      }),
    });
    await runFormBillingOperation({
      ownerUid: uid,
      operation: "assessment_send_form",
      idempotencyKey: formIdempotencyKey(uid, ["assessment-send", String(response._id), String(Date.now())]),
      resourceType: "form_response",
      resourceId: String(response._id),
      work: async () => true,
    });
    const token = generateFormAssessmentToken();
    const previousStage = String(response.stage || "new");

    response.assessmentToken = token;
    response.assessmentQuestions = questions;
    response.assessmentAnswers = [];
    response.assessmentStatus = "sent";
    response.assessmentScoringStatus = "not_started";
    response.assessmentRunKey = "";
    response.assessmentSentAt = new Date();
    response.assessmentStartedAt = undefined;
    response.assessmentCompletedAt = undefined;
    response.assessmentCurrentQuestionIndex = 0;
    await response.save();

    if (previousStage !== "assessment") {
      await moveFormResponseStage({
        responseId: response._id,
        fromStage: previousStage,
        toStage: "assessment",
        actor: "recruiter",
        actorUid: uid,
        reason: "Assessment sent",
      });
    }

    const assessmentUrl = `${FORM_FRONTEND_URL}/recruit/assessment/${token}?form=1`;
    let emailSent = false;
    if (response.submittedEmail) {
      const responseId = response._id;
      const candidateName = response.submittedName || "Applicant";
      const candidateEmail = response.submittedEmail;
      const companyName = String((form as any).jobDetails?.companyName || "");
      setImmediate(async () => {
        try {
          const payload = emailTemplates.assessment(candidateName, form.title, companyName, assessmentUrl);
          const result = await sendEmail({
            to: candidateEmail,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            from: NOTIFICATION_FROM,
          });
          await RecruitFormResponse.findByIdAndUpdate(responseId, {
            $push: {
              emailLog: {
                type: "assessment",
                to: candidateEmail,
                subject: payload.subject,
                body: payload.text,
                sentAt: new Date(),
                status: result.ok ? "sent" : "failed",
                error: result.error,
              },
            },
          });
        } catch (error) {
          console.error("[forms] assessment email failed:", error);
        }
      });
      emailSent = true;
    }

    return res.json({
      ok: true,
      assessmentUrl,
      status: response.assessmentStatus,
      questions,
      candidateName: response.submittedName,
      candidateEmail: response.submittedEmail,
      emailSent,
    });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST assessment/send:", err);
    return res.status(500).json({ error: err.message || "Could not send assessment." });
  }
});

// POST /recruit/forms/:formId/responses/:responseId/reject-email
// Generates an AI-powered rejection email draft for the recruiter to review & edit
formRouter.post("/:formId/responses/:responseId/reject-email", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const response = await RecruitFormResponse.findOne({
      _id: req.params.responseId, formId: req.params.formId, uid,
    }).lean();
    if (!response) return res.status(404).json({ error: "Response not found." });

    const candidateName = (response as any).submittedName || "Applicant";
    const candidateEmail = (response as any).submittedEmail || "";
    const email = await runFormBillingOperation({
      ownerUid: uid,
      operation: "reject_email_draft_form",
      idempotencyKey: formRequestIdempotencyKey(
        uid,
        `reject-email:${response._id}`,
        formIdempotencyHeader(req),
      ),
      resourceType: "form_response",
      resourceId: String(response._id),
      work: async () => generateRejectionEmailText({
        candidateName,
        formTitle: (form as any).title,
        stage: (response as any).stage,
      }),
    });

    return res.json({ email, candidateName, candidateEmail });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST reject-email:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recruit/forms/:formId/responses/:responseId/send-email
// Sends a recruiter-composed email to the applicant and logs it
formRouter.post("/:formId/responses/:responseId/send-email", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { type, subject, body } = req.body as { type?: string; subject?: string; body?: string };
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "Subject and body are required." });
    }

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const response = await RecruitFormResponse.findOne({
      _id: req.params.responseId, formId: req.params.formId, uid,
    });
    if (!response) return res.status(404).json({ error: "Response not found." });

    const candEmail = response.submittedEmail?.trim();
    if (!candEmail) return res.status(400).json({ error: "This applicant has no email address on file." });

    const candName = response.submittedName || "Applicant";
    const formTitle = (form as any).title || "";
    const emailCtx = await formEmailContext(form);
    const ctx = { officialContactEmail: emailCtx.officialContactEmail };

    // Build branded HTML based on email type
    let html: string;
    let text = body;
    if (type === "rejected") {
      const tpl = emailTemplates.rejectionEmailHtml(candName, formTitle, emailCtx.companyName, body, ctx);
      html = tpl.html;
      text = tpl.text;
    } else if (type === "offer") {
      const tpl = emailTemplates.offerEmail(candName, formTitle, emailCtx.companyName, body, ctx);
      html = tpl.html;
      text = tpl.text;
    } else {
      html = emailTemplates.genericEmail(candName, subject.trim(), body, ctx);
    }

    const result = await runFormBillingOperation({
      ownerUid: uid,
      operation: type === "offer" ? "offer_letter_form" : "automated_email_form",
      idempotencyKey: formRequestIdempotencyKey(
        uid,
        `send-email:${response._id}:${type || "custom"}`,
        formIdempotencyHeader(req),
      ),
      resourceType: "form_response",
      resourceId: String(response._id),
      work: async () => sendEmail({ to: candEmail, subject: subject.trim(), html, text, from: NOTIFICATION_FROM }),
    });

    const logEntry = {
      type: type || "custom",
      to: candEmail,
      subject: subject.trim(),
      body,
      sentAt: new Date(),
      status: (result.ok ? "sent" : "failed") as "sent" | "failed",
      error: result.error,
    };

    response.emailLog.push(logEntry as any);
    await response.save();

    if (!result.ok) {
      return res.status(502).json({
        error: `Email delivery failed: ${result.error}. The log entry has been saved.`,
        logEntry,
      });
    }
    return res.json({ ok: true, sentAt: logEntry.sentAt, logEntry });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST send-email:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recruit/forms/:formId/responses/:responseId/interview-questions
// Generates (or returns cached) tailored interview questions for a response
formRouter.post("/:formId/responses/:responseId/interview-questions", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const response = await RecruitFormResponse.findOne({
      _id: req.params.responseId,
      formId: req.params.formId,
      uid,
    }).lean();
    if (!response) return res.status(404).json({ error: "Response not found." });

    // Return cached questions if already generated
    if (Array.isArray(response.interviewQuestions) && response.interviewQuestions.length > 0) {
      return res.json({ questions: response.interviewQuestions });
    }

    // Build the answer context for the AI
    const textAnswers = (response.answers as Array<{ questionId: string; label: string; value: string }>)
      .filter(a => a.value?.trim() && a.value !== "__file_uploaded__")
      .map((a, i) => `[${i + 1}] ${a.label}: ${a.value}`)
      .join("\n");

    const hasResume = !!(response.resumeText?.trim() && response.resumeText !== "__scanned_pdf__");

    const prompt = `You are preparing for an interview with a candidate who applied for: "${form.title}".

THEIR FORM ANSWERS:
${textAnswers || "(no text answers provided)"}

${hasResume ? `RESUME SUMMARY (first 1500 chars):\n${(response.resumeText ?? "").slice(0, 1500)}` : ""}

Generate 5-7 sharp, tailored interview questions based specifically on what this candidate wrote.

Rules:
- Reference their actual words, claims, or examples directly — no generic questions
- For strong, detailed answers: go deeper ("You mentioned X — walk me through the toughest part of that")
- For brief or vague answers: probe for specifics ("Your answer on Y was brief — can you give a concrete example?")
- Mix question types: follow-up probes, hypotheticals, and verification questions
- Each question must be standalone and interviewable without re-reading the form
- Do NOT include preamble or numbering in the question text itself

Return ONLY this JSON (no markdown):
{
  "questions": [
    "Question text here",
    "Another question here"
  ]
}`;

    let raw: string;
    try {
      raw = await runFormBillingOperation({
        ownerUid: uid,
        operation: "interview_questions_form",
        idempotencyKey: formRequestIdempotencyKey(
          uid,
          `interview-questions:${response._id}`,
          formIdempotencyHeader(req),
        ),
        resourceType: "form_response",
        resourceId: String(response._id),
        work: async () => callMeshChatCompletions({
          apiKey: GEMINI_MESH_KEY,
          model: "openai/gpt-4o-mini",
          retries: 2,
          fallbackModels: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.1-8b-instruct"],
          messages: [{ role: "user", content: prompt }],
          temperature: 0.45,
          max_tokens: 2000,
          nvidiaFallback: true,
        }),
      });
    } catch (err) {
      if (await respondFormBillingError(res, err, uid)) return;
      console.error("[forms] interview-questions: AI call failed:", err);
      return res.status(500).json({ error: "AI is temporarily unavailable. Please try again shortly." });
    }

    const parsed = safeJson(raw);
    if (!parsed || !Array.isArray(parsed.questions)) {
      console.error("[forms] interview-questions: unparseable AI response:", raw?.slice(0, 300));
      return res.status(500).json({ error: "Failed to generate questions. Please try again." });
    }

    const questions: string[] = parsed.questions
      .filter((q: unknown) => typeof q === "string" && (q as string).trim())
      .map((q: string) => q.trim())
      .slice(0, 7);

    if (questions.length === 0) {
      console.error("[forms] interview-questions: AI returned empty list:", raw?.slice(0, 300));
      return res.status(500).json({ error: "AI returned no questions. Please try again." });
    }

    // Cache on the response document
    await RecruitFormResponse.findByIdAndUpdate(response._id, {
      $set: { interviewQuestions: questions },
    });

    return res.json({ questions });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST interview-questions:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recruit/forms/:formId/responses/:responseId/retry-score
// Re-runs AI scoring for a response where scoringFailed === true
formRouter.post("/:formId/responses/:responseId/retry-score", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    // Verify the form belongs to this recruiter
    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const response = await RecruitFormResponse.findOne({
      _id: req.params.responseId,
      formId: req.params.formId,
      uid,
    }).lean();
    if (!response) return res.status(404).json({ error: "Response not found." });

    // Build scored answers with questionIds (skip file-upload placeholders)
    const textAnswers: ScoredAnswer[] = (response.answers as Array<{ questionId: string; label: string; value: string }>)
      .filter(a => a.value && a.value.trim() && a.value !== "__file_uploaded__")
      .map(a => ({ questionId: a.questionId, label: a.label, value: a.value }));

    const scored = await runFormBillingOperation({
      ownerUid: uid,
      operation: "form_response_score",
      idempotencyKey: formRequestIdempotencyKey(
        uid,
        `retry-score:${response._id}`,
        formIdempotencyHeader(req),
      ),
      resourceType: "form_response",
      resourceId: String(response._id),
      work: async () => scoreFormResponse({
        formTitle: form.title,
        answers: textAnswers,
        resumeText: response.resumeText || undefined,
      }),
    });

    const updated = await RecruitFormResponse.findByIdAndUpdate(
      response._id,
      {
        $set: {
          aiSummary: scored.aiSummary,
          aiScore: scored.aiScore,
          strengths: scored.strengths,
          redFlags: scored.redFlags,
          answerSignals: scored.answerSignals,
          questionScores: scored.questionScores,
          scoringFailed: scored.scoringFailed,
        },
      },
      { returnDocument: "after" }
    ).lean();

    // A retried score is the first trustworthy score for this response, so let the
    // agent act on it — but only while the recruiter hasn't already triaged it.
    if (!scored.scoringFailed && ["new", "scored"].includes(String((response as any).stage))) {
      const _formId = req.params.formId;
      const _responseId = String(response._id);
      setImmediate(async () => {
        try {
          await markFormResponseScored(response._id);
          await runFormAgent({
            responseId: response._id,
            formTitle: form.title,
            ownerUid: String(form.uid),
            companyName: formCompanyName(form),
            agentMode: (form as any).agentMode ?? {},
            aiScore: scored.aiScore,
            scoringFailed: scored.scoringFailed,
            candidateName: (response as any).submittedName,
            candidateEmail: (response as any).submittedEmail,
          });
          await evaluateFormPipelineRules(_formId, _responseId);
        } catch (e) {
          console.error("[forms] post-retry agent run failed:", e);
        }
      });
    }

    return res.json({ response: updated });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST retry-score:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recruit/forms/:formId/responses/:responseId/assessment/retry-score
// Re-runs assessment scoring after a transient AI failure.
formRouter.post("/:formId/responses/:responseId/assessment/retry-score", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const response = await RecruitFormResponse.findOne({
      _id: req.params.responseId,
      formId: req.params.formId,
      uid,
      assessmentStatus: "completed",
      assessmentScoringStatus: "failed",
    });
    if (!response) {
      return res.status(400).json({ error: "This assessment is not eligible for scoring retry." });
    }

    const runKey = `assessment:${String(response._id)}:retry:${Date.now()}`;
    response.assessmentScoringStatus = "pending";
    response.assessmentRunKey = runKey;
    await response.save();

    setImmediate(() => {
      processFormAssessmentScore(response._id, runKey).catch(error =>
        console.error("[forms] assessment retry worker crashed:", error)
      );
    });

    return res.json({
      ok: true,
      response: {
        _id: response._id,
        assessmentScoringStatus: response.assessmentScoringStatus,
        assessmentRunKey: response.assessmentRunKey,
      },
    });
  } catch (err: any) {
    console.error("[forms] POST assessment retry-score:", err);
    return res.status(500).json({ error: err.message || "Could not retry assessment scoring." });
  }
});

// ─── AI Agent Mode routes ─────────────────────────────────────────────────────

// PATCH /recruit/forms/:formId/agent-mode — configure the agent
formRouter.patch("/:formId/agent-mode", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const {
      enabled, shortlistThreshold, rejectThreshold,
      autoEmailShortlist, autoEmailReject, emailReviewZoneCandidates,
    } = req.body;

    const update: Record<string, any> = {};
    if (enabled !== undefined)                   update["agentMode.enabled"]                   = Boolean(enabled);
    if (shortlistThreshold !== undefined)        update["agentMode.shortlistThreshold"]        = clampPct(shortlistThreshold);
    if (rejectThreshold !== undefined)           update["agentMode.rejectThreshold"]           = clampPct(rejectThreshold);
    if (autoEmailShortlist !== undefined)        update["agentMode.autoEmailShortlist"]        = Boolean(autoEmailShortlist);
    if (autoEmailReject !== undefined)           update["agentMode.autoEmailReject"]           = Boolean(autoEmailReject);
    if (emailReviewZoneCandidates !== undefined) update["agentMode.emailReviewZoneCandidates"] = Boolean(emailReviewZoneCandidates);

    const existing = await RecruitForm.findOne({ _id: req.params.formId, uid })
      .select("agentMode")
      .lean();
    if (!existing) return res.status(404).json({ error: "Form not found." });

    const current = (existing as any).agentMode ?? {};
    const nextShortlist = update["agentMode.shortlistThreshold"] ?? current.shortlistThreshold ?? 75;
    const nextReject    = update["agentMode.rejectThreshold"]    ?? current.rejectThreshold    ?? 35;
    if (nextReject >= nextShortlist) {
      return res.status(400).json({
        error: "Reject threshold must be lower than the shortlist threshold.",
        agentMode: current,
      });
    }

    const form = await RecruitForm.findOneAndUpdate(
      { _id: req.params.formId, uid },
      { $set: update },
      { returnDocument: "after" }
    ).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    return res.json({ ok: true, agentMode: (form as any).agentMode ?? {} });
  } catch (err: any) {
    console.error("[forms] PATCH agent-mode:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /recruit/forms/:formId/agent-log — what the agent did, newest first
formRouter.get("/:formId/agent-log", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const responses = await RecruitFormResponse.find({ formId: req.params.formId, uid })
      .select("submittedName submittedEmail stage agentLog")
      .lean();

    const entries = responses.flatMap((r: any) =>
      (r.agentLog ?? []).map((entry: any) => ({
        responseId: r._id,
        name: r.submittedName || "Applicant",
        email: r.submittedEmail || "",
        currentStage: r.stage,
        ...entry,
      }))
    ).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({ entries });
  } catch (err: any) {
    console.error("[forms] GET agent-log:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /recruit/forms/:formId/agent-stats — headline numbers for the agent card
formRouter.get("/:formId/agent-stats", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const responses = await RecruitFormResponse.find({ formId: req.params.formId, uid })
      .select("agentLog aiScore scoringFailed")
      .lean();

    let shortlisted = 0, rejected = 0, reviewZone = 0, emailsSent = 0;
    for (const r of responses as any[]) {
      for (const entry of r.agentLog ?? []) {
        if (entry.action === "shortlisted") shortlisted++;
        else if (entry.action === "rejected") rejected++;
        else if (entry.action === "review_zone") reviewZone++;
        if (entry.emailSent) emailsSent++;
      }
    }

    const scored = (responses as any[]).filter(r => !r.scoringFailed);
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, r) => s + (r.aiScore ?? 0), 0) / scored.length)
      : 0;

    const agentMode = (form as any).agentMode ?? {};
    const totalHandled = shortlisted + rejected + reviewZone;

    return res.json({
      agentMode,
      totalResponses: responses.length,
      totalHandled,
      shortlisted,
      rejected,
      reviewZone,
      emailsSent,
      avgScore,
      // Manual triage the recruiter did not have to do
      manualReviewsSaved: shortlisted + rejected,
    });
  } catch (err: any) {
    console.error("[forms] GET agent-stats:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Pipeline rules routes ────────────────────────────────────────────────────

const FORM_RULE_CONDITIONS = ["score_above", "score_below", "stage_age_days"];
const FORM_RULE_ACTIONS = [
  "move_to_scored",
  "move_to_review_zone",
  "move_to_shortlisted",
  "move_to_assessment",
  "move_to_interview",
  "move_to_offer",
  "move_to_hired",
  "move_to_withdrawn",
  "move_to_rejected",
];

formRouter.get("/:formId/pipeline-rules", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).select("pipelineRules").lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    return res.json({ rules: (form as any).pipelineRules ?? [] });
  } catch (err: any) {
    console.error("[forms] GET pipeline-rules:", err);
    return res.status(500).json({ error: err.message });
  }
});

formRouter.post("/:formId/pipeline-rules", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { condition, threshold, fromStage, action } = req.body;
    if (!FORM_RULE_CONDITIONS.includes(condition)) {
      return res.status(400).json({ error: "Invalid rule condition." });
    }
    if (!FORM_RULE_ACTIONS.includes(action)) {
      return res.status(400).json({ error: "Invalid rule action." });
    }
    if (threshold === undefined || Number.isNaN(Number(threshold))) {
      return res.status(400).json({ error: "A numeric threshold is required." });
    }

    await assertFormResourceLimit(uid, "pipeline_rules");

    const rule = {
      id: crypto.randomUUID(),
      condition,
      threshold: Math.max(0, Number(threshold)),
      fromStage: typeof fromStage === "string" ? fromStage : "",
      action,
      enabled: true,
      triggerCount: 0,
    };

    const form = await RecruitForm.findOneAndUpdate(
      { _id: req.params.formId, uid },
      { $push: { pipelineRules: rule } },
      { returnDocument: "after" }
    ).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    return res.status(201).json({ rule, rules: (form as any).pipelineRules });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] POST pipeline-rules:", err);
    return res.status(500).json({ error: err.message });
  }
});

formRouter.patch("/:formId/pipeline-rules/:ruleId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { enabled, threshold, fromStage } = req.body;
    const update: Record<string, any> = {};
    if (enabled !== undefined)   update["pipelineRules.$.enabled"]   = Boolean(enabled);
    if (threshold !== undefined) update["pipelineRules.$.threshold"] = Math.max(0, Number(threshold) || 0);
    if (fromStage !== undefined) update["pipelineRules.$.fromStage"] = String(fromStage);

    // Enabling a previously disabled rule consumes an additional pipeline_rules slot.
    if (enabled === true) {
      const existing = await RecruitForm.findOne({
        _id: req.params.formId,
        uid,
        "pipelineRules.id": req.params.ruleId,
      })
        .select("pipelineRules")
        .lean();
      if (!existing) return res.status(404).json({ error: "Rule not found." });
      const rule = ((existing as any).pipelineRules ?? []).find(
        (r: any) => String(r.id) === String(req.params.ruleId),
      );
      if (rule && rule.enabled === false) {
        await assertFormResourceLimit(uid, "pipeline_rules");
      }
    }

    const form = await RecruitForm.findOneAndUpdate(
      { _id: req.params.formId, uid, "pipelineRules.id": req.params.ruleId },
      { $set: update },
      { returnDocument: "after" }
    ).lean();
    if (!form) return res.status(404).json({ error: "Rule not found." });

    return res.json({ rules: (form as any).pipelineRules });
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] PATCH pipeline-rule:", err);
    return res.status(500).json({ error: err.message });
  }
});

formRouter.delete("/:formId/pipeline-rules/:ruleId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOneAndUpdate(
      { _id: req.params.formId, uid },
      { $pull: { pipelineRules: { id: req.params.ruleId } } },
      { returnDocument: "after" }
    ).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    return res.json({ rules: (form as any).pipelineRules });
  } catch (err: any) {
    console.error("[forms] DELETE pipeline-rule:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

// GET /recruit/forms/:formId/export?format=csv|json
formRouter.get("/:formId/export", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const format = req.query.format === "json" ? "json" : "csv";
    const payload = await runFormBillingOperation({
      ownerUid: uid,
      operation: "export_form",
      idempotencyKey: formRequestIdempotencyKey(
        uid,
        `export:${form._id}:${format}`,
        formIdempotencyHeader(req),
      ),
      resourceType: "form",
      resourceId: String(form._id),
      metadata: { format },
      work: async () => {
        const responses = await RecruitFormResponse.find({ formId: req.params.formId, uid })
          .sort({ aiScore: -1 })
          .lean();

        const filenameBase = (form as any).title.replace(/[^a-z0-9]/gi, "_");
        const questions = (form as any).questions ?? [];

        const rowFor = (r: any) => ({
          name: r.submittedName || "",
          email: r.submittedEmail || "",
          phone: r.submittedPhone || "",
          stage: r.stage,
          score: r.scoringFailed ? "" : r.aiScore,
          source: r.source || "",
          agentAction: r.agentLog?.length ? r.agentLog[r.agentLog.length - 1].action : "",
          redFlags: (r.redFlags ?? []).join("; "),
          strengths: (r.strengths ?? []).join("; "),
          aiSummary: r.aiSummary || "",
          notes: r.notes || "",
          submittedAt: new Date(r.createdAt).toISOString(),
          answers: questions.map((q: any) => {
            const a = (r.answers ?? []).find((x: any) => x.questionId === q.id);
            return a?.value === "__file_uploaded__" ? "(file uploaded)" : (a?.value ?? "");
          }),
        });

        if (format === "json") {
          return {
            contentType: "application/json",
            filename: `${filenameBase}_responses.json`,
            body: (responses as any[]).map(r => {
              const row = rowFor(r);
              const { answers, ...rest } = row;
              return {
                ...rest,
                answers: questions.map((q: any, i: number) => ({ question: q.label, answer: answers[i] })),
              };
            }),
            asJson: true as const,
          };
        }

        const escape = (val: string | number | undefined) => {
          const s = String(val ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const headers = [
          "Name", "Email", "Phone", "Stage", "AI Score", "Source", "Agent Action",
          "Red Flags", "Strengths", "AI Summary", "Notes", "Submitted At",
          ...questions.map((q: any) => q.label),
        ];
        const rows = (responses as any[]).map(r => {
          const row = rowFor(r);
          return [
            row.name, row.email, row.phone, row.stage, row.score, row.source, row.agentAction,
            row.redFlags, row.strengths, row.aiSummary, row.notes, row.submittedAt,
            ...row.answers,
          ].map(escape).join(",");
        });

        return {
          contentType: "text/csv",
          filename: `${filenameBase}_responses.csv`,
          body: [headers.map(escape).join(","), ...rows].join("\n"),
          asJson: false as const,
        };
      },
    });

    res.setHeader("Content-Type", payload.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
    if (payload.asJson) return res.json(payload.body);
    return res.send(payload.body);
  } catch (err: any) {
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[forms] GET export:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public routes (/recruit-public/forms) ────────────────────────────────────

// GET /recruit-public/forms/assessment/:token
formPublicRouter.get("/assessment/:token", async (req, res) => {
  try {
    await connectMongo();
    const response = await RecruitFormResponse.findOne({
      assessmentToken: req.params.token,
    }).lean();
    if (!response) return res.status(404).json({ error: "Assessment not found or no longer available." });

    const form = await RecruitForm.findOne({ _id: response.formId, status: { $in: ["active", "closed"] } })
      .select("title description jobDetails")
      .lean();
    if (!form) return res.status(404).json({ error: "Application form not found." });

    return res.json({
      completed: response.assessmentStatus === "completed",
      candidateName: response.submittedName || "Applicant",
      formTitle: form.title,
      formDescription: form.description,
      jobDetails: (form as any).jobDetails ?? {},
      assessmentStatus: response.assessmentStatus,
      questions: response.assessmentQuestions ?? [],
      currentQuestionIndex: response.assessmentCurrentQuestionIndex ?? 0,
    });
  } catch (err: any) {
    console.error("[forms] GET public assessment:", err);
    return res.status(500).json({ error: "Could not load assessment." });
  }
});

// POST /recruit-public/forms/assessment/:token/progress
formPublicRouter.post("/assessment/:token/progress", async (req, res) => {
  try {
    await connectMongo();
    const questionIndex = Math.max(0, Math.floor(Number(req.body?.questionIndex) || 0));
    const response = await RecruitFormResponse.findOneAndUpdate(
      {
        assessmentToken: req.params.token,
        assessmentStatus: { $in: ["sent", "in_progress"] },
      },
      {
        $set: {
          assessmentStatus: "in_progress",
          assessmentCurrentQuestionIndex: questionIndex,
          assessmentStartedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!response) return res.status(404).json({ error: "Assessment not found or already submitted." });
    return res.json({ ok: true, currentQuestionIndex: response.assessmentCurrentQuestionIndex });
  } catch (err: any) {
    console.error("[forms] POST public assessment progress:", err);
    return res.status(500).json({ error: "Could not save assessment progress." });
  }
});

// POST /recruit-public/forms/assessment/:token/submit
formPublicRouter.post("/assessment/:token/submit", async (req, res) => {
  try {
    await connectMongo();
    const response = await RecruitFormResponse.findOne({
      assessmentToken: req.params.token,
    });
    if (!response) return res.status(404).json({ error: "Assessment not found or no longer available." });
    if (response.assessmentStatus === "completed") {
      return res.status(400).json({ error: "This assessment has already been submitted." });
    }

    const submittedAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const answerMap = new Map(
      submittedAnswers.map((answer: any) => [
        String(answer?.questionId || ""),
        {
          questionId: String(answer?.questionId || ""),
          answer: String(answer?.answer || "").trim().slice(0, 5000),
          timeTakenSeconds: Math.max(0, Math.floor(Number(answer?.timeTakenSeconds) || 0)),
        },
      ]),
    );
    const answers = (response.assessmentQuestions ?? []).map((question: { id: string }) => answerMap.get(question.id)).filter(Boolean) as {
      questionId: string;
      answer: string;
      timeTakenSeconds: number;
    }[];
    if (answers.length !== response.assessmentQuestions.length || answers.some(answer => !answer.answer)) {
      return res.status(400).json({ error: "Please answer every assessment question before submitting." });
    }

    response.assessmentAnswers = answers;
    response.assessmentStatus = "completed";
    response.assessmentCompletedAt = new Date();
    response.assessmentScoringStatus = "pending";
    response.assessmentRunKey = `assessment:${String(response._id)}:${response.assessmentCompletedAt.getTime()}`;
    response.assessmentCurrentQuestionIndex = Math.max(0, response.assessmentQuestions.length - 1);
    await response.save();

    const responseId = response._id;
    setImmediate(() => {
      processFormAssessmentScore(responseId, response.assessmentRunKey).catch(error =>
        console.error("[forms] assessment worker crashed:", error)
      );
    });

    return res.json({ ok: true, message: "Assessment submitted successfully." });
  } catch (err: any) {
    console.error("[forms] POST public assessment submit:", err);
    return res.status(500).json({ error: "Could not submit assessment." });
  }
});

// GET /recruit-public/forms/:slug — get public form (questions only, no responses)
formPublicRouter.get("/:slug", async (req, res) => {
  try {
    await connectMongo();
    const form = await RecruitForm.findOne({ slug: req.params.slug, status: "active" })
      .select("title description jobDetails questions slug status")
      .lean();

    if (!form) return res.status(404).json({ error: "Form not found or no longer accepting responses." });

    return res.json({ form });
  } catch (err: any) {
    console.error("[forms] GET public form:", err);
    return res.status(500).json({ error: err.message });
  }
});

const PUBLIC_STAGE_LABELS: Record<string, string> = {
  new: "Received",
  scored: "Under review",
  review_zone: "Under review",
  shortlisted: "Shortlisted",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

// GET /recruit-public/forms/:slug/status?email= — applicant self-service status check
formPublicRouter.get("/:slug/status", async (req, res) => {
  try {
    await connectMongo();
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    const limit = checkRateLimit(`form-status:${req.params.slug}:${email}`, req);
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSeconds));
      return res.status(429).json({ error: "Too many lookups. Please try again later." });
    }

    const form = await RecruitForm.findOne({ slug: req.params.slug, status: "active" })
      .select("title jobDetails.companyName slug")
      .lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const response = await RecruitFormResponse.findOne({
      formId: form._id,
      submittedEmail: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    })
      .select("stage stageMovedAt createdAt submittedName")
      .lean();

    if (!response) {
      return res.json({ found: false, formTitle: form.title });
    }

    const stage = String((response as any).stage || "new");
    return res.json({
      found: true,
      formTitle: form.title,
      companyName: formCompanyName(form),
      applicantName: (response as any).submittedName || "",
      stage,
      stageLabel: PUBLIC_STAGE_LABELS[stage] || stage.replace(/_/g, " "),
      updatedAt: (response as any).stageMovedAt || (response as any).createdAt,
    });
  } catch (err: any) {
    console.error("[forms] GET public status:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recruit-public/forms/:slug/submit — submit a response
formPublicRouter.post(
  "/:slug/submit",
  resumeUpload.single("resume"),
  async (req, res) => {
    try {
      await connectMongo();

      // ── Bot + abuse protection (public unauthenticated write with an AI cost) ──
      const captcha = await verifyRecaptcha(req.body.recaptchaToken ?? "");
      if (!captcha.ok) return res.status(403).json({ error: RECAPTCHA_REJECTION_MESSAGE });

      const limit = checkRateLimit(`form-submit:${req.params.slug}`, req);
      if (!limit.allowed) {
        res.setHeader("Retry-After", String(limit.retryAfterSeconds));
        return res.status(429).json({
          error: "Too many submissions from this network. Please try again later.",
        });
      }

      const form = await RecruitForm.findOne({ slug: req.params.slug, status: "active" }).lean();
      if (!form) return res.status(404).json({ error: "Form not found or no longer accepting responses." });

      // Parse answers from body (sent as JSON string or fields)
      let rawAnswers: { questionId: string; label: string; value: string }[] = [];
      try {
        rawAnswers = typeof req.body.answers === "string"
          ? JSON.parse(req.body.answers)
          : (req.body.answers || []);
      } catch {
        rawAnswers = [];
      }

      // Extract name/email/phone from answers
      let submittedName = "";
      let submittedEmail = "";
      let submittedPhone = "";

      for (const q of form.questions) {
        const answer = rawAnswers.find(a => a.questionId === q.id);
        const val = answer?.value?.trim() || "";
        if (!val) continue;
        const lbl = q.label.toLowerCase();
        if (q.type === "email" || lbl.includes("email")) submittedEmail = submittedEmail || val;
        if (q.type === "phone" || lbl.includes("phone") || lbl.includes("mobile")) submittedPhone = submittedPhone || val;
        if (lbl.includes("name") && !lbl.includes("company") && !lbl.includes("last")) submittedName = submittedName || val;
      }

      // Use pre-extracted resume text if the client sent it (candidate reviewed/edited it),
      // otherwise fall back to parsing the uploaded file server-side.
      let resumeText = "";
      const clientResumeText = typeof req.body.resumeText === "string" ? req.body.resumeText.trim() : "";
      if (clientResumeText) {
        resumeText = clientResumeText;
      } else if (req.file) {
        resumeText = await extractResumeText(req.file);
      }

      // Duplicate application check (same email on this form)
      const normalizedEmail = submittedEmail.trim().toLowerCase();
      if (normalizedEmail) {
        const existingApp = await RecruitFormResponse.findOne({
          formId: form._id,
          submittedEmail: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        }).select("_id").lean();
        if (existingApp) {
          return res.status(409).json({ error: "You have already applied with this email address." });
        }
      }

      // Validate required fields
      for (const q of form.questions) {
        if (!q.required) continue;
        if (q.type === "file") {
          if (!req.file) return res.status(400).json({ error: `"${q.label}" is required.` });
          continue;
        }
        const answer = rawAnswers.find(a => a.questionId === q.id);
        if (!answer?.value?.trim()) {
          return res.status(400).json({ error: `"${q.label}" is required.` });
        }
      }

      const ownerUid = formBillingOwnerUid(form);
      if (!ownerUid) {
        return res.status(503).json({ error: "This form cannot accept responses right now." });
      }

      // Pattern C: reserve creator quota BEFORE creating the response record.
      const intakeKey = formIdempotencyKey(ownerUid, [
        "intake",
        String(form._id),
        normalizedEmail || formContentHash(JSON.stringify(rawAnswers).slice(0, 2000)),
      ]);

      let response;
      try {
        response = await runFormBillingOperation({
          ownerUid,
          operation: "form_response_intake",
          idempotencyKey: intakeKey,
          resourceType: "form",
          resourceId: String(form._id),
          work: async () => {
            await assertFormResourceLimit(ownerUid, "stored_responses");
            return RecruitFormResponse.create({
              formId: form._id,
              uid: form.uid,
              answers: rawAnswers,
              resumeText,
              aiSummary: "",
              aiScore: 0,
              strengths: [],
              redFlags: [],
              answerSignals: [],
              scoringFailed: true, // will be patched after async scoring
              stage: "new",
              submittedName,
              submittedEmail,
              submittedPhone,
              source: typeof req.body.source === "string" && req.body.source.trim()
                ? req.body.source.trim().slice(0, 80)
                : "Form",
              stageMovedAt: new Date(),
              stageHistory: [{
                fromStage: "",
                toStage: "new",
                actor: "system",
                actorUid: "",
                reason: "Application received",
                timestamp: new Date(),
              }],
            });
          },
        });
      } catch (billingErr: any) {
        if (await respondFormBillingError(res, billingErr, ownerUid)) return;
        throw billingErr;
      }

      // ── 2. Increment counter (fire-and-forget; OK to drift by ±1 rarely) ─
      RecruitForm.findByIdAndUpdate(form._id, { $inc: { responseCount: 1 } }).catch(e =>
        console.error("[forms] counter increment failed (non-fatal):", e)
      );

      // ── 3. Return 201 immediately — candidate is done ─────────────────────
      res.status(201).json({ ok: true, responseId: response._id });

      // Confirmation email to applicant (not creator-metered)
      if (submittedEmail?.trim()) {
        const confirmName = submittedName || "Applicant";
        const confirmEmail = submittedEmail.trim();
        const formTitle = form.title;
        setImmediate(async () => {
          try {
            const ctx = await formEmailContext(form);
            const statusUrl = `${FORM_FRONTEND_URL}/f/${form.slug}/status`;
            const payload = emailTemplates.formApplicationReceived(
              confirmName, formTitle, ctx.companyName,
              { officialContactEmail: ctx.officialContactEmail, statusUrl },
            );
            const result = await sendEmail({
              to: confirmEmail, subject: payload.subject, html: payload.html, text: payload.text, from: NOTIFICATION_FROM,
            });
            await RecruitFormResponse.findByIdAndUpdate(response._id, {
              $push: {
                emailLog: {
                  type: "application_received", to: confirmEmail, subject: payload.subject, body: payload.text,
                  sentAt: new Date(), status: result.ok ? "sent" : "failed", error: result.error,
                },
              },
            });
          } catch (e) {
            console.error("[forms] application confirmation email failed:", e);
          }
        });
      }

      // ── 4. Score in background (Pattern D) — AI exhaust keeps the response ─
      const textAnswers: ScoredAnswer[] = rawAnswers
        .filter(a => a.value?.trim() && a.value !== "__file_uploaded__")
        .map(a => ({ questionId: a.questionId, label: a.label, value: a.value }));

      // Phase 4 verified: this async public-submit scoring meters at execution
      // time via runFormBillingOperation (form_response_score) with a response-
      // stable idempotency key, so a downgrade/cancel between submit and the
      // background run is enforced when the reservation is taken.
      setImmediate(async () => {
        try {
          const scored = await runFormBillingOperation({
            ownerUid,
            operation: "form_response_score",
            idempotencyKey: formIdempotencyKey(ownerUid, ["score", String(response._id)]),
            resourceType: "form_response",
            resourceId: String(response._id),
            work: async () => scoreFormResponse({
              formTitle: form.title,
              answers: textAnswers,
              resumeText: resumeText || undefined,
            }),
          });
          await RecruitFormResponse.findByIdAndUpdate(response._id, {
            $set: {
              aiSummary: scored.aiSummary,
              aiScore: scored.aiScore,
              strengths: scored.strengths,
              redFlags: scored.redFlags,
              answerSignals: scored.answerSignals,
              questionScores: scored.questionScores,
              scoringFailed: scored.scoringFailed,
            },
          });

          if (!scored.scoringFailed) {
            await markFormResponseScored(response._id);
          }

          // AI Agent Mode acts on the fresh score, then pipeline rules run on the result.
          await runFormAgent({
            responseId: response._id,
            formTitle: form.title,
            ownerUid: String(form.uid),
            companyName: formCompanyName(form),
            agentMode: (form as any).agentMode ?? {},
            aiScore: scored.aiScore,
            scoringFailed: scored.scoringFailed,
            candidateName: submittedName,
            candidateEmail: submittedEmail,
          });
          await evaluateFormPipelineRules(String(form._id), String(response._id));
        } catch (e) {
          if (isFormBillingError(e)) {
            console.warn("[forms] background scoring blocked by billing — response kept for manual review:", (e as Error).message);
            return;
          }
          console.error("[forms] background scoring failed (non-fatal):", e);
        }
      });

    } catch (err: any) {
      console.error("[forms] POST submit:", err);
      const ownerUid = formBillingOwnerUid(
        await RecruitForm.findOne({ slug: req.params.slug }).select("uid").lean().catch(() => null),
      );
      if (!res.headersSent && ownerUid && await respondFormBillingError(res, err, ownerUid)) return;
      // Only send if headers not already sent (i.e. before res.status(201))
      if (!res.headersSent) {
        return res.status(500).json({ error: err.message });
      }
    }
  }
);

// ─── Multer error → structured JSON ───────────────────────────────────────────
// Must be 4-arg to be recognised by Express as an error handler
formPublicRouter.use(
  (err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const multerLib = require("multer");
    if (err instanceof multerLib.MulterError) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum allowed size is 5 MB."
        : `File upload error: ${err.message}`;
      return res.status(400).json({ error: msg });
    }
    if (err?.message) {
      // e.g. "Only PDF, DOCX, or TXT files are allowed."
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
);
