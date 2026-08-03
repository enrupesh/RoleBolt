import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms & Conditions | Rolebolt",
  description: "The terms that apply when you use Rolebolt recruiting and job-search services.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms of service"
      title="Terms & Conditions"
      intro="These terms describe the rules for using Rolebolt, including recruiting workflows, job-search tools, AI assistance, accounts and paid plans."
      updated="August 3, 2026"
    >
      <LegalSection title="Using Rolebolt">
        <p>You may use Rolebolt only for lawful purposes and only when you have the right to submit the information and content you provide. Keep your account details secure and tell us promptly if you believe an account has been accessed without authorization.</p>
      </LegalSection>
      <LegalSection title="Recruiting and job-search responsibilities">
        <p>Recruiters are responsible for their job listings, candidate communications, screening criteria, employment decisions, and compliance obligations. Job seekers are responsible for the accuracy of their profiles, resumes, applications, and communications.</p>
        <p>Rolebolt is a workflow and decision-support product. AI-generated scores, matches, drafts, summaries, and recommendations are not guarantees and must be reviewed by a qualified person before consequential use.</p>
      </LegalSection>
      <LegalSection title="Content and acceptable use">
        <p>You keep ownership of content you submit, while granting Rolebolt the limited rights needed to host, process, display, and provide the features you request. Do not use the service to upload malware, impersonate people, violate privacy, discriminate unlawfully, scrape the service, interfere with operations, or attempt unauthorized access.</p>
      </LegalSection>
      <LegalSection title="Plans, payments and cancellation">
        <p>Some capabilities are subject to category-specific plans, usage limits, billing periods, and payment verification. Prices, taxes, renewal terms, and entitlement status are shown in the relevant billing flow. A payment redirect alone does not establish access; access is activated after the payment provider and Rolebolt verify the transaction.</p>
        <p>You can review billing and available plan actions from <a className="font-semibold text-[#0a66c2] hover:underline" href="/recruit/billing">Payment & billing</a>. Refund and cancellation rules are described in our <a className="font-semibold text-[#0a66c2] hover:underline" href="/refund-policy">Refund & cancellation policy</a>.</p>
      </LegalSection>
      <LegalSection title="Availability and changes">
        <p>We work to keep Rolebolt reliable but do not promise uninterrupted availability. Features, limits, integrations, and documentation may change. The <a className="font-semibold text-[#0a66c2] hover:underline" href="/recruit/status">system status page</a> provides current service information.</p>
      </LegalSection>
      <LegalSection title="Suspension and contact">
        <p>We may restrict or suspend access when necessary to protect users, investigate abuse, comply with law, or address unpaid amounts. Questions about these terms can be sent to <a className="font-semibold text-[#0a66c2] hover:underline" href="mailto:legal@rolebolt.tech">legal@rolebolt.tech</a>.</p>
      </LegalSection>
    </LegalPageShell>
  );
}