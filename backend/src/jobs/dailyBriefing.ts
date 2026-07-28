import cron from "node-cron";
import { connectMongo } from "../db";
import { User } from "../models/User";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { sendEmail } from "../mailer";
import { callGeminiChain } from "../ai/geminiClient";
import { callMeshChatCompletions } from "../ai/meshClient";
import { callNvidia } from "../ai/nvidiaClient";
import * as emailTemplates from "../emailTemplates";

const MESH_KEY = process.env.GEMINI_MESH_KEY ?? "";

// ── AI fallback chain ─────────────────────────────────────────────────────────
async function callAI(prompt: string): Promise<string> {
  try {
    const r = await callGeminiChain({ prompt });
    if (r) return r;
  } catch (e) { console.error("[briefing] Gemini failed:", e); }
  try {
    const r = await callMeshChatCompletions({
      apiKey: MESH_KEY,
      messages: [{ role: "user", content: prompt }],
    });
    if (r) return r;
  } catch (e) { console.error("[briefing] Mesh failed:", e); }
  return await callNvidia({ messages: [{ role: "user", content: prompt }] });
}

// ── Generate + send briefing for one user ─────────────────────────────────────
export async function generateBriefingForUser(userId: string): Promise<void> {
  await connectMongo();
  const user = await User.findById(userId).lean() as any;
  if (!user || !user.isVerified || !user.email) return;

  const jobs = await RecruitJob.find({ uid: userId, status: "active" }).lean() as any[];
  if (jobs.length === 0) return;

  const jobIds = jobs.map((j: any) => j._id);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newApps, pendingReview, inInterview] = await Promise.all([
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, createdAt: { $gte: yesterday } }),
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, stage: "applied" }),
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, stage: "interview" }),
  ]);

  // Stale jobs: active but < 3 applications in last 14 days
  const staleJobs: string[] = [];
  for (const job of jobs) {
    const recentApps = await RecruitCandidate.countDocuments({
      jobId: job._id,
      createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    });
    if (recentApps < 3) staleJobs.push(job.title);
  }

  const name = user.name || user.email.split("@")[0];

  const prompt = `You are an AI hiring assistant. Generate a brief, actionable morning briefing for a recruiter.

DATA:
- Recruiter name: ${name}
- Active jobs: ${jobs.length} (${jobs.map((j: any) => j.title).join(", ")})
- New applications in last 24h: ${newApps}
- Candidates awaiting review: ${pendingReview}
- Candidates in interview stage: ${inInterview}
- Stale jobs (low applications in 14 days): ${staleJobs.length > 0 ? staleJobs.join(", ") : "none"}

Write a 3-paragraph briefing:
1. Quick summary of overnight activity
2. Today's top priority action (be specific — name which job, which candidate stage, etc.)
3. One actionable insight to improve hiring velocity

Rules: Under 200 words total. Conversational tone, not robotic. No bullet points — flowing paragraphs only. Address recruiter by first name.`;

  let briefingText = "";
  try {
    briefingText = await callAI(prompt);
  } catch {
    briefingText = `Good morning ${name}! Here's your hiring summary for today: you have ${newApps} new application${newApps !== 1 ? "s" : ""} in the last 24 hours and ${pendingReview} candidate${pendingReview !== 1 ? "s" : ""} awaiting your review across ${jobs.length} active job${jobs.length !== 1 ? "s" : ""}. ${inInterview > 0 ? `${inInterview} candidate${inInterview !== 1 ? "s are" : " is"} currently in the interview stage — worth following up on today.` : ""} ${staleJobs.length > 0 ? `Consider refreshing these listings to attract more applicants: ${staleJobs.join(", ")}.` : "Your active jobs are receiving healthy interest."}`;
  }

  const html = emailTemplates.dailyBriefing(name, briefingText, {
    newApps, pendingReview, inInterview, activeJobs: jobs.length, staleJobs,
  });

  await sendEmail({
    to: user.email,
    subject: `☀️ Your Daily Hiring Briefing — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
    html,
    text: briefingText,
  });

  console.log(`[briefing] Sent to ${user.email}`);
}

// ── Cron job: runs at 8:00 AM UTC every day ───────────────────────────────────
export function startDailyBriefingJob(): void {
  cron.schedule("0 8 * * *", async () => {
    console.log("[briefing] Running daily briefing cron...");
    try {
      await connectMongo();
      const users = await User.find({ isVerified: true }).lean() as any[];
      let sent = 0;
      for (const user of users) {
        try {
          await generateBriefingForUser(user._id.toString());
          sent++;
        } catch (e) {
          console.error("[briefing] Failed for user:", user.email, e);
        }
      }
      console.log(`[briefing] Done — sent to ${sent}/${users.length} users`);
    } catch (e) {
      console.error("[briefing] Cron job failed:", e);
    }
  }, { timezone: "UTC" });
  console.log("[briefing] Daily briefing cron scheduled (8:00 AM UTC)");
}
