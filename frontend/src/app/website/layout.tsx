import type { ReactNode } from "react";
import { sitegenMetadata } from "@/products/sitegen/config/seo";

export const metadata = sitegenMetadata();

export default function WebsiteProductLayout({ children }: { children: ReactNode }) {
  return children;
}
