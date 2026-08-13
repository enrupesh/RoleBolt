export type ResumeTemplateId = "ats" | "modern" | "minimal" | "creative";

export type ResumeExportFormat = "pdf" | "docx" | "txt";

export interface ResumeTemplateMeta {
  id: ResumeTemplateId;
  label: string;
  description: string;
  atsNote: string;
}

export const RESUME_TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: "ats",
    label: "ATS-Friendly",
    description: "Single-column, standard fonts — best for automated screening.",
    atsNote: "Recommended for LinkedIn, Indeed, and company portals.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Clean layout with subtle accent styling.",
    atsNote: "Professional look with strong readability.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Spacious typography with understated section headers.",
    atsNote: "Great for senior roles and design-conscious industries.",
  },
  {
    id: "creative",
    label: "Creative",
    description: "Two-column layout highlighting skills alongside experience.",
    atsNote: "Use ATS-Friendly when applying through automated systems.",
  },
];

export type ResumeJsonExport = {
  contactInfo?: { name?: string; email?: string; phone?: string; location?: string; linkedin?: string };
  summary?: string;
  experience?: { title?: string; company?: string; duration?: string; bullets?: string[] }[];
  education?: { degree?: string; school?: string; year?: string }[];
  skills?: { technical?: string[]; soft?: string[] };
  fullText?: string;
};

export type ResumeExportPayload =
  | { resume: ResumeJsonExport; resumeText?: never; useProfile?: never }
  | { resumeText: string; resume?: never; useProfile?: never }
  | { useProfile: true; resume?: never; resumeText?: never };
