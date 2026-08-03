import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Refund & Cancellation Policy | Rolebolt",
  description: "Read Rolebolt's policy for subscriptions, cancellation, refunds, failed payments and billing support.",
  path: "/refund-policy",
  keywords: ["Rolebolt refund policy", "subscription cancellation", "AI software refunds"],
});

function BillingLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="font-semibold text-[#0a66c2] hover:underline">{children}</a>;
}

function BillingList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Payment & billing"
      title="Refund & Cancellation Policy"
      intro="This policy explains how Rolebolt subscriptions are charged, verified, cancelled, renewed, and reviewed for refunds across Job Seeker, Form Jobs, and Standard Jobs plans."
      updated="August 3, 2026"
    >
      <div className="mb-12 rounded-2xl border border-[#dbe8f1] bg-[#f6fbfe] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0a66c2]">Billing at a glance</p>
        <p className="mt-3 text-sm leading-7 text-[#526e83]">
          Rolebolt is India-first and uses INR billing through the payment provider shown at checkout. A cancellation normally stops a future renewal; it does not automatically erase your account or reverse a billing period that has already started. Refunds are reviewed under the rules below and are returned through the original payment method where supported.
        </p>
        <nav aria-label="Refund and cancellation policy contents" className="mt-5 border-t border-[#dbe8f1] pt-4">
          <p className="text-xs font-semibold text-[#31536e]">Contents</p>
          <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <a href="#scope" className="text-[#0a66c2] hover:underline">1. Scope and billing categories</a>
            <a href="#plans" className="text-[#0a66c2] hover:underline">2. Plans, price and billing periods</a>
            <a href="#checkout" className="text-[#0a66c2] hover:underline">3. Checkout and payment verification</a>
            <a href="#renewal" className="text-[#0a66c2] hover:underline">4. Renewal and entitlement status</a>
            <a href="#cancellation" className="text-[#0a66c2] hover:underline">5. How to cancel</a>
            <a href="#after-cancellation" className="text-[#0a66c2] hover:underline">6. What happens after cancellation</a>
            <a href="#refunds" className="text-[#0a66c2] hover:underline">7. Refund eligibility</a>
            <a href="#not-refunded" className="text-[#0a66c2] hover:underline">8. Limited or non-refundable cases</a>
            <a href="#billing-errors" className="text-[#0a66c2] hover:underline">9. Duplicate, failed or unauthorised payments</a>
            <a href="#downgrades" className="text-[#0a66c2] hover:underline">10. Plan changes and downgrades</a>
            <a href="#payment-failures" className="text-[#0a66c2] hover:underline">11. Failed payments and restricted access</a>
            <a href="#processing" className="text-[#0a66c2] hover:underline">12. Refund processing</a>
            <a href="#data" className="text-[#0a66c2] hover:underline">13. Account data after cancellation</a>
            <a href="#request" className="text-[#0a66c2] hover:underline">14. How to request help</a>
            <a href="#changes" className="text-[#0a66c2] hover:underline">15. Changes and contact</a>
          </div>
        </nav>
      </div>

      <LegalSection title="1. Scope and billing categories" id="scope">
        <p>
          This Refund &amp; Cancellation Policy applies to paid Rolebolt subscriptions and related billing actions for the three product categories: Job Seeker, Job Creator – Form Jobs, and Job Creator – Standard Jobs. Each category has its own entitlement, plan limits, usage counters, and billing status. Paying for one category does not automatically activate paid access to another category.
        </p>
        <p>
          Free access is a local Rolebolt entitlement and does not create a paid payment-provider subscription. Free access has its own product limits and is not refundable because no subscription charge is made for it.
        </p>
      </LegalSection>

      <LegalSection title="2. Plans, price and billing periods" id="plans">
        <p>
          Rolebolt may offer Free, Pro, and Ultra Pro plans with monthly or yearly billing intervals. The price, currency, taxes, plan category, included features, usage limits, billing interval, renewal details, and any applicable offer shown in the checkout flow are the source of truth for the purchase.
        </p>
        <p>
          Rolebolt&apos;s current product pricing is India-first and displayed in INR. Prices may change for future purchases or renewals. A pricing change does not by itself change a current billing period that has already been paid, unless the checkout or applicable law provides otherwise.
        </p>
        <BillingList>
          <li>Monthly plans are charged for each monthly billing period unless cancelled before the next renewal is processed.</li>
          <li>Yearly plans are charged for the yearly period shown at checkout and generally renew yearly unless cancelled before renewal.</li>
          <li>Unused quota, AI units, exports, messages, or other period-based capacity does not automatically roll over to a later period.</li>
          <li>There are no automatic overage charges at launch. If a limit is reached, the relevant operation may be blocked or a clear upgrade state may be shown.</li>
        </BillingList>
        <p>
          Taxes, payment-provider charges, bank charges, exchange-rate effects, or other amounts shown separately at checkout may affect the final amount charged or returned.
        </p>
      </LegalSection>

      <LegalSection title="3. Checkout and payment verification" id="checkout">
        <p>
          Rolebolt uses the payment provider displayed in the checkout flow, currently Razorpay for the India-first subscription system. The payment provider may collect and process payment credentials. Rolebolt receives payment references, subscription identifiers, status, plan information, billing period information, and reconciliation events needed to operate the subscription.
        </p>
        <p>
          A checkout redirect, browser callback, success query parameter, or client-side message is not by itself proof that paid access has been activated. Rolebolt activates paid entitlement only after the backend verifies the provider state and processes the applicable authenticated payment or subscription event.
        </p>
        <p>
          If a payment appears successful in your bank or provider interface but Rolebolt still shows Free or pending access, do not purchase repeatedly. First allow time for reconciliation, then contact billing support with the payment reference.
        </p>
      </LegalSection>

      <LegalSection title="4. Renewal and entitlement status" id="renewal">
        <p>
          A paid subscription may renew at the end of its monthly or yearly period according to the terms shown at checkout. The subscription status and current period stored by Rolebolt and verified with the payment provider determine access—not a local browser flag.
        </p>
        <p>
          Billing status may show active, pending, past due, halted, cancellation scheduled, cancelled, or another state supported by the provider and Rolebolt. Some states may preserve current paid capacity temporarily while a payment is being confirmed; others may restrict metered work until payment or reconciliation is complete.
        </p>
      </LegalSection>

      <LegalSection title="5. How to cancel" id="cancellation">
        <p>
          You may request cancellation through the available controls on the <BillingLink href="/recruit/billing">Payment &amp; billing</BillingLink> page or by contacting <BillingLink href="mailto:billing@rolebolt.tech">billing@rolebolt.tech</BillingLink>. Use the account email or username connected to the subscription so we can locate the correct billing category.
        </p>
        <BillingList>
          <li>Cancel the specific category you no longer want. Job Seeker, Form Jobs, and Standard Jobs subscriptions are separate.</li>
          <li>Check the confirmation message and billing status after submitting the request. Keep the confirmation for your records.</li>
          <li>If the billing page is unavailable, contact billing support before the renewal date and include a clear request to stop renewal.</li>
          <li>Do not send your password, full card number, CVV, API key, authentication token, or payment secret by email.</li>
        </BillingList>
        <p>
          A cancellation request may be scheduled for the end of the current paid period rather than ending access immediately. The effective date shown in the billing experience or confirmed by support controls.
        </p>
      </LegalSection>

      <LegalSection title="6. What happens after cancellation" id="after-cancellation">
        <p>
          When cancellation is scheduled, paid access normally continues until the current paid period ends. At the end of that period, the entitlement may return to the applicable Free state or become inactive, depending on the category and product rules.
        </p>
        <BillingList>
          <li>Cancellation does not automatically delete your account, profile, jobs, applications, resumes, candidates, billing history, or other stored information.</li>
          <li>Cancellation does not automatically refund the unused portion of a monthly or yearly period.</li>
          <li>Usage already consumed during the period remains recorded for billing, security, product operation, and audit purposes.</li>
          <li>Future access may be limited by Free-plan limits or by the applicable inactive state.</li>
          <li>You may need to manually export or delete information if you want a copy or no longer want it retained, subject to the <BillingLink href="/privacy">Privacy Policy</BillingLink> and the rights of a recruiting organisation controlling candidate data.</li>
        </BillingList>
      </LegalSection>

      <LegalSection title="7. Refund eligibility" id="refunds">
        <p>
          Refund requests are reviewed individually and should be submitted promptly. A refund may be considered where there is evidence of:
        </p>
        <BillingList>
          <li>a duplicate charge for the same account, category, and billing period;</li>
          <li>a billing or pricing error attributable to Rolebolt or the payment flow;</li>
          <li>an unauthorised payment, subject to verification and cooperation with the payment provider;</li>
          <li>a verified payment where the related paid entitlement was not activated and could not be corrected through reconciliation;</li>
          <li>a material failure to provide the paid service during a meaningful portion of the paid period, where the issue is confirmed and a refund or credit is appropriate; or</li>
          <li>another situation where a refund is required by applicable law or the checkout terms.</li>
        </BillingList>
        <p>
          A refund is not guaranteed merely because a subscription was not used, a user changed their mind, a feature was not needed, a quota was not consumed, or cancellation was requested after a renewal. We will consider the facts, timing, service usage, provider records, and applicable legal rights.
        </p>
      </LegalSection>

      <LegalSection title="8. Limited or non-refundable cases" id="not-refunded">
        <p>Subject to rights that cannot legally be waived, we may decline or limit a refund where:</p>
        <BillingList>
          <li>the request is for a period that was substantially used;</li>
          <li>AI processing, resume parsing, scoring, matching, cover-letter generation, interview preparation, Copilot turns, exports, automated emails, or other metered work was completed;</li>
          <li>the issue resulted from inaccurate account, billing, device, browser, email, or payment-provider information supplied by the customer;</li>
          <li>access was suspended or terminated because of fraud, abuse, unlawful conduct, a policy violation, or unauthorised use;</li>
          <li>the request concerns unused capacity that expired at the end of a billing period;</li>
          <li>the payment was made to a third party or a different service and is not a Rolebolt charge; or</li>
          <li>the request is made after an unreasonable delay and the relevant provider or transaction records are no longer available.</li>
        </BillingList>
        <p>
          We may offer a partial refund, account credit, plan correction, or reconciliation instead of a full refund when that is a fairer remedy for the circumstances and permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="9. Duplicate, failed or unauthorised payments" id="billing-errors">
        <p>
          If you believe you were charged twice, received an incorrect amount, or were charged for the wrong category or interval, contact billing support promptly. Include the Rolebolt account email, payment reference, date, charged amount, currency, and a description of the issue. Do not email full payment credentials.
        </p>
        <p>
          Some bank or payment-provider entries are temporary authorisations, pending transactions, retries, reversals, or settlement adjustments rather than completed Rolebolt charges. We may need to wait for provider confirmation before deciding whether a refund or correction is required.
        </p>
        <p>
          For an unauthorised payment, contact Rolebolt and the payment provider or issuing bank promptly. We may ask for information needed to investigate, prevent repeat misuse, and distinguish an unauthorised payment from an account-holder dispute.
        </p>
      </LegalSection>

      <LegalSection title="10. Plan changes and downgrades" id="downgrades">
        <p>
          If the billing experience allows an upgrade, downgrade, category change, or interval change, the effective timing and price adjustment shown before confirmation control the change. A plan change may apply immediately or at the end of the current period.
        </p>
        <p>
          A downgrade or change does not automatically create a refund for the unused part of the previous plan. If the product or payment provider confirms a credit, adjustment, or prorated amount, it will be shown or communicated as part of that change.
        </p>
        <p>
          When a plan change is pending, current limits may remain in place until the payment provider confirms the change. Rolebolt will not treat a browser request alone as proof that a higher plan or lower price is active.
        </p>
      </LegalSection>

      <LegalSection title="11. Failed payments and restricted access" id="payment-failures">
        <p>
          If a renewal or payment fails, the payment provider may retry the charge or mark the subscription pending, past due, halted, cancelled, or another status. Rolebolt may send billing notices and may restrict new metered or paid-capacity operations while the payment state is unresolved.
        </p>
        <p>
          Failed payment handling does not erase your account or automatically delete your stored data. You remain responsible for amounts that were validly due before cancellation or termination. To repair a billing state, use the available billing controls or contact support for reconciliation.
        </p>
      </LegalSection>

      <LegalSection title="12. Refund processing" id="processing">
        <p>
          If a refund is approved, Rolebolt will normally request it through the original payment provider and return it to the original payment method where the provider supports that route. We cannot guarantee the exact date on which funds appear in your account because processing times depend on the provider, bank, card network, and local settlement rules.
        </p>
        <BillingList>
          <li>Keep the payment reference and refund confirmation until the amount appears or the provider confirms its status.</li>
          <li>A provider may show a refund as pending before it is credited by the issuing bank.</li>
          <li>We may ask the payment provider to trace a delayed refund when you provide the relevant reference.</li>
          <li>A refund may be reduced by a legally required adjustment, reversed payment, tax treatment, or amount already returned by another party.</li>
        </BillingList>
      </LegalSection>

      <LegalSection title="13. Account data after cancellation" id="data">
        <p>
          Cancellation and account deletion are different actions. We may retain account, subscription, payment, usage, audit, support, and security records for legitimate business, legal, accounting, fraud-prevention, dispute-resolution, or provider-reconciliation purposes.
        </p>
        <p>
          Workspace and candidate information may also remain under the control of a recruiter or organisation using Rolebolt. If you are a candidate and want information removed from an employer&apos;s hiring records, contact that organisation as well as Rolebolt where appropriate. More detail is available in the <BillingLink href="/privacy">Privacy Policy</BillingLink>.
        </p>
      </LegalSection>

      <LegalSection title="14. How to request help" id="request">
        <p>
          Contact <BillingLink href="mailto:billing@rolebolt.tech">billing@rolebolt.tech</BillingLink> for a cancellation, refund, duplicate-charge, failed-payment, or reconciliation request. Include:
        </p>
        <BillingList>
          <li>the Rolebolt account email or username;</li>
          <li>the billing category: Job Seeker, Form Jobs, or Standard Jobs;</li>
          <li>the plan and interval, if known;</li>
          <li>the payment or subscription reference;</li>
          <li>the transaction date and amount; and</li>
          <li>a short explanation of the requested correction or refund.</li>
        </BillingList>
        <p>
          Never send passwords, one-time passwords, full card numbers, CVV codes, API keys, private keys, or authentication tokens. We may ask for limited additional information to verify the account and transaction.
        </p>
      </LegalSection>

      <LegalSection title="15. Changes and contact" id="changes">
        <p>
          Rolebolt may update this policy when pricing, providers, billing lifecycle behaviour, product categories, or legal requirements change. The current version will be posted on this page with a new &quot;Last updated&quot; date. The checkout flow and provider confirmation remain the source of truth for a particular purchase.
        </p>
        <p>
          Nothing in this policy limits a consumer, payment, privacy, or other right that cannot legally be waived. If a conflict exists between this general policy and a mandatory right or a specific written checkout term, the mandatory right or specific term controls to the extent of the conflict.
        </p>
        <p>
          For related policies, see the <BillingLink href="/terms">Terms &amp; Conditions</BillingLink>, <BillingLink href="/privacy">Privacy Policy</BillingLink>, <BillingLink href="/recruit/billing">Payment &amp; billing</BillingLink>, and <BillingLink href="/recruit/status">System status</BillingLink> pages.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}