import type { CandidateStage } from "@/app/recruit/jobs/[id]/jobDetailTypes";

export type StageEmailNotifyStage = Exclude<CandidateStage, "applied">;

export const STAGE_EMAIL_NOTIFY_STAGES: StageEmailNotifyStage[] = [
  "review_zone",
  "screened",
  "assessed",
  "interview",
  "offer",
  "hired",
  "rejected",
];

export type StageEmailContext = {
  candidateName: string;
  jobTitle: string;
  companyName: string;
};

export type InterviewEmailFields = {
  interviewDate: string;
  interviewTime: string;
  timezone: string;
  meetLink: string;
  calendarLink: string;
  location: string;
  instructions: string;
  notes: string;
};

export const DEFAULT_INTERVIEW_FIELDS: InterviewEmailFields = {
  interviewDate: "",
  interviewTime: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  meetLink: "",
  calendarLink: "",
  location: "",
  instructions: "",
  notes: "",
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function stageEmailPromptText(stage: StageEmailNotifyStage): string {
  const labels: Record<StageEmailNotifyStage, string> = {
    review_zone: "an update that their application is under review",
    screened: "a Screened email",
    assessed: "an Assessed-stage email",
    interview: "an Interview invitation email",
    offer: "an Offer email",
    hired: "a welcome / hiring confirmation email",
    rejected: "a rejection email",
  };
  return `Would you like to send ${labels[stage]} to this candidate?`;
}

export function stageEmailPromptTitle(stage: StageEmailNotifyStage): string {
  const titles: Record<StageEmailNotifyStage, string> = {
    review_zone: "Send review update?",
    screened: "Send Screened email?",
    assessed: "Send Assessed email?",
    interview: "Send Interview invitation?",
    offer: "Send Offer email?",
    hired: "Send welcome email?",
    rejected: "Send rejection email?",
  };
  return titles[stage];
}

export function buildInterviewEmailBody(
  ctx: StageEmailContext,
  fields: InterviewEmailFields,
): string {
  const { candidateName, jobTitle, companyName } = ctx;
  const co = companyName ? ` at ${companyName}` : "";
  const lines: string[] = [
    `Hi ${firstName(candidateName)},`,
    "",
    `Congratulations! You have been selected to move forward to the interview round for the ${jobTitle}${co} role.`,
    "",
    "Interview Details:",
  ];

  if (fields.interviewDate) lines.push(`• Date: ${fields.interviewDate}`);
  if (fields.interviewTime) {
    const tz = fields.timezone ? ` (${fields.timezone})` : "";
    lines.push(`• Time: ${fields.interviewTime}${tz}`);
  }
  if (fields.meetLink) {
    lines.push(`• Join link: ${fields.meetLink}`);
  } else if (fields.location) {
    lines.push(`• Location: ${fields.location}`);
  }
  if (fields.calendarLink) lines.push(`• Calendar invite: ${fields.calendarLink}`);
  if (fields.instructions.trim()) {
    lines.push("");
    lines.push("Instructions:");
    lines.push(fields.instructions.trim());
  }
  if (fields.notes.trim()) {
    lines.push("");
    lines.push("Additional notes:");
    lines.push(fields.notes.trim());
  }

  lines.push(
    "",
    "What happens next: After the interview, the hiring team will review your conversation and decide whether you move forward to the next stage.",
    "",
    "We look forward to speaking with you!",
    "",
    `Warm regards,`,
    `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
  );

  return lines.join("\n");
}

export function buildStageEmailDefaults(
  stage: StageEmailNotifyStage,
  ctx: StageEmailContext,
  extras?: { interviewFields?: InterviewEmailFields; startDate?: string },
): { subject: string; body: string } {
  const { candidateName, jobTitle, companyName } = ctx;
  const co = companyName ? ` at ${companyName}` : "";
  const fn = firstName(candidateName);

  switch (stage) {
    case "review_zone":
      return {
        subject: "Your application is under review",
        body: [
          `Hi ${fn},`,
          "",
          `Thank you for applying for the ${jobTitle}${co} position.`,
          "",
          "We have successfully received your application, and it is currently under review by our hiring team.",
          "",
          "If your profile is selected for the next stage, we will contact you with further details.",
          "",
          "Thank you for your interest in joining our team.",
          "",
          "Best regards,",
          companyName || "The Hiring Team",
        ].join("\n"),
      };

    case "screened":
      return {
        subject: `You've been screened — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `Congratulations! Your application for ${jobTitle}${co} has been reviewed and you have been screened for the next stage of our hiring process.`,
          "",
          "What happens next: After you complete each step, the hiring team reviews your progress and decides whether you move forward — for example, to an interview or the next stage.",
          "",
          "Our team will reach out with next steps soon. Please keep an eye on your inbox.",
          "",
          "Warm regards,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    case "assessed":
      return {
        subject: `Assessment received — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `Thank you for completing your assessment for the ${jobTitle}${co} role.`,
          "",
          "Our hiring team is now reviewing your responses. We appreciate the time and effort you put into your answers.",
          "",
          "What happens next: We will evaluate your assessment alongside your application and contact you if you are selected to move forward — for example, to an interview.",
          "",
          "Warm regards,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    case "interview":
      return {
        subject: `Interview Invitation — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: buildInterviewEmailBody(ctx, extras?.interviewFields ?? DEFAULT_INTERVIEW_FIELDS),
      };

    case "offer":
      return {
        subject: `Job Offer — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `We are delighted to extend an offer for the ${jobTitle}${co} role.`,
          "",
          "Please find the key details of your offer below. We would love for you to join our team and contribute to what we are building.",
          "",
          "[Add offer details here — role, start date, compensation, and any other terms.]",
          "",
          "To accept this offer, please reply to this email with your confirmation. If you have any questions, we are happy to discuss.",
          "",
          "Congratulations, and we hope to welcome you aboard!",
          "",
          "Warm regards,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    case "hired":
      return {
        subject: `Welcome to the team, ${fn}!`,
        body: [
          `Hi ${fn},`,
          "",
          "We are absolutely thrilled to officially welcome you to the team!",
          "",
          `You have been selected for the ${jobTitle}${co}${extras?.startDate ? `, starting ${extras.startDate}` : ""}.`,
          "",
          "You will hear from us very soon with onboarding details and everything you need to get started. We are genuinely excited to have you with us.",
          "",
          "Welcome aboard,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    case "rejected":
      return {
        subject: `Update on your application — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `Thank you for your interest in the ${jobTitle}${co} role and for the time you invested in our process.`,
          "",
          "After careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.",
          "",
          "We genuinely appreciate your effort and encourage you to apply for future openings that match your background.",
          "",
          "We wish you all the best in your job search.",
          "",
          "Warm regards,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    default:
      return { subject: `Update — ${jobTitle}`, body: "" };
  }
}

export function emailTypeForStage(stage: StageEmailNotifyStage): string {
  if (stage === "rejected") return "rejected";
  if (stage === "offer") return "offer";
  return stage;
}
