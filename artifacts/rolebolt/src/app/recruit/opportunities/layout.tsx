import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Find Jobs & AI-Matched Opportunities | Rolebolt",
  description:
    "Search open jobs by role, skill, location and work mode. Discover public opportunities and apply through Rolebolt's focused job-search experience.",
  path: "/recruit/opportunities",
  keywords: [
    "find jobs",
    "AI job matching",
    "open job opportunities",
    "remote jobs",
    "job search platform",
  ],
});

export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}