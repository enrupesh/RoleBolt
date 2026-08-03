import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Rolebolt",
  description: "Review Rolebolt subscription cancellation, payment and refund information.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Payment & billing"
      title="Refund & Cancellation Policy"
      intro="Rolebolt uses category-specific plans and verified payment status. This page explains how cancellation and refund requests are handled."
      updated="August 3, 2026"
    >
      <LegalSection title="Plans and billing">
        <p>Paid plans may be offered monthly or annually in the billing flow. The plan category, price, billing interval, taxes where applicable, and renewal details shown at checkout are the source of truth for that purchase.</p>
      </LegalSection>
      <LegalSection title="Cancellation">
        <p>You may request cancellation through the available billing controls or by contacting support. Cancellation stops future renewal according to the applicable billing schedule; it does not automatically erase account data or reverse a period that has already started.</p>
      </LegalSection>
      <LegalSection title="Refund requests">
        <p>Refund requests are reviewed case by case, including duplicate charges, billing errors, an unfulfilled paid service, or a payment that was not authorized. Please contact us promptly with the account email, payment reference, plan category, and a short explanation.</p>
        <p>Approved refunds are returned through the original payment method when supported by the payment provider. Processing time can depend on the provider and the issuing bank.</p>
      </LegalSection>
      <LegalSection title="Non-refundable or limited situations">
        <p>We may decline requests for consumed usage, completed AI processing, abuse, policy violations, or requests made after a reasonable review period. Nothing in this policy limits rights that cannot legally be waived.</p>
      </LegalSection>
      <LegalSection title="Payment support">
        <p>For billing help, contact <a className="font-semibold text-[#0a66c2] hover:underline" href="mailto:billing@rolebolt.tech">billing@rolebolt.tech</a> or open the <a className="font-semibold text-[#0a66c2] hover:underline" href="/recruit/billing">Payment & billing</a> page. Do not send passwords, API keys, or full card numbers by email.</p>
      </LegalSection>
    </LegalPageShell>
  );
}