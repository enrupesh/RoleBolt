import type { Metadata } from "next";
import RecruitLandingPage from "@/app/recruit/page";
import { buildMetadata, productKeywords } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "AI Recruiting Software & Job Search Workspace | Rolebolt",
  description:
    "Rolebolt is an AI recruiting workspace and applicant tracking system for hiring teams, plus a focused job-search workspace for candidates.",
  path: "/",
  keywords: [...productKeywords.recruit],
});

export default function RootPage() {
  return <RecruitLandingPage />;
}
