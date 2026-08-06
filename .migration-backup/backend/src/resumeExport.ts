/** Shared resume document shape for export (PDF, DOCX, TXT). */

import PDFDocument from "pdfkit";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";

export type ResumeTemplateId = "ats" | "modern" | "minimal" | "creative";

export type ResumeExportFormat = "pdf" | "docx" | "txt";

export interface ResumeContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
}

export interface ResumeExperienceEntry {
  title: string;
  company: string;
  duration: string;
  location?: string;
  bullets: string[];
}

export interface ResumeEducationEntry {
  degree: string;
  school: string;
  year: string;
}

export interface ResumeDocument {
  contactInfo: ResumeContactInfo;
  headline?: string;
  summary: string;
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
  skills: { technical: string[]; soft: string[] };
  certifications?: string[];
  /** Plain-text fallback when structure is unknown */
  fullText?: string;
}

export interface ResumeJsonInput {
  contactInfo?: Partial<ResumeContactInfo>;
  summary?: string;
  experience?: Array<Partial<ResumeExperienceEntry> & { bullets?: string[] }>;
  education?: Array<Partial<ResumeEducationEntry>>;
  skills?: { technical?: string[]; soft?: string[] };
  atsKeywords?: string[];
  fullText?: string;
}

export const RESUME_TEMPLATES: {
  id: ResumeTemplateId;
  label: string;
  description: string;
  atsNote: string;
}[] = [
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

export function resumeFromJson(input: ResumeJsonInput): ResumeDocument {
  return {
    contactInfo: {
      name: String(input.contactInfo?.name ?? "").trim(),
      email: String(input.contactInfo?.email ?? "").trim(),
      phone: String(input.contactInfo?.phone ?? "").trim(),
      location: String(input.contactInfo?.location ?? "").trim(),
      linkedin: input.contactInfo?.linkedin?.trim(),
    },
    summary: String(input.summary ?? "").trim(),
    experience: (input.experience ?? []).map(e => ({
      title: String(e.title ?? "").trim(),
      company: String(e.company ?? "").trim(),
      duration: String(e.duration ?? "").trim(),
      location: e.location?.trim(),
      bullets: Array.isArray(e.bullets) ? e.bullets.map(String).filter(Boolean) : [],
    })),
    education: (input.education ?? []).map(e => ({
      degree: String(e.degree ?? "").trim(),
      school: String(e.school ?? "").trim(),
      year: String(e.year ?? "").trim(),
    })),
    skills: {
      technical: input.skills?.technical ?? [],
      soft: input.skills?.soft ?? [],
    },
    fullText: input.fullText?.trim(),
  };
}

/** Heuristic plain-text → structured document for export formatting. */
export function resumeFromPlainText(text: string, profile?: Partial<ResumeContactInfo>): ResumeDocument {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

  const name = profile?.name?.trim() || lines[0] || "Resume";

  const sections: Record<string, string[]> = {};
  let current = "body";
  sections[current] = [];

  for (const line of lines.slice(1)) {
    if (/^(professional\s+summary|summary|profile|objective)$/i.test(line)) {
      current = "summary";
      sections[current] = [];
      continue;
    }
    if (/^(experience|work\s+experience|employment)$/i.test(line)) {
      current = "experience";
      sections[current] = [];
      continue;
    }
    if (/^(education|academic)$/i.test(line)) {
      current = "education";
      sections[current] = [];
      continue;
    }
    if (/^(skills|technical\s+skills|core\s+competencies)$/i.test(line)) {
      current = "skills";
      sections[current] = [];
      continue;
    }
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }

  const summary = (sections.summary ?? []).join(" ");
  const skillLines = sections.skills ?? [];
  const technical = skillLines
    .flatMap(l => l.replace(/^technical\s*:\s*/i, "").split(/[,;|·]/))
    .map(s => s.trim())
    .filter(Boolean);

  return {
    contactInfo: {
      name,
      email: profile?.email || emailMatch?.[0] || "",
      phone: profile?.phone || phoneMatch?.[0] || "",
      location: profile?.location || "",
    },
    summary,
    experience: [],
    education: [],
    skills: { technical, soft: [] },
    fullText: text.trim(),
  };
}

export function sanitizeFilename(name: string): string {
  return (name || "resume").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase().slice(0, 60);
}

// ─── Plain text export ───────────────────────────────────────────────────────

export function resumeToPlainText(doc: ResumeDocument): string {
  if (doc.fullText && !doc.experience.length && !doc.summary) {
    return doc.fullText;
  }

  const lines: string[] = [];
  const c = doc.contactInfo;
  lines.push(c.name.toUpperCase());
  const contact = [c.email, c.phone, c.location, c.linkedin].filter(Boolean).join(" | ");
  if (contact) lines.push(contact);
  lines.push("");

  if (doc.summary) {
    lines.push("PROFESSIONAL SUMMARY");
    lines.push(doc.summary);
    lines.push("");
  }

  if (doc.experience.length) {
    lines.push("EXPERIENCE");
    for (const exp of doc.experience) {
      lines.push(`${exp.title}${exp.company ? ` — ${exp.company}` : ""}${exp.duration ? ` (${exp.duration})` : ""}`);
      for (const b of exp.bullets) lines.push(`• ${b}`);
      lines.push("");
    }
  }

  if (doc.education.length) {
    lines.push("EDUCATION");
    for (const ed of doc.education) {
      lines.push(`${ed.degree}${ed.school ? ` — ${ed.school}` : ""}${ed.year ? ` (${ed.year})` : ""}`);
    }
    lines.push("");
  }

  const allSkills = [...doc.skills.technical, ...doc.skills.soft];
  if (allSkills.length) {
    lines.push("SKILLS");
    lines.push(allSkills.join(", "));
  }

  return lines.join("\n").trim();
}

// ─── PDF export (pdfkit — selectable text, ATS-safe) ─────────────────────────

type PDFDoc = InstanceType<typeof PDFDocument>;

const PAGE_BOTTOM = (doc: PDFDoc) => doc.page.height - doc.page.margins.bottom;

function ensureSpace(doc: PDFDoc, needed: number) {
  if (doc.y + needed > PAGE_BOTTOM(doc)) doc.addPage();
}

function contactLine(doc: ResumeDocument): string {
  return [doc.contactInfo.email, doc.contactInfo.phone, doc.contactInfo.location, doc.contactInfo.linkedin]
    .filter(Boolean)
    .join("  ·  ");
}

function drawSectionTitle(
  doc: PDFDoc,
  title: string,
  template: ResumeTemplateId,
) {
  ensureSpace(doc, 40);

  if (template === "modern") {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#3730a3").text(title.toUpperCase(), { characterSpacing: 1.2 });
    doc.moveDown(0.3);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#c7d2fe").lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#111827");
    return;
  }

  if (template === "minimal") {
    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text(title.toUpperCase(), { characterSpacing: 2 });
    doc.moveDown(0.6);
    doc.fillColor("#1e293b");
    return;
  }

  if (template === "creative") {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text(title.toUpperCase());
    doc.moveDown(0.4);
    return;
  }

  // ATS default
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text(title.toUpperCase());
  doc.moveDown(0.4);
}

function renderPdfBody(doc: PDFDoc, resume: ResumeDocument, template: ResumeTemplateId, startX?: number, contentWidth?: number) {
  const opts = contentWidth
    ? { width: contentWidth, indent: startX ? startX - doc.page.margins.left : 0 }
    : {};

  if (resume.summary) {
    drawSectionTitle(doc, "Professional Summary", template);
    doc.fontSize(10).font("Helvetica").text(resume.summary, { lineGap: 3, ...opts });
    doc.moveDown(0.8);
  }

  if (resume.experience.length) {
    drawSectionTitle(doc, "Experience", template);
    for (const exp of resume.experience) {
      ensureSpace(doc, 60);
      doc.fontSize(11).font("Helvetica-Bold").text(exp.title, opts);
      const meta = [exp.company, exp.duration].filter(Boolean).join("  ·  ");
      if (meta) doc.fontSize(9).font("Helvetica-Oblique").fillColor("#475569").text(meta, opts);
      doc.fillColor(template === "ats" ? "#000000" : "#1e293b");
      doc.moveDown(0.2);
      for (const bullet of exp.bullets) {
        ensureSpace(doc, 20);
        doc.fontSize(10).font("Helvetica").text(`•  ${bullet}`, { lineGap: 2, ...opts });
      }
      doc.moveDown(0.6);
    }
  }

  if (resume.education.length) {
    drawSectionTitle(doc, "Education", template);
    for (const ed of resume.education) {
      ensureSpace(doc, 30);
      doc.fontSize(10).font("Helvetica-Bold").text(ed.degree, opts);
      const edMeta = [ed.school, ed.year].filter(Boolean).join("  ·  ");
      if (edMeta) doc.fontSize(9).font("Helvetica").fillColor("#475569").text(edMeta, opts);
      doc.fillColor(template === "ats" ? "#000000" : "#1e293b");
      doc.moveDown(0.4);
    }
  }

  const skills = [...resume.skills.technical, ...resume.skills.soft];
  if (skills.length) {
    drawSectionTitle(doc, "Skills", template);
    doc.fontSize(10).font("Helvetica").text(skills.join("  ·  "), { lineGap: 2, ...opts });
  }
}

function renderPdfPlainFallback(doc: PDFDoc, resume: ResumeDocument) {
  doc.fontSize(10).font("Helvetica").fillColor("#111827").text(resume.fullText || "", { lineGap: 4, paragraphGap: 6 });
}

export function generateResumePdf(resume: ResumeDocument, template: ResumeTemplateId): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const name = resume.contactInfo.name || "Resume";
    const contact = contactLine(resume);

    if (template === "creative") {
      const sidebarW = 160;
      const mainX = doc.page.margins.left + sidebarW + 20;
      const mainW = doc.page.width - mainX - doc.page.margins.right;

      // Sidebar background
      doc.rect(doc.page.margins.left - 54, doc.page.margins.top - 54, sidebarW + 54, doc.page.height).fill("#f1f5f9");
      doc.fillColor("#0f172a");

      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
      doc.fontSize(16).font("Helvetica-Bold").text(name, { width: sidebarW });
      doc.moveDown(0.5);
      if (contact) {
        doc.fontSize(8).font("Helvetica").fillColor("#475569").text(contact, { width: sidebarW, lineGap: 2 });
      }
      doc.moveDown(1);
      const skills = [...resume.skills.technical, ...resume.skills.soft];
      if (skills.length) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text("SKILLS", { width: sidebarW });
        doc.moveDown(0.3);
        for (const s of skills) {
          doc.fontSize(8).font("Helvetica").fillColor("#334155").text(`• ${s}`, { width: sidebarW });
        }
      }

      doc.x = mainX;
      doc.y = doc.page.margins.top;
      doc.fillColor("#111827");

      if (resume.summary) {
        drawSectionTitle(doc, "Summary", template);
        doc.fontSize(10).font("Helvetica").text(resume.summary, { width: mainW, lineGap: 3 });
        doc.moveDown(0.8);
      }
      if (resume.experience.length) {
        drawSectionTitle(doc, "Experience", template);
        for (const exp of resume.experience) {
          ensureSpace(doc, 50);
          doc.fontSize(11).font("Helvetica-Bold").text(exp.title, { width: mainW });
          const meta = [exp.company, exp.duration].filter(Boolean).join(" · ");
          if (meta) doc.fontSize(9).font("Helvetica-Oblique").fillColor("#64748b").text(meta, { width: mainW });
          doc.fillColor("#111827");
          for (const b of exp.bullets) {
            ensureSpace(doc, 18);
            doc.fontSize(10).font("Helvetica").text(`• ${b}`, { width: mainW, lineGap: 2 });
          }
          doc.moveDown(0.5);
        }
      }
      if (resume.education.length) {
        drawSectionTitle(doc, "Education", template);
        for (const ed of resume.education) {
          doc.fontSize(10).font("Helvetica-Bold").text(ed.degree, { width: mainW });
          doc.fontSize(9).font("Helvetica").fillColor("#64748b").text([ed.school, ed.year].filter(Boolean).join(" · "), { width: mainW });
          doc.fillColor("#111827");
          doc.moveDown(0.3);
        }
      }
    } else {
      // Header
      if (template === "modern") {
        doc.fontSize(22).font("Helvetica-Bold").fillColor("#1e1b4b").text(name, { align: "center" });
        doc.moveDown(0.2);
        doc.moveTo(doc.page.margins.left + 80, doc.y).lineTo(doc.page.width - doc.page.margins.right - 80, doc.y).strokeColor("#6366f1").lineWidth(2).stroke();
        doc.moveDown(0.5);
      } else if (template === "minimal") {
        doc.fontSize(26).font("Helvetica").fillColor("#0f172a").text(name, { align: "left" });
        doc.moveDown(0.4);
      } else {
        doc.fontSize(20).font("Helvetica-Bold").fillColor("#000000").text(name, { align: "center" });
        doc.moveDown(0.3);
      }

      if (contact) {
        doc.fontSize(9).font("Helvetica").fillColor(template === "minimal" ? "#64748b" : "#374151")
          .text(contact, { align: template === "minimal" ? "left" : "center" });
        doc.moveDown(template === "minimal" ? 1.2 : 0.8);
      }

      doc.fillColor(template === "ats" ? "#000000" : "#111827");

      const hasStructure = resume.summary || resume.experience.length || resume.education.length ||
        resume.skills.technical.length || resume.skills.soft.length;

      if (hasStructure) {
        renderPdfBody(doc, resume, template);
      } else if (resume.fullText) {
        renderPdfPlainFallback(doc, resume);
      }
    }

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").text(
        `Generated with Rolebolt · Page ${i + 1} of ${pages.count}`,
        doc.page.margins.left,
        doc.page.height - 36,
        { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
      );
    }

    doc.end();
  });
}

// ─── DOCX export ─────────────────────────────────────────────────────────────

export async function generateResumeDocx(resume: ResumeDocument, template: ResumeTemplateId): Promise<Buffer> {
  const children: Paragraph[] = [];
  const accent = template === "modern" ? "3730A3" : template === "creative" ? "0F172A" : "111827";

  children.push(
    new Paragraph({
      alignment: template === "ats" ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: resume.contactInfo.name, bold: true, size: 32, color: accent })],
    }),
  );

  const contact = contactLine(resume);
  if (contact) {
    children.push(
      new Paragraph({
        alignment: template === "ats" ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 200 },
        children: [new TextRun({ text: contact, size: 18, color: "64748B" })],
      }),
    );
  }

  function addSection(title: string) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        border: template === "modern" ? { bottom: { color: "C7D2FE", space: 4, style: BorderStyle.SINGLE, size: 6 } } : undefined,
        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 20, color: accent, characterSpacing: 40 })],
      }),
    );
  }

  if (resume.summary) {
    addSection("Professional Summary");
    children.push(new Paragraph({ children: [new TextRun({ text: resume.summary, size: 20 })] }));
  }

  if (resume.experience.length) {
    addSection("Experience");
    for (const exp of resume.experience) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: exp.title, bold: true, size: 22 })],
        }),
      );
      const meta = [exp.company, exp.duration].filter(Boolean).join(" · ");
      if (meta) {
        children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true, size: 18, color: "64748B" })] }));
      }
      for (const b of exp.bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: b, size: 20 })],
          }),
        );
      }
    }
  }

  if (resume.education.length) {
    addSection("Education");
    for (const ed of resume.education) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${ed.degree}${ed.school ? ` — ${ed.school}` : ""}${ed.year ? ` (${ed.year})` : ""}`, size: 20 })] }));
    }
  }

  const skills = [...resume.skills.technical, ...resume.skills.soft];
  if (skills.length) {
    addSection("Skills");
    children.push(new Paragraph({ children: [new TextRun({ text: skills.join(" · "), size: 20 })] }));
  }

  if (!resume.summary && !resume.experience.length && resume.fullText) {
    children.push(new Paragraph({ children: [new TextRun({ text: resume.fullText, size: 20 })] }));
  }

  const document = new DocxDocument({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(document);
}

export async function exportResume(
  resume: ResumeDocument,
  format: ResumeExportFormat,
  template: ResumeTemplateId,
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  if (format === "txt") {
    return {
      buffer: Buffer.from(resumeToPlainText(resume), "utf-8"),
      mimeType: "text/plain; charset=utf-8",
      extension: "txt",
    };
  }
  if (format === "docx") {
    return {
      buffer: await generateResumeDocx(resume, template),
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    };
  }
  return {
    buffer: await generateResumePdf(resume, template),
    mimeType: "application/pdf",
    extension: "pdf",
  };
}

