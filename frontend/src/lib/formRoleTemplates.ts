export type FormRoleTemplate = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  jobType: string;
  questions: Array<{
    label: string;
    type: "short" | "paragraph" | "email" | "phone" | "file" | "yes_no" | "dropdown";
    required: boolean;
    placeholder?: string;
    options?: string[];
  }>;
};

export const FORM_ROLE_TEMPLATES: FormRoleTemplate[] = [
  {
    id: "content-creator",
    title: "Content Creator / Social Media",
    description: "For YouTube, Instagram, or brand creators hiring editors or assistants.",
    emoji: "🎬",
    jobType: "Part-time",
    questions: [
      { label: "Your full name", type: "short", required: true, placeholder: "e.g. Priya Mehta" },
      { label: "Email address", type: "email", required: true },
      { label: "Phone / WhatsApp", type: "phone", required: false },
      { label: "Portfolio or social link", type: "short", required: true, placeholder: "Instagram, YouTube, or portfolio URL" },
      { label: "Which tools do you use?", type: "paragraph", required: true, placeholder: "CapCut, Premiere, Canva, etc." },
      { label: "Why do you want to work with us?", type: "paragraph", required: true },
      { label: "Upload resume or work samples", type: "file", required: false },
    ],
  },
  {
    id: "virtual-assistant",
    title: "Virtual Assistant",
    description: "Lightweight intake for admin, scheduling, and inbox help.",
    emoji: "💼",
    jobType: "Contract",
    questions: [
      { label: "Your full name", type: "short", required: true },
      { label: "Email address", type: "email", required: true },
      { label: "Phone number", type: "phone", required: true },
      { label: "Hours available per week", type: "short", required: true, placeholder: "e.g. 15–20 hours" },
      { label: "Tools you're comfortable with", type: "paragraph", required: true, placeholder: "Notion, Google Workspace, Slack…" },
      { label: "Describe a task you've handled remotely", type: "paragraph", required: true },
      { label: "Upload resume", type: "file", required: false },
    ],
  },
  {
    id: "freelance-designer",
    title: "Freelance Designer",
    description: "Quick apply for logo, brand, or UI design gigs.",
    emoji: "🎨",
    jobType: "Freelance",
    questions: [
      { label: "Your full name", type: "short", required: true },
      { label: "Email address", type: "email", required: true },
      { label: "Portfolio link", type: "short", required: true },
      { label: "Design specialties", type: "paragraph", required: true, placeholder: "Branding, social graphics, UI…" },
      { label: "Typical turnaround for a logo project", type: "short", required: true },
      { label: "Rate expectation (INR or USD)", type: "short", required: false },
      { label: "Upload resume or portfolio PDF", type: "file", required: false },
    ],
  },
  {
    id: "general",
    title: "General role",
    description: "Standard name, email, resume — add your own questions.",
    emoji: "📋",
    jobType: "Full-time",
    questions: [
      { label: "Your full name", type: "short", required: true },
      { label: "Email address", type: "email", required: true },
      { label: "Phone number", type: "phone", required: false },
      { label: "Upload your resume", type: "file", required: true },
      { label: "Why are you interested in this role?", type: "paragraph", required: true },
    ],
  },
];
