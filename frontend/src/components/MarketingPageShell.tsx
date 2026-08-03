import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { RoleboltLogo } from "@/components/RoleboltLogo";

export function MarketingPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8fbfd] text-[#10263d]">
      <header className="border-b border-[#dfe8ef] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Rolebolt home">
            <RoleboltLogo size="md" />
            <span className="font-display text-[15px] font-semibold tracking-[-0.03em]">Rolebolt</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-[#5d7285] sm:flex" aria-label="Company navigation">
            <Link href="/about" className="rounded-lg px-3 py-2 hover:bg-[#f3f8fc] hover:text-[#0a66c2]">About</Link>
            <Link href="/blog" className="rounded-lg px-3 py-2 hover:bg-[#f3f8fc] hover:text-[#0a66c2]">Blog</Link>
            <Link href="/resources" className="rounded-lg px-3 py-2 hover:bg-[#f3f8fc] hover:text-[#0a66c2]">Resources</Link>
            <Link href="/contact" className="ml-2 rounded-lg bg-[#0a66c2] px-4 py-2 font-semibold text-white shadow-[0_5px_16px_rgba(10,102,194,.16)] hover:bg-[#07559f]">Contact us</Link>
          </nav>
          <Link href="/" className="text-sm font-semibold text-[#0a66c2] sm:hidden">Home</Link>
        </div>
      </header>
      <main>
        <section className="border-b border-[#dfe8ef] bg-white">
          <div className="mx-auto max-w-5xl px-5 py-20 lg:px-8 lg:py-28">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#0a66c2]">{eyebrow}</p>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[1.08] tracking-[-.06em] text-[#10263d] sm:text-6xl">{title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#647a8d]">{intro}</p>
          </div>
        </section>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}

export function CompanySection({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#dfe8ef]">
      <div className="mx-auto max-w-5xl px-5 py-16 lg:px-8 lg:py-24">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">{eyebrow}</p>}
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-.05em] text-[#10263d] sm:text-4xl">{title}</h2>
        <div className="mt-6 max-w-3xl space-y-5 text-base leading-8 text-[#647a8d]">{children}</div>
      </div>
    </section>
  );
}