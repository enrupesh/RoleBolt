import { User } from "./models/User";
import { RecruitProfile } from "./models/RecruitProfile";
import { RecruitCompanyProfile } from "./models/RecruitCompanyProfile";
import { RecruitCandidate } from "./models/RecruitCandidate";
import { RecruitFormResponse } from "./models/RecruitFormResponse";
import { RecruitForm } from "./models/RecruitForm";
import { RecruitJob } from "./models/RecruitJob";
import { sendEmail } from "./mailer";
import { CREATOR_OUTBOUND_FROM } from "./emailConfig";
import * as emailTemplates from "./emailTemplates";
import type { CreatorEmailSender } from "./emailTemplates";
import { assertStandardFeature } from "./billing/standardEnforcement";
import { assertFormFeature } from "./billing/formEnforcement";
import { runStandardBillingOperation } from "./billing/standardEnforcement";
import { runFormBillingOperation } from "./billing/formEnforcement";
import type { BillingCategory } from "./billingTypes";

export const CREATOR_EMAIL_FEATURE = "creatorEmailComposer";

export type CreatorEmailChannel = "standard" | "form";

export interface CreatorEmailRecipientInput {
  recipientId: string;
}

export async function getCreatorEmailSender(uid: string): Promise<CreatorEmailSender> {
  const [user, profile, company] = await Promise.all([
    User.findById(uid).select("email username name").lean(),
    RecruitProfile.findOne({ uid }).select("email username name").lean(),
    RecruitCompanyProfile.findOne({ uid }).select("companyName").lean(),
  ]);

  const email = String(profile?.email || user?.email || "").trim();
  const username = String(profile?.username || user?.username || "").trim();
  const companyName = String(company?.companyName || profile?.name || user?.name || "Your company").trim();

  return { email, username, companyName };
}

function sanitizeEmailBody(body: string): string {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/data-rolebolt-immutable-footer/gi, "")
    .trim();
}

async function resolveStandardRecipient(
  uid: string,
  jobId: string,
  recipientId: string,
): Promise<{ id: string; name: string; email: string; candidate: InstanceType<typeof RecruitCandidate> }> {
  const candidate = await RecruitCandidate.findOne({ _id: recipientId, jobId, uid });
  if (!candidate) throw new Error("Candidate not found.");
  const email = candidate.email?.trim();
  if (!email) throw new Error(`${candidate.name || "Candidate"} has no email address on file.`);
  return { id: String(candidate._id), name: candidate.name || "Candidate", email, candidate };
}

async function resolveFormRecipient(
  uid: string,
  formId: string,
  recipientId: string,
): Promise<{ id: string; name: string; email: string; response: InstanceType<typeof RecruitFormResponse> }> {
  const response = await RecruitFormResponse.findOne({ _id: recipientId, formId, uid });
  if (!response) throw new Error("Applicant not found.");
  const email = response.submittedEmail?.trim();
  if (!email) throw new Error(`${response.submittedName || "Applicant"} has no email address on file.`);
  return { id: String(response._id), name: response.submittedName || "Applicant", email, response };
}

export async function sendCreatorPremiumEmails(args: {
  uid: string;
  channel: CreatorEmailChannel;
  contextId: string;
  recipients: CreatorEmailRecipientInput[];
  subject: string;
  body: string;
  idempotencySeed: string;
}): Promise<{
  sent: number;
  failed: number;
  results: Array<{
    recipientId: string;
    email: string;
    status: "sent" | "failed";
    error?: string;
    logEntry?: Record<string, unknown>;
  }>;
}> {
  const subject = args.subject.trim();
  const body = sanitizeEmailBody(args.body);
  if (!subject || !body) {
    throw new Error("Subject and message body are required.");
  }
  if (!Array.isArray(args.recipients) || args.recipients.length === 0) {
    throw new Error("Select at least one recipient.");
  }
  if (args.recipients.length > 50) {
    throw new Error("You can email up to 50 candidates at once.");
  }

  const category: BillingCategory = args.channel === "standard" ? "creator_standard" : "creator_form";
  if (args.channel === "standard") {
    await assertStandardFeature(args.uid, CREATOR_EMAIL_FEATURE);
    const job = await RecruitJob.findOne({ _id: args.contextId, uid: args.uid }).lean();
    if (!job) throw new Error("Job not found.");
  } else {
    await assertFormFeature(args.uid, CREATOR_EMAIL_FEATURE);
    const form = await RecruitForm.findOne({ _id: args.contextId, uid: args.uid }).lean();
    if (!form) throw new Error("Form not found.");
  }

  const sender = await getCreatorEmailSender(args.uid);
  if (!sender.email) {
    throw new Error("Your account must have an email address before sending candidate emails.");
  }

  const results: Array<{
    recipientId: string;
    email: string;
    status: "sent" | "failed";
    error?: string;
    logEntry?: Record<string, unknown>;
  }> = [];

  let sent = 0;
  let failed = 0;

  for (const [index, item] of args.recipients.entries()) {
    const recipientId = String(item.recipientId || "").trim();
    if (!recipientId) continue;

    try {
      if (args.channel === "standard") {
        const resolved = await resolveStandardRecipient(args.uid, args.contextId, recipientId);
        const payload = emailTemplates.creatorPremiumCandidateEmail({
          candidateName: resolved.name,
          subject,
          body,
          sender,
        });

        const billingResult = await runStandardBillingOperation({
          ownerUid: args.uid,
          operation: "creator_premium_email_standard",
          idempotencyKey: `${args.idempotencySeed}:${recipientId}:${index}`,
          resourceType: "candidate",
          resourceId: resolved.id,
          work: async () =>
            sendEmail({
              to: resolved.email,
              subject: payload.subject,
              html: payload.html,
              text: payload.text,
              from: CREATOR_OUTBOUND_FROM,
            }),
        });

        const logEntry = {
          type: "creator_premium",
          to: resolved.email,
          subject,
          body,
          sentAt: new Date(),
          status: (billingResult.ok ? "sent" : "failed") as "sent" | "failed",
          error: billingResult.error,
        };
        resolved.candidate.emailLog.push(logEntry as any);
        await resolved.candidate.save();

        if (!billingResult.ok) {
          failed += 1;
          results.push({
            recipientId: resolved.id,
            email: resolved.email,
            status: "failed",
            error: billingResult.error,
            logEntry,
          });
        } else {
          sent += 1;
          results.push({ recipientId: resolved.id, email: resolved.email, status: "sent", logEntry });
        }
      } else {
        const resolved = await resolveFormRecipient(args.uid, args.contextId, recipientId);
        const payload = emailTemplates.creatorPremiumCandidateEmail({
          candidateName: resolved.name,
          subject,
          body,
          sender,
        });

        const billingResult = await runFormBillingOperation({
          ownerUid: args.uid,
          operation: "creator_premium_email_form",
          idempotencyKey: `${args.idempotencySeed}:${recipientId}:${index}`,
          resourceType: "form_response",
          resourceId: resolved.id,
          work: async () =>
            sendEmail({
              to: resolved.email,
              subject: payload.subject,
              html: payload.html,
              text: payload.text,
              from: CREATOR_OUTBOUND_FROM,
            }),
        });

        const logEntry = {
          type: "creator_premium",
          to: resolved.email,
          subject,
          body,
          sentAt: new Date(),
          status: (billingResult.ok ? "sent" : "failed") as "sent" | "failed",
          error: billingResult.error,
        };
        resolved.response.emailLog.push(logEntry as any);
        await resolved.response.save();

        if (!billingResult.ok) {
          failed += 1;
          results.push({
            recipientId: resolved.id,
            email: resolved.email,
            status: "failed",
            error: billingResult.error,
            logEntry,
          });
        } else {
          sent += 1;
          results.push({ recipientId: resolved.id, email: resolved.email, status: "sent", logEntry });
        }
      }
    } catch (error: unknown) {
      failed += 1;
      results.push({
        recipientId,
        email: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to send email.",
      });
    }
  }

  return { sent, failed, results };
}
