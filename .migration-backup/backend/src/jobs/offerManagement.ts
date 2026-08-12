import cron from "node-cron";
import { connectMongo } from "../db";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { RecruitJob } from "../models/RecruitJob";
import { User } from "../models/User";
import { sendEmail } from "../mailer";
import { NOTIFICATION_FROM } from "../emailConfig";
import * as emailTemplates from "../emailTemplates";
import {
  tryBackgroundBillingOperation,
  backgroundIdempotencyKey,
} from "../billing/backgroundEnforcement";

const FRONTEND_URL = (() => {
  const raw = process.env.FRONTEND_URL ?? "";
  if (raw && !raw.includes("localhost") && !raw.includes("127.0.0.1")) return raw.replace(/\/$/, "");
  return "https://www.rolebolt.tech";
})();
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

    // Phase 4: the mark-expired status transition above is a pure DB update and
    // proceeds without metering. The recruiter notification email is a metered
    // creator email, gated + metered at execution time via
    // tryBackgroundBillingOperation (skipped if the owner's billing is blocked).
    // Awaited (not fire-and-forget) so the reserve→commit completes.
    const candidateId = String(candidate._id);
    const ownerUid = String(candidate.uid ?? "");
    const outcome = await tryBackgroundBillingOperation({
      ownerUid,
      category: "creator_standard",
      operation: "automated_email_standard",
      idempotencyKey: backgroundIdempotencyKey(ownerUid, ["offer-expired-email", candidateId]),
      resourceType: "candidate",
      resourceId: candidateId,
      work: async () => {
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
      },
    });
    if (!outcome.ok) {
      console.log(`[offer-cron] Skipped expiry notification for candidate ${candidateId} — billing blocked: ${outcome.reason}`);
    }
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

    // Phase 4: metered creator email — gate + meter at execution time with a
    // stable per-candidate per-daysLeft idempotency key so re-runs don't double
    // charge. Awaited so reserve→commit completes; skipped if billing blocked.
    const candidateId = String(candidate._id);
    const ownerUid = String(candidate.uid ?? "");
    const outcome = await tryBackgroundBillingOperation({
      ownerUid,
      category: "creator_standard",
      operation: "automated_email_standard",
      idempotencyKey: backgroundIdempotencyKey(ownerUid, ["offer-expiry-warning", candidateId, String(daysLeft)]),
      resourceType: "candidate",
      resourceId: candidateId,
      work: async () => {
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
      },
    });
    if (!outcome.ok) {
      console.log(`[offer-cron] Skipped expiry warning for candidate ${candidateId} — billing blocked: ${outcome.reason}`);
    }
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

    // Phase 4: candidate-facing offer reminder is an automated creator email —
    // gate + meter at execution time. Idempotency key is stable per reminder
    // number (remindersSent + 1) so a re-run for the same attempt does not double
    // charge. Awaited so reserve→commit completes; skipped if billing blocked.
    // If the provider send fails we throw so the reservation is not committed and
    // a later run can retry under the same key without charging twice.
    const candidateId = String(candidate._id);
    const ownerUid = String(candidate.uid ?? "");
    try {
      const outcome = await tryBackgroundBillingOperation({
        ownerUid,
        category: "creator_standard",
        operation: "automated_email_standard",
        idempotencyKey: backgroundIdempotencyKey(ownerUid, ["offer-reminder", candidateId, String(remindersSent + 1)]),
        resourceType: "candidate",
        resourceId: candidateId,
        work: async () => {
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
            from: NOTIFICATION_FROM,
          });

          if (!result.ok) {
            throw new Error(`offer reminder send failed for candidate ${candidateId}`);
          }

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
        },
      });
      if (!outcome.ok) {
        console.log(`[offer-cron] Skipped reminder for candidate ${candidateId} — billing blocked: ${outcome.reason}`);
      }
    } catch (err) {
      console.error("[offer-cron] Failed to send reminder:", err);
    }
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
