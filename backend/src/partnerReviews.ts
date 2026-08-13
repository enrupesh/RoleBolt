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
  {
    uid: "partner:sendora.me",
    rating: 5,
    title: "Private hiring with AI screening — finally under our control",
    message:
      "As the founder of Sendora.me, finding the right talent quickly while keeping our hiring process secure was always a priority. Rolebolt made this incredibly easy. We loved being able to post jobs privately and connect with a curated pool of private candidates — giving us full control over visibility and outreach. On top of that, Rolebolt’s AI-powered candidate screening and smart matching helped us shortlist the right people in a fraction of the time we used to spend manually. The intuitive dashboard made tracking applicants effortless, and the entire process felt faster, smarter, and far more secure. Rolebolt has genuinely become an essential part of how we hire at Sendora.me.",
    displayName: "Founder, Sendora.me",
    role: "creator" as const,
    featured: true,
    visible: true,
    isGuest: false,
  },
] as const;
