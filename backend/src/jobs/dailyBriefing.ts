import cron from "node-cron";
import { connectMongo } from "../db";
import { User } from "../models/User";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { RecruitJobAlert } from "../models/RecruitJobAlert";
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

// ── Send job alerts to subscribers ───────────────────────────────────────────
export async function sendJobAlerts(): Promise<void> {
  await connectMongo();
  const alerts = await RecruitJobAlert.find({}).lean() as any[];
  if (!alerts.length) return;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newJobs = await RecruitJob.find({ status: "active", createdAt: { $gte: yesterday } }).lean() as any[];
  if (!newJobs.length) { console.log("[alerts] No new jobs in last 24h, skipping"); return; }

  let sent = 0;
  for (const alert of alerts) {
    try {
      // Filter jobs by alert preferences
      const matching = newJobs.filter((job: any) => {
        if (alert.niche && job.niche !== alert.niche) return false;
        if (alert.workMode && job.workMode && job.workMode !== alert.workMode) return false;
        if (alert.freshersOnly && !job.freshersAllowed) return false;
        if (alert.verifiedOnly && !job.verifiedCompany) return false;
        if (alert.keywords) {
          const kws = (alert.keywords as string).toLowerCase().split(/[\s,]+/).filter(Boolean);
          const haystack = `${job.title ?? ""} ${job.mustHaveSkills ?? ""} ${job.niche ?? ""} ${job.location ?? ""}`.toLowerCase();
          if (!kws.some((k: string) => haystack.includes(k))) return false;
        }
        return true;
      });

      if (!matching.length) continue;

      const topJobs = matching.slice(0, 5);
      const jobLines = topJobs.map((j: any) =>
        `<li style="margin-bottom:8px"><strong>${j.title}</strong> — ${j.companyName ?? "Company"} · ${j.location ?? "Remote"} · ${j.workMode ?? ""}</li>`
      ).join("");

      const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#4f46e5;margin-bottom:4px">🎯 ${topJobs.length} new job match${topJobs.length > 1 ? "es" : ""} for you</h2>
<p style="color:#64748b;margin-top:0">Fresh listings matching your alert:</p>
<ul style="padding-left:20px;color:#1e293b">${jobLines}</ul>
<a href="https://www.rolebolt.tech/recruit/opportunities" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
  View all jobs →
</a>
<p style="margin-top:24px;font-size:12px;color:#94a3b8">You're receiving this because you subscribed to job alerts at Rolebolt.</p>
</div>`;

      await sendEmail({
        to: alert.email,
        subject: `🎯 ${topJobs.length} new job match${topJobs.length > 1 ? "es" : ""} — Rolebolt`,
        html,
        text: `${topJobs.length} new job${topJobs.length > 1 ? "s" : ""} match your alert. Visit https://www.rolebolt.tech/recruit/opportunities to apply.`,
      });
      await RecruitJobAlert.updateOne({ _id: alert._id }, { lastCheckedAt: new Date() });
      sent++;
    } catch (e) {
      console.error("[alerts] Failed for", alert.email, e);
    }
  }
  console.log(`[alerts] Sent job alerts to ${sent}/${alerts.length} subscribers`);
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

    // Send job alerts to subscribers
    try {
      await sendJobAlerts();
    } catch (e) {
      console.error("[briefing] sendJobAlerts failed:", e);
    }
  }, { timezone: "UTC" });
  console.log("[briefing] Daily briefing cron scheduled (8:00 AM UTC)");
}
