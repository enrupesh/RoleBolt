import type { Metadata } from "next";
import { sitegenMetadata } from "@/products/sitegen/config/seo";

export const metadata: Metadata = {
  ...sitegenMetadata(),
  robots: { index: false, follow: false },
};

export default function WebsiteLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
