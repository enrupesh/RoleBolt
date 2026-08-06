import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Recruiting Software Pricing & Plans | Rolebolt",
  description:
    "Compare Rolebolt plans for job seekers, Form Jobs and Standard Jobs. Start with the free plan and upgrade when your hiring or job-search workflow needs more capacity.",
  path: "/recruit/pricing",
  keywords: [
    "recruiting software pricing",
    "ATS pricing",
    "free applicant tracking system",
    "AI hiring software plans",
  ],
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}