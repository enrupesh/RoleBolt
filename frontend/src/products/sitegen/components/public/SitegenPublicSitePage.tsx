import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITEGEN_RESERVED_USERNAMES, SITEGEN_USERNAME_PATTERN } from "@/products/sitegen/config/reserved-usernames";
import { fetchPublishedSitegenSite } from "@/products/sitegen/lib/client";
import { SitegenThemeRenderer } from "@/products/sitegen/themes";
import { sitegenDisplayPublicUrl, sitegenPublicSiteUrl } from "@/products/sitegen/lib/publicUrl";

type PageProps = {
  params: Promise<{ username: string }>;
};

const getPublishedSite = cache(async (username: string) => fetchPublishedSitegenSite(username));

function isValidPublicUsername(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  if (!SITEGEN_USERNAME_PATTERN.test(normalized)) return false;
  if (SITEGEN_RESERVED_USERNAMES.has(normalized)) return false;
  return true;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  if (!isValidPublicUsername(username)) return { title: "Not found" };

  const site = await getPublishedSite(username);
  if (!site) return { title: "Not found" };

  const title = site.structuredContent.type === "seeker"
    ? site.structuredContent.name
    : site.structuredContent.businessName;

  return {
    title: `${title} | ${sitegenDisplayPublicUrl(username)}`,
    description: site.structuredContent.type === "seeker"
      ? site.structuredContent.headline || `Professional website for ${title}`
      : site.structuredContent.tagline || `Website for ${title}`,
    alternates: {
      canonical: sitegenPublicSiteUrl(username),
    },
    robots: { index: true, follow: true },
  };
}

export default async function SitegenPublicSitePage({ params }: PageProps) {
  const { username } = await params;
  if (!isValidPublicUsername(username)) notFound();

  const site = await getPublishedSite(username);
  if (!site) notFound();

  return (
    <SitegenThemeRenderer
      themeId={site.themeId}
      content={site.structuredContent}
      username={site.username}
    />
  );
}
