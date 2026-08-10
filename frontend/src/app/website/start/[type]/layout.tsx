import type { Metadata } from "next";
import { sitegenMetadata } from "@/products/sitegen/config/seo";

export const metadata: Metadata = {
  ...sitegenMetadata(),
  robots: { index: false, follow: true },
};

export default function SitegenStartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
