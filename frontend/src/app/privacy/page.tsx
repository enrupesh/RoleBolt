import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Rolebolt",
  description: "Learn how Rolebolt handles account, recruiting and job-search information.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Trust & privacy"
      title="Privacy Policy"
      intro="Rolebolt is built for hiring teams and job seekers. This policy explains the information we collect, why we use it, and the choices available to you."
      updated="August 3, 2026"
    >
      <LegalSection title="Information you provide">
        <p>Depending on how you use Rolebolt, this may include your name, email address, account credentials, recruiter or seeker profile, resumes, job descriptions, applications, assessment answers, interview notes, and billing-related account details.</p>
        <p>Please do not submit information that you are not authorized to share. Recruiters are responsible for having an appropriate basis to process candidate information.</p>
      </LegalSection>
      <LegalSection title="How we use information">
        <p>We use information to provide and secure the workspace, match candidates to opportunities, generate requested recruiting or job-search assistance, deliver notifications, process plans and usage limits, prevent abuse, troubleshoot issues, and improve the reliability of the service.</p>
        <p>AI-assisted features are used to produce suggestions, summaries, scores, drafts, and other workflow support. People remain responsible for hiring and career decisions.</p>
      </LegalSection>
      <LegalSection title="Sharing and service providers">
        <p>We share information only as needed to operate requested features, such as hosting, authentication, email delivery, payment processing, analytics, storage, and AI processing. Providers are expected to protect information under their applicable agreements.</p>
        <p>We do not sell personal information. We may disclose information when required by law, to protect users and the service, or as part of a business transfer.</p>
      </LegalSection>
      <LegalSection title="Retention and security">
        <p>We retain information while an account or business purpose requires it, subject to legal and operational needs. We use access controls, authenticated sessions, and reasonable technical safeguards, but no online service can guarantee absolute security.</p>
      </LegalSection>
      <LegalSection title="Your choices">
        <p>You may update profile information, manage applications and workspace content, change notification preferences where available, or request account assistance. Contact us at <a className="font-semibold text-[#0a66c2] hover:underline" href="mailto:privacy@rolebolt.tech">privacy@rolebolt.tech</a>.</p>
      </LegalSection>
      <LegalSection title="Changes and contact">
        <p>We may update this policy as the product changes. The updated version will be posted here with a new date. Questions about privacy can be sent to <a className="font-semibold text-[#0a66c2] hover:underline" href="mailto:privacy@rolebolt.tech">privacy@rolebolt.tech</a>.</p>
      </LegalSection>
    </LegalPageShell>
  );
}