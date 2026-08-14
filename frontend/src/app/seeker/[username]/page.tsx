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
} from "@/components/PublicProfileShell";
import ShareProfileButton from "@/components/ShareProfileButton";

type SeekerProfile = {
  username: string;
  name: string;
  headline: string;
  bio: string;
  skills: string[];
  experienceLevel: string;
  preferredJobType: string;
  preferredWorkMode: string;
  preferredLocation: string;
  preferredNiche: string;
  careerObjective: string;
  experience: { title: string; company: string; location: string; startDate: string; endDate: string; current: boolean; description: string }[];
  education: { degree: string; institution: string; year: string; description: string }[];
  projects: { name: string; description: string; url: string; technologies: string[] }[];
  certifications: { name: string; issuer: string; year: string; url: string }[];
  socialLinks: Record<string, string>;
  photoUrl: string;
  updatedAt?: string;
  publicUrl: string;
};

async function loadProfile(username: string): Promise<SeekerProfile | null> {
  try {
    const res = await fetch(apiUrl(`/recruit-public/profiles/seeker/${encodeURIComponent(username)}`), { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const data = await readApiJson<{ profile?: SeekerProfile }>(res);
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) {
    return buildMetadata({
      title: "Professional profile not found | Rolebolt",
      description: "This Rolebolt professional profile is not available.",
      path: `/seeker/${username}`,
      noIndex: true,
    });
  }
  const name = profile.name || `@${profile.username}`;
  const title = profile.headline ? `${name} — ${profile.headline} | Rolebolt` : `${name} | Rolebolt`;
  const description = (profile.bio || `${name}'s professional portfolio on Rolebolt.`).slice(0, 160);
  return buildMetadata({
    title,
    description,
    path: `/seeker/${profile.username}`,
    ogType: "profile",
    ogImage: profile.photoUrl || "/opengraph-image",
    keywords: [name, profile.headline, ...profile.skills.slice(0, 8), "professional portfolio", "resume"],
  });
}

function dateLabel(start: string, end: string, current: boolean) {
  const left = start || "";
  const right = current ? "Present" : end || "";
  if (!left && !right) return "";
  return [left, right].filter(Boolean).join(" — ");
}

function ExternalIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>;
}

export default async function SeekerPublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) {
    return <><PublicProfileHeader kind="seeker" username={username} url={`${SITE_URL}/seeker/${username}`} /><NotFoundProfile kind="seeker" /><PublicFooter /></>;
  }

  const displayName = profile.name || `@${profile.username}`;
  const sameAs = Object.values(profile.socialLinks).filter(Boolean);
  const profileUrl = `${SITE_URL}/seeker/${profile.username}`;
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    url: profileUrl,
    ...(profile.headline ? { jobTitle: profile.headline } : {}),
    ...(profile.photoUrl ? { image: profile.photoUrl } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(profile.preferredLocation ? { address: { "@type": "PostalAddress", addressLocality: profile.preferredLocation } } : {}),
  };
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: profileUrl,
    name: `${displayName} — professional profile`,
    mainEntity: { "@id": profileUrl },
    dateModified: profile.updatedAt,
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900">
      <PublicProfileHeader kind="seeker" username={profile.username} url={profileUrl} />
      <JsonLd id="seeker-person-jsonld" data={personJsonLd} />
      <JsonLd id="seeker-profile-page-jsonld" data={pageJsonLd} />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-indigo-50 via-[#f8f9fc] to-blue-50/70">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <Avatar name={displayName} image={profile.photoUrl} large />
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Professional profile</p>
                  <h1 className="max-w-3xl text-4xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-6xl">{displayName}</h1>
                  {profile.headline && <p className="mt-3 max-w-2xl text-lg font-semibold leading-7 text-slate-700 sm:text-xl">{profile.headline}</p>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {[profile.preferredLocation, profile.experienceLevel, profile.preferredWorkMode, profile.preferredJobType].filter(Boolean).map(value => <MetaPill key={value}>{value}</MetaPill>)}
                  </div>
                </div>
              </div>
              <ShareProfileButton url={profileUrl} />
            </div>
            {profile.bio && <p className="mt-9 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{profile.bio}</p>}
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12 lg:py-16">
          <div className="space-y-14">
            {(profile.careerObjective || profile.bio) && (
              <section>
                <SectionHeading eyebrow="About" title="A little more about my work" />
                <p className="max-w-3xl whitespace-pre-line text-base leading-8 text-slate-600">{profile.careerObjective || profile.bio}</p>
              </section>
            )}

            {profile.experience.length > 0 && (
              <section>
                <SectionHeading eyebrow="Experience" title="Where I’ve made an impact" />
                <div className="space-y-0">
                  {profile.experience.map((entry, index) => (
                    <article key={`${entry.company}-${entry.title}-${index}`} className="relative border-l border-indigo-200 pb-10 pl-7 last:pb-0">
                      <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-600 ring-4 ring-[#f8f9fc]" />
                      <div className="flex flex-col justify-between gap-2 sm:flex-row">
                        <div>
                          <h3 className="text-lg font-bold text-slate-950">{entry.title}</h3>
                          {entry.company && <p className="mt-1 font-semibold text-indigo-700">{entry.company}{entry.location ? ` · ${entry.location}` : ""}</p>}
                        </div>
                        {dateLabel(entry.startDate, entry.endDate, entry.current) && <span className="text-sm font-semibold text-slate-400">{dateLabel(entry.startDate, entry.endDate, entry.current)}</span>}
                      </div>
                      {entry.description && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{entry.description}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {profile.projects.length > 0 && (
              <section>
                <SectionHeading eyebrow="Selected work" title="Projects worth a closer look" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {profile.projects.map((project, index) => (
                    <article key={`${project.name}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-bold text-slate-950">{project.name}</h3>
                        {project.url && <a href={project.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${project.name}`} className="text-indigo-600"><ExternalIcon /></a>}
                      </div>
                      {project.description && <p className="mt-3 text-sm leading-6 text-slate-600">{project.description}</p>}
                      {project.technologies.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{project.technologies.map(item => <span key={item} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">{item}</span>)}</div>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {profile.education.length > 0 && (
              <section>
                <SectionHeading eyebrow="Education" title="Learning and foundations" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {profile.education.map((entry, index) => (
                    <article key={`${entry.institution}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-6">
                      <h3 className="font-bold text-slate-950">{entry.degree || "Education"}</h3>
                      <p className="mt-1 font-semibold text-indigo-700">{entry.institution}</p>
                      {entry.year && <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">{entry.year}</p>}
                      {entry.description && <p className="mt-3 text-sm leading-6 text-slate-600">{entry.description}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {profile.certifications.length > 0 && (
              <section>
                <SectionHeading eyebrow="Credentials" title="Certifications" />
                <div className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
                  {profile.certifications.map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-4 p-5">
                      <div>
                        <h3 className="font-bold text-slate-950">{entry.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{entry.issuer}{entry.year ? ` · ${entry.year}` : ""}</p>
                      </div>
                      {entry.url && <ExternalLink href={entry.url} subtle>View credential</ExternalLink>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!profile.experience.length && !profile.projects.length && !profile.education.length && !profile.certifications.length && (
              <EmptySection title="This portfolio is taking shape" body="More professional details will appear here as this profile is completed." />
            )}
          </div>

          <aside className="space-y-6 lg:pt-1">
            {profile.skills.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <SectionHeading eyebrow="At a glance" title="Skills" />
                <div className="flex flex-wrap gap-2">{profile.skills.map(skill => <span key={skill} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">{skill}</span>)}</div>
              </section>
            )}
            {(profile.preferredNiche || profile.preferredLocation || profile.preferredWorkMode || profile.experienceLevel) && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <SectionHeading eyebrow="Focus" title="What I’m looking for" />
                <dl className="space-y-4 text-sm">
                  {[
                    ["Focus area", profile.preferredNiche],
                    ["Location", profile.preferredLocation],
                    ["Work mode", profile.preferredWorkMode],
                    ["Experience", profile.experienceLevel],
                  ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 font-semibold text-slate-700">{value}</dd></div>)}
                </dl>
              </section>
            )}
            {sameAs.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <SectionHeading eyebrow="Elsewhere" title="Find me online" />
                <div className="space-y-3">
                  {Object.entries(profile.socialLinks).filter(([, value]) => value).map(([key, value]) => <div key={key}><ExternalLink href={value} subtle>{key.charAt(0).toUpperCase() + key.slice(1)} <span className="text-slate-400">↗</span></ExternalLink></div>)}
                </div>
              </section>
            )}
            <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Open to connection</p>
              <h2 className="mt-3 text-lg font-bold">Explore opportunities on Rolebolt</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Find roles that match your skills and next chapter.</p>
              <Link href="/recruit/opportunities" className="mt-5 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-indigo-50">Browse open roles</Link>
            </div>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}