import type { Metadata } from "next";
import { sitegenProduct } from "./product";

const SITEGEN_TITLE = "Create Your Free Website | Sitegen";
const SITEGEN_DESCRIPTION =
  "Build a professional website in minutes. Choose Job Seeker or Creator, create your site with a username and password, and publish at www.rolebolt.tech/yourname — free, with no Rolebolt account required.";

export function sitegenMetadata(): Metadata {
  return {
    title: SITEGEN_TITLE,
    description: SITEGEN_DESCRIPTION,
    keywords: [
      "free website builder",
      "professional website",
      "portfolio website",
      "business website",
      "job seeker portfolio",
      "creator website",
      "www.rolebolt.tech username",
    ],
    openGraph: {
      title: SITEGEN_TITLE,
      description: SITEGEN_DESCRIPTION,
      type: "website",
      url: `${sitegenProduct.canonicalOrigin}${sitegenProduct.basePath}`,
    },
    twitter: {
      card: "summary_large_image",
      title: SITEGEN_TITLE,
      description: SITEGEN_DESCRIPTION,
    },
    robots: { index: true, follow: true },
  };
}
