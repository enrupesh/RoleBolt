"use client";

import { useState } from "react";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import {
  RESUME_TEMPLATES,
  type ResumeExportFormat,
  type ResumeExportPayload,
  type ResumeTemplateId,
} from "@/lib/resumeTypes";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";

type Props = ResumeExportPayload & {
  sessionToken: string;
  compact?: boolean;
};

const FORMATS: { id: ResumeExportFormat; label: string; icon: string }[] = [
  { id: "pdf", label: "PDF", icon: "📄" },
  { id: "docx", label: "DOCX", icon: "📝" },
  { id: "txt", label: "TXT", icon: "📋" },
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

export function ResumeExportPanel({ sessionToken, compact, ...payload }: Props) {
  const [template, setTemplate] = useState<ResumeTemplateId>("ats");
  const [exporting, setExporting] = useState<ResumeExportFormat | null>(null);
  const [error, setError] = useState<unknown>("");

  async function handleExport(format: ResumeExportFormat) {
    if (!sessionToken) return;
    setExporting(format);
    setError("");

    try {
      const res = await fetch(apiUrl("/recruit/seeker/resume/export"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ format, template, ...payload }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw apiErrorFromPayload(res.status, data, "Export failed.");
      }

      const blob = await res.blob();
      const fallback = `resume_${template}.${format}`;
      const filename = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallback;
      triggerDownload(blob, filename);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setExporting(null);
    }
  }

  const selected = RESUME_TEMPLATES.find(t => t.id === template)!;

  return (
    <div className={`rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white ${compact ? "p-4" : "p-5"} print:hidden`}>
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl shrink-0">⬇️</span>
        <div>
          <h3 className="font-bold text-slate-900">Export resume</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download a professional file for LinkedIn, Indeed, or any job portal.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Template</p>
        <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
          {RESUME_TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                template === t.id
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-400/30"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              }`}
            >
              <span className="text-sm font-semibold text-slate-900">{t.label}</span>
              <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{t.description}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-indigo-700/80">{selected.atsNote}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Format</p>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              type="button"
              disabled={!!exporting}
              onClick={() => handleExport(f.id)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {exporting === f.id ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <span>{f.icon}</span>
                  Download {f.label}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <SeekerErrorNotice error={error} className="mt-3 text-xs" />
    </div>
  );
}
