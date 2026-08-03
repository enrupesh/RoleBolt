export type CreatorEmailTemplateKey =
  | "professional"
  | "warm"
  | "update"
  | "interview"
  | "follow_up";

export type CreatorEmailTemplate = {
  key: CreatorEmailTemplateKey;
  label: string;
  description: string;
  subject: string;
  body: string;
};

export const CREATOR_EMAIL_TEMPLATES: CreatorEmailTemplate[] = [
  {
    key: "professional",
    label: "Professional",
    description: "Polished outreach for any hiring update",
    subject: "Update on your application",
    body: `Thank you for your interest in our opportunity and for the time you invested in your application.

We wanted to reach out with a quick update regarding your candidacy. Our team has reviewed your profile, and we would like to share the next steps with you.

Please let us know if you have any questions — we are happy to help.`,
  },
  {
    key: "warm",
    label: "Warm welcome",
    description: "Friendly tone for positive candidate engagement",
    subject: "Great to connect with you",
    body: `It was a pleasure reviewing your application, and we are excited about the potential fit.

We would love to continue the conversation and share more about the role, the team, and what success looks like in this position.

Looking forward to hearing from you.`,
  },
  {
    key: "update",
    label: "Status update",
    description: "Keep candidates informed while the hiring process continues",
    body: `We are writing with a brief update on your application status.

Our hiring team is actively reviewing candidates, and we wanted to keep you informed while the process continues. We appreciate your patience and will follow up with more details soon.

Thank you again for your interest.`,
    subject: "Your application status",
  },
  {
    key: "interview",
    label: "Interview invite",
    description: "Invite candidates to the next conversation",
    subject: "Interview invitation",
    body: `Congratulations — we would like to invite you to the next stage of our hiring process.

Please share your availability for a conversation with our team over the next few days. Include a few time windows that work best for you, and we will confirm the schedule promptly.

We look forward to speaking with you.`,
  },
  {
    key: "follow_up",
    label: "Follow up",
    description: "Gentle nudge when you need a response",
    subject: "Following up on your application",
    body: `We hope you are doing well. We wanted to follow up regarding your application and see whether you are still interested in moving forward.

If you have any questions about the role or the process, please reply to this email and we will be glad to help.`,
  },
];

export function getCreatorEmailTemplate(key: CreatorEmailTemplateKey): CreatorEmailTemplate {
  return CREATOR_EMAIL_TEMPLATES.find((item) => item.key === key) ?? CREATOR_EMAIL_TEMPLATES[0];
}
