/**
 * Curated partner reviews — upserted into MongoDB so they appear on
 * /reviews and the landing FeaturedReviews section (featured: true).
 * Stable `uid` values keep the seed idempotent across deploys.
 */
export const PARTNER_REVIEWS = [
  {
    uid: "partner:plyndrox.app",
    rating: 5,
    title: "Hiring that finally keeps up with how fast we grow",
    message:
      "As a fast-growing startup, hiring the right talent quickly was always a challenge. Rolebolt’s AI-powered platform transformed our recruitment process — from smarter candidate screening to faster shortlisting, everything became more efficient. It saved us countless hours and helped us make better hiring decisions with confidence. Highly recommend Rolebolt to any company looking to scale hiring the smart way.",
    displayName: "HR Team, Plyndrox.app",
    role: "creator" as const,
    featured: true,
    visible: true,
    isGuest: false,
  },
] as const;
