import cron from "node-cron";
import { connectMongo } from "../db";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { RecruitJob } from "../models/RecruitJob";
import { User } from "../models/User";
import { sendEmail } from "../mailer";
import * as emailTemplates from "../emailTemplates";

const FRONTEND_URL = (() => {
  const raw = process.env.FRONTEND_URL ?? "";
  if (raw && !raw.includes("localhost") && !raw.includes("127.0.0.1")) return raw.replace(/\/$/, "");
  return "https://www.rolebolt.tech";
})();
const CANDIDATE_FROM     = `Rolebolt <${process.env.CANDIDATE_FROM_EMAIL ?? "notification@rolebolt.tech"}>`;
const NOTIFICATION_FROM  = `Rolebolt <${process.env.NOTIFICATION_FROM_EMAIL ?? "notification@rolebolt.tech"}>`;

// ── Auto-expire offers whose expiry date has passed ──────────────────────────
export async function processOfferExpiry(): Promise<void> {
  await connectMongo();
  const now = new Date();

  // Find candidates with a sent (non-responded) offer
  const candidates = await RecruitCandidate.find({
    offerStatus: "sent",
    offerCandidateStatus: { $in: ["pending", "viewed", null] },
    "offerDetails.offerExpiryDate": { $exists: true, $ne: "" },
  });

  for (const candidate of candidates) {
    const expiryStr = (candidate.offerDetails as any)?.offerExpiryDate;
    if (!expiryStr) continue;
    const expiryDate = new Date(expiryStr);
    if (isNaN(expiryDate.getTime()) || expiryDate > now) continue;

    // Mark expired
    (candidate as any).offerStatus          = "expired";
    (candidate as any).offerCandidateStatus = "expired";
    (candidate.offerLog as any[]).push({
      action: "offer_expired",
      note: `Offer automatically marked expired (deadline: ${expiryDate.toLocaleDateString()})`,
      timestamp: new Date(),
    });
    await candidate.save();
    console.log(`[offer-cron] Marked offer expired for candidate ${candidate._id}`);

    // Notify recruiter
    setImmediate(async () => {
      try {
        const user = await User.findOne({ uid: candidate.uid }).lean() as any;
        if (!user?.email) return;
        const job = await RecruitJob.findById(candidate.jobId).lean() as any;
        const html = emailTemplates.offerExpiryWarning(
          user.name || user.email,
          candidate.name,
          job?.title || "Unknown Role",
          0
        );
        await sendEmail({
          to: user.email,
          subject: `Offer Expired — ${candidate.name}`,
          html,
          text: `The offer for ${candidate.name} (${job?.title || ""}) has expired.`,
          from: NOTIFICATION_FROM,
        });
      } catch (err) {
        console.error("[offer-cron] Failed to send expiry notification:", err);
      }
    });
  }
}

// ── Warn recruiters about offers expiring soon (1 and 3 days out) ─────────────
export async function processExpiryWarnings(): Promise<void> {
  await connectMongo();
  const now = new Date();
  const warningDays = [1, 3];

  const candidates = await RecruitCandidate.find({
    offerStatus: "sent",
    offerCandidateStatus: { $in: ["pending", "viewed", null] },
    "offerDetails.offerExpiryDate": { $exists: true, $ne: "" },
  });

  for (const candidate of candidates) {
    const expiryStr = (candidate.offerDetails as any)?.offerExpiryDate;
    if (!expiryStr) continue;
    const expiryDate = new Date(expiryStr);
    if (isNaN(expiryDate.getTime())) continue;

    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (!warningDays.includes(daysLeft)) continue;

    // Check we haven't already sent a warning for this day (use offerLog)
    const alreadySent = (candidate.offerLog as any[]).some(
      (e: any) => e.action === "expiry_warning_sent" && e.note?.includes(`${daysLeft} day`)
    );
    if (alreadySent) continue;

    setImmediate(async () => {
      try {
        const user = await User.findOne({ uid: candidate.uid }).lean() as any;
        if (!user?.email) return;
        const job = await RecruitJob.findById(candidate.jobId).lean() as any;
        const html = emailTemplates.offerExpiryWarning(
          user.name || user.email,
          candidate.name,
          job?.title || "Unknown Role",
          daysLeft
        );
        await sendEmail({
          to: user.email,
          subject: `Offer expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — ${candidate.name}`,
          html,
          text: `The offer for ${candidate.name} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
          from: NOTIFICATION_FROM,
        });
        (candidate.offerLog as any[]).push({
          action: "expiry_warning_sent",
          note: `Recruiter notified — offer expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          timestamp: new Date(),
        });
        await candidate.save();
      } catch (err) {
        console.error("[offer-cron] Failed to send expiry warning:", err);
      }
    });
  }
}

// ── Send automated reminder emails to candidates who haven't responded ────────
export async function processOfferReminders(): Promise<void> {
  await connectMongo();
  const now = new Date();

  const candidates = await RecruitCandidate.find({
    offerStatus: "sent",
    offerCandidateStatus: { $in: ["pending", "viewed", null] },
    "offerReminderConfig.enabled": true,
    offerToken: { $exists: true, $ne: "" },
  });

  for (const candidate of candidates) {
    const config = candidate.offerReminderConfig as any;
    if (!config?.enabled) continue;

    const maxReminders  = config.maxReminders  ?? 3;
    const remindersSent = config.remindersSent  ?? 0;
    if (remindersSent >= maxReminders) continue;

    const delayDays = config.delayDays    ?? 2;
    const freqDays  = config.frequencyDays ?? 2;

    // Find when offer was sent via offerLog
    const sentEntry = [...(candidate.offerLog as any[])].reverse().find((e: any) => e.action === "offer_sent");
    if (!sentEntry) continue;

    const sentAt = new Date(sentEntry.timestamp);
    const lastReminder = config.lastReminderSentAt ? new Date(config.lastReminderSentAt) : null;

    const daysSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);

    let shouldSend = false;
    if (remindersSent === 0 && daysSinceSent >= delayDays) {
      shouldSend = true;
    } else if (remindersSent > 0 && lastReminder) {
      const daysSinceLast = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast >= freqDays) shouldSend = true;
    }
    if (!shouldSend) continue;

    // Check expiry
    const expiryStr = (candidate.offerDetails as any)?.offerExpiryDate;
    const expiryDate = expiryStr ? new Date(expiryStr) : null;
    if (expiryDate && expiryDate < now) continue; // already expired, skip

    const daysLeft = expiryDate
      ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    setImmediate(async () => {
      try {
        const job = await RecruitJob.findById(candidate.jobId).lean() as any;
        const jobTitle    = job?.title || "";
        const companyName = (candidate.offerDetails as any)?.companyName || job?.companyName || "";
        const offerUrl    = `${FRONTEND_URL}/recruit/offer/${(candidate as any).offerToken}`;

        const payload = emailTemplates.offerReminderEmail(
          candidate.name, jobTitle, companyName, offerUrl, daysLeft
        );
        const result = await sendEmail({
          to: candidate.email,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          from: CANDIDATE_FROM,
        });

        if (result.ok) {
          (candidate.offerReminderConfig as any).remindersSent = remindersSent + 1;
          (candidate.offerReminderConfig as any).lastReminderSentAt = new Date();
          (candidate.offerLog as any[]).push({
            action: "reminder_sent",
            note: `Reminder ${remindersSent + 1}/${maxReminders} sent to candidate`,
            timestamp: new Date(),
          });
          candidate.emailLog.push({
            type: "offer_reminder",
            to: candidate.email,
            subject: payload.subject,
            body: payload.text,
            sentAt: new Date(),
            status: "sent",
          } as any);
          await candidate.save();
          console.log(`[offer-cron] Reminder ${remindersSent + 1}/${maxReminders} sent to ${candidate.email}`);
        }
      } catch (err) {
        console.error("[offer-cron] Failed to send reminder:", err);
      }
    });
  }
}

// ── Main cron job entry point ─────────────────────────────────────────────────
export function startOfferManagementJob(): void {
  // Run daily at 7:00 AM UTC
  cron.schedule("0 7 * * *", async () => {
    console.log("[offer-cron] Running daily offer management job...");
    try {
      await processOfferExpiry();
      await processExpiryWarnings();
      await processOfferReminders();
      console.log("[offer-cron] Done.");
    } catch (err) {
      console.error("[offer-cron] Job error:", err);
    }
  });
  console.log("[offer-cron] Offer management cron scheduled (daily at 07:00 UTC)");
}
