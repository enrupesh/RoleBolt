"use client";

import { useEffect, useState } from "react";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { ResumeExportPanel } from "@/components/ResumeExportPanel";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";

const BUILD_QUESTIONS = [
  "What's your full name and what job role are you targeting?",
  "How many years of professional experience do you have?",
  "What's your most recent job title and company?",
  "Describe your top 2-3 achievements in your last role. Include numbers if possible.",
  "What are your top 5-7 technical skills?",
  "Tell me about your education (degree, school, year).",
  "What type of work arrangement are you looking for? (Remote/Hybrid/On-site)",
  "Any certifications, side projects, or open-source work to highlight?",
];

type ResumeJson = {
  contactInfo: { name: string; email: string; phone: string; location: string };
  summary: string;
  experience: { title: string; company: string; duration: string; bullets: string[] }[];
  education: { degree: string; school: string; year: string }[];
  skills: { technical: string[]; soft: string[] };
  atsKeywords: string[];
  atsScore: number;
  fullText: string;
};

function ResumeContent() {
  const { sessionToken } = useRecruitAuth();

  // Mode selection
  const [mode, setMode] = useState<"pick" | "build" | "improve">("pick");

  // Build from scratch state
  const [answers, setAnswers]   = useState<string[]>(Array(BUILD_QUESTIONS.length).fill(""));
  const [targetRole, setTargetRole] = useState("");
  const [buildLoading, setBuildLoading] = useState(false);
  const [builtResume, setBuiltResume]   = useState<ResumeJson | null>(null);
  const [buildError, setBuildError]     = useState<unknown>("");

  // Improve existing state
  const [existingResume, setExistingResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [improveLoading, setImproveLoading] = useState(false);
  const [improvedResult, setImprovedResult] = useState<{ improvedResume: string; changes: string[]; atsScore: number } | null>(null);
  const [improveError, setImproveError]     = useState<unknown>("");

  // Copy state
  const [copied, setCopied] = useState(false);
  const [profileHasResume, setProfileHasResume] = useState(false);

  useEffect(() => {
    if (!sessionToken) return;
    fetch(apiUrl("/recruit/seeker/profile"), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.profile?.resumeText) {
          setExistingResume(prev => prev || d.profile.resumeText);
          setProfileHasResume(true);
        }
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

  async function handleBuild(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setBuildLoading(true); setBuildError(""); setBuiltResume(null);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/resume/build"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          targetRole,
          answers: BUILD_QUESTIONS.map((q, i) => ({ question: q, answer: answers[i] })),
        }),
      });
       const data = await res.json().catch(() => ({}));
       if (!res.ok) throw apiErrorFromPayload(res.status, data, "Build failed.");
      setBuiltResume(data.resume);
    } catch (e: unknown) { setBuildError(e); }
    finally { setBuildLoading(false); }
  }

  async function handleImprove(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setImproveLoading(true); setImproveError(""); setImprovedResult(null);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/resume/improve"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ resumeText: existingResume, targetJobDescription: jobDescription }),
      });
       const data = await res.json().catch(() => ({}));
       if (!res.ok) throw apiErrorFromPayload(res.status, data, "Improve failed.");
      setImprovedResult(data);
    } catch (e: unknown) { setImproveError(e); }
    finally { setImproveLoading(false); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function saveToProfile(text: string) {
    if (!sessionToken || !text.trim()) return;
    setImproveError("");
    const res = await fetch(apiUrl("/recruit/seeker/profile"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ resumeText: text.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw apiErrorFromPayload(res.status, d, "Could not save to profile");
    }
    setProfileHasResume(true);
  }

  const [profileSaved, setProfileSaved] = useState(false);

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition";

  return (
    <div className="min-h-screen bg-[#f0f2f5] print:bg-white">
      <div className="print:hidden"><SeekerHeader /></div>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">AI Resume Builder</h1>
          <p className="mt-1 text-sm text-slate-500">Build a professional ATS-optimized resume with AI.</p>
        </div>

        {/* Mode Picker */}
        {mode === "pick" && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { key: "build", icon: "✨", title: "Build from scratch", desc: "Answer 8 questions and AI builds your complete resume" },
                { key: "improve", icon: "🔧", title: "Improve existing", desc: "Upload your resume + a job description to get an AI-improved version" },
              ].map(opt => (
                <button key={opt.key} onClick={() => setMode(opt.key as "build" | "improve")}
                  className="rounded-3xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-indigo-400 hover:shadow-md active:scale-[0.98]">
                  <span className="text-3xl">{opt.icon}</span>
                  <h3 className="mt-3 font-bold text-slate-900">{opt.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>

            {profileHasResume && sessionToken && (
              <ResumeExportPanel sessionToken={sessionToken} useProfile compact />
            )}
          </div>
        )}

        {/* Build from Scratch */}
        {mode === "build" && !builtResume && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setMode("pick")} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">← Back</button>
              <h2 className="font-bold text-slate-900">Build Resume from Scratch</h2>
            </div>

            <form onSubmit={handleBuild} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Target job role</label>
                <input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Senior Frontend Developer" className={inputCls} />
              </div>

              {BUILD_QUESTIONS.map((q, i) => (
                <div key={i}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold mr-1.5">{i + 1}</span>
                    {q}
                  </label>
                  <textarea rows={2} value={answers[i]}
                    onChange={e => setAnswers(prev => prev.map((a, j) => j === i ? e.target.value : a))}
                    placeholder="Your answer…"
                    className={`${inputCls} resize-none`}
                  />
                </div>
              ))}

              <SeekerErrorNotice error={buildError} />

              <button type="submit" disabled={buildLoading}
                className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                {buildLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Building your resume with AI…
                  </span>
                ) : "Build My Resume →"}
              </button>
            </form>
          </div>
        )}

        {/* Built Resume Result */}
        {mode === "build" && builtResume && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-2xl bg-green-100 px-3 py-1.5 text-sm font-bold text-green-700">✓ Resume built!</span>
                <span className="rounded-2xl bg-indigo-100 px-3 py-1.5 text-sm font-bold text-indigo-700">ATS Score: {builtResume.atsScore}%</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => copyToClipboard(builtResume.fullText ?? "")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => saveToProfile(builtResume.fullText ?? "").then(() => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500); }).catch((e) => setBuildError(e))}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                  {profileSaved ? "Saved to profile!" : "Save to profile"}
                </button>
                <button onClick={() => { setBuiltResume(null); setAnswers(Array(BUILD_QUESTIONS.length).fill("")); }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition">
                  Start Over
                </button>
              </div>
            </div>

            {sessionToken && (
              <ResumeExportPanel sessionToken={sessionToken} resume={builtResume} />
            )}

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:shadow-none print:border-0">
              {/* Name & Contact */}
              <div className="text-center mb-6 pb-4 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900">{builtResume.contactInfo?.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {[builtResume.contactInfo?.email, builtResume.contactInfo?.phone, builtResume.contactInfo?.location].filter(Boolean).join(" · ")}
                </p>
              </div>

              {/* Summary */}
              {builtResume.summary && (
                <div className="mb-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Professional Summary</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{builtResume.summary}</p>
                </div>
              )}

              {/* Experience */}
              {builtResume.experience?.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Experience</h3>
                  <div className="space-y-4">
                    {builtResume.experience.map((exp, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-baseline">
                          <p className="font-semibold text-slate-900">{exp.title}</p>
                          <p className="text-xs text-slate-400">{exp.duration}</p>
                        </div>
                        <p className="text-sm text-slate-500 mb-1">{exp.company}</p>
                        <ul className="space-y-1">
                          {exp.bullets.map((b, j) => <li key={j} className="text-sm text-slate-700 flex gap-2"><span className="text-slate-400 shrink-0">•</span>{b}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {builtResume.education?.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Education</h3>
                  {builtResume.education.map((ed, i) => (
                    <div key={i} className="flex justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{ed.degree}</p>
                        <p className="text-sm text-slate-500">{ed.school}</p>
                      </div>
                      <p className="text-xs text-slate-400">{ed.year}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {(builtResume.skills?.technical?.length > 0 || builtResume.skills?.soft?.length > 0) && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Skills</h3>
                  {builtResume.skills.technical?.length > 0 && (
                    <p className="text-sm text-slate-700 mb-1"><span className="font-semibold">Technical: </span>{builtResume.skills.technical.join(", ")}</p>
                  )}
                  {builtResume.skills.soft?.length > 0 && (
                    <p className="text-sm text-slate-700"><span className="font-semibold">Soft skills: </span>{builtResume.skills.soft.join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Improve Existing */}
        {mode === "improve" && !improvedResult && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setMode("pick")} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">← Back</button>
              <h2 className="font-bold text-slate-900">Improve Existing Resume</h2>
            </div>

            <form onSubmit={handleImprove} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Your current resume</label>
                <textarea rows={10} required value={existingResume} onChange={e => setExistingResume(e.target.value)}
                  placeholder="Paste your full resume text here…"
                  className={`${inputCls} resize-none font-mono text-xs`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Target job description</label>
                <textarea rows={6} required value={jobDescription} onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste the job description you're targeting…"
                  className={`${inputCls} resize-none`} />
              </div>

               <SeekerErrorNotice error={improveError} />

              <button type="submit" disabled={improveLoading}
                className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                {improveLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Improving your resume with AI…
                  </span>
                ) : "Improve My Resume →"}
              </button>
            </form>
          </div>
        )}

        {/* Improved Result */}
        {mode === "improve" && improvedResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-2xl bg-green-100 px-3 py-1.5 text-sm font-bold text-green-700">✓ Resume improved!</span>
                <span className="rounded-2xl bg-indigo-100 px-3 py-1.5 text-sm font-bold text-indigo-700">ATS Score: {improvedResult.atsScore}%</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => copyToClipboard(improvedResult.improvedResume)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => saveToProfile(improvedResult.improvedResume).then(() => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500); }).catch((e) => setImproveError(e))}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                  {profileSaved ? "Saved to profile!" : "Save to profile"}
                </button>
                <button onClick={() => setImprovedResult(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition">
                  Try Again
                </button>
              </div>
            </div>

            {sessionToken && (
              <ResumeExportPanel sessionToken={sessionToken} resumeText={improvedResult.improvedResume} />
            )}

            {improvedResult.changes.length > 0 && (
              <div className="rounded-3xl border border-green-200 bg-green-50 p-5">
                <p className="text-xs font-bold text-green-800 uppercase tracking-wide mb-3">Changes made by AI</p>
                <ul className="space-y-1.5">
                  {improvedResult.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-900">
                      <span className="mt-0.5 shrink-0 text-green-600">✓</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{improvedResult.improvedResume}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SeekerResumePage() {
  return <RecruitGuard requiredRole="seeker"><ResumeContent /></RecruitGuard>;
}
