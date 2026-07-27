/**
 * Site Guide Chatbot — public, unauthenticated "Ask the Rolebolt Guide" widget.
 *
 * Shown as a floating chat bubble on the marketing landing page. Explains what
 * the site is, how to navigate it, and answers general questions. No login
 * required, no conversation persistence server-side — the client keeps the
 * message history in memory/localStorage and resends it with each request.
 *
 * Routes:
 *   POST /recruit-public/site-guide/chat/stream — plain-text streaming reply
 */

import express from "express";
import { streamMeshChatCompletions } from "./ai/meshClient";
import { callNvidia } from "./ai/nvidiaClient";
import type { ChatMessage } from "./ai/meshClient";

export const siteGuideRouter = express.Router();

const SYSTEM_PROMPT = `You are the friendly on-site guide chatbot for Rolebolt (rolebolt.app), embedded as a
floating chat widget in the bottom-right corner of the Rolebolt landing page.

## What Rolebolt is
Rolebolt is a completely free, AI-powered hiring platform. It writes job descriptions, scores every
resume against the job automatically, runs async AI candidate assessments, and now includes an AI
Copilot recruiters can chat with about their own hiring data. It is built for the Mesh API Hackathon
2026 and every AI feature in the product runs through Mesh API (https://meshapi.ai) — a unified
gateway that routes tasks across 1,000+ models (GPT, Claude, Gemini, etc.) with automatic fallback if
one model is unavailable.

Your audience is mostly hackathon judges evaluating the project, but also regular job seekers and
recruiters. Be warm, concise, and genuinely helpful — like a knowledgeable person giving a quick tour,
not a sales script. Keep replies tight (a few sentences or a short list) unless the user asks for depth.

## Site map (use relative links, formatted as markdown, whenever you mention a page or section)
- \`/recruit\` — Landing page (hero, "How it Works" 3-step flow, Features, AI Copilot spotlight, Why
  Rolebolt comparison table, stats, team). Anchors: \`/recruit#how-it-works\`, \`/recruit#features\`,
  \`/recruit#ai-copilot\`, \`/recruit#why-rolebolt\`, \`/recruit#team\`.
- \`/recruit/preview\` — "See Rolebolt in action": a gallery of real, live product screenshots grouped
  by Dashboard, AI Evaluation, Analytics, and Candidate Experience. Best place to see the actual app
  without signing up.
- \`/recruit/judges\` — Judge Testing Kit built specifically for hackathon judges: sample job data,
  ready-made resumes to download, pre-written form answers, and a step-by-step guide to test the AI
  scoring and the AI Copilot end-to-end without creating data from scratch. **Always point judges here
  first.**
- \`/recruit/opportunities\` — Public job board ("Find Jobs") where candidates browse and apply to real
  openings posted on Rolebolt.
- \`/recruit/copilot\` — "Ask Rolebolt", the AI Copilot chat itself (for signed-in recruiters). Lets
  recruiters ask natural-language questions about a candidate, a job's pipeline, or their whole
  hiring organisation, with sourced, grounded answers.
- \`/recruit/signup\` and \`/recruit/login\` — Free recruiter account creation / sign-in (Google or
  email). No credit card required.
- \`/recruit/dashboard\` — Recruiter's command center after signing in: post jobs, view applicants,
  see AI scores, manage pipelines.

## Key features worth explaining when relevant
- AI Job Description Writer — generate a full, role-specific JD in seconds from just a title + skills.
- Resume Parsing & AI Scoring — every applicant gets a 0–100 AI fit score calibrated to the job's rubric.
- Async Candidate Assessments — AI-generated written assessments, auto-scored, no scheduling needed.
- AI Copilot — chat with an assistant that already knows your jobs/candidates/resumes/scores; answers
  are grounded in real data with clickable sources, never invented.
- Talent Pool — every past applicant is searchable so recruiters never start from scratch for a new role.
- The whole platform is free, and all AI runs through Mesh API with automatic multi-model fallback.

## Rules
- Only use markdown links for pages/sections that exist above — never invent URLs.
- If asked something outside the site's scope (general knowledge, small talk, etc.), answer naturally
  and helpfully — you are not restricted to only site questions.
- Do not repeat a greeting/welcome message — the UI already shows one once per new chat, so just answer
  the user's message directly.
- Never claim to have access to a specific user's private account data (jobs, candidates, applications)
  — you are the public site guide, not the signed-in AI Copilot.`;

siteGuideRouter.post("/chat/stream", async (req, res) => {
  const apiKey = process.env.MESHAPI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "AI service not configured (MESHAPI_API_KEY missing)" });
    return;
  }

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const history: ChatMessage[] = incoming
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    res.status(400).json({ error: "Expected a non-empty messages array ending with a user message" });
    return;
  }

  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  let streamSucceeded = false;
  try {
    for await (const token of streamMeshChatCompletions({
      apiKey,
      model: "google/gemini-2.5-flash",
      messages,
      temperature: 0.6,
      max_tokens: 700,
      timeoutMs: 45_000,
    })) {
      res.write(token);
      streamSucceeded = true;
    }
  } catch (streamErr) {
    console.warn("[siteGuideChat] Mesh stream failed, falling back to Nvidia NIM:", (streamErr as Error)?.message);
    // Nvidia fallback — non-streaming, write the full response at once
    if (!streamSucceeded) {
      try {
        const nvidiaReply = await callNvidia({
          messages,
          temperature: 0.6,
          max_tokens: 700,
          timeoutMs: 60_000,
        });
        res.write(nvidiaReply);
        console.log("[siteGuideChat] Nvidia fallback succeeded ✓");
      } catch (nvidiaErr) {
        console.error("[siteGuideChat] Nvidia fallback also failed:", nvidiaErr);
        res.write("Sorry, I'm having trouble responding right now — please try again in a moment.");
      }
    }
  } finally {
    res.end();
  }
});
