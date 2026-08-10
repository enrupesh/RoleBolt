import type { MetadataRoute } from "next";
import { apiUrl, readApiJson } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";
import { resourceArticles } from "@/lib/resourceContent";

export const revalidate = 3600;

const publicPages: MetadataRoute.Sitemap = [
  { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
  {
    url: `${SITE_URL}/seeker`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/recruit/opportunities`,
    changeFrequency: "hourly",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/recruit/preview`,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: `${SITE_URL}/recruit/pricing`,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: `${SITE_URL}/reviews`,
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: `${SITE_URL}/website`,
    changeFrequency: "weekly",
    priority: 0.85,
  },
  {
    url: `${SITE_URL}/resources`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/careers`, changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  {
    url: `${SITE_URL}/refund-policy`,
    changeFrequency: "yearly",
    priority: 0.2,
  },
];

type SitemapJob = { _id?: string; id?: string; updatedAt?: string; createdAt?: string };

async function publicJobUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const response = await fetch(apiUrl("/recruit-public/jobs"), {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const data = await readApiJson<{ jobs?: SitemapJob[] }>(response);
    return (data.jobs ?? []).flatMap((job) => {
      const id = job._id ?? job.id;
      if (!id) return [];
      const modified = job.updatedAt ?? job.createdAt;
      return [
        {
          url: `${SITE_URL}/recruit/opportunities/${encodeURIComponent(id)}`,
          ...(modified ? { lastModified: new Date(modified) } : {}),
          changeFrequency: "daily" as const,
          priority: 0.8,
        },
      ];
    });
  } catch {
    // A backend outage must not make robots or the static sitemap unavailable.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resourceUrls: MetadataRoute.Sitemap = resourceArticles.map((article) => ({
    url: `${SITE_URL}/resources/${article.slug}`,
    lastModified: new Date(article.modifiedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  return [...publicPages, ...resourceUrls, ...(await publicJobUrls())];
}