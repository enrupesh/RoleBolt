import type { Metadata } from "next";
import Link from "next/link";
import { CompanySection, MarketingPageShell } from "@/components/MarketingPageShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact Rolebolt | Recruiting and Job-Search Support",
  description:
    "Contact Rolebolt for product questions, recruiting workspace support, partnerships, press enquiries and privacy requests.",
  path: "/contact",
  keywords: ["contact Rolebolt", "Rolebolt support", "Rolebolt sales", "recruiting software support"],
});

const contacts = [
  ["Product and sales", "sales@rolebolt.tech", "Talk with us about recruiting workflows, plans or a team workspace."],
  ["Support", "support@rolebolt.tech", "Get help with your account, workspace, jobs or candidate experience."],
  ["Privacy", "privacy@rolebolt.tech", "Ask about personal information, access, deletion or privacy practices."],
  ["Press and partnerships", "press@rolebolt.tech", "Connect with the team about media, partnerships or research."],
];

export default function ContactPage() {
  return (
    <MarketingPageShell
      eyebrow="Contact Rolebolt"
      title="Have a question? Start with the right person."
      intro="Whether you are hiring, looking for your next opportunity, or exploring a partnership, we will help route your message."
    >
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-5 sm:grid-cols-2">
          {contacts.map(([title, email, copy]) => (
            <article key={email} className="rounded-3xl border border-[#d9e5ee] bg-white p-7 shadow-[0_10px_28px_rgba(32,79,112,.05)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0a66c2]">{title}</p>
              <h2 className="mt-4 text-xl font-semibold text-[#203d56]"><a href={`mailto:${email}`} className="hover:text-[#0a66c2]">{email}</a></h2>
              <p className="mt-3 text-sm leading-7 text-[#718496]">{copy}</p>
              <a href={`mailto:${email}`} className="mt-6 inline-flex text-sm font-semibold text-[#0a66c2]">Send an email →</a>
            </article>
          ))}
        </div>
      </section>
      <CompanySection eyebrow="Before you write" title="Looking for a quick answer?">
        <p>Browse the <Link href="/resources" className="font-semibold text-[#0a66c2] hover:underline">resource hub</Link> for recruiting and job-search guides, visit the <Link href="/privacy" className="font-semibold text-[#0a66c2] hover:underline">privacy policy</Link> for data questions, or explore <Link href="/recruit/opportunities" className="font-semibold text-[#0a66c2] hover:underline">open opportunities</Link> if you are here to find your next role.</p>
      </CompanySection>
    </MarketingPageShell>
  );
}