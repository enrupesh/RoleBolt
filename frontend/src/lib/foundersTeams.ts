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
  {
    id: "sendora",
    brandName: "Sendora.me",
    roleLabel: "Job Creator · Founder",
    rating: 5,
    title: "Private hiring with AI screening — finally under our control",
    message:
      "As the founder of Sendora.me, finding the right talent quickly while keeping our hiring process secure was always a priority. Rolebolt made this incredibly easy. We loved being able to post jobs privately and connect with a curated pool of private candidates — giving us full control over visibility and outreach. On top of that, Rolebolt’s AI-powered candidate screening and smart matching helped us shortlist the right people in a fraction of the time we used to spend manually. The intuitive dashboard made tracking applicants effortless, and the entire process felt faster, smarter, and far more secure. Rolebolt has genuinely become an essential part of how we hire at Sendora.me.",
    displayName: "Founder, Sendora.me",
    logoSrc: "/brands/sendora-logo.png",
    logoAlt: "Sendora logo",
    websiteUrl: "https://sendora.me",
    websiteClickable: false,
    reviewUid: "partner:sendora.me",
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
