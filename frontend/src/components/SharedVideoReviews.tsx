"use client";

import { YouTubeVideoEmbed } from "@/components/YouTubeVideoEmbed";

export function SharedVideoReviews({ urls }: { urls: string[] }) {
  if (!urls.length) return null;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ff0000] text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
          </svg>
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Video reviews</p>
          <p className="text-sm font-semibold text-[#203d56]">Watch what users are saying on YouTube</p>
          <p className="mt-1 text-xs leading-5 text-[#8496a5]">
            Pro &amp; Ultra job seekers can earn free tokens after admin approval — up to 2× for genuine face-on reviews.
          </p>
        </div>
      </div>
      <div className={`grid gap-5 ${urls.length > 1 ? "md:grid-cols-2" : "justify-items-center"}`}>
        {urls.map((url) => (
          <YouTubeVideoEmbed key={url} url={url} />
        ))}
      </div>
    </div>
  );
}
