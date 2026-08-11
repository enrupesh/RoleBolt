export type FounderTeamSpotlight = {
  id: string;
  brandName: string;
  roleLabel: string;
  rating: 5;
  title: string;
  message: string;
  displayName: string;
  logoSrc: string;
  logoAlt: string;
  /** Official site — only open when websiteClickable is true */
  websiteUrl: string;
  websiteClickable: boolean;
  /** Stable review uid used by backend seed — hide from community grid */
  reviewUid?: string;
};

/** Highlighted Job Creator brands — shown in their own section, not mixed with community cards. */
export const FOUNDERS_TEAMS_SPOTLIGHTS: FounderTeamSpotlight[] = [
  {
    id: "plyndrox",
    brandName: "Plyndrox.app",
    roleLabel: "Job Creator · Hiring team",
    rating: 5,
    title: "Hiring that finally keeps up with how fast we grow",
    message:
      "As a fast-growing startup, hiring the right talent quickly was always a challenge. Rolebolt’s AI-powered platform transformed our recruitment process — from smarter candidate screening to faster shortlisting, everything became more efficient. It saved us countless hours and helped us make better hiring decisions with confidence. Highly recommend Rolebolt to any company looking to scale hiring the smart way.",
    displayName: "HR Team, Plyndrox.app",
    logoSrc: "/brands/plyndrox-logo.svg",
    logoAlt: "Plyndrox AI logo",
    websiteUrl: "https://www.plyndrox.app",
    websiteClickable: true,
    reviewUid: "partner:plyndrox.app",
  },
];

export function isFoundersTeamsReview(review: {
  displayName?: string;
  id?: string;
}): boolean {
  const name = String(review.displayName || "").toLowerCase();
  return FOUNDERS_TEAMS_SPOTLIGHTS.some(
    (spot) =>
      name.includes(spot.brandName.toLowerCase()) ||
      name.includes("plyndrox") ||
      name.includes("sendora"),
  );
}
