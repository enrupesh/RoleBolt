"use client";

import {
  FOUNDERS_TEAMS_SPOTLIGHTS,
  type FounderTeamSpotlight,
} from "@/lib/foundersTeams";

function BrandLogo({ spot }: { spot: FounderTeamSpotlight }) {
  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spot.logoSrc}
      alt={spot.logoAlt}
      width={56}
      height={56}
      className="h-14 w-14 rounded-2xl object-cover shadow-[0_8px_24px_rgba(16,38,61,.12)] ring-1 ring-[#dce7ef]"
    />
  );

  if (!spot.websiteClickable) {
    return <div className="shrink-0">{logo}</div>;
  }

  return (
    <a
      href={spot.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 transition hover:-translate-y-0.5"
      aria-label={`Visit ${spot.brandName}`}
    >
      {logo}
    </a>
  );
}

function FounderSheet({ spot }: { spot: FounderTeamSpotlight }) {
  return (
    <article className="relative overflow-hidden rounded-[1.75rem] border border-[#b9d9f5] bg-white p-6 shadow-[0_18px_50px_rgba(10,102,194,.10)] sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#0a66c2]/[0.06]" />
      <div className="relative flex items-start gap-4">
        <BrandLogo spot={spot} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {spot.websiteClickable ? (
              <a
                href={spot.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display text-lg font-semibold tracking-[-.03em] text-[#10263d] hover:text-[#0a66c2]"
              >
                {spot.brandName}
              </a>
            ) : (
              <p className="font-display text-lg font-semibold tracking-[-.03em] text-[#10263d]">
                {spot.brandName}
              </p>
            )}
            <span className="rounded-full bg-[#eaf3ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#0a66c2]">
              Featured
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-[#647a8d]">{spot.roleLabel}</p>
          <p className="mt-3 text-base tracking-[.08em] text-[#f2b53d]" aria-label={`${spot.rating} out of 5 stars`}>
            {"★".repeat(spot.rating)}
          </p>
        </div>
      </div>

      <h3 className="relative mt-6 font-display text-xl font-semibold tracking-[-.035em] text-[#203d56] sm:text-2xl">
        {spot.title}
      </h3>
      <p className="relative mt-4 text-[15px] leading-8 text-[#5d7285]">“{spot.message}”</p>

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] pt-5">
        <p className="text-sm font-semibold text-[#203d56]">{spot.displayName}</p>
        {spot.websiteClickable ? (
          <a
            href={spot.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0a66c2] hover:text-[#07559f]"
          >
            Visit {spot.brandName.replace(/\.app$/i, "").replace(/\.me$/i, "")}
            <span aria-hidden>→</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function FoundersTeamsSection({
  compact = false,
}: {
  compact?: boolean;
}) {
  if (!FOUNDERS_TEAMS_SPOTLIGHTS.length) return null;

  return (
    <section
      id="founders-teams"
      className={`border-b border-[#dfe8ef] ${compact ? "bg-white" : "bg-gradient-to-b from-[#eef6ff] to-[#f8fbfd]"}`}
    >
      <div className={`mx-auto max-w-7xl px-5 lg:px-8 ${compact ? "py-14" : "py-20"}`}>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#0a66c2]">
            Highlighted Job Creators
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.055em] text-[#10263d] sm:text-4xl">
            Founders &amp; teams using Rolebolt
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#647a8d]">
            Real Job Creators who run their own products — and use Rolebolt to hire with more speed and clarity.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {FOUNDERS_TEAMS_SPOTLIGHTS.map((spot) => (
            <FounderSheet key={spot.id} spot={spot} />
          ))}
        </div>
      </div>
    </section>
  );
}
