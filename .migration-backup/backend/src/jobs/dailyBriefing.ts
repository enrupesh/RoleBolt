import cron from "node-cron";
import { connectMongo } from "../db";
import { User } from "../models/User";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { RecruitJobAlert } from "../models/RecruitJobAlert";
import { RecruitForm } from "../models/RecruitForm";
import { RecruitFormResponse } from "../models/RecruitFormResponse";
import { sendEmail } from "../mailer";
import { NOTIFICATION_FROM } from "../emailConfig";
import { callGemini } from "../ai/geminiClient";
import { callMeshChatCompletions } from "../ai/meshClient";
import { callNvidia } from "../ai/nvidiaClient";
import * as emailTemplates from "../emailTemplates";
import { getEntitlement } from "../billing/entitlements";
import {
  tryBackgroundBillingOperation,
  backgroundIdempotencyKey,
} from "../billing/backgroundEnforcement";

const MESH_KEY = process.env.GEMINI_MESH_KEY ?? "";

// ── AI fallback chain ─────────────────────────────────────────────────────────
async function callAI(prompt: string): Promise<string> {
  try {
    // A briefing is intentionally kept to one quick model attempt per
    // provider. The full model chains are useful for large AI workflows, but
    // they make a simple email wait through several sequential timeouts.
    const r = await callGemini({
      model: "gemini-2.5-flash-lite",
      prompt,
      maxOutputTokens: 500,
      timeoutMs: 12_000,
    });
    if (r) return r;
  } catch (e) { console.error("[briefing] Gemini failed:", e); }
  try {
    if (MESH_KEY) {
      const r = await callMeshChatCompletions({
        apiKey: MESH_KEY,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        timeoutMs: 12_000,
        retries: 0,
      });
      if (r) return r;
    }
  } catch (e) { console.error("[briefing] Mesh failed:", e); }
  return await callNvidia({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    timeoutMs: 12_000,
    models: ["meta/llama-3.1-405b-instruct"],
  });
}

// ── Generate + send briefing for one user ─────────────────────────────────────
export async function generateBriefingForUser(
  userId: string,
  options: { idempotencyKey?: string; automatic?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  await connectMongo();
  const user = await User.findById(userId).lean() as any;
  if (!user || !user.isVerified || !user.email) {
    return { sent: false, reason: "recipient_unavailable" };
  }
  if (options.automatic) {
    const entitlement = await getEntitlement(userId, "creator_standard");
    if (entitlement.plan !== "ultra") {
      return { sent: false, reason: "automatic_delivery_not_available" };
    }
  }

  const [jobs, forms] = await Promise.all([
    RecruitJob.find({ uid: userId, status: "active" }).lean() as Promise<any[]>,
    RecruitForm.find({ uid: userId, status: "active" }).lean() as Promise<any[]>,
  ]);
  if (jobs.length === 0 && forms.length === 0) {
    return { sent: false, reason: "no_active_roles" };
  }

  const jobIds = jobs.map((j: any) => j._id);
  const formIds = forms.map((f: any) => f._id);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    newJobApps, pendingJobReview, inJobInterview,
    newFormApps, pendingFormReview, inFormInterview,
    pendingFormAssessments, failedFormScoring,
  ] = await Promise.all([
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, createdAt: { $gte: yesterday } }),
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, stage: "applied" }),
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, stage: "interview" }),
    RecruitFormResponse.countDocuments({ formId: { $in: formIds }, createdAt: { $gte: yesterday } }),
    RecruitFormResponse.countDocuments({ formId: { $in: formIds }, stage: "new" }),
    RecruitFormResponse.countDocuments({ formId: { $in: formIds }, stage: "interview" }),
    // Assessments sent but not yet completed
    RecruitFormResponse.countDocuments({ formId: { $in: formIds }, assessmentStatus: { $in: ["sent", "started"] } }),
    // Responses where AI scoring failed and needs retry
    RecruitFormResponse.countDocuments({ formId: { $in: formIds }, scoringFailed: true }),
  ]);

  // Form applicants are applicants — the briefing counts both job types.
  const newApps = newJobApps + newFormApps;
  const pendingReview = pendingJobReview + pendingFormReview;
  const inInterview = inJobInterview + inFormInterview;

  const [staleJobResults, staleFormResults, topFormCandidates] = await Promise.all([
    // Stale jobs: active but < 3 applications in last 14 days
    Promise.all(jobs.map(async (job: any) => {
      const recentApps = await RecruitCandidate.countDocuments({
        jobId: job._id,
        createdAt: { $gte: twoWeeksAgo },
      });
      return recentApps < 3 ? job.title : null;
    })),
    // Stale forms: active but < 3 submissions in last 14 days
    Promise.all(forms.map(async (form: any) => {
      const recentSubs = await RecruitFormResponse.countDocuments({
        formId: form._id,
        createdAt: { $gte: twoWeeksAgo },
      });
      return recentSubs < 3 ? form.title : null;
    })),
    // Top Form candidates (highest scoring, not yet shortlisted or higher)
    RecruitFormResponse.find({
      formId: { $in: formIds },
      scoringFailed: { $ne: true },
      aiScore: { $gte: 70 },
      stage: { $in: ["new", "scored", "review_zone"] },
    })
      .sort({ aiScore: -1 })
      .limit(3)
      .select("submittedName aiScore formId")
      .lean(),
  ]);
  const staleJobs = staleJobResults.filter((title): title is string => Boolean(title));
  const staleForms = staleFormResults.filter((title): title is string => Boolean(title));

  const name = user.name || user.email.split("@")[0];

  // Build form-specific insights line
  const formInsights: string[] = [];
  if (pendingFormAssessments > 0) formInsights.push(`${pendingFormAssessments} form assessment${pendingFormAssessments !== 1 ? "s" : ""} pending completion`);
  if (failedFormScoring > 0) formInsights.push(`${failedFormScoring} form submission${failedFormScoring !== 1 ? "s" : ""} need scoring retry`);
  if (topFormCandidates.length > 0) formInsights.push(`${topFormCandidates.length} high-scoring form applicant${topFormCandidates.length !== 1 ? "s" : ""} (70%+) still in early stages`);
  if (staleForms.length > 0) formInsights.push(`low recent traffic on form${staleForms.length !== 1 ? "s" : ""}: ${staleForms.join(", ")}`);

  const prompt = `You are an AI hiring assistant. Generate a brief, actionable morning briefing for a recruiter.

DATA:
- Recruiter name: ${name}
- Active jobs: ${jobs.length} (${jobs.map((j: any) => j.title).join(", ") || "none"})
- Active application forms: ${forms.length} (${forms.map((f: any) => f.title).join(", ") || "none"})
- New applications in last 24h: ${newApps}${forms.length > 0 ? ` (${newFormApps} via application forms)` : ""}
- Form applicants awaiting review: ${pendingFormReview}
- Candidates in interview stage: ${inInterview}
- Stale jobs (low applications in 14 days): ${staleJobs.length > 0 ? staleJobs.join(", ") : "none"}
${formInsights.length > 0 ? `- Form job highlights: ${formInsights.join("; ")}` : ""}

Write a 3-paragraph briefing:
1. Quick summary of overnight activity (mention form submissions separately if significant)
2. Today's top priority action (be specific — name which job or form, which candidate stage, etc.)
3. One actionable insight — if there are high-scoring form applicants waiting or pending assessments, highlight those

Rules: Under 220 words total. Conversational tone, not robotic. No bullet points — flowing paragraphs only. Address recruiter by first name.`;

  // Phase 4: entitlement is evaluated at execution time. The daily briefing runs
  // AI generation + a metered creator email, so gate + meter with a stable
  // per-user per-UTC-day idempotency key (no double charge if the cron re-runs
  // the same day). Blocked owners (downgrade / cancel / past_due, or entitlement
  // unresolved → fail closed) are skipped without sending an email.
  const utcDay = new Date().toISOString().slice(0, 10);
  const outcome = await tryBackgroundBillingOperation({
    ownerUid: userId,
    category: "creator_standard",
    operation: "daily_briefing",
    idempotencyKey: options.idempotencyKey
      ?? backgroundIdempotencyKey(userId, ["daily-briefing", utcDay]),
    resourceType: "user",
    resourceId: userId,
    work: async () => {
      let briefingText = "";
      try {
        briefingText = await callAI(prompt);
      } catch {
        briefingText = `Good morning ${name}! Here's your hiring summary for today: you have ${newApps} new application${newApps !== 1 ? "s" : ""} in the last 24 hours and ${pendingReview} candidate${pendingReview !== 1 ? "s" : ""} awaiting your review across ${jobs.length} active job${jobs.length !== 1 ? "s" : ""}${forms.length > 0 ? ` and ${forms.length} active form${forms.length !== 1 ? "s" : ""}` : ""}. ${inInterview > 0 ? `${inInterview} candidate${inInterview !== 1 ? "s are" : " is"} currently in the interview stage — worth following up on today.` : ""} ${pendingFormAssessments > 0 ? `${pendingFormAssessments} form assessment${pendingFormAssessments !== 1 ? "s are" : " is"} still pending — follow up with those candidates.` : ""} ${staleJobs.length > 0 ? `Consider refreshing these listings: ${staleJobs.join(", ")}.` : "Your active jobs are receiving healthy interest."}`;
      }

      const html = emailTemplates.dailyBriefing(name, briefingText, {
        newApps, pendingReview, inInterview, activeJobs: jobs.length, staleJobs,
      });

      const delivery = await sendEmail({
        to: user.email,
        subject: `☀️ Your Daily Hiring Briefing — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
        html,
        text: briefingText,
        from: NOTIFICATION_FROM,
      });
      if (!delivery.ok) {
        const deliveryError = new Error(
          delivery.retryable
            ? "Email delivery could not be confirmed."
            : "The email provider rejected the briefing.",
        ) as Error & { code?: string };
        deliveryError.code = delivery.retryable
          ? "DAILY_BRIEFING_DELIVERY_UNKNOWN"
          : "DAILY_BRIEFING_DELIVERY_REJECTED";
        throw deliveryError;
      }
    },
  });

  if (!outcome.ok) {
    console.log(`[briefing] Skipped for ${user.email} — billing blocked: ${outcome.reason}`);
    return { sent: false, reason: outcome.reason };
  }

  console.log(`[briefing] Sent to ${user.email}`);
  return { sent: true };
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
        from: NOTIFICATION_FROM,
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
          await generateBriefingForUser(user._id.toString(), { automatic: true });
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
