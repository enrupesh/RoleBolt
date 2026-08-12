import type { Metadata } from "next";
import Link from "next/link";
import { CompanySection, MarketingPageShell } from "@/components/MarketingPageShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Careers at Rolebolt | Build Better Hiring Tools",
  description:
    "Explore careers at Rolebolt. Join a product team building more thoughtful recruiting and job-search tools for people on both sides of the process.",
  path: "/careers",
  keywords: ["Rolebolt careers", "jobs at Rolebolt", "recruiting technology jobs", "AI startup careers"],
});

export default function CareersPage() {
  return (
    <MarketingPageShell
      eyebrow="Careers at Rolebolt"
      title="Build the tools that make work begin with more clarity."
      intro="We are building a recruiting and job-search workspace for people who believe better systems can make hiring more human."
    >
      <CompanySection eyebrow="Why Rolebolt" title="Small team. Meaningful problems. Room to do your best work.">
        <p>Rolebolt sits at the intersection of product, AI, recruiting and career development. Our work touches a high-stakes process, so we care about usefulness, trust, accessibility and the details that shape how people experience a decision.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Build with context", "Stay close to the people and problems behind every feature."],
            ["Make it legible", "Turn complex workflows into calm, understandable experiences."],
            ["Care about both sides", "Design for hiring teams and candidates, not just one audience."],
          ].map(([title, copy]) => <article key={title} className="rounded-2xl border border-[#d9e5ee] bg-white p-5 shadow-[0_8px_24px_rgba(32,79,112,.05)]"><h3 className="text-sm font-semibold text-[#203d56]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#718496]">{copy}</p></article>)}
        </div>
      </CompanySection>
      <CompanySection eyebrow="Open conversations" title="No role listed that matches you?">
        <p>We are always interested in meeting thoughtful builders across product, engineering, design, growth and recruiting operations. Tell us what you would bring to Rolebolt and the kind of problem you want to work on.</p>
        <a href="mailto:careers@rolebolt.tech?subject=Working%20at%20Rolebolt" className="inline-flex items-center rounded-lg bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,102,194,.18)] transition hover:-translate-y-0.5 hover:bg-[#07559f]">Email careers@rolebolt.tech →</a>
      </CompanySection>
      <CompanySection title="Want to understand the mission first?">
        <p>Read <Link href="/about" className="font-semibold text-[#0a66c2] hover:underline">about Rolebolt</Link>, explore our <Link href="/blog" className="font-semibold text-[#0a66c2] hover:underline">latest thinking</Link>, or <Link href="/contact" className="font-semibold text-[#0a66c2] hover:underline">start a conversation</Link>.</p>
      </CompanySection>
    </MarketingPageShell>
  );
}