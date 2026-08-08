import type { Metadata } from "next";
import { sitegenMetadata } from "@/products/sitegen/config/seo";
import { SitegenLoginPage } from "@/products/sitegen/components/manage/SitegenManagePage";

export const metadata: Metadata = {
  ...sitegenMetadata(),
  robots: { index: false, follow: false },
};

export default function WebsiteLoginPage() {
  return <SitegenLoginPage />;
}
