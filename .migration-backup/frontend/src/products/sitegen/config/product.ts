/**
 * Sitegen — independent website-generation product configuration.
 * Keep all product identity and environment knobs here so the module
 * can be extracted to its own repository/domain with minimal changes.
 */

export const sitegenProduct = {
  /** Internal product codename */
  codename: "sitegen",

  /** User-facing product name */
  name: "Sitegen",

  /** Primary marketing headline */
  headline: "Create your professional website — free.",

  /** Canonical HTTPS origin for published public sites */
  canonicalOrigin: "https://www.rolebolt.tech",

  /** Display host for published public sites */
  publicHost: "www.rolebolt.tech",

  /** Public URL pattern for published sites */
  publicUrlPattern: "www.rolebolt.tech/{username}",

  /** Base path for the product app (change when moving to own domain) */
  basePath: "/website",

  /** Host domain while embedded in Rolebolt marketing pages */
  hostDomain: "www.rolebolt.tech",

  /** Support contact — product-specific */
  supportEmail: "support@rolebolt.tech",
} as const;

export type SitegenSiteType = "seeker" | "creator";

export const sitegenSiteTypeLabels: Record<SitegenSiteType, string> = {
  seeker: "Job Seeker",
  creator: "Creator / Business",
};
