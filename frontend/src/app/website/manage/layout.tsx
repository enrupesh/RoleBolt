import type { Metadata } from "next";
import { sitegenMetadata } from "@/products/sitegen/config/seo";

export const metadata: Metadata = {
  ...sitegenMetadata(),
  robots: { index: false, follow: false },
};

export default function WebsiteManageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
