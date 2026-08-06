import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy | Rolebolt",
  description: "Read Rolebolt's privacy policy covering recruiter, job-seeker, candidate, account, AI and billing information.",
  path: "/privacy",
  keywords: ["Rolebolt privacy policy", "recruiting data privacy", "candidate data protection"],
});

const privacyEmail = "privacy@rolebolt.tech";

function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="font-semibold text-[#0a66c2] hover:underline">{children}</a>;
}

function BulletList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Trust & privacy"
      title="Privacy Policy"
      intro="Rolebolt is a shared workspace for recruiting teams and people searching for their next opportunity. This policy explains what information we handle, why we handle it, when it may be shared, and the choices available to you."
      updated="August 3, 2026"
    >
      <div className="mb-12 rounded-2xl border border-[#dbe8f1] bg-[#f6fbfe] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0a66c2]">At a glance</p>
        <p className="mt-3 text-sm leading-7 text-[#526e83]">
          Rolebolt uses information to provide hiring and job-search features, keep accounts secure, deliver communications, process requested AI assistance, operate billing, and improve reliability. We do not sell personal information. The information visible to other people depends on the feature you use and the sharing choices made by you or, for candidate information, the recruiting organisation responsible for the opportunity.
        </p>
        <nav aria-label="Privacy policy contents" className="mt-5 border-t border-[#dbe8f1] pt-4">
          <p className="text-xs font-semibold text-[#31536e]">Contents</p>
          <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <a href="#scope" className="text-[#0a66c2] hover:underline">1. Scope and roles</a>
            <a href="#information" className="text-[#0a66c2] hover:underline">2. Information we handle</a>
            <a href="#sources" className="text-[#0a66c2] hover:underline">3. How information reaches us</a>
            <a href="#use" className="text-[#0a66c2] hover:underline">4. How we use information</a>
            <a href="#ai" className="text-[#0a66c2] hover:underline">5. AI-assisted features</a>
            <a href="#sharing" className="text-[#0a66c2] hover:underline">6. Sharing and providers</a>
            <a href="#visibility" className="text-[#0a66c2] hover:underline">7. Visibility and candidate data</a>
            <a href="#retention" className="text-[#0a66c2] hover:underline">8. Retention and deletion</a>
            <a href="#security" className="text-[#0a66c2] hover:underline">9. Security</a>
            <a href="#cookies" className="text-[#0a66c2] hover:underline">10. Cookies and local storage</a>
            <a href="#rights" className="text-[#0a66c2] hover:underline">11. Your choices and rights</a>
            <a href="#international" className="text-[#0a66c2] hover:underline">12. International processing</a>
            <a href="#children" className="text-[#0a66c2] hover:underline">13. Children&apos;s privacy</a>
            <a href="#changes" className="text-[#0a66c2] hover:underline">14. Changes and contact</a>
          </div>
        </nav>
      </div>

      <LegalSection title="1. Scope and roles" id="scope">
        <p>
          This Privacy Policy applies to Rolebolt websites, applications, recruiter workspaces, seeker workspaces, public opportunity pages, application and assessment pages, and related support and billing experiences that link to this policy. It applies whether you browse without an account, create an account, apply for a role, publish a role, or use Rolebolt as part of a recruiting team.
        </p>
        <p>
          Rolebolt provides the technology. When a recruiter or organisation uses Rolebolt to collect and review applications, that recruiter or organisation may decide why candidate information is collected and how it is used. In that situation, the recruiter or organisation may have its own privacy notice and legal responsibilities. Questions about a particular job, hiring decision, or employer&apos;s retention period should first be directed to the organisation named on the opportunity.
        </p>
        <p>
          For information we collect and use for our own account, service, security, support, product, and billing operations, Rolebolt is responsible for the practices described here.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we handle" id="information">
        <p>Depending on the feature and your relationship with Rolebolt, the information we handle may include the following:</p>
        <BulletList>
          <li><strong>Account and identity information:</strong> name, email address where provided, username, phone number where used for sign-in, profile role, account status, authentication identifiers, and account creation or update dates.</li>
          <li><strong>Authentication and security information:</strong> password hashes rather than your readable password, email-verification and password-reset tokens, token expiry information, sign-in events, and information needed to detect or respond to unauthorised access. Never send us a password, secret, or API key through support or feedback.</li>
          <li><strong>Recruiter and organisation information:</strong> company or organisation name, profile description, location, industry, website, LinkedIn or portfolio links, logo or profile image, job descriptions, hiring criteria, rubrics, pipeline settings, notes, collaboration activity, interview materials, offers, and hiring workflow history.</li>
          <li><strong>Job-seeker information:</strong> seeker profile details, usernames, resumes and resume versions, cover letters, saved roles, application tracker entries, job-search workspace content, interview-preparation content, and other information you choose to create or upload.</li>
          <li><strong>Candidate and application information:</strong> information submitted to a job or form, including name, email, phone number, resume or work-sample content, answers, assessment responses, time taken on assessment questions, recruiter notes, score breakdowns, interview briefs, stage history, offer details, and communications. This information may belong to a candidate even when it is entered by a recruiter or submitted through a public application page.</li>
          <li><strong>Billing information:</strong> plan category, plan and billing interval, entitlement status, subscription and payment-provider identifiers, billing period, payment state, cancellation state, usage counters, and billing audit information. Payment providers process payment details; Rolebolt does not ask you to submit a full card number in the Rolebolt application.</li>
          <li><strong>Support and feedback:</strong> feedback category, message, optional email address, page URL, and the date submitted. If you contact support, we also receive the information you include in that communication.</li>
          <li><strong>Usage and technical information:</strong> pages or features used, events generated by the application, an anonymous or pseudonymous browser session identifier, account identifier when available, browser and device information made available by the platform, approximate timing, and infrastructure or security logs. Network providers may also create standard access logs such as IP address and request information.</li>
        </BulletList>
        <p>
          Please provide only information that is relevant to the feature and that you are authorised to provide. Recruiters should not upload sensitive candidate information unless they have an appropriate legal basis and have given candidates any notice required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="3. How information reaches us" id="sources">
        <p>We may receive information:</p>
        <BulletList>
          <li>directly from you when you register, complete a profile, publish a role, apply, answer an assessment, upload a file, use Copilot, submit feedback, or contact support;</li>
          <li>from a recruiter, organisation, or team member who creates a job, imports a resume, invites collaboration, or submits candidate information;</li>
          <li>from authentication and payment providers when you choose a supported sign-in method or complete a billing action;</li>
          <li>from public pages and links you choose to publish or visit; and</li>
          <li>automatically from the Rolebolt application and hosting infrastructure as you use the service.</li>
        </BulletList>
      </LegalSection>

      <LegalSection title="4. How we use information" id="use">
        <p>We use information for the following purposes:</p>
        <BulletList>
          <li>to create and maintain accounts, profiles, recruiter workspaces, seeker workspaces, jobs, applications, assessments, offers, and collaboration features;</li>
          <li>to publish the pages and opportunities you ask us to publish and to deliver applications or assessment responses to the relevant recruiting organisation;</li>
          <li>to match, analyse, score, organise, search, summarise, and otherwise operate the hiring and job-search tools you request;</li>
          <li>to send verification, application, assessment, interview, offer, reminder, collaboration, briefing, billing, and service messages;</li>
          <li>to authenticate users, recover accounts, prevent fraud and abuse, enforce access boundaries, and protect the security of the service;</li>
          <li>to calculate plan entitlements, enforce usage limits, reconcile payments, prevent duplicate processing, and maintain billing records;</li>
          <li>to understand feature usage, diagnose failures, measure reliability, and improve product design and documentation;</li>
          <li>to respond to support requests and feedback; and</li>
          <li>to comply with legal obligations, enforce our terms, resolve disputes, and protect the rights, safety, and property of Rolebolt, our users, and others.</li>
        </BulletList>
        <p>
          Depending on where you live and how the information is used, these activities may be based on performing a contract with you, your consent where consent is required, our legitimate interests in operating and securing the service, the legitimate interests of a recruiting organisation, or a legal obligation.
        </p>
      </LegalSection>

      <LegalSection title="5. AI-assisted features" id="ai">
        <p>
          Rolebolt includes AI-assisted features such as job analysis, resume and candidate scoring, assessment scoring, summaries, interview preparation, cover-letter assistance, offer drafting, hiring automation support, and Copilot conversations. These features may process the relevant job description, rubric, resume, profile, application, assessment, interview, form, or conversation content needed to return the result you request.
        </p>
        <p>
          AI output can be incomplete, inaccurate, outdated, or biased. It is decision support, not a guarantee of a candidate&apos;s ability, identity, suitability, employment outcome, or career outcome. Recruiters remain responsible for human review, lawful hiring practices, appropriate notices, and final decisions. Job seekers remain responsible for reviewing generated resumes, cover letters, interview answers, and other content before using it.
        </p>
        <p>
          Relevant content may be sent to the external AI services configured for the feature, including Google Gemini and other model infrastructure used by Rolebolt. We send only the content needed for the requested operation, but you should avoid entering unnecessary sensitive information or secrets into AI prompts. The treatment of data by an AI provider is also subject to that provider&apos;s terms and privacy practices.
        </p>
      </LegalSection>

      <LegalSection title="6. Sharing and service providers" id="sharing">
        <p>We share information only as needed for the purposes described in this policy, at your direction, or as permitted or required by law. Service categories may include:</p>
        <BulletList>
          <li><strong>Database and hosting providers:</strong> store account, workspace, application, billing, event, and operational information and run the Rolebolt application.</li>
          <li><strong>Authentication providers:</strong> support custom account authentication and, where enabled, social or phone sign-in. They may receive the identifiers needed to complete that sign-in.</li>
          <li><strong>Email providers:</strong> deliver verification, application, assessment, offer, notification, support, and billing messages.</li>
          <li><strong>AI providers:</strong> process the relevant content for a requested AI-assisted result as described above.</li>
          <li><strong>Payment providers:</strong> process checkout and subscription events. Rolebolt receives provider references, status, and reconciliation information rather than needing to store full payment credentials.</li>
          <li><strong>Security and abuse-prevention providers:</strong> help protect public application flows and the service from automated abuse where those controls are enabled.</li>
          <li><strong>People you choose to involve:</strong> recruiters, candidates, teammates, employers, or other recipients when a feature requires the information to be displayed or delivered to them.</li>
        </BulletList>
        <p>
          We may also disclose information to professional advisers, regulators, law-enforcement authorities, courts, or other parties when reasonably necessary to comply with law, respond to a valid legal process, investigate abuse, protect people or the service, or establish or defend legal claims. If Rolebolt is involved in a merger, financing, acquisition, reorganisation, or sale of assets, information may be transferred as part of that transaction subject to appropriate confidentiality and legal requirements.
        </p>
        <p>
          We do not sell personal information and do not share it for cross-context behavioural advertising.
        </p>
      </LegalSection>

      <LegalSection title="7. Visibility and candidate data" id="visibility">
        <p>
          Some Rolebolt features are intentionally public. A public username profile, recruiter or creator profile, job listing, or opportunity page may be visible to people who access the relevant link and may be indexed by search engines. Review the information on a profile or listing before publishing it. You can contact the relevant account owner or Rolebolt about correcting or removing information where the feature allows it.
        </p>
        <p>
          When you apply, complete a form, or take an assessment, your submission is delivered to the recruiting organisation connected to that opportunity. That organisation may review, store, export, communicate about, score, or otherwise use the submission for its hiring process. Recruiter notes, internal score explanations, agent logs, collaboration comments, and internal workflow data are not intended to be public unless a user deliberately shares them.
        </p>
        <p>
          If you are a candidate, the organisation that invited or received your application may be the best contact for questions about its use of your information, a hiring decision, or deletion from that organisation&apos;s records. Rolebolt can help route a request where appropriate, but cannot make an employer delete records that the employer is legally entitled or required to retain.
        </p>
      </LegalSection>

      <LegalSection title="8. Retention and deletion" id="retention">
        <p>
          We keep information for as long as it is needed to provide the feature, maintain an account or workspace, support an active hiring process, meet billing and accounting requirements, resolve disputes, enforce agreements, prevent abuse, or satisfy a legal obligation. Retention varies by type of information and by the instructions of the recruiting organisation for candidate data.
        </p>
        <p>
          Deleting an item from a workspace may not immediately remove copies in backups, audit records, email inboxes, exports, or another organisation&apos;s records. Those copies are handled according to the applicable retention and backup cycle. When information is no longer needed, we aim to delete it, anonymise it, or securely isolate it.
        </p>
        <p>
          To request account deletion or a copy of your information, email <PolicyLink href={`mailto:${privacyEmail}`}>{privacyEmail}</PolicyLink> from the address associated with the account where possible. We may need to verify your identity and clarify the account, job, or application involved before acting.
        </p>
      </LegalSection>

      <LegalSection title="9. Security" id="security">
        <p>
          We use reasonable technical and organisational safeguards appropriate to the service, including authenticated access controls, owner- and job-scoped permissions for recruiter data, encrypted network connections, password hashing, provider security controls, and operational monitoring. Access to candidate and workspace information is intended to be limited to authorised users and service operations.
        </p>
        <p>
          No website, database, email system, or internet transmission is completely secure. Keep credentials private, use a strong unique password, review teammate access, and report suspected unauthorised access or a security issue promptly to <PolicyLink href={`mailto:${privacyEmail}`}>{privacyEmail}</PolicyLink>.
        </p>
      </LegalSection>

      <LegalSection title="10. Cookies and local storage" id="cookies">
        <p>
          Rolebolt uses browser storage for essential product behaviour. Depending on the experience, this can include a local authentication token, an authentication cookie used to help preserve a session, theme preference, checklist or workspace drafts, interview or chatbot history, and a session identifier used for product events. These are not used by Rolebolt as a third-party advertising profile.
        </p>
        <p>
          We also use essential server-side session, security, and infrastructure mechanisms and may receive standard logs from hosting or network providers. If you block or clear browser storage, sign-in and saved local preferences may stop working, and a session may need to be re-established. You can manage browser storage through your browser settings.
        </p>
      </LegalSection>

      <LegalSection title="11. Your choices and privacy rights" id="rights">
        <p>
          Depending on your location and the context in which Rolebolt processes your information, you may have rights to request access, correction, deletion, portability, restriction, objection, or information about processing. You may also withdraw consent where processing is based on consent. These rights are subject to exceptions under applicable law.
        </p>
        <p>You can usually exercise control by:</p>
        <BulletList>
          <li>editing your account or profile information;</li>
          <li>choosing what to publish on a public profile or opportunity page;</li>
          <li>deleting or updating workspace content where the feature provides that control;</li>
          <li>managing billing and cancellation from <PolicyLink href="/recruit/billing">Payment & billing</PolicyLink>;</li>
          <li>contacting the recruiting organisation that controls a particular application; or</li>
          <li>emailing <PolicyLink href={`mailto:${privacyEmail}`}>{privacyEmail}</PolicyLink> with the request, the account or email involved, and enough context for us to locate the information.</li>
        </BulletList>
        <p>
          We do not discriminate against you for making a lawful privacy request. We may ask for reasonable verification, and an authorised representative may need to provide evidence of authority where local law requires it. If you are not satisfied with our response, you may have the right to contact a data protection or privacy regulator in your jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="12. International processing" id="international">
        <p>
          Rolebolt and its service providers may process information in countries other than the country where you live. Those countries may have different data-protection rules. When required, we use appropriate safeguards for cross-border transfers and require providers to protect information according to their agreements and applicable law.
        </p>
      </LegalSection>

      <LegalSection title="13. Children&apos;s privacy" id="children">
        <p>
          Rolebolt is intended for adults and professional or educational hiring and job-search use. It is not directed to children, and we do not knowingly collect personal information from children in violation of applicable law. If you believe a child has provided information to Rolebolt, contact <PolicyLink href={`mailto:${privacyEmail}`}>{privacyEmail}</PolicyLink> so we can review and take appropriate action.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes and contact" id="changes">
        <p>
          We may update this policy when Rolebolt&apos;s features, providers, legal requirements, or data practices change. We will post the updated version on this page and change the &quot;Last updated&quot; date. If a change is material, we will use an appropriate additional notice where required.
        </p>
        <p>
          Privacy questions, rights requests, security concerns, and complaints can be sent to <PolicyLink href={`mailto:${privacyEmail}`}>{privacyEmail}</PolicyLink>. For billing questions, use <PolicyLink href="mailto:billing@rolebolt.tech">billing@rolebolt.tech</PolicyLink>. For a question about a specific job or application, contact the recruiting organisation shown on that opportunity as well.
        </p>
        <p>
          Rolebolt&apos;s other public policies are available through the footer, including <PolicyLink href="/terms">Terms &amp; Conditions</PolicyLink>, <PolicyLink href="/refund-policy">Refund &amp; Cancellation</PolicyLink>, and <PolicyLink href="/recruit/billing">Payment &amp; Billing</PolicyLink>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}