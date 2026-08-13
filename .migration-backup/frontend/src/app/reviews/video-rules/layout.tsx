import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Video Review Rules & Rewards | Rolebolt",
  description: "Learn who can submit video reviews, how token rewards work, and what to expect from Admin approval.",
  path: "/reviews/video-rules",
});

export default function VideoReviewRulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
