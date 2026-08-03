import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { RoleboltLogo } from "@/components/RoleboltLogo";

export function LegalPageShell({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8fbfd] text-[#10263d]">
      <header className="border-b border-[#dfe8ef] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5" aria-label="Rolebolt home">
            <RoleboltLogo size="md" />
            <span className="font-display text-[15px] font-semibold tracking-[-0.03em]">Rolebolt</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/recruit" className="inline-flex rounded-lg border border-[#cbd9e4] bg-white px-3.5 py-2 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2]">Back to Rolebolt</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="rounded-3xl border border-[#d9e5ee] bg-white p-7 shadow-[0_18px_50px_rgba(33,71,103,.07)] sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#647a8d]">{intro}</p>
          <p className="mt-4 text-xs font-medium uppercase tracking-[.12em] text-[#8aa0b1]">Last updated: {updated}</p>
           <div className="mt-8 rounded-2xl border border-[#f0d9a8] bg-[#fff9eb] px-4 py-3.5 text-sm leading-6 text-[#765a24]">
             This page explains Rolebolt&apos;s current product practices in plain language. It is not legal advice. If you need advice about your specific obligations, please consult a qualified professional.
           </div>
           <div className="mt-10 border-t border-[#edf1f5] pt-10">{children}</div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function LegalSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="not-prose mb-9 scroll-mt-8 last:mb-0">
      <h2 className="font-display text-xl font-semibold tracking-[-.035em] text-[#203d56]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[#647a8d]">{children}</div>
    </section>
  );
}