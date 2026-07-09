import express from "express";
import crypto from "crypto";
import multer from "multer";
import { connectMongo } from "./db";
import { RecruitForm } from "./models/RecruitForm";
import { RecruitFormResponse } from "./models/RecruitFormResponse";
import { callNvidiaChatCompletions } from "./ai/nvidiaClient";

export const formRouter = express.Router();       // protected — /recruit/forms
export const formPublicRouter = express.Router(); // public    — /recruit-public/forms

const MESHAPI_API_KEY = process.env.MESHAPI_API_KEY ?? "";

function getUid(req: express.Request): string {
  return (req as any).user?.uid ?? "";
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
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "redFlags": ["<only genuine concern — leave empty array if none>"],
  "answerSignals": [
    { "idx": 1, "signal": "strong", "note": "<one short phrase why — e.g. specific examples, deep expertise>" },
    { "idx": 2, "signal": "ok", "note": "<one short phrase>" },
    { "idx": 3, "signal": "thin", "note": "<one short phrase why — e.g. very brief, vague, no examples>" }
  ]
}

Scoring guide:
- 80-100: Strong, clear fit with excellent answers
- 60-79: Good candidate, solid answers, minor gaps
- 40-59: Some relevant background, unclear fit
- Below 40: Significant mismatch or very thin responses

Answer signal guide (for each numbered answer above):
- "strong": detailed, specific, compelling — concrete examples or clear expertise shown
- "ok": adequate but generic — answers the question without standing out
- "thin": very brief, vague, off-topic, or missing entirely

Only include signals for answers that were actually provided (match the [idx] numbers above). Skip contact-info-only answers (name, email, phone).
Be specific and honest. If answers are very short or empty, note that in the summary.`;

  let raw: string;
  try {
    raw = await callNvidiaChatCompletions({
      apiKey: MESHAPI_API_KEY,
      retries: 2,
      fallbackModels: ["anthropic/claude-3-haiku", "google/gemini-2.5-flash-lite"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 900,
    });
  } catch (err) {
    console.error("[forms] scoreFormResponse: AI call failed:", err);
    return { aiScore: 0, aiSummary: "", strengths: [], redFlags: [], answerSignals: [], scoringFailed: true };
  }

  const parsed = safeJson(raw);
  if (!parsed) {
    console.error("[forms] scoreFormResponse: unparseable AI response:", raw?.slice(0, 300));
    return { aiScore: 0, aiSummary: "", strengths: [], redFlags: [], answerSignals: [], scoringFailed: true };
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

  return {
    aiScore: Math.min(100, Math.max(0, Number(parsed.aiScore) || 0)),
    aiSummary: String(parsed.aiSummary || "").trim(),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s: unknown) => typeof s === "string" && s.trim()) : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.filter((f: unknown) => typeof f === "string" && f.trim()) : [],
    answerSignals,
    scoringFailed: false,
  };
}

// ─── Protected routes (/recruit/forms) ────────────────────────────────────────

// POST /recruit/forms — create a form
formRouter.post("/", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, questions } = req.body as {
      title?: string;
      description?: string;
      questions?: any[];
    };

    if (!title?.trim()) return res.status(400).json({ error: "Form title is required." });

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
formRouter.get("/:formId", async (req, res) => {
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

// PATCH /recruit/forms/:formId — update form
formRouter.patch("/:formId", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, questions, status } = req.body;
    const update: Record<string, any> = {};
    if (title !== undefined) update.title = String(title).trim();
    if (description !== undefined) update.description = String(description).trim();
    if (status !== undefined) update.status = status;
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

    const form = await RecruitForm.findOneAndUpdate(
      { _id: req.params.formId, uid },
      { $set: update },
      { new: true }
    );
    if (!form) return res.status(404).json({ error: "Form not found." });

    return res.json({ form });
  } catch (err: any) {
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

// GET /recruit/forms/:formId/responses — get all responses
formRouter.get("/:formId/responses", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const form = await RecruitForm.findOne({ _id: req.params.formId, uid }).lean();
    if (!form) return res.status(404).json({ error: "Form not found." });

    const responses = await RecruitFormResponse.find({ formId: req.params.formId })
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

    const { stage } = req.body;
    const response = await RecruitFormResponse.findOneAndUpdate(
      { _id: req.params.responseId, formId: req.params.formId, uid },
      { $set: { stage } },
      { new: true }
    );
    if (!response) return res.status(404).json({ error: "Response not found." });

    return res.json({ response });
  } catch (err: any) {
    console.error("[forms] PATCH response:", err);
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

    const scored = await scoreFormResponse({
      formTitle: form.title,
      answers: textAnswers,
      resumeText: response.resumeText || undefined,
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
          scoringFailed: scored.scoringFailed,
        },
      },
      { new: true }
    ).lean();

    return res.json({ response: updated });
  } catch (err: any) {
    console.error("[forms] POST retry-score:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public routes (/recruit-public/forms) ────────────────────────────────────

// GET /recruit-public/forms/:slug — get public form (questions only, no responses)
formPublicRouter.get("/:slug", async (req, res) => {
  try {
    await connectMongo();
    const form = await RecruitForm.findOne({ slug: req.params.slug, status: "active" })
      .select("title description questions slug status")
      .lean();

    if (!form) return res.status(404).json({ error: "Form not found or no longer accepting responses." });

    return res.json({ form });
  } catch (err: any) {
    console.error("[forms] GET public form:", err);
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

      // ── 1. Save response immediately (scoring = pending) ─────────────────
      const response = await RecruitFormResponse.create({
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
      });

      // ── 2. Increment counter (fire-and-forget; OK to drift by ±1 rarely) ─
      RecruitForm.findByIdAndUpdate(form._id, { $inc: { responseCount: 1 } }).catch(e =>
        console.error("[forms] counter increment failed (non-fatal):", e)
      );

      // ── 3. Return 201 immediately — candidate is done ─────────────────────
      res.status(201).json({ ok: true, responseId: response._id });

      // ── 4. Score in background and patch result ───────────────────────────
      const textAnswers: ScoredAnswer[] = rawAnswers
        .filter(a => a.value?.trim() && a.value !== "__file_uploaded__")
        .map(a => ({ questionId: a.questionId, label: a.label, value: a.value }));

      setImmediate(async () => {
        try {
          const scored = await scoreFormResponse({
            formTitle: form.title,
            answers: textAnswers,
            resumeText: resumeText || undefined,
          });
          await RecruitFormResponse.findByIdAndUpdate(response._id, {
            $set: {
              aiSummary: scored.aiSummary,
              aiScore: scored.aiScore,
              strengths: scored.strengths,
              redFlags: scored.redFlags,
              answerSignals: scored.answerSignals,
              scoringFailed: scored.scoringFailed,
            },
          });
        } catch (e) {
          console.error("[forms] background scoring failed (non-fatal):", e);
        }
      });

    } catch (err: any) {
      console.error("[forms] POST submit:", err);
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
