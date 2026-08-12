import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "AI Recruiting Software Product Preview | Rolebolt",
  description:
    "Explore the Rolebolt product preview: AI recruiting dashboards, candidate evaluation, hiring pipelines, analytics and job-seeker workspace screens.",
  path: "/recruit/preview",
  keywords: [
    "AI recruiting software preview",
    "applicant tracking system demo",
    "recruiting software screenshots",
    "AI hiring platform demo",
  ],
});

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}