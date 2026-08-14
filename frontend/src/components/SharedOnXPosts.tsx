"use client";

import { XPostEmbed } from "@/components/XPostEmbed";

export function SharedOnXPosts({ urls }: { urls: string[] }) {
  if (!urls.length) return null;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Shared on X</p>
          <p className="text-sm font-semibold text-[#203d56]">Real posts from people using Rolebolt</p>
        </div>
      </div>
      <div className={`grid gap-5 ${urls.length > 1 ? "md:grid-cols-2" : "max-w-xl mx-auto"}`}>
        {urls.map((url) => (
          <XPostEmbed key={url} url={url} />
        ))}
      </div>
    </div>
  );
}
