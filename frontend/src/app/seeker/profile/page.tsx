"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";

type Profile = {
  username: string; name: string; email: string; phone: string; headline: string; bio: string;
  skills: string[]; resumeText: string; resumeFileName: string;
  experienceLevel: string; preferredJobType: string; preferredWorkMode: string;
  preferredLocation: string; preferredSalaryMin: number; preferredSalaryMax: number;
  preferredNiche: string;
  experience: { title: string; company: string; startDate: string; endDate: string; current: boolean; description: string }[];
  education: { degree: string; institution: string; year: string }[];
  projects: { name: string; description: string; url: string; technologies: string[] }[];
  certifications: { name: string; issuer: string; year: string; url: string }[];
  socialLinks: { linkedin: string; github: string; portfolio: string };
};

const BLANK: Profile = {
  username: "", name: "", email: "", phone: "", headline: "", bio: "",
  skills: [], resumeText: "", resumeFileName: "",
  experienceLevel: "", preferredJobType: "", preferredWorkMode: "",
  preferredLocation: "", preferredSalaryMin: 0, preferredSalaryMax: 0,
  preferredNiche: "",
  experience: [], education: [],
  projects: [], certifications: [],
  socialLinks: { linkedin: "", github: "", portfolio: "" },
};

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); setInput(""); }
  }
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-h-[44px]">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-1 rounded-xl bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="text-indigo-400 hover:text-indigo-700 ml-0.5">×</button>
        </span>
      ))}
      <input
        value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

function ProfileContent() {
  const { sessionToken } = useRecruitAuth();
  const searchParams     = useSearchParams();
  const onboarding       = searchParams.get("onboarding") === "1";
  const [token, setToken]     = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<unknown>(null);

  function updateList<K extends "projects" | "certifications">(key: K, index: number, patch: Partial<Profile[K][number]>) {
    setProfile(prev => ({
      ...prev,
      [key]: prev[key].map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry),
    }));
  }

  useEffect(() => { if (sessionToken) setToken(sessionToken); }, [sessionToken]);

  const loadProfile = useCallback(async (tok: string) => {
    const res = await fetch(apiUrl("/recruit/seeker/profile"), { headers: { Authorization: `Bearer ${tok}` } });
    const d = await res.json();
    if (d.profile) {
      setProfile(prev => ({ ...BLANK, ...d.profile, socialLinks: { ...BLANK.socialLinks, ...d.profile.socialLinks } }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (token) loadProfile(token); }, [token, loadProfile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      const d = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, d, "Save failed.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) { setError(e); }
    finally { setSaving(false); }
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{label}</label>
        {children}
      </div>
    );
  }

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition";

  if (loading) return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-3xl bg-white animate-pulse" />)}</div>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{onboarding ? "Set up your profile" : "My Profile"}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {onboarding ? "Complete your profile to start applying to jobs with one click." : "Keep your info up to date to get the best job matches."}
              </p>
            </div>
            {!onboarding && profile.username && (
              <Link href={`/seeker/${encodeURIComponent(profile.username)}`} target="_blank" className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50">
                View public profile <span className="ml-1.5">↗</span>
              </Link>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-5">Basic Information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name">
                <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" className={inputCls} />
              </Field>
              <Field label="Phone">
                <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+1 234 567 8900" className={inputCls} />
              </Field>
              <Field label="Experience level">
                <select value={profile.experienceLevel} onChange={e => setProfile(p => ({ ...p, experienceLevel: e.target.value }))} className={inputCls}>
                  <option value="">Select…</option>
                  {["Fresher", "Junior (1-2 yrs)", "Mid (3-5 yrs)", "Senior (6-10 yrs)", "Lead (10+ yrs)"].map(v => <option key={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Professional headline">
                <input value={profile.headline} onChange={e => setProfile(p => ({ ...p, headline: e.target.value }))} placeholder="e.g. Senior React Developer" className={inputCls} />
              </Field>
              <Field label="Preferred location">
                <input value={profile.preferredLocation} onChange={e => setProfile(p => ({ ...p, preferredLocation: e.target.value }))} placeholder="e.g. New York, NY" className={inputCls} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Bio">
                <textarea rows={3} value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} placeholder="Brief introduction about yourself…" className={`${inputCls} resize-none`} />
              </Field>
            </div>
          </section>

          {/* Skills */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-5">Skills</h2>
            <Field label="Add skills (press Enter after each)">
              <TagInput tags={profile.skills} onChange={s => setProfile(p => ({ ...p, skills: s }))} placeholder="React, Python, SQL…" />
            </Field>
          </section>

          {/* Resume */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-2">Resume</h2>
            <p className="text-xs text-slate-400 mb-4">Paste your resume text here. This is used for AI scoring and one-click apply.</p>
            <Field label="Resume text">
              <textarea rows={10} value={profile.resumeText} onChange={e => setProfile(p => ({ ...p, resumeText: e.target.value }))}
                placeholder="Paste your full resume text here…"
                className={`${inputCls} resize-none font-mono text-xs`} />
            </Field>
          </section>

          {/* Selected work */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900">Selected Work</h2>
                <p className="mt-1 text-xs text-slate-400">Showcase projects that make your public portfolio memorable.</p>
              </div>
              <button type="button" onClick={() => setProfile(p => ({ ...p, projects: [...p.projects, { name: "", description: "", url: "", technologies: [] }] }))} className="shrink-0 rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50">Add project</button>
            </div>
            {profile.projects.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-400">No projects added yet.</p>
            ) : (
              <div className="space-y-4">
                {profile.projects.map((project, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Project {index + 1}</p>
                      <button type="button" onClick={() => setProfile(p => ({ ...p, projects: p.projects.filter((_, i) => i !== index) }))} className="text-xs font-semibold text-rose-500 hover:text-rose-700">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input value={project.name} onChange={e => updateList("projects", index, { name: e.target.value })} placeholder="Project name" className={inputCls} />
                      <input value={project.url} onChange={e => updateList("projects", index, { url: e.target.value })} placeholder="Project URL (optional)" className={inputCls} />
                    </div>
                    <textarea rows={3} value={project.description} onChange={e => updateList("projects", index, { description: e.target.value })} placeholder="What did you build or accomplish?" className={`${inputCls} mt-3 resize-none`} />
                    <input value={project.technologies.join(", ")} onChange={e => updateList("projects", index, { technologies: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })} placeholder="Technologies, separated by commas" className={`${inputCls} mt-3`} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Certifications */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900">Certifications</h2>
                <p className="mt-1 text-xs text-slate-400">Add credentials that strengthen your professional story.</p>
              </div>
              <button type="button" onClick={() => setProfile(p => ({ ...p, certifications: [...p.certifications, { name: "", issuer: "", year: "", url: "" }] }))} className="shrink-0 rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50">Add certification</button>
            </div>
            {profile.certifications.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-400">No certifications added yet.</p>
            ) : (
              <div className="space-y-4">
                {profile.certifications.map((certification, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Credential {index + 1}</p>
                      <button type="button" onClick={() => setProfile(p => ({ ...p, certifications: p.certifications.filter((_, i) => i !== index) }))} className="text-xs font-semibold text-rose-500 hover:text-rose-700">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input value={certification.name} onChange={e => updateList("certifications", index, { name: e.target.value })} placeholder="Certification name" className={inputCls} />
                      <input value={certification.issuer} onChange={e => updateList("certifications", index, { issuer: e.target.value })} placeholder="Issuing organization" className={inputCls} />
                      <input value={certification.year} onChange={e => updateList("certifications", index, { year: e.target.value })} placeholder="Year" className={inputCls} />
                      <input value={certification.url} onChange={e => updateList("certifications", index, { url: e.target.value })} placeholder="Credential URL (optional)" className={inputCls} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Preferences */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-5">Job Preferences</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Job type">
                <select value={profile.preferredJobType} onChange={e => setProfile(p => ({ ...p, preferredJobType: e.target.value }))} className={inputCls}>
                  <option value="">Any</option>
                  {["Full-time", "Part-time", "Contract", "Internship", "Freelance"].map(v => <option key={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Work mode">
                <select value={profile.preferredWorkMode} onChange={e => setProfile(p => ({ ...p, preferredWorkMode: e.target.value }))} className={inputCls}>
                  <option value="">Any</option>
                  {["Remote", "Hybrid", "On-site"].map(v => <option key={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Preferred niche / industry">
                <input value={profile.preferredNiche} onChange={e => setProfile(p => ({ ...p, preferredNiche: e.target.value }))} placeholder="e.g. Tech, Finance" className={inputCls} />
              </Field>
              <Field label="Min salary">
                <input type="number" value={profile.preferredSalaryMin || ""} onChange={e => setProfile(p => ({ ...p, preferredSalaryMin: Number(e.target.value) }))} placeholder="50000" className={inputCls} />
              </Field>
              <Field label="Max salary">
                <input type="number" value={profile.preferredSalaryMax || ""} onChange={e => setProfile(p => ({ ...p, preferredSalaryMax: Number(e.target.value) }))} placeholder="100000" className={inputCls} />
              </Field>
            </div>
          </section>

          {/* Social Links */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-5">Social Links</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {(["linkedin", "github", "portfolio"] as const).map(key => (
                <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                  <input value={(profile.socialLinks as any)[key] ?? ""} onChange={e => setProfile(p => ({ ...p, socialLinks: { ...p.socialLinks, [key]: e.target.value } }))}
                    placeholder={key === "linkedin" ? "https://linkedin.com/in/…" : key === "github" ? "https://github.com/…" : "https://…"}
                    className={inputCls} />
                </Field>
              ))}
            </div>
          </section>

          {/* AI Profile Audit */}
          <ProfileOptimizer token={token} profile={profile} />

          {error ? <SeekerErrorNotice error={error} /> : null}

          <div className="flex justify-end gap-3 pb-8">
            {saved && <span className="flex items-center text-sm font-semibold text-green-600">✓ Profile saved!</span>}
            <button type="submit" disabled={saving}
              className="rounded-2xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

// ── AI Profile Optimizer ──────────────────────────────────────────────────────

type OptimizeResult = {
  profileScore: number;
  grade: string;
  improvements: { priority: "high" | "medium" | "low"; action: string; impact: string; howTo: string }[];
  inDemandSkills: string[];
  missingFromProfile: string[];
  salaryInsight: string;
};

function ProfileOptimizer({ token, profile }: { token: string | null; profile: Profile }) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<OptimizeResult | null>(null);
  const [error, setError]       = useState<unknown>("");
  const [expanded, setExpanded] = useState(false);

  async function handleAnalyze() {
    if (!token) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/profile/optimize"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          resumeText: profile.resumeText,
          targetRole: profile.headline,
          currentSkills: profile.skills,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw apiErrorFromPayload(res.status, data, "Optimization failed.");
      setResult(data);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const priorityColors = {
    high:   "border-rose-200 bg-rose-50 text-rose-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low:    "border-slate-200 bg-slate-100 text-slate-600",
  };
  const gradeColor = (g: string) =>
    g === "A" ? "text-green-600" : g === "B" ? "text-indigo-600" : g === "C" ? "text-amber-600" : "text-rose-600";

  return (
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <button onClick={() => setExpanded(v => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 text-lg">🔍</span>
          <div className="text-left">
            <p className="font-bold text-slate-900">AI Profile Audit</p>
            <p className="text-xs text-slate-500">Get ranked improvements with estimated impact on your match rate</p>
          </div>
        </div>
        <span className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>

      {expanded && (
        <div className="mt-5 space-y-4">
          {!result && (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  AI analyzing your profile against thousands of job listings…
                </span>
              ) : "Analyze My Profile →"}
            </button>
          )}

          <SeekerErrorNotice error={error} />

          {result && (
            <div className="space-y-5">
              {/* Score */}
              <div className="flex items-center gap-6 rounded-2xl border border-slate-100 bg-white p-5">
                <div className="text-center">
                  <p className={`text-5xl font-black ${gradeColor(result.grade)}`}>{result.grade}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Grade</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-slate-900">{result.profileScore}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${result.profileScore}%` }} />
                  </div>
                  {result.salaryInsight && (
                    <p className="mt-2 text-xs text-slate-500">💰 {result.salaryInsight}</p>
                  )}
                </div>
              </div>

              {/* In-demand skills */}
              {result.missingFromProfile.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-2">Missing in-demand skills</p>
                  <div className="flex flex-wrap gap-2">
                    {result.missingFromProfile.map(s => (
                      <span key={s} className="rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">+ {s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvements */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ranked Improvements</p>
                {result.improvements.map((imp, i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-sm font-semibold text-slate-900">{imp.action}</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityColors[imp.priority]}`}>
                        {imp.priority}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-green-600 mb-1">{imp.impact}</p>
                    <p className="text-xs text-slate-500">{imp.howTo}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAnalyze}
                className="w-full rounded-2xl border border-indigo-200 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                Re-analyze
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function SeekerProfilePage() {
  return <RecruitGuard requiredRole="seeker"><ProfileContent /></RecruitGuard>;
}
