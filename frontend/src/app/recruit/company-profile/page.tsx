"use client";

import { useState, useEffect, useRef } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebaseClient";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import { apiUrl, readApiJson } from "@/lib/api";

const COMPANY_TYPES = ["Startup", "MNC", "Agency", "Product Company", "Consultancy", "Hospital", "Fintech", "NGO", "Government", "Other"];
const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500–1000", "1000+"];
const INDUSTRIES = [
  "AI, Data & Technology", "Sales & Business Development", "Finance, Banking & Fintech",
  "Healthcare & Pharma", "Logistics & Industrial", "Creative, Marketing & Media",
  "Education", "Real Estate", "Manufacturing", "Other",
];

type CompanyProfile = {
  companyName: string; companyType: string; industry: string; companySize: string;
  website: string; location: string; description: string; mission: string;
  benefits: string; linkedinUrl: string; logoUrl: string;
  bio: string; photoUrl: string;
  socialLinks: { instagram: string; twitter: string; github: string; portfolio: string };
};

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

function CompanyProfileContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uid, setUid] = useState<string>("");
  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: "", companyType: "", industry: "", companySize: "",
    website: "", location: "", description: "", mission: "", benefits: "",
    linkedinUrl: "", logoUrl: "", bio: "", photoUrl: "",
    socialLinks: { instagram: "", twitter: "", github: "", portfolio: "" },
  });
  const [verificationStatus, setVerificationStatus] = useState<"none" | "requested" | "verified" | "rejected">("none");
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [authToken, setAuthToken] = useState<string>("");

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      try {
        const token = await u.getIdToken();
        setAuthToken(token);
        setUid(u.uid);
        const res = await fetch(apiUrl("/recruit/company/profile"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await readApiJson(res);
          if (data.profile) {
            const p = data.profile;
            setProfile({
              companyName: p.companyName || "",
              companyType: p.companyType || "",
              industry: p.industry || "",
              companySize: p.companySize || "",
              website: p.website || "",
              location: p.location || "",
              description: p.description || "",
              mission: p.mission || "",
              benefits: p.benefits || "",
              linkedinUrl: p.linkedinUrl || "",
              logoUrl: p.logoUrl || "",
              bio: p.bio || "",
              photoUrl: p.photoUrl || "",
              socialLinks: {
                instagram: p.socialLinks?.instagram || "",
                twitter: p.socialLinks?.twitter || "",
                github: p.socialLinks?.github || "",
                portfolio: p.socialLinks?.portfolio || "",
              },
            });
            setVerificationStatus(data.profile.verificationStatus || "none");
          }
        }
      } catch { /* ignore, use defaults */ }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  async function uploadImage(file: File, path: string): Promise<string> {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setLogoUploadError("");
    try {
      const url = await uploadImage(file, `recruit/companyLogos/${uid}`);
      setProfile(prev => ({ ...prev, logoUrl: url }));
    } catch {
      setLogoUploadError("Logo upload failed. Please try again or paste a URL.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    setPhotoUploadError("");
    try {
      const url = await uploadImage(file, `recruit/recruiterPhotos/${uid}`);
      setProfile(prev => ({ ...prev, photoUrl: url }));
    } catch {
      setPhotoUploadError("Photo upload failed. Please try again or paste a URL.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function requestVerification() {
    if (!authToken) return;
    setRequestingVerification(true);
    setVerificationMessage("");
    try {
      const res = await fetch(apiUrl("/recruit/company/request-verification"), {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to request verification.");
      setVerificationStatus(data.status);
      setVerificationMessage(data.message);
    } catch (e: any) {
      setVerificationMessage(e.message);
    } finally {
      setRequestingVerification(false);
    }
  }

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setProfile(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to save.");
      const token = await user.getIdToken();
      const res = await fetch(apiUrl("/recruit/company/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const body = await readApiJson(res).catch(() => ({}));
        throw new Error((body as any).error || "Failed to save profile.");
      }
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
      <div className="min-h-screen bg-[#f3f6f8]">
        <RecruitHeader />
        <div className="flex items-center justify-center py-32">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6f8] text-slate-900">
      <RecruitHeader />

      <div className="sticky top-[57px] z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 flex items-center justify-between py-2.5">
          <div className="flex items-center gap-3">
            <Link href="/recruit/dashboard" className="text-sm text-slate-500 hover:text-slate-800 transition">← Dashboard</Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-sm font-bold text-slate-900">Company Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            {error && <p className="text-xs text-red-600 hidden sm:block">{error}</p>}
            {saved && <span className="text-xs font-semibold text-green-600">✓ Saved</span>}
            <button onClick={save} disabled={saving} className="rounded-full bg-[#0a66c2] px-5 py-2 text-xs font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-95">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6 space-y-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">Basic Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company Name" value={profile.companyName} onChange={e => set("companyName", e.target.value)} placeholder="e.g. Infosys" />
            <Select label="Company Type" value={profile.companyType} onChange={e => set("companyType", e.target.value)}>
              <option value="">Select type</option>
              {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Industry" value={profile.industry} onChange={e => set("industry", e.target.value)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </Select>
            <Select label="Company Size" value={profile.companySize} onChange={e => set("companySize", e.target.value)}>
              <option value="">Select size</option>
              {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
            </Select>
            <Input label="HQ Location" value={profile.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Bengaluru, Karnataka" />
            <Input label="Website" value={profile.website} onChange={e => set("website", e.target.value)} placeholder="https://yourcompany.com" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">About the Company</h2>
          <Textarea label="Company Description" value={profile.description} onChange={e => set("description", e.target.value)} placeholder="Tell candidates what your company does, your products, and your culture…" rows={4} />
          <Textarea label="Mission & Values" value={profile.mission} onChange={e => set("mission", e.target.value)} placeholder="What is your company's mission? What values do you stand for?" rows={3} />
          <Textarea label="Benefits & Perks" value={profile.benefits} onChange={e => set("benefits", e.target.value)} placeholder="e.g. Health insurance, flexible hours, remote work, learning budget, equity…" rows={3} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">Logo & Company Links</h2>

          <div className="flex items-start gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="relative shrink-0">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Logo" className="h-20 w-20 rounded-xl object-contain border border-slate-200 bg-white shadow-sm" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-200 text-slate-400 text-xs font-semibold">Logo</div>
              )}
              {uploadingLogo && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-100">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Company Logo</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">Upload an image or paste a URL. Square logos work best.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                  className="rounded-full border border-[#0a66c2] px-4 py-1.5 text-xs font-semibold text-[#0a66c2] hover:bg-blue-50 transition disabled:opacity-50">
                  {uploadingLogo ? "Uploading…" : "Upload logo"}
                </button>
                {profile.logoUrl && (
                  <button type="button" onClick={() => set("logoUrl", "")}
                    className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Or paste URL</label>
                <input value={profile.logoUrl} onChange={e => set("logoUrl", e.target.value)} placeholder="https://… (image URL)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition bg-white" />
              </div>
              {logoUploadError && <p className="mt-1.5 text-xs text-red-600">{logoUploadError}</p>}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
          </div>

          <Input label="LinkedIn Company URL" value={profile.linkedinUrl} onChange={e => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/company/…" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">About You (Recruiter / Hiring Manager)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tell job seekers about yourself — who you are, your background, and what you look for in candidates.</p>
          </div>

          <div className="flex items-start gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="relative shrink-0">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="" aria-hidden="true" className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] text-2xl font-black text-white border-2 border-white shadow-md">
                  {profile.companyName?.slice(0, 1).toUpperCase() || "R"}
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
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Your Profile Photo</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">Your personal photo shown to job seekers who view your recruiter profile.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                  className="rounded-full border border-[#0a66c2] px-4 py-1.5 text-xs font-semibold text-[#0a66c2] hover:bg-blue-50 transition disabled:opacity-50">
                  {uploadingPhoto ? "Uploading…" : "Upload photo"}
                </button>
                {profile.photoUrl && (
                  <button type="button" onClick={() => set("photoUrl", "")}
                    className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                    Remove
                  </button>
                )}
              </div>
              {photoUploadError && <p className="mt-1.5 text-xs text-red-600">{photoUploadError}</p>}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }} />
          </div>

          <Textarea label="Bio / About you" value={profile.bio} onChange={e => set("bio", e.target.value)}
            placeholder="Hi, I'm [Name] — Head of Talent at [Company]. I look for candidates who are passionate, curious, and collaborative…" rows={4} />

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Social & Portfolio Links</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">LinkedIn</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                  <svg width="13" height="13" fill="currentColor" className="text-[#0a66c2] shrink-0" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                  <input value={profile.linkedinUrl} onChange={e => set("linkedinUrl", e.target.value)} placeholder="linkedin.com/in/yourname" className="flex-1 text-sm outline-none bg-transparent" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Instagram</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500 shrink-0" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  <input value={profile.socialLinks.instagram} onChange={e => set("socialLinks", { ...profile.socialLinks, instagram: e.target.value })} placeholder="instagram.com/yourhandle" className="flex-1 text-sm outline-none bg-transparent" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">X / Twitter</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                  <svg width="13" height="13" fill="currentColor" className="text-slate-700 shrink-0" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  <input value={profile.socialLinks.twitter} onChange={e => set("socialLinks", { ...profile.socialLinks, twitter: e.target.value })} placeholder="x.com/yourhandle" className="flex-1 text-sm outline-none bg-transparent" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Portfolio / Website</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500 shrink-0" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  <input value={profile.socialLinks.portfolio} onChange={e => set("socialLinks", { ...profile.socialLinks, portfolio: e.target.value })} placeholder="yourwebsite.com" className="flex-1 text-sm outline-none bg-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border shadow-sm overflow-hidden ${verificationStatus === "verified" ? "border-green-200 bg-green-50" : verificationStatus === "requested" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
          {verificationStatus === "verified" ? (
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-lg font-black">✓</div>
              <div>
                <p className="text-sm font-bold text-green-800">Company Verified</p>
                <p className="text-xs text-green-700 mt-0.5">Your company has been verified by the Plyndrox team. A "Verified" badge appears on all your job listings.</p>
              </div>
            </div>
          ) : verificationStatus === "requested" ? (
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-lg">⏳</div>
              <div>
                <p className="text-sm font-bold text-amber-800">Verification Under Review</p>
                <p className="text-xs text-amber-700 mt-0.5">Your verification request has been submitted. Our team will review within 2–3 business days.</p>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0a66c2]">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Get your company verified</h2>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Verified companies get a ✓ badge on every job listing, appear higher in search results, and earn more trust from job seekers.
                  </p>
                </div>
              </div>
              <ul className="mb-4 grid gap-2 sm:grid-cols-3">
                {["Higher listing visibility", "✓ Verified badge on all jobs", "More candidate applications"].map(b => (
                  <li key={b} className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0a66c2]">
                    <span className="text-green-600">✓</span> {b}
                  </li>
                ))}
              </ul>
              {verificationMessage && (
                <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{verificationMessage}</p>
              )}
              <button onClick={requestVerification} disabled={requestingVerification}
                className="rounded-full bg-[#0a66c2] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition">
                {requestingVerification ? "Submitting…" : "Request company verification"}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 pb-6">
          <button onClick={save} disabled={saving} className="w-full sm:w-auto rounded-full bg-[#0a66c2] px-8 py-2.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-95">
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save company profile"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function CompanyProfilePage() {
  return <RecruitGuard requiredRole="creator"><CompanyProfileContent /></RecruitGuard>;
}
