import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Recruiting & Job Search Resources | Rolebolt",
  description:
    "Practical recruiting guides and job-search resources covering AI hiring, applicant tracking, resume writing, interviews, applications, and career strategy.",
  path: "/resources",
  keywords: [
    "recruiting resources",
    "job search resources",
    "hiring guides",
    "career advice",
    "AI recruiting guides",
  ],
});

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}