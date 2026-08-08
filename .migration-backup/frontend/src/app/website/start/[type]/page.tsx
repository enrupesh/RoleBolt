import { notFound } from "next/navigation";
import { SitegenCreateDraftPage } from "@/products/sitegen/components/create/SitegenCreateDraftPage";
import type { SitegenSiteType } from "@/products/sitegen/config/product";

const VALID_TYPES = new Set<SitegenSiteType>(["seeker", "creator"]);

type PageProps = {
  params: Promise<{ type: string }>;
};

export default async function SitegenStartTypePage({ params }: PageProps) {
  const { type } = await params;
  if (!VALID_TYPES.has(type as SitegenSiteType)) notFound();
  return <SitegenCreateDraftPage siteType={type as SitegenSiteType} />;
}
