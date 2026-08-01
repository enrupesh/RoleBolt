export type FormStage =
  | "new"
  | "scored"
  | "review_zone"
  | "shortlisted"
  | "assessment"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export type FormStageEmailNotifyStage = Exclude<
  FormStage,
  "new" | "scored" | "withdrawn"
>;

export const FORM_STAGE_EMAIL_NOTIFY_STAGES: FormStageEmailNotifyStage[] = [
  "review_zone",
  "shortlisted",
  "assessment",
  "interview",
  "offer",
  "hired",
  "rejected",
];

export type FormStageEmailContext = {
  candidateName: string;
  formTitle: string;
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

export function isFormStageEmailNotifyStage(stage: FormStage): stage is FormStageEmailNotifyStage {
  return (FORM_STAGE_EMAIL_NOTIFY_STAGES as readonly string[]).includes(stage);
}

export function formStageEmailPromptText(stage: FormStageEmailNotifyStage): string {
  const labels: Record<FormStageEmailNotifyStage, string> = {
    review_zone: "an update that their application is under review",
    shortlisted: "a Shortlisted email",
    assessment: "an Assessment email",
    interview: "an Interview invitation email",
    offer: "an Offer email",
    hired: "a welcome / hiring confirmation email",
    rejected: "a rejection email",
  };
  return `Would you like to send ${labels[stage]} to this applicant?`;
}

export function formStageEmailPromptTitle(stage: FormStageEmailNotifyStage): string {
  const titles: Record<FormStageEmailNotifyStage, string> = {
    review_zone: "Send review update?",
    shortlisted: "Send Shortlisted email?",
    assessment: "Send Assessment email?",
    interview: "Send Interview invitation?",
    offer: "Send Offer email?",
    hired: "Send welcome email?",
    rejected: "Send rejection email?",
  };
  return titles[stage];
}

export function buildFormInterviewEmailBody(
  ctx: FormStageEmailContext,
  fields: InterviewEmailFields,
): string {
  const { candidateName, formTitle, companyName } = ctx;
  const co = companyName ? ` at ${companyName}` : "";
  const lines: string[] = [
    `Hi ${firstName(candidateName)},`,
    "",
    `Congratulations! You have been selected to move forward to the interview round for ${formTitle}${co}.`,
    "",
    "Interview Details:",
  ];

  if (fields.interviewDate) lines.push(`• Date: ${fields.interviewDate}`);
  if (fields.interviewTime) {
    const tz = fields.timezone ? ` (${fields.timezone})` : "";
    lines.push(`• Time: ${fields.interviewTime}${tz}`);
  }
  if (fields.meetLink) lines.push(`• Join link: ${fields.meetLink}`);
  else if (fields.location) lines.push(`• Location: ${fields.location}`);
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
    "What happens next: After the interview, we will review your conversation and contact you about next steps.",
    "",
    "We look forward to speaking with you!",
    "",
    "Warm regards,",
    `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
  );

  return lines.join("\n");
}

export function buildFormStageEmailDefaults(
  stage: FormStageEmailNotifyStage,
  ctx: FormStageEmailContext,
  extras?: { interviewFields?: InterviewEmailFields; startDate?: string },
): { subject: string; body: string } {
  const { candidateName, formTitle, companyName } = ctx;
  const co = companyName ? ` at ${companyName}` : "";
  const fn = firstName(candidateName);

  switch (stage) {
    case "review_zone":
      return {
        subject: "Your application is under review",
        body: [
          `Hi ${fn},`,
          "",
          `Thank you for applying for ${formTitle}${co}.`,
          "",
          "We have received your application and it is currently under review.",
          "",
          "If you are selected for the next stage, we will contact you with further details.",
          "",
          "Thank you for your interest!",
          "",
          "Best regards,",
          companyName || "The Hiring Team",
        ].join("\n"),
      };

    case "shortlisted":
      return {
        subject: `You've been shortlisted — ${formTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `Great news! Your application for ${formTitle}${co} has been reviewed and you have been shortlisted.`,
          "",
          "What happens next: We will reach out with next steps — this may include an assessment or interview.",
          "",
          "Please keep an eye on your inbox.",
          "",
          "Warm regards,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    case "assessment":
      return {
        subject: `Assessment — ${formTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `You have been invited to complete a written assessment for ${formTitle}${co}.`,
          "",
          "Please check your inbox for the assessment link, or reply to this email if you need it resent.",
          "",
          "What happens next: After you complete the assessment, we will review your responses and contact you if you move forward.",
          "",
          "Warm regards,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    case "interview":
      return {
        subject: `Interview Invitation — ${formTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: buildFormInterviewEmailBody(ctx, extras?.interviewFields ?? DEFAULT_INTERVIEW_FIELDS),
      };

    case "offer":
      return {
        subject: `Job Offer — ${formTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `We are delighted to extend an offer for ${formTitle}${co}.`,
          "",
          "[Add offer details here — role, start date, compensation, and any other terms.]",
          "",
          "To accept, please reply to this email with your confirmation.",
          "",
          "Congratulations!",
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
          "We are thrilled to officially welcome you to the team!",
          "",
          `You have been selected for ${formTitle}${co}${extras?.startDate ? `, starting ${extras.startDate}` : ""}.`,
          "",
          "You will hear from us soon with onboarding details.",
          "",
          "Welcome aboard,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    case "rejected":
      return {
        subject: `Update on your application — ${formTitle}${companyName ? ` at ${companyName}` : ""}`,
        body: [
          `Hi ${fn},`,
          "",
          `Thank you for your interest in ${formTitle}${co} and for the time you invested in our process.`,
          "",
          "After careful consideration, we have decided to move forward with other applicants whose experience more closely aligns with our current needs.",
          "",
          "We genuinely appreciate your effort and encourage you to apply for future openings.",
          "",
          "We wish you all the best.",
          "",
          "Warm regards,",
          `The Hiring Team${companyName ? `, ${companyName}` : ""}`,
        ].join("\n"),
      };

    default:
      return { subject: `Update — ${formTitle}`, body: "" };
  }
}

export function formEmailTypeForStage(stage: FormStageEmailNotifyStage): string {
  if (stage === "rejected") return "rejected";
  if (stage === "offer") return "offer";
  return stage;
}
