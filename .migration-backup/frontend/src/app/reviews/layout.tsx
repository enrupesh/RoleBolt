import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Rolebolt Reviews | Job Seeker & Job Creator Experiences",
  description: "Read reviews from people using Rolebolt for job search and hiring.",
  path: "/reviews",
});

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}