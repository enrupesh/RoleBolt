"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebaseClient";
import RecruitHeader from "@/components/RecruitHeader";
import { RecruitGuard } from "@/components/RecruitGuard";
import { apiUrl, readApiJson } from "@/lib/api";

const NICHES = [
  "AI, Data, Software & Product Tech",
  "Sales, Business Development & Revenue Roles",
  "Finance, Accounting, Banking & Fintech",
  "Healthcare, Pharma & Allied Medical Workforce",
  "Skilled Blue-Collar, Logistics & Industrial Workforce",
  "Creative, Marketing, Media & Design",
];
const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const WORK_MODES = ["Remote", "Hybrid", "Onsite"];
const EXPERIENCE_LEVELS = [
  "Fresher / 0–1 year",
  "1–3 years",
  "3–5 years",
  "5–8 years",
  "8–12 years",
  "12+ years",
];

type Experience = { title: string; company: string; location: string; startDate: string; endDate: string; current: boolean; description: string };
type Education = { degree: string; institution: string; year: string; description: string };
type SocialLinks = {
  linkedin: string; instagram: string; twitter: string; github: string; portfolio: string;
};

type Profile = {
  name: string; email: string; phone: string; headline: string; bio: string;
  skills: string[]; experience: Experience[]; education: Education[];
  preferredJobType: string; preferredWorkMode: string; preferredLocation: string;
  preferredSalaryMin: number | ""; preferredSalaryMax: number | "";
  preferredNiche: string; experienceLevel: string; resumeText: string;
  socialLinks: SocialLinks;
  photoUrl: string;
};

const EMPTY_EXP: Experience = { title: "", company: "", location: "", startDate: "", endDate: "", current: false, description: "" };
const EMPTY_EDU: Education = { degree: "", institution: "", year: "", description: "" };

type Section = "basics" | "experience" | "education" | "preferences" | "resume";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "basics", label: "Basic Info", icon: "👤" },
  { id: "experience", label: "Experience", icon: "💼" },
  { id: "education", label: "Education", icon: "🎓" },
  { id: "preferences", label: "Preferences", icon: "⚙️" },
  { id: "resume", label: "Resume", icon: "📄" },
];

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <input className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition" {...props} />
    </div>
  );
}

function Textarea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition resize-none" {...props} />
    </div>
  );
}

function Select({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <select className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] transition bg-white" {...props}>{children}</select>
    </div>
  );
}

function RecruitProfileContent() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("basics");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile>({
    name: "", email: "", phone: "", headline: "", bio: "",
    skills: [], experience: [], education: [],
    preferredJobType: "", preferredWorkMode: "", preferredLocation: "",
    preferredSalaryMin: "", preferredSalaryMax: "",
    preferredNiche: "", experienceLevel: "", resumeText: "",
    socialLinks: { linkedin: "", instagram: "", twitter: "", github: "", portfolio: "" },
    photoUrl: "",
  });

  const completionItems = [
    Boolean(profile.name && profile.email),
    profile.skills.length > 0,
    Boolean(profile.preferredNiche || profile.preferredJobType || profile.preferredWorkMode),
    Boolean(profile.resumeText && profile.resumeText.length > 80),
    profile.experience.length > 0 || profile.education.length > 0,
    Boolean(profile.preferredSalaryMin || profile.preferredSalaryMax),
    Boolean(profile.experienceLevel),
  ];
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const t = await u.getIdToken();
        setToken(t);
        setUid(u.uid);
        setProfile(prev => ({
          ...prev,
          email: prev.email || u.email || "",
          name: prev.name || u.displayName || "",
        }));
      } else {
        setNeedsLogin(true);
        setLoading(false);
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/profile"), { headers: { Authorization: `Bearer ${token}` } });
      const data = await readApiJson(res);
      if (data.profile) {
        const p = data.profile;
        setProfile({
          name: p.name || "", email: p.email || "", phone: p.phone || "",
          headline: p.headline || "", bio: p.bio || "",
          skills: p.skills || [], experience: p.experience || [], education: p.education || [],
          preferredJobType: p.preferredJobType || "", preferredWorkMode: p.preferredWorkMode || "",
          preferredLocation: p.preferredLocation || "",
          preferredSalaryMin: p.preferredSalaryMin || "",
          preferredSalaryMax: p.preferredSalaryMax || "",
          preferredNiche: p.preferredNiche || "",
          experienceLevel: p.experienceLevel || "",
          resumeText: p.resumeText || "",
          socialLinks: {
            linkedin: p.socialLinks?.linkedin || "",
            instagram: p.socialLinks?.instagram || "",
            twitter: p.socialLinks?.twitter || "",
            github: p.socialLinks?.github || "",
            portfolio: p.socialLinks?.portfolio || "",
          },
          photoUrl: p.photoUrl || "",
        });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile(prev => ({ ...prev, [key]: value }));
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !profile.skills.includes(s)) set("skills", [...profile.skills, s]);
    setSkillInput("");
  }

  function updateExp(idx: number, field: keyof Experience, value: any) {
    set("experience", profile.experience.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function updateEdu(idx: number, field: keyof Education, value: any) {
    set("education", profile.education.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  async function handlePhotoUpload(file: File) {
    if (!uid) return;
    setUploadingPhoto(true);
    setUploadError("");
    try {
      const storage = getFirebaseStorage();
      const storageRef = ref(storage, `recruit/seekerPhotos/${uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      set("photoUrl", url);
    } catch (e: any) {
      setUploadError("Photo upload failed. Please try again or paste a photo URL.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function save() {
    if (!token) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...profile,
          preferredSalaryMin: profile.preferredSalaryMin !== "" ? Number(profile.preferredSalaryMin) : undefined,
          preferredSalaryMax: profile.preferredSalaryMax !== "" ? Number(profile.preferredSalaryMax) : undefined,
        }),
      });
      if (!res.ok) { const d = await readApiJson(res); throw new Error(d.error || "Save failed"); }
      try {
        localStorage.setItem("recruit_applicant_name", profile.name);
        localStorage.setItem("recruit_applicant_email", profile.email);
        localStorage.setItem("recruit_applicant_phone", profile.phone);
        if (profile.resumeText) localStorage.setItem("recruit_resume_text", profile.resumeText);
        localStorage.setItem("recruit_seeker_profile", JSON.stringify({
          skills: profile.skills,
          preferredNiche: profile.preferredNiche,
          preferredWorkMode: profile.preferredWorkMode,
          preferredLocation: profile.preferredLocation,
          preferredSalaryMin: profile.preferredSalaryMin,
          preferredSalaryMax: profile.preferredSalaryMax,
          experienceLevel: profile.experienceLevel,
        }));
      } catch { /* ignore */ }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <RecruitHeader />
        <div className="flex items-center justify-center py-32">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading your profile…
          </div>
        </div>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <RecruitHeader />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl">👤</div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Sign in to manage your seeker profile</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your profile stores your contact details, skills, preferences, and resume text so you can apply faster.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/login?next=/recruit/profile" className="rounded-full bg-[#0a66c2] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#004182]">
              Sign in
            </Link>
            <Link href="/recruit/opportunities" className="rounded-full border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              Browse jobs
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <RecruitHeader />

      <div className="sticky top-[57px] z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex items-center justify-between py-2.5">
          <h1 className="text-sm font-bold text-slate-900">My Profile</h1>
          <div className="flex items-center gap-2">
            {error && <p className="text-xs text-red-600 hidden sm:block">{error}</p>}
            {saved && <span className="text-xs font-semibold text-green-600">✓ Saved</span>}
            <button onClick={save} disabled={saving} className="rounded-full bg-[#0a66c2] px-5 py-2 text-xs font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-95">
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
        {error && <p className="mb-3 text-sm text-red-600 sm:hidden">{error}</p>}

        <div className="mb-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0a66c2]">Seeker profile</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Apply faster with one saved profile</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Complete this once so job applications can prefill your name, contact details, and resume text.</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:min-w-44">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Profile strength</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{completion}%</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#0a66c2]" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { done: Boolean(profile.name && profile.email), label: "Basic info", detail: "Name and email added", missing: "Add your name and email" },
              { done: profile.skills.length > 0, label: "Skills", detail: `${profile.skills.length} skill${profile.skills.length !== 1 ? "s" : ""} added`, missing: "Add at least one skill" },
              { done: Boolean(profile.preferredNiche || profile.preferredWorkMode || profile.preferredJobType), label: "Job preferences", detail: "Preferences set", missing: "Set your niche or work mode" },
              { done: Boolean(profile.resumeText && profile.resumeText.length > 80), label: "Resume text", detail: "Resume pasted", missing: "Paste your resume (80+ chars)" },
              { done: profile.experience.length > 0 || profile.education.length > 0, label: "Experience or education", detail: "Background added", missing: "Add work or education history" },
              { done: Boolean(profile.preferredSalaryMin || profile.preferredSalaryMax), label: "Salary expectation", detail: "Salary range set", missing: "Set your expected salary" },
              { done: Boolean(profile.experienceLevel), label: "Experience level", detail: profile.experienceLevel, missing: "Set your experience level for better AI matching" },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ring-1 text-xs font-medium ${item.done ? "bg-green-50 ring-green-200 text-green-800" : "bg-white ring-slate-100 text-slate-500"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${item.done ? "bg-green-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {item.done ? "✓" : "○"}
                </span>
                <div>
                  <p className={`font-semibold ${item.done ? "text-green-800" : "text-slate-700"}`}>{item.label}</p>
                  <p className="mt-0.5">{item.done ? item.detail : item.missing}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeSection === s.id
                  ? "bg-[#0a66c2] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          {activeSection === "basics" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Basic Information</h2>
                <p className="text-sm text-slate-500 mt-0.5">Your professional identity on Plyndrox Recruit AI.</p>
              </div>

              <div className="flex items-center gap-5 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="relative shrink-0">
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] text-2xl font-black text-white border-2 border-white shadow-md">
                      {profile.name?.slice(0, 1).toUpperCase() || "?"}
                    </div>
                  )}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Profile Photo</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-3">Upload a photo or paste a URL. Square photos work best.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="rounded-full border border-[#0a66c2] px-4 py-1.5 text-xs font-semibold text-[#0a66c2] hover:bg-blue-50 transition disabled:opacity-50"
                    >
                      {uploadingPhoto ? "Uploading…" : "Upload photo"}
                    </button>
                    {profile.photoUrl && (
                      <button type="button" onClick={() => set("photoUrl", "")} className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                        Remove
                      </button>
                    )}
                  </div>
                  {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full Name" value={profile.name} onChange={e => set("name", e.target.value)} placeholder="Your full name" />
                <Input label="Email" value={profile.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" type="email" />
                <Input label="Phone" value={profile.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                <Input label="Headline" value={profile.headline} onChange={e => set("headline", e.target.value)} placeholder="e.g. Software Engineer at Infosys" />
              </div>
              <Textarea label="Bio / Summary" value={profile.bio} onChange={e => set("bio", e.target.value)} placeholder="A short summary about yourself, your goals, and what you bring to the table…" rows={4} />

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Social & Portfolio Links</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add your professional profiles so recruiters can learn more about you.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">LinkedIn</label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                      <svg width="14" height="14" fill="currentColor" className="text-[#0a66c2] shrink-0" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                      <input value={profile.socialLinks.linkedin} onChange={e => set("socialLinks", { ...profile.socialLinks, linkedin: e.target.value })} placeholder="linkedin.com/in/yourname" className="flex-1 text-sm outline-none bg-transparent" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Instagram</label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500 shrink-0" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                      <input value={profile.socialLinks.instagram} onChange={e => set("socialLinks", { ...profile.socialLinks, instagram: e.target.value })} placeholder="instagram.com/yourhandle" className="flex-1 text-sm outline-none bg-transparent" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">X / Twitter</label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                      <svg width="14" height="14" fill="currentColor" className="text-slate-700 shrink-0" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      <input value={profile.socialLinks.twitter} onChange={e => set("socialLinks", { ...profile.socialLinks, twitter: e.target.value })} placeholder="x.com/yourhandle" className="flex-1 text-sm outline-none bg-transparent" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">GitHub</label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                      <svg width="14" height="14" fill="currentColor" className="text-slate-800 shrink-0" viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                      <input value={profile.socialLinks.github} onChange={e => set("socialLinks", { ...profile.socialLinks, github: e.target.value })} placeholder="github.com/yourusername" className="flex-1 text-sm outline-none bg-transparent" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Portfolio / Website</label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 shrink-0" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      <input value={profile.socialLinks.portfolio} onChange={e => set("socialLinks", { ...profile.socialLinks, portfolio: e.target.value })} placeholder="yourwebsite.com" className="flex-1 text-sm outline-none bg-transparent" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Skills</label>
                <div className="flex gap-2">
                  <input
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    placeholder="Type a skill and press Enter…"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition"
                  />
                  <button onClick={addSkill} className="rounded-lg bg-[#0a66c2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004182] transition">
                    Add
                  </button>
                </div>
                {profile.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.skills.map(skill => (
                      <span key={skill} className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-[#0a66c2]">
                        {skill}
                        <button onClick={() => set("skills", profile.skills.filter(s => s !== skill))} className="text-[#0a66c2]/50 hover:text-red-500 transition font-bold">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "experience" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Work Experience</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{profile.experience.length} role{profile.experience.length !== 1 ? "s" : ""} added</p>
                </div>
                <button onClick={() => set("experience", [...profile.experience, { ...EMPTY_EXP }])} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                  + Add role
                </button>
              </div>
              {profile.experience.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <div className="text-3xl mb-2">💼</div>
                  <p className="text-sm text-slate-500">No work experience added yet.</p>
                  <button onClick={() => set("experience", [...profile.experience, { ...EMPTY_EXP }])} className="mt-3 text-sm font-semibold text-[#0a66c2] hover:underline">
                    + Add your first role
                  </button>
                </div>
              ) : (
                profile.experience.map((exp, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Role {idx + 1}</span>
                      <button onClick={() => set("experience", profile.experience.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-600 transition font-semibold">
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input label="Job Title" value={exp.title} onChange={e => updateExp(idx, "title", e.target.value)} placeholder="e.g. Software Engineer" />
                      <Input label="Company" value={exp.company} onChange={e => updateExp(idx, "company", e.target.value)} placeholder="e.g. Infosys" />
                      <Input label="Location" value={exp.location} onChange={e => updateExp(idx, "location", e.target.value)} placeholder="e.g. Bengaluru" />
                      <Input label="Start Date" value={exp.startDate} onChange={e => updateExp(idx, "startDate", e.target.value)} placeholder="e.g. Jan 2022" />
                      {!exp.current && (
                        <Input label="End Date" value={exp.endDate} onChange={e => updateExp(idx, "endDate", e.target.value)} placeholder="e.g. Mar 2024" />
                      )}
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <input type="checkbox" id={`curr-${idx}`} checked={exp.current} onChange={e => updateExp(idx, "current", e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0a66c2]" />
                        <label htmlFor={`curr-${idx}`} className="text-sm text-slate-700">I currently work here</label>
                      </div>
                    </div>
                    <Textarea label="Description" value={exp.description} onChange={e => updateExp(idx, "description", e.target.value)} placeholder="Describe your responsibilities and achievements…" rows={3} />
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === "education" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Education</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{profile.education.length} entr{profile.education.length !== 1 ? "ies" : "y"} added</p>
                </div>
                <button onClick={() => set("education", [...profile.education, { ...EMPTY_EDU }])} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                  + Add education
                </button>
              </div>
              {profile.education.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <div className="text-3xl mb-2">🎓</div>
                  <p className="text-sm text-slate-500">No education added yet.</p>
                  <button onClick={() => set("education", [...profile.education, { ...EMPTY_EDU }])} className="mt-3 text-sm font-semibold text-[#0a66c2] hover:underline">
                    + Add your education
                  </button>
                </div>
              ) : (
                profile.education.map((edu, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Entry {idx + 1}</span>
                      <button onClick={() => set("education", profile.education.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-600 transition font-semibold">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input label="Degree / Certification" value={edu.degree} onChange={e => updateEdu(idx, "degree", e.target.value)} placeholder="e.g. B.Tech Computer Science" />
                      <Input label="Institution" value={edu.institution} onChange={e => updateEdu(idx, "institution", e.target.value)} placeholder="e.g. IIT Delhi" />
                      <Input label="Graduation Year" value={edu.year} onChange={e => updateEdu(idx, "year", e.target.value)} placeholder="e.g. 2023" />
                      <Input label="Notes (optional)" value={edu.description} onChange={e => updateEdu(idx, "description", e.target.value)} placeholder="e.g. Specialization, GPA…" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === "preferences" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Job Preferences</h2>
                <p className="text-sm text-slate-500 mt-0.5">Tell us what kind of roles you're looking for. This improves your AI match score.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Experience Level" value={profile.experienceLevel} onChange={e => set("experienceLevel", e.target.value)}>
                  <option value="">Select your level</option>
                  {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
                <Select label="Preferred Niche" value={profile.preferredNiche} onChange={e => set("preferredNiche", e.target.value)}>
                  <option value="">Any niche</option>
                  {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                </Select>
                <Select label="Preferred Job Type" value={profile.preferredJobType} onChange={e => set("preferredJobType", e.target.value)}>
                  <option value="">Any</option>
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Select label="Preferred Work Mode" value={profile.preferredWorkMode} onChange={e => set("preferredWorkMode", e.target.value)}>
                  <option value="">Any</option>
                  {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Input label="Preferred Location" value={profile.preferredLocation} onChange={e => set("preferredLocation", e.target.value)} placeholder="e.g. Bengaluru, Remote" />
                <Input label="Min Expected Salary (₹/yr)" type="number" value={profile.preferredSalaryMin} onChange={e => set("preferredSalaryMin", e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 800000" />
                <Input label="Max Expected Salary (₹/yr)" type="number" value={profile.preferredSalaryMax} onChange={e => set("preferredSalaryMax", e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 1500000" />
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5">
                <p className="text-xs text-blue-700 leading-relaxed">
                  <span className="font-bold">Tip:</span> Setting your experience level and niche helps our AI give you more accurate match scores when you view a job.
                </p>
              </div>
            </div>
          )}

          {activeSection === "resume" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Resume / Work History</h2>
                <p className="text-sm text-slate-500 mt-0.5">Paste your resume once. It auto-fills when you apply to jobs.</p>
              </div>
              <textarea
                value={profile.resumeText}
                onChange={e => set("resumeText", e.target.value)}
                placeholder="Paste your full resume text, LinkedIn summary, or work history here. Include skills, experience, education, certifications and key achievements…"
                rows={20}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition resize-none font-mono"
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <p>{profile.resumeText.length} characters</p>
                <p>Tip: More detail = better AI matching score</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={save} disabled={saving} className="w-full sm:w-auto rounded-full bg-[#0a66c2] px-8 py-2.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-95">
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save profile"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function RecruitProfilePage() {
  return <RecruitGuard requiredRole="seeker"><RecruitProfileContent /></RecruitGuard>;
}
