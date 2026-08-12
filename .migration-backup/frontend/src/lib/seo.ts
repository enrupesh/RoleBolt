import type { Metadata } from "next";

export const SITE_URL = "https://www.rolebolt.tech";

export const siteConfig = {
  name: "Rolebolt",
  shortName: "Rolebolt",
  url: SITE_URL,
  locale: "en_US",
  defaultTitle: "Rolebolt — AI Recruiting Software & Job Search Workspace",
  titleTemplate: "%s | Rolebolt",
  defaultDescription:
    "Rolebolt is an AI recruiting workspace and applicant tracking system for hiring teams, with job discovery and career tools for people searching for their next opportunity.",
  slogan: "Clearer hiring. More confident job searches.",
  defaultKeywords: [
    "Rolebolt",
    "Rolebolt app",
    "Rolebolt recruiting",
    "Rolebolt job search",
    "AI recruiting software",
    "AI applicant tracking system",
    "free applicant tracking system",
    "applicant tracking system",
    "recruiting software",
    "hiring software",
    "candidate screening software",
    "resume screening software",
    "AI candidate matching",
    "hiring pipeline",
    "recruiting automation",
    "talent pool software",
    "job search platform",
    "career workspace",
    "job application tracker",
    "AI resume builder",
    "AI interview preparation",
    "public job board",
    "remote jobs",
    "jobs for freshers",
    "recruiting analytics",
    "AI hiring assistant",
  ],
  twitterHandle: "@roleboltai",
  organization: {
    legalName: "Rolebolt",
    foundingDate: "2024",
    foundingLocation: "Global",
    email: "support@rolebolt.tech",
    contactEmail: "support@rolebolt.tech",
    pressEmail: "press@rolebolt.tech",
    salesEmail: "sales@rolebolt.tech",
    sameAs: [
      "https://www.rolebolt.tech",
      "https://twitter.com/roleboltai",
      "https://x.com/roleboltai",
      "https://www.linkedin.com/company/rolebolt-ai",
      "https://github.com/rolebolt",
    ],
    knowsAbout: [
      "Artificial Intelligence",
      "Generative AI",
      "Natural Language Processing",
      "Applicant Tracking Systems",
      "AI Recruiting Technology",
      "Candidate Screening",
      "Resume Parsing",
      "Candidate Matching",
      "Hiring Pipeline Management",
      "Recruiting Analytics",
      "Job Search",
      "Career Development",
    ],
  },
} as const;

export const productKeywords = {
  recruit: [
    "AI recruiting software",
    "AI recruiting platform",
    "AI applicant tracking system",
    "free ATS",
    "free ATS software",
    "free ATS for startups",
    "free ATS for small business",
    "AI candidate screening",
    "AI resume screening",
    "AI resume parser",
    "AI resume scoring",
    "AI candidate scoring",
    "AI candidate matching",
    "AI interview assistant",
    "AI hiring funnel",
    "AI hiring pipeline",
    "AI hiring workflow",
    "AI offer letter generator",
    "AI hiring analytics",
    "AI talent pool",
    "AI job posting generator",
    "AI job description writer",
    "AI hiring for startups",
    "AI hiring for SMB",
    "AI recruiter assistant",
    "AI recruiter copilot",
    "how to screen resumes with AI",
    "how to source candidates with AI",
    "how to write job descriptions with AI",
    "recruiting software for startups",
    "recruiting software for small business",
    "candidate assessment software",
    "recruiting pipeline software",
  ],
} as const;

export type ProductKeywordSet = keyof typeof productKeywords;

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  noIndex?: boolean;
  alternateLanguages?: Record<string, string>;
};

export function buildMetadata({
  title,
  description,
  path,
  keywords,
  ogImage = "/opengraph-image",
  ogType = "website",
  publishedTime,
  modifiedTime,
  authors,
  noIndex,
  alternateLanguages,
}: BuildMetadataInput): Metadata {
  const fullTitle = title.includes("Rolebolt") ? title : `${title} | Rolebolt`;
  const url = path.startsWith("http") ? path : `${SITE_URL}${path}`;
  const seen = new Set<string>();
  const dedupedKeywords: string[] = [];
  for (const kw of [...(keywords ?? []), ...siteConfig.defaultKeywords]) {
    const key = kw.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      dedupedKeywords.push(kw);
    }
  }
  // Meta keywords are not a direct ranking signal. Keep this list short and
  // page-relevant instead of emitting the entire product catalog on every URL.
  const finalKeywords = dedupedKeywords.slice(0, 24).join(", ");

  return {
    title: fullTitle,
    description,
    keywords: finalKeywords,
    alternates: {
      canonical: url,
      languages: {
        "x-default": url,
        en: url,
        ...(alternateLanguages ?? {}),
      },
      types: {
        "application/rss+xml": [{ url: `${SITE_URL}/feed.xml`, title: "Rolebolt Blog RSS" }],
      },
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: ogType,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      ...(authors && ogType === "article" ? { authors } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      site: siteConfig.twitterHandle,
      creator: siteConfig.twitterHandle,
      images: [ogImage],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    name: siteConfig.organization.legalName,
    alternateName: [siteConfig.shortName, "Rolebolt", "Rolebolt Platform"],
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/rolebolt-icon.png`,
      width: 512,
      height: 512,
    },
    image: `${SITE_URL}/opengraph-image`,
    foundingDate: siteConfig.organization.foundingDate,
    foundingLocation: {
      "@type": "Place",
      name: siteConfig.organization.foundingLocation,
    },
    email: siteConfig.organization.email,
    slogan: siteConfig.slogan,
    description: siteConfig.defaultDescription,
    sameAs: siteConfig.organization.sameAs,
    knowsAbout: siteConfig.organization.knowsAbout,
    areaServed: [
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "United Kingdom" },
      { "@type": "Country", name: "Worldwide" },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: siteConfig.organization.contactEmail,
        availableLanguage: ["English", "Spanish", "French", "German", "Portuguese"],
        areaServed: "Worldwide",
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: siteConfig.organization.salesEmail,
        availableLanguage: ["English"],
      },
      {
        "@type": "ContactPoint",
        contactType: "press",
        email: siteConfig.organization.pressEmail,
        availableLanguage: ["English"],
      },
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    name: siteConfig.name,
    alternateName: siteConfig.shortName,
    url: SITE_URL,
    description: siteConfig.defaultDescription,
    inLanguage: ["en", "hi"],
    publisher: { "@id": `${SITE_URL}#organization` },
    potentialAction: [
      {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/recruit/opportunities?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    ],
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}#software`,
    name: siteConfig.name,
    operatingSystem: "Web, iOS, Android",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Artificial Intelligence Platform",
    description: siteConfig.defaultDescription,
    url: SITE_URL,
    image: `${SITE_URL}/rolebolt-icon.png`,
    softwareVersion: "1.0",
    inLanguage: ["en", "hi"],
    featureList: [
      "AI job analysis and hiring rubrics",
      "Applicant tracking and candidate pipeline management",
      "Resume review and candidate matching",
      "Standard jobs and structured form jobs",
      "Public opportunities and applications",
      "Async candidate assessments",
      "Pipeline automation and review actions",
      "Talent pool, collaboration and hiring analytics",
      "Job-search workspace with resumes and interview preparation",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      priceValidUntil: "2030-12-31",
    },
    publisher: { "@id": `${SITE_URL}#organization` },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function articleJsonLd(opts: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  modifiedAt?: string;
  author: string;
  image?: string;
  category?: string;
  tags?: string[];
}) {
  const url = `${SITE_URL}/blog/${opts.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: opts.title,
    description: opts.description,
    image: opts.image
      ? opts.image.startsWith("http")
        ? opts.image
        : `${SITE_URL}${opts.image}`
      : `${SITE_URL}/opengraph-image`,
    datePublished: opts.publishedAt,
    dateModified: opts.modifiedAt ?? opts.publishedAt,
    author: {
      "@type": "Person",
      name: opts.author,
      url: `${SITE_URL}/about`,
    },
    publisher: { "@id": `${SITE_URL}#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
    isPartOf: { "@id": `${SITE_URL}/blog#blog` },
    inLanguage: "en",
    articleSection: opts.category,
    keywords: opts.tags?.join(", "),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "article p"],
    },
  };
}

/**
 * Per-product SoftwareApplication schema. Use inside each product's layout.tsx
 * so search engines can present each Rolebolt product as its own entity with
 * its own rating, price, and feature list.
 */
export function productAppJsonLd(opts: {
  id: string;
  name: string;
  url: string;
  description: string;
  category?: string;
  subCategory?: string;
  features?: string[];
  rating?: { value: string; count: string };
  image?: string;
  inLanguage?: string[];
  priceCurrency?: string;
  lowPrice?: string;
}) {
  const url = opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}`;
  const image = opts.image
    ? opts.image.startsWith("http")
      ? opts.image
      : `${SITE_URL}${opts.image}`
    : `${SITE_URL}/opengraph-image`;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: opts.name,
    url,
    description: opts.description,
    image,
    applicationCategory: opts.category ?? "BusinessApplication",
    applicationSubCategory: opts.subCategory ?? "Artificial Intelligence",
    operatingSystem: "Web, iOS, Android",
    inLanguage: opts.inLanguage ?? ["en", "hi"],
    featureList: opts.features ?? [],
    offers: {
      "@type": "Offer",
      price: opts.lowPrice ?? "0",
      priceCurrency: opts.priceCurrency ?? "USD",
      availability: "https://schema.org/InStock",
    },
    ...(opts.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.rating.value,
            ratingCount: opts.rating.count,
            reviewCount: opts.rating.count,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
    publisher: { "@id": `${SITE_URL}#organization` },
    isPartOf: { "@id": `${SITE_URL}#software` },
  };
}

export function webPageJsonLd(opts: {
  url: string;
  name: string;
  description: string;
  breadcrumb?: { name: string; url: string }[];
  speakable?: boolean;
  primaryImage?: string;
}) {
  const url = opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: opts.name,
    description: opts.description,
    isPartOf: { "@id": `${SITE_URL}#website` },
    inLanguage: "en",
    primaryImageOfPage: opts.primaryImage
      ? {
          "@type": "ImageObject",
          url: opts.primaryImage.startsWith("http")
            ? opts.primaryImage
            : `${SITE_URL}${opts.primaryImage}`,
        }
      : undefined,
    ...(opts.speakable
      ? {
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["h1", "h2", "main p"],
          },
        }
      : {}),
    ...(opts.breadcrumb
      ? {
          breadcrumb: breadcrumbJsonLd(opts.breadcrumb),
        }
      : {}),
  };
}

export function itemListJsonLd(opts: {
  name: string;
  items: { name: string; url: string; description?: string; image?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    numberOfItems: opts.items.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: opts.items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      ...(item.image
        ? {
            image: item.image.startsWith("http") ? item.image : `${SITE_URL}${item.image}`,
          }
        : {}),
    })),
  };
}

export function collectionPageJsonLd(opts: {
  url: string;
  name: string;
  description: string;
  itemList?: ReturnType<typeof itemListJsonLd>;
}) {
  const url = opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: opts.name,
    description: opts.description,
    isPartOf: { "@id": `${SITE_URL}#website` },
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}#organization` },
    ...(opts.itemList ? { mainEntity: opts.itemList } : {}),
  };
}

export function serviceJsonLd(opts: {
  name: string;
  url: string;
  description: string;
  serviceType: string;
  areaServed?: string[];
}) {
  const url = opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}`;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    url,
    description: opts.description,
    serviceType: opts.serviceType,
    provider: { "@id": `${SITE_URL}#organization` },
    areaServed: (opts.areaServed ?? ["Worldwide"]).map((a) => ({
      "@type": "Place",
      name: a,
    })),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

export function howToJsonLd(opts: {
  name: string;
  description: string;
  steps: { name: string; text: string; url?: string }[];
  totalTime?: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime ? { totalTime: opts.totalTime } : {}),
    ...(opts.image
      ? {
          image: opts.image.startsWith("http") ? opts.image : `${SITE_URL}${opts.image}`,
        }
      : {}),
    step: opts.steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      text: s.text,
      ...(s.url
        ? {
            url: s.url.startsWith("http") ? s.url : `${SITE_URL}${s.url}`,
          }
        : {}),
    })),
  };
}

export function siteLinksSearchBoxJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: siteConfig.name,
    potentialAction: [
      {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/recruit/opportunities?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    ],
  };
}

export function videoObjectJsonLd(opts: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  embedUrl?: string;
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: opts.name,
    description: opts.description,
    thumbnailUrl: opts.thumbnailUrl.startsWith("http")
      ? opts.thumbnailUrl
      : `${SITE_URL}${opts.thumbnailUrl}`,
    uploadDate: opts.uploadDate,
    ...(opts.duration ? { duration: opts.duration } : {}),
    ...(opts.embedUrl ? { embedUrl: opts.embedUrl } : {}),
    ...(opts.url ? { url: opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}` } : {}),
    publisher: { "@id": `${SITE_URL}#organization` },
  };
}

export function courseJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  provider: string;
  language?: string;
}) {
  const url = opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}`;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: opts.name,
    description: opts.description,
    url,
    inLanguage: opts.language ?? "en",
    provider: {
      "@type": "Organization",
      name: opts.provider,
      "@id": `${SITE_URL}#organization`,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

export function jobPostingJsonLd(opts: {
  id: string;
  title: string;
  description: string;
  url: string;
  companyName?: string;
  companyUrl?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  applicationDeadline?: string;
  datePosted?: string;
}) {
  const url = opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}`;
  const remote = opts.workMode?.toLowerCase() === "remote";
  const employmentTypeMap: Record<string, string> = {
    full_time: "FULL_TIME",
    "full-time": "FULL_TIME",
    fulltime: "FULL_TIME",
    part_time: "PART_TIME",
    "part-time": "PART_TIME",
    parttime: "PART_TIME",
    contract: "CONTRACTOR",
    freelance: "CONTRACTOR",
    internship: "INTERN",
    temporary: "TEMPORARY",
  };
  const employmentType = employmentTypeMap[(opts.jobType ?? "").toLowerCase()];
  const salary =
    opts.salaryMin != null || opts.salaryMax != null
      ? {
          "@type": "MonetaryAmount",
          currency: opts.salaryCurrency ?? "INR",
          value: {
            "@type": "QuantitativeValue",
            ...(opts.salaryMin != null ? { minValue: opts.salaryMin } : {}),
            ...(opts.salaryMax != null ? { maxValue: opts.salaryMax } : {}),
            unitText: "YEAR",
          },
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "@id": `${url}#jobposting`,
    identifier: { "@type": "PropertyValue", name: "Rolebolt", value: opts.id },
    title: opts.title,
    description: opts.description,
    url,
    directApply: true,
    ...(employmentType ? { employmentType } : {}),
    ...(opts.datePosted ? { datePosted: opts.datePosted } : {}),
    ...(opts.applicationDeadline ? { validThrough: opts.applicationDeadline } : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: opts.companyName || "Rolebolt recruiter",
      ...(opts.companyUrl ? { sameAs: opts.companyUrl } : {}),
    },
    ...(remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: "Worldwide",
          },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: opts.location || "Remote",
              addressCountry: "IN",
            },
          },
        }),
    ...(salary ? { baseSalary: salary } : {}),
  };
}
