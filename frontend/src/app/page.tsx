import type { Metadata } from "next";
import RecruitLandingPage from "@/app/recruit/page";
import { buildMetadata, productKeywords } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Recruit AI — Free AI Hiring & ATS for Modern Teams | Rolebolt",
  description:
    "Rolebolt is a free AI-powered ATS that sources candidates, screens resumes, scores fit, and runs your full hiring pipeline end-to-end — for startups, agencies, and enterprise teams.",
  path: "/",
  keywords: [...productKeywords.recruit],
});

export default function RootPage() {
  return <RecruitLandingPage />;
}
