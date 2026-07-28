"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { apiUrl } from "@/lib/api";

type Profile = {
  name: string; email: string; phone: string; headline: string; bio: string;
  skills: string[]; resumeText: string; resumeFileName: string;
  experienceLevel: string; preferredJobType: string; preferredWorkMode: string;
  preferredLocation: string; preferredSalaryMin: number; preferredSalaryMax: number;
  preferredNiche: string;
  experience: { title: string; company: string; startDate: string; endDate: string; current: boolean; description: string }[];
  education: { degree: string; institution: string; year: string }[];
  socialLinks: { linkedin: string; github: string; portfolio: string };
};

const BLANK: Profile = {
  name: "", email: "", phone: "", headline: "", bio: "",
  skills: [], resumeText: "", resumeFileName: "",
  experienceLevel: "", preferredJobType: "", preferredWorkMode: "",
  preferredLocation: "", preferredSalaryMin: 0, preferredSalaryMax: 0,
  preferredNiche: "",
  experience: [], education: [],
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
  const [error, setError]     = useState("");

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
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message); }
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
          <h1 className="text-2xl font-bold text-slate-900">{onboarding ? "Set up your profile 🎉" : "My Profile"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {onboarding ? "Complete your profile to start applying to jobs with one click." : "Keep your info up to date to get the best job matches."}
          </p>
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

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

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

export default function SeekerProfilePage() {
  return <RecruitGuard requiredRole="seeker"><ProfileContent /></RecruitGuard>;
}
