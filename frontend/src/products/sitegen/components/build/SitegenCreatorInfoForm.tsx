"use client";

import { useState } from "react";
import type { SitegenCreatorProfile, SitegenWebsiteDraft } from "../../types/profile";
import { saveSitegenDraft, uploadSitegenImage } from "../../lib/client";
import { sitegenDisplayPublicUrl } from "../../lib/publicUrl";
import { SitegenFieldLabel, SitegenInfoBox, SitegenInput, SitegenSection, SitegenTextarea } from "./SitegenFormFields";

const CATEGORIES = [
  "Small business",
  "Startup",
  "Agency",
  "Content creator",
  "Personal brand",
  "Consultant",
  "Large company",
  "Other",
];

const emptyPortfolioLink = () => ({ title: "", url: "" });
const emptyTeamMember = () => ({ name: "", role: "", bio: "" });

export function SitegenCreatorInfoForm({
  accessToken,
  draft,
  onSaved,
}: {
  accessToken: string;
  draft: SitegenWebsiteDraft;
  onSaved: (website: SitegenWebsiteDraft) => void;
}) {
  const initial = draft.creatorProfile;
  const [businessName, setBusinessName] = useState(initial?.businessName || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [tagline, setTagline] = useState(initial?.tagline || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [about, setAbout] = useState(initial?.about || "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl || "");
  const [services, setServices] = useState((initial?.services || []).join(", "));
  const [location, setLocation] = useState(initial?.location || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [website, setWebsite] = useState(initial?.website || "");
  const [linkedin, setLinkedin] = useState(initial?.socialLinks?.linkedin || "");
  const [instagram, setInstagram] = useState(initial?.socialLinks?.instagram || "");
  const [twitter, setTwitter] = useState(initial?.socialLinks?.twitter || "");
  const [youtube, setYoutube] = useState(initial?.socialLinks?.youtube || "");
  const [tiktok, setTiktok] = useState(initial?.socialLinks?.tiktok || "");
  const [portfolioLinks, setPortfolioLinks] = useState(initial?.portfolioLinks?.length ? initial.portfolioLinks : [emptyPortfolioLink()]);
  const [team, setTeam] = useState(initial?.team?.length ? initial.team : [emptyTeamMember()]);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    setError("");
    try {
      const url = await uploadSitegenImage(accessToken, file);
      setLogoUrl(url);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Logo upload failed.");
    } finally {
      setLogoBusy(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const creatorProfile: SitegenCreatorProfile = {
        businessName: businessName.trim(),
        category: category || undefined,
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
        about: about.trim() || undefined,
        logoUrl: logoUrl || undefined,
        services: services.split(",").map((item) => item.trim()).filter(Boolean),
        location: location.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        socialLinks: {
          linkedin: linkedin.trim() || undefined,
          instagram: instagram.trim() || undefined,
          twitter: twitter.trim() || undefined,
          youtube: youtube.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
        },
        portfolioLinks: portfolioLinks.filter((item) => item.title.trim() && item.url.trim()),
        team: team.filter((item) => item.name.trim()),
      };

      const saved = await saveSitegenDraft(accessToken, {
        complete: true,
        creatorProfile,
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
        Tell us about your business or brand. We&apos;ll use this to build your website at <strong className="text-white">{sitegenDisplayPublicUrl(draft.username)}</strong>.
        Only a few fields are required — skip anything that doesn&apos;t apply.
      </SitegenInfoBox>

      <SitegenSection title="Business basics" description="The essentials that identify your brand on your website.">
        <div>
          <SitegenFieldLabel required>Business / creator name</SitegenFieldLabel>
          <SitegenInput value={businessName} onChange={setBusinessName} placeholder="Acme Studio" />
        </div>
        <div>
          <SitegenFieldLabel optional>Category / type</SitegenFieldLabel>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none focus:border-violet-400/50"
          >
            <option value="" className="bg-[#1a1033]">Select a category</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item} className="bg-[#1a1033]">{item}</option>
            ))}
          </select>
        </div>
        <div>
          <SitegenFieldLabel optional>Tagline</SitegenFieldLabel>
          <SitegenInput value={tagline} onChange={setTagline} placeholder="Design that helps brands grow" />
        </div>
        <div>
          <SitegenFieldLabel optional>Short description</SitegenFieldLabel>
          <SitegenTextarea value={description} onChange={setDescription} placeholder="What do you do and who do you help?" rows={4} />
        </div>
        <div>
          <SitegenFieldLabel optional>Logo</SitegenFieldLabel>
          <label className="mt-2 flex cursor-pointer items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            {logoUrl ? <img src={logoUrl} alt="Logo preview" className="h-12 w-12 rounded-lg object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/20 text-xs text-violet-200">Logo</span>}
            <span className="text-sm text-violet-100/70">{logoBusy ? "Uploading…" : "Upload logo image"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" disabled={logoBusy} onChange={handleLogoUpload} />
          </label>
        </div>
      </SitegenSection>

      <SitegenSection title="About your business" description="Optional story, services, and background information.">
        <div>
          <SitegenFieldLabel optional>About</SitegenFieldLabel>
          <SitegenTextarea value={about} onChange={setAbout} placeholder="Share your story, mission, or what makes you different…" rows={5} />
        </div>
        <div>
          <SitegenFieldLabel optional>Services / products</SitegenFieldLabel>
          <SitegenInput value={services} onChange={setServices} placeholder="Branding, Web Design, Social Media" />
        </div>
      </SitegenSection>

      <SitegenSection title="Contact" description="How visitors can reach you.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><SitegenFieldLabel optional>Email</SitegenFieldLabel><SitegenInput value={email} onChange={setEmail} type="email" /></div>
          <div><SitegenFieldLabel optional>Phone</SitegenFieldLabel><SitegenInput value={phone} onChange={setPhone} /></div>
          <div><SitegenFieldLabel optional>Location</SitegenFieldLabel><SitegenInput value={location} onChange={setLocation} /></div>
          <div><SitegenFieldLabel optional>Website</SitegenFieldLabel><SitegenInput value={website} onChange={setWebsite} placeholder="https://" /></div>
        </div>
      </SitegenSection>

      <SitegenSection title="Social links" description="Optional profiles and channels.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><SitegenFieldLabel optional>LinkedIn</SitegenFieldLabel><SitegenInput value={linkedin} onChange={setLinkedin} /></div>
          <div><SitegenFieldLabel optional>Instagram</SitegenFieldLabel><SitegenInput value={instagram} onChange={setInstagram} /></div>
          <div><SitegenFieldLabel optional>X / Twitter</SitegenFieldLabel><SitegenInput value={twitter} onChange={setTwitter} /></div>
          <div><SitegenFieldLabel optional>YouTube</SitegenFieldLabel><SitegenInput value={youtube} onChange={setYoutube} /></div>
          <div><SitegenFieldLabel optional>TikTok</SitegenFieldLabel><SitegenInput value={tiktok} onChange={setTiktok} /></div>
        </div>
      </SitegenSection>

      <SitegenSection title="Portfolio / work links" description="Optional links to projects, case studies, or featured work.">
        {portfolioLinks.map((item, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/10 p-4">
            <div><SitegenFieldLabel optional>Title</SitegenFieldLabel><SitegenInput value={item.title} onChange={(value) => setPortfolioLinks((rows) => rows.map((row, i) => i === index ? { ...row, title: value } : row))} /></div>
            <div><SitegenFieldLabel optional>URL</SitegenFieldLabel><SitegenInput value={item.url} onChange={(value) => setPortfolioLinks((rows) => rows.map((row, i) => i === index ? { ...row, url: value } : row))} placeholder="https://" /></div>
          </div>
        ))}
        <button type="button" onClick={() => setPortfolioLinks((rows) => [...rows, emptyPortfolioLink()])} className="text-sm font-semibold text-violet-200 hover:text-white">+ Add work link</button>
      </SitegenSection>

      <SitegenSection title="Team / founder" description="Optional for solo creators — add only if you want a team section.">
        {team.map((item, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-white/10 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><SitegenFieldLabel optional>Name</SitegenFieldLabel><SitegenInput value={item.name} onChange={(value) => setTeam((rows) => rows.map((row, i) => i === index ? { ...row, name: value } : row))} /></div>
              <div><SitegenFieldLabel optional>Role</SitegenFieldLabel><SitegenInput value={item.role || ""} onChange={(value) => setTeam((rows) => rows.map((row, i) => i === index ? { ...row, role: value } : row))} /></div>
            </div>
            <SitegenTextarea value={item.bio || ""} onChange={(value) => setTeam((rows) => rows.map((row, i) => i === index ? { ...row, bio: value } : row))} placeholder="Short bio" rows={3} />
          </div>
        ))}
        <button type="button" onClick={() => setTeam((rows) => [...rows, emptyTeamMember()])} className="text-sm font-semibold text-violet-200 hover:text-white">+ Add team member</button>
      </SitegenSection>

      {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">{error}</p> : null}

      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-[#1a1033] transition hover:bg-violet-50 disabled:opacity-50">
        {busy ? "Saving…" : "Save & continue"}
      </button>
    </form>
  );
}
