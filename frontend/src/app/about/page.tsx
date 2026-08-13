import type { Metadata } from "next";
import Link from "next/link";
import { CompanySection, MarketingPageShell } from "@/components/MarketingPageShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About Rolebolt | Clearer Hiring for Everyone",
  description:
    "Learn why Rolebolt is building a more connected recruiting and job-search workspace for hiring teams and candidates.",
  path: "/about",
  keywords: ["about Rolebolt", "Rolebolt hiring platform", "connected recruiting workspace"],
});

export default function AboutPage() {
  return (
    <MarketingPageShell
      eyebrow="About Rolebolt"
      title="Better hiring starts when the whole picture is visible."
      intro="Rolebolt brings hiring teams and candidates into a clearer, more connected workflow—from the first role brief to the next meaningful step."
    >
      <CompanySection eyebrow="Our point of view" title="Hiring software should help people make better decisions, not just move faster.">
        <p>Hiring is a human process surrounded by a lot of fragmented work: job descriptions, applications, assessments, notes, interviews, messages and decisions. When that context is scattered, good judgement becomes harder for everyone.</p>
        <p>Rolebolt is being built to keep the signal close to the work. Teams get a practical recruiting workspace with pipelines, structured review, automation and collaboration. Candidates get a more visible path through opportunities, applications, resumes and interview preparation.</p>
      </CompanySection>

      <CompanySection eyebrow="What we are building" title="One workspace for the conversation around a role.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["For teams", "Create roles, review candidates with context and keep the hiring process moving."],
            ["For candidates", "Find opportunities, prepare thoughtfully and keep your search organised."],
            ["For the work between", "Make updates, feedback, decisions and next steps easier to understand."],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-2xl border border-[#d9e5ee] bg-white p-5 shadow-[0_8px_24px_rgba(32,79,112,.05)]">
              <h3 className="text-sm font-semibold text-[#203d56]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#718496]">{copy}</p>
            </article>
          ))}
        </div>
      </CompanySection>

      <CompanySection eyebrow="Keep in touch" title="Build the next chapter with us.">
        <p>We are continuing to learn from recruiters, founders, interviewers and job seekers who care about how work begins. Read the latest thinking in the <Link href="/blog" className="font-semibold text-[#0a66c2] hover:underline">Rolebolt blog</Link>, explore practical <Link href="/resources" className="font-semibold text-[#0a66c2] hover:underline">recruiting and job-search resources</Link>, or <Link href="/contact" className="font-semibold text-[#0a66c2] hover:underline">contact our team</Link>.</p>
      </CompanySection>
    </MarketingPageShell>
  );
}