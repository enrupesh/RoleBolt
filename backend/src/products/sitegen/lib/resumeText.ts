import type { Express } from "express";

export async function extractResumeTextFromFile(file: Express.Multer.File): Promise<string> {
  const { mimetype, buffer } = file;
  let text = "";

  if (mimetype === "application/pdf") {
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    let data: { text?: string };
    try {
      data = await pdfParse(buffer);
    } catch (pdfErr: unknown) {
      const msg = pdfErr instanceof Error ? pdfErr.message : "";
      if (msg.includes("password")) {
        throw new Error("This PDF is password-protected. Please remove the password and try again.");
      }
      throw pdfErr;
    }
    text = data.text ?? "";
    if (!text.trim()) {
      throw new Error("Your PDF appears to be a scanned image with no readable text. Please export as a text-based PDF or enter your information manually.");
    }
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text = result.value ?? "";
    if (!text.trim()) {
      throw new Error("Could not extract text from this DOCX file. Please try again or enter your information manually.");
    }
  } else if (mimetype === "text/plain") {
    text = buffer.toString("utf-8");
  } else if (mimetype === "application/msword") {
    throw new Error("Legacy .doc files are not supported. Please save as .docx or upload a PDF.");
  } else {
    throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
  }

  text = text
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/^ +$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 40) {
    throw new Error("Could not extract enough text from this file. Please try another file or enter your information manually.");
  }

  return text.slice(0, 50000);
}
