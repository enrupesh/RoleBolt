"use client";

import { useState } from "react";
import { uploadSitegenResume } from "../../lib/client";

export function SitegenResumeUpload({
  accessToken,
  resumeFileName,
  resumeText,
  onUploaded,
}: {
  accessToken: string;
  resumeFileName?: string;
  resumeText?: string;
  onUploaded: (data: { resumeText: string; resumeFileName: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const result = await uploadSitegenResume(accessToken, file);
      if (!result.resumeText) throw new Error("We couldn't read your resume.");
      onUploaded({
        resumeText: result.resumeText,
        resumeFileName: result.resumeFileName || file.name,
      });
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-violet-400/30 bg-violet-500/5 px-5 py-10 text-center transition hover:border-violet-400/50 hover:bg-violet-500/10">
        <span className="text-sm font-semibold text-white">{busy ? "Reading resume…" : "Upload resume"}</span>
        <span className="mt-2 text-xs text-violet-200/50">PDF, DOCX, or TXT · up to 5 MB</span>
        <input type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" disabled={busy} onChange={handleFileChange} />
      </label>
      {resumeFileName ? (
        <p className="text-xs text-emerald-300">Uploaded: {resumeFileName}</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {resumeText ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/45">Extracted text preview</p>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-6 text-violet-100/70">{resumeText.slice(0, 2000)}{resumeText.length > 2000 ? "…" : ""}</pre>
          <p className="mt-3 text-xs text-violet-200/40">This extracted text will be used when you structure your website content on the preview page.</p>
        </div>
      ) : null}
    </div>
  );
}
