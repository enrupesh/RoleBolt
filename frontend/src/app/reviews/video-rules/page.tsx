import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { RoleboltLogo } from "@/components/RoleboltLogo";

function RuleCard({
  title,
  children,
  accent = "blue",
}: {
  title: string;
  children: React.ReactNode;
  accent?: "blue" | "green" | "amber";
}) {
  const accents = {
    blue: "border-[#cfe4f7] bg-[#f4f9ff]",
    green: "border-[#c8ead9] bg-[#f3fbf7]",
    amber: "border-[#f0d9a8] bg-[#fff9eb]",
  };

  return (
    <section className={`rounded-2xl border p-6 sm:p-7 ${accents[accent]}`}>
      <h2 className="font-display text-xl font-semibold tracking-[-.035em] text-[#203d56]">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-[#647a8d]">{children}</div>
    </section>
  );
}

function RewardTier({
  multiplier,
  title,
  description,
}: {
  multiplier: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#d9e5ee] bg-white p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] font-display text-lg font-semibold text-[#0a66c2]">
          {multiplier}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#203d56]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#647a8d]">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function VideoReviewRulesPage() {
  return (
    <div className="min-h-screen bg-[#f8fbfd] text-[#10263d]">
      <header className="border-b border-[#dfe8ef] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-2.5" aria-label="Rolebolt home">
            <RoleboltLogo size="md" />
            <span className="font-display text-[15px] font-semibold tracking-[-0.03em]">Rolebolt</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/reviews" className="hidden rounded-lg border border-[#cbd9e4] bg-white px-3.5 py-2 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2] sm:inline-flex">
              All reviews
            </Link>
            <Link href="/recruit" className="inline-flex rounded-lg border border-[#cbd9e4] bg-white px-3.5 py-2 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2]">
              Back to Rolebolt
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#0a66c2]">Video reviews</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d] sm:text-5xl">
            Video Review Rules &amp; Rewards
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#647a8d]">
            Everything you need to know before submitting a video review — eligibility, rewards, requirements, and how Admin approval works.
          </p>
        </div>

        <div className="mt-12 space-y-5">
          <RuleCard title="Who can submit?" accent="blue">
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="text-[#203d56]">Everyone signed in</strong> can submit a video review.</li>
              <li><strong className="text-[#203d56]">Guests / logged-out users</strong> must sign in before submitting.</li>
              <li><strong className="text-[#203d56]">Pro Job Seekers</strong> are eligible for token rewards after Admin approval.</li>
              <li><strong className="text-[#203d56]">Ultra Pro Job Seekers</strong> are eligible for token rewards after Admin approval.</li>
              <li><strong className="text-[#203d56]">Free Job Seekers</strong> can submit, but are not eligible for token rewards.</li>
              <li><strong className="text-[#203d56]">Job Creators</strong> can submit, but are not eligible for token rewards.</li>
            </ul>
          </RuleCard>

          <RuleCard title="Reward structure" accent="green">
            <p>
              Rewards are shown as multipliers only. The actual token amount is decided manually by Admin after reviewing your video.
            </p>
            <div className="mt-5 space-y-3">
              <RewardTier
                multiplier="2×"
                title="Face clearly visible"
                description="A genuine video review with your face clearly visible may qualify for the highest reward tier."
              />
              <RewardTier
                multiplier="1.5×"
                title="Face not visible"
                description="A genuine video review where your face is not visible may qualify for a lower reward tier."
              />
              <RewardTier
                multiplier="0.5×"
                title="AI-generated video"
                description="AI-generated video reviews may qualify for a significantly lower reward tier."
              />
            </div>
            <p className="mt-4 text-sm text-[#7a8f9f]">
              These are guidelines, not automatic payouts. Admin determines the final reward for each submission.
            </p>
          </RuleCard>

          <RuleCard title="Video requirements" accent="blue">
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide a <strong className="text-[#203d56]">public video URL</strong> — the link must be publicly accessible.</li>
              <li>Supported platforms include <strong className="text-[#203d56]">YouTube</strong>, <strong className="text-[#203d56]">X (Twitter)</strong>, and other public video hosts.</li>
              <li>No direct video upload is required on Rolebolt.</li>
              <li>No in-browser recording is required — record on your platform of choice and share the link.</li>
              <li>Include your <strong className="text-[#203d56]">star rating</strong> and <strong className="text-[#203d56]">display name</strong> when submitting.</li>
            </ul>
          </RuleCard>

          <RuleCard title="Review & approval policy" accent="amber">
            <p>Every video review is subject to Admin review and approval before any reward is granted.</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Admin decides whether the submission is valid.</li>
              <li>Admin decides which reward tier applies (2×, 1.5×, or 0.5×).</li>
              <li>Admin can reject submissions that do not meet the guidelines.</li>
              <li>Submitting a video does <strong className="text-[#203d56]">not</strong> automatically guarantee a reward.</li>
            </ul>
          </RuleCard>

          <RuleCard title="Content & quality rules">
            <ul className="list-disc space-y-2 pl-5">
              <li>Your review should be genuine and related to your Rolebolt experience.</li>
              <li>The submitted link must be publicly accessible at the time of review.</li>
              <li>Misleading, fake, copied, spam, or otherwise invalid submissions may be rejected.</li>
              <li>AI-generated videos can receive the lower reward tier according to the policy above.</li>
              <li>Approved videos may later be embedded on the Rolebolt website using the public link.</li>
            </ul>
          </RuleCard>
        </div>

        <div className="mt-10 rounded-2xl border border-[#d9e5ee] bg-white p-6 text-center shadow-[0_18px_50px_rgba(33,71,103,.07)] sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-[-.04em] text-[#10263d]">Ready to submit?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#647a8d]">
            Open the Review section from the footer, switch to Video Review, and paste your public video link.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/reviews" className="inline-flex rounded-xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#07559f]">
              Go to reviews
            </Link>
            <Link href="/recruit" className="inline-flex rounded-xl border border-[#cbd9e4] bg-white px-5 py-3 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2]">
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
