"use client";

import { useEffect, useState } from "react";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";

const TONES = [
  { key: "professional", label: "Professional", desc: "Formal and polished" },
  { key: "enthusiastic", label: "Enthusiastic", desc: "Energetic and passionate" },
  { key: "concise",      label: "Concise",      desc: "Brief and to the point" },
] as const;

function CoverLetterContent() {
  const { sessionToken } = useRecruitAuth();
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText]         = useState("");
  const [tone, setTone]                     = useState<"professional"|"enthusiastic"|"concise">("professional");
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState<{ coverLetter: string; wordCount: number } | null>(null);
  const [error, setError]                   = useState<unknown>("");
  const [copied, setCopied]                 = useState(false);

  useEffect(() => {
    if (!sessionToken) return;
    fetch(apiUrl("/recruit/seeker/profile"), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.profile?.resumeText && !resumeText) setResumeText(d.profile.resumeText);
      })
      .catch(() => undefined);

    const workspaceId = new URLSearchParams(window.location.search).get("workspaceId");
    if (!workspaceId) return;
    fetch(apiUrl(`/recruit/seeker/workspace/${encodeURIComponent(workspaceId)}`), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.workspace?.jobDescription) setJobDescription(data.workspace.jobDescription);
      })
      .catch(() => undefined);
  }, [sessionToken]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/cover-letter/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ jobDescription, resumeText, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, data, "Generation failed.");
      setResult(data);
    } catch (e: unknown) { setError(e); }
    finally { setLoading(false); }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result.coverLetter).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.coverLetter], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cover-letter.txt"; a.click();
  }

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition";

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">AI Cover Letter Generator</h1>
          <p className="mt-1 text-sm text-slate-500">Generate a personalized cover letter in seconds.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleGenerate} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Job description *</label>
                <textarea rows={6} required value={jobDescription} onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here…"
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Your resume *</label>
                <textarea rows={6} required value={resumeText} onChange={e => setResumeText(e.target.value)}
                  placeholder="Paste your resume text here…"
                  className={`${inputCls} resize-none font-mono text-xs`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {TONES.map(t => (
                    <button key={t.key} type="button" onClick={() => setTone(t.key)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        tone === t.key ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
                      }`}>
                      <p className="text-xs font-bold text-slate-900">{t.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <SeekerErrorNotice error={error} />
              <button type="submit" disabled={loading}
                className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Writing your cover letter…
                  </span>
                ) : "Generate Cover Letter →"}
              </button>
            </form>
          </div>

          {/* Output */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {!result ? (
              <div className="flex h-full flex-col items-center justify-center text-center py-12">
                <span className="text-4xl mb-3">✉️</span>
                <p className="font-semibold text-slate-700">Your cover letter will appear here</p>
                <p className="mt-1 text-xs text-slate-400">Fill in the form and click Generate</p>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="rounded-2xl bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    ✓ {result.wordCount} words
                  </span>
                  <div className="flex gap-2">
                    <button onClick={copy} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={download} className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">
                      Download .txt
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{result.coverLetter}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CoverLetterPage() {
  return <RecruitGuard requiredRole="seeker"><CoverLetterContent /></RecruitGuard>;
}
