import type { Metadata } from "next";

export const SITE_URL = "https://www.rolebolt.app";

export const siteConfig = {
  name: "Rolebolt",
  shortName: "Rolebolt",
  url: SITE_URL,
  locale: "en_US",
  defaultTitle: "Rolebolt — Every AI Tool You Need. Free for Everyone.",
  titleTemplate: "%s | Rolebolt",
  defaultDescription:
    "Rolebolt is the free all-in-one AI platform: personal AI companion, WhatsApp AI, Inbox AI, invoice automation, AI hiring, Smart Ledger, Link Pulse, Sales Analytics, and more — built for individuals and businesses worldwide.",
  slogan: "Every AI tool you need. Free for everyone.",
  defaultKeywords: [
    "Rolebolt",
    "Rolebolt",
    "Rolebolt app",
    "Rolebolt.app",
    "rolebolt ai platform",
    "free AI platform",
    "free AI tools",
    "free AI suite",
    "all in one AI",
    "all-in-one AI platform",
    "AI tools",
    "AI tools for business",
    "AI tools for free",
    "best free AI tools 2025",
    "best free AI tools 2026",
    "AI productivity tools",
    "AI suite",
    "unified AI platform",
    "AI workspace",
    "AI workspaces",
    "AI for everyone",
    "AI for small business",
    "AI for startups",
    "AI for SMBs",
    "AI for SMEs",
    "AI for enterprise",
    "multilingual AI",
    "WhatsApp AI",
    "WhatsApp business AI",
    "WhatsApp chatbot",
    "WhatsApp automation",
    "AI email assistant",
    "AI inbox",
    "Gmail AI",
    "Outlook AI",
    "AI invoice automation",
    "AI accounts payable",
    "AP automation",
    "invoice OCR AI",
    "AI for recruiters",
    "AI hiring",
    "AI ATS",
    "applicant tracking system AI",
    "AI smart ledger",
    "AI bookkeeping",
    "AI accounting",
    "personal AI assistant",
    "personal AI companion",
    "AI chat",
    "AI chatbot",
    "free AI chatbot",
    "Ibara",
    "Ibara widget",
    "AI chat widget",
    "embeddable AI",
    "business automation",
    "workflow automation AI",
    "AI translator",
    "AI translation",
    "free translator",
    "ChatGPT alternative",
    "ChatGPT alternative free",
    "Gemini alternative",
    "Claude alternative",
    "Copilot alternative",
    "Perplexity alternative",
    "AI for entrepreneurs",
    "AI for freelancers",
    "AI for agencies",
    "no credit card AI",
    "no signup AI",
    "AI without signup",
    "Budget Tracker AI",
    "AI budget tracker",
    "free budget tracker app",
    "student budget app free",
    "personal finance AI",
    "AI expense tracker",
    "monthly budget planner AI",
    "Sales AI",
    "AI cold email tool",
    "cold email AI",
    "AI sales outreach",
    "AI SDR free",
    "free AI sales tool",
    "AI outreach automation",
    "personalized cold email AI",
  ],
  twitterHandle: "@roleboltai",
  organization: {
    legalName: "Rolebolt",
    foundingDate: "2024",
    foundingLocation: "Global",
    email: "support@rolebolt.app",
    contactEmail: "support@rolebolt.app",
    pressEmail: "press@rolebolt.app",
    salesEmail: "sales@rolebolt.app",
    sameAs: [
      "https://www.rolebolt.app",
      "https://twitter.com/roleboltai",
      "https://x.com/roleboltai",
      "https://www.linkedin.com/company/rolebolt-ai",
      "https://github.com/rolebolt",
    ],
    knowsAbout: [
      "Artificial Intelligence",
      "Generative AI",
      "Natural Language Processing",
      "WhatsApp Business Automation",
      "Email Intelligence",
      "Accounts Payable Automation",
      "Applicant Tracking Systems",
      "AI Chatbots",
      "Smart Accounting",
      "Bookkeeping Automation",
      "Conversational AI",
      "Large Language Models",
      "URL Shortener and Link Analytics",
      "Sales Analytics and Business Intelligence",
      "Personal Finance Management",
      "AI Translation",
      "Cold Email and Sales Outreach Automation",
      "Website Chat Widgets",
      "AI Recruiting Technology",
    ],
  },
} as const;

export const productKeywords = {
  recruit: [
    "Recruit AI",
    "AI recruit",
    "AI hiring",
    "AI hiring software",
    "AI recruiting",
    "AI recruiting software",
    "AI recruiting platform",
    "AI ATS",
    "AI applicant tracking system",
    "applicant tracking system free",
    "free ATS",
    "free ATS software",
    "free ATS for startups",
    "free ATS for small business",
    "AI candidate sourcing",
    "AI candidate screening",
    "AI resume screening",
    "AI resume parser",
    "AI CV parser",
    "AI resume analyzer",
    "AI resume scoring",
    "AI candidate scoring",
    "AI candidate matching",
    "AI job matching",
    "AI interview scheduling",
    "AI interview AI",
    "AI interview assistant",
    "AI interview question generator",
    "AI hiring funnel",
    "AI hiring pipeline",
    "AI hiring workflow",
    "AI offer letter generator",
    "AI rejection email",
    "AI reference check",
    "AI background check",
    "AI hiring analytics",
    "AI talent CRM",
    "AI talent pool",
    "AI recruitment marketing",
    "AI job posting generator",
    "AI JD generator",
    "AI job description writer",
    "AI hiring for startups",
    "AI hiring for SMB",
    "AI hiring for tech",
    "AI hiring for non-tech",
    "AI hiring for agencies",
    "AI hiring for consultants",
    "AI hiring for HR teams",
    "AI hiring for in-house recruiters",
    "Naukri alternative",
    "LinkedIn Recruiter alternative",
    "Greenhouse alternative",
    "Lever alternative",
    "Workable alternative",
    "Recruitee alternative",
    "Zoho Recruit alternative",
    "Freshteam alternative",
    "iSmartRecruit alternative",
    "JazzHR alternative",
    "Manatal alternative",
    "Breezy HR alternative",
    "free Greenhouse alternative",
    "free Lever alternative",
    "free Workable alternative",
    "best free ATS 2025",
    "best free ATS 2026",
    "best AI recruiting tool 2025",
    "best AI hiring tool 2026",
    "AI recruiter assistant",
    "AI recruiter copilot",
    "ChatGPT for recruiters",
    "Gemini for recruiters",
    "AI hiring chatbot",
    "AI candidate chatbot",
    "AI hiring outreach",
    "AI sourcing automation",
    "AI resume database",
    "AI talent database",
    "how to screen resumes with AI",
    "how to source candidates with AI",
    "how to schedule interviews with AI",
    "how to write job descriptions with AI",
    "AI hiring software free no signup",
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
  for (const kw of [...siteConfig.defaultKeywords, ...(keywords ?? [])]) {
    const key = kw.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      dedupedKeywords.push(kw);
    }
  }
  const finalKeywords = dedupedKeywords.join(", ");

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
      url: `${SITE_URL}/icons/rolebolt-512.png`,
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
          urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
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
    image: `${SITE_URL}/icons/rolebolt-512.png`,
    softwareVersion: "1.0",
    inLanguage: ["en", "hi"],
    featureList: [
      "Personal AI companion (Simi & Loa) with persistent memory",
      "WhatsApp AI — 24/7 customer automation for WhatsApp Business",
      "Inbox AI — email triage and smart replies for Gmail & Outlook",
      "Payable AI — invoice OCR and accounts payable automation",
      "Recruit AI — AI applicant tracking system and hiring pipeline",
      
      "Smart Ledger — AI-powered bookkeeping for traders and small businesses",
      "Ibara — embeddable AI chat widget for any website",
      "Translate AI — 100+ language translation with privacy-first design",
      "Budget Tracker AI — free personal monthly budget planner",
      "Sales AI — personalized AI cold email and outreach automation",
      "Link Pulse — free URL shortener with click analytics, A/B testing, and bio link pages",
      "Sales Analytics Dashboard — revenue tracking by region, category, and time period for retail businesses",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      priceValidUntil: "2030-12-31",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "2847",
      reviewCount: "2847",
      bestRating: "5",
      worstRating: "1",
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
      price: "0",
      priceCurrency: "USD",
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
          urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
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
