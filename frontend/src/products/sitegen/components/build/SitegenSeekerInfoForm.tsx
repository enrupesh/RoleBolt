"use client";

import { useState } from "react";
import type { SitegenSeekerProfile, SitegenWebsiteDraft } from "../../types/profile";
import { saveSitegenDraft, uploadSitegenImage } from "../../lib/client";
import { sitegenDisplayPublicUrl } from "../../lib/publicUrl";
import { SitegenResumeUpload } from "./SitegenResumeUpload";
import { SitegenFieldLabel, SitegenInfoBox, SitegenInput, SitegenSection, SitegenTextarea } from "./SitegenFormFields";

const emptyExperience = () => ({ title: "", company: "", startDate: "", endDate: "", current: false, description: "" });
const emptyEducation = () => ({ school: "", degree: "", field: "", startDate: "", endDate: "", description: "" });
const emptyProject = () => ({ name: "", description: "", url: "" });

export function SitegenSeekerInfoForm({
  accessToken,
  draft,
  onSaved,
}: {
  accessToken: string;
  draft: SitegenWebsiteDraft;
  onSaved: (website: SitegenWebsiteDraft) => void;
}) {
  const initial = draft.seekerProfile;
  const [mode, setMode] = useState<"resume" | "manual">(draft.inputMode || "resume");
  const [resumeText, setResumeText] = useState(draft.resumeText || "");
  const [resumeFileName, setResumeFileName] = useState(draft.resumeFileName || "");
  const [fullName, setFullName] = useState(initial?.fullName || "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl || "");
  const [headline, setHeadline] = useState(initial?.headline || "");
  const [summary, setSummary] = useState(initial?.summary || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [website, setWebsite] = useState(initial?.website || "");
  const [linkedin, setLinkedin] = useState(initial?.linkedin || "");
  const [github, setGithub] = useState(initial?.github || "");
  const [portfolio, setPortfolio] = useState(initial?.portfolio || "");
  const [skills, setSkills] = useState((initial?.skills || []).join(", "));
  const [experience, setExperience] = useState(initial?.experience?.length ? initial.experience : [emptyExperience()]);
  const [education, setEducation] = useState(initial?.education?.length ? initial.education : [emptyEducation()]);
  const [projects, setProjects] = useState(initial?.projects?.length ? initial.projects : [emptyProject()]);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      const url = await uploadSitegenImage(accessToken, file);
      setPhotoUrl(url);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Profile photo upload failed.");
    } finally {
      setPhotoBusy(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const seekerProfile: SitegenSeekerProfile = {
        fullName: fullName.trim(),
        photoUrl: photoUrl || undefined,
        headline: headline.trim() || undefined,
        summary: summary.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        github: github.trim() || undefined,
        portfolio: portfolio.trim() || undefined,
        skills: skills.split(",").map((item) => item.trim()).filter(Boolean),
        experience: experience.filter((item) => item.title.trim() && item.company.trim()),
        education: education.filter((item) => item.school.trim()),
        projects: projects.filter((item) => item.name.trim()),
      };

      const saved = await saveSitegenDraft(accessToken, {
        complete: true,
        inputMode: mode,
        resumeText,
        seekerProfile,
      });
      onSaved(saved);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't save your information.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SitegenInfoBox>
        This information will be used to build your professional website at <strong className="text-white">{sitegenDisplayPublicUrl(draft.username)}</strong>.
        Required fields are marked. Everything else is optional.
      </SitegenInfoBox>

      <div className="grid grid-cols-2 gap-2">
        {(["resume", "manual"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${mode === item ? "border-violet-400 bg-violet-500/20 text-white" : "border-white/10 text-violet-100/60 hover:border-white/20"}`}
          >
            {item === "resume" ? "Upload resume" : "Enter manually"}
          </button>
        ))}
      </div>

      {mode === "resume" ? (
        <SitegenSection title="Resume upload" description="Upload your resume and we'll extract the text for the next phase.">
          <SitegenResumeUpload
            accessToken={accessToken}
            resumeFileName={resumeFileName}
            resumeText={resumeText}
            onUploaded={(data) => {
              setResumeText(data.resumeText);
              setResumeFileName(data.resumeFileName);
            }}
          />
        </SitegenSection>
      ) : null}

      <SitegenSection title="Basic information" description="Your name and professional headline appear at the top of your website.">
        <div>
          <SitegenFieldLabel optional>Profile photo</SitegenFieldLabel>
          <label className="mt-2 flex cursor-pointer items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Profile photo preview" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/20 text-xs text-violet-200">Photo</span>
            )}
            <span className="text-sm text-violet-100/70">{photoBusy ? "Uploading…" : "Upload profile photo (optional)"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" disabled={photoBusy} onChange={handlePhotoUpload} />
          </label>
        </div>
        <div>
          <SitegenFieldLabel required>Full name</SitegenFieldLabel>
          <SitegenInput value={fullName} onChange={setFullName} placeholder="Alex Sharma" />
        </div>
        <div>
          <SitegenFieldLabel optional>Headline</SitegenFieldLabel>
          <SitegenInput value={headline} onChange={setHeadline} placeholder="Product Designer · Frontend Developer" />
        </div>
        {mode === "manual" ? (
          <div>
            <SitegenFieldLabel optional>Professional summary</SitegenFieldLabel>
            <SitegenTextarea value={summary} onChange={setSummary} placeholder="A short summary of your experience and strengths…" rows={5} />
          </div>
        ) : null}
      </SitegenSection>

      <SitegenSection title="Contact & links" description="Optional details visitors can use to reach you.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><SitegenFieldLabel optional>Email</SitegenFieldLabel><SitegenInput value={email} onChange={setEmail} type="email" /></div>
          <div><SitegenFieldLabel optional>Phone</SitegenFieldLabel><SitegenInput value={phone} onChange={setPhone} /></div>
          <div><SitegenFieldLabel optional>Location</SitegenFieldLabel><SitegenInput value={location} onChange={setLocation} placeholder="City, Country" /></div>
          <div><SitegenFieldLabel optional>Website</SitegenFieldLabel><SitegenInput value={website} onChange={setWebsite} placeholder="https://" /></div>
          <div><SitegenFieldLabel optional>LinkedIn</SitegenFieldLabel><SitegenInput value={linkedin} onChange={setLinkedin} placeholder="https://linkedin.com/in/…" /></div>
          <div><SitegenFieldLabel optional>GitHub</SitegenFieldLabel><SitegenInput value={github} onChange={setGithub} placeholder="https://github.com/…" /></div>
        </div>
        <div>
          <SitegenFieldLabel optional>Portfolio link</SitegenFieldLabel>
          <SitegenInput value={portfolio} onChange={setPortfolio} placeholder="https://" />
        </div>
        <div>
          <SitegenFieldLabel optional>Skills</SitegenFieldLabel>
          <SitegenInput value={skills} onChange={setSkills} placeholder="React, TypeScript, UX Design" />
        </div>
      </SitegenSection>

      {mode === "manual" ? (
        <>
          <SitegenSection title="Experience" description="Add roles that should appear on your website.">
            {experience.map((item, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-white/10 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><SitegenFieldLabel optional>Job title</SitegenFieldLabel><SitegenInput value={item.title} onChange={(value) => setExperience((rows) => rows.map((row, i) => i === index ? { ...row, title: value } : row))} /></div>
                  <div><SitegenFieldLabel optional>Company</SitegenFieldLabel><SitegenInput value={item.company} onChange={(value) => setExperience((rows) => rows.map((row, i) => i === index ? { ...row, company: value } : row))} /></div>
                </div>
                <SitegenTextarea value={item.description || ""} onChange={(value) => setExperience((rows) => rows.map((row, i) => i === index ? { ...row, description: value } : row))} placeholder="What did you work on?" rows={3} />
              </div>
            ))}
            <button type="button" onClick={() => setExperience((rows) => [...rows, emptyExperience()])} className="text-sm font-semibold text-violet-200 hover:text-white">+ Add experience</button>
          </SitegenSection>

          <SitegenSection title="Education" description="Optional schools, degrees, or certifications.">
            {education.map((item, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/10 p-4">
                <div className="sm:col-span-2"><SitegenFieldLabel optional>School</SitegenFieldLabel><SitegenInput value={item.school} onChange={(value) => setEducation((rows) => rows.map((row, i) => i === index ? { ...row, school: value } : row))} /></div>
                <div><SitegenFieldLabel optional>Degree</SitegenFieldLabel><SitegenInput value={item.degree || ""} onChange={(value) => setEducation((rows) => rows.map((row, i) => i === index ? { ...row, degree: value } : row))} /></div>
                <div><SitegenFieldLabel optional>Field</SitegenFieldLabel><SitegenInput value={item.field || ""} onChange={(value) => setEducation((rows) => rows.map((row, i) => i === index ? { ...row, field: value } : row))} /></div>
              </div>
            ))}
            <button type="button" onClick={() => setEducation((rows) => [...rows, emptyEducation()])} className="text-sm font-semibold text-violet-200 hover:text-white">+ Add education</button>
          </SitegenSection>
        </>
      ) : null}

      {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">{error}</p> : null}

      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-[#1a1033] transition hover:bg-violet-50 disabled:opacity-50">
        {busy ? "Saving…" : "Save & continue"}
      </button>
    </form>
  );
}
