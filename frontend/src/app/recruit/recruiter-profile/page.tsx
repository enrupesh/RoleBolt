"use client";

import { useState, useEffect, useRef } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import { apiUrl, readApiJson } from "@/lib/api";
import { uploadImage } from "@/lib/uploadImage";

type ProfileType = "company" | "educational_institute" | "individual" | "content_creator" | "ngo_government";

const PROFILE_TYPES: { value: ProfileType; label: string; blurb: string }[] = [
  { value: "company", label: "Company / Organisation", blurb: "Any registered business — startup, MNC, agency, hospital, real estate, or other" },
  { value: "educational_institute", label: "Educational Institute", blurb: "School, college, university or coaching institute" },
  { value: "individual", label: "Individual / Freelance Recruiter", blurb: "Hiring on your own, not on behalf of a registered company" },
  { value: "content_creator", label: "Content Creator / Personal Brand", blurb: "Hiring editors, writers, VAs or team members for your brand" },
  { value: "ngo_government", label: "NGO / Government", blurb: "Non-profit organisation or government body" },
];

const COMPANY_TYPES = ["Startup", "MNC", "Agency", "Product Company", "Consultancy", "Other"];
const INSTITUTE_TYPES = ["School", "College", "University", "Coaching / Training Institute", "Other"];
const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500–1000", "1000+"];
const INDUSTRIES = [
  "AI, Data & Technology", "Sales & Business Development", "Finance, Banking & Fintech",
  "Healthcare & Pharma", "Logistics & Industrial", "Creative, Marketing & Media",
  "Education", "Real Estate", "Manufacturing", "Other",
];

const COPY: Record<ProfileType, {
  nameLabel: string; namePlaceholder: string;
  aboutLabel: string; aboutPlaceholder: string;
  logoLabel: string; logoSectionTitle: string;
  showLogo: boolean; showOrgFields: boolean; showInstituteFields: boolean;
  showNiche: boolean; nicheLabel: string; nichePlaceholder: string;
  showRegistration: boolean;
  verifyNoun: string;
}> = {
  company: {
    nameLabel: "Company Name", namePlaceholder: "e.g. Infosys",
    aboutLabel: "Company Description", aboutPlaceholder: "Tell candidates what your company does, your products, and your culture…",
    logoLabel: "Company Logo", logoSectionTitle: "Logo & Company Links",
    showLogo: true, showOrgFields: true, showInstituteFields: false,
    showNiche: false, nicheLabel: "", nichePlaceholder: "",
    showRegistration: false,
    verifyNoun: "company",
  },
  educational_institute: {
    nameLabel: "Institute Name", namePlaceholder: "e.g. Delhi Public School",
    aboutLabel: "About the Institute", aboutPlaceholder: "Tell candidates about your institute, courses, and campus culture…",
    logoLabel: "Institute Logo", logoSectionTitle: "Logo & Institute Links",
    showLogo: true, showOrgFields: false, showInstituteFields: true,
    showNiche: false, nicheLabel: "", nichePlaceholder: "",
    showRegistration: false,
    verifyNoun: "institute",
  },
  individual: {
    nameLabel: "Your Name", namePlaceholder: "e.g. Priya Sharma",
    aboutLabel: "About You", aboutPlaceholder: "Tell candidates who you are and what kind of work you're hiring for…",
    logoLabel: "", logoSectionTitle: "",
    showLogo: false, showOrgFields: false, showInstituteFields: false,
    showNiche: true, nicheLabel: "What do you usually hire for?", nichePlaceholder: "e.g. Video editors, virtual assistants, social media managers",
    showRegistration: false,
    verifyNoun: "profile",
  },
  content_creator: {
    nameLabel: "Creator / Brand Name", namePlaceholder: "e.g. Priya Learns Tech",
    aboutLabel: "About Your Brand", aboutPlaceholder: "Tell candidates about your content, audience, and what it's like to work with you…",
    logoLabel: "Brand Logo", logoSectionTitle: "Logo & Brand Links",
    showLogo: true, showOrgFields: false, showInstituteFields: false,
    showNiche: true, nicheLabel: "Content Niche", nichePlaceholder: "e.g. Tech education, lifestyle, finance",
    showRegistration: false,
    verifyNoun: "profile",
  },
  ngo_government: {
    nameLabel: "Organisation Name", namePlaceholder: "e.g. Akshaya Patra Foundation",
    aboutLabel: "About the Organisation", aboutPlaceholder: "Tell candidates about your mission, programs, and work culture…",
    logoLabel: "Organisation Logo", logoSectionTitle: "Logo & Organisation Links",
    showLogo: true, showOrgFields: false, showInstituteFields: false,
    showNiche: false, nicheLabel: "", nichePlaceholder: "",
    showRegistration: true,
    verifyNoun: "organisation",
  },
};

type Profile = {
  profileType: ProfileType;
  companyName: string; tagline: string;
  companyType: string; industry: string; companySize: string; foundedYear: string;
  instituteType: string; coursesOffered: string; affiliationNumber: string;
  niche: string; registrationNumber: string;
  website: string; location: string; description: string; mission: string; benefits: string;
  linkedinUrl: string; logoUrl: string;
  bio: string; photoUrl: string; personalLinkedinUrl: string;
  socialLinks: { instagram: string; twitter: string; github: string; portfolio: string };
};

const EMPTY_PROFILE: Profile = {
  profileType: "company",
  companyName: "", tagline: "",
  companyType: "", industry: "", companySize: "", foundedYear: "",
  instituteType: "", coursesOffered: "", affiliationNumber: "",
  niche: "", registrationNumber: "",
  website: "", location: "", description: "", mission: "", benefits: "",
  linkedinUrl: "", logoUrl: "",
  bio: "", photoUrl: "", personalLinkedinUrl: "",
  socialLinks: { instagram: "", twitter: "", github: "", portfolio: "" },
};

// ─── Validation ──────────────────────────────────────────────────────────────

type FieldErrors = Partial<Record<string, string>>;

function validateProfile(p: Profile): FieldErrors {
  const errors: FieldErrors = {};

  if (!p.companyName.trim()) errors.companyName = "This field is required.";
  if (!p.description.trim()) errors.description = "This field is required.";
  if (!p.location.trim()) errors.location = "This field is required.";

  if (p.profileType === "company") {
    if (!p.companyType) errors.companyType = "Please select a company type.";
    if (!p.industry) errors.industry = "Please select an industry.";
    if (!p.companySize) errors.companySize = "Please select a company size.";
  }

  if (p.profileType === "educational_institute") {
    if (!p.instituteType) errors.instituteType = "Please select an institute type.";
  }

  if (p.profileType === "individual" || p.profileType === "content_creator") {
    if (!p.niche.trim()) errors.niche = "This field is required.";
  }

  return errors;
}

// ─── Base UI components ──────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-none">{children}</span>
      {required === true && (
        <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 leading-none">
          Required
        </span>
      )}
      {required === false && (
        <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 leading-none">
          Optional
        </span>
      )}
    </div>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1"><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m10.29 3.86-8.58 14.86A1 1 0 0 0 2.57 20h18.86a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{msg}</p>;
}

function Input({
  label, required, fieldError, ...props
}: { label: string; required?: boolean; fieldError?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 transition ${
          fieldError
            ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
            : "border-slate-300 focus:border-[#0a66c2] focus:ring-[#0a66c2]/10"
        }`}
        {...props}
      />
      <FieldErr msg={fieldError} />
    </div>
  );
}

function Textarea({
  label, required, fieldError, ...props
}: { label: string; required?: boolean; fieldError?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <textarea
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 transition resize-none ${
          fieldError
            ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
            : "border-slate-300 focus:border-[#0a66c2] focus:ring-[#0a66c2]/10"
        }`}
        {...props}
      />
      <FieldErr msg={fieldError} />
    </div>
  );
}

function Select({
  label, required, fieldError, children, ...props
}: { label: string; required?: boolean; fieldError?: string } & React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <select
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 transition bg-white ${
          fieldError
            ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
            : "border-slate-300 focus:border-[#0a66c2] focus:ring-[#0a66c2]/10"
        }`}
        {...props}
      >
        {children}
      </select>
      <FieldErr msg={fieldError} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function RecruiterProfileContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uid, setUid] = useState<string>("");
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [verificationStatus, setVerificationStatus] = useState<"none" | "requested" | "verified" | "rejected">("none");
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [authToken, setAuthToken] = useState<string>("");

  // Track whether user has tried to save (to show inline errors)
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const firstErrorRef = useRef<HTMLDivElement>(null);

  const copy = COPY[profile.profileType];

  const { sessionToken, authUser } = useRecruitAuth();
  useEffect(() => {
    if (!sessionToken) return;
    const token = sessionToken;
    setAuthToken(token);
    setUid(authUser?.id ?? "");
    (async () => {
      try {
        const res = await fetch(apiUrl("/recruit/company/profile"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await readApiJson(res);
          if (data.profile) {
            const p = data.profile;
            setProfile({
              profileType: (p.profileType as ProfileType) || "company",
              companyName: p.companyName || "",
              tagline: p.tagline || "",
              companyType: p.companyType || "",
              industry: p.industry || "",
              companySize: p.companySize || "",
              foundedYear: p.foundedYear || "",
              instituteType: p.instituteType || "",
              coursesOffered: p.coursesOffered || "",
              affiliationNumber: p.affiliationNumber || "",
              niche: p.niche || "",
              registrationNumber: p.registrationNumber || "",
              website: p.website || "",
              location: p.location || "",
              description: p.description || "",
              mission: p.mission || "",
              benefits: p.benefits || "",
              linkedinUrl: p.linkedinUrl || "",
              logoUrl: p.logoUrl || "",
              bio: p.bio || "",
              photoUrl: p.photoUrl || "",
              personalLinkedinUrl: p.personalLinkedinUrl || "",
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
    })();
  }, [sessionToken, authUser]);

  // Re-run validation live once user has attempted save
  useEffect(() => {
    if (saveAttempted) {
      setFieldErrors(validateProfile(profile));
    }
  }, [profile, saveAttempted]);

  async function handleLogoUpload(file: File) {
    if (!authToken) { setLogoUploadError("Please wait for sign-in to finish and try again."); return; }
    setUploadingLogo(true);
    setLogoUploadError("");
    try {
      const url = await uploadImage(file, authToken);
      setProfile(prev => ({ ...prev, logoUrl: url }));
    } catch (e: any) {
      setLogoUploadError(e.message || "Upload failed. Please try again or paste a URL.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!authToken) { setPhotoUploadError("Please wait for sign-in to finish and try again."); return; }
    setUploadingPhoto(true);
    setPhotoUploadError("");
    try {
      const url = await uploadImage(file, authToken);
      setProfile(prev => ({ ...prev, photoUrl: url }));
    } catch (e: any) {
      setPhotoUploadError(e.message || "Photo upload failed. Please try again or paste a URL.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function requestVerification() {
    if (!profile.companyName.trim()) {
      setVerificationMessage("Please fill in your name before requesting verification.");
      return;
    }
    if (!profile.description.trim()) {
      setVerificationMessage("Please add a description to your profile before requesting verification.");
      return;
    }
    const hasLink = profile.website.trim() || profile.linkedinUrl.trim()
      || profile.personalLinkedinUrl.trim() || profile.socialLinks.portfolio.trim();
    if (!hasLink) {
      setVerificationMessage("Please add at least one link (website, LinkedIn, or portfolio) before requesting verification.");
      return;
    }
    router.push("/recruit/verification");
  }

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaveAttempted(true);
    const errors = validateProfile(profile);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector("[data-field-error]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setSaving(true); setError(""); setSaved(false);
    try {
      if (!authToken) throw new Error("You must be signed in to save.");
      const res = await fetch(apiUrl("/recruit/company/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
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

  const requiredCount = Object.keys(validateProfile(profile)).length;
  const hasErrors = saveAttempted && requiredCount > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f6f8] animate-[rb-fade-in_0.3s_ease_both]">
        <RecruitHeader />
        {/* Sticky top bar skeleton */}
        <div className="sticky top-[57px] z-30 bg-white/95 border-b border-slate-200">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <div className="h-4 w-24 rounded-full rb-skeleton" />
              <div className="h-4 w-28 rounded-full rb-skeleton" />
            </div>
            <div className="h-8 w-24 rounded-xl rb-skeleton" />
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-5">
          {/* Avatar + name */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6 flex items-center gap-5">
            <div className="h-20 w-20 rounded-full rb-skeleton shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="h-5 w-48 rounded-lg rb-skeleton" />
              <div className="h-3.5 w-32 rounded-full rb-skeleton" />
              <div className="h-3.5 w-56 rounded-full rb-skeleton" />
            </div>
          </div>
          {/* Form sections */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
              <div className="h-4 w-36 rounded-full rb-skeleton" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-3 w-20 rounded-full rb-skeleton" />
                    <div className="h-10 w-full rounded-xl rb-skeleton" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6f8] text-slate-900">
      <RecruitHeader />

      {/* Sticky top bar */}
      <div className="sticky top-[57px] z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 flex items-center justify-between py-2.5">
          <div className="flex items-center gap-3">
            <Link href="/recruit/dashboard" className="text-sm text-slate-500 hover:text-slate-800 transition">← Dashboard</Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-sm font-bold text-slate-900">Recruiter Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            {authUser?.username && (
              <Link href={`/creator/${encodeURIComponent(authUser.username)}`} target="_blank" className="hidden rounded-full border border-indigo-200 px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 sm:inline-flex">
                View public profile <span className="ml-1.5">↗</span>
              </Link>
            )}
            {hasErrors && (
              <span className="text-xs text-red-600 font-semibold hidden sm:block">
                {requiredCount} required field{requiredCount > 1 ? "s" : ""} missing
              </span>
            )}
            {!hasErrors && error && <p className="text-xs text-red-600 hidden sm:block">{error}</p>}
            {saved && <span className="text-xs font-semibold text-green-600">✓ Saved</span>}
            <button onClick={save} disabled={saving} className="rounded-full bg-[#0a66c2] px-5 py-2 text-xs font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-95">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6 space-y-4">

        {/* Profile type selector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Who's hiring?</h2>
          <p className="text-xs text-slate-500 mb-3">Pick the option that best describes you. This changes which fields show up below, so your profile only asks what's relevant.</p>
          <select
            value={profile.profileType}
            onChange={e => { set("profileType", e.target.value as ProfileType); setSaveAttempted(false); setFieldErrors({}); }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition bg-white"
          >
            {PROFILE_TYPES.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">{PROFILE_TYPES.find(pt => pt.value === profile.profileType)?.blurb}</p>
        </div>

        {/* Validation summary banner (shown after first save attempt) */}
        {hasErrors && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <svg className="text-red-500 shrink-0 mt-0.5" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m10.29 3.86-8.58 14.86A1 1 0 0 0 2.57 20h18.86a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <p className="text-sm font-semibold text-red-700">Please fill in the required fields</p>
              <p className="text-xs text-red-600 mt-0.5">
                {requiredCount} required field{requiredCount > 1 ? "s are" : " is"} empty. Fields marked <span className="font-bold">Required</span> must be filled before saving.
              </p>
            </div>
          </div>
        )}

        {/* ── Basic Details ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">Basic Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">

            <div {...(fieldErrors.companyName ? { "data-field-error": true } : {})}>
              <Input
                label={copy.nameLabel}
                required={true}
                value={profile.companyName}
                onChange={e => set("companyName", e.target.value)}
                placeholder={copy.namePlaceholder}
                fieldError={fieldErrors.companyName}
              />
            </div>

            <Input
              label="Tagline"
              required={false}
              value={profile.tagline}
              onChange={e => set("tagline", e.target.value)}
              placeholder="A one-line pitch about you or your work"
            />

            {copy.showOrgFields && (
              <>
                <div {...(fieldErrors.companyType ? { "data-field-error": true } : {})}>
                  <Select label="Company Type" required={true} value={profile.companyType} onChange={e => set("companyType", e.target.value)} fieldError={fieldErrors.companyType}>
                    <option value="">Select type</option>
                    {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div {...(fieldErrors.industry ? { "data-field-error": true } : {})}>
                  <Select label="Industry" required={true} value={profile.industry} onChange={e => set("industry", e.target.value)} fieldError={fieldErrors.industry}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </Select>
                </div>
                <div {...(fieldErrors.companySize ? { "data-field-error": true } : {})}>
                  <Select label="Company Size" required={true} value={profile.companySize} onChange={e => set("companySize", e.target.value)} fieldError={fieldErrors.companySize}>
                    <option value="">Select size</option>
                    {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                  </Select>
                </div>
                <Input label="Founded Year" required={false} value={profile.foundedYear} onChange={e => set("foundedYear", e.target.value)} placeholder="e.g. 2015" />
              </>
            )}

            {copy.showInstituteFields && (
              <>
                <div {...(fieldErrors.instituteType ? { "data-field-error": true } : {})}>
                  <Select label="Institute Type" required={true} value={profile.instituteType} onChange={e => set("instituteType", e.target.value)} fieldError={fieldErrors.instituteType}>
                    <option value="">Select type</option>
                    {INSTITUTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <Input label="Founded Year" required={false} value={profile.foundedYear} onChange={e => set("foundedYear", e.target.value)} placeholder="e.g. 1998" />
              </>
            )}

            {profile.profileType === "ngo_government" && (
              <Input label="Founded Year" required={false} value={profile.foundedYear} onChange={e => set("foundedYear", e.target.value)} placeholder="e.g. 2005" />
            )}

            {copy.showNiche && (
              <div {...(fieldErrors.niche ? { "data-field-error": true } : {})}>
                <Input
                  label={copy.nicheLabel}
                  required={true}
                  value={profile.niche}
                  onChange={e => set("niche", e.target.value)}
                  placeholder={copy.nichePlaceholder}
                  fieldError={fieldErrors.niche}
                />
              </div>
            )}

            {copy.showRegistration && (
              <Input label="Registration Number" required={false} value={profile.registrationNumber} onChange={e => set("registrationNumber", e.target.value)} placeholder="e.g. 12A / FCRA / registration ID" />
            )}

            <div {...(fieldErrors.location ? { "data-field-error": true } : {})}>
              <Input
                label="Location"
                required={true}
                value={profile.location}
                onChange={e => set("location", e.target.value)}
                placeholder="e.g. Bengaluru, Karnataka"
                fieldError={fieldErrors.location}
              />
            </div>

            <Input label="Website" required={false} value={profile.website} onChange={e => set("website", e.target.value)} placeholder="https://yourwebsite.com" />
          </div>

          {copy.showInstituteFields && (
            <div className="mt-4 grid gap-4">
              <Textarea label="Courses Offered" required={false} value={profile.coursesOffered} onChange={e => set("coursesOffered", e.target.value)} placeholder="e.g. B.Tech, MBA, NEET/JEE coaching…" rows={2} />
              <Input label="Affiliation / Accreditation Number" required={false} value={profile.affiliationNumber} onChange={e => set("affiliationNumber", e.target.value)} placeholder="e.g. UDISE / AICTE / UGC code" />
            </div>
          )}
        </div>

        {/* ── About / Description ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">{copy.aboutLabel}</h2>
          <div {...(fieldErrors.description ? { "data-field-error": true } : {})}>
            <Textarea
              label={copy.aboutLabel}
              required={true}
              value={profile.description}
              onChange={e => set("description", e.target.value)}
              placeholder={copy.aboutPlaceholder}
              rows={4}
              fieldError={fieldErrors.description}
            />
          </div>
          {copy.showOrgFields && (
            <>
              <Textarea label="Mission & Values" required={false} value={profile.mission} onChange={e => set("mission", e.target.value)} placeholder="What is your company's mission? What values do you stand for?" rows={3} />
              <Textarea label="Benefits & Perks" required={false} value={profile.benefits} onChange={e => set("benefits", e.target.value)} placeholder="e.g. Health insurance, flexible hours, remote work, learning budget, equity…" rows={3} />
            </>
          )}
        </div>

        {/* ── Logo & Links (org types) ── */}
        {copy.showLogo && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">{copy.logoSectionTitle}</h2>

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
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-slate-900">{copy.logoLabel}</p>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 leading-none">Optional</span>
                </div>
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

            <Input label="LinkedIn Page URL" required={false} value={profile.linkedinUrl} onChange={e => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/company/…" />
          </div>
        )}

        {/* ── About You (recruiter personal section) ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">About You (Recruiter / Hiring Manager)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tell job seekers about yourself — who you are, your background, and what you look for in candidates.</p>
          </div>

          {/* Profile photo */}
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
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-slate-900">Your Profile Photo</p>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 leading-none">Optional</span>
              </div>
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

          <Textarea
            label="Bio / About you"
            required={false}
            value={profile.bio}
            onChange={e => set("bio", e.target.value)}
            placeholder="Hi, I'm [Name] — I look for candidates who are passionate, curious, and collaborative…"
            rows={4}
          />

          {/* Social links */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your Social & Portfolio Links</p>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 leading-none">Optional</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  key: "personalLinkedinUrl" as const,
                  label: "LinkedIn",
                  placeholder: "linkedin.com/in/yourname",
                  icon: <svg width="13" height="13" fill="currentColor" className="text-[#0a66c2] shrink-0" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>,
                  value: profile.personalLinkedinUrl,
                  onChange: (v: string) => set("personalLinkedinUrl", v),
                  col: "",
                },
                {
                  key: "instagram" as const,
                  label: "Instagram",
                  placeholder: "instagram.com/yourhandle",
                  icon: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500 shrink-0" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
                  value: profile.socialLinks.instagram,
                  onChange: (v: string) => set("socialLinks", { ...profile.socialLinks, instagram: v }),
                  col: "",
                },
                {
                  key: "github" as const,
                  label: "GitHub",
                  placeholder: "github.com/yourusername",
                  icon: <svg width="13" height="13" fill="currentColor" className="text-slate-700 shrink-0" viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>,
                  value: profile.socialLinks.github,
                  onChange: (v: string) => set("socialLinks", { ...profile.socialLinks, github: v }),
                  col: "",
                },
                {
                  key: "twitter" as const,
                  label: "X / Twitter",
                  placeholder: "x.com/yourhandle",
                  icon: <svg width="13" height="13" fill="currentColor" className="text-slate-700 shrink-0" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
                  value: profile.socialLinks.twitter,
                  onChange: (v: string) => set("socialLinks", { ...profile.socialLinks, twitter: v }),
                  col: "",
                },
                {
                  key: "portfolio" as const,
                  label: "Portfolio / Website",
                  placeholder: "yourwebsite.com",
                  icon: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500 shrink-0" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
                  value: profile.socialLinks.portfolio,
                  onChange: (v: string) => set("socialLinks", { ...profile.socialLinks, portfolio: v }),
                  col: "sm:col-span-2",
                },
              ] as const).map(field => (
                <div key={field.key} className={field.col}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{field.label}</label>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 leading-none">Optional</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/10 transition">
                    {field.icon}
                    <input value={field.value} onChange={e => field.onChange(e.target.value)} placeholder={field.placeholder} className="flex-1 text-sm outline-none bg-transparent" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Verification card ── */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${verificationStatus === "verified" ? "border-green-200 bg-green-50" : verificationStatus === "requested" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
          {verificationStatus === "verified" ? (
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-lg font-black">✓</div>
              <div>
                <p className="text-sm font-bold text-green-800">Verified</p>
                <p className="text-xs text-green-700 mt-0.5">Your {copy.verifyNoun} has been verified by the Rolebolt team. A "Verified" badge appears on all your job listings.</p>
              </div>
            </div>
          ) : verificationStatus === "requested" ? (
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
              <div>
                <p className="text-sm font-bold text-amber-800">Verification Under Review</p>
                <p className="text-xs text-amber-700 mt-0.5">Your verification request has been submitted. Our team will review within 2–3 business days.</p>
              </div>
            </div>
          ) : verificationStatus === "rejected" ? (
            <div className="p-5 flex items-center gap-4">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">!</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Verification not approved</p>
                <p className="text-xs text-red-700 mt-0.5">Update your profile and submit a new verification request when you are ready.</p>
              </div>
              <button type="button" onClick={requestVerification} className="shrink-0 rounded-full bg-[#0a66c2] px-4 py-2 text-xs font-bold text-white hover:bg-[#004182] transition">
                Request again
              </button>
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0a66c2]">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Get verified</h2>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Verified {copy.verifyNoun}s get a ✓ badge on every job listing, appear higher in search results, and earn more trust from job seekers.
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
                {requestingVerification ? "Submitting…" : "Request verification"}
              </button>
            </div>
          )}
        </div>

        {/* Bottom save button */}
        <div className="flex flex-col items-end gap-2 pt-2 pb-6">
          {hasErrors && (
            <p className="text-xs text-red-600 font-semibold">
              {requiredCount} required field{requiredCount > 1 ? "s are" : " is"} still empty — please fill them in above.
            </p>
          )}
          <button onClick={save} disabled={saving} className="w-full sm:w-auto rounded-full bg-[#0a66c2] px-8 py-2.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-95">
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save profile"}
          </button>
        </div>

      </main>
    </div>
  );
}

export default function RecruiterProfilePage() {
  return <RecruitGuard requiredRole="creator"><RecruiterProfileContent /></RecruitGuard>;
}
