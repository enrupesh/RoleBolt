import type { Metadata } from "next";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import {
  Avatar,
  EmptySection,
  ExternalLink,
  MetaPill,
  NotFoundProfile,
  PublicFooter,
  PublicProfileHeader,
  SectionHeading,
  VerifiedBadge,
} from "@/components/PublicProfileShell";
import ShareProfileButton from "@/components/ShareProfileButton";

type CreatorProfile = {
  username: string;
  profileType: string;
  isPerson: boolean;
  name: string;
  tagline: string;
  companyType: string;
  industry: string;
  companySize: string;
  foundedYear: string;
  website: string;
  location: string;
  description: string;
  mission: string;
  benefits: string;
  instituteType: string;
  coursesOffered: string;
  niche: string;
  linkedinUrl: string;
  logoUrl: string;
  photoUrl: string;
  bio: string;
  personalLinkedinUrl: string;
  socialLinks: Record<string, string>;
  verificationStatus: "verified" | "requested" | "none";
  jobs: { id: string; title: string; location: string; workMode: string; jobType: string; seniority: string; niche: string; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string; openings: number; url: string }[];
  updatedAt?: string;
  publicUrl: string;
};

async function loadProfile(username: string): Promise<CreatorProfile | null> {
  try {
    const res = await fetch(apiUrl(`/recruit-public/profiles/creator/${encodeURIComponent(username)}`), { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const data = await readApiJson<{ profile?: CreatorProfile }>(res);
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) return buildMetadata({ title: "Company profile not found | Rolebolt", description: "This Rolebolt company profile is not available.", path: `/creator/${username}`, noIndex: true });
  const name = profile.name || `@${profile.username}`;
  const description = (profile.description || profile.tagline || `${name} on Rolebolt.`).slice(0, 160);
  return buildMetadata({
    title: `${name} — ${profile.industry || "Hiring"} | Rolebolt`,
    description,
    path: `/creator/${profile.username}`,
    ogType: "profile",
    ogImage: profile.logoUrl || profile.photoUrl || "/opengraph-image",
    keywords: [name, profile.industry, profile.companyType, "company profile", "open roles", ...profile.jobs.slice(0, 6).map(job => job.title)],
  });
}

function salary(job: CreatorProfile["jobs"][number]) {
  if (job.salaryMin == null && job.salaryMax == null) return "";
  const currency = job.salaryCurrency || "";
  return `${currency} ${job.salaryMin ?? ""}${job.salaryMax != null ? `–${job.salaryMax}` : "+"}`.trim();
}

function profileTypeLabel(profile: CreatorProfile) {
  if (profile.isPerson) return profile.profileType === "content_creator" ? "Creator / personal brand" : "Independent recruiter";
  return profile.instituteType || profile.companyType || profile.profileType.replaceAll("_", " ");
}

export default async function CreatorPublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) {
    return <><PublicProfileHeader kind="creator" username={username} url={`${SITE_URL}/creator/${username}`} /><NotFoundProfile kind="creator" /><PublicFooter /></>;
  }

  const displayName = profile.name || `@${profile.username}`;
  const profileUrl = `${SITE_URL}/creator/${profile.username}`;
  const sameAs = [profile.website, profile.linkedinUrl, profile.personalLinkedinUrl, ...Object.values(profile.socialLinks)].filter(Boolean);
  const entity = profile.isPerson
    ? { "@type": "Person", name: displayName, url: profileUrl, ...(profile.photoUrl ? { image: profile.photoUrl } : {}), ...(sameAs.length ? { sameAs } : {}) }
    : { "@type": "Organization", name: displayName, url: profileUrl, ...(profile.logoUrl ? { logo: profile.logoUrl } : {}), ...(sameAs.length ? { sameAs } : {}) };
  const pageJsonLd = { "@context": "https://schema.org", "@type": "ProfilePage", url: profileUrl, name: `${displayName} — company profile`, mainEntity: entity, dateModified: profile.updatedAt };

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900">
      <PublicProfileHeader kind="creator" username={profile.username} url={profileUrl} />
      <JsonLd id="creator-profile-page-jsonld" data={pageJsonLd} />
      <JsonLd id="creator-entity-jsonld" data={{ "@context": "https://schema.org", ...entity }} />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-slate-950 text-white">
          <div className="pointer-events-none absolute -right-16 -top-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-96 bg-blue-500/10 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <Avatar name={displayName} image={profile.logoUrl || profile.photoUrl} square large />
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">{profile.isPerson ? "Professional profile" : "Company profile"}</p>
                    <VerifiedBadge status={profile.verificationStatus} />
                  </div>
                  <h1 className="max-w-3xl text-4xl font-extrabold tracking-[-0.04em] sm:text-6xl">{displayName}</h1>
                  {profile.tagline && <p className="mt-3 max-w-2xl text-lg font-semibold leading-7 text-slate-300 sm:text-xl">{profile.tagline}</p>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {[profileTypeLabel(profile), profile.industry, profile.location, profile.companySize].filter(Boolean).map(value => <MetaPill key={value}>{value}</MetaPill>)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ShareProfileButton url={profileUrl} />
                {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-indigo-50">Visit website</a>}
              </div>
            </div>
            {profile.description && <p className="mt-9 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">{profile.description}</p>}
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12 lg:py-16">
          <div className="space-y-14">
            {(profile.mission || profile.benefits || profile.coursesOffered) && (
              <section>
                <SectionHeading eyebrow={profile.isPerson ? "Working together" : "The organization"} title={profile.mission ? "Mission and values" : "What we offer"} />
                <p className="max-w-3xl whitespace-pre-line text-base leading-8 text-slate-600">{profile.mission || profile.benefits || profile.coursesOffered}</p>
                {profile.mission && profile.benefits && <div className="mt-8 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Benefits and perks</p><p className="mt-2 whitespace-pre-line text-sm leading-7 text-indigo-950/75">{profile.benefits}</p></div>}
              </section>
            )}

            <section>
              <SectionHeading eyebrow="Careers" title={profile.jobs.length ? "Open roles" : "The next role could be yours"} />
              {profile.jobs.length > 0 ? (
                <div className="space-y-3">
                  {profile.jobs.map(job => (
                    <Link key={job.id} href={job.url} className="group flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-950 transition group-hover:text-indigo-700">{job.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                          {[job.location, job.workMode, job.jobType, job.seniority, salary(job)].filter(Boolean).map(value => <span key={value}>{value}</span>)}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-indigo-700">View role <span aria-hidden="true">→</span></span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptySection title="No open roles right now" body="There are no published opportunities at the moment. Browse the wider Rolebolt network for your next move." />
              )}
            </section>

            {profile.bio && <section><SectionHeading eyebrow="About the team" title="The people behind the work" /><p className="max-w-3xl whitespace-pre-line text-base leading-8 text-slate-600">{profile.bio}</p></section>}
          </div>

          <aside className="space-y-6 lg:pt-1">
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <SectionHeading eyebrow="At a glance" title="About this profile" />
              <dl className="space-y-4 text-sm">
                {[
                  ["Industry", profile.industry],
                  ["Type", profileTypeLabel(profile)],
                  ["Team size", profile.companySize],
                  ["Founded", profile.foundedYear],
                  ["Location", profile.location],
                  ["Niche", profile.niche],
                ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 font-semibold capitalize text-slate-700">{value}</dd></div>)}
              </dl>
            </section>
            {(profile.website || profile.linkedinUrl || profile.personalLinkedinUrl || sameAs.length > 0) && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <SectionHeading eyebrow="Connect" title="Find out more" />
                <div className="space-y-3">
                  {profile.website && <ExternalLink href={profile.website} subtle>Website <span className="text-slate-400">↗</span></ExternalLink>}
                  {profile.linkedinUrl && <div><ExternalLink href={profile.linkedinUrl} subtle>LinkedIn <span className="text-slate-400">↗</span></ExternalLink></div>}
                  {Object.entries(profile.socialLinks).filter(([, value]) => value).map(([key, value]) => <div key={key}><ExternalLink href={value} subtle>{key.charAt(0).toUpperCase() + key.slice(1)} <span className="text-slate-400">↗</span></ExternalLink></div>)}
                </div>
              </section>
            )}
            <div className="rounded-3xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">Build your presence</p>
              <h2 className="mt-3 text-lg font-bold">Turn your Rolebolt username into a website</h2>
              <p className="mt-2 text-sm leading-6 text-indigo-100">Share your work, your company, and your open roles from one memorable link.</p>
              <Link href="/recruit/signup" className="mt-5 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50">Create a profile</Link>
            </div>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}