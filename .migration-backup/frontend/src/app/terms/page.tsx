import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Terms & Conditions | Rolebolt",
  description: "Read the Rolebolt terms covering recruiting, job search, AI assistance, collaboration, public opportunities and billing.",
  path: "/terms",
  keywords: ["Rolebolt terms and conditions", "AI recruiting terms", "job platform terms"],
});

function TermsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="font-semibold text-[#0a66c2] hover:underline">{children}</a>;
}

function TermsList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms of service"
      title="Terms & Conditions"
      intro="These Terms & Conditions govern your access to and use of Rolebolt, including recruiting workspaces, job-search tools, public opportunities, AI-assisted features, collaboration, applications, assessments and paid plans."
      updated="August 3, 2026"
    >
      <div className="mb-12 rounded-2xl border border-[#dbe8f1] bg-[#f6fbfe] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0a66c2]">Before you use Rolebolt</p>
        <p className="mt-3 text-sm leading-7 text-[#526e83]">
          Rolebolt is a technology and workflow platform. It helps people organise recruiting and job searches, but it does not employ candidates, guarantee hiring outcomes, make decisions on behalf of an employer, or provide legal, financial, employment, immigration, or career advice.
        </p>
        <nav aria-label="Terms and conditions contents" className="mt-5 border-t border-[#dbe8f1] pt-4">
          <p className="text-xs font-semibold text-[#31536e]">Contents</p>
          <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <a href="#agreement" className="text-[#0a66c2] hover:underline">1. Agreement and eligibility</a>
            <a href="#service" className="text-[#0a66c2] hover:underline">2. The Rolebolt service</a>
            <a href="#accounts" className="text-[#0a66c2] hover:underline">3. Accounts and security</a>
            <a href="#recruiters" className="text-[#0a66c2] hover:underline">4. Recruiter responsibilities</a>
            <a href="#seekers" className="text-[#0a66c2] hover:underline">5. Job-seeker responsibilities</a>
            <a href="#content" className="text-[#0a66c2] hover:underline">6. Content and permissions</a>
            <a href="#ai" className="text-[#0a66c2] hover:underline">7. AI-assisted features</a>
            <a href="#public" className="text-[#0a66c2] hover:underline">8. Public pages and communications</a>
            <a href="#collaboration" className="text-[#0a66c2] hover:underline">9. Collaboration and access</a>
            <a href="#billing" className="text-[#0a66c2] hover:underline">10. Plans, payments and cancellation</a>
            <a href="#acceptable-use" className="text-[#0a66c2] hover:underline">11. Acceptable use</a>
            <a href="#intellectual-property" className="text-[#0a66c2] hover:underline">12. Intellectual property</a>
            <a href="#privacy" className="text-[#0a66c2] hover:underline">13. Privacy and data</a>
            <a href="#availability" className="text-[#0a66c2] hover:underline">14. Availability and changes</a>
            <a href="#suspension" className="text-[#0a66c2] hover:underline">15. Suspension and termination</a>
            <a href="#disclaimers" className="text-[#0a66c2] hover:underline">16. Disclaimers and liability</a>
            <a href="#general" className="text-[#0a66c2] hover:underline">17. General terms</a>
            <a href="#contact" className="text-[#0a66c2] hover:underline">18. Contact</a>
          </div>
        </nav>
      </div>

      <LegalSection title="1. Agreement and eligibility" id="agreement">
        <p>
          By accessing or using Rolebolt, creating an account, clicking an acceptance control, publishing content, submitting an application, or purchasing a plan, you agree to these Terms &amp; Conditions and the <TermsLink href="/privacy">Privacy Policy</TermsLink>. If you use Rolebolt for an organisation, you represent that you have authority to accept these terms on that organisation&apos;s behalf.
        </p>
        <p>
          You must provide accurate information and use Rolebolt only if you are legally able to enter into these terms. Rolebolt is intended for adults and professional or educational recruiting and job-search use. Do not use the service if applicable law prohibits you from doing so.
        </p>
        <p>
          If you do not agree to these terms, do not access or use Rolebolt. If a specific Rolebolt feature has additional terms, those terms apply to that feature together with these Terms &amp; Conditions.
        </p>
      </LegalSection>

      <LegalSection title="2. The Rolebolt service" id="service">
        <p>
          Rolebolt provides shared tools for creating and managing jobs, publishing opportunities, receiving applications, reviewing candidates, running assessments, collaborating with a team, preparing offers, managing job-search activities, and using AI-assisted workflow features. Features may differ by account role, workspace, plan, billing category, eligibility, location, or product version.
        </p>
        <p>
          Rolebolt is not an employer, recruitment agency, staffing agency, employment agent, university, immigration adviser, or representative of any recruiter, candidate, or organisation using the service. Rolebolt does not guarantee that a job is genuine, that a recruiter will respond, that a candidate will be selected, or that any hiring or career outcome will occur.
        </p>
        <p>
          We may add, remove, limit, pause, or change features. We may also set reasonable limits on storage, messages, AI operations, applications, imports, assessments, team members, or other usage as described in the relevant product or billing experience.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and security" id="accounts">
        <p>
          Some features require an account. You are responsible for maintaining accurate account information, protecting passwords and authentication methods, reviewing activity, and all activity that occurs through your account unless caused by Rolebolt&apos;s breach of its obligations.
        </p>
        <TermsList>
          <li>Do not share credentials, authentication tokens, password-reset links, or private invitation links with unauthorised people.</li>
          <li>Notify Rolebolt promptly at <TermsLink href="mailto:support@rolebolt.tech">support@rolebolt.tech</TermsLink> if you believe your account or data has been accessed without permission.</li>
          <li>Do not create accounts using another person&apos;s identity, a misleading organisation identity, or disposable information intended to evade enforcement.</li>
          <li>Keep team membership and permissions current. The account owner or organisation administrator is responsible for access granted to teammates.</li>
        </TermsList>
        <p>
          We may require email verification, phone verification, identity or account checks, or other security steps. We may refuse a username or restrict an account to protect users, prevent impersonation, or comply with law.
        </p>
      </LegalSection>

      <LegalSection title="4. Recruiter and organisation responsibilities" id="recruiters">
        <p>
          Recruiters and organisations are responsible for their jobs, forms, assessments, rubrics, screening criteria, candidate communications, hiring decisions, and compliance obligations. You must have the right to collect and process candidate information and must provide candidates any notices, choices, accommodations, or disclosures required by applicable law.
        </p>
        <TermsList>
          <li>Publish accurate, current, and non-misleading job and organisation information.</li>
          <li>Do not use Rolebolt to unlawfully discriminate, retaliate, deceive candidates, collect information unrelated to a role, or request information you are not entitled to collect.</li>
          <li>Review AI scores, recommendations, pipeline rules, agent actions, assessment results, and automated communications before relying on them where human review is appropriate or legally required.</li>
          <li>Use job-scoped collaboration permissions and share candidate information only with people who need it for the hiring process.</li>
          <li>Handle applications, resumes, interview notes, offer information, and candidate requests according to your own legal and organisational obligations.</li>
        </TermsList>
        <p>
          Rolebolt may provide tools that automate or assist actions such as shortlisting, rejecting, sending reminders, changing stages, or preparing communications. Turning on an automation does not transfer responsibility for the resulting action to Rolebolt.
        </p>
      </LegalSection>

      <LegalSection title="5. Job-seeker responsibilities" id="seekers">
        <p>
          Job seekers are responsible for the accuracy and lawfulness of their profiles, resumes, cover letters, applications, assessment answers, interview-preparation content, and communications. Do not submit another person&apos;s personal information, falsified credentials, confidential employer information, or content you are not authorised to share.
        </p>
        <p>
          Rolebolt does not guarantee that a job is available, that an application will be read, that an employer will respond, or that any application will result in an interview, offer, or employment. Verify important information with the relevant organisation before relying on a listing or communication.
        </p>
        <p>
          You are responsible for reviewing AI-generated resumes, cover letters, answers, summaries, or interview suggestions before submitting or using them. AI-generated content may contain errors or claims that do not accurately represent your experience.
        </p>
      </LegalSection>

      <LegalSection title="6. Content and permissions" id="content">
        <p>
          You retain ownership of content you submit or create, subject to rights belonging to other people or organisations. You grant Rolebolt a non-exclusive, worldwide, limited, royalty-free licence to host, store, reproduce, format, transmit, display, analyse, and otherwise process that content only as needed to operate, secure, support, improve, and provide the features you request.
        </p>
        <p>
          This licence includes allowing Rolebolt to make technical copies, create indexes, generate requested scores or summaries, deliver content to intended recipients, and process content through service providers. It ends when the content is deleted or the service no longer needs it, except for backups, records, legal obligations, dispute resolution, and other limited purposes described in the <TermsLink href="/privacy">Privacy Policy</TermsLink>.
        </p>
        <p>
          You represent that you have all rights, permissions, notices, and legal bases needed for content you submit, including another person&apos;s resume, contact details, assessment answers, interview notes, or personal information. You are responsible for responding to claims that your content violates another person&apos;s rights.
        </p>
      </LegalSection>

      <LegalSection title="7. AI-assisted features" id="ai">
        <p>
          Rolebolt may use AI to analyse job descriptions, create rubrics, score resumes or assessments, summarise candidate information, answer Copilot questions, draft offers or communications, and support job-search activities. AI features produce suggestions or workflow outputs based on the information and instructions available to them.
        </p>
        <TermsList>
          <li>AI output is not guaranteed to be accurate, complete, fair, unbiased, current, or suitable for a particular purpose.</li>
          <li>AI output is not legal, employment, financial, immigration, medical, or professional advice.</li>
          <li>Do not rely on an AI output as the sole basis for a decision that materially affects a person. Apply appropriate human review and your own policies.</li>
          <li>You should not place passwords, API keys, payment credentials, highly sensitive information, or unnecessary personal information into an AI prompt.</li>
          <li>AI processing may use external model providers configured by Rolebolt. The relevant information is described in the <TermsLink href="/privacy">Privacy Policy</TermsLink> and may also be subject to the provider&apos;s terms.</li>
        </TermsList>
      </LegalSection>

      <LegalSection title="8. Public pages and communications" id="public">
        <p>
          Rolebolt may provide public job listings, opportunity pages, recruiter or creator profiles, seeker profiles, assessment links, offer links, and other shareable pages. You are responsible for checking content before publishing and for sharing links only with intended recipients.
        </p>
        <p>
          Information on a public page may be viewed, copied, indexed, or cached by third parties. Removing information from Rolebolt may not remove copies held by search engines, browsers, recipients, exports, or other services.
        </p>
        <p>
          By using an application, assessment, invitation, offer, notification, or collaboration feature, you authorise Rolebolt to send the related messages to the addresses or recipients you provide or select. Email delivery may be affected by recipient settings, providers, spam filters, or technical failures.
        </p>
      </LegalSection>

      <LegalSection title="9. Collaboration and access" id="collaboration">
        <p>
          Recruiter workspaces may allow owners to invite teammates, assign roles, add notes, mention collaborators, share candidate context, and record activity. The person or organisation controlling the workspace is responsible for deciding who should receive access and for removing access when it is no longer appropriate.
        </p>
        <p>
          You must not use collaboration tools to access, copy, export, or disclose information outside the permissions granted to you. Do not use a valid invitation or shared link to inspect information unrelated to the purpose for which it was provided.
        </p>
      </LegalSection>

      <LegalSection title="10. Plans, payments and cancellation" id="billing">
        <p>
          Rolebolt may offer category-specific Free, Pro, or Ultra plans with monthly or yearly billing intervals. The plan category, price, taxes, limits, included features, renewal details, and payment terms shown in the applicable billing flow are the source of truth for that purchase.
        </p>
        <p>
          Payments and subscription events may be processed through Razorpay or another payment provider made available in the billing flow. Rolebolt may receive payment references, status, plan information, billing periods, and reconciliation events. A payment redirect, browser callback, or client-side confirmation alone does not grant paid access; access is activated after the transaction is verified through the applicable server-side process.
        </p>
        <TermsList>
          <li>You authorise the applicable payment provider to charge the selected payment method for the amount and interval shown at checkout.</li>
          <li>You are responsible for accurate billing information, applicable taxes, and ensuring that the payment method may be used for the purchase.</li>
          <li>Plan limits, quotas, entitlements, and access may vary by billing category and may be affected by payment status or a scheduled cancellation.</li>
          <li>You may cancel or manage an eligible subscription through available controls or by contacting support. Cancellation generally prevents a future renewal and does not automatically reverse a period that has already started.</li>
          <li>Refund requests are handled under the <TermsLink href="/refund-policy">Refund &amp; Cancellation Policy</TermsLink>. Nothing in that policy removes rights that cannot legally be waived.</li>
        </TermsList>
        <p>
          For billing help, contact <TermsLink href="mailto:billing@rolebolt.tech">billing@rolebolt.tech</TermsLink> or visit <TermsLink href="/recruit/billing">Payment &amp; billing</TermsLink>. Do not send full card numbers, passwords, API keys, or authentication tokens by email.
        </p>
      </LegalSection>

      <LegalSection title="11. Acceptable use" id="acceptable-use">
        <p>You may not use Rolebolt to:</p>
        <TermsList>
          <li>break the law, violate a person&apos;s rights, or facilitate fraud, harassment, abuse, exploitation, or discrimination;</li>
          <li>impersonate a person or organisation, publish deceptive jobs, create fake applications, or misrepresent qualifications or employment opportunities;</li>
          <li>collect, upload, process, or expose personal information without appropriate authority, notice, or legal basis;</li>
          <li>upload malware, harmful code, illegal content, confidential information belonging to another party, or content that infringes intellectual-property or privacy rights;</li>
          <li>scrape, crawl, harvest, copy, mirror, reverse engineer, decompile, or systematically extract Rolebolt data or interfaces except where expressly permitted by Rolebolt in writing or by law;</li>
          <li>bypass plan limits, rate limits, access controls, verification, payment checks, security measures, or feature restrictions;</li>
          <li>probe, scan, overload, interfere with, or attempt unauthorised access to the service, an account, a provider, or another user&apos;s workspace;</li>
          <li>use automated hiring actions in a way that violates applicable employment, anti-discrimination, privacy, or accessibility requirements; or</li>
          <li>use Rolebolt to build or train a competing service from protected data, interfaces, or confidential information.</li>
        </TermsList>
        <p>
          We may investigate suspected misuse and may preserve or disclose information where reasonably necessary to protect users, the service, or legal rights.
        </p>
      </LegalSection>

      <LegalSection title="12. Intellectual property" id="intellectual-property">
        <p>
          Rolebolt and its software, visual design, branding, text, workflows, templates, interfaces, documentation, features, and improvements are owned by Rolebolt or its licensors and are protected by applicable intellectual-property laws. These terms grant you a limited, revocable, non-exclusive, non-transferable right to use the service while your access is permitted; they do not transfer ownership.
        </p>
        <p>
          You may not remove proprietary notices, use Rolebolt branding as if it were your own, reproduce substantial portions of the service, or use Rolebolt materials outside the permissions provided by these terms. Feedback you provide may be used by Rolebolt without restriction or payment, provided we do not use it to identify you publicly without appropriate permission.
        </p>
      </LegalSection>

      <LegalSection title="13. Privacy and data" id="privacy">
        <p>
          Our handling of personal information is described in the <TermsLink href="/privacy">Privacy Policy</TermsLink>. By using Rolebolt, you acknowledge that information may be processed by Rolebolt, recruiting organisations, intended recipients, and service providers as described there.
        </p>
        <p>
          If you use Rolebolt for an organisation, you are responsible for providing any required privacy notices and responding to requests from candidates, teammates, or other people whose information you submit. Rolebolt may assist with access or deletion requests, but may need to follow the instructions of the organisation that controls the relevant workspace or application.
        </p>
      </LegalSection>

      <LegalSection title="14. Availability and changes" id="availability">
        <p>
          We work to keep Rolebolt reliable, but the service may be unavailable or delayed because of maintenance, updates, provider failures, internet or device issues, security events, high demand, or circumstances outside our control. We do not promise uninterrupted availability or a particular response time unless a separate written agreement says otherwise.
        </p>
        <p>
          We may change these terms, features, limits, plans, providers, or documentation. We will post the updated terms on this page and change the date above. If a change is material, we will provide additional notice where required. Continuing to use Rolebolt after an updated version takes effect means you accept the updated terms, except where applicable law requires another form of consent.
        </p>
      </LegalSection>

      <LegalSection title="15. Suspension and termination" id="suspension">
        <p>
          You may stop using Rolebolt at any time and may request account assistance or deletion. Subscription cancellation and account deletion are separate actions unless stated otherwise in the applicable billing flow.
        </p>
        <p>
          Rolebolt may suspend, restrict, or terminate access when reasonably necessary to protect users or the service, investigate suspected misuse, comply with law or a valid legal request, address security risk, enforce these terms, or respond to unpaid or reversed charges. Where appropriate and legally permitted, we will try to provide notice and an opportunity to address the issue.
        </p>
        <p>
          After termination, provisions that by their nature should continue will remain in effect, including content permissions needed for backups or legal records, intellectual-property rights, payment obligations, disclaimers, limitations of liability, dispute provisions, and this section.
        </p>
      </LegalSection>

      <LegalSection title="16. Disclaimers and liability" id="disclaimers">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, ROLEBOLT IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. WE DO NOT WARRANT THAT THE SERVICE, CONTENT, AI OUTPUT, JOB LISTINGS, MATCHES, SCORES, ASSESSMENTS, COMMUNICATIONS, OR RESULTS WILL BE ACCURATE, COMPLETE, CURRENT, SECURE, UNINTERRUPTED, ERROR-FREE, OR SUITABLE FOR YOUR PURPOSE.
        </p>
        <p>
          ROLEBOLT DOES NOT WARRANT EMPLOYMENT, HIRING, APPLICATION, INTERVIEW, OFFER, PAYMENT, BUSINESS, OR CAREER OUTCOMES. ROLEBOLT IS NOT RESPONSIBLE FOR THE ACTS, OMISSIONS, CONTENT, DECISIONS, SECURITY, OR LEGAL COMPLIANCE OF A RECRUITER, EMPLOYER, CANDIDATE, TEAMMATE, PAYMENT PROVIDER, AI PROVIDER, OR OTHER THIRD PARTY.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, ROLEBOLT AND ITS AFFILIATES, SERVICE PROVIDERS, OFFICERS, EMPLOYEES, AND LICENSORS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, OPPORTUNITIES, GOODWILL, DATA, OR BUSINESS INTERRUPTION ARISING FROM OR RELATED TO THE SERVICE.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY FOR CLAIMS ARISING FROM THE SERVICE WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID TO ROLEBOLT FOR THE RELEVANT SERVICE IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR THE MINIMUM AMOUNT REQUIRED BY APPLICABLE LAW. NOTHING IN THESE TERMS EXCLUDES LIABILITY THAT CANNOT LEGALLY BE EXCLUDED OR LIMITED.
        </p>
      </LegalSection>

      <LegalSection title="17. General terms" id="general">
        <p>
          You may not assign or transfer these terms or your account without our prior written consent, except where permitted as part of a lawful organisation transfer. Rolebolt may assign these terms in connection with a merger, acquisition, reorganisation, or transfer of substantially all relevant assets.
        </p>
        <p>
          If a provision is found unenforceable, it will be modified to the minimum extent needed and the remaining provisions will continue. A failure to enforce a provision is not a waiver. These terms, together with feature-specific terms and policies linked here, are the entire agreement about your use of Rolebolt and replace prior discussions about that subject.
        </p>
        <p>
          Nothing in these terms creates an employment, agency, partnership, fiduciary, franchise, or joint-venture relationship between you and Rolebolt. Headings are for convenience and do not change the meaning of a provision.
        </p>
      </LegalSection>

      <LegalSection title="18. Contact" id="contact">
        <p>
          Questions about these Terms &amp; Conditions can be sent to <TermsLink href="mailto:legal@rolebolt.tech">legal@rolebolt.tech</TermsLink>. For privacy requests, contact <TermsLink href="mailto:privacy@rolebolt.tech">privacy@rolebolt.tech</TermsLink>. For billing support, contact <TermsLink href="mailto:billing@rolebolt.tech">billing@rolebolt.tech</TermsLink>.
        </p>
        <p>
          You can also review the <TermsLink href="/privacy">Privacy Policy</TermsLink>, <TermsLink href="/refund-policy">Refund &amp; Cancellation Policy</TermsLink>, <TermsLink href="/recruit/billing">Payment &amp; billing</TermsLink>, and <TermsLink href="/recruit/status">System status</TermsLink>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}